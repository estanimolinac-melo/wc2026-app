import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { Flag, INITIAL_TEAMS, INITIAL_PLAYERS, INFLUENTIAL_NON_TOP50, FACTOR_WEIGHTS, MATCH_FACTORS, INITIAL_GROUPS, GROUP_MATCH_PREDICTIONS, FIFA_RANK, computeGroupStandings, BRACKET_PREDICTIONS, RECENT_FRIENDLIES } from "./data.jsx";

// ── COMPUTE STANDINGS ONCE ────────────────────────────────────────────────────
const { teamStats: TEAM_STATS, groupedStandings: GROUPED_STANDINGS } = computeGroupStandings();

// Derive sorted group arrays for Overview
const COMPUTED_GROUPS = Object.fromEntries(
  Object.entries(GROUPED_STANDINGS).map(([g, arr]) => [g, arr])
);

// Best 8 thirds (for badge display)
const ALL_THIRDS = "ABCDEFGHIJKL".split("").map(g => {
  const arr = GROUPED_STANDINGS[g] || [];
  return arr[2] ? { ...arr[2], group: g } : null;
}).filter(Boolean);
ALL_THIRDS.sort((a,b) =>
  b.pts!==a.pts?b.pts-a.pts:b.gd!==a.gd?b.gd-a.gd:b.gf!==a.gf?b.gf-a.gf:a.fifaRank-b.fifaRank
);
const BEST_THIRDS_IDS = new Set(ALL_THIRDS.slice(0,8).map(t=>t.id));

// ── THEME CONTEXT ─────────────────────────────────────────────────────────────
const ThemeCtx = createContext({ dark: true });
const useTheme = () => useContext(ThemeCtx);

function mkTheme(dark) {
  return dark ? {
    bg:        "#0A0A0F",
    surface:   "#14141C",
    surface2:  "rgba(255,255,255,0.03)",
    border:    "rgba(255,255,255,0.08)",
    borderGold:"rgba(201,168,76,0.25)",
    text:      "#F5F0E8",
    textMuted: "#8E9BAF",
    textDim:   "rgba(255,255,255,0.45)",
    panelBg:   "#0A0E1A",
    panelBorder:"rgba(255,255,255,0.07)",
    headerBg:  "#14141C",
    gold:      "#C9A84C",
    blue:      "#8bb8f0",
    green:     "#2ecc71",
    red:       "#e74c3c",
    scrollTrack:"#0A0A0F",
    inputBg:   "rgba(255,255,255,0.05)",
    cardHover: "rgba(255,255,255,0.05)",
    shadow:    "0 4px 24px rgba(0,0,0,0.4)",
  } : {
    bg:        "#F0F2F5",
    surface:   "#FFFFFF",
    surface2:  "rgba(0,0,0,0.02)",
    border:    "rgba(0,0,0,0.1)",
    borderGold:"rgba(160,120,30,0.3)",
    text:      "#1A1A2E",
    textMuted: "#5A6478",
    textDim:   "rgba(0,0,0,0.35)",
    panelBg:   "#E8ECF4",
    panelBorder:"rgba(0,0,0,0.09)",
    headerBg:  "#FFFFFF",
    gold:      "#A07828",
    blue:      "#2563EB",
    green:     "#16a34a",
    red:       "#dc2626",
    scrollTrack:"#F0F2F5",
    inputBg:   "rgba(0,0,0,0.04)",
    cardHover: "rgba(0,0,0,0.04)",
    shadow:    "0 4px 24px rgba(0,0,0,0.12)",
  };
}

// ── INTERNATIONAL LEAGUE IDs ──────────────────────────────────────────────────
export const INTERNATIONAL_LEAGUE_IDS = new Set([
  1,9,8,274,7,6,10,29,30,32,34,36,44,142,143,144,848,954,480,
]);

const BACKEND_URL = "https://wc2026-fetcher.onrender.com";

// ── SHARED ────────────────────────────────────────────────────────────────────
const probColor = (p, t) => p>=14 ? t.gold : p>=8 ? t.blue : p>=4 ? t.green : t.textMuted;
const POS_COLORS = { FWD:"#e74c3c", MID:"#2ecc71", DEF:"#8bb8f0", GK:"#C9A84C" };

const PRED_TABS  = ["Overview","Predictions"];
const STATS_TABS = ["Groups","Players","Analysis","Weights"];
const UPDATE_TYPES  = ["result","injury","fitness","suspension","tactical","news"];
const UPDATE_COLORS = { result:"#2ecc71",injury:"#e74c3c",fitness:"#f39c12",suspension:"#e67e22",tactical:"#8bb8f0",news:"#8E9BAF" };
const SORT_OPTIONS  = [
  {key:"rank",label:"Pre-Tournament Rank"},{key:"fantasy",label:"Fantasy Score"},
  {key:"goals",label:"Goals"},{key:"assists",label:"Assists"},
  {key:"cleanSheets",label:"Clean Sheets"},{key:"interceptions",label:"Interceptions"},
  {key:"saves",label:"Saves (GK)"},
];


function ChangeIndicator({change}){
  const t = useTheme();
  if(!change||Math.abs(change)<0.05) return <span style={{color:t.textDim,fontSize:11,fontFamily:"monospace"}}>—</span>;
  const up=change>0;
  return <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:up?t.green:t.red}}>{up?"▲":"▼"} {Math.abs(change).toFixed(1)}%</span>;
}

function calcFantasyScore(p){
  if(p.apps===0) return 0;
  let s=(p.goals*6)+(p.assists*4)+(p.apps*1)+(p.cleanSheets*3)+(p.interceptions*0.6)+(p.foulsDrawn*0.3)-(p.foulsCommitted*0.25)-(p.yellowCards*0.5)-(p.redCards*3);
  if(p.pos==="GK") s+=(p.saves*0.5)+(p.penaltySaves*3)+(p.cleanSheets*2);
  if(p.pos==="DEF") s+=(p.cleanSheets*1.5);
  return Math.max(0,parseFloat(s.toFixed(1)));
}

const buildSystemPrompt=(teams,updates)=>`You are the analytical engine for a FIFA World Cup 2026 prediction tracker. Recalculate championship win probabilities for all teams.
METHODOLOGY WEIGHTS (total=100%): Team Factors (72%): Form 16%, Big-Game 14%, Chemistry 13%, xG/Tactical 11%, Injuries 10%, Age 8%. Manager (11%). IPFI (6%). Contextual (6%). Pure Luck (5%).
CURRENT PROBABILITIES: ${teams.map(t=>`${t.name}: ${t.prob}%`).join(", ")}
UPDATES: ${updates.length>0?updates.map(u=>`[${u.date}] ${u.type}: ${u.text}`).join(" | "):"Baseline"}
Respond ONLY with valid JSON: {"teams":[{"id":"FRA","prob":18.5,"change":0.5,"reasoning":"brief"},...all 18],"summary":"2-3 sentences","biggestMover":"team + why"}. Probabilities sum to ~100%.`;

// ── STATUS COLORS ─────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  "FT":"#2ecc71","NS":"#8E9BAF","1H":"#e74c3c","2H":"#e74c3c",
  "HT":"#f39c12","ET":"#e74c3c","P":"#9b59b6","AET":"#2ecc71",
  "PEN":"#2ecc71","CANC":"#e74c3c","PST":"#e74c3c",
};

// ── MATCH CARD (side panel) ───────────────────────────────────────────────────
function MatchCard({match}){
  const t = useTheme();
  const [expanded,setExpanded]=useState(false);
  const status=match.fixture?.status?.short||"NS";
  const elapsed=match.fixture?.status?.elapsed;
  const home=match.teams?.home, away=match.teams?.away;
  const hGoals=match.goals?.home??"—", aGoals=match.goals?.away??"—";
  const isLive=["1H","2H","HT","ET","P"].includes(status);
  const isFinished=["FT","AET","PEN"].includes(status);
  const isUpcoming=status==="NS";
  const events=match.events||[];
  const goals=events.filter(e=>e.type==="Goal");
  const cards=events.filter(e=>e.type==="Card");
  const subs=events.filter(e=>e.type==="subst");
  // Sort ALL events chronologically regardless of type
  const allEvents=[...events].filter(e=>["Goal","Card","subst"].includes(e.type))
    .sort((a,b)=>(a.time?.elapsed||0)-(b.time?.elapsed||0)||(a.time?.extra||0)-(b.time?.extra||0));
  const homeId=home?.id;
  const isHomeEvent=e=>e.team?.id===homeId;
  const dateStr=match.fixture?.date?new Date(match.fixture.date).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"";
  const statusLabel=isLive?`${elapsed}'`:status;

  function EventRow({e,icon,label,color}){
    const h=isHomeEvent(e);
    return(
      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,marginBottom:3,flexDirection:h?"row":"row-reverse"}}>
        <span style={{fontSize:13,flexShrink:0}}>{icon}</span>
        <span style={{fontFamily:"monospace",color:t.textMuted,flexShrink:0}}>{e.time?.elapsed}{e.time?.extra?`+${e.time.extra}`:""}'</span>
        <span style={{fontWeight:600,color:color||t.text,textAlign:h?"left":"right"}}>{label}</span>
      </div>
    );
  }

  const hasDetail=allEvents.length>0;
  return(
    <div style={{background:t.surface2,border:`1px solid ${isLive?"rgba(231,76,60,0.4)":t.border}`,borderRadius:4,marginBottom:6,overflow:"hidden",cursor:"pointer",boxShadow:isLive?"0 0 8px rgba(231,76,60,0.15)":"none"}} onClick={()=>setExpanded(!expanded)}>
      <div style={{padding:"8px 10px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:10,fontFamily:"monospace",color:t.textMuted}}>{dateStr}</span>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            {isLive&&<span style={{width:6,height:6,borderRadius:"50%",background:"#e74c3c",display:"inline-block",animation:"pulse 1.5s infinite"}}/>}
            <span style={{fontSize:10,fontFamily:"monospace",fontWeight:700,color:STATUS_COLORS[status]||t.textMuted,background:`${STATUS_COLORS[status]||t.textMuted}18`,padding:"1px 6px",borderRadius:2}}>{statusLabel}</span>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 36px 1fr",alignItems:"center",gap:4}}>
          <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}>
            <span style={{fontSize:12,fontWeight:home?.winner?700:400,color:home?.winner?t.text:t.textMuted,textAlign:"right"}}>{home?.name||"TBD"}</span>
            {home?.logo&&<img src={home.logo} alt="" style={{width:16,height:16,objectFit:"contain",flexShrink:0}}/>}
          </div>
          <div style={{textAlign:"center",fontFamily:"monospace",fontSize:14,fontWeight:700,color:isUpcoming?t.textMuted:t.text}}>
            {isUpcoming?(match.fixture?.date?new Date(match.fixture.date).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}):"—"):`${hGoals}–${aGoals}`}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {away?.logo&&<img src={away.logo} alt="" style={{width:16,height:16,objectFit:"contain",flexShrink:0}}/>}
            <span style={{fontSize:12,fontWeight:away?.winner?700:400,color:away?.winner?t.text:t.textMuted}}>{away?.name||"TBD"}</span>
          </div>
        </div>
        {match.league?.name&&<div style={{textAlign:"center",fontSize:10,color:t.textMuted,marginTop:4,fontStyle:"italic"}}>{match.league.name}</div>}
      </div>
      {expanded&&hasDetail&&(
        <div style={{borderTop:`1px solid ${t.border}`,padding:"8px 10px",background:t.dark?"rgba(0,0,0,0.2)":"rgba(0,0,0,0.03)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
            <div style={{fontSize:9,fontFamily:"monospace",color:t.gold,letterSpacing:"0.1em"}}>{home?.name?.toUpperCase()}</div>
            <div style={{fontSize:9,fontFamily:"monospace",color:t.gold,letterSpacing:"0.1em",textAlign:"right"}}>{away?.name?.toUpperCase()}</div>
          </div>
          {allEvents.map((e,i)=>{
            if(e.type==="Goal"){
              const og=e.detail==="Own Goal";
              return <EventRow key={i} e={e} icon={og?<span style={{fontSize:13}}>🔴</span>:<span style={{fontSize:13}}>⚽</span>} label={`${e.player?.name}${og?" OG":""}${e.assist?.name?` (${e.assist.name})`:""}`} color={og?t.red:t.text}/>;
            }
            if(e.type==="Card"){
              const r=e.detail==="Red Card"||e.detail==="Second Yellow card";
              return <EventRow key={i} e={e} icon={r?"🟥":"🟨"} label={e.player?.name} color={r?t.red:"#f39c12"}/>;
            }
            if(e.type==="subst"){
              return <EventRow key={i} e={e} icon="🔄" label={`${e.assist?.name||"?"} ↑  ${e.player?.name||"?"} ↓`} color={t.textMuted}/>;
            }
            return null;
          })}
        </div>
      )}
      {!expanded&&(isFinished||isLive)&&hasDetail&&<div style={{textAlign:"center",padding:"2px",fontSize:10,color:t.textDim}}>▼ details</div>}
    </div>
  );
}

// ── SIDE PANEL ────────────────────────────────────────────────────────────────
function SidePanel({matches,loading,error,onRefresh}){
  const t=useTheme();
  const [filterDate,setFilterDate]=useState("");
  const [filterStatus,setFilterStatus]=useState("ALL");
  const intlMatches=matches.filter(m=>INTERNATIONAL_LEAGUE_IDS.has(m.league?.id));
  const filtered=intlMatches.filter(m=>{
    const dateOk=!filterDate||(m.fixture?.date||"").startsWith(filterDate);
    const statusOk=filterStatus==="ALL"||
      (filterStatus==="LIVE"&&["1H","2H","HT","ET","P"].includes(m.fixture?.status?.short))||
      (filterStatus==="FT"&&["FT","AET","PEN"].includes(m.fixture?.status?.short))||
      (filterStatus==="NS"&&m.fixture?.status?.short==="NS");
    return dateOk&&statusOk;
  });
  const liveCount=intlMatches.filter(m=>["1H","2H","HT","ET","P"].includes(m.fixture?.status?.short)).length;
  return(
    <div style={{width:288,flexShrink:0,background:t.panelBg,borderLeft:`1px solid ${t.panelBorder}`,display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0,overflow:"hidden"}}>
      <div style={{padding:"14px 12px 10px",borderBottom:`1px solid ${t.panelBorder}`,flexShrink:0,background:t.dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.03)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div>
            <div style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.2em",color:t.blue,textTransform:"uppercase",marginBottom:2}}>Live Match Feed</div>
            <div style={{fontSize:11,color:t.textMuted,marginTop:1}}>International · WC nations · May 16+</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {liveCount>0&&<div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(231,76,60,0.15)",border:"1px solid rgba(231,76,60,0.3)",borderRadius:3,padding:"2px 7px"}}><span style={{width:6,height:6,borderRadius:"50%",background:"#e74c3c",display:"inline-block",animation:"pulse 1.5s infinite"}}/><span style={{fontFamily:"monospace",fontSize:10,color:"#e74c3c",fontWeight:700}}>{liveCount} LIVE</span></div>}
            <button onClick={onRefresh} disabled={loading} style={{background:t.dark?"rgba(139,184,240,0.1)":"rgba(37,99,235,0.1)",border:`1px solid ${t.dark?"rgba(139,184,240,0.25)":"rgba(37,99,235,0.25)"}`,borderRadius:3,padding:"4px 8px",color:t.blue,fontSize:12,cursor:loading?"not-allowed":"pointer",opacity:loading?0.5:1}}>⟳</button>
          </div>
        </div>
        <div style={{display:"flex",gap:4,marginBottom:6}}>
          {["ALL","LIVE","FT","NS"].map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)} style={{flex:1,background:filterStatus===s?t.dark?"rgba(139,184,240,0.18)":"rgba(37,99,235,0.12)":t.inputBg,border:`1px solid ${filterStatus===s?t.blue:t.border}`,borderRadius:3,padding:"3px 0",fontSize:10,fontFamily:"monospace",color:filterStatus===s?t.blue:t.textMuted,cursor:"pointer"}}>{s}</button>
          ))}
        </div>
        <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{width:"100%",background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:3,padding:"5px 8px",color:t.text,fontSize:11,fontFamily:"monospace",outline:"none",boxSizing:"border-box",colorScheme:t.dark?"dark":"light"}}/>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
        {error&&<div style={{padding:"12px",background:"rgba(231,76,60,0.1)",border:"1px solid rgba(231,76,60,0.3)",borderRadius:4,fontSize:12,color:"#e74c3c",marginBottom:8}}>{error}</div>}
        {loading&&filtered.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:t.textMuted,fontSize:12}}>Loading matches…</div>}
        {!loading&&filtered.length===0&&intlMatches.length>0&&<div style={{textAlign:"center",padding:"30px 0",color:t.textMuted,fontSize:12,fontStyle:"italic"}}>No matches for this filter.</div>}
        {!loading&&intlMatches.length===0&&!error&&<div style={{textAlign:"center",padding:"30px 0",color:t.textMuted,fontSize:12,fontStyle:"italic"}}>Backend connected — awaiting international fixtures.</div>}
        {filtered.map((m,i)=><MatchCard key={m.fixture?.id||i} match={m}/>)}
      </div>
      <div style={{padding:"6px 10px",borderTop:`1px solid ${t.border}`,flexShrink:0,fontSize:10,fontFamily:"monospace",color:t.textMuted,textAlign:"center"}}>{filtered.length} match{filtered.length!==1?"es":""} · international only</div>
    </div>
  );
}

// ── OVERVIEW TAB ──────────────────────────────────────────────────────────────
function OverviewTab({teams}){
  const t=useTheme();
  const [expanded,setExpanded]=useState(null);
  const sorted=[...teams].sort((a,b)=>b.prob-a.prob);
  const max=sorted[0]?.prob||1;
  return(
    <div>
      <div style={{marginBottom:28}}>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:t.gold,textTransform:"uppercase",marginBottom:6}}>Championship Probability Leaderboard</div>
        <div style={{fontSize:13,color:t.textMuted,marginBottom:16,maxWidth:600}}>Live championship win probabilities. Click any team to expand rationale.</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {sorted.map((team,i)=>{
            const barW=(team.prob/max)*100;
            const col=probColor(team.prob,t);
            const open=expanded===team.id;
            return(
              <div key={team.id} style={{background:t.surface2,border:`1px solid ${open?t.borderGold:t.border}`,borderRadius:4,overflow:"hidden",cursor:"pointer"}} onClick={()=>setExpanded(open?null:team.id)}>
                <div style={{display:"grid",gridTemplateColumns:"32px 36px 1fr 80px 60px 60px 24px",alignItems:"center",gap:10,padding:"11px 16px"}}>
                  <div style={{fontFamily:"monospace",fontSize:13,color:t.textMuted,textAlign:"center"}}>#{i+1}</div>
                  <Flag id={team.id} size={28} style={{borderRadius:3}}/>
                  <div>
                    <div style={{fontWeight:700,fontSize:15,color:t.text,marginBottom:3}}>{team.name}</div>
                    <div style={{position:"relative",height:4,background:t.dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${barW}%`,background:`linear-gradient(90deg,${col},${col}88)`,borderRadius:3,transition:"width 0.8s"}}/>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}><span style={{fontFamily:"monospace",fontSize:18,fontWeight:700,color:col}}>{team.prob.toFixed(1)}%</span></div>
                  <div style={{textAlign:"center"}}><ChangeIndicator change={team.change}/></div>
                  <div style={{textAlign:"right",fontSize:11,color:t.textMuted,fontFamily:"monospace"}}>Grp {team.group}</div>
                  <div style={{color:t.textMuted,fontSize:12,textAlign:"center"}}>{open?"▲":"▼"}</div>
                </div>
                {open&&(
                  <div style={{borderTop:`1px solid ${t.border}`,padding:"16px",background:t.dark?"rgba(0,0,0,0.2)":"rgba(0,0,0,0.02)"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:14}}>
                      <div><div style={{fontSize:10,fontFamily:"monospace",letterSpacing:"0.15em",color:t.green,marginBottom:6}}>STRENGTHS</div><div style={{fontSize:13,color:t.textMuted,lineHeight:1.6}}>{team.strengths}</div></div>
                      <div><div style={{fontSize:10,fontFamily:"monospace",letterSpacing:"0.15em",color:t.red,marginBottom:6}}>WEAKNESSES</div><div style={{fontSize:13,color:t.textMuted,lineHeight:1.6}}>{team.weaknesses}</div></div>
                    </div>
                    <div style={{padding:"10px 14px",background:t.dark?"rgba(201,168,76,0.07)":"rgba(160,120,30,0.06)",border:`1px solid ${t.borderGold}`,borderRadius:4}}>
                      <div style={{fontSize:10,fontFamily:"monospace",letterSpacing:"0.15em",color:t.gold,marginBottom:5}}>PROBABILITY RATIONALE</div>
                      <div style={{fontSize:13,color:t.textMuted,lineHeight:1.6}}>{team.rationale}</div>
                    </div>
                    <div style={{display:"flex",gap:24,marginTop:12,flexWrap:"wrap"}}>
                      {[["Manager",team.manager],["CIS",`${team.cis}/10`],["Chemistry",`${team.chemistry}/10`],["Form",`${team.form}/10`]].map(([l,v])=>(
                        <div key={l}><span style={{fontSize:11,color:t.textMuted,fontFamily:"monospace"}}>{l}: </span><span style={{fontSize:13,color:t.text,fontWeight:600}}>{v}</span></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Predicted Group Stage Standings — full stats tables */}
      <div>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:t.gold,textTransform:"uppercase",marginBottom:6}}>Predicted Group Stage Standings</div>
        <div style={{fontSize:13,color:t.textMuted,marginBottom:16,maxWidth:700}}>Projected final standings computed from predicted scorelines. Top 2 per group qualify directly; best 8 third-place teams also advance (shown with purple badge).</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(380px,1fr))",gap:16}}>
          {"ABCDEFGHIJKL".split("").map(grp => {
            const teams_ = COMPUTED_GROUPS[grp] || [];
            return (
              <div key={grp} style={{background:t.surface2,border:`1px solid ${t.borderGold}`,borderRadius:5,overflow:"hidden"}}>
                <div style={{background:t.dark?"rgba(201,168,76,0.08)":"rgba(160,120,30,0.06)",borderBottom:`1px solid ${t.borderGold}`,padding:"6px 12px"}}>
                  <span style={{fontFamily:"Impact,sans-serif",fontSize:20,color:t.gold}}>GROUP {grp}</span>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${t.border}`}}>
                      {["","Team","MP","W","D","L","GS","GC","GD","Pts"].map((h,hi)=>(
                        <th key={hi} style={{padding:"5px 6px",fontFamily:"monospace",fontSize:9,letterSpacing:"0.08em",color:t.gold+"99",textAlign:hi<=1?"left":"center",fontWeight:400}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teams_.map((team, pos) => {
                      const isBest3 = pos===2 && BEST_THIRDS_IDS.has(team.id);
                      const qualifies = pos < 2 || isBest3;
                      return (
                        <tr key={team.id} style={{borderBottom:`1px solid ${t.border}`,background:pos===0?t.dark?"rgba(26,94,58,0.15)":"rgba(22,163,74,0.07)":pos===1?t.dark?"rgba(26,58,107,0.12)":"rgba(37,99,235,0.06)":isBest3?t.dark?"rgba(155,89,182,0.08)":"rgba(124,58,237,0.05)":"transparent"}}>
                          <td style={{padding:"7px 6px",width:28}}>
                            {pos===0&&<span style={{fontSize:8,fontFamily:"monospace",color:t.gold,background:t.dark?"rgba(201,168,76,0.15)":"rgba(160,120,30,0.1)",padding:"1px 3px",borderRadius:2}}>1ST</span>}
                            {pos===1&&<span style={{fontSize:8,fontFamily:"monospace",color:t.blue,background:t.dark?"rgba(139,184,240,0.15)":"rgba(37,99,235,0.1)",padding:"1px 3px",borderRadius:2}}>2ND</span>}
                            {isBest3&&<span style={{fontSize:8,fontFamily:"monospace",color:"#9b59b6",background:"rgba(155,89,182,0.15)",padding:"1px 3px",borderRadius:2}}>3RD</span>}
                            {pos===2&&!isBest3&&<span style={{fontSize:8,fontFamily:"monospace",color:t.textDim}}>3rd</span>}
                            {pos===3&&<span style={{fontSize:8,fontFamily:"monospace",color:t.textDim}}>4th</span>}
                          </td>
                          <td style={{padding:"7px 6px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <Flag id={team.id} size={16} style={{borderRadius:2,flexShrink:0}}/>
                              <span style={{color:qualifies?t.text:t.textMuted,fontWeight:qualifies?600:400}}>{team.name}</span>
                            </div>
                          </td>
                          <td style={{textAlign:"center",padding:"7px 6px",color:t.textMuted,fontFamily:"monospace"}}>{team.mp}</td>
                          <td style={{textAlign:"center",padding:"7px 6px",color:team.w>0?t.green:t.textMuted,fontFamily:"monospace",fontWeight:team.w>0?700:400}}>{team.w}</td>
                          <td style={{textAlign:"center",padding:"7px 6px",color:t.textMuted,fontFamily:"monospace"}}>{team.d}</td>
                          <td style={{textAlign:"center",padding:"7px 6px",color:team.l>0?t.red:t.textMuted,fontFamily:"monospace"}}>{team.l}</td>
                          <td style={{textAlign:"center",padding:"7px 6px",color:t.text,fontFamily:"monospace"}}>{team.gf}</td>
                          <td style={{textAlign:"center",padding:"7px 6px",color:t.textMuted,fontFamily:"monospace"}}>{team.ga}</td>
                          <td style={{textAlign:"center",padding:"7px 6px",fontFamily:"monospace",fontWeight:700,color:team.gd>0?t.green:team.gd<0?t.red:t.textMuted}}>{team.gd>0?`+${team.gd}`:team.gd}</td>
                          <td style={{textAlign:"center",padding:"7px 6px",fontFamily:"monospace",fontWeight:700,color:t.gold}}>{team.pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Best 8 thirds panel */}
        <div style={{marginTop:20,padding:"16px 20px",background:t.dark?"rgba(155,89,182,0.06)":"rgba(124,58,237,0.04)",border:`1px solid ${t.dark?"rgba(155,89,182,0.2)":"rgba(124,58,237,0.15)"}`,borderRadius:6}}>
          <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.2em",color:"#9b59b6",textTransform:"uppercase",marginBottom:8}}>Best 8 Third-Place Teams — Predicted Advancement</div>
          <div style={{fontSize:12,color:t.textMuted,marginBottom:12,lineHeight:1.5}}>Ranked by: Points → Goal Difference → Goals Scored → FIFA World Ranking. The 8 best 3rd-place finishers from 12 groups advance to the Round of 32.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
            {ALL_THIRDS.slice(0,8).map((team,i)=>(
              <div key={team.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:t.surface2,border:`1px solid ${t.dark?"rgba(155,89,182,0.2)":"rgba(124,58,237,0.12)"}`,borderRadius:4}}>
                <span style={{fontFamily:"monospace",fontSize:12,color:"#9b59b6",fontWeight:700,width:18,flexShrink:0}}>#{i+1}</span>
                <Flag id={team.id} size={18} style={{borderRadius:2}}/>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:t.text}}>{team.name}</div>
                  <div style={{fontSize:10,color:t.textMuted,fontFamily:"monospace"}}>Grp {team.group} · {team.pts}pts · GD {team.gd>0?"+":""}{team.gd} · GS {team.gf}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TWO-SIDED BRACKET ─────────────────────────────────────────────────────────
// R32: 16 matches → Left side matches 0-7, Right side matches 8-15
// R16: 8 matches → Left 0-3, Right 4-7
// QF:  4 matches → Left 0-1, Right 2-3
// SF:  2 matches → Left 0, Right 1
// Final: center

function BracketTeamRow({team, isWinner, isLoser}){
  const t=useTheme();
  return(
    <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",background:isWinner?t.dark?"rgba(201,168,76,0.12)":"rgba(160,120,30,0.08)":"transparent"}}>
      <Flag id={team.id} size={14} style={{borderRadius:2,opacity:isLoser?0.4:1,flexShrink:0}}/>
      <span style={{flex:1,fontSize:11,fontWeight:isWinner?700:400,color:isWinner?t.gold:isLoser?t.textDim:t.text,textDecoration:isLoser?"line-through":"none",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{team.name}</span>
      <span style={{fontFamily:"monospace",fontSize:10,color:isWinner?t.gold:t.textDim,flexShrink:0}}>{team.prob}%</span>
    </div>
  );
}

function BracketMatchBox({match, onExpand, expanded}){
  const t=useTheme();
  if(!match) return <div style={{height:52,width:180,background:t.dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.03)",border:`1px dashed ${t.border}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:10,color:t.textDim,fontFamily:"monospace"}}>TBD</span></div>;
  return(
    <div style={{width:180,background:t.surface,border:`1px solid ${expanded?t.gold:t.border}`,borderRadius:4,overflow:"hidden",cursor:"pointer",transition:"border-color 0.15s"}} onClick={()=>onExpand(match)}>
      <BracketTeamRow team={match.a} isWinner={match.winner===match.a.name} isLoser={match.winner&&match.winner!==match.a.name}/>
      <div style={{height:1,background:t.border}}/>
      <BracketTeamRow team={match.b} isWinner={match.winner===match.b.name} isLoser={match.winner&&match.winner!==match.b.name}/>
    </div>
  );
}

function MatchDetail({match, onClose}){
  const t=useTheme();
  if(!match) return null;
  return(
    <div style={{marginTop:12,padding:"12px 16px",background:t.dark?"rgba(0,0,0,0.3)":"rgba(0,0,0,0.04)",border:`1px solid ${t.borderGold}`,borderRadius:4,position:"relative"}}>
      <button onClick={onClose} style={{position:"absolute",top:8,right:10,background:"none",border:"none",color:t.textMuted,fontSize:14,cursor:"pointer",padding:0}}>✕</button>
      <div style={{fontSize:10,fontFamily:"monospace",color:t.gold,marginBottom:8,letterSpacing:"0.1em"}}>{match.a.name.toUpperCase()} vs {match.b.name.toUpperCase()}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><div style={{fontSize:9,fontFamily:"monospace",color:t.green,marginBottom:3}}>{match.a.name.toUpperCase()}</div><div style={{fontSize:11,color:t.textMuted,lineHeight:1.4}}>{match.aS}</div></div>
        <div><div style={{fontSize:9,fontFamily:"monospace",color:t.red,marginBottom:3}}>{match.b.name.toUpperCase()}</div><div style={{fontSize:11,color:t.textMuted,lineHeight:1.4}}>{match.bS}</div></div>
      </div>
      <div style={{padding:"7px 10px",background:t.dark?"rgba(201,168,76,0.07)":"rgba(160,120,30,0.05)",borderRadius:3,fontSize:11,color:t.textMuted,lineHeight:1.5}}>
        <span style={{color:t.gold,fontFamily:"monospace",fontSize:9,letterSpacing:"0.1em"}}>VERDICT: </span>{match.rat}
      </div>
    </div>
  );
}


function TwoSidedBracket(){
  const t=useTheme();
  const [expandedId,setExpandedId]=useState(null);
  const bp=BRACKET_PREDICTIONS;
  const leftR32  = bp.r32.filter(m=>m.side==="L");  // 8 matches
  const rightR32 = bp.r32.filter(m=>m.side==="R");  // 8 matches
  const leftR16  = bp.r16.filter(m=>m.side==="L");  // 4 matches
  const rightR16 = bp.r16.filter(m=>m.side==="R");  // 4 matches
  const leftQF   = bp.qf.filter(m=>m.side==="L");   // 2 matches
  const rightQF  = bp.qf.filter(m=>m.side==="R");   // 2 matches
  const leftSF   = bp.sf.filter(m=>m.side==="L");   // 1 match
  const rightSF  = bp.sf.filter(m=>m.side==="R");   // 1 match
  const final    = bp.final[0];

  const MATCH_H=54, GAP=8;
  const c_line=t.dark?"rgba(201,168,76,0.35)":"rgba(160,120,30,0.3)";

  function MatchBox({match, id}){
    if(!match) return(
      <div style={{width:188,height:MATCH_H,background:t.dark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.03)",border:`1px dashed ${t.border}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:10,color:t.textDim,fontFamily:"monospace"}}>TBD</span>
      </div>
    );
    const open=expandedId===id;
    const aWin=match.winner===match.a.name, bWin=match.winner===match.b.name;
    return(
      <div style={{width:188,background:t.surface,border:`1px solid ${open?t.gold:t.border}`,borderRadius:4,overflow:"hidden",cursor:"pointer",transition:"border-color 0.15s"}} onClick={()=>setExpandedId(open?null:id)}>
        <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 8px",background:aWin?t.dark?"rgba(201,168,76,0.1)":"rgba(160,120,30,0.07)":"transparent",borderBottom:`1px solid ${t.border}`}}>
          <Flag id={match.a.id} size={13} style={{borderRadius:2,flexShrink:0,opacity:bWin?0.4:1}}/>
          <span style={{flex:1,fontSize:11,fontWeight:aWin?700:400,color:aWin?t.gold:bWin?t.textDim:t.text,textDecoration:bWin?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{match.a.name}</span>
          <span style={{fontFamily:"monospace",fontSize:10,color:aWin?t.gold:t.textDim,flexShrink:0}}>{match.aProb}%</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 8px",background:bWin?t.dark?"rgba(201,168,76,0.1)":"rgba(160,120,30,0.07)":"transparent"}}>
          <Flag id={match.b.id} size={13} style={{borderRadius:2,flexShrink:0,opacity:aWin?0.4:1}}/>
          <span style={{flex:1,fontSize:11,fontWeight:bWin?700:400,color:bWin?t.gold:aWin?t.textDim:t.text,textDecoration:aWin?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{match.b.name}</span>
          <span style={{fontFamily:"monospace",fontSize:10,color:bWin?t.gold:t.textDim,flexShrink:0}}>{match.bProb}%</span>
        </div>
        {match.score&&(
          <div style={{display:"flex",justifyContent:"center",padding:"2px 0",background:t.dark?"rgba(201,168,76,0.06)":"rgba(160,120,30,0.05)",borderTop:`1px solid ${t.border}`}}>
            <span style={{fontFamily:"monospace",fontSize:10,fontWeight:700,color:t.gold}}>{match.score}</span>
          </div>
        )}
      </div>
    );
  }

  // Draw connector SVG between rounds — left side (right-facing connectors)
  function ConnL({n, matchH, gapV, padTop}){
    const totalH=(matchH+gapV)*n-gapV;
    const scoreH=match=>match?14:0; // score bar height
    const h=totalH+padTop*2;
    return(
      <svg width={24} height={Math.max(h,1)} style={{flexShrink:0,overflow:"visible",alignSelf:"flex-start"}}>
        {Array.from({length:n/2},(_,i)=>{
          const yTop=padTop+i*2*(matchH+gapV)+matchH/2+7;
          const yBot=padTop+(i*2+1)*(matchH+gapV)+matchH/2+7;
          const yMid=(yTop+yBot)/2;
          return[
            <line key={`a${i}`} x1={0} y1={yTop} x2={12} y2={yTop} stroke={c_line} strokeWidth={1.5}/>,
            <line key={`b${i}`} x1={0} y1={yBot} x2={12} y2={yBot} stroke={c_line} strokeWidth={1.5}/>,
            <line key={`c${i}`} x1={12} y1={yTop} x2={12} y2={yBot} stroke={c_line} strokeWidth={1.5}/>,
            <line key={`d${i}`} x1={12} y1={yMid} x2={24} y2={yMid} stroke={c_line} strokeWidth={1.5}/>,
          ];
        })}
      </svg>
    );
  }

  // Right side (left-facing connectors)
  function ConnR({n, matchH, gapV, padTop}){
    const totalH=(matchH+gapV)*n-gapV;
    const h=totalH+padTop*2;
    return(
      <svg width={24} height={Math.max(h,1)} style={{flexShrink:0,overflow:"visible",alignSelf:"flex-start"}}>
        {Array.from({length:n/2},(_,i)=>{
          const yTop=padTop+i*2*(matchH+gapV)+matchH/2+7;
          const yBot=padTop+(i*2+1)*(matchH+gapV)+matchH/2+7;
          const yMid=(yTop+yBot)/2;
          return[
            <line key={`a${i}`} x1={24} y1={yTop} x2={12} y2={yTop} stroke={c_line} strokeWidth={1.5}/>,
            <line key={`b${i}`} x1={24} y1={yBot} x2={12} y2={yBot} stroke={c_line} strokeWidth={1.5}/>,
            <line key={`c${i}`} x1={12} y1={yTop} x2={12} y2={yBot} stroke={c_line} strokeWidth={1.5}/>,
            <line key={`d${i}`} x1={12} y1={yMid} x2={0}  y2={yMid} stroke={c_line} strokeWidth={1.5}/>,
          ];
        })}
      </svg>
    );
  }

  function RoundCol({matches, ids, padTop}){
    const gapV=GAP;
    return(
      <div style={{display:"flex",flexDirection:"column",gap:gapV,paddingTop:padTop||0}}>
        {matches.map((m,i)=><MatchBox key={i} match={m} id={ids?ids[i]:`${m?.a?.id||"x"}-${m?.b?.id||"y"}-${i}`}/>)}
      </div>
    );
  }

  // Calculate padding so each successive round's matches center on their pair from the previous round
  const pad=(round)=>round===0?0:(GAP+MATCH_H+14)*Math.pow(2,round-1)-MATCH_H/2-7;

  const roundLabel=(label)=>(
    <div style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.15em",color:t.gold,textTransform:"uppercase",textAlign:"center",padding:"3px 0",borderBottom:`1px solid ${t.borderGold}`,marginBottom:6}}>{label}</div>
  );

  return(
    <div>
      <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.2em",color:t.gold,textTransform:"uppercase",marginBottom:4}}>Predicted Full Bracket — Round of 32 to Final</div>
      <div style={{fontSize:13,color:t.textMuted,marginBottom:16,lineHeight:1.5,maxWidth:720}}>
        Balanced draw: 1st-place teams alternated left/right. All 5 rounds predicted with scorelines and analysis. Click any matchup to expand. Predicted winner: <strong style={{color:t.gold}}>France 🇫🇷</strong>
      </div>

      {/* Round header labels */}
      <div style={{display:"flex",gap:0,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${t.borderGold}`}}>
        {[["R32",188],["",24],["R16",188],["",24],["QF",188],["",24],["SF",188],["",32],["FINAL",190],["",32],["SF",188],["",24],["QF",188],["",24],["R16",188],["",24],["R32",188]].map(([l,w],i)=>(
          <div key={i} style={{width:w,flexShrink:0,textAlign:"center",fontFamily:"monospace",fontSize:8,letterSpacing:"0.12em",color:l?t.gold:t.textDim,textTransform:"uppercase"}}>{l}</div>
        ))}
      </div>

      <div style={{overflowX:"auto",paddingBottom:16}}>
        <div style={{display:"flex",alignItems:"flex-start",minWidth:"max-content",gap:0}}>

          {/* LEFT HALF — R32→R16→QF→SF, progressing rightward */}
          <RoundCol matches={leftR32} padTop={0}/>
          <ConnL n={8} matchH={MATCH_H+14} gapV={GAP} padTop={0}/>
          <RoundCol matches={leftR16} padTop={pad(1)}/>
          <ConnL n={4} matchH={MATCH_H+14} gapV={GAP} padTop={pad(1)}/>
          <RoundCol matches={leftQF}  padTop={pad(2)}/>
          <ConnL n={2} matchH={MATCH_H+14} gapV={GAP} padTop={pad(2)}/>
          <RoundCol matches={leftSF}  padTop={pad(3)}/>
          {/* SF→Final connector */}
          <svg width={32} height={(MATCH_H+14)*16+GAP*15} style={{flexShrink:0,overflow:"visible"}}>
            <line x1={0} y1={pad(3)+(MATCH_H+14)/2} x2={32} y2={(MATCH_H+14)*8+GAP*7} stroke={c_line} strokeWidth={1.5}/>
          </svg>

          {/* FINAL — center */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minWidth:190,paddingTop:pad(3)+(MATCH_H+14)/2-MATCH_H/2-7}}>
            <div style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.15em",color:t.gold,textTransform:"uppercase",marginBottom:6,whiteSpace:"nowrap",textAlign:"center"}}>⚽ FINAL · Jul 19<br/>MetLife Stadium</div>
            <MatchBox match={final} id="final"/>
            {final&&(
              <div style={{marginTop:8,width:188,padding:"6px 10px",background:t.dark?"rgba(201,168,76,0.08)":"rgba(160,120,30,0.06)",border:`1px solid ${t.borderGold}`,borderRadius:4,textAlign:"center"}}>
                <div style={{fontSize:9,fontFamily:"monospace",color:t.gold,marginBottom:3}}>🏆 CHAMPION</div>
                <div style={{fontSize:12,fontWeight:700,color:t.text}}>{final.winner}</div>
                <div style={{fontSize:9,color:t.textMuted,marginTop:4}}>🥅 {final.goldenBoot}</div>
                <div style={{fontSize:9,color:t.textMuted}}>⭐ {final.playerOfTournament}</div>
              </div>
            )}
          </div>

          {/* SF→Final connector right */}
          <svg width={32} height={(MATCH_H+14)*16+GAP*15} style={{flexShrink:0,overflow:"visible"}}>
            <line x1={32} y1={pad(3)+(MATCH_H+14)/2} x2={0} y2={(MATCH_H+14)*8+GAP*7} stroke={c_line} strokeWidth={1.5}/>
          </svg>

          {/* RIGHT HALF — SF←QF←R16←R32, reading right-to-left */}
          <RoundCol matches={rightSF}  padTop={pad(3)}/>
          <ConnR n={2} matchH={MATCH_H+14} gapV={GAP} padTop={pad(3)}/>
          <RoundCol matches={rightQF}  padTop={pad(2)}/>
          <ConnR n={4} matchH={MATCH_H+14} gapV={GAP} padTop={pad(2)}/>
          <RoundCol matches={rightR16} padTop={pad(1)}/>
          <ConnR n={8} matchH={MATCH_H+14} gapV={GAP} padTop={pad(1)}/>
          <RoundCol matches={rightR32} padTop={0}/>
        </div>
      </div>

      {/* Expanded match detail */}
      {expandedId&&(()=>{
        const allMatches=[...bp.r32,...bp.r16,...bp.qf,...bp.sf,...bp.final];
        const match=allMatches.find(m=>`${m?.a?.id||"x"}-${m?.b?.id||"y"}`===expandedId.replace(/-\d+$/,"")||expandedId==="final");
        const m=expandedId==="final"?final:match;
        if(!m) return null;
        return(
          <div style={{marginTop:12,padding:"14px 18px",background:t.dark?"rgba(0,0,0,0.3)":"rgba(0,0,0,0.03)",border:`1px solid ${t.borderGold}`,borderRadius:4}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Flag id={m.a.id} size={20} style={{borderRadius:2}}/>
                <span style={{fontSize:14,fontWeight:700,color:t.gold}}>{m.a.name}</span>
                <span style={{fontFamily:"monospace",fontSize:16,fontWeight:700,color:t.text,margin:"0 8px"}}>{m.score}</span>
                <span style={{fontSize:14,fontWeight:700,color:t.textMuted}}>{m.b.name}</span>
                <Flag id={m.b.id} size={20} style={{borderRadius:2}}/>
              </div>
              <button onClick={()=>setExpandedId(null)} style={{background:"none",border:"none",color:t.textMuted,fontSize:16,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div><div style={{fontSize:9,fontFamily:"monospace",color:t.green,marginBottom:4}}>{m.a.name.toUpperCase()} — FORM</div><div style={{fontSize:12,color:t.textMuted,lineHeight:1.5}}>{m.aS}</div></div>
              <div><div style={{fontSize:9,fontFamily:"monospace",color:t.red,marginBottom:4}}>{m.b.name.toUpperCase()} — FORM</div><div style={{fontSize:12,color:t.textMuted,lineHeight:1.5}}>{m.bS}</div></div>
            </div>
            <div style={{padding:"10px 14px",background:t.dark?"rgba(201,168,76,0.07)":"rgba(160,120,30,0.05)",border:`1px solid ${t.borderGold}`,borderRadius:3,fontSize:12,color:t.textMuted,lineHeight:1.65}}>
              <span style={{color:t.gold,fontFamily:"monospace",fontSize:9,letterSpacing:"0.1em"}}>VERDICT: </span>{m.rat}
            </div>
            {m.playerOfTournament&&(
              <div style={{marginTop:10,display:"flex",gap:20,flexWrap:"wrap"}}>
                <div><span style={{fontSize:10,color:t.gold,fontFamily:"monospace"}}>🏆 CHAMPION: </span><span style={{fontSize:12,color:t.text,fontWeight:600}}>{m.winner}</span></div>
                <div><span style={{fontSize:10,color:t.gold,fontFamily:"monospace"}}>🥅 GOLDEN BOOT: </span><span style={{fontSize:12,color:t.text}}>{m.goldenBoot}</span></div>
                <div><span style={{fontSize:10,color:t.gold,fontFamily:"monospace"}}>⭐ BEST PLAYER: </span><span style={{fontSize:12,color:t.text}}>{m.playerOfTournament}</span></div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Full matchup list — all 5 rounds */}
      <div style={{marginTop:36}}>
        {[
          {label:"Round of 32",matches:bp.r32},
          {label:"Round of 16",matches:bp.r16},
          {label:"Quarter-Finals",matches:bp.qf},
          {label:"Semi-Finals",matches:bp.sf},
          {label:"Final — Jul 19, MetLife Stadium",matches:bp.final},
        ].map((round,ri)=>(
          <div key={ri} style={{marginBottom:28}}>
            <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.25em",color:t.gold,textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${t.borderGold}`}}>{round.label}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:8}}>
              {round.matches.map((m,mi)=>{
                const id=`${m.a.id}-${m.b.id}-${mi}`;
                const aWin=m.winner===m.a.name, bWin=m.winner===m.b.name;
                const open=expandedId===id;
                return(
                  <div key={mi} style={{background:t.surface,border:`1px solid ${open?t.gold:t.border}`,borderRadius:4,overflow:"hidden",cursor:"pointer"}} onClick={()=>setExpandedId(open?null:id)}>
                    <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:aWin?t.dark?"rgba(201,168,76,0.1)":"rgba(160,120,30,0.07)":"transparent",borderBottom:`1px solid ${t.border}`}}>
                      <Flag id={m.a.id} size={14} style={{borderRadius:2,flexShrink:0,opacity:bWin?0.4:1}}/>
                      <span style={{flex:1,fontSize:12,fontWeight:aWin?700:400,color:aWin?t.gold:bWin?t.textDim:t.text,textDecoration:bWin?"line-through":"none"}}>{m.a.name}</span>
                      <span style={{fontFamily:"monospace",fontSize:11,color:aWin?t.gold:t.textDim}}>{m.aProb}%</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:bWin?t.dark?"rgba(201,168,76,0.1)":"rgba(160,120,30,0.07)":"transparent"}}>
                      <Flag id={m.b.id} size={14} style={{borderRadius:2,flexShrink:0,opacity:aWin?0.4:1}}/>
                      <span style={{flex:1,fontSize:12,fontWeight:bWin?700:400,color:bWin?t.gold:aWin?t.textDim:t.text,textDecoration:aWin?"line-through":"none"}}>{m.b.name}</span>
                      <span style={{fontFamily:"monospace",fontSize:11,color:bWin?t.gold:t.textDim}}>{m.bProb}%</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 10px",background:t.dark?"rgba(201,168,76,0.06)":"rgba(160,120,30,0.04)",borderTop:`1px solid ${t.border}`}}>
                      <span style={{fontFamily:"monospace",fontSize:10,fontWeight:700,color:t.gold}}>{m.score}</span>
                      <span style={{fontSize:9,color:t.textDim,fontFamily:"monospace"}}>{open?"▲ hide":"▼ analysis"}</span>
                    </div>
                    {open&&(
                      <div style={{padding:"10px",background:t.dark?"rgba(0,0,0,0.25)":"rgba(0,0,0,0.03)",borderTop:`1px solid ${t.border}`}}>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                          <div><div style={{fontSize:9,fontFamily:"monospace",color:t.green,marginBottom:3}}>{m.a.name.toUpperCase()}</div><div style={{fontSize:11,color:t.textMuted,lineHeight:1.4}}>{m.aS}</div></div>
                          <div><div style={{fontSize:9,fontFamily:"monospace",color:t.red,marginBottom:3}}>{m.b.name.toUpperCase()}</div><div style={{fontSize:11,color:t.textMuted,lineHeight:1.4}}>{m.bS}</div></div>
                        </div>
                        <div style={{padding:"7px 10px",background:t.dark?"rgba(201,168,76,0.07)":"rgba(160,120,30,0.05)",borderRadius:3,fontSize:11,color:t.textMuted,lineHeight:1.55}}>
                          <span style={{color:t.gold,fontFamily:"monospace",fontSize:9}}>VERDICT: </span>{m.rat}
                        </div>
                        {m.playerOfTournament&&(
                          <div style={{marginTop:8,display:"flex",gap:16,flexWrap:"wrap"}}>
                            <div style={{fontSize:10,color:t.gold}}>🏆 {m.winner}</div>
                            <div style={{fontSize:10,color:t.textMuted}}>🥅 {m.goldenBoot}</div>
                            <div style={{fontSize:10,color:t.textMuted}}>⭐ {m.playerOfTournament}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GROUP MATCH CARD ──────────────────────────────────────────────────────────
function GroupMatchCard({match, groupName}){
  const t=useTheme();
  const [open,setOpen]=useState(false);
  return(
    <div style={{background:t.surface,border:`1px solid ${open?t.gold:t.border}`,borderRadius:4,overflow:"hidden",cursor:"pointer"}} onClick={()=>setOpen(!open)}>
      <div style={{padding:"8px 12px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:10,fontFamily:"monospace",color:t.textMuted}}>{match.date} · Group {groupName}</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {match.score&&<span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:t.gold,background:t.dark?"rgba(201,168,76,0.12)":"rgba(160,120,30,0.1)",padding:"1px 8px",borderRadius:2}}>{match.score[0]}–{match.score[1]}</span>}
            <span style={{fontSize:10,fontFamily:"monospace",color:t.textMuted}}>{open?"▲":"▼"}</span>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 80px 1fr",alignItems:"center",gap:8}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:13,fontWeight:600,color:t.text}}>{match.a.name}</div>
            <div style={{fontSize:14,fontWeight:700,color:t.gold,fontFamily:"monospace"}}>{match.a.prob}%</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:10,fontFamily:"monospace",color:t.textMuted,marginBottom:2}}>DRAW</div>
            <div style={{fontSize:12,fontWeight:600,color:t.textMuted,fontFamily:"monospace"}}>{match.draw}%</div>
          </div>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:13,fontWeight:600,color:t.text}}>{match.b.name}</div>
            <div style={{fontSize:14,fontWeight:700,color:t.blue,fontFamily:"monospace"}}>{match.b.prob}%</div>
          </div>
        </div>
        <div style={{display:"flex",height:4,borderRadius:2,overflow:"hidden",marginTop:6,gap:1}}>
          <div style={{flex:match.a.prob,background:t.gold}}/>
          <div style={{flex:match.draw,background:t.dark?"rgba(142,155,175,0.4)":"rgba(90,100,120,0.2)"}}/>
          <div style={{flex:match.b.prob,background:t.blue}}/>
        </div>
      </div>
      {open&&(
        <div style={{borderTop:`1px solid ${t.border}`,padding:"12px",background:t.dark?"rgba(0,0,0,0.25)":"rgba(0,0,0,0.02)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
            <div><div style={{fontSize:9,fontFamily:"monospace",color:t.gold,letterSpacing:"0.12em",marginBottom:4}}>PREDICTED XI — {match.a.name.toUpperCase()}</div><div style={{fontSize:11,color:t.textMuted,lineHeight:1.5}}>{match.lineup_a}</div></div>
            <div><div style={{fontSize:9,fontFamily:"monospace",color:t.blue,letterSpacing:"0.12em",marginBottom:4}}>PREDICTED XI — {match.b.name.toUpperCase()}</div><div style={{fontSize:11,color:t.textMuted,lineHeight:1.5}}>{match.lineup_b}</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
            <div style={{padding:"6px 10px",background:t.dark?"rgba(243,156,18,0.06)":"rgba(243,156,18,0.05)",border:`1px solid ${t.dark?"rgba(243,156,18,0.15)":"rgba(243,156,18,0.2)"}`,borderRadius:3}}>
              <div style={{fontSize:9,fontFamily:"monospace",color:"#f39c12",marginBottom:3}}>KEY SUBS — {match.a.name.toUpperCase()}</div>
              <div style={{fontSize:11,color:t.textMuted,lineHeight:1.5}}>{match.key_subs_a}</div>
            </div>
            <div style={{padding:"6px 10px",background:t.dark?"rgba(243,156,18,0.06)":"rgba(243,156,18,0.05)",border:`1px solid ${t.dark?"rgba(243,156,18,0.15)":"rgba(243,156,18,0.2)"}`,borderRadius:3}}>
              <div style={{fontSize:9,fontFamily:"monospace",color:"#f39c12",marginBottom:3}}>KEY SUBS — {match.b.name.toUpperCase()}</div>
              <div style={{fontSize:11,color:t.textMuted,lineHeight:1.5}}>{match.key_subs_b}</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
            <div style={{padding:"6px 10px",background:t.dark?"rgba(155,89,182,0.06)":"rgba(124,58,237,0.04)",border:`1px solid ${t.dark?"rgba(155,89,182,0.15)":"rgba(124,58,237,0.12)"}`,borderRadius:3}}>
              <div style={{fontSize:9,fontFamily:"monospace",color:"#9b59b6",marginBottom:3}}>MORALE — {match.a.name.toUpperCase()}</div>
              <div style={{fontSize:11,color:t.textMuted,lineHeight:1.5}}>{match.morale_a}</div>
            </div>
            <div style={{padding:"6px 10px",background:t.dark?"rgba(155,89,182,0.06)":"rgba(124,58,237,0.04)",border:`1px solid ${t.dark?"rgba(155,89,182,0.15)":"rgba(124,58,237,0.12)"}`,borderRadius:3}}>
              <div style={{fontSize:9,fontFamily:"monospace",color:"#9b59b6",marginBottom:3}}>MORALE — {match.b.name.toUpperCase()}</div>
              <div style={{fontSize:11,color:t.textMuted,lineHeight:1.5}}>{match.morale_b}</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><div style={{fontSize:9,fontFamily:"monospace",color:t.green,marginBottom:3}}>{match.a.name.toUpperCase()} STRENGTHS</div><div style={{fontSize:11,color:t.textMuted,lineHeight:1.4}}>{match.aS}</div></div>
            <div><div style={{fontSize:9,fontFamily:"monospace",color:t.red,marginBottom:3}}>{match.b.name.toUpperCase()} STRENGTHS</div><div style={{fontSize:11,color:t.textMuted,lineHeight:1.4}}>{match.bS}</div></div>
          </div>
          <div style={{padding:"8px 12px",background:t.dark?"rgba(201,168,76,0.07)":"rgba(160,120,30,0.05)",border:`1px solid ${t.borderGold}`,borderRadius:3,fontSize:11,color:t.textMuted,lineHeight:1.5}}>
            <span style={{color:t.gold,fontFamily:"monospace",fontSize:9,letterSpacing:"0.1em"}}>VERDICT: </span>{match.rat}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PREDICTIONS TAB ───────────────────────────────────────────────────────────
function PredictionsTab(){
  const t=useTheme();
  const [section,setSection]=useState("group");
  const [activeGroup,setActiveGroup]=useState("A");
  const groups=Object.keys(GROUP_MATCH_PREDICTIONS);
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:20,borderBottom:`1px solid ${t.border}`,paddingBottom:12}}>
        {[["group","Group Stage Matches"],["knockout","Knockout Bracket"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSection(k)} style={{background:section===k?t.dark?"rgba(201,168,76,0.15)":"rgba(160,120,30,0.1)":t.inputBg,border:`1px solid ${section===k?t.gold:t.border}`,borderRadius:3,padding:"6px 16px",fontSize:11,fontFamily:"monospace",letterSpacing:"0.1em",color:section===k?t.gold:t.textMuted,cursor:"pointer",textTransform:"uppercase"}}>{l}</button>
        ))}
      </div>
      {section==="group"&&(
        <div>
          <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.2em",color:t.gold,textTransform:"uppercase",marginBottom:6}}>Group Stage — All 72 Matches Predicted</div>
          <div style={{fontSize:13,color:t.textMuted,marginBottom:16,maxWidth:700}}>Each match includes predicted score, lineups, key substitutions, team morale, and an analytical verdict. Win probabilities update when confirmed lineups are available.</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:16}}>
            {groups.map(g=>(
              <button key={g} onClick={()=>setActiveGroup(g)} style={{background:activeGroup===g?t.dark?"rgba(201,168,76,0.2)":"rgba(160,120,30,0.12)":t.inputBg,border:`1px solid ${activeGroup===g?t.gold:t.border}`,borderRadius:3,padding:"4px 12px",fontSize:11,fontFamily:"monospace",color:activeGroup===g?t.gold:t.textMuted,cursor:"pointer"}}>Group {g}</button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {(GROUP_MATCH_PREDICTIONS[activeGroup]||[]).map((match,i)=>(
              <GroupMatchCard key={i} match={match} groupName={activeGroup}/>
            ))}
          </div>
        </div>
      )}
      {section==="knockout"&&<TwoSidedBracket/>}
    </div>
  );
}

// ── GROUPS TAB ────────────────────────────────────────────────────────────────
function GroupsTab({groups}){
  const t=useTheme();
  return(
    <div>
      <div style={{marginBottom:20,fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:t.gold,textTransform:"uppercase"}}>Group Stage Tables</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
        {Object.values(groups).map(group=>{
          const sorted=[...group.teams].sort((a,b)=>b.pts!==a.pts?b.pts-a.pts:(b.gf-b.ga)-(a.gf-a.ga));
          return(
            <div key={group.name} style={{background:t.surface2,border:`1px solid ${t.borderGold}`,borderRadius:6,overflow:"hidden"}}>
              <div style={{background:t.dark?"rgba(201,168,76,0.1)":"rgba(160,120,30,0.07)",borderBottom:`1px solid ${t.borderGold}`,padding:"8px 14px"}}>
                <span style={{fontFamily:"Impact,sans-serif",fontSize:26,color:t.gold}}>GROUP {group.name}</span>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{borderBottom:`1px solid ${t.border}`}}>{["Team","W","D","L","GD","Pts"].map(h=><th key={h} style={{padding:"6px 8px",fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:t.gold+"88",textAlign:h==="Team"?"left":"center",fontWeight:400}}>{h}</th>)}</tr></thead>
                <tbody>
                  {sorted.map((t_,i)=>(
                    <tr key={t_.id} style={{borderBottom:`1px solid ${t.border}`,background:i===0?t.dark?"rgba(26,94,58,0.15)":"rgba(22,163,74,0.07)":i===1?t.dark?"rgba(26,58,107,0.12)":"rgba(37,99,235,0.06)":"transparent"}}>
                      <td style={{padding:"9px 8px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{width:18,height:18,borderRadius:"50%",background:i===0?t.gold:i===1?t.blue:t.dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.08)",color:i<2?"#fff":t.textMuted,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>
                          <span style={{fontSize:16}}>{t_.flag}</span>
                          <span style={{color:t.text,fontWeight:i<2?600:400}}>{t_.name}</span>
                        </div>
                      </td>
                      {[t_.w,t_.d,t_.l,t_.gf-t_.ga,t_.pts].map((v,vi)=>(
                        <td key={vi} style={{textAlign:"center",padding:"9px 8px",color:vi===4?t.gold:vi===3?(v>0?t.green:v<0?t.red:t.text):t.text,fontFamily:vi===4?"monospace":"inherit",fontWeight:vi===4?700:400}}>{vi===3&&v>0?`+${v}`:v}</td>
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

// ── PLAYERS TAB ───────────────────────────────────────────────────────────────
function PlayersTab({players}){
  const t=useTheme();
  const [filterPos,setFilterPos]=useState("ALL");
  const [sortKey,setSortKey]=useState("rank");
  const withScores=players.map(p=>({...p,fantasy:calcFantasyScore(p)}));
  const filtered=filterPos==="ALL"?withScores:withScores.filter(p=>p.pos===filterPos);
  const sorted=[...filtered].sort((a,b)=>sortKey==="rank"?a.rank-b.rank:(b[sortKey]??0)-(a[sortKey]??0));
  return(
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:t.gold,textTransform:"uppercase",marginBottom:8}}>Top 50 World Cup 2026 Players</div>
        <div style={{padding:"12px 16px",background:t.surface2,border:`1px solid ${t.border}`,borderRadius:4,fontSize:13,color:t.textMuted,lineHeight:1.6,maxWidth:760}}>
          The <strong style={{color:t.text}}>top 50 players at the 2026 World Cup</strong>. Statistics update as the tournament progresses from June 11.
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16,alignItems:"center"}}>
        {["ALL","FWD","MID","DEF","GK"].map(pos=>(
          <button key={pos} onClick={()=>setFilterPos(pos)} style={{background:filterPos===pos?(POS_COLORS[pos]||t.gold):t.inputBg,color:filterPos===pos?"#0A0A0F":t.textMuted,border:`1px solid ${filterPos===pos?(POS_COLORS[pos]||t.gold):t.border}`,borderRadius:3,padding:"5px 12px",fontSize:11,fontFamily:"monospace",letterSpacing:"0.1em",cursor:"pointer",fontWeight:600}}>{pos}</button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,fontFamily:"monospace",color:t.textMuted}}>SORT BY</span>
          <select value={sortKey} onChange={e=>setSortKey(e.target.value)} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:3,padding:"5px 10px",color:t.text,fontSize:12,fontFamily:"monospace"}}>
            {SORT_OPTIONS.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:780}}>
          <thead>
            <tr style={{borderBottom:`2px solid ${t.borderGold}`}}>
              {[{k:"rank",l:"#"},{k:"name",l:"Player"},{k:"fantasy",l:"Rating"},{k:"goals",l:"G"},{k:"assists",l:"A"},{k:"apps",l:"Apps"},{k:"cleanSheets",l:"CS"},{k:"interceptions",l:"Int"},{k:"saves",l:"Sv"},{k:"penaltySaves",l:"PSv"},{k:"yellowCards",l:"YC"},{k:"redCards",l:"RC"}].map(col=>(
                <th key={col.k} style={{padding:"8px 8px",fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:sortKey===col.k?t.text:t.gold,textAlign:col.k==="name"?"left":"center",fontWeight:sortKey===col.k?700:400,cursor:col.k==="name"?undefined:"pointer",whiteSpace:"nowrap"}} onClick={()=>col.k!=="name"&&setSortKey(col.k)}>{col.l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p,i)=>(
              <tr key={p.rank} style={{borderBottom:`1px solid ${t.border}`,background:i<3?t.dark?"rgba(201,168,76,0.04)":"rgba(160,120,30,0.03)":"transparent"}}
                onMouseEnter={e=>e.currentTarget.style.background=t.cardHover}
                onMouseLeave={e=>e.currentTarget.style.background=i<3?t.dark?"rgba(201,168,76,0.04)":"rgba(160,120,30,0.03)":"transparent"}>
                <td style={{padding:"9px 8px",fontFamily:"monospace",fontSize:12,color:t.textMuted,textAlign:"center"}}>{p.rank}</td>
                <td style={{padding:"9px 8px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <Flag id={p.natId} size={20} style={{borderRadius:2}}/>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:t.text}}>{p.name}</div>
                      <div style={{display:"flex",gap:5,marginTop:2,alignItems:"center"}}>
                        <span style={{fontSize:10,fontFamily:"monospace",padding:"1px 5px",borderRadius:2,background:POS_COLORS[p.pos]+"22",color:POS_COLORS[p.pos],border:`1px solid ${POS_COLORS[p.pos]}44`}}>{p.pos}</span>
                        <span style={{fontSize:11,color:t.textMuted}}>{p.club}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{padding:"9px 8px",textAlign:"center"}}><span style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:p.fantasy>0?"#9b59b6":t.textDim}}>{p.fantasy>0?p.fantasy:"—"}</span></td>
                <td style={{padding:"9px 8px",textAlign:"center",fontFamily:"monospace",fontSize:13,color:p.goals>0?"#e74c3c":t.textDim,fontWeight:p.goals>0?700:400}}>{p.goals>0?p.goals:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",fontFamily:"monospace",fontSize:13,color:p.assists>0?t.green:t.textDim,fontWeight:p.assists>0?700:400}}>{p.assists>0?p.assists:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:t.text}}>{p.apps>0?p.apps:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:(p.pos==="DEF"||p.pos==="GK")&&p.cleanSheets>0?t.blue:t.textDim}}>{(p.pos==="DEF"||p.pos==="GK")&&p.cleanSheets>0?p.cleanSheets:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:p.interceptions>0?t.text:t.textDim}}>{p.interceptions>0?p.interceptions:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:p.pos==="GK"&&p.saves>0?t.gold:t.textDim}}>{p.pos==="GK"&&p.saves>0?p.saves:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:p.pos==="GK"&&p.penaltySaves>0?t.gold:t.textDim}}>{p.pos==="GK"&&p.penaltySaves>0?p.penaltySaves:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:p.yellowCards>0?"#f39c12":t.textDim}}>{p.yellowCards>0?p.yellowCards:"—"}</td>
                <td style={{padding:"9px 8px",textAlign:"center",color:p.redCards>0?t.red:t.textDim}}>{p.redCards>0?p.redCards:"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{marginTop:40}}>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:t.gold,textTransform:"uppercase",marginBottom:6}}>Beyond the Top 50 — Key Influencers</div>
        <div style={{fontSize:13,color:t.textMuted,marginBottom:20,maxWidth:700}}>Players outside the top 50 who hold disproportionate tactical importance for their teams.</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
          {INFLUENTIAL_NON_TOP50.map((p,i)=>(
            <div key={i} style={{background:t.surface2,border:`1px solid ${t.border}`,borderRadius:5,padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <Flag id={p.natId} size={22} style={{borderRadius:2}}/>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:t.text}}>{p.name}</div>
                  <div style={{display:"flex",gap:6,marginTop:2,alignItems:"center"}}>
                    <span style={{fontSize:10,fontFamily:"monospace",padding:"1px 5px",borderRadius:2,background:POS_COLORS[p.pos]+"22",color:POS_COLORS[p.pos],border:`1px solid ${POS_COLORS[p.pos]}44`}}>{p.pos}</span>
                    <span style={{fontSize:11,color:t.textMuted}}>{p.club}</span>
                  </div>
                </div>
              </div>
              <div style={{fontSize:13,color:t.textMuted,lineHeight:1.65}}>{p.insight}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ANALYSIS TAB ──────────────────────────────────────────────────────────────
const ANALYSIS_REPORTS = [
  { id:"fra-attack",  team:"France",    teamId:"FRA", badge:"TACTICAL ANALYSIS", badgeColor:"#C9A84C", title:"The Most Dangerous Attack at the Tournament", subtitle:"How France's four-man attacking rotation rewrites the playbook", date:"Jun 9, 2026",
    body:`France's attacking structure under Deschamps has reached a new level of sophistication. With Dembélé (Ballon d'Or 2025), Olise, Mbappé, and Doué all capable of occupying any of the three front positions, Deschamps has a rotation problem no opponent can solve: no matter which three he picks, the bench contains the fourth — a player who would start for almost any other nation.\n\nThe tactical key is Olise's role. Nominally a right winger, Olise consistently drifts infield onto his stronger left foot, creating a false-wide structure that pulls opposition left-backs out of position. When Olise cuts inside, Mbappé's movement pins the left-back deep, Dembélé's width stretches the right-back, and Doué's central penetration runs exploit the gap Olise vacates.\n\nGriezmann's declining physical pace is masked by positioning: he occupies the half-spaces between lines that French wingers can find in one-touch combinations, acting as the creative relay between midfield and attack. The system's intelligence — rather than its pace — is what makes it the most difficult structure to defend at this tournament.`,
    insight:"The French system's strength is not who starts, but that no lineup change reduces the quality by more than a marginal amount.",
    heatNote:"Olise's heat map shows a distinctive diagonal channel from right to central — mirrored by Mbappé moving left-to-right across the same space." },
  { id:"esp-possession", team:"Spain", teamId:"ESP", badge:"TACTICAL ANALYSIS", badgeColor:"#C9A84C", title:"Spain's Positional Play — The Tournament Standard", subtitle:"Why no other team can replicate what Rodri and Pedri do together", date:"Jun 9, 2026",
    body:`Spain's possession system under De la Fuente has become the most technically complete pressing-and-building structure in world football. The Rodri-Pedri pivot is the engine: Rodri's 91% pass completion rate under pressure and Pedri's 12.3 progressive carries per 90 minutes at Barcelona place them as the only midfield pairing capable of both suppressing counter-press and initiating attacks simultaneously.\n\nWhat distinguishes Spain from possession teams of previous generations is the verticality built into the system. Under previous Spain managers, possession was often lateral and predictable. De la Fuente has inserted triggers — specific body positions and run timings from Yamal and Olmo — that convert holding patterns into penetrative sequences in 2-3 touches.\n\nOyarzabal's movement is Spain's most underappreciated tactical element. His diagonal runs from the left into the box exploit the space Pedri creates by drawing the opposition double-press. In every final Oyarzabal has played — for club and country — he has scored.`,
    insight:"Spain's pressing trap is triggered when Pedri receives in front of the opposition midfield — at that moment, three Spain players simultaneously make runs that require the opponent to make 2 defensive decisions at once.",
    heatNote:"Pedri's central zone coverage is the widest of any midfielder at the tournament — he operates across a 30-metre horizontal corridor." },
  { id:"mar-defense", team:"Morocco", teamId:"MAR", badge:"TACTICAL ANALYSIS", badgeColor:"#2ecc71", title:"Morocco's Defensive Fortress — 21 Unbeaten", subtitle:"Regragui's 5-4-1 block and why it beats systems, not just teams", date:"Jun 9, 2026",
    body:`Morocco's 21-match unbeaten run is not an accident. Regragui has constructed the most coherent defensive system at the 2026 World Cup — one that neutralised Cristiano Ronaldo in Qatar 2022 and has since added the attacking depth to make it a genuine outright threat.\n\nThe defensive foundation is a fluid 5-4-1 that collapses to a 5-4-1 without the ball. Amrabat's positioning between the lines is the system's key mechanism: when the opposition attack builds through the middle, Amrabat's press triggers a coordinated shift from the four behind him, forcing the ball wide where Hakimi or Mazraoui — elite attacking full-backs — are disciplined enough to defend first.\n\nThe tournament question for Morocco is not defensive quality — it's whether Ziyech, Khannouss, and Saibari can produce enough in attack to win knockout matches against top-8 opposition.`,
    insight:"Morocco concede on average 0.4 goals per match in their last 21 unbeaten — the lowest rate of any team at the tournament.",
    heatNote:"Amrabat's interception heat map clusters in a central corridor between 20-40 metres from goal — precisely the zone opposing teams use to build before penetrating." },
  { id:"arg-chemistry", team:"Argentina", teamId:"ARG", badge:"TEAM PROFILE", badgeColor:"#8bb8f0", title:"Argentina's 9.2 Chemistry — The System That Won the World Cup", subtitle:"Seven years of Scaloni building the most cohesive squad at the tournament", date:"Jun 9, 2026",
    body:`No team in the world comes close to Argentina's 9.2/10 Chemistry Score — and no single number better captures why they are such a dangerous opponent despite individual quality gaps versus France and Spain.\n\nScaloni's seven-year tenure means the Mac Allister–Enzo Fernández–De Paul midfield trio has now played more competitive minutes together than any other international midfield combination. Their understanding — positional coverage, pressing triggers, rest-defence — operates at an automaticity that no other team at the tournament can match.\n\nThe system's vulnerability is Messi. At 38, and in the final performance window of his extraordinary career, Messi's physical availability across 7-8 matches is the central uncertainty of Argentina's campaign. In the 2026 qualifiers, Messi was substituted before 80 minutes in 60% of matches.`,
    insight:"In the 14 competitive matches Scaloni's Argentina have won from a losing position, Mac Allister or Enzo Fernández has been the assist provider in the turning-point goal in 9 of them.",
    heatNote:"Messi's heat map in 2026 qualifiers shows a significant shift — fewer wide-right touchline appearances, more central half-space positioning to reduce physical demands." },
];

function AnalysisTab(){
  const t=useTheme();
  const [selected,setSelected]=useState(ANALYSIS_REPORTS[0].id);
  const report=ANALYSIS_REPORTS.find(r=>r.id===selected)||ANALYSIS_REPORTS[0];
  return(
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:t.gold,textTransform:"uppercase",marginBottom:6}}>Tactical Analysis Reports</div>
        <div style={{fontSize:13,color:t.textMuted,maxWidth:600}}>In-depth technical breakdowns of standout teams. Updated every 2-3 days as the tournament progresses.</div>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{width:200,flexShrink:0}}>
          {ANALYSIS_REPORTS.map(r=>(
            <div key={r.id} onClick={()=>setSelected(r.id)} style={{cursor:"pointer",padding:"10px 12px",marginBottom:4,borderRadius:4,background:selected===r.id?t.dark?"rgba(201,168,76,0.12)":"rgba(160,120,30,0.08)":t.surface2,border:`1px solid ${selected===r.id?t.gold:t.border}`,transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><Flag id={r.teamId} size={16} style={{borderRadius:2}}/><span style={{fontSize:11,fontWeight:600,color:selected===r.id?t.gold:t.text}}>{r.team}</span></div>
              <div style={{fontSize:10,color:selected===r.id?t.gold+"cc":t.textMuted,lineHeight:1.4}}>{r.title}</div>
            </div>
          ))}
          <div style={{marginTop:12,padding:"10px 12px",background:t.surface2,border:`1px solid ${t.border}`,borderRadius:4}}>
            <div style={{fontSize:10,fontFamily:"monospace",color:t.textMuted,lineHeight:1.5}}>Reports update as the tournament progresses. New analyses added every 2-3 days.</div>
          </div>
        </div>
        <div style={{flex:1,minWidth:300}}>
          <div style={{background:t.surface2,border:`1px solid ${t.border}`,borderRadius:6,overflow:"hidden"}}>
            <div style={{background:t.dark?"rgba(201,168,76,0.06)":"rgba(160,120,30,0.04)",borderBottom:`1px solid ${t.borderGold}`,padding:"20px 24px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <Flag id={report.teamId} size={28} style={{borderRadius:3}}/>
                <span style={{fontSize:9,fontFamily:"monospace",letterSpacing:"0.2em",color:report.badgeColor,background:`${report.badgeColor}15`,border:`1px solid ${report.badgeColor}30`,padding:"2px 8px",borderRadius:2}}>{report.badge}</span>
                <span style={{fontSize:10,fontFamily:"monospace",color:t.textMuted,marginLeft:"auto"}}>{report.date}</span>
              </div>
              <div style={{fontSize:20,fontWeight:700,color:t.text,marginBottom:5,lineHeight:1.3}}>{report.title}</div>
              <div style={{fontSize:14,color:t.textMuted,fontStyle:"italic"}}>{report.subtitle}</div>
            </div>
            <div style={{padding:"24px"}}>
              {report.body.split("\n\n").map((para,i)=><p key={i} style={{fontSize:14,color:t.textMuted,lineHeight:1.75,marginBottom:16,marginTop:0}}>{para}</p>)}
              <div style={{padding:"14px 18px",background:t.dark?"rgba(201,168,76,0.08)":"rgba(160,120,30,0.06)",border:`1px solid ${t.borderGold}`,borderLeft:`3px solid ${t.gold}`,borderRadius:"0 4px 4px 0",marginTop:20,marginBottom:16}}>
                <div style={{fontSize:9,fontFamily:"monospace",letterSpacing:"0.15em",color:t.gold,marginBottom:5}}>KEY TACTICAL INSIGHT</div>
                <div style={{fontSize:13,color:t.textMuted,lineHeight:1.6,fontStyle:"italic"}}>{report.insight}</div>
              </div>
              {report.heatNote&&(
                <div style={{padding:"12px 16px",background:t.dark?"rgba(139,184,240,0.06)":"rgba(37,99,235,0.04)",border:`1px solid ${t.dark?"rgba(139,184,240,0.2)":"rgba(37,99,235,0.15)"}`,borderRadius:4}}>
                  <div style={{fontSize:9,fontFamily:"monospace",letterSpacing:"0.15em",color:t.blue,marginBottom:4}}>📊 DATA NOTE — HEAT MAP</div>
                  <div style={{fontSize:12,color:t.textMuted,lineHeight:1.5}}>{report.heatNote}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WEIGHTS TAB ───────────────────────────────────────────────────────────────
function WeightsTab(){
  const t=useTheme();
  const cats={team:"Team Collective",manager:"Managerial",player:"Individual",context:"Contextual",luck:"Pure Luck"};
  const catColors={team:"#2ecc71",manager:"#8bb8f0",player:"#C9A84C",context:"#8E9BAF",luck:"#9b59b6"};
  const grouped={};
  FACTOR_WEIGHTS.forEach(f=>{if(!grouped[f.cat])grouped[f.cat]=[];grouped[f.cat].push(f);});
  const catTotals=Object.fromEntries(Object.entries(grouped).map(([k,v])=>[k,v.reduce((s,f)=>s+f.pct,0)]));
  return(
    <div>
      <div style={{marginBottom:20,fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:t.gold,textTransform:"uppercase"}}>Factor Weights & Methodology</div>
      <div style={{marginBottom:20,padding:16,background:t.dark?"rgba(46,204,113,0.05)":"rgba(22,163,74,0.04)",border:`1px solid ${t.dark?"rgba(46,204,113,0.2)":"rgba(22,163,74,0.15)"}`,borderRadius:4,fontSize:13,color:t.textMuted}}>
        <strong style={{color:t.text}}>Championship Probability Model</strong> (total=100%) — Team: <strong style={{color:"#2ecc71"}}>72%</strong> · Manager: <strong style={{color:"#8bb8f0"}}>11%</strong> · Individual: <strong style={{color:"#C9A84C"}}>6%</strong> · Contextual: <strong style={{color:"#8E9BAF"}}>6%</strong> · Luck: <strong style={{color:"#9b59b6"}}>5%</strong>
      </div>
      {Object.entries(grouped).map(([cat,factors])=>(
        <div key={cat} style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.2em",color:catColors[cat],textTransform:"uppercase"}}>{cats[cat]}</div>
            <div style={{fontFamily:"monospace",fontSize:16,fontWeight:700,color:catColors[cat]}}>{catTotals[cat]}%</div>
          </div>
          {factors.map((f,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 160px 40px",alignItems:"center",gap:12,marginBottom:8}}>
              <div style={{fontSize:14,color:t.text}}>{f.label}</div>
              <div style={{background:t.dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.07)",borderRadius:2,height:6,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${(f.pct/18)*100}%`,background:`linear-gradient(90deg,${f.color},${f.color}88)`,borderRadius:2}}/>
              </div>
              <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:f.color,textAlign:"right"}}>{f.pct}%</div>
            </div>
          ))}
        </div>
      ))}
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
          <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.2em",color:"#f39c12",textTransform:"uppercase"}}>Match-Specific (Individual Predictions)</div>
          <div style={{fontSize:10,fontFamily:"monospace",color:t.textMuted,padding:"2px 8px",background:"rgba(243,156,18,0.1)",border:"1px solid rgba(243,156,18,0.25)",borderRadius:2}}>Qualitative overlay · ±8% per factor</div>
        </div>
        <div style={{fontSize:13,color:t.textMuted,marginBottom:12,lineHeight:1.6}}>Applied as adjustments on top of the base model for individual match predictions. Each factor shifts win probabilities by up to ±8% depending on the magnitude of the advantage.</div>
        {MATCH_FACTORS.map((f,i)=>(
          <div key={i} style={{marginBottom:12,padding:"12px 16px",background:t.surface2,border:`1px solid ${t.dark?"rgba(243,156,18,0.15)":"rgba(243,156,18,0.2)"}`,borderRadius:4,borderLeft:`3px solid ${f.color}`}}>
            <div style={{fontWeight:600,fontSize:13,color:f.color,marginBottom:4}}>{f.label}</div>
            <div style={{fontSize:13,color:t.textMuted,lineHeight:1.6}}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── THEME TOGGLE BUTTON ───────────────────────────────────────────────────────
function ThemeToggle({dark, onToggle}){
  return(
    <button onClick={onToggle} title={dark?"Switch to light mode":"Switch to dark mode"} style={{
      display:"flex",alignItems:"center",gap:6,
      background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",
      border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.12)"}`,
      borderRadius:20,padding:"5px 12px",cursor:"pointer",
      transition:"all 0.2s",flexShrink:0
    }}>
      <span style={{fontSize:14}}>{dark?"☀️":"🌙"}</span>
      <span style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:dark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.5)",textTransform:"uppercase"}}>{dark?"Light":"Dark"}</span>
    </button>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [dark,setDark]=useState(true);
  const t=mkTheme(dark);
  const theme={...t,dark};

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
  const [uType,setUType]=useState("result");
  const [uText,setUText]=useState("");
  const [uTeam,setUTeam]=useState("");

  const addUpdate=useCallback(u=>setUpdates(p=>[...p,u]),[]);

  const fetchMatches=useCallback(async()=>{
    setMatchesLoading(true);setMatchesError(null);
    try{
      const res=await fetch(`${BACKEND_URL}/matches`);
      if(!res.ok) throw new Error(`Server error: ${res.status}`);
      const data=await res.json();
      setMatches((data||[]).sort((a,b)=>new Date(b.fixture?.date||0)-new Date(a.fixture?.date||0)));
    }catch(e){setMatchesError("Could not reach server.");console.error(e);}
    setMatchesLoading(false);
  },[]);

  useEffect(()=>{
    fetchMatches();
    const mt=setInterval(fetchMatches,5*60*1000);
    const ut=setInterval(async()=>{
      try{const res=await fetch(`${BACKEND_URL}/updates`);if(!res.ok)return;const nu=await res.json();if(nu.length>0)nu.forEach(u=>addUpdate(u));}catch(e){}
    },5*60*1000);
    return()=>{clearInterval(mt);clearInterval(ut);};
  },[fetchMatches,addUpdate]);

  const runAnalysis=async()=>{
    setLoading(true);setError(null);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:buildSystemPrompt(teams,updates),messages:[{role:"user",content:"Recalculate. Return only JSON."}]})});
      const data=await res.json();
      const raw=data.content?.find(c=>c.type==="text")?.text||"";
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setTeams(p=>p.map(t_=>{const u=parsed.teams?.find(x=>x.id===t_.id);return u?{...t_,prob:u.prob,change:u.change||0}:t_;}));
      if(parsed.summary)setAiSummary(parsed.summary);
      if(parsed.biggestMover)setBiggestMover(parsed.biggestMover);
      setLastRefresh(new Date().toLocaleTimeString());
    }catch(e){setError("Analysis failed. Try again.");console.error(e);}
    setLoading(false);
  };

  const top3=[...teams].sort((a,b)=>b.prob-a.prob).slice(0,3);

  return(
    <ThemeCtx.Provider value={theme}>
    <div style={{minHeight:"100vh",background:t.bg,color:t.text,fontFamily:"Georgia,serif",fontSize:16,display:"flex",flexDirection:"column",transition:"background 0.3s,color 0.3s"}}>

      {/* HEADER */}
      <div style={{background:t.headerBg,borderBottom:`1px solid ${t.borderGold}`,padding:"20px 24px 0",position:"sticky",top:0,zIndex:200,boxShadow:t.shadow,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:16}}>
          <div>
            <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.3em",color:t.gold,textTransform:"uppercase",marginBottom:4}}>Live Prediction Engine · FIFA Men's World Cup</div>
            <div style={{display:"flex",alignItems:"baseline",gap:10}}>
              <span style={{fontFamily:"Impact,sans-serif",fontSize:32,letterSpacing:"0.05em",color:t.text,lineHeight:1}}>WORLD CUP</span>
              <span style={{fontFamily:"Impact,sans-serif",fontSize:32,letterSpacing:"0.05em",color:t.gold,lineHeight:1}}>2026</span>
              <span style={{fontFamily:"monospace",fontSize:11,color:t.textMuted,marginLeft:8}}>USA · CAN · MEX</span>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            {top3.map(t_=>(
              <div key={t_.id} style={{background:t.surface2,border:`1px solid ${t.border}`,borderRadius:4,padding:"6px 12px",textAlign:"center",minWidth:90,display:"flex",alignItems:"center",gap:8}}>
                <Flag id={t_.id} size={24} style={{borderRadius:3}}/>
                <div>
                  <div style={{fontFamily:"monospace",fontSize:14,fontWeight:700,color:probColor(t_.prob,t)}}>{t_.prob.toFixed(1)}%</div>
                  <div style={{fontSize:11,color:t.textMuted}}>{t_.name}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <ThemeToggle dark={dark} onToggle={()=>setDark(d=>!d)}/>
              <button onClick={runAnalysis} disabled={loading} style={{background:loading?t.dark?"rgba(201,168,76,0.3)":"rgba(160,120,30,0.2)":"linear-gradient(135deg,#C9A84C,#E8C97A)",color:"#0A0A0F",border:"none",borderRadius:4,padding:"10px 20px",fontSize:12,fontWeight:700,fontFamily:"monospace",letterSpacing:"0.12em",cursor:loading?"not-allowed":"pointer",textTransform:"uppercase",display:"flex",alignItems:"center",gap:8}}>
                {loading?<><span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span>Analysing…</>:"⟳ Re-analyse Now"}
              </button>
            </div>
            {lastRefresh&&<div style={{fontSize:11,fontFamily:"monospace",color:t.textMuted}}>Last: {lastRefresh}</div>}
            {updates.length>0&&<div style={{fontSize:11,fontFamily:"monospace",color:t.gold}}>{updates.length} update{updates.length!==1?"s":""} queued</div>}
          </div>
        </div>

        {/* TABS */}
        <div style={{display:"flex",gap:0,borderTop:`1px solid ${t.border}`}}>
          {PRED_TABS.map(tab=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} style={{background:activeTab===tab?t.dark?"rgba(201,168,76,0.12)":"rgba(160,120,30,0.08)":"transparent",border:"none",borderBottom:activeTab===tab?`2px solid ${t.gold}`:"2px solid transparent",borderTop:activeTab===tab?`1px solid ${t.borderGold}`:"1px solid transparent",color:activeTab===tab?t.gold:t.dark?"rgba(201,168,76,0.55)":"rgba(160,120,30,0.5)",fontFamily:"monospace",fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",padding:"10px 14px",cursor:"pointer",transition:"all 0.15s",marginBottom:-1}}>◆ {tab}</button>
          ))}
          <div style={{width:1,background:t.border,margin:"8px 6px 0"}}/>
          {STATS_TABS.map(tab=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} style={{background:"transparent",border:"none",borderBottom:activeTab===tab?`2px solid ${t.blue}`:"2px solid transparent",color:activeTab===tab?t.blue:t.textMuted,fontFamily:"monospace",fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",padding:"10px 14px",cursor:"pointer",transition:"all 0.15s",marginBottom:-1}}>{tab}</button>
          ))}
        </div>
      </div>

      {/* AI SUMMARY BANNER */}
      <div style={{background:t.dark?"rgba(201,168,76,0.06)":"rgba(160,120,30,0.05)",borderBottom:`1px solid ${t.borderGold}`,padding:"10px 24px",flexShrink:0}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <span style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:t.gold,flexShrink:0,marginTop:3}}>AI ANALYSIS</span>
          <span style={{fontSize:14,color:t.textMuted,lineHeight:1.6}}>{aiSummary}</span>
        </div>
        {biggestMover&&<div style={{marginTop:"4px",display:"flex",gap:12}}><span style={{fontFamily:"monospace",fontSize:10,color:t.green,flexShrink:0}}>BIGGEST MOVER</span><span style={{fontSize:13,color:t.green}}>{biggestMover}</span></div>}
        {error&&<div style={{marginTop:"4px",display:"flex",gap:12}}><span style={{fontFamily:"monospace",fontSize:10,color:t.red,flexShrink:0}}>ERROR</span><span style={{fontSize:13,color:t.red}}>{error}</span></div>}
      </div>

      {/* BODY */}
      <div style={{display:"flex",flex:1,overflow:"hidden",minHeight:0}}>
        <div style={{flex:1,overflowY:"auto",padding:"32px 24px"}}>
          {activeTab==="Overview"&&<OverviewTab teams={teams}/>}
          {activeTab==="Predictions"&&<PredictionsTab/>}
          {activeTab==="Groups"&&<GroupsTab groups={INITIAL_GROUPS}/>}
          {activeTab==="Players"&&<PlayersTab players={players}/>}
          {activeTab==="Analysis"&&<AnalysisTab/>}
          {activeTab==="Weights"&&<WeightsTab/>}
          <div style={{borderTop:`1px solid ${t.border}`,padding:"20px 0",textAlign:"center",fontFamily:"monospace",fontSize:11,color:t.textDim,letterSpacing:"0.1em",marginTop:40}}>
            FIFA WORLD CUP 2026 · LIVE PREDICTION ENGINE · 16-FACTOR MODEL · POWERED BY CLAUDE
          </div>
        </div>
        <SidePanel matches={matches} loading={matchesLoading} error={matchesError} onRefresh={fetchMatches}/>
      </div>

      {/* HIDDEN UPDATES BUTTON */}
      <div style={{position:"fixed",bottom:20,right:308,zIndex:500}}>
        <button onClick={()=>setShowUpdates(!showUpdates)} title="Intelligence Feed (Admin)" style={{width:36,height:36,borderRadius:"50%",background:t.dark?"rgba(30,30,40,0.9)":"rgba(240,242,245,0.95)",border:`1px solid ${t.border}`,color:t.textDim,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)",boxShadow:t.shadow}}>
          {updates.length>0?<span style={{fontFamily:"monospace",fontSize:10,color:t.gold+"99",fontWeight:700}}>{updates.length}</span>:"·"}
        </button>
      </div>

      {/* UPDATES PANEL */}
      {showUpdates&&(
        <div style={{position:"fixed",bottom:64,right:308,zIndex:500,width:360,maxHeight:"70vh",background:t.headerBg,border:`1px solid ${t.border}`,borderRadius:8,boxShadow:t.shadow,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.15em",color:t.gold,textTransform:"uppercase"}}>Intelligence Feed</div>
            <button onClick={()=>setShowUpdates(false)} style={{background:"none",border:"none",color:t.textMuted,fontSize:16,cursor:"pointer",padding:0}}>✕</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
            <div style={{fontSize:12,color:t.textMuted,marginBottom:12}}>Enter new information — the AI will recalculate all probabilities.</div>
            <div style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:8,marginBottom:8}}>
              <select value={uType} onChange={e=>setUType(e.target.value)} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:3,padding:"6px 8px",color:t.text,fontSize:12,fontFamily:"monospace",cursor:"pointer"}}>
                {UPDATE_TYPES.map(t_=><option key={t_} value={t_}>{t_.toUpperCase()}</option>)}
              </select>
              <input value={uTeam} onChange={e=>setUTeam(e.target.value)} placeholder="Team…" style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:3,padding:"6px 8px",color:t.text,fontSize:12,outline:"none"}}/>
            </div>
            <textarea value={uText} onChange={e=>setUText(e.target.value)} placeholder="Details…" rows={3} style={{width:"100%",background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:3,padding:"8px",color:t.text,fontSize:13,resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.5,fontFamily:"Georgia,serif",marginBottom:8}}/>
            <button onClick={()=>{if(!uText.trim())return;addUpdate({type:uType,team:uTeam,text:uText,date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})});setUText("");setUTeam("");}} style={{background:"linear-gradient(135deg,#C9A84C,#E8C97A)",color:"#0A0A0F",border:"none",borderRadius:3,padding:"7px 16px",fontSize:11,fontWeight:700,fontFamily:"monospace",letterSpacing:"0.1em",cursor:"pointer",textTransform:"uppercase",marginBottom:12}}>+ Add to Feed</button>
            {[...updates].reverse().map((u,i)=>(
              <div key={i} style={{padding:"8px 10px",background:t.surface2,border:`1px solid ${t.border}`,borderRadius:3,borderLeft:`3px solid ${UPDATE_COLORS[u.type]||t.textMuted}`,marginBottom:6}}>
                <div style={{display:"flex",gap:8,marginBottom:3,alignItems:"center"}}>
                  <span style={{fontFamily:"monospace",fontSize:10,color:UPDATE_COLORS[u.type]||t.textMuted,textTransform:"uppercase"}}>{u.type}</span>
                  {u.team&&<span style={{fontSize:10,color:t.gold}}>[{u.team}]</span>}
                  <span style={{fontSize:10,color:t.textMuted,marginLeft:"auto"}}>{u.date}</span>
                </div>
                <div style={{fontSize:12,color:t.textMuted,lineHeight:1.5}}>{u.text}</div>
              </div>
            ))}
            {updates.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:t.textMuted,fontSize:12,fontStyle:"italic"}}>No updates logged yet.</div>}
          </div>
        </div>
      )}

      <style>{`
        *{box-sizing:border-box;}
        @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:${t.scrollTrack};}
        ::-webkit-scrollbar-thumb{background:${t.dark?"rgba(201,168,76,0.3)":"rgba(0,0,0,0.15)"};border-radius:3px;}
        select option{background:${t.headerBg};color:${t.text};}
        textarea::placeholder,input::placeholder{color:${t.textDim};}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:${t.dark?"invert(0.5)":"none"};}
      `}</style>
    </div>
    </ThemeCtx.Provider>
  );
}
