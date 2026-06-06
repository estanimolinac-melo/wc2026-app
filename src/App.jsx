import { useState, useCallback } from "react";
import { Flag, INITIAL_TEAMS, INITIAL_PLAYERS, FACTOR_WEIGHTS, PREDICTED_KNOCKOUT, INITIAL_GROUPS } from "./data.js";

const probColor = p => p>=14?"#C9A84C":p>=8?"#8bb8f0":p>=4?"#2ecc71":"#8E9BAF";
const POS_COLORS = { FWD:"#e74c3c", MID:"#2ecc71", DEF:"#8bb8f0", GK:"#C9A84C" };
const tabs = ["Leaderboard","Groups","Bracket","Players","Updates","Weights"];
const UPDATE_TYPES = ["result","injury","fitness","suspension","tactical","news"];
const UPDATE_COLORS = { result:"#2ecc71", injury:"#e74c3c", fitness:"#f39c12", suspension:"#e67e22", tactical:"#8bb8f0", news:"#8E9BAF" };
const SORT_OPTIONS = [
  {key:"rank", label:"Pre-Tournament Rank"},
  {key:"fantasy", label:"Fantasy Score (Overall Rating)"},
  {key:"goals", label:"Goals"},
  {key:"assists", label:"Assists"},
  {key:"cleanSheets", label:"Clean Sheets"},
  {key:"interceptions", label:"Interceptions"},
  {key:"saves", label:"Saves (GK)"},
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
            <span style={{flex:1,fontSize:12,fontWeight:isWinner?700:400,color:isW
