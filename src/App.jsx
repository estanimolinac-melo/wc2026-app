import { useState, useCallback, useEffect, useRef } from "react";
import { Flag, INITIAL_TEAMS, INITIAL_PLAYERS, FACTOR_WEIGHTS, PREDICTED_KNOCKOUT, INITIAL_GROUPS } from "./data.jsx";

// ── WC NATION IDS for API-Football (used by side panel & server) ─────────────
// These are the API-Football team IDs for all 48 World Cup nations
export const WC_TEAM_IDS = [
  2,    // France
  6,    // Brazil
  9,    // Spain
  10,   // Argentina
  15,   // USA
  18,   // Portugal
  21,   // England
  25,   // Germany
  26,   // Netherlands
  29,   // Morocco
  31,   // Belgium
  36,   // Japan
  39,   // Mexico
  41,   // Canada
  44,   // Uruguay
  48,   // Switzerland
  50,   // Croatia
  54,   // Colombia
  55,   // South Korea
  60,   // Norway
  62,   // Turkey
  63,   // Senegal
  65,   // Australia
  66,   // Ecuador
  67,   // Ghana
  68,   // Saudi Arabia
  74,   // Austria
  83,   // Algeria
  84,   // Iraq
  85,   // South Africa
  86,   // Iran
  91,   // Qatar
  95,   // Panama
  96,   // Cape Verde
  98,   // Paraguay
  101,  // New Zealand
  102,  // Scotland
  107,  // Bosnia-Herzegovina
  112,  // Czechia
  119,  // Curaçao
  154,  // Haiti
  163,  // Jordan
  172,  // Tunisia
  174,  // DR Congo
  195,  // Ivory Coast
  202,  // Egypt
  265,  // Uzbekistan
];

// ── BACKEND URL ───────────────────────────────────────────────────────────────
// Replace this with your actual Render URL once deployed
const BACKEND_URL = "https://wc2026-fetcher.onrender.com";

// ── SHARED ────────────────────────────────────────────────────────────────────
const probColor = p => p>=14?"#C9A84C":p>=8?"#8bb8f0":p>=4?"#2ecc71":"#8E9BAF";
const POS_COLORS = { FWD:"#e74c3c", MID:"#2ecc71", DEF:"#8bb8f0", GK:"#C9A84C" };
const tabs = ["Leaderboard","Groups","Bracket","Players","Updates","Weights"];
const UPDATE_TYPES = ["result","injury","fitness","suspension","tactical","news"];
const UPDATE_COLORS = { result:"#2ecc71", injury:"#e74c3c", fitness:"#f39c12", suspension:"#e67e22", tactical:"#8bb8f0", news:"#8E9BAF" };
const SORT_OPTIONS = [
  {key:"rank",    label:"Pre-Tournament Rank"},
  {key:"fantasy", label:"Fantasy Score (Overall Rating)"},
  {key:"goals",   label:"Goals"},
  {key:"assists", label:"Assists"},
  {key:"cleanSheets", label:"Clean Sheets"},
  {key:"interceptions", label:"Interceptions"},
  {key:"saves",   label:"Saves (GK)"},
];

function ChangeIndicator({change}){
  if(!change||Math.abs(change)<0.05) return <span style={{color:"#444",fontSize:11,fontFamily:"monospace"}}>—</span>;
  const up=change>0;
  return <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:up?"#2ecc71":"#e74c3c"}}>{up?"▲":"▼"} {Math.abs(change).toFixed(1)}%</span>;
}

function calcFantasyScore(p){
  if(p.apps===0) return 0;
  let s=(p.goals*6)+(p.assists*4)+(p.apps*1)+(p.cleanSheets*3)
    +(p.interceptions*0.6)+(p.foulsDrawn*0.3)-(p.foulsCommitted*0.25)
    -(p.yellowCards*0.5)-(p.redCards*3);
  if(p.pos==="GK") s+=(p.saves*0.5)+(p.penaltySaves*3)+(p.cleanSheets*2);
  if(p.pos==="DEF") s+=(p.cleanSheets*1.5);
  return Math.max(0,parseFloat(s.toFixed(1)));
}

const buildSystemPrompt=(teams,updates)=>`You are the analytical engine for a FIFA World Cup 2026 prediction tracker. Recalculate championship win probabilities for all teams.
METHODOLOGY WEIGHTS (total=100%): Team Factors (72%): Form 16%, Big-Game 14%, Chemistry 13%, xG/Tactical 11%, Injuries 10%, Age 8%. Manager (11%). IPFI (6%). Contextual (6%). Pure Luck (5%).
CURRENT PROBABILITIES: ${teams.map(t=>`${t.name}: ${t.prob}%`).join(", ")}
UPDATES: ${updates.length>0?updates.map(u=>`[${u.date}] ${u.type}: ${u.text}`).join(" | "):"Baseline"}
Respond ONLY with valid JSON: {"teams":[{"id":"FRA","prob":18.5,"change":0.5,"reasoning":"brief"},...all 18],"summary":"2-3 sentences","biggestMover":"team + why"}. Probabilities sum to ~100%.`;

// ── SIDE PANEL — LIVE MATCH FEED ─────────────────────────────────────────────
const STATUS_COLORS = {
  "FT":       "#2ecc71",
  "NS":       "#8E9BAF",
  "1H":       "#e74c3c",
  "2H":       "#e74c3c",
  "HT":       "#f39c12",
  "ET":       "#e74c3c",
  "P":        "#9b59b6",
  "AET":      "#2ecc71",
  "PEN":      "#2ecc71",
  "CANC":     "#e74c3c",
  "PST":      "#e74c3c",
};

function MatchCard({match}){
  const [expanded, setExpanded] = useState(false);
  const status = match.fixture?.status?.short || "NS";
  const elapsed = match.fixture?.status?.elapsed;
  const home = match.teams?.home;
  const away = match.teams?.away;
  const hGoals = match.goals?.home ?? "—";
  const aGoals = match.goals?.away ?? "—";
  const isLive = ["1H","2H","HT","ET","P"].includes(status);
  const isFinished = ["FT","AET","PEN"].includes(status);
  const isUpcoming = status === "NS";

  // group events by type
  const goals = (match.events||[]).filter(e=>e.type==="Goal");
  const cards = (match.events||[]).filter(e=>e.type==="Card");

  const dateStr = match.fixture?.date
    ? new Date(match.fixture.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})
    : "";

  const statusLabel = isLive ? `${elapsed}'` : status;

  return(
    <div style={{
      background:"rgba(255,255,255,0.03)",
      border:`1px solid ${isLive?"rgba(231,76,60,0.4)":isFinished?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.05)"}`,
      borderRadius:4,
      marginBottom:6,
      overflow:"hidden",
      cursor:"pointer",
      boxShadow: isLive?"0 0 8px rgba(231,76,60,0.15)":"none"
    }} onClick={()=>setExpanded(!expanded)}>
      {/* Match header */}
      <div style={{padding:"8px 10px"}}>
        {/* Date + status + competition */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:10,fontFamily:"monospace",color:"#8E9BAF"}}>{dateStr}</span>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            {isLive&&<span style={{width:6,height:6,borderRadius:"50%",background:"#e74c3c",display:"inline-block",animation:"pulse 1.5s infinite"}}/>}
            <span style={{
              fontSize:10,fontFamily:"monospace",fontWeight:700,
              color: STATUS_COLORS[status]||"#8E9BAF",
              background:`${STATUS_COLORS[status]||"#8E9BAF"}18`,
              padding:"1px 6px",borderRadius:2
            }}>{statusLabel}</span>
          </div>
        </div>
        {/* Score row */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 36px 1fr",alignItems:"center",gap:4}}>
          {/* Home */}
          <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}>
            <span style={{fontSize:12,fontWeight:home?.winner?700:400,color:home?.winner?"#F5F0E8":"rgba(255,255,255,0.7)",textAlign:"right"}}>{home?.name||"TBD"}</span>
            {home?.logo&&<img src={home.logo} alt="" style={{width:16,height:16,objectFit:"contain",flexShrink:0}}/>}
          </div>
          {/* Score */}
          <div style={{textAlign:"center",fontFamily:"monospace",fontSize:14,fontWeight:700,color:isUpcoming?"#8E9BAF":"#F5F0E8"}}>
            {isUpcoming ? (match.fixture?.date ? new Date(match.fixture.date).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}) : "—") : `${hGoals}–${aGoals}`}
          </div>
          {/* Away */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {away?.logo&&<img src={away.logo} alt="" style={{width:16,height:16,objectFit:"contain",flexShrink:0}}/>}
            <span style={{fontSize:12,fontWeight:away?.winner?700:400,color:away?.winner?"#F5F0E8":"rgba(255,255,255,0.7)"}}>{away?.name||"TBD"}</span>
          </div>
        </div>
        {/* Competition name */}
        {match.league?.name&&(
          <div style={{textAlign:"center",fontSize:10,color:"#8E9BAF",marginTop:4,fontStyle:"italic"}}>{match.league.name}</div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded&&(goals.length>0||cards.length>0)&&(
        <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"8px 10px",background:"rgba(0,0,0,0.2)"}}>
          {goals.length>0&&(
            <div style={{marginBottom:cards.length>0?8:0}}>
              {goals.map((e,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"rgba(255,255,255,0.7)",marginBottom:3}}>
                  <span style={{color:"#2ecc71",fontSize:13}}>⚽</span>
                  <span style={{fontFamily:"monospace",color:"#8E9BAF",flexShrink:0}}>{e.time?.elapsed}'</span>
                  <span style={{fontWeight:600,color:"#F5F0E8"}}>{e.player?.name}</span>
                  {e.assist?.name&&<span style={{color:"#8E9BAF"}}>({e.assist.name})</span>}
                  <span style={{marginLeft:"auto",fontSize:10,color:"#8E9BAF"}}>{e.team?.name}</span>
                </div>
              ))}
            </div>
          )}
          {cards.length>0&&(
            <div>
              {cards.map((e,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"rgba(255,255,255,0.7)",marginBottom:3}}>
                  <span style={{fontSize:12}}>{e.detail==="Red Card"||e.detail==="Second Yellow card"?"🟥":"🟨"}</span>
                  <span style={{fontFamily:"monospace",color:"#8E9BAF",flexShrink:0}}>{e.time?.elapsed}'</span>
                  <span style={{fontWeight:600,color:"#F5F0E8"}}>{e.player?.name}</span>
                  <span style={{marginLeft:"auto",fontSize:10,color:"#8E9BAF"}}>{e.team?.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!expanded&&(isFinished||isLive)&&(goals.length>0||cards.length>0)&&(
        <div style={{textAlign:"center",padding:"2px",fontSize:10,color:"rgba(255,255,255,0.2)"}}>▼ goals & cards</div>
      )}
    </div>
  );
}

function SidePanel({ matches, loading, error, onRefresh }){
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const scrollRef = useRef(null);

  const filtered = matches.filter(m=>{
    const dateOk = !filterDate || (m.fixture?.date||"").startsWith(filterDate);
    const statusOk = filterStatus==="ALL" ||
      (filterStatus==="LIVE" && ["1H","2H","HT","ET","P"].includes(m.fixture?.status?.short)) ||
      (filterStatus==="FT"   && ["FT","AET","PEN"].includes(m.fixture?.status?.short)) ||
      (filterStatus==="NS"   && m.fixture?.status?.short==="NS");
    return dateOk && statusOk;
  });

  const liveCount = matches.filter(m=>["1H","2H","HT","ET","P"].includes(m.fixture?.status?.short)).length;

  return(
    <div style={{
      width:280, flexShrink:0,
      background:"#0D0D14",
      borderLeft:"1px solid rgba(201,168,76,0.15)",
      display:"flex", flexDirection:"column",
      height:"100vh", position:"sticky", top:0,
      overflow:"hidden"
    }}>
      {/* Panel header */}
      <div style={{padding:"14px 12px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div>
            <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.2em",color:"#C9A84C",textTransform:"uppercase"}}>Match Feed</div>
            <div style={{fontSize:11,color:"#8E9BAF",marginTop:2}}>WC nations · May 16 onward</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {liveCount>0&&(
              <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(231,76,60,0.15)",border:"1px solid rgba(231,76,60,0.3)",borderRadius:3,padding:"2px 7px"}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:"#e74c3c",display:"inline-block",animation:"pulse 1.5s infinite"}}/>
                <span style={{fontFamily:"monospace",fontSize:10,color:"#e74c3c",fontWeight:700}}>{liveCount} LIVE</span>
              </div>
            )}
            <button onClick={onRefresh} disabled={loading} style={{background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:3,padding:"4px 8px",color:"#C9A84C",fontSize:12,cursor:loading?"not-allowed":"pointer",opacity:loading?0.5:1}}>
              {loading?"⟳":"⟳"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{display:"flex",gap:5,marginBottom:6}}>
          {["ALL","LIVE","FT","NS"].map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)} style={{
              flex:1,background:filterStatus===s?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",
              border:`1px solid ${filterStatus===s?"rgba(201,168,76,0.5)":"rgba(255,255,255,0.08)"}`,
              borderRadius:3,padding:"3px 0",fontSize:10,fontFamily:"monospace",
              color:filterStatus===s?"#C9A84C":"#8E9BAF",cursor:"pointer",letterSpacing:"0.05em"
            }}>{s}</button>
          ))}
        </div>

        {/* Date filter */}
        <input
          type="date"
          value={filterDate}
          onChange={e=>setFilterDate(e.target.value)}
          style={{
            width:"100%",background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.1)",borderRadius:3,
            padding:"5px 8px",color:"#F5F0E8",fontSize:11,
            fontFamily:"monospace",outline:"none",boxSizing:"border-box",
            colorScheme:"dark"
          }}
          placeholder="Filter by date"
        />
      </div>

      {/* Match list */}
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
        {error&&(
          <div style={{padding:"12px",background:"rgba(231,76,60,0.1)",border:"1px solid rgba(231,76,60,0.3)",borderRadius:4,fontSize:12,color:"#e74c3c",marginBottom:8}}>
            {error}
          </div>
        )}
        {loading&&matches.length===0&&(
          <div style={{textAlign:"center",padding:"30px 0",color:"#8E9BAF",fontSize:12}}>Loading matches…</div>
        )}
        {!loading&&filtered.length===0&&matches.length>0&&(
          <div style={{textAlign:"center",padding:"30px 0",color:"#8E9BAF",fontSize:12,fontStyle:"italic"}}>No matches for this filter.</div>
        )}
        {!loading&&matches.length===0&&!error&&(
          <div style={{textAlign:"center",padding:"30px 0",color:"#8E9BAF",fontSize:12,fontStyle:"italic"}}>
            Connect the Render backend to load matches automatically, or add results via the Updates tab.
          </div>
        )}
        {filtered.map((m,i)=><MatchCard key={m.fixture?.id||i} match={m}/>)}
      </div>

      {/* Footer count */}
      <div style={{padding:"6px 10px",borderTop:"1px solid rgba(255,255,255,0.04)",flexShrink:0,fontSize:10,fontFamily:"monospace",color:"#8E9BAF",textAlign:"center"}}>
        {filtered.length} match{filtered.length!==1?"es":""} shown
      </div>
    </div>
  );
}

// ── LEADERBOARD ──────────────────────────────────────────────────────────────
function LeaderboardTab({teams}){
  const [expanded,setExpanded]=useState(null);
  const sorted=[...teams].sort((a,b)=>b.prob-a.prob);
  const max=sorted[0]?.prob||1;
  return(
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase",marginBottom:6}}>Live Championship Probability Leaderboard</div>
        <div style={{fontSize:13,color:"#8E9BAF",maxWidth:600}}>Click any team to expand strengths, weaknesses, and probability rationale.</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {sorted.map((team,i)=>{
          const barW=(team.prob/max)*100;
          const col=probColor(team.prob);
          const open=expanded===team.id;
          return(
            <div key={team.id} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${open?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.07)"}`,borderRadius:4,overflow:"hidden",cursor:"pointer"}}
              onClick={()=>setExpanded(open?null:team.id)}>
              <div style={{display:"grid",gridTemplateColumns:"32px 36px 1fr 80px 60px 60px 24px",alignItems:"center",gap:10,padding:"11px 16px"}}>
                <div style={{fontFamily:"monospace",fontSize:13,color:"#8E9BAF",textAlign:"center"}}>#{i+1}</div>
                <Flag id={team.id} size={28} style={{borderRadius:3}}/>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:"#F5F0E8",marginBottom:3}}>{team.name}</div>
                  <div style={{position:"relative",height:4,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${barW}%`,background:`linear-gradient(90deg,${col},${col}88)`,borderRadius:3,transition:"width 0.8s"}}/>
                  </div>
                </div>
                <div style={{textAlign:"right"}}><span style={{fontFamily:"monospace",fontSize:18,fontWeight:700,color:col}}>{team.prob.toFixed(1)}%</span></div>
                <div style={{textAlign:"center"}}><ChangeIndicator change={team.change}/></div>
                <div style={{textAlign:"right",fontSize:11,color:"#8E9BAF",fontFamily:"monospace"}}>Grp {team.group}</div>
                <div style={{color:"#8E9BAF",fontSize:12,textAlign:"center"}}>{open?"▲":"▼"}</div>
              </div>
              {open&&(
                <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",padding:"16px",background:"rgba(0,0,0,0.2)"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:14}}>
                    <div><div style={{fontSize:10,fontFamily:"monospace",letterSpacing:"0.15em",color:"#2ecc71",marginBottom:6}}>STRENGTHS</div><div style={{fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.6}}>{team.strengths}</div></div>
                    <div><div style={{fontSize:10,fontFamily:"monospace",letterSpacing:"0.15em",color:"#e74c3c",marginBottom:6}}>WEAKNESSES</div><div style={{fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.6}}>{team.weaknesses}</div></div>
                  </div>
                  <div style={{padding:"10px 14px",background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:4}}>
                    <div style={{fontSize:10,fontFamily:"monospace",letterSpacing:"0.15em",color:"#C9A84C",marginBottom:5}}>PROBABILITY RATIONALE</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",lineHeight:1.6}}>{team.rationale}</div>
                  </div>
                  <div style={{display:"flex",gap:24,marginTop:12,flexWrap:"wrap"}}>
                    {[["Manager",team.manager],["CIS",`${team.cis}/10`],["Chemistry",`${team.chemistry}/10`],["Form",`${team.form}/10`]].map(([l,v])=>(
                      <div key={l}><span style={{fontSize:11,color:"#8E9BAF",fontFamily:"monospace"}}>{l}: </span><span style={{fontSize:13,color:"#F5F0E8",fontWeight:600}}>{v}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── GROUPS ───────────────────────────────────────────────────────────────────
function GroupsTab({groups}){
  return(
    <div>
      <div style={{marginBottom:20,fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase"}}>Group Stage Tables</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
        {Object.values(groups).map(group=>{
          const sorted=[...group.teams].sort((a,b)=>b.pts!==a.pts?b.pts-a.pts:(b.gf-b.ga)-(a.gf-a.ga));
          return(
            <div key={group.name} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:6,overflow:"hidden"}}>
              <div style={{background:"rgba(201,168,76,0.1)",borderBottom:"1px solid rgba(201,168,76,0.2)",padding:"8px 14px"}}>
                <span style={{fontFamily:"Impact,sans-serif",fontSize:26,color:"#C9A84C"}}>GROUP {group.name}</span>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>{["Team","W","D","L","GD","Pts"].map(h=><th key={h} style={{padding:"6px 8px",fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:"#C9A84C88",textAlign:h==="Team"?"left":"center",fontWeight:400}}>{h}</th>)}</tr></thead>
                <tbody>
                  {sorted.map((t,i)=>(
                    <tr key={t.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:i===0?"rgba(26,94,58,0.15)":i===1?"rgba(26,58,107,0.12)":"transparent"}}>
                      <td style={{padding:"9px 8px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{width:18,height:18,borderRadius:"50%",background:i===0?"#C9A84C":i===1?"#1A3A6B":"rgba(255,255,255,0.1)",color:i===0?"#0A0A0F":"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>
                          <span style={{fontSize:16}}>{t.flag}</span>
                          <span style={{color:"#F5F0E8",fontWeight:i<2?600:400}}>{t.name}</span>
                        </div>
                      </td>
                      {[t.w,t.d,t.l,t.gf-t.ga,t.pts].map((v,vi)=>(
                        <td key={vi} style={{textAlign:"center",padding:"9px 8px",color:vi===4?"#C9A84C":vi===3?(v>0?"#2ecc71":v<0?"#e74c3c":"#F5F0E8"):"#F5F0E8",fontFamily:vi===4?"monospace":"inherit",fontWeight:vi===4?700:400}}>
                          {vi===3&&v>0?`+${v}`:v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── BRACKET ──────────────────────────────────────────────────────────────────
function BracketMatchup({match}){
  const [open,setOpen]=useState(false);
  return(
    <div style={{background:"#14141C",border:`1px solid ${open?"rgba(201,168,76,0.5)":"rgba(255,255,255,0.1)"}`,borderRadius:4,overflow:"hidden",cursor:"pointer",minWidth:200}}
      onClick={()=>setOpen(!open)}>
      {[match.a,match.b].map((team,ti)=>{
        const isWinner=match.winner===team.name;
        const isLoser=match.winner&&!isWinner;
        return(
          <div key={ti} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 10px",background:isWinner?"rgba(201,168,76,0.12)":"transparent",borderBottom:ti===0?"1px solid rgba(255,255,255,0.08)":"none"}}>
            <Flag id={team.id} size={16} style={{borderRadius:2,opacity:isLoser?0.4:1}}/>
            <span style={{flex:1,fontSize:12,fontWeight:isWinner?700:400,color:isWinner?"#E8C97A":isLoser?"rgba(255,255,255,0.3)":"#F5F0E8",textDecoration:isLoser?"line-through":"none",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{team.name}</span>
            <span style={{fontFamily:"monospace",fontSize:11,color:isWinner?"#C9A84C":"rgba(255,255,255,0.25)",flexShrink:0}}>{team.prob}%</span>
          </div>
        );
      })}
      {open&&match.rat&&(
        <div style={{padding:"10px",background:"rgba(0,0,0,0.3)",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><div style={{fontSize:9,fontFamily:"monospace",color:"#2ecc71",marginBottom:3}}>{match.a.name.toUpperCase()}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.4}}>{match.aS}</div></div>
            <div><div style={{fontSize:9,fontFamily:"monospace",color:"#e74c3c",marginBottom:3}}>{match.b.name.toUpperCase()}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.4}}>{match.bS}</div></div>
          </div>
          <div style={{padding:"7px 10px",background:"rgba(201,168,76,0.07)",borderRadius:3,fontSize:11,color:"rgba(255,255,255,0.7)",lineHeight:1.5}}><span style={{color:"#C9A84C",fontFamily:"monospace",fontSize:9,letterSpacing:"0.1em"}}>VERDICT: </span>{match.rat}</div>
        </div>
      )}
    </div>
  );
}

function BracketTab({bracket}){
  return(
    <div>
      <div style={{marginBottom:16,fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase"}}>Knockout Bracket — Click Any Matchup to Expand Analysis</div>
      <div style={{overflowX:"auto",paddingBottom:16}}>
        <div style={{display:"flex",gap:0,alignItems:"flex-start",minWidth:"max-content"}}>
          {bracket.map((round,ri)=>(
            <div key={ri} style={{display:"flex",flexDirection:"row",alignItems:"center"}}>
              <div style={{display:"flex",flexDirection:"column"}}>
                <div style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.2em",color:"#C9A84C",textTransform:"uppercase",textAlign:"center",padding:"6px 12px",borderBottom:"1px solid rgba(201,168,76,0.2)",marginBottom:8,background:"rgba(201,168,76,0.06)",borderRadius:"4px 4px 0 0",minWidth:200,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {round.round.replace(" — July 19, MetLife","")}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:Math.pow(2,ri)*8,paddingTop:ri===0?0:Math.pow(2,ri)*4,paddingBottom:ri===0?0:Math.pow(2,ri)*4}}>
                  {round.matches.map((match,mi)=><BracketMatchup key={mi} match={match}/>)}
                </div>
              </div>
              {ri<bracket.length-1&&(
                <div style={{display:"flex",flexDirection:"column",justifyContent:"space-around",width:24,alignSelf:"stretch",marginTop:36}}>
                  {round.matches.map((_,mi)=>(
                    <div key={mi} style={{display:"flex",alignItems:"center",flex:1}}>
                      <div style={{width:"100%",height:2,background:"rgba(201,168,76,0.2)"}}/>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{marginTop:32}}>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.2em",color:"#8E9BAF",textTransform:"uppercase",marginBottom:16,paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>All Matchup Details</div>
        {bracket.map((round,ri)=>(
          <div key={ri} style={{marginBottom:28}}>
            <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:"1px solid rgba(201,168,76,0.15)"}}>{round.round}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:8}}>
              {round.matches.map((match,mi)=><BracketMatchup key={mi} match={match}/>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PLAYERS ──────────────────────────────────────────────────────────────────
function PlayersTab({players}){
  const [filterPos,setFilterPos]=useState("ALL");
  const [sortKey,setSortKey]=useState("rank");
  const withScores=players.map(p=>({...p,fantasy:calcFantasyScore(p)}));
  const filtered=filterPos==="ALL"?withScores:withScores.filter(p=>p.pos===filterPos);
  const sorted=[...filtered].sort((a,b)=>sortKey==="rank"?a.rank-b.rank:(b[sortKey]??0)-(a[sortKey]??0));
  return(
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase",marginBottom:8}}>Top 100 World Cup 2026 Players</div>
        <div style={{padding:"12px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:4,fontSize:13,color:"#8E9BAF",lineHeight:1.6,maxWidth:760}}>
          This leaderboard displays the <strong style={{color:"#F5F0E8"}}>top 100 players competing at the 2026 World Cup</strong>, ranked by in-tournament statistics as the competition progresses. Pre-tournament order is based on the Fox Sports expert ranking. <em>All statistics currently show zero — the tournament begins June 11.</em>
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16,alignItems:"center"}}>
        {["ALL","FWD","MID","DEF","GK"].map(pos=>(
          <button key={pos} onClick={()=>setFilterPos(pos)} style={{background:filterPos===pos?(POS_COLORS[pos]||"#C9A84C"):"rgba(255,255,255,0.05)",color:filterPos===pos?"#0A0A0F":"#8E9BAF",border:`1px solid ${filterPos===pos?(POS_COLORS[pos]||"#C9A84C"):"rgba(255,255,255,0.1)"}`,borderRadius:3,padding:"5px 12px",fontSize:11,fontFamily:"monospace",letterSpacing:"0.1em",cursor:"pointer",fontWeight:600}}>{pos}</button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,fontFamily:"monospace",color:"#8E9BAF"}}>SORT BY</span>
          <select value={sortKey} onChange={e=>setSortKey(e.target.value)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:3,padding:"5px 10px",color:"#F5F0E8",fontSize:12,fontFamily:"monospace"}}>
            {SORT_OPTIONS.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:780}}>
          <thead>
            <tr style={{borderBottom:"2px solid rgba(201,168,76,0.3)"}}>
              {[{k:"rank",l:"#"},{k:"name",l:"Player"},{k:"fantasy",l:"Rating"},{k:"goals",l:"G",t:"Goals"},{k:"assists",l:"A",t:"Assists"},{k:"apps",l:"Apps"},{k:"cleanSheets",l:"CS",t:"Clean Sheets"},{k:"interceptions",l:"Int"},{k:"saves",l:"Sv",t:"Saves (GK)"},{k:"penaltySaves",l:"PSv",t:"Penalty Saves"},{k:"yellowCards",l:"YC"},{k:"redCards",l:"RC"}].map(col=>(
                <th key={col.k} title={col.t||""} style={{padding:"8px 8px",fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:sortKey===col.k?"#F5F0E8":"#C9A84C",textAlign:col.k==="name"?"left":"center",fontWeight:sortKey===col.k?700:400,cursor:col.k==="name"?undefined:"pointer",whiteSpace:"nowrap"}}
                  onClick={()=>col.k!=="name"&&setSortKey(col.k)}>{col.l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p,i)=>(
              <tr key={p.rank} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:i<3?"rgba(201,168,76,0.04)":"transparent"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
                onMouseLeave={e=>e.currentTarget.style.background=i<3?"rgba(201,168,76,0.04)":"transparent"}>
                <td style={{padding:"9px 8px",fontFamily:"monospace",fontSize:12,color:"#8E9BAF",textAlign:"center"}}>{p.rank}</td>
                <td style={{padding:"9px 8px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <Flag id={p.natId} size={20} style={{borderRadius:2}}/>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:"#F5F0E8"}}>{p.name}</div>
                      <div style={{display:"flex",gap:5,marginTop:2,alignItems:"center"}}>
                        <span style={{fontSize:10,fontFamily:"monospace",padding:"1px 5px",borderRadius:2,background:POS_COLORS[p.pos]+"22",color:POS_COLORS[p.pos],border:`1px solid ${POS_COLORS[p.pos]}44`}}>{p.pos}</span>
                        <span style={{fontSize:11,color:"#8E9BAF"}}>{p.club}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{padding:"9px 8px",textAlign:"center"}}><span style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:p.fantasy>0?"#9b59b6":"#444"}}>{p.fantasy>0?p.fantasy:"—"}</span></td>
                <td style={{padding:"9px 8px",textAlign:"center",fontFamily:"monospace",fontSize:13,color:p.goals>0?"#e74c3c":"#444",fontWeight:p.goals>0?700:400}}>{p.goals>0?p.goals:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",fontFamily:"monospace",fontSize:13,color:p.assists>0?"#2ecc71":"#444",fontWeight:p.assists>0?700:400}}>{p.assists>0?p.assists:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:"#F5F0E8"}}>{p.apps>0?p.apps:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:(p.pos==="DEF"||p.pos==="GK")&&p.cleanSheets>0?"#8bb8f0":"#444"}}>{(p.pos==="DEF"||p.pos==="GK")&&p.cleanSheets>0?p.cleanSheets:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:p.interceptions>0?"#F5F0E8":"#444"}}>{p.interceptions>0?p.interceptions:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:p.pos==="GK"&&p.saves>0?"#C9A84C":"#444"}}>{p.pos==="GK"&&p.saves>0?p.saves:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:p.pos==="GK"&&p.penaltySaves>0?"#C9A84C":"#444"}}>{p.pos==="GK"&&p.penaltySaves>0?p.penaltySaves:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:p.yellowCards>0?"#f39c12":"#444"}}>{p.yellowCards>0?p.yellowCards:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:p.redCards>0?"#e74c3c":"#444"}}>{p.redCards>0?p.redCards:"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── UPDATES ──────────────────────────────────────────────────────────────────
function UpdatesTab({updates,onAdd}){
  const [type,setType]=useState("result");
  const [text,setText]=useState("");
  const [team,setTeam]=useState("");
  return(
    <div>
      <div style={{marginBottom:20,fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase"}}>Intelligence Feed</div>
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:20,marginBottom:28}}>
        <div style={{fontSize:13,color:"#8E9BAF",marginBottom:16}}>Enter any new information and the AI engine will recalculate all probabilities.</div>
        <div style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:12,marginBottom:12}}>
          <div>
            <div style={{fontSize:11,fontFamily:"monospace",color:"#C9A84C",letterSpacing:"0.1em",marginBottom:6}}>TYPE</div>
            <select value={type} onChange={e=>setType(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,padding:"8px 10px",color:"#F5F0E8",fontSize:13,fontFamily:"monospace",cursor:"pointer"}}>
              {UPDATE_TYPES.map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,fontFamily:"monospace",color:"#C9A84C",letterSpacing:"0.1em",marginBottom:6}}>TEAM AFFECTED</div>
            <input value={team} onChange={e=>setTeam(e.target.value)} placeholder="e.g. France…" style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,padding:"8px 10px",color:"#F5F0E8",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontFamily:"monospace",color:"#C9A84C",letterSpacing:"0.1em",marginBottom:6}}>DETAILS</div>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="e.g. France 2-0 Norway. Mbappé scored twice…" rows={4} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,padding:"10px 12px",color:"#F5F0E8",fontSize:14,resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.6,fontFamily:"Georgia,serif"}}/>
        </div>
        <button onClick={()=>{if(!text.trim())return;onAdd({type,team,text,date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})});setText("");setTeam("");}} style={{background:"linear-gradient(135deg,#C9A84C,#E8C97A)",color:"#0A0A0F",border:"none",borderRadius:4,padding:"10px 24px",fontSize:12,fontWeight:700,fontFamily:"monospace",letterSpacing:"0.1em",cursor:"pointer",textTransform:"uppercase"}}>
          + Add to Feed
        </button>
      </div>
      {updates.length===0?(
        <div style={{textAlign:"center",padding:"40px 20px",color:"#8E9BAF",fontSize:14,fontStyle:"italic"}}>No updates logged yet.</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[...updates].reverse().map((u,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"80px 90px 1fr",gap:12,alignItems:"start",padding:"12px 16px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:4,borderLeft:`3px solid ${UPDATE_COLORS[u.type]||"#8E9BAF"}`}}>
              <div style={{fontFamily:"monospace",fontSize:11,color:"#8E9BAF"}}>{u.date}</div>
              <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:UPDATE_COLORS[u.type]||"#8E9BAF",textTransform:"uppercase",background:`${UPDATE_COLORS[u.type]}18`,padding:"2px 6px",borderRadius:2,display:"inline-block",alignSelf:"start"}}>{u.type}</div>
              <div>{u.team&&<span style={{fontSize:12,fontWeight:600,color:"#C9A84C",marginRight:8}}>[{u.team}]</span>}<span style={{fontSize:14,color:"#F5F0E8",lineHeight:1.5}}>{u.text}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── WEIGHTS ──────────────────────────────────────────────────────────────────
function WeightsTab(){
  const cats={team:"Team Collective",manager:"Managerial",player:"Individual",context:"Contextual",luck:"Pure Luck"};
  const catColors={team:"#2ecc71",manager:"#8bb8f0",player:"#C9A84C",context:"#8E9BAF",luck:"#9b59b6"};
  const grouped={};
  FACTOR_WEIGHTS.forEach(f=>{if(!grouped[f.cat])grouped[f.cat]=[];grouped[f.cat].push(f);});
  const catTotals=Object.fromEntries(Object.entries(grouped).map(([k,v])=>[k,v.reduce((s,f)=>s+f.pct,0)]));
  return(
    <div>
      <div style={{marginBottom:20,fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase"}}>Factor Weights</div>
      <div style={{marginBottom:20,padding:16,background:"rgba(46,204,113,0.05)",border:"1px solid rgba(46,204,113,0.2)",borderRadius:4,fontSize:13,color:"#8E9BAF"}}>
        Team: <strong style={{color:"#2ecc71"}}>72%</strong> · Manager: <strong style={{color:"#8bb8f0"}}>11%</strong> · Individual: <strong style={{color:"#C9A84C"}}>6%</strong> · Contextual: <strong style={{color:"#8E9BAF"}}>6%</strong> · Luck: <strong style={{color:"#9b59b6"}}>5%</strong> · <strong style={{color:"#F5F0E8"}}>Total: 100%</strong>
      </div>
      {Object.entries(grouped).map(([cat,factors])=>(
        <div key={cat} style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.2em",color:catColors[cat],textTransform:"uppercase"}}>{cats[cat]}</div>
            <div style={{fontFamily:"monospace",fontSize:16,fontWeight:700,color:catColors[cat]}}>{catTotals[cat]}%</div>
          </div>
          {factors.map((f,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 160px 40px",alignItems:"center",gap:12,marginBottom:8}}>
              <div style={{fontSize:14,color:"#F5F0E8"}}>{f.label}</div>
              <div style={{background:"rgba(255,255,255,0.07)",borderRadius:2,height:6,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${(f.pct/18)*100}%`,background:`linear-gradient(90deg,${f.color},${f.color}88)`,borderRadius:2}}/>
              </div>
              <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:f.color,textAlign:"right"}}>{f.pct}%</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [activeTab,setActiveTab]=useState("Leaderboard");
  const [teams,setTeams]=useState(INITIAL_TEAMS);
  const [players]=useState(INITIAL_PLAYERS);
  const [updates,setUpdates]=useState([]);
  const [loading,setLoading]=useState(false);
  const [aiSummary,setAiSummary]=useState("Pre-tournament baseline · France 18%, Argentina 15%, Spain 14% lead. Tournament opens June 11.");
  const [biggestMover,setBiggestMover]=useState(null);
  const [lastRefresh,setLastRefresh]=useState(null);
  const [error,setError]=useState(null);

  // ── SIDE PANEL STATE ────────────────────────────────────────────────────────
  const [matches,setMatches]=useState([]);
  const [matchesLoading,setMatchesLoading]=useState(false);
  const [matchesError,setMatchesError]=useState(null);

  const addUpdate=useCallback(u=>setUpdates(p=>[...p,u]),[]);

  // ── FETCH MATCHES FROM RENDER BACKEND ───────────────────────────────────────
  const fetchMatches = useCallback(async()=>{
    setMatchesLoading(true);
    setMatchesError(null);
    try{
      const res = await fetch(`${BACKEND_URL}/matches`);
      if(!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      // Sort newest first
      const sorted = (data||[]).sort((a,b)=>
        new Date(b.fixture?.date||0) - new Date(a.fixture?.date||0)
      );
      setMatches(sorted);
    }catch(e){
      setMatchesError("Could not reach server. Check Render is running.");
      console.error(e);
    }
    setMatchesLoading(false);
  },[]);

  // ── POLL FOR UPDATES ─────────────────────────────────────────────────────────
  useEffect(()=>{
    // Initial fetch
    fetchMatches();

    // Check for new match results every 5 minutes
    const matchTimer = setInterval(fetchMatches, 5 * 60 * 1000);

    // Auto-pull completed match results into Updates feed every 5 min
    const updateTimer = setInterval(async()=>{
      try{
        const res = await fetch(`${BACKEND_URL}/updates`);
        if(!res.ok) return;
        const newUpdates = await res.json();
        if(newUpdates.length > 0){
          newUpdates.forEach(u => addUpdate(u));
        }
      }catch(e){ /* silent — server may be sleeping */ }
    }, 5 * 60 * 1000);

    return ()=>{ clearInterval(matchTimer); clearInterval(updateTimer); };
  },[fetchMatches, addUpdate]);

  const runAnalysis=async()=>{
    setLoading(true);setError(null);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:buildSystemPrompt(teams,updates),messages:[{role:"user",content:"Recalculate. Return only JSON."}]})});
      const data=await res.json();
      const raw=data.content?.find(c=>c.type==="text")?.text||"";
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setTeams(p=>p.map(t=>{const u=parsed.teams?.find(x=>x.id===t.id);return u?{...t,prob:u.prob,change:u.change||0}:t;}));
      if(parsed.summary)setAiSummary(parsed.summary);
      if(parsed.biggestMover)setBiggestMover(parsed.biggestMover);
      setLastRefresh(new Date().toLocaleTimeString());
    }catch(e){setError("Analysis failed. Try again.");console.error(e);}
    setLoading(false);
  };

  const top3=[...teams].sort((a,b)=>b.prob-a.prob).slice(0,3);

  return(
    <div style={{minHeight:"100vh",background:"#0A0A0F",color:"#F5F0E8",fontFamily:"Georgia,serif",fontSize:16,display:"flex",flexDirection:"column"}}>

      {/* STICKY HEADER */}
      <div style={{background:"#14141C",borderBottom:"1px solid rgba(201,168,76,0.25)",padding:"20px 24px 0",position:"sticky",top:0,zIndex:200,boxShadow:"0 4px 24px rgba(0,0,0,0.4)",flexShrink:0}}>
        <div style={{maxWidth:"100%"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:16}}>
            <div>
              <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.3em",color:"#C9A84C",textTransform:"uppercase",marginBottom:4}}>Live Prediction Engine · FIFA Men's World Cup</div>
              <div style={{display:"flex",alignItems:"baseline",gap:10}}>
                <span style={{fontFamily:"Impact,sans-serif",fontSize:32,letterSpacing:"0.05em",color:"#F5F0E8",lineHeight:1}}>WORLD CUP</span>
                <span style={{fontFamily:"Impact,sans-serif",fontSize:32,letterSpacing:"0.05em",color:"#C9A84C",lineHeight:1}}>2026</span>
                <span style={{fontFamily:"monospace",fontSize:11,color:"#8E9BAF",marginLeft:8}}>USA · CAN · MEX</span>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              {top3.map(t=>(
                <div key={t.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:4,padding:"6px 12px",textAlign:"center",minWidth:90,display:"flex",alignItems:"center",gap:8}}>
                  <Flag id={t.id} size={24} style={{borderRadius:3}}/>
                  <div>
                    <div style={{fontFamily:"monospace",fontSize:14,fontWeight:700,color:probColor(t.prob)}}>{t.prob.toFixed(1)}%</div>
                    <div style={{fontSize:11,color:"#8E9BAF"}}>{t.name}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
              <button onClick={runAnalysis} disabled={loading} style={{background:loading?"rgba(201,168,76,0.3)":"linear-gradient(135deg,#C9A84C,#E8C97A)",color:"#0A0A0F",border:"none",borderRadius:4,padding:"10px 20px",fontSize:12,fontWeight:700,fontFamily:"monospace",letterSpacing:"0.12em",cursor:loading?"not-allowed":"pointer",textTransform:"uppercase",display:"flex",alignItems:"center",gap:8}}>
                {loading?<><span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span>Analysing…</>:"⟳ Re-analyse Now"}
              </button>
              {lastRefresh&&<div style={{fontSize:11,fontFamily:"monospace",color:"#8E9BAF"}}>Last: {lastRefresh}</div>}
              {updates.length>0&&<div style={{fontSize:11,fontFamily:"monospace",color:"#C9A84C"}}>{updates.length} update{updates.length!==1?"s":""} queued</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:0,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
            {tabs.map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{background:"transparent",border:"none",borderBottom:activeTab===tab?"2px solid #C9A84C":"2px solid transparent",color:activeTab===tab?"#C9A84C":"#8E9BAF",fontFamily:"monospace",fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",padding:"10px 14px",cursor:"pointer",transition:"all 0.15s",marginBottom:-1}}>
                {tab}{tab==="Updates"&&updates.length>0&&<span style={{marginLeft:6,background:"#C9A84C",color:"#0A0A0F",borderRadius:10,padding:"1px 5px",fontSize:9,fontWeight:700}}>{updates.length}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI SUMMARY BANNER */}
      <div style={{background:"rgba(201,168,76,0.06)",borderBottom:"1px solid rgba(201,168,76,0.15)",padding:"10px 24px",flexShrink:0}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <span style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:"#C9A84C",flexShrink:0,marginTop:3}}>AI ANALYSIS</span>
          <span style={{fontSize:14,color:"#8E9BAF",lineHeight:1.6}}>{aiSummary}</span>
        </div>
        {biggestMover&&<div style={{marginTop:"4px",display:"flex",gap:12}}><span style={{fontFamily:"monospace",fontSize:10,color:"#2ecc71",flexShrink:0}}>BIGGEST MOVER</span><span style={{fontSize:13,color:"#2ecc71"}}>{biggestMover}</span></div>}
        {error&&<div style={{marginTop:"4px",display:"flex",gap:12}}><span style={{fontFamily:"monospace",fontSize:10,color:"#e74c3c",flexShrink:0}}>ERROR</span><span style={{fontSize:13,color:"#e74c3c"}}>{error}</span></div>}
      </div>

      {/* BODY — main content + side panel */}
      <div style={{display:"flex",flex:1,overflow:"hidden",minHeight:0}}>

        {/* MAIN SCROLLABLE CONTENT */}
        <div style={{flex:1,overflowY:"auto",padding:"32px 24px"}}>
          {activeTab==="Leaderboard"&&<LeaderboardTab teams={teams}/>}
          {activeTab==="Groups"&&<GroupsTab groups={INITIAL_GROUPS}/>}
          {activeTab==="Bracket"&&<BracketTab bracket={PREDICTED_KNOCKOUT}/>}
          {activeTab==="Players"&&<PlayersTab players={players}/>}
          {activeTab==="Updates"&&<UpdatesTab updates={updates} onAdd={addUpdate}/>}
          {activeTab==="Weights"&&<WeightsTab/>}
          <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"20px 0",textAlign:"center",fontFamily:"monospace",fontSize:11,color:"rgba(255,255,255,0.2)",letterSpacing:"0.1em",marginTop:40}}>
            FIFA WORLD CUP 2026 · LIVE PREDICTION ENGINE · 16-FACTOR MODEL · POWERED BY CLAUDE
          </div>
        </div>

        {/* SIDE PANEL — always visible */}
        <SidePanel
          matches={matches}
          loading={matchesLoading}
          error={matchesError}
          onRefresh={fetchMatches}
        />
      </div>

      <style>{`
        *{box-sizing:border-box;}
        @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:#0A0A0F;}
        ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.3);border-radius:3px;}
        select option{background:#14141C;color:#F5F0E8;}
        textarea::placeholder,input::placeholder{color:rgba(255,255,255,0.25);}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.5);}
      `}</style>
    </div>
  );
}
