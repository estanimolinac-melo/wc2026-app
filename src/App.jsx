import { useState, useCallback, useEffect, useRef } from "react";
import { Flag, INITIAL_TEAMS, INITIAL_PLAYERS, INFLUENTIAL_NON_TOP50, FACTOR_WEIGHTS, MATCH_FACTORS, PREDICTED_KNOCKOUT, INITIAL_GROUPS, GROUP_MATCH_PREDICTIONS, PREDICTED_GROUP_STANDINGS } from "./data.jsx";

// ── INTERNATIONAL LEAGUE IDs (api-football) ──────────────────────────────────
// Only these leagues are shown in the side panel
export const INTERNATIONAL_LEAGUE_IDS = new Set([
  1,    // World Cup
  9,    // International Friendlies (men)
  8,    // UEFA Nations League
  274,  // CONCACAF Nations League
  7,    // Copa América
  6,    // AFCON (Africa Cup of Nations)
  10,   // FIFA World Cup Qualification (UEFA)
  29,   // AFC Asian Cup
  30,   // AFC Asian Cup Qualification
  32,   // CONMEBOL World Cup Qualification
  34,   // CONCACAF World Cup Qualification
  36,   // CAF World Cup Qualification
  44,   // AFC World Cup Qualification
  142,  // UEFA Nations League B
  143,  // UEFA Nations League C
  144,  // UEFA Nations League D
  848,  // UEFA Nations League (League Phase)
  954,  // CONCACAF Gold Cup
  480,  // Arab Cup
]);

// ── BACKEND URL ───────────────────────────────────────────────────────────────
const BACKEND_URL = "https://wc2026-fetcher.onrender.com";

// ── SHARED ────────────────────────────────────────────────────────────────────
const probColor = p => p>=14?"#C9A84C":p>=8?"#8bb8f0":p>=4?"#2ecc71":"#8E9BAF";
const POS_COLORS = { FWD:"#e74c3c", MID:"#2ecc71", DEF:"#8bb8f0", GK:"#C9A84C" };

// Tab config — prediction tabs vs stats tabs
const PRED_TABS = ["Overview","Predictions"];
const STATS_TABS = ["Groups","Players","Analysis","Weights"];
const ALL_TABS = [...PRED_TABS, ...STATS_TABS];

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
  "FT":"#2ecc71","NS":"#8E9BAF","1H":"#e74c3c","2H":"#e74c3c",
  "HT":"#f39c12","ET":"#e74c3c","P":"#9b59b6","AET":"#2ecc71",
  "PEN":"#2ecc71","CANC":"#e74c3c","PST":"#e74c3c",
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

  const events = match.events||[];
  const goals   = events.filter(e=>e.type==="Goal");
  const cards   = events.filter(e=>e.type==="Card");
  const subs    = events.filter(e=>e.type==="subst");

  const homeId = home?.id;
  const awayId = away?.id;

  // Determine if an event belongs to home or away
  const isHomeEvent = e => e.team?.id === homeId;

  const dateStr = match.fixture?.date
    ? new Date(match.fixture.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})
    : "";
  const statusLabel = isLive ? `${elapsed}'` : status;

  // Render a single event row, aligned left (home) or right (away)
  function EventRow({e, icon, label, color}){
    const home_ = isHomeEvent(e);
    return(
      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,marginBottom:3,flexDirection:home_?"row":"row-reverse"}}>
        <span style={{fontSize:13,flexShrink:0}}>{icon}</span>
        <span style={{fontFamily:"monospace",color:"#8E9BAF",flexShrink:0}}>{e.time?.elapsed}{e.time?.extra?`+${e.time.extra}`:""}'</span>
        <span style={{fontWeight:600,color:color||"#F5F0E8",textAlign:home_?"left":"right"}}>{label}</span>
      </div>
    );
  }

  const hasDetail = goals.length>0||cards.length>0||subs.length>0;

  return(
    <div style={{
      background:"rgba(255,255,255,0.03)",
      border:`1px solid ${isLive?"rgba(231,76,60,0.4)":isFinished?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.05)"}`,
      borderRadius:4,marginBottom:6,overflow:"hidden",cursor:"pointer",
      boxShadow:isLive?"0 0 8px rgba(231,76,60,0.15)":"none"
    }} onClick={()=>setExpanded(!expanded)}>
      {/* Match header */}
      <div style={{padding:"8px 10px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:10,fontFamily:"monospace",color:"#8E9BAF"}}>{dateStr}</span>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            {isLive&&<span style={{width:6,height:6,borderRadius:"50%",background:"#e74c3c",display:"inline-block",animation:"pulse 1.5s infinite"}}/>}
            <span style={{fontSize:10,fontFamily:"monospace",fontWeight:700,
              color:STATUS_COLORS[status]||"#8E9BAF",
              background:`${STATUS_COLORS[status]||"#8E9BAF"}18`,
              padding:"1px 6px",borderRadius:2}}>{statusLabel}</span>
          </div>
        </div>
        {/* Score row */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 36px 1fr",alignItems:"center",gap:4}}>
          <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}>
            <span style={{fontSize:12,fontWeight:home?.winner?700:400,color:home?.winner?"#F5F0E8":"rgba(255,255,255,0.7)",textAlign:"right"}}>{home?.name||"TBD"}</span>
            {home?.logo&&<img src={home.logo} alt="" style={{width:16,height:16,objectFit:"contain",flexShrink:0}}/>}
          </div>
          <div style={{textAlign:"center",fontFamily:"monospace",fontSize:14,fontWeight:700,color:isUpcoming?"#8E9BAF":"#F5F0E8"}}>
            {isUpcoming?(match.fixture?.date?new Date(match.fixture.date).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}):"—"):`${hGoals}–${aGoals}`}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {away?.logo&&<img src={away.logo} alt="" style={{width:16,height:16,objectFit:"contain",flexShrink:0}}/>}
            <span style={{fontSize:12,fontWeight:away?.winner?700:400,color:away?.winner?"#F5F0E8":"rgba(255,255,255,0.7)"}}>{away?.name||"TBD"}</span>
          </div>
        </div>
        {match.league?.name&&(
          <div style={{textAlign:"center",fontSize:10,color:"#8E9BAF",marginTop:4,fontStyle:"italic"}}>{match.league.name}</div>
        )}
      </div>

      {/* Expanded detail — aligned by team */}
      {expanded&&hasDetail&&(
        <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"8px 10px",background:"rgba(0,0,0,0.2)"}}>
          {/* Column headers */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
            <div style={{fontSize:9,fontFamily:"monospace",color:"#C9A84C",letterSpacing:"0.1em"}}>{home?.name?.toUpperCase()}</div>
            <div style={{fontSize:9,fontFamily:"monospace",color:"#C9A84C",letterSpacing:"0.1em",textAlign:"right"}}>{away?.name?.toUpperCase()}</div>
          </div>

          {/* Goals */}
          {goals.length>0&&goals.map((e,i)=>{
            const isOwnGoal = e.detail==="Own Goal";
            const homeEv = isHomeEvent(e);
            const goalIcon = isOwnGoal
              ? <span style={{fontSize:13,filter:"hue-rotate(120deg)",display:"inline-block"}}>🔴</span>
              : <span style={{fontSize:13}}>⚽</span>;
            const assistText = e.assist?.name ? ` (${e.assist.name})` : "";
            const label = isOwnGoal
              ? `${e.player?.name} OG${assistText}`
              : `${e.player?.name}${assistText}`;
            return <EventRow key={`g${i}`} e={e} icon={goalIcon} label={label} color={isOwnGoal?"#e74c3c":"#F5F0E8"}/>;
          })}

          {/* Cards */}
          {cards.length>0&&cards.map((e,i)=>{
            const isRed = e.detail==="Red Card"||e.detail==="Second Yellow card";
            return <EventRow key={`c${i}`} e={e} icon={isRed?"🟥":"🟨"} label={e.player?.name} color={isRed?"#e74c3c":"#f39c12"}/>;
          })}

          {/* Substitutions */}
          {subs.length>0&&(
            <div style={{borderTop:"1px solid rgba(255,255,255,0.04)",marginTop:5,paddingTop:5}}>
              {subs.map((e,i)=>{
                // In api-football substitution events: player = coming OFF, assist = coming ON
                const off = e.player?.name || "?";
                const on  = e.assist?.name  || "?";
                return <EventRow key={`s${i}`} e={e} icon="🔄" label={`${on} ↑  ${off} ↓`} color="rgba(255,255,255,0.55)"/>;
              })}
            </div>
          )}
        </div>
      )}
      {!expanded&&(isFinished||isLive)&&hasDetail&&(
        <div style={{textAlign:"center",padding:"2px",fontSize:10,color:"rgba(255,255,255,0.2)"}}>▼ details</div>
      )}
    </div>
  );
}

function SidePanel({ matches, loading, error, onRefresh }){
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const scrollRef = useRef(null);

  // Filter to international matches only (by league ID)
  const intlMatches = matches.filter(m => INTERNATIONAL_LEAGUE_IDS.has(m.league?.id));

  const filtered = intlMatches.filter(m=>{
    const dateOk = !filterDate||(m.fixture?.date||"").startsWith(filterDate);
    const statusOk = filterStatus==="ALL"||
      (filterStatus==="LIVE"&&["1H","2H","HT","ET","P"].includes(m.fixture?.status?.short))||
      (filterStatus==="FT"&&["FT","AET","PEN"].includes(m.fixture?.status?.short))||
      (filterStatus==="NS"&&m.fixture?.status?.short==="NS");
    return dateOk&&statusOk;
  });

  const liveCount = intlMatches.filter(m=>["1H","2H","HT","ET","P"].includes(m.fixture?.status?.short)).length;

  return(
    <div style={{
      width:288,flexShrink:0,
      background:"#0A0E1A",
      borderLeft:"1px solid rgba(255,255,255,0.07)",
      display:"flex",flexDirection:"column",
      height:"100vh",position:"sticky",top:0,overflow:"hidden"
    }}>
      {/* Panel header */}
      <div style={{padding:"14px 12px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)",flexShrink:0,background:"rgba(255,255,255,0.02)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div>
            <div style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.2em",color:"#8bb8f0",textTransform:"uppercase",marginBottom:2}}>Live Match Feed</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>International · WC nations · May 16+</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {liveCount>0&&(
              <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(231,76,60,0.15)",border:"1px solid rgba(231,76,60,0.3)",borderRadius:3,padding:"2px 7px"}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:"#e74c3c",display:"inline-block",animation:"pulse 1.5s infinite"}}/>
                <span style={{fontFamily:"monospace",fontSize:10,color:"#e74c3c",fontWeight:700}}>{liveCount} LIVE</span>
              </div>
            )}
            <button onClick={onRefresh} disabled={loading} style={{background:"rgba(139,184,240,0.1)",border:"1px solid rgba(139,184,240,0.25)",borderRadius:3,padding:"4px 8px",color:"#8bb8f0",fontSize:12,cursor:loading?"not-allowed":"pointer",opacity:loading?0.5:1}}>⟳</button>
          </div>
        </div>
        <div style={{display:"flex",gap:4,marginBottom:6}}>
          {["ALL","LIVE","FT","NS"].map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)} style={{
              flex:1,background:filterStatus===s?"rgba(139,184,240,0.18)":"rgba(255,255,255,0.04)",
              border:`1px solid ${filterStatus===s?"rgba(139,184,240,0.5)":"rgba(255,255,255,0.07)"}`,
              borderRadius:3,padding:"3px 0",fontSize:10,fontFamily:"monospace",
              color:filterStatus===s?"#8bb8f0":"#8E9BAF",cursor:"pointer",letterSpacing:"0.05em"
            }}>{s}</button>
          ))}
        </div>
        <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)}
          style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:3,padding:"5px 8px",color:"#F5F0E8",fontSize:11,fontFamily:"monospace",outline:"none",boxSizing:"border-box",colorScheme:"dark"}}/>
      </div>

      {/* Match list */}
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
        {error&&<div style={{padding:"12px",background:"rgba(231,76,60,0.1)",border:"1px solid rgba(231,76,60,0.3)",borderRadius:4,fontSize:12,color:"#e74c3c",marginBottom:8}}>{error}</div>}
        {loading&&filtered.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"#8E9BAF",fontSize:12}}>Loading matches…</div>}
        {!loading&&filtered.length===0&&intlMatches.length>0&&<div style={{textAlign:"center",padding:"30px 0",color:"#8E9BAF",fontSize:12,fontStyle:"italic"}}>No matches for this filter.</div>}
        {!loading&&intlMatches.length===0&&!error&&<div style={{textAlign:"center",padding:"30px 0",color:"#8E9BAF",fontSize:12,fontStyle:"italic"}}>Backend connected — awaiting international fixtures. Tournament opens June 11.</div>}
        {filtered.map((m,i)=><MatchCard key={m.fixture?.id||i} match={m}/>)}
      </div>

      <div style={{padding:"6px 10px",borderTop:"1px solid rgba(255,255,255,0.04)",flexShrink:0,fontSize:10,fontFamily:"monospace",color:"#8E9BAF",textAlign:"center"}}>
        {filtered.length} match{filtered.length!==1?"es":""} · international only
      </div>
    </div>
  );
}

// ── OVERVIEW (was Leaderboard) ────────────────────────────────────────────────
function OverviewTab({teams}){
  const [expanded,setExpanded]=useState(null);
  const sorted=[...teams].sort((a,b)=>b.prob-a.prob);
  const max=sorted[0]?.prob||1;

  return(
    <div>
      {/* Championship Probability */}
      <div style={{marginBottom:28}}>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase",marginBottom:6}}>Championship Probability Leaderboard</div>
        <div style={{fontSize:13,color:"#8E9BAF",marginBottom:16,maxWidth:600}}>Live championship win probabilities. Click any team to expand rationale.</div>
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

      {/* Predicted Group Standings */}
      <div>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase",marginBottom:6}}>Predicted Group Stage Standings</div>
        <div style={{fontSize:13,color:"#8E9BAF",marginBottom:16,maxWidth:600}}>Projected final standings based on individual match predictions. Top 2 from each group qualify directly; best third-place teams also advance.</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
          {Object.entries(PREDICTED_GROUP_STANDINGS).map(([grp,teams_])=>(
            <div key={grp} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:5,overflow:"hidden"}}>
              <div style={{background:"rgba(201,168,76,0.08)",borderBottom:"1px solid rgba(201,168,76,0.15)",padding:"5px 12px"}}>
                <span style={{fontFamily:"Impact,sans-serif",fontSize:18,color:"#C9A84C"}}>GROUP {grp}</span>
              </div>
              {teams_.map((name,pos)=>(
                <div key={name} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:pos===0?"rgba(26,94,58,0.12)":pos===1?"rgba(26,58,107,0.08)":"transparent",borderBottom:pos<3?"1px solid rgba(255,255,255,0.04)":"none"}}>
                  <span style={{fontFamily:"monospace",fontSize:10,color:pos<2?"#C9A84C":"#8E9BAF",width:14,textAlign:"center",flexShrink:0}}>{pos+1}</span>
                  {pos<2&&<span style={{fontSize:9,fontFamily:"monospace",color:pos===0?"#C9A84C":"#8bb8f0",background:pos===0?"rgba(201,168,76,0.12)":"rgba(139,184,240,0.12)",padding:"1px 4px",borderRadius:2,flexShrink:0}}>ADV</span>}
                  <span style={{fontSize:12,color:pos<2?"#F5F0E8":"rgba(255,255,255,0.45)",fontWeight:pos<2?600:400}}>{name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PREDICTIONS TAB (Group matches + Bracket) ─────────────────────────────────
function GroupMatchCard({match, groupName}){
  const [open,setOpen]=useState(false);
  const totalProb = (match.a.prob||0)+(match.b.prob||0)+(match.draw||0);
  return(
    <div style={{background:"#14141C",border:`1px solid ${open?"rgba(201,168,76,0.5)":"rgba(255,255,255,0.09)"}`,borderRadius:4,overflow:"hidden",cursor:"pointer"}}
      onClick={()=>setOpen(!open)}>
      {/* Compact header */}
      <div style={{padding:"8px 12px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:10,fontFamily:"monospace",color:"#8E9BAF"}}>{match.date} · Group {groupName}</span>
          <span style={{fontSize:10,fontFamily:"monospace",color:"#8E9BAF"}}>{open?"▲":"▼"}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 80px 1fr",alignItems:"center",gap:8}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#F5F0E8"}}>{match.a.name}</div>
            <div style={{fontSize:14,fontWeight:700,color:"#C9A84C",fontFamily:"monospace"}}>{match.a.prob}%</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:10,fontFamily:"monospace",color:"#8E9BAF",marginBottom:2}}>DRAW</div>
            <div style={{fontSize:12,fontWeight:600,color:"#8E9BAF",fontFamily:"monospace"}}>{match.draw}%</div>
          </div>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#F5F0E8"}}>{match.b.name}</div>
            <div style={{fontSize:14,fontWeight:700,color:"#8bb8f0",fontFamily:"monospace"}}>{match.b.prob}%</div>
          </div>
        </div>
        {/* Probability bar */}
        <div style={{display:"flex",height:4,borderRadius:2,overflow:"hidden",marginTop:6,gap:1}}>
          <div style={{flex:match.a.prob,background:"#C9A84C"}}/>
          <div style={{flex:match.draw,background:"rgba(142,155,175,0.4)"}}/>
          <div style={{flex:match.b.prob,background:"#8bb8f0"}}/>
        </div>
      </div>

      {open&&(
        <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"12px",background:"rgba(0,0,0,0.25)"}}>
          {/* Lineups */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
            <div>
              <div style={{fontSize:9,fontFamily:"monospace",color:"#C9A84C",letterSpacing:"0.12em",marginBottom:4}}>PREDICTED XI — {match.a.name.toUpperCase()}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>{match.lineup_a}</div>
            </div>
            <div>
              <div style={{fontSize:9,fontFamily:"monospace",color:"#8bb8f0",letterSpacing:"0.12em",marginBottom:4}}>PREDICTED XI — {match.b.name.toUpperCase()}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>{match.lineup_b}</div>
            </div>
          </div>
          {/* Key subs */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
            <div style={{padding:"6px 10px",background:"rgba(243,156,18,0.06)",border:"1px solid rgba(243,156,18,0.15)",borderRadius:3}}>
              <div style={{fontSize:9,fontFamily:"monospace",color:"#f39c12",marginBottom:3}}>KEY SUBS — {match.a.name.toUpperCase()}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>{match.key_subs_a}</div>
            </div>
            <div style={{padding:"6px 10px",background:"rgba(243,156,18,0.06)",border:"1px solid rgba(243,156,18,0.15)",borderRadius:3}}>
              <div style={{fontSize:9,fontFamily:"monospace",color:"#f39c12",marginBottom:3}}>KEY SUBS — {match.b.name.toUpperCase()}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>{match.key_subs_b}</div>
            </div>
          </div>
          {/* Morale */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
            <div style={{padding:"6px 10px",background:"rgba(155,89,182,0.06)",border:"1px solid rgba(155,89,182,0.15)",borderRadius:3}}>
              <div style={{fontSize:9,fontFamily:"monospace",color:"#9b59b6",marginBottom:3}}>MORALE — {match.a.name.toUpperCase()}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>{match.morale_a}</div>
            </div>
            <div style={{padding:"6px 10px",background:"rgba(155,89,182,0.06)",border:"1px solid rgba(155,89,182,0.15)",borderRadius:3}}>
              <div style={{fontSize:9,fontFamily:"monospace",color:"#9b59b6",marginBottom:3}}>MORALE — {match.b.name.toUpperCase()}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>{match.morale_b}</div>
            </div>
          </div>
          {/* Team strengths + verdict */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><div style={{fontSize:9,fontFamily:"monospace",color:"#2ecc71",marginBottom:3}}>{match.a.name.toUpperCase()} STRENGTHS</div><div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.4}}>{match.aS}</div></div>
            <div><div style={{fontSize:9,fontFamily:"monospace",color:"#e74c3c",marginBottom:3}}>{match.b.name.toUpperCase()} STRENGTHS</div><div style={{fontSize:11,color:"rgba(255,255,255,0.6)",lineHeight:1.4}}>{match.bS}</div></div>
          </div>
          <div style={{padding:"8px 12px",background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:3,fontSize:11,color:"rgba(255,255,255,0.75)",lineHeight:1.5}}>
            <span style={{color:"#C9A84C",fontFamily:"monospace",fontSize:9,letterSpacing:"0.1em"}}>VERDICT: </span>{match.rat}
          </div>
        </div>
      )}
    </div>
  );
}

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

function PredictionsTab({bracket}){
  const [section, setSection] = useState("group");
  const [activeGroup, setActiveGroup] = useState("A");
  const groups = Object.keys(GROUP_MATCH_PREDICTIONS);

  return(
    <div>
      {/* Sub-navigation */}
      <div style={{display:"flex",gap:8,marginBottom:20,borderBottom:"1px solid rgba(255,255,255,0.07)",paddingBottom:12}}>
        {[["group","Group Stage Matches"],["knockout","Knockout Bracket"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSection(k)} style={{
            background:section===k?"rgba(201,168,76,0.15)":"rgba(255,255,255,0.04)",
            border:`1px solid ${section===k?"rgba(201,168,76,0.5)":"rgba(255,255,255,0.1)"}`,
            borderRadius:3,padding:"6px 16px",fontSize:11,fontFamily:"monospace",letterSpacing:"0.1em",
            color:section===k?"#C9A84C":"#8E9BAF",cursor:"pointer",textTransform:"uppercase"
          }}>{l}</button>
        ))}
      </div>

      {section==="group"&&(
        <div>
          <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.2em",color:"#C9A84C",textTransform:"uppercase",marginBottom:6}}>Group Stage — All 72 Matches Predicted</div>
          <div style={{fontSize:13,color:"#8E9BAF",marginBottom:16,maxWidth:700}}>Each match includes predicted lineups, key substitutions, team morale, and an analytical verdict. Win probabilities update automatically when confirmed lineups are available.</div>

          {/* Group selector */}
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:16}}>
            {groups.map(g=>(
              <button key={g} onClick={()=>setActiveGroup(g)} style={{
                background:activeGroup===g?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",
                border:`1px solid ${activeGroup===g?"rgba(201,168,76,0.5)":"rgba(255,255,255,0.08)"}`,
                borderRadius:3,padding:"4px 12px",fontSize:11,fontFamily:"monospace",
                color:activeGroup===g?"#C9A84C":"#8E9BAF",cursor:"pointer"
              }}>Group {g}</button>
            ))}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {(GROUP_MATCH_PREDICTIONS[activeGroup]||[]).map((match,i)=>(
              <GroupMatchCard key={i} match={match} groupName={activeGroup}/>
            ))}
          </div>
        </div>
      )}

      {section==="knockout"&&(
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
      )}
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
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase",marginBottom:8}}>Top 50 World Cup 2026 Players</div>
        <div style={{padding:"12px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:4,fontSize:13,color:"#8E9BAF",lineHeight:1.6,maxWidth:760}}>
          The <strong style={{color:"#F5F0E8"}}>top 50 players at the 2026 World Cup</strong>, ranked by in-tournament statistics as the competition progresses. Pre-tournament order based on expert ranking. <em>Statistics update as the tournament progresses from June 11.</em>
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

      {/* Influential players not in top 50 */}
      <div style={{marginTop:40}}>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase",marginBottom:6}}>Beyond the Top 50 — Key Influencers</div>
        <div style={{fontSize:13,color:"#8E9BAF",marginBottom:20,maxWidth:700}}>Players outside the top 50 ranking who hold disproportionate tactical and structural importance for their teams — the hidden pillars of their national sides' tournament aspirations.</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
          {INFLUENTIAL_NON_TOP50.map((p,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:5,padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <Flag id={p.natId} size={22} style={{borderRadius:2}}/>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:"#F5F0E8"}}>{p.name}</div>
                  <div style={{display:"flex",gap:6,marginTop:2,alignItems:"center"}}>
                    <span style={{fontSize:10,fontFamily:"monospace",padding:"1px 5px",borderRadius:2,background:POS_COLORS[p.pos]+"22",color:POS_COLORS[p.pos],border:`1px solid ${POS_COLORS[p.pos]}44`}}>{p.pos}</span>
                    <span style={{fontSize:11,color:"#8E9BAF"}}>{p.club}</span>
                    <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{p.nation}</span>
                  </div>
                </div>
              </div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.65)",lineHeight:1.65}}>{p.insight}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ANALYSIS TAB ─────────────────────────────────────────────────────────────
// AI-powered tactical reports — pre-seeded with pre-tournament analysis
const ANALYSIS_REPORTS = [
  {
    id:"fra-attack",
    team:"France",
    teamId:"FRA",
    badge:"TACTICAL ANALYSIS",
    badgeColor:"#C9A84C",
    title:"The Most Dangerous Attack at the Tournament",
    subtitle:"How France's four-man attacking rotation rewrites the playbook",
    date:"Jun 9, 2026",
    body:`France's attacking structure under Deschamps has reached a new level of sophistication. With Dembélé (Ballon d'Or 2025), Olise, Mbappé, and Doué all capable of occupying any of the three front positions, Deschamps has a rotation problem no opponent can solve: no matter which three he picks, the bench contains the fourth — a player who would start for almost any other nation.

The tactical key is Olise's role. Nominally a right winger, Olise consistently drifts infield onto his stronger left foot, creating a false-wide structure that pulls opposition left-backs out of position. When Olise cuts inside, Mbappé's movement pins the left-back deep, Dembélé's width stretches the right-back, and Doué's central penetration runs exploit the gap Olise vacates.

Griezmann's declining physical pace is masked by positioning: he occupies the half-spaces between lines that French wingers can find in one-touch combinations, acting as the creative relay between midfield and attack. The system's intelligence — rather than its pace — is what makes it the most difficult structure to defend at this tournament.`,
    insight:"The French system's strength is not who starts, but that no lineup change reduces the quality by more than a marginal amount.",
    heatNote:"Olise's heat map shows a distinctive diagonal channel from right to central — mirrored by Mbappé moving left-to-right across the same space.",
  },
  {
    id:"esp-possession",
    team:"Spain",
    teamId:"ESP",
    badge:"TACTICAL ANALYSIS",
    badgeColor:"#C9A84C",
    title:"Spain's Positional Play — The Tournament Standard",
    subtitle:"Why no other team can replicate what Rodri and Pedri do together",
    date:"Jun 9, 2026",
    body:`Spain's possession system under De la Fuente has become the most technically complete pressing-and-building structure in world football. The Rodri-Pedri pivot is the engine: Rodri's 91% pass completion rate under pressure and Pedri's 12.3 progressive carries per 90 minutes at Barcelona place them as the only midfield pairing capable of both suppressing counter-press and initiating attacks simultaneously.

What distinguishes Spain from possession teams of previous generations is the verticality built into the system. Under previous Spain managers, possession was often lateral and predictable. De la Fuente has inserted triggers — specific body positions and run timings from Yamal and Olmo — that convert holding patterns into penetrative sequences in 2-3 touches.

Oyarzabal's movement is Spain's most underappreciated tactical element. His diagonal runs from the left into the box exploit the space Pedri creates by drawing the opposition double-press. In every final Oyarzabal has played — for club and country — he has scored. The psychological and technical consistency of that record is extraordinary.`,
    insight:"Spain's pressing trap is triggered when Pedri receives in front of the opposition midfield — at that moment, three Spain players simultaneously make runs that require the opponent to make 2 defensive decisions at once.",
    heatNote:"Pedri's central zone coverage is the widest of any midfielder at the tournament — he operates across a 30-metre horizontal corridor.",
  },
  {
    id:"mar-defense",
    team:"Morocco",
    teamId:"MAR",
    badge:"TACTICAL ANALYSIS",
    badgeColor:"#2ecc71",
    title:"Morocco's Defensive Fortress — 21 Unbeaten",
    subtitle:"Regragui's 5-4-1 block and why it beats systems, not just teams",
    date:"Jun 9, 2026",
    body:`Morocco's 21-match unbeaten run is not an accident. Regragui has constructed the most coherent defensive system at the 2026 World Cup — one that neutralised Cristiano Ronaldo in Qatar 2022 and has since added the attacking depth to make it a genuine outright threat.

The defensive foundation is a fluid 5-4-1 that collapses to a 5-4-1 without the ball. Amrabat's positioning between the lines is the system's key mechanism: when the opposition attack builds through the middle, Amrabat's press triggers a coordinated shift from the four behind him, forcing the ball wide where Hakimi or Mazraoui — elite attacking full-backs — are disciplined enough to defend first.

The 21-match unbeaten run includes results against Portugal (a 2022 World Cup semi-final), Belgium, and Spain in friendly competition. Against each, Morocco's ability to absorb pressure and then transition through En-Nesyri's direct running proved decisive.

The tournament question for Morocco is not defensive quality — it's whether Ziyech, Khannouss, and Saibari can produce enough in attack to win knockout matches against top-8 opposition.`,
    insight:"Morocco concede on average 0.4 goals per match in their last 21 unbeaten — the lowest rate of any team at the tournament.",
    heatNote:"Amrabat's interception heat map clusters in a central corridor between 20-40 metres from goal — precisely the zone opposing teams use to build before penetrating.",
  },
  {
    id:"arg-chemistry",
    team:"Argentina",
    teamId:"ARG",
    badge:"TEAM PROFILE",
    badgeColor:"#8bb8f0",
    title:"Argentina's 9.2 Chemistry — The System That Won the World Cup",
    subtitle:"Seven years of Scaloni building the most cohesive squad at the tournament",
    date:"Jun 9, 2026",
    body:`No team in the world comes close to Argentina's 9.2/10 Chemistry Score — and no single number better captures why they are such a dangerous opponent despite individual quality gaps versus France and Spain.

Scaloni's seven-year tenure means the Mac Allister–Enzo Fernández–De Paul midfield trio has now played more competitive minutes together than any other international midfield combination. Their understanding — positional coverage, pressing triggers, rest-defence — operates at an automaticity that no other team at the tournament can match.

The system's vulnerability is Messi. At 38, and in the final performance window of his extraordinary career, Messi's physical availability across 7-8 matches is the central uncertainty of Argentina's campaign. In the 2026 qualifiers, Messi was substituted before 80 minutes in 60% of matches. Scaloni manages this carefully — but tournament football's compressed schedule leaves no room for rotation at the level of Argentina's key player.

The counter-narrative is the depth built around Messi: Lautaro, Julián Álvarez, Di María's likely farewell, Dybala off the bench. Argentina can compete even at 75% of Messi.`,
    insight:"In the 14 competitive matches Scaloni's Argentina have won from a losing position, Mac Allister or Enzo Fernández has been the assist provider in the turning-point goal in 9 of them.",
    heatNote:"Messi's heat map in 2026 qualifiers shows a significant shift — fewer wide-right touchline appearances, more central half-space positioning to reduce physical demands.",
  },
];

function AnalysisTab(){
  const [selected, setSelected] = useState(ANALYSIS_REPORTS[0].id);
  const report = ANALYSIS_REPORTS.find(r=>r.id===selected)||ANALYSIS_REPORTS[0];

  return(
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase",marginBottom:6}}>Tactical Analysis Reports</div>
        <div style={{fontSize:13,color:"#8E9BAF",maxWidth:600}}>In-depth technical and tactical breakdowns of standout teams and playing styles. Updated every 2-3 days as the tournament progresses.</div>
      </div>

      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        {/* Report selector sidebar */}
        <div style={{width:200,flexShrink:0}}>
          {ANALYSIS_REPORTS.map(r=>(
            <div key={r.id} onClick={()=>setSelected(r.id)} style={{cursor:"pointer",padding:"10px 12px",marginBottom:4,borderRadius:4,background:selected===r.id?"rgba(201,168,76,0.12)":"rgba(255,255,255,0.02)",border:`1px solid ${selected===r.id?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.06)"}`,transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <Flag id={r.teamId} size={16} style={{borderRadius:2}}/>
                <span style={{fontSize:11,fontWeight:600,color:selected===r.id?"#C9A84C":"#F5F0E8"}}>{r.team}</span>
              </div>
              <div style={{fontSize:10,color:selected===r.id?"rgba(201,168,76,0.8)":"#8E9BAF",lineHeight:1.4}}>{r.title}</div>
            </div>
          ))}
          <div style={{marginTop:12,padding:"10px 12px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:4}}>
            <div style={{fontSize:10,fontFamily:"monospace",color:"#8E9BAF",lineHeight:1.5}}>Reports update as the tournament progresses. New analyses added every 2-3 days based on real match data.</div>
          </div>
        </div>

        {/* Report content */}
        <div style={{flex:1,minWidth:300}}>
          <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,overflow:"hidden"}}>
            {/* Report header */}
            <div style={{background:"rgba(201,168,76,0.06)",borderBottom:"1px solid rgba(201,168,76,0.15)",padding:"20px 24px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <Flag id={report.teamId} size={28} style={{borderRadius:3}}/>
                <span style={{fontSize:9,fontFamily:"monospace",letterSpacing:"0.2em",color:report.badgeColor,background:`${report.badgeColor}15`,border:`1px solid ${report.badgeColor}30`,padding:"2px 8px",borderRadius:2}}>{report.badge}</span>
                <span style={{fontSize:10,fontFamily:"monospace",color:"#8E9BAF",marginLeft:"auto"}}>{report.date}</span>
              </div>
              <div style={{fontSize:20,fontWeight:700,color:"#F5F0E8",marginBottom:5,lineHeight:1.3}}>{report.title}</div>
              <div style={{fontSize:14,color:"#8E9BAF",fontStyle:"italic"}}>{report.subtitle}</div>
            </div>

            {/* Body */}
            <div style={{padding:"24px"}}>
              {report.body.split("\n\n").map((para,i)=>(
                <p key={i} style={{fontSize:14,color:"rgba(255,255,255,0.78)",lineHeight:1.75,marginBottom:16,marginTop:0}}>{para}</p>
              ))}

              {/* Key Insight callout */}
              <div style={{padding:"14px 18px",background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.25)",borderLeft:"3px solid #C9A84C",borderRadius:"0 4px 4px 0",marginTop:20,marginBottom:16}}>
                <div style={{fontSize:9,fontFamily:"monospace",letterSpacing:"0.15em",color:"#C9A84C",marginBottom:5}}>KEY TACTICAL INSIGHT</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",lineHeight:1.6,fontStyle:"italic"}}>{report.insight}</div>
              </div>

              {/* Heat map note */}
              {report.heatNote&&(
                <div style={{padding:"12px 16px",background:"rgba(139,184,240,0.06)",border:"1px solid rgba(139,184,240,0.2)",borderRadius:4}}>
                  <div style={{fontSize:9,fontFamily:"monospace",letterSpacing:"0.15em",color:"#8bb8f0",marginBottom:4}}>📊 DATA NOTE — HEAT MAP</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.55)",lineHeight:1.5}}>{report.heatNote}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WEIGHTS ──────────────────────────────────────────────────────────────────
function WeightsTab(){
  const cats={team:"Team Collective",manager:"Managerial",player:"Individual",context:"Contextual",luck:"Pure Luck",match:"Match-Specific (Individual Predictions)"};
  const catColors={team:"#2ecc71",manager:"#8bb8f0",player:"#C9A84C",context:"#8E9BAF",luck:"#9b59b6",match:"#f39c12"};
  const grouped={};
  FACTOR_WEIGHTS.forEach(f=>{if(!grouped[f.cat])grouped[f.cat]=[];grouped[f.cat].push(f);});
  const catTotals=Object.fromEntries(Object.entries(grouped).map(([k,v])=>[k,v.reduce((s,f)=>s+f.pct,0)]));
  return(
    <div>
      <div style={{marginBottom:20,fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase"}}>Factor Weights & Methodology</div>
      <div style={{marginBottom:20,padding:16,background:"rgba(46,204,113,0.05)",border:"1px solid rgba(46,204,113,0.2)",borderRadius:4,fontSize:13,color:"#8E9BAF"}}>
        <strong style={{color:"#F5F0E8"}}>Championship Probability Model</strong> (total=100%) — Team: <strong style={{color:"#2ecc71"}}>72%</strong> · Manager: <strong style={{color:"#8bb8f0"}}>11%</strong> · Individual: <strong style={{color:"#C9A84C"}}>6%</strong> · Contextual: <strong style={{color:"#8E9BAF"}}>6%</strong> · Luck: <strong style={{color:"#9b59b6"}}>5%</strong>
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

      {/* Match-specific factors — qualitative, no fixed % */}
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
          <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.2em",color:"#f39c12",textTransform:"uppercase"}}>{cats.match}</div>
          <div style={{fontSize:10,fontFamily:"monospace",color:"#8E9BAF",padding:"2px 8px",background:"rgba(243,156,18,0.1)",border:"1px solid rgba(243,156,18,0.25)",borderRadius:2}}>Qualitative overlay — adjusts individual match win %</div>
        </div>
        <div style={{fontSize:13,color:"#8E9BAF",marginBottom:12,lineHeight:1.6}}>These three factors are applied as adjustments on top of the base model specifically for individual match predictions. They shift win probabilities by up to ±8% per factor depending on the magnitude of the advantage.</div>
        {MATCH_FACTORS.map((f,i)=>(
          <div key={i} style={{marginBottom:12,padding:"12px 16px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(243,156,18,0.15)",borderRadius:4,borderLeft:`3px solid ${f.color}`}}>
            <div style={{fontWeight:600,fontSize:13,color:f.color,marginBottom:4}}>{f.label}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.65)",lineHeight:1.6}}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [activeTab,setActiveTab]=useState("Overview");
  const [teams,setTeams]=useState(INITIAL_TEAMS);
  const [players]=useState(INITIAL_PLAYERS);
  const [updates,setUpdates]=useState([]);
  const [showUpdates,setShowUpdates]=useState(false);
  const [loading,setLoading]=useState(false);
  const [aiSummary,setAiSummary]=useState("Pre-tournament baseline · France 18%, Argentina 15%, Spain 14% lead. Tournament opens June 11.");
  const [biggestMover,setBiggestMover]=useState(null);
  const [lastRefresh,setLastRefresh]=useState(null);
  const [error,setError]=useState(null);

  const [matches,setMatches]=useState([]);
  const [matchesLoading,setMatchesLoading]=useState(false);
  const [matchesError,setMatchesError]=useState(null);

  // Updates form state
  const [uType,setUType]=useState("result");
  const [uText,setUText]=useState("");
  const [uTeam,setUTeam]=useState("");

  const addUpdate=useCallback(u=>setUpdates(p=>[...p,u]),[]);

  const fetchMatches = useCallback(async()=>{
    setMatchesLoading(true);setMatchesError(null);
    try{
      const res=await fetch(`${BACKEND_URL}/matches`);
      if(!res.ok) throw new Error(`Server error: ${res.status}`);
      const data=await res.json();
      const sorted=(data||[]).sort((a,b)=>new Date(b.fixture?.date||0)-new Date(a.fixture?.date||0));
      setMatches(sorted);
    }catch(e){setMatchesError("Could not reach server.");console.error(e);}
    setMatchesLoading(false);
  },[]);

  useEffect(()=>{
    fetchMatches();
    const matchTimer=setInterval(fetchMatches,5*60*1000);
    const updateTimer=setInterval(async()=>{
      try{
        const res=await fetch(`${BACKEND_URL}/updates`);
        if(!res.ok) return;
        const newUpdates=await res.json();
        if(newUpdates.length>0) newUpdates.forEach(u=>addUpdate(u));
      }catch(e){}
    },5*60*1000);
    return()=>{clearInterval(matchTimer);clearInterval(updateTimer);};
  },[fetchMatches,addUpdate]);

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
  const isPredTab = PRED_TABS.includes(activeTab);

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

          {/* TABS */}
          <div style={{display:"flex",gap:0,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
            {/* Prediction tabs — gold accent */}
            {PRED_TABS.map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{
                background:activeTab===tab?"rgba(201,168,76,0.12)":"transparent",
                border:"none",
                borderBottom:activeTab===tab?"2px solid #C9A84C":"2px solid transparent",
                borderTop:activeTab===tab?"1px solid rgba(201,168,76,0.3)":"1px solid transparent",
                color:activeTab===tab?"#C9A84C":"rgba(201,168,76,0.55)",
                fontFamily:"monospace",fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",
                padding:"10px 14px",cursor:"pointer",transition:"all 0.15s",marginBottom:-1
              }}>
                ◆ {tab}
              </button>
            ))}
            {/* Divider */}
            <div style={{width:1,background:"rgba(255,255,255,0.1)",margin:"8px 6px 0"}}/>
            {/* Stats tabs — neutral */}
            {STATS_TABS.map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{
                background:"transparent",border:"none",
                borderBottom:activeTab===tab?"2px solid #8bb8f0":"2px solid transparent",
                color:activeTab===tab?"#8bb8f0":"#8E9BAF",
                fontFamily:"monospace",fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",
                padding:"10px 14px",cursor:"pointer",transition:"all 0.15s",marginBottom:-1
              }}>{tab}</button>
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

      {/* BODY */}
      <div style={{display:"flex",flex:1,overflow:"hidden",minHeight:0}}>

        {/* MAIN CONTENT */}
        <div style={{flex:1,overflowY:"auto",padding:"32px 24px"}}>
          {activeTab==="Overview"&&<OverviewTab teams={teams}/>}
          {activeTab==="Predictions"&&<PredictionsTab bracket={PREDICTED_KNOCKOUT}/>}
          {activeTab==="Groups"&&<GroupsTab groups={INITIAL_GROUPS}/>}
          {activeTab==="Players"&&<PlayersTab players={players}/>}
          {activeTab==="Analysis"&&<AnalysisTab/>}
          {activeTab==="Weights"&&<WeightsTab/>}
          <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"20px 0",textAlign:"center",fontFamily:"monospace",fontSize:11,color:"rgba(255,255,255,0.2)",letterSpacing:"0.1em",marginTop:40}}>
            FIFA WORLD CUP 2026 · LIVE PREDICTION ENGINE · 16-FACTOR MODEL · POWERED BY CLAUDE
          </div>
        </div>

        {/* SIDE PANEL */}
        <SidePanel matches={matches} loading={matchesLoading} error={matchesError} onRefresh={fetchMatches}/>
      </div>

      {/* HIDDEN UPDATES BUTTON — bottom-right corner */}
      <div style={{position:"fixed",bottom:20,right:308,zIndex:500}}>
        <button
          onClick={()=>setShowUpdates(!showUpdates)}
          title="Intelligence Feed (Admin)"
          style={{
            width:36,height:36,borderRadius:"50%",
            background:"rgba(30,30,40,0.9)",
            border:"1px solid rgba(255,255,255,0.08)",
            color:"rgba(255,255,255,0.2)",
            fontSize:14,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",
            backdropFilter:"blur(4px)",
            boxShadow:"0 2px 8px rgba(0,0,0,0.4)"
          }}>
          {updates.length>0
            ? <span style={{fontFamily:"monospace",fontSize:10,color:"rgba(201,168,76,0.6)",fontWeight:700}}>{updates.length}</span>
            : "·"}
        </button>
      </div>

      {/* UPDATES PANEL — slides up from corner */}
      {showUpdates&&(
        <div style={{position:"fixed",bottom:64,right:308,zIndex:500,width:360,maxHeight:"70vh",background:"#14141C",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.15em",color:"#C9A84C",textTransform:"uppercase"}}>Intelligence Feed</div>
            <button onClick={()=>setShowUpdates(false)} style={{background:"none",border:"none",color:"#8E9BAF",fontSize:16,cursor:"pointer",padding:0}}>✕</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
            <div style={{fontSize:12,color:"#8E9BAF",marginBottom:12}}>Enter new information — the AI will recalculate all probabilities.</div>
            <div style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:8,marginBottom:8}}>
              <select value={uType} onChange={e=>setUType(e.target.value)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:3,padding:"6px 8px",color:"#F5F0E8",fontSize:12,fontFamily:"monospace",cursor:"pointer"}}>
                {UPDATE_TYPES.map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
              <input value={uTeam} onChange={e=>setUTeam(e.target.value)} placeholder="Team…" style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:3,padding:"6px 8px",color:"#F5F0E8",fontSize:12,outline:"none"}}/>
            </div>
            <textarea value={uText} onChange={e=>setUText(e.target.value)} placeholder="Details…" rows={3} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:3,padding:"8px",color:"#F5F0E8",fontSize:13,resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.5,fontFamily:"Georgia,serif",marginBottom:8}}/>
            <button onClick={()=>{if(!uText.trim())return;addUpdate({type:uType,team:uTeam,text:uText,date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})});setUText("");setUTeam("");}} style={{background:"linear-gradient(135deg,#C9A84C,#E8C97A)",color:"#0A0A0F",border:"none",borderRadius:3,padding:"7px 16px",fontSize:11,fontWeight:700,fontFamily:"monospace",letterSpacing:"0.1em",cursor:"pointer",textTransform:"uppercase",marginBottom:12}}>
              + Add to Feed
            </button>
            {[...updates].reverse().map((u,i)=>(
              <div key={i} style={{padding:"8px 10px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:3,borderLeft:`3px solid ${UPDATE_COLORS[u.type]||"#8E9BAF"}`,marginBottom:6}}>
                <div style={{display:"flex",gap:8,marginBottom:3,alignItems:"center"}}>
                  <span style={{fontFamily:"monospace",fontSize:10,color:UPDATE_COLORS[u.type]||"#8E9BAF",textTransform:"uppercase"}}>{u.type}</span>
                  {u.team&&<span style={{fontSize:10,color:"#C9A84C"}}>[{u.team}]</span>}
                  <span style={{fontSize:10,color:"#8E9BAF",marginLeft:"auto"}}>{u.date}</span>
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.5}}>{u.text}</div>
              </div>
            ))}
            {updates.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:"#8E9BAF",fontSize:12,fontStyle:"italic"}}>No updates logged yet.</div>}
          </div>
        </div>
      )}

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
