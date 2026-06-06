import { useState, useCallback } from "react";

// ─────────────────────────────────────────────
//  INITIAL DATA
// ─────────────────────────────────────────────
const INITIAL_TEAMS = [
  { id:"FRA", flag:"🇫🇷", name:"France",      group:"I", prob:18, peak:18, manager:"Deschamps",   cis:9.1, form:9, chemistry:8.9, change:0,
    strengths:"#1 FIFA ranked. Deepest squad in the tournament — quality from GK to bench barely drops. Deschamps' 14-year tenure produces the most cohesive tactical system. Mbappé, Tchouaméni, Camavinga, Saliba, Theo Hernández all in peak form. Highest Chemistry Score (8.9/10). Perfect age balance — veteran leadership + peak core + explosive youth.",
    weaknesses:"Confirmed absences of Ekitike and Kamara thin the attacking depth and DM cover. Deschamps' conservatism can stall games against deep-defensive opponents. Overreliance on Mbappé in creative moments.",
    rationale:"France leads because no team combines system depth, managerial experience, big-game record, and squad chemistry at the same level. In an 8-match, 39-day tournament, France's rotation quality is decisive."
  },
  { id:"ARG", flag:"🇦🇷", name:"Argentina",   group:"J", prob:15, peak:15, manager:"Scaloni",    cis:9.4, form:8, chemistry:9.2, change:0,
    strengths:"Highest Chemistry Score (9.2/10) and highest Manager CIS (9.4/10) in the tournament. Scaloni's 7+ years building the same core produces automatic understanding between Mac Allister, Enzo Fernández, and De Paul — the most rehearsed midfield trio at the World Cup. Reigning champions with the mental blueprints for winning this competition. Lautaro, J. Álvarez provide elite striker depth beyond Messi.",
    weaknesses:"Messi at 38 is the most critical variable — his physical availability across 8 matches is a genuine concern. Romero and Molina fitness doubts weaken an already aging defensive spine. Squad skewed older, compounding fatigue risk in the second week.",
    rationale:"Argentina's team-level cohesion is unmatched, but age-related fatigue risk and key injury doubts in defence prevent them from reaching France's probability ceiling."
  },
  { id:"ESP", flag:"🇪🇸", name:"Spain",       group:"H", prob:14, peak:14, manager:"De la Fuente",cis:8.7, form:9, chemistry:8.6, change:0,
    strengths:"The most aesthetically dominant team in world football right now. Euro 2024 and Nations League winners. Rodri, Pedri, Yamal axis is generationally gifted. Highest competitive win rate (74%) of any manager. De la Fuente's positional play system is fluid, aggressive, and near-impossible to contain for 90 minutes.",
    weaknesses:"Samu Omorodion and Fermín López out. Yamal fitness is a race — if he is not at 100% he loses the explosive edge that makes Spain's attack unpredictable. Defensive depth behind their first-choice CB pairing is thinner than ideal.",
    rationale:"Spain's form and system are exceptional, but the injury uncertainty around their most decisive player caps their probability just below Argentina's cohesion advantage."
  },
  { id:"ENG", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", name:"England",    group:"L", prob:11, peak:11, manager:"Tuchel",      cis:7.8, form:8, chemistry:7.4, change:0,
    strengths:"Most Premier League players of any squad — collective elite-environment exposure is unmatched. Kane, Bellingham, Saka, Foden, Palmer form a multi-dimensional attack with no obvious weak point. Tuchel's Champions League pedigree resolves England's historical structural fragility. Outstanding big-game record — no loss to a top-10 nation in last 9 competitive matches.",
    weaknesses:"Tuchel is only 2 years in — team chemistry still building. Ben White and Grealish absent. Historically prone to tactical rigidity in must-win knockout moments. Set-piece defence has been vulnerable at recent tournaments.",
    rationale:"England's individual quality and big-game record are elite, but two years of system-building under Tuchel leaves a chemistry gap vs. France/Spain/Argentina. Capable finalist, not yet favourite."
  },
  { id:"BRA", flag:"🇧🇷", name:"Brazil",      group:"C", prob:9, peak:9, manager:"Ancelotti",  cis:7.4, form:7, chemistry:7.1, change:0,
    strengths:"Vinicius Jr in extraordinary form — the most dangerous individual player in the tournament when fit. Six different scorers in the Panama warmup shows attacking depth. Ancelotti's trophy pedigree (4× CL winner) is the best of any coach at the tournament. 72,140 fans at Maracanã showed the national support is fully mobilised.",
    weaknesses:"Triple injury blow: Rodrygo (ACL), Militão (hamstring), Estêvão all out. Neymar confirmed absent for at least the opener. Ancelotti only 2 years in — tactical bedding-in still in progress. Brazil's deepest injury crisis of any major contender. Chemistry Score only 7.1/10.",
    rationale:"Brazil's ceiling is world-class but their floor has dropped significantly due to injuries. Three key absences in the same tournament window is the largest injury burden of any top-8 side."
  },
  { id:"GER", flag:"🇩🇪", name:"Germany",     group:"E", prob:8, peak:8, manager:"Nagelsmann", cis:7.5, form:8, chemistry:7.3, change:0,
    strengths:"8-match winning streak entering the tournament — best run of any team. Wirtz-Musiala creative axis is arguably the most exciting attacking partnership in the World Cup. Dominant possession metrics: 656 passes vs Finland's 342 in warmup. Nagelsmann's proactive pressing system creates problems for any opponent.",
    weaknesses:"Gnabry and ter Stegen both out. Undav injury concern from Finland warmup threatens their striker depth with Havertz as only alternative starter. Nagelsmann still building big-game tournament experience as a manager. No trophy at international level yet.",
    rationale:"Germany's in-form trajectory and Wirtz-Musiala combination make them a genuine semi-final threat, but managerial inexperience and injury concerns in key positions limit their ceiling."
  },
  { id:"POR", flag:"🇵🇹", name:"Portugal",    group:"K", prob:7, peak:7, manager:"Martínez",   cis:7.6, form:8, chemistry:7.8, change:0,
    strengths:"2025 Nations League winners in dominant form. Ronaldo, B. Fernandes, Bernardo Silva, and Leão together represent enormous talent. Squad depth in midfield and wide areas is exceptional. Martínez has three years building a settled system.",
    weaknesses:"Excessive reliance on Ronaldo at 41 as a psychological and tactical crutch creates structural distortions. When Portugal face high-press systems, the transitional midfield shape is vulnerable. No significant trophy since 2016 raises questions about knockout composure.",
    rationale:"Portugal's individual quality is top-5 in the tournament, but the Ronaldo-dependency and knockout-stage fragility historically prevent them from matching France or Spain's overall probability."
  },
  { id:"MAR", flag:"🇲🇦", name:"Morocco",     group:"C", prob:5, peak:5, manager:"Regragui",   cis:8.2, form:8, chemistry:8.4, change:0,
    strengths:"21-match unbeaten streak. Five clean sheets in last six matches — the most defensively organised team in the tournament. High Chemistry Score (8.4/10). Regragui's system is deeply embedded after 3+ years. Hakimi expected fit. Proved in 2022 they can beat any team in the world in a single-elimination format.",
    weaknesses:"Attacking depth beyond their first XI is the main limitation — Saibari and El Kaabi are capable but lack the elite-level club pedigree of European rivals. Fitness of key attacking players under sustained tournament pressure (8 matches) has historically been their ceiling.",
    rationale:"Morocco are the tournament's most dangerous defensive unit, but their offensive ceiling caps their outright probability. Most likely team to produce a knockout-round upset."
  },
  { id:"NED", flag:"🇳🇱", name:"Netherlands", group:"F", prob:4, peak:4, manager:"Koeman",     cis:6.8, form:7, chemistry:6.5, change:0,
    strengths:"Van Dijk's commanding defensive leadership. Dumfries and De Cuyper provide elite wing-back threat. Gakpo and the forward line have pace and directness. Lost 0-1 to Algeria in warmup — a concern, but they rested key players.",
    weaknesses:"Xavi Simons (ACL) and Matthijs de Ligt both out — two of their best players absent. Algeria warmup loss exposed attacking creativity issues when Simons is not available. Chemistry Score only 6.5/10 — injuries have broken settled positional pairings. Koeman's management style has been questioned internally.",
    rationale:"Netherlands have the defensive quality to go far, but the double injury loss of their two most dynamic players reduces them from genuine contender to dangerous outsider."
  },
  { id:"URU", flag:"🇺🇾", name:"Uruguay",     group:"H", prob:3, peak:3, manager:"Bielsa",     cis:7.9, form:7, chemistry:7.5, change:0,
    strengths:"Bielsa's extreme pressing system is the most disruptive in the tournament for opponents unprepared for it. Valverde (Real Madrid) is world-class. Núñez and Araújo provide physical and technical threat. Uruguay consistently over-performs external expectations at World Cups.",
    weaknesses:"Bielsa's high-intensity system demands extraordinary physical fitness — fatigue risk in matches 6, 7, and 8 is real. No obvious creative #10 to unlock deep defensive blocks. Squad depth significantly below the top-6 nations.",
    rationale:"Uruguay are the most dangerous team ranked below their probability — Bielsa's system can cause any team problems on a given day, but sustaining it across a 39-day tournament is the structural constraint."
  },
  { id:"BEL", flag:"🇧🇪", name:"Belgium",     group:"G", prob:2, peak:2, manager:"Garcia",     cis:6.5, form:7, chemistry:6.8, change:0,
    strengths:"De Bruyne in his final World Cup — highly motivated. Tielemans at the peak of his powers. Doku's pace and directness cause elite defences serious problems. Lukaku returned and scored vs Croatia — if fit and sharp, he's a significant threat.",
    weaknesses:"Lukaku played only 64 minutes of club football this season — his physical readiness for 90-minute knockout matches is a genuine concern. Belgium have consistently underperformed at major tournaments despite their talent. The 'Golden Generation' window is firmly closing.",
    rationale:"Belgium's individual quality is top-tier but their tournament record relative to squad quality, Lukaku's fitness, and an ageing core reduce their realistic ceiling to the quarter-finals."
  },
  { id:"JPN", flag:"🇯🇵", name:"Japan",       group:"F", prob:2, peak:2, manager:"Moriyasu",   cis:8.0, form:7, chemistry:7.6, change:0,
    strengths:"Beat England at Wembley in March 2026. Five consecutive wins, 10 goals scored, only 2 conceded in recent run. Moriyasu's 8-year tenure has produced Japan's most cohesive and tactically sophisticated team. Kubo, Kamada, and Doan are elite-level club players. Pressing intensity rivals any team in the tournament.",
    weaknesses:"Lost Mitoma, Minamino, and Endo to injury. Without this trio the creative and defensive midfield depth drops noticeably. Late winner vs Iceland (87') showed difficulty breaking down compact defensive blocks. Small-squad depth concern in a 48-team format.",
    rationale:"Japan are the tournament's most underrated team — their recent results justify a higher probability than the market gives them. Injury losses cap their realistic ceiling at the quarter-finals."
  },
  { id:"MEX", flag:"🇲🇽", name:"Mexico",      group:"A", prob:2, peak:2, manager:"Aguirre",    cis:6.8, form:7, chemistry:7.0, change:0,
    strengths:"Home advantage at Estadio Azteca and Akron is the most powerful psychological weapon in CONCACAF football. Aguirre's tactical system is settled and well-drilled. Mexico have not lost a competitive home match in decades. Strong squad cohesion and national identity in a host tournament.",
    weaknesses:"Attacking creativity is functional rather than expressive — limited genuine world-class options in the final third. Aguirre's pragmatic system occasionally sacrifices attacking ambition for defensive solidity. Vulnerable against high-press systems that deny them time to build.",
    rationale:"Mexico's host advantage and defensive solidity make them a genuine round-of-16 threat, but their realistic ceiling is the quarter-finals given the attacking quality deficit vs. top European sides."
  },
  { id:"CAN", flag:"🇨🇦", name:"Canada",      group:"B", prob:2, peak:2, manager:"Marsch",     cis:7.0, form:7, chemistry:6.9, change:0,
    strengths:"Host-nation energy and a young, hungry squad with European club pedigree (Jonathan David, Buchanan, Eustáquio, Laryea). Jesse Marsch's high-pressing system is well-suited to the physical demands of the tournament. First World Cup appearance as a host nation since 1986.",
    weaknesses:"Alphonso Davies availability is the critical unknown — without him Canada's dynamic changes substantially. Buchanan and discipline issues (3 red cards in last 4 matches) are a concern for knockout-round management. Depth beyond the first XI drops significantly.",
    rationale:"Canada's host advantage and pressing system give them a realistic path to the Round of 16, but the Davies uncertainty and disciplinary concerns prevent higher probability."
  },
  { id:"USA", flag:"🇺🇸", name:"USA",         group:"D", prob:2, peak:2, manager:"Pochettino",  cis:7.0, form:6, chemistry:6.5, change:0,
    strengths:"Home crowd at SoFi Stadium, MetLife, and other iconic venues provides the loudest atmosphere in CONCACAF. Pulisic finally broke his scoring drought vs Senegal — huge confidence boost. Pochettino's tactical intelligence and adaptability are well above average for this squad's talent level.",
    weaknesses:"Pattern of conceding two-goal leads in short spans — Senegal equalised from 2-0 down in eight minutes. Defensive transition errors (Robinson giveaways) remain a recurring structural problem. Chemistry Score only 6.5/10 — Pochettino still bedding in system.",
    rationale:"The USA's home advantage and Pochettino system give them knockout potential, but defensive fragility and limited top-level tournament pedigree keep them as dark horse rather than genuine contender."
  },
  { id:"KOR", flag:"🇰🇷", name:"South Korea", group:"A", prob:1, peak:1, manager:"Hong",       cis:6.5, form:6, chemistry:6.8, change:0,
    strengths:"Son Heung-min scored a first-half brace vs Trinidad — in outstanding physical condition entering the tournament. High pressing intensity and collective work rate are elite. Group A opponents Mexico and Czechia are manageable if South Korea are at their best.",
    weaknesses:"Overly Son-dependent in attack — without his direct contribution the attack lacks a genuine plan B. Defensive vulnerabilities against sides with powerful physical strikers.",
    rationale:"South Korea's path to the Round of 16 is realistic via Group A, but their ceiling is determined almost entirely by Son's availability and form."
  },
  { id:"COL", flag:"🇨🇴", name:"Colombia",    group:"K", prob:1, peak:1, manager:"Lorenzo",    cis:6.2, form:7, chemistry:7.0, change:0,
    strengths:"Luis Díaz (Bayern Munich) was outstanding vs Costa Rica — direct, powerful, instinctive. Technical quality in midfield and a settled shape under Lorenzo. James Rodríguez provides veteran creative leadership.",
    weaknesses:"Defensive concentration drops when comfortable — second-half disorganisation vs Costa Rica is a concern. Kobi depth in attack beyond Díaz is limited. Lorenzo's CIS (6.2) is the lowest of any major contender.",
    rationale:"Colombia have the talent for a deep run in Group K but face Portugal in the projected Round of 32 — a match that is their ceiling test."
  },
  { id:"TUR", flag:"🇹🇷", name:"Turkey",      group:"D", prob:1, peak:1, manager:"Montella",   cis:6.3, form:6, chemistry:6.5, change:0,
    strengths:"4-0 vs North Macedonia showed elite pressing intensity and offensive diversity. Young, energetic squad with strong Bundesliga and Serie A representation. Mounting form curve heading into the tournament.",
    weaknesses:"No meaningful big-game tournament experience at knockout level in recent history. Montella's tactical system is well-drilled but predictable under sustained pressure. Defensive depth is ordinary.",
    rationale:"Turkey are this tournament's most dangerous second-tier team — capable of a Round of 16 exit but unlikely to have the tools to go further against elite opposition."
  },
];

const INITIAL_GROUPS = {
  A:{ name:"A", teams:[{id:"MEX",flag:"🇲🇽",name:"Mexico",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"KOR",flag:"🇰🇷",name:"South Korea",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"CZE",flag:"🇨🇿",name:"Czechia",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"RSA",flag:"🇿🇦",name:"South Africa",w:0,d:0,l:0,gf:0,ga:0,pts:0}]},
  B:{ name:"B", teams:[{id:"CAN",flag:"🇨🇦",name:"Canada",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"SUI",flag:"🇨🇭",name:"Switzerland",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"BIH",flag:"🇧🇦",name:"Bosnia-Herz.",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"QAT",flag:"🇶🇦",name:"Qatar",w:0,d:0,l:0,gf:0,ga:0,pts:0}]},
  C:{ name:"C", teams:[{id:"MAR",flag:"🇲🇦",name:"Morocco",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"BRA",flag:"🇧🇷",name:"Brazil",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"SCO",flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",name:"Scotland",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"HAI",flag:"🇭🇹",name:"Haiti",w:0,d:0,l:0,gf:0,ga:0,pts:0}]},
  D:{ name:"D", teams:[{id:"USA",flag:"🇺🇸",name:"USA",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"TUR",flag:"🇹🇷",name:"Turkey",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"PAR",flag:"🇵🇾",name:"Paraguay",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"AUS",flag:"🇦🇺",name:"Australia",w:0,d:0,l:0,gf:0,ga:0,pts:0}]},
  E:{ name:"E", teams:[{id:"GER",flag:"🇩🇪",name:"Germany",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"CIV",flag:"🇨🇮",name:"Ivory Coast",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"ECU",flag:"🇪🇨",name:"Ecuador",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"CUR",flag:"🇨🇼",name:"Curaçao",w:0,d:0,l:0,gf:0,ga:0,pts:0}]},
  F:{ name:"F", teams:[{id:"NED",flag:"🇳🇱",name:"Netherlands",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"JPN",flag:"🇯🇵",name:"Japan",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"SWE",flag:"🇸🇪",name:"Sweden",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"TUN",flag:"🇹🇳",name:"Tunisia",w:0,d:0,l:0,gf:0,ga:0,pts:0}]},
  G:{ name:"G", teams:[{id:"BEL",flag:"🇧🇪",name:"Belgium",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"EGY",flag:"🇪🇬",name:"Egypt",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"IRN",flag:"🇮🇷",name:"Iran",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"NZL",flag:"🇳🇿",name:"New Zealand",w:0,d:0,l:0,gf:0,ga:0,pts:0}]},
  H:{ name:"H", teams:[{id:"ESP",flag:"🇪🇸",name:"Spain",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"URU",flag:"🇺🇾",name:"Uruguay",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"KSA",flag:"🇸🇦",name:"Saudi Arabia",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"CPV",flag:"🇨🇻",name:"Cape Verde",w:0,d:0,l:0,gf:0,ga:0,pts:0}]},
  I:{ name:"I", teams:[{id:"FRA",flag:"🇫🇷",name:"France",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"NOR",flag:"🇳🇴",name:"Norway",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"SEN",flag:"🇸🇳",name:"Senegal",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"IRQ",flag:"🇮🇶",name:"Iraq",w:0,d:0,l:0,gf:0,ga:0,pts:0}]},
  J:{ name:"J", teams:[{id:"ARG",flag:"🇦🇷",name:"Argentina",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"AUT",flag:"🇦🇹",name:"Austria",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"ALG",flag:"🇩🇿",name:"Algeria",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"JOR",flag:"🇯🇴",name:"Jordan",w:0,d:0,l:0,gf:0,ga:0,pts:0}]},
  K:{ name:"K", teams:[{id:"POR",flag:"🇵🇹",name:"Portugal",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"COL",flag:"🇨🇴",name:"Colombia",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"COD",flag:"🇨🇩",name:"Congo DR",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"UZB",flag:"🇺🇿",name:"Uzbekistan",w:0,d:0,l:0,gf:0,ga:0,pts:0}]},
  L:{ name:"L", teams:[{id:"ENG",flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",name:"England",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"CRO",flag:"🇭🇷",name:"Croatia",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"GHA",flag:"🇬🇭",name:"Ghana",w:0,d:0,l:0,gf:0,ga:0,pts:0},{id:"PAN",flag:"🇵🇦",name:"Panama",w:0,d:0,l:0,gf:0,ga:0,pts:0}]},
};

const PREDICTED_KNOCKOUT = [
  { round:"Round of 32", matches:[
    {a:{flag:"🇲🇽",name:"Mexico",prob:68},b:{flag:"🇧🇦",name:"Bosnia-Herz.",prob:32},winner:"Mexico",aStrengths:"Host advantage, defensive solidity, settled system",bStrengths:"Competitive midfield, big-game European pedigree",rationale:"Mexico's home crowd and Aguirre's tactical stability edge past a Bosnia side with limited World Cup experience."},
    {a:{flag:"🇰🇷",name:"South Korea",prob:57},b:{flag:"🇸🇳",name:"Senegal",prob:43},winner:"South Korea",aStrengths:"Son's individual brilliance, cohesive pressing system",bStrengths:"Mané's 54 international goals, Diarra and Jackson as supporting cast",rationale:"Closest matchup of the round. Son vs Mané is the defining individual duel. South Korea's collective system edges a Senegal side that is lethal in transition but less cohesive without a settled partner for Mané."},
    {a:{flag:"🇲🇦",name:"Morocco",prob:64},b:{flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",name:"Scotland",prob:36},winner:"Morocco",aStrengths:"21-match unbeaten run, 5 clean sheets in 6, defensive fortress",bStrengths:"High work rate, set-piece threat, competitive European qualifying",rationale:"Morocco's defensive organisation and attacking balance make them strong favourites. Scotland's physicality can cause problems but their quality ceiling in open-game phases falls well short."},
    {a:{flag:"🇧🇷",name:"Brazil",prob:71},b:{flag:"🇬🇭",name:"Ghana",prob:29},winner:"Brazil",aStrengths:"Vinicius Jr, Paquetá creativity, second-half bench depth",bStrengths:"Physicality, directness, emotional resilience in big moments",rationale:"Brazil's technical quality is significantly superior. Ghana can compete physically but lack the sustained high-press quality to prevent Brazil from controlling games once they find rhythm."},
    {a:{flag:"🇨🇦",name:"Canada",prob:59},b:{flag:"🇨🇿",name:"Czechia",prob:41},winner:"Canada",aStrengths:"Host energy, Marsch pressing system, Jonathan David's goals",bStrengths:"Technical European discipline, competitive midfield, experience",rationale:"Canada's host advantage is the swing factor in a genuinely close tie. Without Davies, this drops to 55–45 but Canada's collective pressing should still edge through."},
    {a:{flag:"🇺🇸",name:"USA",prob:62},b:{flag:"🇩🇿",name:"Algeria",prob:38},winner:"USA",aStrengths:"Pulisic restored confidence, home crowd, Pochettino's tactical flexibility",bStrengths:"Algeria beat Netherlands 1-0 in warmup — not to be underestimated. Strong defensive block and dangerous on the counter.",rationale:"Algeria's Netherlands warmup result is a legitimate warning. But USA's home advantage at major stadiums and Pochettino's tactical intelligence edges them through in what will be a tight, tactical game."},
    {a:{flag:"🇩🇪",name:"Germany",prob:74},b:{flag:"🇸🇦",name:"Saudi Arabia",prob:26},winner:"Germany",aStrengths:"8-match winning streak, Wirtz-Musiala axis, 656-pass possession dominance",bStrengths:"Disciplined low-block, dangerous counter on the break, beat Argentina at 2022 WC",rationale:"Germany's attacking creativity and possession dominance should prove too much for a Saudi side that can frustrate but ultimately lacks the quality to sustain a shock over 90+ minutes."},
    {a:{flag:"🇳🇱",name:"Netherlands",prob:66},b:{flag:"🇵🇾",name:"Paraguay",prob:34},winner:"Netherlands",aStrengths:"Van Dijk's defensive authority, Gakpo pace, Dumfries aggression",bStrengths:"Physical resilience, South American tournament hardness, difficult to break down",rationale:"Netherlands' individual quality should prevail despite their Simons/De Ligt absences. Paraguay will make it uncomfortable but lack the quality to capitalise on moments of Dutch disorganisation."},
    {a:{flag:"🇧🇪",name:"Belgium",prob:61},b:{flag:"🇪🇬",name:"Egypt",prob:39},winner:"Belgium",aStrengths:"De Bruyne's final World Cup — peak motivation. Tielemans, Doku pace. Courtois in goal.",bStrengths:"Salah's 54 international caps of big-game experience, disciplined defensive structure",rationale:"The most emotionally charged matchup of the round. Salah vs De Bruyne is a generational duel. Belgium's collective system edges it but Egypt with a fully fit Salah can win this."},
    {a:{flag:"🇯🇵",name:"Japan",prob:54},b:{flag:"🇸🇪",name:"Sweden",prob:46},winner:"Japan",aStrengths:"Beat England at Wembley in March, 5-match win streak, Moriyasu's 8-year system",bStrengths:"Isak's world-class striking, physical directness, Nations League pathway quality",rationale:"The closest probability matchup of the round after South Korea vs Senegal. Sweden's Isak is a match-winner. Japan's system is more sophisticated but the injury losses of Mitoma and Endo are felt here."},
    {a:{flag:"🇪🇸",name:"Spain",prob:80},b:{flag:"🇨🇮",name:"Ivory Coast",prob:20},winner:"Spain",aStrengths:"Euro 2024 and Nations League winners, Rodri-Pedri-Yamal axis, highest competitive win rate",bStrengths:"Haller, physical athleticism, AFCON experience in big-game environments",rationale:"Spain's most comfortable predicted matchup. Their possession system is perfectly designed to neutralise physically imposing opponents. Ivory Coast's best chance is a set-piece or counter early — once Spain establish control, this becomes one-way traffic."},
    {a:{flag:"🇺🇾",name:"Uruguay",prob:55},b:{flag:"🇹🇷",name:"Turkey",prob:45},winner:"Uruguay",aStrengths:"Bielsa's extreme pressing, Valverde world-class, Núñez physical threat",bStrengths:"4-0 vs North Macedonia form, aggressive press, growing tournament momentum",rationale:"Two of the tournament's best-pressing systems against each other. Valverde vs Turkey's midfield is the key duel. Uruguay's big-game tournament experience and Bielsa's tactical preparation for specific opponents edges it."},
    {a:{flag:"🇫🇷",name:"France",prob:78},b:{flag:"🇳🇴",name:"Norway",prob:22},winner:"France",aStrengths:"#1 FIFA rank, 14-year Deschamps system, Mbappé and full attacking depth",bStrengths:"Haaland — the tournament's most feared individual striker. Strand Larsen proved capable cover. Nusa direct and dangerous.",rationale:"Haaland is a genuine one-man army but France's defensive structure under Upamecano and Saliba is designed specifically to neutralise physical centre-forwards. Mbappé's counter-threat is the decisive advantage France hold over a Norway side that is great going forward but exposed defensively."},
    {a:{flag:"🇦🇷",name:"Argentina",prob:73},b:{flag:"🇦🇹",name:"Austria",prob:27},winner:"Argentina",aStrengths:"Highest tournament chemistry (9.2/10), Scaloni's 7-year system, Mac Allister-Enzo-De Paul midfield",bStrengths:"Rangnick's high-press Red Bull system, best pass-completion suppression rate of any World Cup team",rationale:"Austria's pressing system is the most dangerous stylistic opponent for Argentina's build-up. If they can disrupt Argentina's rhythm in the first 30 minutes, this becomes a genuine contest. But Argentina's big-game composure from winning the 2022 World Cup is decisive in tight moments."},
    {a:{flag:"🇵🇹",name:"Portugal",prob:77},b:{flag:"🇨🇴",name:"Colombia",prob:23},winner:"Portugal",aStrengths:"Nations League winners, Ronaldo leadership, Bernardo Silva and Leão elite quality",bStrengths:"Díaz was outstanding vs Costa Rica — direct and unpredictable. James Rodríguez experience.",rationale:"Portugal's European quality and settled system should prevail, but Díaz at his best gives Colombia a genuine chance of causing an upset. The most likely Colombia scenario involves Díaz running at Cancelo repeatedly."},
    {a:{flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",name:"England",prob:71},b:{flag:"🇭🇷",name:"Croatia",prob:29},winner:"England",aStrengths:"Kane, Bellingham, Saka, Foden — elite depth throughout. No loss to top-10 side in last 9.",bStrengths:"Modrić still controlling games at 40. Gvardiol explosive if fit. Croatia's knockout experience.",rationale:"England are significantly stronger than the Croatia they drew with in recent tournaments. Tuchel's tactical preparation removes the historical structural fragility. Croatia's best chance is Modrić dictating tempo in a low-scoring game — but England's forward firepower should ultimately decide it."},
  ]},
  { round:"Round of 16", matches:[
    {a:{flag:"🇲🇦",name:"Morocco",prob:59},b:{flag:"🇲🇽",name:"Mexico",prob:41},winner:"Morocco",aStrengths:"Defensive fortress, 21-match unbeaten streak",bStrengths:"Home crowd still present, Aguirre's pragmatic control",rationale:"Mexico's host advantage makes this close. But Morocco's defensive system, built for exactly this type of match, edges it on quality and big-game composure."},
    {a:{flag:"🇧🇷",name:"Brazil",prob:66},b:{flag:"🇰🇷",name:"South Korea",prob:34},winner:"Brazil",aStrengths:"Vinicius, second-half bench depth, Ancelotti's tournament management",bStrengths:"Son's individual brilliance, collective pressing intensity",rationale:"South Korea can hurt Brazil on transitions through Son, but Brazil's collective quality and depth is too great over 90 minutes. This match likely goes to the 60th minute before Brazil's substitutes create the decisive difference."},
    {a:{flag:"🇩🇪",name:"Germany",prob:64},b:{flag:"🇨🇦",name:"Canada",prob:36},winner:"Germany",aStrengths:"8-match winning streak, Wirtz-Musiala creative dominance",bStrengths:"Home crowd still present, high-press disruption, Davies if fit",rationale:"The host-nation advantage for Canada makes this closer than the quality gap suggests. If Davies is fit and at his explosive best, Canada can physically match Germany. But Germany's technical quality and winning momentum should prevail."},
    {a:{flag:"🇳🇱",name:"Netherlands",prob:55},b:{flag:"🇺🇸",name:"USA",prob:45},winner:"Netherlands",aStrengths:"Van Dijk leadership, defensive solidity",bStrengths:"Pochettino's tactical adaptability, home crowd at peak intensity",rationale:"USA's most dangerous potential upset — Pochettino against a Netherlands side weakened by injuries. The USA home crowd advantage in a venue like MetLife or SoFi makes this genuinely close. Netherlands' individual quality edges it but this is the highest upset-probability matchup of the round."},
    {a:{flag:"🇪🇸",name:"Spain",prob:72},b:{flag:"🇯🇵",name:"Japan",prob:28},winner:"Spain",aStrengths:"Possession dominance, Rodri-Pedri axis impossible to disrupt",bStrengths:"Beat England at Wembley. Collective pressing system designed to disrupt possession teams.",rationale:"Japan are one of the few teams whose pressing system genuinely threatens Spain's build-up. If Japan can force turnovers in Spain's half, they can win this. But Spain's technical quality under pressure is the best in the world — Rodri's ability to find passes in tight spaces neutralises Japan's trap."},
    {a:{flag:"🇫🇷",name:"France",prob:68},b:{flag:"🇧🇪",name:"Belgium",prob:32},winner:"France",aStrengths:"#1 FIFA rank, deepest squad, Deschamps' tournament management",bStrengths:"De Bruyne's final WC — peak motivation. Courtois knows French players intimately.",rationale:"A repeat of the 2018 quarter-final where France's structural solidity prevailed. De Bruyne is at his best in big games but Tchouaméni and Camavinga as a double pivot neutralise Belgium's midfield creativity. Mbappé's pace behind the Belgian line is the decisive weapon."},
    {a:{flag:"🇦🇷",name:"Argentina",prob:63},b:{flag:"🇺🇾",name:"Uruguay",prob:37},winner:"Argentina",aStrengths:"9.2/10 chemistry, Messi's tournament experience, Mac Allister-Enzo axis",bStrengths:"Bielsa's pressing is Argentina's worst stylistic nightmare. Valverde vs Enzo Fernández is the defining midfield duel.",rationale:"The South American derby is the most emotionally charged matchup of the Round of 16. Bielsa's press will cause Argentina the most problems of any team they face. But Argentina's big-game championship DNA — and their chemistry advantage — edges it in extra time if needed."},
    {a:{flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",name:"England",prob:60},b:{flag:"🇵🇹",name:"Portugal",prob:40},winner:"England",aStrengths:"Tuchel's tactical preparation, no loss to top-10 in last 9, Bellingham vs Fernandes",bStrengths:"Nations League winners, Bernardo Silva intelligence, Ronaldo's big-game psychological weight",rationale:"England vs Portugal is the Round of 16 match of the tournament. Ronaldo vs Tuchel is a psychological battle. England's structural solidity under Tuchel edges it by the narrowest margin — but Bernardo Silva in the spaces behind Bellingham is the Portuguese key."},
  ]},
  { round:"Quarter-Finals", matches:[
    {a:{flag:"🇧🇷",name:"Brazil",prob:58},b:{flag:"🇲🇦",name:"Morocco",prob:42},winner:"Brazil",aStrengths:"Individual quality, Vinicius vs Hakimi is a world-class wide duel",bStrengths:"Most disciplined defensive unit in tournament, counter-attack precision",rationale:"Morocco's defensive system is the only credible obstacle Brazil face before the semi-finals. If Vinicius is contained by Hakimi, Brazil must create through other means — which they can. But this is Morocco's most realistic path to a semi-final repeat of 2022."},
    {a:{flag:"🇩🇪",name:"Germany",prob:53},b:{flag:"🇳🇱",name:"Netherlands",prob:47},winner:"Germany",aStrengths:"8-match winning streak, Wirtz-Musiala vs Dutch midfield",bStrengths:"Van Dijk defensive authority, counter-attack pace through Gakpo",rationale:"The closest quarter-final. Germany's attacking creativity vs Netherlands' counter-attack efficiency — the essence of German vs Dutch football. Germany's recent form and momentum tips it by the narrowest margin."},
    {a:{flag:"🇫🇷",name:"France",prob:67},b:{flag:"🇪🇸",name:"Spain",prob:33},winner:"France",aStrengths:"Defensive solidity, Deschamps' big-game management, depth in every position",bStrengths:"Spain's Rodri-Pedri possession system is the most complete in the tournament. De la Fuente won everything with this squad.",rationale:"The match of the tournament. Spain's possession system vs France's counter-attack and defensive organisation. Deschamps' conservatism is perfectly calibrated for exactly this type of opponent. Mbappé's pace behind Carvajal is the decisive weapon France possess that Spain have no clean answer to."},
    {a:{flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",name:"England",prob:55},b:{flag:"🇦🇷",name:"Argentina",prob:45},winner:"England",aStrengths:"Tuchel's tactical discipline, Kane's big-game goals, Bellingham's control",bStrengths:"Argentina's championship DNA, Scaloni's 9.4 CIS, Mac Allister-Enzo midfield cohesion",rationale:"England's best chance ever of defeating Argentina in competitive football. Tuchel's tactical structure and England's big-game confidence at a home tournament edge it in a match that will likely be decided by a single moment of individual quality."},
  ]},
  { round:"Semi-Finals", matches:[
    {a:{flag:"🇫🇷",name:"France",prob:61},b:{flag:"🇧🇷",name:"Brazil",prob:39},winner:"France",aStrengths:"Deepest squad, Deschamps' tournament management mastery",bStrengths:"Vinicius Jr at peak, Ancelotti's Champions League pedigree",rationale:"The semi-final of semifinals. France's defensive organisation under Saliba and Upamecano is designed for Vinicius' type of threat — fast, direct, and narrow. Mbappé's penalty-box threat in transition is the decisive French advantage. Brazil's injury-depleted defence leaves them exposed to France's counter."},
    {a:{flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",name:"England",prob:57},b:{flag:"🇩🇪",name:"Germany",prob:43},winner:"England",aStrengths:"Home tournament atmosphere, Bellingham-Kane axis",bStrengths:"Wirtz-Musiala partnership, 8-match winning streak momentum",rationale:"England's home advantage in a North American stadium with a predominantly English-supporting crowd is significant. Tuchel knows German football intimately — his tactical preparation for Wirtz and Musiala is the best of any manager who could face Germany. England's structural discipline edges it."},
  ]},
  { round:"Final — July 19, MetLife", matches:[
    {a:{flag:"🇫🇷",name:"France",prob:56},b:{flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",name:"England",prob:44},winner:"France",aStrengths:"#1 FIFA rank, Deschamps' 14-year system, squad depth at every position, highest Chemistry Score",bStrengths:"England's best-prepared squad in a generation, Tuchel's tactical genius, home-tournament crowd",rationale:"France's tournament experience, squad depth, and the sheer volume of their collective statistical advantages across all 16 factors deliver the narrowest of final victories. Deschamps wins his second World Cup. England's tournament ends as runners-up — their best performance since 1966, and a result that genuinely signals they are coming."},
  ]},
];

// ─────────────────────────────────────────────
//  PLAYER DATA — Pre-tournament seeded
// ─────────────────────────────────────────────
const INITIAL_PLAYERS = [
  // FWD
  {id:1, name:"Kylian Mbappé",     nation:"🇫🇷", pos:"FWD", club:"Real Madrid",   goals:0, assists:0, apps:0, passAcc:82, duelsWon:58, dribbles:2.1, dribbledPast:0.8, interceptions:0.4, chancesCreated:2.8, keyPasses:2.1, rating:0, mins:0},
  {id:2, name:"Erling Haaland",    nation:"🇳🇴", pos:"FWD", club:"Man City",       goals:0, assists:0, apps:0, passAcc:71, duelsWon:62, dribbles:1.1, dribbledPast:0.5, interceptions:0.3, chancesCreated:1.2, keyPasses:0.8, rating:0, mins:0},
  {id:3, name:"Vinícius Júnior",   nation:"🇧🇷", pos:"FWD", club:"Real Madrid",    goals:0, assists:0, apps:0, passAcc:79, duelsWon:65, dribbles:4.2, dribbledPast:1.8, interceptions:0.6, chancesCreated:3.1, keyPasses:1.9, rating:0, mins:0},
  {id:4, name:"Lamine Yamal",      nation:"🇪🇸", pos:"FWD", club:"Barcelona",      goals:0, assists:0, apps:0, passAcc:84, duelsWon:54, dribbles:3.8, dribbledPast:1.2, interceptions:0.4, chancesCreated:3.4, keyPasses:2.6, rating:0, mins:0},
  {id:5, name:"Harry Kane",        nation:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", pos:"FWD", club:"Bayern Munich",  goals:0, assists:0, apps:0, passAcc:80, duelsWon:59, dribbles:0.9, dribbledPast:0.4, interceptions:0.5, chancesCreated:2.3, keyPasses:1.8, rating:0, mins:0},
  {id:6, name:"Cristiano Ronaldo", nation:"🇵🇹", pos:"FWD", club:"Al-Nassr",       goals:0, assists:0, apps:0, passAcc:76, duelsWon:55, dribbles:1.4, dribbledPast:0.6, interceptions:0.3, chancesCreated:1.5, keyPasses:1.0, rating:0, mins:0},
  {id:7, name:"Lautaro Martínez",  nation:"🇦🇷", pos:"FWD", club:"Inter Milan",    goals:0, assists:0, apps:0, passAcc:77, duelsWon:60, dribbles:1.8, dribbledPast:0.7, interceptions:0.5, chancesCreated:1.8, keyPasses:1.3, rating:0, mins:0},
  {id:8, name:"Son Heung-min",     nation:"🇰🇷", pos:"FWD", club:"Tottenham",      goals:0, assists:0, apps:0, passAcc:82, duelsWon:56, dribbles:2.4, dribbledPast:1.0, interceptions:0.7, chancesCreated:2.6, keyPasses:2.0, rating:0, mins:0},
  // MID
  {id:9,  name:"Jude Bellingham",  nation:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", pos:"MID", club:"Real Madrid",   goals:0, assists:0, apps:0, passAcc:87, duelsWon:66, dribbles:2.6, dribbledPast:0.9, interceptions:1.2, chancesCreated:3.0, keyPasses:2.4, rating:0, mins:0},
  {id:10, name:"Lionel Messi",     nation:"🇦🇷", pos:"MID", club:"Inter Miami",    goals:0, assists:0, apps:0, passAcc:88, duelsWon:48, dribbles:2.9, dribbledPast:1.1, interceptions:0.6, chancesCreated:4.2, keyPasses:3.8, rating:0, mins:0},
  {id:11, name:"Pedri",            nation:"🇪🇸", pos:"MID", club:"Barcelona",      goals:0, assists:0, apps:0, passAcc:91, duelsWon:58, dribbles:2.2, dribbledPast:0.8, interceptions:1.4, chancesCreated:2.8, keyPasses:2.3, rating:0, mins:0},
  {id:12, name:"Florian Wirtz",    nation:"🇩🇪", pos:"MID", club:"Bayern Munich",  goals:0, assists:0, apps:0, passAcc:89, duelsWon:54, dribbles:3.1, dribbledPast:1.0, interceptions:0.9, chancesCreated:3.3, keyPasses:2.7, rating:0, mins:0},
  {id:13, name:"Rodri",            nation:"🇪🇸", pos:"MID", club:"Man City",       goals:0, assists:0, apps:0, passAcc:93, duelsWon:68, dribbles:1.1, dribbledPast:0.4, interceptions:2.1, chancesCreated:1.8, keyPasses:1.5, rating:0, mins:0},
  {id:14, name:"Jamal Musiala",    nation:"🇩🇪", pos:"MID", club:"Bayern Munich",  goals:0, assists:0, apps:0, passAcc:88, duelsWon:60, dribbles:3.4, dribbledPast:1.1, interceptions:0.8, chancesCreated:3.0, keyPasses:2.4, rating:0, mins:0},
  {id:15, name:"Kevin De Bruyne",  nation:"🇧🇪", pos:"MID", club:"Man City",       goals:0, assists:0, apps:0, passAcc:90, duelsWon:55, dribbles:1.8, dribbledPast:0.6, interceptions:1.1, chancesCreated:4.0, keyPasses:3.5, rating:0, mins:0},
  {id:16, name:"Enzo Fernández",   nation:"🇦🇷", pos:"MID", club:"Chelsea",        goals:0, assists:0, apps:0, passAcc:89, duelsWon:63, dribbles:1.6, dribbledPast:0.7, interceptions:1.8, chancesCreated:2.0, keyPasses:1.7, rating:0, mins:0},
  {id:17, name:"Alexis Mac Allister",nation:"🇦🇷",pos:"MID", club:"Liverpool",    goals:0, assists:0, apps:0, passAcc:90, duelsWon:61, dribbles:1.4, dribbledPast:0.5, interceptions:1.9, chancesCreated:1.9, keyPasses:1.6, rating:0, mins:0},
  {id:18, name:"Federico Valverde",nation:"🇺🇾", pos:"MID", club:"Real Madrid",   goals:0, assists:0, apps:0, passAcc:88, duelsWon:70, dribbles:2.0, dribbledPast:0.7, interceptions:1.7, chancesCreated:2.1, keyPasses:1.8, rating:0, mins:0},
  {id:19, name:"Luka Modrić",      nation:"🇭🇷", pos:"MID", club:"Real Madrid",   goals:0, assists:0, apps:0, passAcc:92, duelsWon:57, dribbles:2.1, dribbledPast:0.8, interceptions:1.6, chancesCreated:3.1, keyPasses:2.8, rating:0, mins:0},
  // DEF
  {id:20, name:"Virgil van Dijk",  nation:"🇳🇱", pos:"DEF", club:"Liverpool",      goals:0, assists:0, apps:0, passAcc:89, duelsWon:72, dribbles:0.3, dribbledPast:0.3, interceptions:1.8, chancesCreated:0.6, keyPasses:0.5, rating:0, mins:0},
  {id:21, name:"Achraf Hakimi",    nation:"🇲🇦", pos:"DEF", club:"PSG",            goals:0, assists:0, apps:0, passAcc:86, duelsWon:64, dribbles:2.1, dribbledPast:0.9, interceptions:1.6, chancesCreated:1.9, keyPasses:1.4, rating:0, mins:0},
  {id:22, name:"William Saliba",   nation:"🇫🇷", pos:"DEF", club:"Arsenal",        goals:0, assists:0, apps:0, passAcc:91, duelsWon:74, dribbles:0.4, dribbledPast:0.2, interceptions:2.2, chancesCreated:0.4, keyPasses:0.3, rating:0, mins:0},
  {id:23, name:"Rúben Dias",       nation:"🇵🇹", pos:"DEF", club:"Man City",       goals:0, assists:0, apps:0, passAcc:90, duelsWon:71, dribbles:0.2, dribbledPast:0.2, interceptions:1.9, chancesCreated:0.3, keyPasses:0.3, rating:0, mins:0},
  {id:24, name:"Joško Gvardiol",   nation:"🇭🇷", pos:"DEF", club:"Man City",       goals:0, assists:0, apps:0, passAcc:87, duelsWon:67, dribbles:1.2, dribbledPast:0.5, interceptions:1.7, chancesCreated:1.1, keyPasses:0.9, rating:0, mins:0},
  // GK
  {id:25, name:"Thibaut Courtois", nation:"🇧🇪", pos:"GK",  club:"Real Madrid",   goals:0, assists:0, apps:0, passAcc:72, duelsWon:0,  dribbles:0,   dribbledPast:0,   interceptions:0,   chancesCreated:0,   keyPasses:0,   rating:0, mins:0},
  {id:26, name:"Alisson Becker",   nation:"🇧🇷", pos:"GK",  club:"Liverpool",     goals:0, assists:0, apps:0, passAcc:75, duelsWon:0,  dribbles:0,   dribbledPast:0,   interceptions:0,   chancesCreated:0,   keyPasses:0,   rating:0, mins:0},
  {id:27, name:"Zion Suzuki",      nation:"🇯🇵", pos:"GK",  club:"Parma",         goals:0, assists:0, apps:0, passAcc:70, duelsWon:0,  dribbles:0,   dribbledPast:0,   interceptions:0,   chancesCreated:0,   keyPasses:0,   rating:0, mins:0},
];

const FACTOR_WEIGHTS = [
  { label:"Recent Team Form",             pct:16, cat:"team",    color:"#2ecc71" },
  { label:"Big-Game Record",              pct:14, cat:"team",    color:"#2ecc71" },
  { label:"Roster Continuity & Chemistry",pct:13, cat:"team",    color:"#2ecc71" },
  { label:"Possession / xG / Tactical",   pct:11, cat:"team",    color:"#2ecc71" },
  { label:"Key Injuries & Squad Depth",   pct:10, cat:"team",    color:"#2ecc71" },
  { label:"Age Balance & Maturity",       pct: 8, cat:"team",    color:"#2ecc71" },
  { label:"Manager Profile (CIS)",        pct:11, cat:"manager", color:"#8bb8f0" },
  { label:"Individual Player Form (IPFI)",pct: 6, cat:"player",  color:"#C9A84C" },
  { label:"Top-5 League Representation",  pct: 2, cat:"context", color:"#8E9BAF" },
  { label:"FIFA Ranking / Elo",           pct: 2, cat:"context", color:"#8E9BAF" },
  { label:"Prestige / Host Advantage",    pct: 2, cat:"context", color:"#8E9BAF" },
  { label:"Pure Luck",                    pct: 5, cat:"luck",    color:"#9b59b6" },
];

const buildSystemPrompt = (teams, updates) => `You are the analytical engine for a FIFA World Cup 2026 prediction tracker. Recalculate championship win probabilities for all teams.

METHODOLOGY WEIGHTS (total=100%):
- Team Factors (72%): Recent Form 16%, Big-Game Record 14%, Roster Continuity/Chemistry 13%, Possession/xG/Tactical 11%, Injuries/Depth 10%, Age Balance 8%
- Manager Factor (11%): Years in post, win rate, trophies, system depth
- Individual IPFI (6%): League-adjusted, minutes-weighted, role-calibrated
- Contextual (6%): Top-5 leagues 2%, FIFA Ranking 2%, Prestige/Host 2%
- Pure Luck (5%): Equalising variance across all teams

CRITICAL: Football at World Cup level is a TEAM sport. Collective organisation > individual brilliance.

CURRENT PROBABILITIES:
${teams.map(t=>`${t.flag} ${t.name}: ${t.prob}%`).join("\n")}

UPDATES:
${updates.length>0?updates.map(u=>`[${u.date}] ${u.type.toUpperCase()}: ${u.text}`).join("\n"):"No updates — using pre-tournament baseline."}

Respond ONLY with valid JSON:
{
  "teams": [{"id":"FRA","prob":18.5,"change":0.5,"reasoning":"brief reason"},...all 18 teams],
  "summary":"2-3 sentence tournament narrative",
  "biggestMover":"team name + why"
}
Probabilities must sum to ~100%. Small changes (0.1–1.5%) for minor updates; large (2–5%) for major events only.`;

// ─────────────────────────────────────────────
//  SHARED STYLES
// ─────────────────────────────────────────────
const tabs = ["Leaderboard","Groups","Bracket","Players","Updates","Weights"];
const probColor = p => p>=14?"#C9A84C":p>=8?"#8bb8f0":p>=4?"#2ecc71":"#8E9BAF";

function ChangeIndicator({change}){
  if(!change||Math.abs(change)<0.05) return <span style={{color:"#444",fontSize:11,fontFamily:"monospace"}}>—</span>;
  const up=change>0;
  return <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:up?"#2ecc71":"#e74c3c",display:"inline-flex",alignItems:"center",gap:2}}>{up?"▲":"▼"} {Math.abs(change).toFixed(1)}%</span>;
}

// ─────────────────────────────────────────────
//  LEADERBOARD TAB
// ─────────────────────────────────────────────
function LeaderboardTab({teams}){
  const [expanded,setExpanded]=useState(null);
  const sorted=[...teams].sort((a,b)=>b.prob-a.prob);
  const max=sorted[0]?.prob||1;
  return (
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
          return (
            <div key={team.id} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${open?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.07)"}`,borderRadius:4,overflow:"hidden",transition:"border 0.2s",cursor:"pointer"}}
              onClick={()=>setExpanded(open?null:team.id)}>
              <div style={{display:"grid",gridTemplateColumns:"32px 28px 1fr 80px 60px 60px 30px",alignItems:"center",gap:10,padding:"11px 16px"}}
                onMouseEnter={e=>e.currentTarget.parentElement.style.background="rgba(255,255,255,0.05)"}
                onMouseLeave={e=>e.currentTarget.parentElement.style.background=open?"rgba(255,255,255,0.03)":"rgba(255,255,255,0.03)"}>
                <div style={{fontFamily:"monospace",fontSize:13,color:"#8E9BAF",textAlign:"center"}}>#{i+1}</div>
                <div style={{fontSize:22}}>{team.flag}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:"#F5F0E8",marginBottom:3}}>{team.name}</div>
                  <div style={{position:"relative",height:4,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${barW}%`,background:`linear-gradient(90deg,${col},${col}88)`,borderRadius:3,transition:"width 0.8s"}}/>
                  </div>
                </div>
                <div style={{textAlign:"right"}}><span style={{fontFamily:"monospace",fontSize:18,fontWeight:700,color:col}}>{team.prob.toFixed(1)}%</span></div>
                <div style={{textAlign:"center"}}><ChangeIndicator change={team.change}/></div>
                <div style={{textAlign:"right",fontSize:11,color:"#8E9BAF",fontFamily:"monospace"}}>Grp {team.group}</div>
                <div style={{color:"#8E9BAF",fontSize:14,textAlign:"center"}}>{open?"▲":"▼"}</div>
              </div>
              {open&&(
                <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",padding:"16px",background:"rgba(0,0,0,0.2)"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:14}}>
                    <div>
                      <div style={{fontSize:10,fontFamily:"monospace",letterSpacing:"0.15em",color:"#2ecc71",marginBottom:6}}>STRENGTHS</div>
                      <div style={{fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.6}}>{team.strengths||"—"}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontFamily:"monospace",letterSpacing:"0.15em",color:"#e74c3c",marginBottom:6}}>WEAKNESSES</div>
                      <div style={{fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.6}}>{team.weaknesses||"—"}</div>
                    </div>
                  </div>
                  <div style={{padding:"10px 14px",background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:4}}>
                    <div style={{fontSize:10,fontFamily:"monospace",letterSpacing:"0.15em",color:"#C9A84C",marginBottom:5}}>PROBABILITY RATIONALE</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",lineHeight:1.6}}>{team.rationale||"—"}</div>
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

// ─────────────────────────────────────────────
//  GROUPS TAB
// ─────────────────────────────────────────────
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
                <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,color:"#C9A84C",lineHeight:1}}>GROUP {group.name}</span>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                    {["Team","W","D","L","GD","Pts"].map(h=>(
                      <th key={h} style={{padding:"6px 8px",fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:"#C9A84C88",textAlign:h==="Team"?"left":"center",fontWeight:400}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t,i)=>(
                    <tr key={t.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:i===0?"rgba(26,94,58,0.15)":i===1?"rgba(26,58,107,0.12)":"transparent"}}>
                      <td style={{padding:"9px 8px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{width:18,height:18,borderRadius:"50%",background:i===0?"#C9A84C":i===1?"#1A3A6B":"rgba(255,255,255,0.1)",color:i===0?"#0A0A0F":"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>
                          <span style={{fontSize:16,flexShrink:0}}>{t.flag}</span>
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

// ─────────────────────────────────────────────
//  BRACKET TAB — enhanced match cards
// ─────────────────────────────────────────────
function EnhancedMatchCard({match,isLast}){
  const [open,setOpen]=useState(false);
  return(
    <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${isLast?"#C9A84C44":open?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.07)"}`,borderRadius:4,overflow:"hidden",cursor:"pointer",boxShadow:isLast?"0 0 20px rgba(201,168,76,0.08)":"none"}}
      onClick={()=>setOpen(!open)}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:match.winner===match.a.name?"rgba(201,168,76,0.08)":"transparent"}}>
        <span style={{fontSize:16,marginRight:8}}>{match.a.flag}</span>
        <span style={{fontWeight:700,fontSize:14,flex:1,color:match.winner===match.a.name?"#E8C97A":"rgba(255,255,255,0.45)",textDecoration:match.winner&&match.winner!==match.a.name?"line-through":"none",textDecorationColor:"rgba(255,255,255,0.2)"}}>{match.a.name}</span>
        <span style={{fontFamily:"monospace",fontSize:12,color:match.winner===match.a.name?"#C9A84C":"rgba(255,255,255,0.25)"}}>{match.a.prob}%</span>
      </div>
      <div style={{height:1,background:"rgba(255,255,255,0.06)",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontFamily:"monospace",fontSize:10,color:"#8E9BAF",background:"#0A0A0F",padding:"0 6px",position:"absolute"}}>vs</span>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:match.winner===match.b.name?"rgba(201,168,76,0.08)":"transparent"}}>
        <span style={{fontSize:16,marginRight:8}}>{match.b.flag}</span>
        <span style={{fontWeight:700,fontSize:14,flex:1,color:match.winner===match.b.name?"#E8C97A":"rgba(255,255,255,0.45)",textDecoration:match.winner&&match.winner!==match.b.name?"line-through":"none",textDecorationColor:"rgba(255,255,255,0.2)"}}>{match.b.name}</span>
        <span style={{fontFamily:"monospace",fontSize:12,color:match.winner===match.b.name?"#C9A84C":"rgba(255,255,255,0.25)"}}>{match.b.prob}%</span>
      </div>
      {open&&match.rationale&&(
        <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",padding:"12px 14px",background:"rgba(0,0,0,0.25)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <div style={{fontSize:9,fontFamily:"monospace",letterSpacing:"0.15em",color:"#2ecc71",marginBottom:4}}>{match.a.name.toUpperCase()} STRENGTHS</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.65)",lineHeight:1.5}}>{match.aStrengths||"—"}</div>
            </div>
            <div>
              <div style={{fontSize:9,fontFamily:"monospace",letterSpacing:"0.15em",color:"#e74c3c",marginBottom:4}}>{match.b.name.toUpperCase()} STRENGTHS</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.65)",lineHeight:1.5}}>{match.bStrengths||"—"}</div>
            </div>
          </div>
          <div style={{padding:"8px 12px",background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.18)",borderRadius:3}}>
            <div style={{fontSize:9,fontFamily:"monospace",letterSpacing:"0.15em",color:"#C9A84C",marginBottom:4}}>WHY THIS WINNER</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",lineHeight:1.5}}>{match.rationale}</div>
          </div>
        </div>
      )}
      {!open&&<div style={{textAlign:"center",padding:"3px",fontSize:10,color:"rgba(255,255,255,0.2)"}}>▼ expand</div>}
    </div>
  );
}

function BracketTab({bracket}){
  return(
    <div>
      <div style={{marginBottom:20,fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase"}}>Knockout Bracket — Click Any Matchup to Expand Analysis</div>
      <div style={{padding:"10px 14px",background:"rgba(201,168,76,0.05)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:4,marginBottom:24,fontSize:13,color:"#8E9BAF",fontStyle:"italic"}}>
        Predicted bracket based on group projection. Click any card to see both teams' strengths and the rationale behind the predicted winner.
      </div>
      {bracket.map((round,ri)=>(
        <div key={ri} style={{marginBottom:36}}>
          <div style={{fontFamily:"monospace",fontSize:11,letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase",marginBottom:12,paddingBottom:8,borderBottom:"1px solid rgba(201,168,76,0.2)"}}>{round.round}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
            {round.matches.map((match,mi)=>(
              <EnhancedMatchCard key={mi} match={match} isLast={ri===bracket.length-1}/>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
//  PLAYERS TAB
// ─────────────────────────────────────────────
const POS_COLORS = { FWD:"#e74c3c", MID:"#2ecc71", DEF:"#8bb8f0", GK:"#C9A84C" };
const STAT_COLS = [
  {key:"goals",      label:"G",     title:"Goals"},
  {key:"assists",    label:"A",     title:"Assists"},
  {key:"apps",       label:"Apps",  title:"Appearances"},
  {key:"rating",     label:"Rtg",   title:"Avg Match Rating (0-10)"},
  {key:"passAcc",    label:"Pass%", title:"Pass Accuracy %"},
  {key:"duelsWon",   label:"Dls%",  title:"Duels Won %"},
  {key:"dribbles",   label:"Drb",   title:"Successful Dribbles per 90"},
  {key:"dribbledPast",label:"DP",   title:"Times Dribbled Past per 90"},
  {key:"interceptions",label:"Int", title:"Interceptions per 90"},
  {key:"chancesCreated",label:"CC", title:"Chances Created per 90"},
  {key:"keyPasses",  label:"KP",    title:"Key Passes per 90"},
];

function calcFantasyScore(p){
  if(p.apps===0) return 0;
  // Goals and assists are match-accumulated; per-90 stats are averages
  let score = (p.goals*6) + (p.assists*4) + (p.apps*1) +
    ((p.passAcc-70)*0.05) + ((p.duelsWon-50)*0.04) +
    (p.dribbles*0.8) - (p.dribbledPast*0.5) +
    (p.interceptions*0.6) + (p.chancesCreated*0.9) + (p.keyPasses*0.5);
  if(p.pos==="GK") score = p.apps*3; // GK scoring handled separately
  return Math.max(0,parseFloat(score.toFixed(1)));
}

function PlayersTab({players,setPlayers}){
  const [filterPos,setFilterPos]=useState("ALL");
  const [sortKey,setSortKey]=useState("fantasy");
  const [editId,setEditId]=useState(null);
  const [editData,setEditData]=useState({});

  const withScores = players.map(p=>({...p, fantasy:calcFantasyScore(p)}));
  const filtered = filterPos==="ALL"?withScores:withScores.filter(p=>p.pos===filterPos);
  const sorted = [...filtered].sort((a,b)=>sortKey==="fantasy"?(b.fantasy-a.fantasy):(b[sortKey]??0)-(a[sortKey]??0));

  const startEdit = (p) => { setEditId(p.id); setEditData({...p}); };
  const saveEdit = () => {
    setPlayers(prev=>prev.map(p=>p.id===editId?{...editData,id:editId}:p));
    setEditId(null);
  };

  return(
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase",marginBottom:6}}>Player Performance Leaderboard</div>
        <div style={{fontSize:13,color:"#8E9BAF",marginBottom:16,maxWidth:700}}>
          Fantasy-league scoring: Goals (×6), Assists (×4), Appearances (×1), adjusted by pass accuracy, duels, dribbles, interceptions, and chance creation. Click a player to update stats. Pre-tournament values show per-90 averages from club season.
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {["ALL","FWD","MID","DEF","GK"].map(pos=>(
            <button key={pos} onClick={()=>setFilterPos(pos)} style={{
              background:filterPos===pos?(POS_COLORS[pos]||"#C9A84C"):"rgba(255,255,255,0.05)",
              color:filterPos===pos?"#0A0A0F":"#8E9BAF",
              border:`1px solid ${filterPos===pos?(POS_COLORS[pos]||"#C9A84C"):"rgba(255,255,255,0.1)"}`,
              borderRadius:3,padding:"5px 12px",fontSize:11,fontFamily:"monospace",letterSpacing:"0.1em",cursor:"pointer",fontWeight:600
            }}>{pos}</button>
          ))}
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,fontFamily:"monospace",color:"#8E9BAF"}}>SORT BY</span>
            <select value={sortKey} onChange={e=>setSortKey(e.target.value)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:3,padding:"5px 8px",color:"#F5F0E8",fontSize:11,fontFamily:"monospace"}}>
              <option value="fantasy">Fantasy Score</option>
              {STAT_COLS.map(c=><option key={c.key} value={c.key}>{c.title}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editId&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#14141C",border:"1px solid rgba(201,168,76,0.3)",borderRadius:8,padding:28,width:"100%",maxWidth:580,maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.2em",color:"#C9A84C",marginBottom:4}}>UPDATE PLAYER STATS</div>
            <div style={{fontSize:18,fontWeight:700,color:"#F5F0E8",marginBottom:20}}>{editData.name}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              {[
                {key:"goals",label:"Goals",type:"number",min:0},
                {key:"assists",label:"Assists",type:"number",min:0},
                {key:"apps",label:"Appearances",type:"number",min:0},
                {key:"mins",label:"Total Minutes",type:"number",min:0},
                {key:"rating",label:"Avg Rating (0-10)",type:"number",min:0,max:10,step:0.1},
                {key:"passAcc",label:"Pass Accuracy %",type:"number",min:0,max:100},
                {key:"duelsWon",label:"Duels Won %",type:"number",min:0,max:100},
                {key:"dribbles",label:"Dribbles per 90",type:"number",min:0,step:0.1},
                {key:"dribbledPast",label:"Dribbled Past per 90",type:"number",min:0,step:0.1},
                {key:"interceptions",label:"Interceptions per 90",type:"number",min:0,step:0.1},
                {key:"chancesCreated",label:"Chances Created per 90",type:"number",min:0,step:0.1},
                {key:"keyPasses",label:"Key Passes per 90",type:"number",min:0,step:0.1},
              ].map(({key,label,type,...rest})=>(
                <div key={key}>
                  <div style={{fontSize:10,fontFamily:"monospace",color:"#8E9BAF",letterSpacing:"0.1em",marginBottom:4}}>{label.toUpperCase()}</div>
                  <input type={type} value={editData[key]??""} {...rest}
                    onChange={e=>setEditData(d=>({...d,[key]:parseFloat(e.target.value)||0}))}
                    style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:3,padding:"7px 10px",color:"#F5F0E8",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={saveEdit} style={{flex:1,background:"linear-gradient(135deg,#C9A84C,#E8C97A)",color:"#0A0A0F",border:"none",borderRadius:4,padding:"10px",fontSize:12,fontWeight:700,fontFamily:"monospace",letterSpacing:"0.1em",cursor:"pointer",textTransform:"uppercase"}}>Save Stats</button>
              <button onClick={()=>setEditId(null)} style={{background:"rgba(255,255,255,0.05)",color:"#8E9BAF",border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,padding:"10px 20px",fontSize:12,fontFamily:"monospace",cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* LEADERBOARD TABLE */}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:900}}>
          <thead>
            <tr style={{borderBottom:"2px solid rgba(201,168,76,0.3)"}}>
              <th style={{padding:"8px 10px",fontFamily:"monospace",fontSize:10,letterSpacing:"0.12em",color:"#C9A84C",textAlign:"left",fontWeight:400}}>#</th>
              <th style={{padding:"8px 10px",fontFamily:"monospace",fontSize:10,letterSpacing:"0.12em",color:"#C9A84C",textAlign:"left",fontWeight:400}}>Player</th>
              <th style={{padding:"8px 6px",fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:"#9b59b6",textAlign:"center",fontWeight:700,cursor:"pointer"}} onClick={()=>setSortKey("fantasy")} title="Fantasy Score">FAN</th>
              {STAT_COLS.map(c=>(
                <th key={c.key} style={{padding:"8px 6px",fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:sortKey===c.key?"#F5F0E8":"#8E9BAF",textAlign:"center",fontWeight:sortKey===c.key?700:400,cursor:"pointer",whiteSpace:"nowrap"}}
                  onClick={()=>setSortKey(c.key)} title={c.title}>{c.label}</th>
              ))}
              <th style={{padding:"8px 6px",fontFamily:"monospace",fontSize:10,color:"#8E9BAF",textAlign:"center",fontWeight:400}}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p,i)=>(
              <tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:i<3?"rgba(201,168,76,0.04)":"transparent",transition:"background 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                onMouseLeave={e=>e.currentTarget.style.background=i<3?"rgba(201,168,76,0.04)":"transparent"}>
                <td style={{padding:"9px 10px",fontFamily:"monospace",fontSize:12,color:"#8E9BAF"}}>{i+1}</td>
                <td style={{padding:"9px 10px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:15}}>{p.nation}</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:"#F5F0E8"}}>{p.name}</div>
                      <div style={{display:"flex",gap:6,marginTop:2}}>
                        <span style={{fontSize:10,fontFamily:"monospace",padding:"1px 5px",borderRadius:2,background:POS_COLORS[p.pos]+"22",color:POS_COLORS[p.pos],border:`1px solid ${POS_COLORS[p.pos]}44`}}>{p.pos}</span>
                        <span style={{fontSize:10,color:"#8E9BAF"}}>{p.club}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{padding:"9px 6px",textAlign:"center"}}>
                  <span style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:"#9b59b6"}}>{p.fantasy}</span>
                </td>
                {STAT_COLS.map(c=>(
                  <td key={c.key} style={{padding:"9px 6px",textAlign:"center",fontFamily:["goals","assists","apps"].includes(c.key)?"monospace":"inherit",
                    color:c.key==="goals"?"#e74c3c":c.key==="assists"?"#2ecc71":c.key==="rating"?(p[c.key]>=8?"#C9A84C":p[c.key]>=7?"#F5F0E8":"#8E9BAF"):"#F5F0E8",
                    fontWeight:["goals","assists"].includes(c.key)?700:400,fontSize:c.key==="goals"||c.key==="assists"?14:13}}>
                    {p[c.key]??0}
                  </td>
                ))}
                <td style={{padding:"9px 6px",textAlign:"center"}}>
                  <button onClick={()=>startEdit(p)} style={{background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:3,padding:"3px 8px",fontSize:11,color:"#C9A84C",cursor:"pointer",fontFamily:"monospace"}}>✎</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{marginTop:16,padding:"12px 16px",background:"rgba(155,89,182,0.06)",border:"1px solid rgba(155,89,182,0.2)",borderRadius:4,fontSize:12,color:"#8E9BAF"}}>
        <strong style={{color:"#b39ddb"}}>Fantasy Scoring Formula:</strong> Goals ×6 · Assists ×4 · Apps ×1 · Pass Accuracy bonus · Duels Won bonus · Dribbles ×0.8 · Dribbled Past penalty ×−0.5 · Interceptions ×0.6 · Chances Created ×0.9 · Key Passes ×0.5. Click ✎ to update any player's stats after each match.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  UPDATES TAB
// ─────────────────────────────────────────────
const UPDATE_TYPES = ["result","injury","fitness","suspension","tactical","news"];
const UPDATE_COLORS = { result:"#2ecc71", injury:"#e74c3c", fitness:"#f39c12", suspension:"#e67e22", tactical:"#8bb8f0", news:"#8E9BAF" };

function UpdatesTab({updates,onAdd}){
  const [type,setType]=useState("result");
  const [text,setText]=useState("");
  const [team,setTeam]=useState("");
  return(
    <div>
      <div style={{marginBottom:20,fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase"}}>Intelligence Feed — Manual Update Input</div>
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:20,marginBottom:28}}>
        <div style={{fontSize:13,color:"#8E9BAF",marginBottom:16}}>Enter any new information — match result, injury news, squad update, tactical change — and the AI engine will recalculate all probabilities.</div>
        <div style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:12,marginBottom:12}}>
          <div>
            <div style={{fontSize:11,fontFamily:"monospace",color:"#C9A84C",letterSpacing:"0.1em",marginBottom:6}}>UPDATE TYPE</div>
            <select value={type} onChange={e=>setType(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,padding:"8px 10px",color:"#F5F0E8",fontSize:13,fontFamily:"monospace",cursor:"pointer"}}>
              {UPDATE_TYPES.map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,fontFamily:"monospace",color:"#C9A84C",letterSpacing:"0.1em",marginBottom:6}}>TEAM AFFECTED (optional)</div>
            <input value={team} onChange={e=>setTeam(e.target.value)} placeholder="e.g. France, Argentina…" style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,padding:"8px 10px",color:"#F5F0E8",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontFamily:"monospace",color:"#C9A84C",letterSpacing:"0.1em",marginBottom:6}}>UPDATE DETAILS</div>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="e.g. 'France beat Germany 2-0 in a dominant Group I win. Mbappé scored twice. Griezmann picked up a yellow card.'" rows={4} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,padding:"10px 12px",color:"#F5F0E8",fontSize:14,resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.6,fontFamily:"Georgia,serif"}}/>
        </div>
        <button onClick={()=>{if(!text.trim())return;onAdd({type,team,text,date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})});setText("");setTeam("");}} style={{background:"linear-gradient(135deg,#C9A84C,#E8C97A)",color:"#0A0A0F",border:"none",borderRadius:4,padding:"10px 24px",fontSize:12,fontWeight:700,fontFamily:"monospace",letterSpacing:"0.1em",cursor:"pointer",textTransform:"uppercase"}}>
          + Add to Feed
        </button>
      </div>
      <div style={{background:"rgba(91,142,219,0.06)",border:"1px dashed rgba(91,142,219,0.35)",borderRadius:6,padding:16,marginBottom:28}}>
        <div style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.2em",color:"#8bb8f0",marginBottom:8}}>⚡ API INTEGRATION HOOK — AUTO-UPDATE READY</div>
        <div style={{fontSize:13,color:"#8E9BAF",lineHeight:1.6}}>When a live sports API is connected (API-Football, SportsData.io, RapidAPI), match results, goals, injuries, and player stats feed here automatically — replacing manual entry. See the Integration Guide below for step-by-step instructions.</div>
        <div style={{marginTop:10,fontFamily:"monospace",fontSize:12,color:"rgba(91,142,219,0.7)",padding:"8px 12px",background:"rgba(0,0,0,0.3)",borderRadius:4}}>
          {"// Attach your API fetcher here:"}<br/>
          {"// fetchMatchResults(matchId) → formatAsUpdate() → onAdd(update)"}<br/>
          {"// fetchPlayerStats(matchId) → updatePlayerLeaderboard(stats)"}<br/>
          {"// Recommended: poll every 5 min live, hourly otherwise"}
        </div>
      </div>
      {updates.length===0?(
        <div style={{textAlign:"center",padding:"40px 20px",color:"#8E9BAF",fontSize:14,fontStyle:"italic"}}>No updates logged yet. Add information above to begin.</div>
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

// ─────────────────────────────────────────────
//  WEIGHTS TAB
// ─────────────────────────────────────────────
function WeightsTab(){
  const cats={team:"Team Collective",manager:"Managerial",player:"Individual",context:"Contextual",luck:"Pure Luck"};
  const catColors={team:"#2ecc71",manager:"#8bb8f0",player:"#C9A84C",context:"#8E9BAF",luck:"#9b59b6"};
  const grouped={};
  FACTOR_WEIGHTS.forEach(f=>{if(!grouped[f.cat])grouped[f.cat]=[];grouped[f.cat].push(f);});
  const catTotals=Object.fromEntries(Object.entries(grouped).map(([k,v])=>[k,v.reduce((s,f)=>s+f.pct,0)]));
  return(
    <div>
      <div style={{marginBottom:20,fontSize:11,fontFamily:"monospace",letterSpacing:"0.25em",color:"#C9A84C",textTransform:"uppercase"}}>Factor Weights — Methodology Transparency</div>
      <div style={{marginBottom:20,padding:16,background:"rgba(46,204,113,0.05)",border:"1px solid rgba(46,204,113,0.2)",borderRadius:4,fontSize:13,color:"#8E9BAF"}}>
        <strong style={{color:"#2ecc71"}}>Core principle:</strong> Team-level factors account for <strong style={{color:"#2ecc71"}}>72%</strong>. Manager factor: <strong style={{color:"#8bb8f0"}}>11%</strong>. Individual player form capped at <strong style={{color:"#C9A84C"}}>6%</strong>. Contextual: <strong style={{color:"#8E9BAF"}}>6%</strong>. Pure Luck: <strong style={{color:"#9b59b6"}}>5%</strong>. <strong style={{color:"#F5F0E8"}}>Total: 100%.</strong>
      </div>
      {Object.entries(grouped).map(([cat,factors])=>(
        <div key={cat} style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.2em",color:catColors[cat],textTransform:"uppercase"}}>{cats[cat]} Factors</div>
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

// ─────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────
export default function App(){
  const [activeTab,setActiveTab]=useState("Leaderboard");
  const [teams,setTeams]=useState(INITIAL_TEAMS);
  const [groups]=useState(INITIAL_GROUPS);
  const [bracket]=useState(PREDICTED_KNOCKOUT);
  const [players,setPlayers]=useState(INITIAL_PLAYERS);
  const [updates,setUpdates]=useState([]);
  const [loading,setLoading]=useState(false);
  const [aiSummary,setAiSummary]=useState("Pre-tournament baseline active. France (18%), Argentina (15%), and Spain (14%) lead. Click any team on the Leaderboard for detailed strengths, weaknesses, and probability rationale. Check the Players tab for the performance leaderboard.");
  const [biggestMover,setBiggestMover]=useState(null);
  const [lastRefresh,setLastRefresh]=useState(null);
  const [error,setError]=useState(null);

  const addUpdate=useCallback(update=>setUpdates(prev=>[...prev,update]),[]);

  const runAnalysis=async()=>{
    setLoading(true);setError(null);
    try{
      const res=await fetch("https://wc2026-fetcher.onrender.com",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:buildSystemPrompt(teams,updates),messages:[{role:"user",content:"Recalculate all championship win probabilities. Return only the JSON."}]})
      });
      const data=await res.json();
      const raw=data.content?.find(c=>c.type==="text")?.text||"";
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setTeams(prev=>prev.map(t=>{
        const u=parsed.teams?.find(x=>x.id===t.id);
        return u?{...t,prob:u.prob,change:u.change||0}:t;
      }));
      if(parsed.summary)setAiSummary(parsed.summary);
      if(parsed.biggestMover)setBiggestMover(parsed.biggestMover);
      setLastRefresh(new Date().toLocaleTimeString());
    }catch(e){setError("Analysis failed. Check console and try again.");console.error(e);}
    setLoading(false);
  };

  const sortedTop3=[...teams].sort((a,b)=>b.prob-a.prob).slice(0,3);

  return(
    <div style={{minHeight:"100vh",background:"#0A0A0F",color:"#F5F0E8",fontFamily:"Georgia,serif",fontSize:16}}>
      {/* HEADER */}
      <div style={{background:"#14141C",borderBottom:"1px solid rgba(201,168,76,0.25)",padding:"20px 24px 0",position:"sticky",top:0,zIndex:100,boxShadow:"0 4px 24px rgba(0,0,0,0.4)"}}>
        <div style={{maxWidth:1160,margin:"0 auto"}}>
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
              {sortedTop3.map((t,i)=>(
                <div key={t.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:4,padding:"6px 12px",textAlign:"center",minWidth:80}}>
                  <div style={{fontSize:18}}>{t.flag}</div>
                  <div style={{fontFamily:"monospace",fontSize:14,fontWeight:700,color:probColor(t.prob)}}>{t.prob.toFixed(1)}%</div>
                  <div style={{fontSize:11,color:"#8E9BAF"}}>{t.name}</div>
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
                {tab}
                {tab==="Updates"&&updates.length>0&&<span style={{marginLeft:6,background:"#C9A84C",color:"#0A0A0F",borderRadius:10,padding:"1px 5px",fontSize:9,fontWeight:700}}>{updates.length}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI SUMMARY BANNER */}
      <div style={{background:"rgba(201,168,76,0.06)",borderBottom:"1px solid rgba(201,168,76,0.15)",padding:"10px 24px"}}>
        <div style={{maxWidth:1160,margin:"0 auto",display:"flex",gap:12,alignItems:"flex-start"}}>
          <span style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:"#C9A84C",flexShrink:0,marginTop:3}}>AI ANALYSIS</span>
          <span style={{fontSize:14,color:"#8E9BAF",lineHeight:1.6}}>{aiSummary}</span>
        </div>
        {biggestMover&&<div style={{maxWidth:1160,margin:"4px auto 0",display:"flex",gap:12,alignItems:"center"}}><span style={{fontFamily:"monospace",fontSize:10,letterSpacing:"0.1em",color:"#2ecc71",flexShrink:0}}>BIGGEST MOVER</span><span style={{fontSize:13,color:"#2ecc71"}}>{biggestMover}</span></div>}
        {error&&<div style={{maxWidth:1160,margin:"4px auto 0",display:"flex",gap:12,alignItems:"center"}}><span style={{fontFamily:"monospace",fontSize:10,color:"#e74c3c",flexShrink:0}}>ERROR</span><span style={{fontSize:13,color:"#e74c3c"}}>{error}</span></div>}
      </div>

      {/* MAIN CONTENT */}
      <div style={{maxWidth:1160,margin:"0 auto",padding:"32px 24px"}}>
        {activeTab==="Leaderboard" && <LeaderboardTab teams={teams}/>}
        {activeTab==="Groups"      && <GroupsTab groups={groups}/>}
        {activeTab==="Bracket"     && <BracketTab bracket={bracket}/>}
        {activeTab==="Players"     && <PlayersTab players={players} setPlayers={setPlayers}/>}
        {activeTab==="Updates"     && <UpdatesTab updates={updates} onAdd={addUpdate}/>}
        {activeTab==="Weights"     && <WeightsTab/>}
      </div>

      <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"20px 24px",textAlign:"center",fontFamily:"monospace",fontSize:11,color:"rgba(255,255,255,0.2)",letterSpacing:"0.1em"}}>
        FIFA WORLD CUP 2026 · LIVE PREDICTION ENGINE · 16-FACTOR MODEL · POWERED BY CLAUDE
      </div>

      <style>{`
        *{box-sizing:border-box;}
        @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:#0A0A0F;}
        ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.3);border-radius:3px;}
        select option{background:#14141C;color:#F5F0E8;}
        textarea::placeholder,input::placeholder{color:rgba(255,255,255,0.25);}
      `}</style>
    </div>
  );
}
