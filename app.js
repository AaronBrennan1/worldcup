/* ============================================================
   WC26 Hub — vanilla SPA (hash routing)
   ============================================================ */
const D = window.WC_DATA;
const app = document.getElementById("app");
const CONF = ["UEFA","CONMEBOL","CONCACAF","CAF","AFC","OFC"];
const $ = (s, r=document) => r.querySelector(s);

const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = v => v==null||v===""?"–":v;
const teamsArr = () => Object.values(D.teams);
const byCode = c => D.teams[c];
const confColor = c => `var(--conf-${c})`;
const confTag = c => `<span class="tag-conf" style="background:${confColor(c)};color:#0a0b0d">${c}</span>`;
const groupOf = code => byCode(code)?.group;

/* ---------- router ---------- */
const routes = {
  "": home, "groups": groups, "bracket": bracket, "countries": countries,
  "country": country, "players": players, "stats": stats, "odds": odds, "fantasy": fantasy,
};
function parseHash(){
  const h = location.hash.replace(/^#\/?/,"");
  const [r,...rest] = h.split("/");
  return [r||"", rest];
}
function render(){
  const [r,rest] = parseHash();
  const fn = routes[r] || notfound;
  app.innerHTML = "";
  fn(rest);
  // nav active
  document.querySelectorAll("nav.main a").forEach(a=>{
    const ar = a.getAttribute("href").replace(/^#\/?/,"").split("/")[0];
    a.classList.toggle("active", ar===r);
  });
  $("#nav").classList.remove("open");
  window.scrollTo(0,0);
}
window.addEventListener("hashchange", render);
$("#menuBtn").addEventListener("click", ()=>$("#nav").classList.toggle("open"));

/* ---------- HOME ---------- */
function home(){
  const s = D.meta.summary;
  const tiles = [
    ["#/groups","Groups","All 12 groups · 48 nations, drawn Dec 2025.","01"],
    ["#/bracket","Knockout Bracket","Round of 32 through the Final in New York/NJ.","02"],
    ["#/countries","Countries","Every qualified nation — tap through to its page.","03"],
    ["#/players","Player Stats","Qualifying leaderboards. Live WC data lands later.","04"],
    ["#/stats","Team Stats","Attack, defence, xG and discipline rankings.","05"],
    ["#/odds","Betting Odds","Live odds feed.","06","soon"],
    ["#/fantasy","Fantasy Zone","Build your XI and play.","07","soon"],
  ];
  app.innerHTML = `
  <section class="hero">
    <div class="kicker">USA · Canada · Mexico — 11 Jun → 19 Jul 2026</div>
    <h1>WORLD<br><span class="a">CUP</span> <span class="b">26</span></h1>
    <p>The first 48-team World Cup. Twelve groups, a new Round of 32, and 104 matches across three nations. Your hub for groups, the bracket, every country, and the numbers behind them.</p>
    <a class="btn lime" href="#/groups">Explore the groups →</a>
    <a class="btn" href="#/bracket">See the bracket</a>
    <div class="meta">
      <div><b>${s.total_teams}</b><span>Teams</span></div>
      <div><b>${s.total_groups}</b><span>Groups</span></div>
      <div><b>104</b><span>Matches</span></div>
      <div><b>${s.debut_nations.length}</b><span>Debutants</span></div>
      <div><b>3</b><span>Hosts</span></div>
    </div>
  </section>
  <div class="tiles">
    ${tiles.map(([href,t,p,no,soon])=>`
      <a class="tile ${soon?"soon":""}" href="${href}">
        ${soon?`<span class="soonbadge">Coming soon</span>`:""}
        <h3>${t}</h3><p>${p}</p>
        <span class="no">${no}</span>
        <span class="arr">${soon?"Preview":"Open →"}</span>
      </a>`).join("")}
  </div>`;
}

/* ---------- GROUPS ---------- */
function teamRow(code){
  const t = byCode(code);
  return `<a class="trow" href="#/country/${code}">
    <span class="fl">${t.flag}</span>
    <span class="nm">${esc(t.name)}
      ${t.host?'<span class="badge-h">Host</span>':""}
      ${t.debut?'<span class="badge-d">Debut</span>':""}
    </span>
    <span class="tag-conf" style="background:${confColor(t.conf)};color:#0a0b0d">${t.conf}</span>
  </a>`;
}
function groups(){
  app.innerHTML = `
    <div class="kicker">The Draw</div>
    <div class="sec-h"><h1>Groups</h1><span class="pill">12 groups · 4 per group</span></div>
    <p class="muted" style="max-width:620px;margin-bottom:22px">Group winners and runners-up advance automatically; the eight best third-placed teams join them in the Round of 32. Tap any nation for its full page.</p>
    <div class="grid-groups">
      ${Object.entries(D.groups).map(([g,codes])=>`
        <div class="card gcard">
          <div class="gh"><span class="gl">Group <b>${g}</b></span>
            <a class="pill" href="#/bracket">bracket →</a></div>
          ${codes.map(teamRow).join("")}
        </div>`).join("")}
    </div>`;
}

/* ---------- COUNTRIES ---------- */
function countries(){
  app.innerHTML = `
    <div class="kicker">48 Nations</div>
    <div class="sec-h"><h1>Countries</h1></div>
    <div class="filters">
      <input id="csearch" placeholder="Search a nation…">
      <button class="chip on" data-c="ALL">All</button>
      ${CONF.map(c=>`<button class="chip" data-c="${c}">${c}</button>`).join("")}
    </div>
    <div class="grid-c" id="cgrid"></div>`;
  let conf="ALL", q="";
  const grid = $("#cgrid");
  const draw = ()=>{
    const list = teamsArr().filter(t=>
      (conf==="ALL"||t.conf===conf) &&
      t.name.toLowerCase().includes(q.toLowerCase())
    ).sort((a,b)=>a.name.localeCompare(b.name));
    grid.innerHTML = list.length? list.map(t=>`
      <a class="ccard" href="#/country/${t.code}">
        <span class="gtag">${t.group}</span>
        <div class="fl">${t.flag}</div>
        <div class="cn">${esc(t.name)}</div>
        <div class="cm"><span class="conf-dot" style="background:${confColor(t.conf)}"></span>${t.conf}
          ${t.host?" · Host":""}${t.debut?" · Debut":""}</div>
      </a>`).join("") : `<div class="empty">No nations match.</div>`;
  };
  $("#csearch").addEventListener("input",e=>{q=e.target.value;draw()});
  document.querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".chip").forEach(x=>x.classList.remove("on"));
    b.classList.add("on"); conf=b.dataset.c; draw();
  }));
  draw();
}

/* ---------- COUNTRY PAGE ---------- */
function statBlock(label,val){return `<div class="stat"><b>${fmt(val)}</b><span>${label}</span></div>`}
function country(rest){
  const code = rest[0];
  const t = byCode(code);
  if(!t){ return notfound(); }
  const s = t.stats;
  const groupCodes = D.groups[t.group];

  // record bar
  let recHtml = "";
  if(s && s.matches_played){
    const w=s.wins||0,d=s.draws||0,l=s.losses||0,tot=w+d+l||1;
    recHtml = `<div class="recordbar">
      <div class="w" style="flex:${w||0.001}">${w}W</div>
      <div class="d" style="flex:${d||0.001}">${d}D</div>
      <div class="l" style="flex:${l||0.001}">${l}L</div></div>`;
  }

  // qualification stats panel
  let qual;
  if(s){
    qual = `<div class="card panel">
      <h3>Qualification Stats</h3>
      ${recHtml}
      <p class="muted" style="font-size:13px;margin:0 0 14px">${s.matches_played||0} qualifiers played · ${t.conf} campaign.</p>
      <div class="statgrid">
        ${statBlock("Played",s.matches_played)}
        ${statBlock("Points/Game",s.points_per_game)}
        ${statBlock("Goals For",s.goals_scored)}
        ${statBlock("Goals Against",s.goals_conceded)}
        ${statBlock("Goal Diff",s.goal_difference)}
        ${statBlock("Clean Sheets",s.clean_sheets)}
        ${statBlock("xG / match",s.xg_for_avg_overall)}
        ${statBlock("xGA / match",s.xg_against_avg_overall)}
        ${statBlock("Avg Poss %",s.average_possession)}
        ${statBlock("Shots/Match",s.shots&&s.matches_played?Math.round(s.shots/s.matches_played*10)/10:null)}
        ${statBlock("Win %",s.win_percentage)}
        ${statBlock("Cards",s.cards_total)}
      </div></div>`;
  } else if(t.host){
    qual = `<div class="card panel"><h3>Qualification Stats</h3>
      <div class="empty">${esc(t.name)} qualified automatically as a <b>host nation</b>, so it played no qualifying matches. Live tournament stats will appear here once the World Cup begins.</div></div>`;
  } else {
    qual = `<div class="card panel"><h3>Qualification Stats</h3>
      <div class="empty">No qualification dataset available for ${esc(t.name)} yet.</div></div>`;
  }

  // group panel
  const grp = `<div class="card panel"><h3>Group ${t.group}</h3>
    ${groupCodes.map(c=>{const o=byCode(c);const me=c===code;
      return `<a class="trow" href="#/country/${c}" style="${me?'background:var(--ink3)':''}">
        <span class="fl">${o.flag}</span>
        <span class="nm">${esc(o.name)}${me?' <small>(this team)</small>':''}</span>
        <span class="tag-conf" style="background:${confColor(o.conf)};color:#0a0b0d">${o.conf}</span></a>`;
    }).join("")}</div>`;

  // lineup
  let lineup;
  if(t.xi && t.xi.length){
    lineup = `<div class="card panel"><h3>Expected Lineup</h3>
      <p class="muted" style="font-size:12.5px;margin:-6px 0 14px">Probable XI estimated from minutes played in qualifying (4-3-3). Real club affiliations arrive with live tournament data; for now each card shows position &amp; listed nationality.</p>
      ${pitch(t.xi, t.name)}
      <h3 style="margin-top:22px;font-size:16px">Bench</h3>
      <div class="statgrid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
        ${t.bench.map(p=>`<div class="stat"><b style="font-size:14px;font-family:'Hanken Grotesque';font-weight:800">${esc(p.name)}</b>
          <span>${esc(p.pos)}${p.nat&&p.nat!==t.name?" · "+esc(p.nat):""}</span></div>`).join("")||'<div class="muted">—</div>'}
      </div></div>`;
  } else {
    const why = t.player_source==="europe_na"
      ? `Player-level data for European (UEFA) qualifiers isn't in this dataset yet, so an expected XI can't be generated for ${esc(t.name)} at the moment.`
      : `No player dataset available for ${esc(t.name)} yet.`;
    lineup = `<div class="card panel"><h3>Expected Lineup</h3><div class="empty">${why}</div></div>`;
  }

  // squad table
  let squad = "";
  if(t.squad && t.squad.length){
    squad = `<div class="card panel"><h3>Squad — Qualifying Minutes</h3>
      <div class="tbl-wrap"><table class="dt" id="sqt">
      <thead><tr>
        <th data-k="name" data-t="s">Player</th><th data-k="pos" data-t="s">Pos</th>
        <th data-k="nat" data-t="s">Nationality</th><th data-k="age" class="num">Age</th>
        <th data-k="app" class="num">Apps</th><th data-k="min" class="num">Mins</th>
        <th data-k="g" class="num">G</th><th data-k="a" class="num">A</th>
        <th data-k="yc" class="num">YC</th></tr></thead>
      <tbody></tbody></table></div></div>`;
  }

  const histNote = `<div class="card panel"><h3>Previous Games</h3>
    <div class="empty">Match-by-match results aren't in the current dataset. This panel will fill with ${esc(t.name)}'s recent fixtures &amp; World Cup history once live match data is wired in.</div></div>`;

  app.innerHTML = `
    <div class="crumbs"><a href="#/countries">Countries</a> · Group ${t.group}</div>
    <div class="cp-hero">
      <div class="bigflag">${t.flag}</div>
      <div>
        <h1>${esc(t.name)}</h1>
        <div class="sub">
          ${confTag(t.conf)}
          <span class="pill">Group ${t.group}</span>
          ${t.host?'<span class="pill" style="border-color:var(--lime);color:var(--lime)">Host nation</span>':""}
          ${t.debut?'<span class="pill" style="border-color:var(--mag);color:var(--mag)">World Cup debut</span>':""}
        </div>
      </div>
    </div>
    <div class="cols">${grp}${qual}</div>
    ${lineup}
    ${squad}
    ${histNote}`;

  if(t.squad && t.squad.length) makeSortable($("#sqt"), t.squad.slice(), renderSquadRows);
}
function renderSquadRows(tbody, rows){
  tbody.innerHTML = rows.map(p=>`<tr>
    <td class="name">${esc(p.name)}</td><td>${esc(p.pos)}</td><td>${esc(p.nat||"—")}</td>
    <td class="num">${fmt(p.age)}</td><td class="num">${p.app}</td><td class="num">${p.min}</td>
    <td class="num">${p.g}</td><td class="num">${p.a}</td><td class="num">${p.yc}</td></tr>`).join("");
}
function pitch(xi, teamName){
  const rows = {Goalkeeper:[],Defender:[],Midfielder:[],Forward:[],Other:[]};
  xi.forEach(p=>(rows[p.pos]||rows.Other).push(p));
  const lines = [
    [rows.Forward, 86, false],
    [rows.Midfielder, 60, false],
    [rows.Defender, 33, false],
    [rows.Goalkeeper.concat(rows.Other), 9, true],
  ];
  const sub = p => (p.nat && p.nat!==teamName) ? p.nat : (p.pos||"");
  const ppl = (p,gk)=>`<div class="pp ${gk?'gk':''}">
      <div class="dot">${esc((p.pos||'?')[0])}</div>
      <div class="pn">${esc(shortName(p.name))}</div>
      <div class="pc">${esc(sub(p))}</div></div>`;
  return `<div class="pitch"><div class="pline"></div>
    ${lines.map(([arr,top,gk])=>`<div class="row-line" style="top:${top}%">
      ${arr.map(p=>ppl(p,gk)).join("")}</div>`).join("")}
  </div>`;
}
function shortName(n){
  const parts = String(n).trim().split(/\s+/);
  if(parts.length===1) return parts[0];
  return parts[0][0]+". "+parts.slice(1).join(" ");
}

/* ---------- PLAYERS ---------- */
function players(){
  app.innerHTML = `
    <div class="kicker">Qualifying · all confederations w/ player data</div>
    <div class="sec-h"><h1>Player Stats</h1><span class="pill">${D.players.length} players</span></div>
    <p class="muted note">Live World Cup match data will be added once the tournament kicks off. UEFA player-level data isn't in the current source, so European squads aren't listed here yet.</p>
    <div class="filters" style="margin-top:16px">
      <input id="psearch" placeholder="Search player or nationality…">
      <select id="ppos"><option value="">All positions</option>
        <option>Goalkeeper</option><option>Defender</option><option>Midfielder</option><option>Forward</option></select>
      <select id="pteam"><option value="">All teams</option>
        ${teamsArr().filter(t=>t.squad.length).sort((a,b)=>a.name.localeCompare(b.name))
          .map(t=>`<option value="${t.code}">${esc(t.name)}</option>`).join("")}</select>
    </div>
    <div class="tbl-wrap"><table class="dt" id="pt">
      <thead><tr>
        <th data-k="name" data-t="s">Player</th><th data-k="team" data-t="s">Team</th>
        <th data-k="pos" data-t="s">Pos</th><th data-k="nat" data-t="s">Nationality</th>
        <th data-k="age" class="num">Age</th><th data-k="app" class="num">Apps</th>
        <th data-k="min" class="num">Mins</th><th data-k="g" class="num">G</th>
        <th data-k="a" class="num">A</th><th data-k="yc" class="num">YC</th>
        <th data-k="rc" class="num">RC</th></tr></thead>
      <tbody></tbody></table></div>`;
  let q="",pos="",team="";
  const base = D.players.slice();
  const tbody = $("#pt tbody");
  let sortK="g", sortDir=-1;
  const draw=()=>{
    let rows = base.filter(p=>
      (!pos||p.pos===pos)&&(!team||p.code===team)&&
      ((p.name||"").toLowerCase().includes(q)||(p.nat||"").toLowerCase().includes(q)));
    rows.sort((a,b)=>cmp(a[sortK],b[sortK])*sortDir);
    rows = rows.slice(0,300);
    tbody.innerHTML = rows.map(p=>`<tr>
      <td class="name">${esc(p.name)}</td>
      <td><span class="flgcell">${p.flag}${esc(p.team)}</span></td>
      <td>${esc(p.pos)}</td><td>${esc(p.nat||"—")}</td>
      <td class="num">${fmt(p.age)}</td><td class="num">${p.app}</td><td class="num">${p.min}</td>
      <td class="num">${p.g}</td><td class="num">${p.a}</td><td class="num">${p.yc}</td><td class="num">${p.rc}</td>
    </tr>`).join("") || `<tr><td colspan="11" class="muted" style="text-align:center;padding:24px">No players match.</td></tr>`;
    if(rows.length===300) tbody.innerHTML+=`<tr><td colspan="11" class="muted" style="text-align:center;padding:14px">Showing top 300 — narrow with filters.</td></tr>`;
  };
  $("#psearch").addEventListener("input",e=>{q=e.target.value.toLowerCase();draw()});
  $("#ppos").addEventListener("change",e=>{pos=e.target.value;draw()});
  $("#pteam").addEventListener("change",e=>{team=e.target.value;draw()});
  $("#pt").querySelectorAll("th").forEach(th=>th.addEventListener("click",()=>{
    const k=th.dataset.k; if(sortK===k)sortDir*=-1;else{sortK=k;sortDir=th.dataset.t==="s"?1:-1;}
    draw();
  }));
  draw();
}

/* ---------- TEAM STATS ---------- */
function stats(){
  const cs = D.country_stats.slice();
  const metrics = [
    ["goals_scored","Goals scored",-1],["goals_conceded","Goals conceded",1],
    ["goal_difference","Goal difference",-1],["points_per_game","Points / game",-1],
    ["xg_for_avg_overall","xG / match",-1],["clean_sheets","Clean sheets",-1],
    ["average_possession","Possession %",-1],["win_percentage","Win %",-1],
    ["cards_total","Cards",1],
  ];
  app.innerHTML = `
    <div class="kicker">Qualification · 45 of 48 nations (3 hosts auto-qualified)</div>
    <div class="sec-h"><h1>Team Stats</h1></div>
    <div class="filters">
      <span class="muted" style="font-weight:700;font-size:13px">Rank by</span>
      <select id="metric">${metrics.map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select>
      <button class="chip on" data-c="ALL">All</button>
      ${CONF.filter(c=>c!=="OFC"||true).map(c=>`<button class="chip" data-c="${c}">${c}</button>`).join("")}
    </div>
    <div class="tbl-wrap"><table class="dt" id="tt">
      <thead><tr><th class="num">#</th><th data-k="name" data-t="s">Team</th><th data-k="conf" data-t="s">Conf</th>
      <th data-k="matches_played" class="num">P</th><th data-k="wins" class="num">W</th>
      <th data-k="draws" class="num">D</th><th data-k="losses" class="num">L</th>
      <th data-k="goals_scored" class="num">GF</th><th data-k="goals_conceded" class="num">GA</th>
      <th data-k="goal_difference" class="num">GD</th><th data-k="points_per_game" class="num">PPG</th>
      <th data-k="xg_for_avg_overall" class="num">xG</th><th data-k="clean_sheets" class="num">CS</th>
      <th data-k="average_possession" class="num">Poss</th></tr></thead>
      <tbody></tbody></table></div>`;
  let conf="ALL", sortK="goals_scored", dir=-1;
  const dirMap=Object.fromEntries(metrics.map(([k,,d])=>[k,d]));
  const tbody=$("#tt tbody");
  const draw=()=>{
    let rows=cs.filter(r=>conf==="ALL"||r.conf===conf);
    rows.sort((a,b)=>cmp(a[sortK],b[sortK])*dir);
    tbody.innerHTML=rows.map((r,i)=>`<tr>
      <td class="rk num">${i+1}</td>
      <td class="name"><a class="flgcell" href="#/country/${r.code}">${r.flag}${esc(r.name)}</a></td>
      <td>${confTag(r.conf)}</td>
      <td class="num">${fmt(r.matches_played)}</td><td class="num">${fmt(r.wins)}</td>
      <td class="num">${fmt(r.draws)}</td><td class="num">${fmt(r.losses)}</td>
      <td class="num">${fmt(r.goals_scored)}</td><td class="num">${fmt(r.goals_conceded)}</td>
      <td class="num">${fmt(r.goal_difference)}</td><td class="num">${fmt(r.points_per_game)}</td>
      <td class="num">${fmt(r.xg_for_avg_overall)}</td><td class="num">${fmt(r.clean_sheets)}</td>
      <td class="num">${fmt(r.average_possession)}</td></tr>`).join("");
  };
  $("#metric").addEventListener("change",e=>{sortK=e.target.value;dir=dirMap[sortK]||-1;
    document.querySelectorAll("#tt th").forEach(t=>t.classList.remove("active"));draw()});
  document.querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".chip").forEach(x=>x.classList.remove("on"));
    b.classList.add("on");conf=b.dataset.c;draw()}));
  document.querySelectorAll("#tt th[data-k]").forEach(th=>th.addEventListener("click",()=>{
    const k=th.dataset.k; if(sortK===k)dir*=-1; else{sortK=k;dir=th.dataset.t==="s"?1:-1;}draw()}));
  draw();
}

/* ---------- BRACKET ---------- */
let SCEN=null;
function bracket(){
  app.innerHTML = `
    <div class="kicker">Knockout Stage</div>
    <div class="sec-h"><h1>Bracket</h1><span class="pill">Round of 32 → Final</span></div>
    <p class="muted note">Eight Round-of-32 ties depend on which third-placed teams advance. Pick a third-place qualifying scenario to resolve them (495 official combinations).</p>
    <div class="bracket-controls">
      <span class="muted" style="font-weight:700;font-size:13px">3rd-place scenario</span>
      <select id="scen"><option>Loading…</option></select>
      <span class="muted" id="scenInfo" style="font-size:12.5px"></span>
    </div>
    <div class="bracket-scroll"><div id="bk">Loading bracket…</div></div>`;
  if(SCEN) initScen();
  else if(window.WC_SCENARIOS){ SCEN=window.WC_SCENARIOS; initScen(); }
  else fetch("scenarios.json").then(r=>r.json()).then(j=>{SCEN=j;initScen();})
    .catch(()=>{ $("#bk").innerHTML=`<div class="empty">Couldn't load scenarios.json (needs to be served over http — works on GitHub Pages).</div>`;
      $("#scen").innerHTML="<option>unavailable</option>"; drawBracket(null);});
}
function initScen(){
  const sel=$("#scen");
  sel.innerHTML = SCEN.scenarios.map(s=>`<option value="${s.scenario_number}">#${s.scenario_number} — groups ${s.qualifying_third_place_groups.join("")}</option>`).join("");
  sel.addEventListener("change",()=>drawBracket(scenById(+sel.value)));
  drawBracket(SCEN.scenarios[0]);
}
const scenById=n=>SCEN.scenarios.find(s=>s.scenario_number===n);
function drawBracket(scen){
  const b=D.bracket;
  // map of match -> third opponent
  const third={};
  if(scen){ Object.values(scen.round_of_32_third_place_matchups).forEach(m=>{third[m.match]=m.third_placed_opponent;}); }
  $("#scenInfo") && ($("#scenInfo").textContent = scen?`Third-placed teams advancing from groups ${scen.qualifying_third_place_groups.join(", ")}.`:"");

  const slot = tok=>{
    if(!tok) return `<span class="tp">—</span>`;
    const m=/^([12])([A-L])$/.exec(tok);
    if(m){const lbl=m[1]==="1"?"Winner":"Runner-up";return `<span class="tp">${lbl} ${m[2]}</span>`;}
    const t=/^3([A-L])$/.exec(tok);
    if(t) return `<span class="tp">3rd ${t[1]}</span>`;
    return `<span class="tp">${esc(tok)}</span>`;
  };
  const matchBox=(id,home,away)=>`<div class="match"><div class="mm">${id}</div>
    <div class="m"><span>${slot(home)}</span></div>
    <div class="m"><span>${slot(away)}</span></div></div>`;

  // R32
  const fixed=b.round_of_32.fixed_matches, tp=b.round_of_32.third_place_matches;
  const r32ids=["M73","M74","M75","M76","M77","M78","M79","M80","M81","M82","M83","M84","M85","M86","M87","M88"];
  const r32 = r32ids.map(id=>{
    if(fixed[id]) return matchBox(id,fixed[id].home,fixed[id].away);
    if(tp[id]) return matchBox(id,tp[id].home, third[id]||"3?");
    return "";
  }).join("");

  const winBox=(id,a,b2)=>`<div class="match"><div class="mm">${id}</div>
    <div class="m"><span class="tp">W ${a}</span></div>
    <div class="m"><span class="tp">W ${b2}</span></div></div>`;
  const r16=Object.entries(b.round_of_16.matches).map(([id,m])=>
    winBox(id,m.home.replace("W",""),m.away.replace("W",""))).join("");
  const qf=Object.entries(b.quarter_finals.matches).map(([id,m])=>
    winBox(id,m.home.replace("W",""),m.away.replace("W",""))).join("");
  const sf=Object.entries(b.semi_finals.matches).map(([id,m])=>
    winBox(id,m.home.replace("W",""),m.away.replace("W",""))).join("");
  const fin=`<div class="match final-box"><div class="mm">M104 · FINAL</div>
     <div class="m"><span class="tp">Winner SF1</span></div>
     <div class="m"><span class="tp">Winner SF2</span></div></div>
     <div class="match final-box" style="margin-top:10px"><div class="mm">M103 · 3rd place</div>
     <div class="m"><span class="tp">Loser SF1</span></div>
     <div class="m"><span class="tp">Loser SF2</span></div></div>`;

  $("#bk").innerHTML=`<div class="bracket">
    <div class="bcol"><h4>Round of 32</h4>${r32}</div>
    <div class="bcol"><h4>Round of 16</h4>${r16}</div>
    <div class="bcol"><h4>Quarter-finals</h4>${qf}</div>
    <div class="bcol"><h4>Semi-finals</h4>${sf}</div>
    <div class="bcol"><h4>Final</h4>${fin}</div>
  </div>`;
}

/* ---------- ODDS / FANTASY (coming soon) ---------- */
function odds(){
  app.innerHTML = `<div class="crumbs"><a href="#/">Home</a></div>
    <div class="soon-hero"><div class="kicker" style="color:var(--gold)">Coming soon</div>
      <div class="big">ODDS</div>
      <p>Live betting odds across the tournament — match markets, outright winner, group winners and top scorer — will stream in here once the feed is connected.</p>
      <a class="btn" href="#/stats" style="margin-top:22px">Meanwhile, browse team stats →</a></div>`;
}
function fantasy(){
  app.innerHTML = `<div class="crumbs"><a href="#/">Home</a></div>
    <div class="soon-hero"><div class="kicker" style="color:var(--gold)">Coming soon</div>
      <div class="big">FANTASY</div>
      <p>Build your World Cup XI within a budget, pick a captain, and climb the leaderboard. The Fantasy Zone opens closer to kickoff.</p>
      <a class="btn" href="#/players" style="margin-top:22px">Scout players now →</a></div>`;
}
function notfound(){
  app.innerHTML = `<div class="soon-hero"><div class="big" style="color:var(--mag)">404</div>
    <p>That page wandered offside.</p><a class="btn lime" href="#/" style="margin-top:20px">Back home</a></div>`;
}

/* ---------- utils: sortable tables ---------- */
function cmp(a,b){
  if(a==null)return -1; if(b==null)return 1;
  if(typeof a==="number"&&typeof b==="number")return a-b;
  return String(a).localeCompare(String(b));
}
function makeSortable(table, rows, renderFn){
  let sortK=null,dir=1;
  const tbody=table.querySelector("tbody");
  const draw=()=>renderFn(tbody,rows);
  table.querySelectorAll("th[data-k]").forEach(th=>th.addEventListener("click",()=>{
    const k=th.dataset.k; if(sortK===k)dir*=-1;else{sortK=k;dir=th.dataset.t==="s"?1:-1;}
    rows.sort((a,b)=>cmp(a[k],b[k])*dir); draw();
  }));
  draw();
}

render();
