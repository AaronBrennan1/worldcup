/* ============================================================
   WC26 Hub — vanilla SPA (hash routing)
   ============================================================ */
const D = window.WC_DATA;
const app = document.getElementById("app");
const $ = (s, r=document) => r.querySelector(s);

const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = v => v==null||v===""?"–":v;
const teamsArr = () => Object.values(D.teams);
const byCode = c => D.teams[c];
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
window.addEventListener("DOMContentLoaded", render);

// Safe initialization guard for menu button if it exists in the DOM frame
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = $("#menuBtn");
  if (menuBtn) menuBtn.addEventListener("click", ()=>$("#nav").classList.toggle("open"));
});

/* ---------- HOME ---------- */
function home(){
  const s = D.meta.summary;
  const tiles = [
    ["#/groups","Groups","All 12 groups · 48 nations, drawn Dec 2025.","01"],
    ["#/bracket","Knockout Predictor","Order the groups, pick the third-place qualifiers, predict every tie.","02"],
    ["#/countries","Countries","Every qualified nation — tap through to its page.","03"],
    ["#/players","Player Stats","Tournament leaderboards and advanced player matrix analytics.","04"],
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
    </div>
    <div class="grid-c" id="cgrid"></div>`;
  let q="";
  const grid = $("#cgrid");
  const draw = ()=>{
    const list = teamsArr().filter(t=>
      t.name.toLowerCase().includes(q.toLowerCase())
    ).sort((a,b)=>a.name.localeCompare(b.name));
    grid.innerHTML = list.length? list.map(t=>`
      <a class="ccard" href="#/country/${t.code}">
        <span class="gtag">${t.group}</span>
        <div class="fl">${t.flag}</div>
        <div class="cn">${esc(t.name)}</div>
        <div class="cm">${t.host?"Host":""}${t.host&&t.debut?" · ":""}${t.debut?"Debut":""}</div>
      </a>`).join("") : `<div class="empty">No nations match.</div>`;
  };
  $("#csearch").addEventListener("input",e=>{q=e.target.value;draw()});
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

  // tournament stats panel
  let qual;
  if(s){
    qual = `<div class="card panel">
      <h3>Tournament Stats</h3>
      ${recHtml}
      <p class="muted" style="font-size:13px;margin:0 0 14px">${s.matches_played||0} matches played.</p>
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
    qual = `<div class="card panel"><h3>Tournament Stats</h3>
      <div class="empty">${esc(t.name)} qualified automatically as a <b>host nation</b>. Live tournament data matrix records will stream here once the World Cup opens.</div></div>`;
  } else {
    qual = `<div class="card panel"><h3>Tournament Stats</h3>
      <div class="empty">No metrics dataset available for ${esc(t.name)} yet.</div></div>`;
  }

  // group panel
  const grp = `<div class="card panel"><h3>Group ${t.group}</h3>
    ${groupCodes.map(c=>{const o=byCode(c);const me=c===code;
      return `<a class="trow" href="#/country/${c}" style="${me?'background:var(--ink3)':''}">
        <span class="fl">${o.flag}</span>
        <span class="nm">${esc(o.name)}${me?' <small>(this team)</small>':''}</span></a>`;
    }).join("")}</div>`;

  // lineup
  let lineup;
  if(t.xi && t.xi.length){
    lineup = `<div class="card panel"><div class="lineup-head"><h3>Expected Lineup</h3>
      ${t.formation?`<span class="formation-pill">${esc(t.formation)}</span>`:""}</div>
      <p class="muted" style="font-size:12.5px;margin:-4px 0 14px">Probable first-choice XI inferred from tournament games started, minutes and ratings — shape (${esc(t.formation||"")}) reflects baseline strategy configurations.</p>
      ${pitch(t.xi, t.name)}
      <h3 style="margin-top:22px;font-size:16px">Bench</h3>
      <div class="statgrid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
        ${t.bench.map(p=>`<div class="stat"><b style="font-size:14px;font-family:'Hanken Grotesque';font-weight:800">${esc(p.name)}</b>
          <span>${esc(p.pos)}${p.gs?` · ${p.gs} starts`:""}${p.nat&&p.nat!==t.name?" · "+esc(p.nat):""}</span></div>`).join("")||'<div class="muted">—</div>'}
      </div></div>`;
  } else {
    const why = t.host
      ? `${esc(t.name)} qualified automatically as a tournament host — an expected XI roster matrix will be appended with live opening round metrics.`
      : `No data profiles available for ${esc(t.name)} yet.`;
    lineup = `<div class="card panel"><h3>Expected Lineup</h3><div class="empty">${why}</div></div>`;
  }

  // squad table
  let squad = "";
  if(t.squad && t.squad.length){
    squad = `<div class="card panel"><h3>Squad — Performance Minutes</h3>
      <div class="tbl-wrap"><table class="dt" id="sqt">
      <thead><tr>
        <th data-k="name" data-t="s">Player</th><th data-k="pos" data-t="s">Pos</th>
        <th data-k="nat" data-t="s">Nationality</th><th class="num" data-k="age">Age</th>
        <th class="num" data-k="app">Apps</th><th class="num" data-k="min">Mins</th>
        <th class="num" data-k="g">G</th><th class="num" data-k="a">A</th>
        <th class="num" data-k="yc">YC</th></tr></thead>
      <tbody></tbody></table></div></div>`;
  }

  const histNote = `<div class="card panel"><h3>Previous Games</h3>
    <div class="empty">Match-by-match results aren't in the current dataset. This panel will fill with ${esc(t.name)}'s fixtures &amp; World Cup live history feed once match day begins.</div></div>`;

  app.innerHTML = `
    <div class="crumbs"><a href="#/countries">Countries</a> · Group ${t.group}</div>
    <div class="cp-hero">
      <div class="bigflag">${t.flag}</div>
      <div>
        <h1>${esc(t.name)}</h1>
        <div class="sub">
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
  const sub = p => (p.nat && p.nat!==teamName) ? p.nat : (p.gs!=null ? p.gs+" starts" : (p.pos||""));
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

/* ---------- PLAYERS (advanced analytics) ---------- */
const PMETRICS = [
  ["xg90","xG / 90"],["sh90","Shots / 90"],["sot90","Shots on T / 90"],
  ["g90","Goals / 90"],["a90","Assists / 90"],["ga90","G+A / 90"],
  ["kp90","Key passes / 90"],["cc90","Chances created / 90"],
  ["tk90","Tackles / 90"],["int90","Interceptions / 90"],["drb90","Dribbles / 90"],
  ["pas90","Passes / 90"],["pasc","Pass completion %"],["rt","Avg match rating"],
  ["xg","xG (total)"],["g","Goals"],["a","Assists"],["min","Minutes"],["gs","Starts"],["age","Age"],
];
const PMLABEL = Object.fromEntries(PMETRICS);
const fmtN = (v,d=2)=> v==null?"–":(typeof v==="number"? (Number.isInteger(v)?v:v.toFixed(d)) : v);

let playerLimit = 25; // Default visible rows for table expansion control

function players(){
  app.innerHTML = `
    <div class="kicker">Tournament Performance Matrix</div>
    <div class="sec-h"><h1>Player Advanced Analytics</h1><span class="pill">${D.players.length} active metrics profiles</span></div>
    
    <div id="active-filter-hud" class="analytics-hud-banner">
       Visualizing: <span id="hud-y-label" class="hud-highlight">xG / 90</span> <span class="muted">vs</span> <span id="hud-x-label" class="hud-highlight">Shots / 90</span>
    </div>

    <div class="filters pf">
      <input id="psearch" placeholder="Search player or nationality…">
      <select id="ppos"><option value="">All positions</option>
        <option>Goalkeeper</option><option>Defender</option><option>Midfielder</option><option>Forward</option></select>
      <select id="pteam"><option value="">All teams</option>
        ${teamsArr().filter(t=>t.squad && t.squad.length).sort((a,b)=>a.name.localeCompare(b.name))
          .map(t=>`<option value="${t.code}">${esc(t.name)}</option>`).join("")}</select>
      <span class="minmin"><label>Min minutes <b id="mmval">270</b></label>
        <input type="range" id="pmin" min="0" max="900" step="90" value="270"></span>
    </div>

    <div class="card panel scatter-card-v2">
      <div class="scatter-axes">
        <span>Vertical Axis (Y) <select id="ay">${PMETRICS.map(([k,l])=>`<option value="${k}"${k背=== "xg90" || k === "xg90"?" selected":""}>${l}</option>`).join("")}</select></span>
        <span>Horizontal Axis (X) <select id="ax">${PMETRICS.map(([k,l])=>`<option value="${k}"${k背=== "sh90" || k === "sh90"?" selected":""}>${l}</option>`).join("")}</select></span>
      </div>
      <div id="scatter" class="scatter-wrap-v2"></div>
      <div class="scatter-foot"><span id="scount" class="muted"></span><span id="selinfo" class="selinfo"></span></div>
    </div>

    <div class="tbl-wrap"><table class="dt adv" id="pt">
      <thead><tr>
        <th data-k="name" data-t="s">Player</th><th data-k="team" data-t="s">Team</th>
        <th data-k="pos" data-t="s">Pos</th><th class="num" data-k="age">Age</th>
        <th class="num" data-k="min">Min</th><th class="num" data-k="gs">St</th>
        <th class="num" data-k="g">G</th><th class="num" data-k="a">A</th>
        <th class="num" data-k="xg">xG</th><th class="num hl" data-k="xg90">xG/90</th>
        <th class="num" data-k="sh90">Sh/90</th><th class="num" data-k="sot90">SoT/90</th>
        <th class="num" data-k="kp90">KP/90</th><th class="num" data-k="tk90">Tk/90</th>
        <th class="num" data-k="rt">Rating</th></tr></thead>
      <tbody></tbody></table></div>
      <div id="table-expansion-control" class="expandable-table-footer"></div>`;

  let q="",pos="",team="",minMin=270;
  let ax="sh90", ay="xg90";
  let sortK="xg90", sortDir=-1, selCode=null;
  const base = D.players.slice();

  const filtered = ()=> base.filter(p=>
      (!pos||p.pos===pos)&&(!team||p.code===team)&&
      (p.min||0)>=minMin &&
      ((p.name||"").toLowerCase().includes(q)||(p.nat||"").toLowerCase().includes(q)));

  const drawScatter = (rows)=>{
    // Clean, high-impact scannable design: Select data points cleanly
    const pts = rows.filter(p=>p[ax]!=null && p[ay]!=null);
    
    // Sort to determine outliers / top 35 performers to assign inline label text nodes safely
    const topPerformers = [...pts].sort((m,n) => ((n[ay] * n[ax]) - (m[ay] * m[ax]))).slice(0, 35);
    const visibleScatterSet = new Set(topPerformers.map(p => p.name));

    // Constrain the scatter plot to maximum top 65 players matching metric density criteria to ensure clean screen layout
    const plottedPts = pts.slice(0, 65);

    const W=840,H=480,pad={l:70,r:40,t:30,b:60};
    const xs=plottedPts.map(p=>p[ax]), ys=plottedPts.map(p=>p[ay]);
    const xmax=Math.max(0.0001,...xs), ymax=Math.max(0.0001,...ys);
    const xmin=Math.min(0,...xs), ymin=Math.min(0,...ys);
    const sx=v=>pad.l+(v-xmin)/(xmax-xmin||1)*(W-pad.l-pad.r);
    const sy=v=>H-pad.b-(v-ymin)/(ymax-ymin||1)*(H-pad.t-pad.b);
    
    const med=a=>{if(!a.length)return 0;const s=[...a].sort((m,n)=>m-n);return s[Math.floor(s.length/2)];};
    const mx=med(xs), my=med(ys);
    const rad=p=>p.name===selCode ? 9 : 5.5;

    const ticks=(lo,hi,n=5)=>Array.from({length:n+1},(_,i)=>lo+(hi-lo)*i/n);
    
    // Build dots plus explicit scannable persistent layout text label tags inside data field visual cloud
    let dotsHtml = "";
    let labelsHtml = "";

    plottedPts.forEach((p, i) => {
      const sel = p.name===selCode;
      const cxPos = sx(p[ax]);
      const cyPos = sy(p[ay]);
      const playerRadius = rad(p);
      
      dotsHtml += `<circle class="dot${sel?" sel":""}" data-i="${i}" cx="${cxPos.toFixed(1)}" cy="${cyPos.toFixed(1)}"
        r="${playerRadius.toFixed(1)}" fill="${sel ? "var(--mag, #ff0055)" : "var(--lime, #ccff00)"}"
        fill-opacity="${sel?1.0:0.72}" stroke="#11141a" stroke-width="${sel?2.5:1}"/>`;

      // If player is a top metric performer or selected explicitly, append standard scannable textual string tag directly next to visual dot node
      if (sel || visibleScatterSet.has(p.name)) {
        labelsHtml += `<text class="scatter-inline-label" x="${(cxPos + 8).toFixed(1)}" y="${(cyPos + 4).toFixed(1)}" font-size="10" fill="${sel ? "#fff" : "#9aa3b2"}">${esc(shortName(p.name))}</text>`;
      }
    });

    const xlabels=ticks(xmin,xmax).map(v=>`<text class="axtt" x="${sx(v)}" y="${H-pad.b+20}" text-anchor="middle">${(+v.toFixed(2))}</text>`).join("");
    const ylabels=ticks(ymin,ymax).map(v=>`<text class="axtt" x="${pad.l-12}" y="${sy(v)+4}" text-anchor="end">${(+v.toFixed(2))}</text>`).join("");
    
    $("#scatter").innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="scatter-svg" id="scsvg">
      <rect width="${W}" height="${H}" fill="rgba(255,255,255,0.02)" rx="8" pointer-events="none" />
      <line class="grid" x1="${pad.l}" y1="${sy(my)}" x2="${W-pad.r}" y2="${sy(my)}" stroke-dasharray="4 4" stroke="rgba(255,255,255,0.1)"/>
      <line class="grid" x1="${sx(mx)}" y1="${pad.t}" x2="${sx(mx)}" y2="${H-pad.b}" stroke-dasharray="4 4" stroke="rgba(255,255,255,0.1)"/>
      <line class="axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H-pad.b}" stroke="rgba(255,255,255,0.3)"/>
      <line class="axis" x1="${pad.l}" y1="${H-pad.b}" x2="${W-pad.r}" y2="${H-pad.b}" stroke="rgba(255,255,255,0.3)"/>
      ${xlabels}${ylabels}
      <text class="axttl" x="${pad.l+(W-pad.l-pad.r)/2}" y="${H-12}" text-anchor="middle" font-weight="700" fill="#fff">${esc(PMLABEL[ax])} →</text>
      <text class="axttl" transform="rotate(-90 20 ${pad.t+(H-pad.t-pad.b)/2})" x="20" y="${pad.t+(H-pad.t-pad.b)/2}" text-anchor="middle" font-weight="700" fill="#fff">${esc(PMLABEL[ay])} →</text>
      ${dotsHtml}
      ${labelsHtml}
      <g id="tip" style="display:none"><rect rx="6" id="tipbg" fill="#11141a" stroke="#2a2f3a"/><text id="tiptx"></text></g>
    </svg>`;
    
    $("#scount").textContent = `Displaying top matrix clusters (${plottedPts.length} elite performers plotted)`;
    
    // Wire tooltip interaction layers securely 
    const svg=$("#scsvg"), tip=$("#tip",svg), tbg=$("#tipbg",svg), ttx=$("#tiptx",svg);
    svg.querySelectorAll(".dot").forEach(c=>{
      c.addEventListener("mousemove",()=>{
        const p=plottedPts[+c.dataset.i];
        ttx.innerHTML=`<tspan x="0" dy="0" style="font-weight:800">${esc(p.name)}</tspan>`+
          `<tspan x="0" dy="16" fill="#9aa3b2">${esc(p.team)} · ${esc(p.pos)}</tspan>`+
          `<tspan x="0" dy="16">${esc(PMLABEL[ay])}: ${fmtN(p[ay])}</tspan>`+
          `<tspan x="0" dy="16">${esc(PMLABEL[ax])}: ${fmtN(p[ax])}</tspan>`;
        const bb=ttx.getBBox?ttx.getBBox():{width:140,height:70};
        let tx=+c.getAttribute("cx")+14, ty=+c.getAttribute("cy")-10;
        if(tx+bb.width+16>W) tx=+c.getAttribute("cx")-bb.width-16;
        if(ty<10) ty=12;
        tip.setAttribute("transform",`translate(${tx},${ty})`);
        ttx.setAttribute("x",8); ttx.setAttribute("y",16);
        tbg.setAttribute("x",0); tbg.setAttribute("y",0);
        tbg.setAttribute("width",bb.width+16); tbg.setAttribute("height",bb.height+14);
        tip.style.display="block";
      });
      c.addEventListener("mouseleave",()=>tip.style.display="none");
      c.addEventListener("click",()=>{ const p=plottedPts[+c.dataset.i]; selCode=(selCode===p.name?null:p.name); refresh(); });
    });
  };

  const renderTable=(rows)=>{
    const tbody=$("#pt tbody");
    const r2=[...rows].sort((a,b)=>cmp(a[sortK],b[sortK])*sortDir);
    
    // Slice table rows down using expandable variable limits
    const visibleRows = r2.slice(0, playerLimit);
    
    tbody.innerHTML = visibleRows.map(p=>`<tr class="${p.name===selCode?"selrow":""}" data-n="${esc(p.name)}">
      <td class="name">${esc(p.name)}</td>
      <td><span class="flgcell">${p.flag || ''}${esc(p.team)}</span></td>
      <td>${esc(p.pos ? p.pos[0] : '–')}</td><td class="num">${fmtN(p.age,0)}</td>
      <td class="num">${fmtN(p.min,0)}</td><td class="num">${fmtN(p.gs,0)}</td>
      <td class="num">${fmtN(p.g,0)}</td><td class="num">${fmtN(p.a,0)}</td>
      <td class="num">${fmtN(p.xg)}</td><td class="num hl">${fmtN(p.xg90)}</td>
      <td class="num">${fmtN(p.sh90)}</td><td class="num">${fmtN(p.sot90)}</td>
      <td class="num">${fmtN(p.kp90)}</td><td class="num">${fmtN(p.tk90)}</td>
      <td class="num">${fmtN(p.rt)}</td></tr>`).join("")
      || `<tr><td colspan="15" class="muted" style="text-align:center;padding:24px">No players match current metrics matrix configuration.</td></tr>`;
    
    // Render expandable layout UI control tray contextually
    const controlBox = $("#table-expansion-control");
    if (r2.length > playerLimit) {
      controlBox.innerHTML = `<button id="expandPlayersBtn" class="btn lime sm">Show More Players (+50)</button> <span class="muted" style="margin-left:12px">Showing ${playerLimit} of ${r2.length} profiles</span>`;
      $("#expandPlayersBtn").addEventListener("click", () => {
        playerLimit += 50;
        renderTable(rows);
      });
    } else {
      controlBox.innerHTML = r2.length ? `<span class="muted" style="font-size:13px">Displaying all ${r2.length} matching data profiles.</span>` : "";
    }

    tbody.querySelectorAll("tr[data-n]").forEach(tr=>tr.addEventListener("click",()=>{
      selCode = selCode===tr.dataset.n?null:tr.dataset.n; refresh();
    }));
    document.querySelectorAll("#pt th").forEach(th=>th.classList.toggle("active",th.dataset.k===sortK));
  };

  const refresh=()=>{
    const rows=filtered();
    drawScatter(rows); 
    renderTable(rows);
    
    // Update live dynamic layout dashboard metrics tracker elements text tags explicitly
    $("#hud-y-label").textContent = PMLABEL[ay];
    $("#hud-x-label").textContent = PMLABEL[ax];
    $("#selinfo").innerHTML = selCode?`Selected Profile: <b>${esc(selCode)}</b> — tap again to clear`: "";
  };

  $("#psearch").addEventListener("input",e=>{q=e.target.value.toLowerCase();refresh()});
  $("#ppos").addEventListener("change",e=>{pos=e.target.value;refresh()});
  $("#pteam").addEventListener("change",e=>{team=e.target.value;refresh()});
  $("#pmin").addEventListener("input",e=>{minMin=+e.target.value;$("#mmval").textContent=minMin;refresh()});
  $("#ax").addEventListener("change",e=>{ax=e.target.value;refresh()});
  $("#ay").addEventListener("change",e=>{ay=e.target.value;refresh()});
  document.querySelectorAll("#pt th[data-k]").forEach(th=>th.addEventListener("click",()=>{
    const k=th.dataset.k; if(sortK===k)sortDir*=-1;else{sortK=k;sortDir=th.dataset.t==="s"?1:-1;}refresh();
  }));
  refresh();
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
    <div class="kicker">Tournament Matrix Analytics Hub</div>
    <div class="sec-h"><h1>Team Data Leaderboards</h1></div>
    
    <div class="stats-dashboard-banner">
      <div class="filter-selector-block">
        <span class="panel-tag-title">Rank Standings By:</span>
        <select id="metric" class="modern-dropdown-select">${metrics.map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select>
      </div>
    </div>

    <div id="podium-highlights-container" class="podium-highlights-grid"></div>

    <div class="tbl-wrap"><table class="dt ranking-table-v2" id="tt">
      <thead><tr><th class="num">Rank</th><th data-k="name" data-t="s">Team</th>
      <th class="num" data-k="matches_played">P</th><th class="num" data-k="wins">W</th>
      <th class="num" data-k="draws">D</th><th class="num" data-k="losses">L</th>
      <th class="num" data-k="goals_scored">GF</th><th class="num" data-k="goals_conceded">GA</th>
      <th class="num" data-k="goal_difference">GD</th><th class="num" data-k="points_per_game">PPG</th>
      <th class="num" data-k="xg_for_avg_overall">xG</th><th class="num" data-k="clean_sheets">CS</th>
      <th class="num" data-k="average_possession">Poss %</th></tr></thead>
      <tbody></tbody></table></div>`;
      
  let sortK="goals_scored", dir=-1;
  const dirMap=Object.fromEntries(metrics.map(([k,,d])=>[k,d]));
  const tbody=$("#tt tbody");
  
  const draw=()=>{
    let rows=[...cs];
    rows.sort((a,b)=>cmp(a[sortK],b[sortK])*dir);
    
    // Compute exact maximum baseline boundary limits of active sorted column key to draw contextual analytics tracking bars inside matrix layout rows
    const allVals = rows.map(r => Math.abs(parseFloat(r[sortK]) || 0));
    const maxMetricVal = Math.max(0.001, ...allVals);

    // Build World Class Dashboard Podium Block Cards Framework
    const activeLabel = metrics.find(m => m[0] === sortK)[1];
    const top3 = rows.slice(0, 3);
    let podiumHtml = "";
    
    const medalIcons = ["🥇", "🥈", "🥉"];
    top3.forEach((team, idx) => {
      podiumHtml += `
        <div class="podium-card medal-${idx + 1}">
          <div class="podium-rank-badge">${medalIcons[idx]} Rank ${idx + 1}</div>
          <div class="podium-team-identity">
            <span class="podium-flag">${team.flag || ''}</span>
            <span class="podium-name">${esc(team.name)}</span>
          </div>
          <div class="podium-value-metric">
            <span class="val-num">${fmt(team[sortK])}</span>
            <span class="val-label">${activeLabel}</span>
          </div>
        </div>
      `;
    });
    $("#podium-highlights-container").innerHTML = podiumHtml;

    // Build main table structure content layout loop matrix
    tbody.innerHTML=rows.map((r,i)=>{
      const rawVal = parseFloat(r[sortK]) || 0;
      const barPercentage = Math.min(100, Math.max(3, (Math.abs(rawVal) / maxMetricVal) * 100));
      
      // Inline modern data micro bar indicator element representation tracking metric magnitude
      const renderBar = `<div class="table-inline-perf-bar" style="width: ${barPercentage}%; background-color: var(--lime, #ccff00); height: 4px; margin-top: 4px; border-radius: 2px; opacity: 0.75;"></div>`;

      return `<tr>
        <td class="rk num" style="font-weight: 800; color: var(--lime);">${i+1}</td>
        <td class="name">
          <a class="flgcell" href="#/country/${r.code}" style="font-weight:700;">${r.flag || ''}${esc(r.name)}</a>
          ${renderBar}
        </td>
        <td class="num">${fmt(r.matches_played)}</td><td class="num">${fmt(r.wins)}</td>
        <td class="num">${fmt(r.draws)}</td><td class="num">${fmt(r.losses)}</td>
        <td class="num ${sortK==='goals_scored'?'active-sort-cell':''}">${fmt(r.goals_scored)}</td>
        <td class="num ${sortK==='goals_conceded'?'active-sort-cell':''}">${fmt(r.goals_conceded)}</td>
        <td class="num ${sortK==='goal_difference'?'active-sort-cell':''}">${fmt(r.goal_difference)}</td>
        <td class="num ${sortK==='points_per_game'?'active-sort-cell':''}">${fmt(r.points_per_game)}</td>
        <td class="num ${sortK==='xg_for_avg_overall'?'active-sort-cell':''}">${fmt(r.xg_for_avg_overall)}</td>
        <td class="num ${sortK==='clean_sheets'?'active-sort-cell':''}">${fmt(r.clean_sheets)}</td>
        <td class="num ${sortK==='average_possession'?'active-sort-cell':''}">${fmt(r.average_possession)}%</td></tr>`;
    }).join("");
    
    // Explicitly toggle active columns layout header highlight styles tags safely
    document.querySelectorAll("#tt th[data-k]").forEach(th => {
      th.classList.toggle("active-sort-th", th.dataset.k === sortK);
    });
  };

  $("#metric").addEventListener("change",e=>{sortK=e.target.value;dir=dirMap[sortK]||-1; draw();});
  document.querySelectorAll("#tt th[data-k]").forEach(th=>th.addEventListener("click",()=>{
    const k=th.dataset.k; if(sortK===k)dir*=-1; else{sortK=k;dir=th.dataset.t==="s"?1:-1;}draw()}));
  draw();
}

/* ---------- PREDICTOR (groups → 3rd place → knockout) ---------- */
let SCEN=null, SCENMAP=null, PRED=null, PSTEP=1;
const pw = code => byCode(code)?.power ?? 50;

function buildScenMap(){
  SCENMAP={};
  SCEN.scenarios.forEach(s=>{ SCENMAP[[...s.qualifying_third_place_groups].sort().join("")]=s; });
}
function defaultPred(){
  const order={};
  Object.entries(D.groups).forEach(([g,codes])=>{
    order[g]=[...codes].sort((a,b)=>pw(b)-pw(a));
  });
  const thirds=Object.keys(order).map(g=>({g,code:order[g][2]}));
  thirds.sort((a,b)=>pw(b.code)-pw(a.code));
  const third=new Set(thirds.slice(0,8).map(x=>x.g));
  return {order, third, picks:{}};
}
function bracket(){ 
  if(!SCEN && window.WC_SCENARIOS){ SCEN=window.WC_SCENARIOS; }
  if(SCEN){ if(!SCENMAP) buildScenMap(); if(!PRED) PRED=defaultPred(); renderPredictor(); return; }
  app.innerHTML = `<div class="kicker">Predictor</div><div class="sec-h"><h1>World Cup Tournament Predictor</h1></div><div class="empty" id="bk">Loading tournament scenarios engine matrix…</div>`;
  fetch("scenarios.json").then(r=>r.json()).then(j=>{SCEN=j;buildScenMap();PRED=PRED||defaultPred();renderPredictor();})
    .catch(()=>{$("#bk").innerHTML=`<div class="empty">Couldn't load scenarios.json (works once served over http / on GitHub Pages).</div>`;});
}

/* resolution helpers */
const winnerG=g=>PRED.order[g][0], runnerG=g=>PRED.order[g][1], thirdG=g=>PRED.order[g][2];
function activeScen(){
  if(PRED.third.size!==8) return null;
  return SCENMAP[[...PRED.third].sort().join("")]||null;
}

function r32map(){
  const b=D.bracket, fixed=b.round_of_32.fixed_matches, tp=b.round_of_32.third_place_matches;
  const tok=t=>{const m=/^([12])([A-L])$/.exec(t); if(!m)return null; return m[1]==="1"?winnerG(m[2]):runnerG(m[2]);};
  const map={};
  Object.entries(fixed).forEach(([id,m])=>map[id]={home:tok(m.home),away:tok(m.away)});
  const scen=activeScen(), third={};
  if(scen) Object.values(scen.round_of_32_third_place_matchups).forEach(mm=>{third[mm.match]=mm.third_placed_opponent;});
  Object.entries(tp).forEach(([id,m])=>{
    const opp=third[id]; const aw=opp?thirdG(opp.replace("3","")):null;
    map[id]={home:tok(m.home),away:aw,thirdPending:!opp};
  });
  return map;
}

let _R32=null;
const matchDef=id=>{const b=D.bracket;
  return (b.round_of_16.matches[id]||b.quarter_finals.matches[id]||b.semi_finals.matches[id]||
          b.final.matches[id]||b.third_place_playoff.matches[id]);};

function participants(id){
  if(_R32 && _R32[id]) return _R32[id];
  const m=matchDef(id); if(!m) return {home:null,away:null};
  const res=tok=>{
    if(/^W\d+$/.test(tok)) return winnerCode("M"+tok.slice(1));
    const lm=/^Loser M?(\d+)$/.exec(tok); if(lm) return loserCode("M"+lm[1]);
    return null;
  };
  return {home:res(m.home), away:res(m.away)};
}
function winnerCode(id){
  const {home,away}=participants(id);
  if(!home||!away) return null;
  if(!window.PRED || !PRED.picks) return null;
  const p=PRED.picks[id];
  if(p===home||p===away) return p;
  return pw(home)>=pw(away)?home:away; 
}
function loserCode(id){
  const {home,away}=participants(id); const w=winnerCode(id);
  if(!home||!away) return null; return w===home?away:home;
}

/* step nav + render */
function renderPredictor(){
  _R32=r32map();
  const champ = winnerCode("M104");
  app.innerHTML = `
    <div class="kicker">Predictor</div>
    <div class="sec-h"><h1>World Cup Tournament Predictor</h1>
      ${champ?`<span class="pill champ-pill">${byCode(champ).flag} ${esc(byCode(champ).name)} — your champion</span>`:""}</div>
    <p class="muted note">Favourites are pre-filled at every stage from a power rating (consensus strength blended with form) — change anything you like. Order each group, choose the eight third-placed teams that advance, then click your winner in every knockout tie.</p>
    <div class="steps">
      ${[["1","Group stage"],["2","Third place"],["3","Knockout"]].map(([n,l])=>
        `<button class="step ${PSTEP==n?"on":""}" data-s="${n}"><b>${n}</b>${l}</button>`).join("")}
      <button class="step reset" id="resetPred">↺ Reset to predicted</button>
    </div>
    <div id="pbody"></div>`;
  document.querySelectorAll(".step[data-s]").forEach(b=>b.addEventListener("click",()=>{PSTEP=+b.dataset.s;renderPredictor();}));
  $("#resetPred").addEventListener("click",()=>{PRED=defaultPred();renderPredictor();});
  if(PSTEP===1) stepGroups(); else if(PSTEP===2) stepThird(); else stepKnockout();
}

/* ---- Step 1: order the groups ---- */
function stepGroups(){
  const posLbl=["1 · Winner","2 · Runner-up","3 · Third place","4 · Eliminated"];
  const posCls=["adv-win","adv-run","adv-third","adv-out"];
  
  $("#pbody").innerHTML=`<p class="muted substep">Drag and drop teams to reorder each group. Top two always advance; third place may advance in the next step.</p>
  <div class="grid-groups">
    ${Object.keys(D.groups).map(g=>`
      <div class="card gcard pgcard" data-g="${g}">
        <div class="gh"><span class="gl">Group <b>${g}</b></span></div>
        ${PRED.order[g].map((code,i)=>{const t=byCode(code);
          return `<div class="prow ${posCls[i]}" draggable="true" data-g="${g}" data-code="${code}">
            <span class="drag-handle">⋮⋮</span>
            <span class="ppos">${posLbl[i]}</span>
            <span class="fl">${t.flag}</span>
            <span class="nm">${esc(t.name)} <span class="pwr">${t.power}</span></span>
          </div>`;}).join("")}
      </div>`).join("")}
  </div>`;

  const containers = $("#pbody").querySelectorAll(".pgcard");
  containers.forEach(container => {
    const g = container.dataset.g;
    const rows = container.querySelectorAll(".prow");

    rows.forEach(row => {
      row.addEventListener("dragstart", (e) => {
        row.classList.add("dragging");
        e.dataTransfer.setData("text/plain", row.dataset.code);
      });
      row.addEventListener("dragend", () => {
        row.classList.remove("dragging");
      });
    });

    container.addEventListener("dragover", (e) => {
      e.preventDefault(); 
      const draggingRow = $("#pbody").querySelector(".prow.dragging");
      if (!draggingRow || draggingRow.dataset.g !== g) return; 

      const currentTarget = e.target.closest(".prow");
      if (!currentTarget || currentTarget === draggingRow) return;

      const bounding = currentTarget.getBoundingClientRect();
      const offset = e.clientY - bounding.top;
      
      if (offset > bounding.height / 2) {
        currentTarget.after(draggingRow);
      } else {
        currentTarget.before(draggingRow);
      }
    });

    container.addEventListener("drop", (e) => {
      e.preventDefault();
      const rowElements = Array.from(container.querySelectorAll(".prow"));
      const updatedCodes = rowElements.map(el => el.dataset.code);
      PRED.order[g] = updatedCodes;
      stepGroups();
    });
  });
}

/* ---- Step 2: pick 8 third-placed teams ---- */
function stepThird(){
  const cands=Object.keys(D.groups).map(g=>({g,code:thirdG(g)}));
  const n=PRED.third.size;
  const scen=n===8?activeScen():null;
  $("#pbody").innerHTML=`
    <p class="muted substep">Eight of the twelve third-placed teams reach the Round of 32. Pick exactly eight — <b id="tcount" class="${n===8?"ok":"warn"}">${n} selected</b>.</p>
    <div class="third-grid">
      ${cands.map(({g,code})=>{const t=byCode(code);const on=PRED.third.has(g);
        return `<button class="third-chip ${on?"on":""}" data-g="${g}">
          <span class="fl">${t.flag}</span>
          <span class="tc-n">${esc(t.name)}</span>
          <span class="tc-m">3rd · Group ${g} · pwr ${t.power}</span>
          <span class="tc-x">${on?"✓":"+"}</span></button>`;}).join("")}
    </div>
    <p class="muted substep" style="margin-top:14px">${scen?`Matched the official FIFA allocation for groups ${[...PRED.third].sort().join(", ")} (scenario #${scen.scenario_number} of 495). Head to the knockout step.`:n===8?`That combination wasn't found in the scenario set.`:`Select ${8-n>0?(8-n)+" more":""} to reach eight and lock the Round of 32.`}</p>`;
  $("#pbody").querySelectorAll(".third-chip").forEach(b=>b.addEventListener("click",()=>{
    const g=b.dataset.g;
    if(PRED.third.has(g)) PRED.third.delete(g);
    else { if(PRED.third.size>=8){ const weakest=[...PRED.third].sort((x,y)=>pw(thirdG(x))-pw(thirdG(y)))[0]; PRED.third.delete(weakest);} 
      PRED.third.add(g);}
    stepThird();
  }));
}

/* ---- Step 3: interactive knockout ---- */
function teamPill(id,code,isWin){
  if(code===null) return `<span class="bteam empty-bteam">—</span>`;
  const t=byCode(code);
  return `<button class="bteam ${isWin?"win":""}" data-m="${id}" data-c="${code}">
    <span class="fl">${t.flag}</span><span class="bn">${esc(t.name)}</span></button>`;
}

window.currentMobileRound = window.currentMobileRound ?? 0;

function stepKnockout(){
  const scen=activeScen();
  if(!scen){ 
    $("#pbody").innerHTML=`<div class="empty">Pick exactly eight third-placed teams in step 2 to build the Round of 32. <button class="btn sm" id="toStep2">Go to step 2 →</button></div>`;
    $("#toStep2").addEventListener("click",()=>{PSTEP=2;renderPredictor();}); 
    return; 
  }

  function matchBox(id, label) {
    const {home,away,thirdPending}=participants(id);
    const w=winnerCode(id);
    if(thirdPending) return `<div class="bmatch"><div class="mm">${label||id}</div><div class="empty-bteam">3rd place TBD</div></div>`;
    return `<div class="bmatch"><div class="mm">${label||id}</div>
      ${teamPill(id,home,w&&w===home)}
      ${teamPill(id,away,w&&w===away)}</div>`;
  }

  function col(title, ids, colIdx, labels) {
    const isActive = window.currentMobileRound === colIdx ? 'active-round' : '';
    return `<div class="bcol ${isActive}" data-idx="${colIdx}"><h4>${title}</h4>${ids.map((id,i)=>matchBox(id,labels&&labels[i])).join("")}</div>`;
  }

  const r32ids=["M74","M77","M73","M75","M76","M78","M79","M80","M81","M82","M85","M87","M83","M84","M86","M88"];
  const r16ids=["M89","M90","M91","M92","M95","M96","M93","M94"];
  const qfids=["M97","M98","M99","M100"], sfids=["M101","M102"];
  const champ=winnerCode("M104");

  const tabsMeta = [
    { name: "R32", label: "Round of 32" },
    { name: "R16", label: "Round of 16" },
    { name: "QF", label: "Quarters" },
    { name: "SF", label: "Semis" },
    { name: "Finals", label: "Finals" }
  ];

  const tabsHtml = `
    <div class="bracket-tabs">
      ${tabsMeta.map((tab, idx) => `
        <button class="chip ${window.currentMobileRound === idx ? 'on' : ''}" onclick="window.switchMobileRound(${idx})">
          ${tab.name}
        </button>
      `).join("")}
    </div>
  `;

  const finalsColActive = window.currentMobileRound === 4 ? 'active-round' : '';

  $("#pbody").innerHTML=`
    <p class="muted substep">Click a team to send them through. Later rounds default to the favourite until you change them.</p>
    
    ${tabsHtml}
    
    <div class="bracket-scroll">
      <div class="bracket pred-bracket">
        ${col("Round of 32", r32ids, 0)}
        ${col("Round of 16", r16ids, 1)}
        ${col("Quarter-finals", qfids, 2)}
        ${col("Semi-finals", sfids, 3)}
        
        <div class="bcol ${finalsColActive}" data-idx="4" data-round="finals">
          <h4>Showdown</h4>
          <div class="finals-showdown">
            
            <div class="finals-card gold">
              <div class="finals-title">🏆 Grand Final<span>Gold & Silver</span></div>
              <div class="pred-bracket">
                ${matchBox("M104", "MATCH 104 · METLIFE STADIUM")}
              </div>
            </div>

            <div class="finals-card bronze">
              <div class="finals-title">🥉 3rd Place Match<span>Bronze Medal</span></div>
              <div class="pred-bracket">
                ${matchBox("M103", "MATCH 103 · HARD ROCK STADIUM")}
              </div>
            </div>

          </div>
          
          ${champ ? `
            <div class="champ-box animated-glowing">
              <span>World Cup 2026 Champion</span>
              <b>🎉 ${esc(byCode(champ).name)} 🎉</b>
            </div>
          ` : ''}
        </div>
      </div>
    </div>`;

  $("#pbody").querySelectorAll(".bteam[data-c]").forEach(b=>b.addEventListener("click",()=>{
    PRED.picks[b.dataset.m]=b.dataset.c; 
    renderPredictor();
  }));
}

window.switchMobileRound = function(idx) {
  window.currentMobileRound = idx;
  document.querySelectorAll(".bracket-tabs .chip").forEach((btn, i) => btn.classList.toggle("on", i === idx));
  document.querySelectorAll(".bracket .bcol").forEach((col, i) => col.classList.toggle("active-round", i === idx));
};

/* ---------- ODDS / FANTASY (coming soon) ---------- */
function odds(){
  app.innerHTML = `<div class="crumbs"><a href="#/">Home</a></div>
    <div class="soon-hero"><div class="kicker" style="color:var(--gold)">Coming soon</div>
      <div class="big">ODDS</div>
      <p>Live betting odds across the tournament — match markets, outright winner, group winners and top scorer — will stream in here once the tournament engine feed is connected.</p>
      <a class="btn" href="#/stats" style="margin-top:22px">Meanwhile, browse team statistics standings →</a></div>`;
}
function fantasy(){
  app.innerHTML = `<div class="crumbs"><a href="#/">Home</a></div>
    <div class="soon-hero"><div class="kicker" style="color:var(--gold)">Coming soon</div>
      <div class="big">FANTASY</div>
      <p>Build your World Cup XI within a budget, pick a captain, and climb the global analytics leaderboard. The Fantasy Zone opens closer to kickoff.</p>
      <a class="btn" href="#/players" style="margin-top:22px">Scout player metrics matrix now →</a></div>`;
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

function initGroupDragAndDrop() {
  const containers = document.querySelectorAll('.pgcard');
  
  containers.forEach(container => {
    container.addEventListener('dragstart', e => {
      const row = e.target.closest('.prow');
      if (!row) return;
      row.classList.add('dragging');
      e.dataTransfer.setData('text/plain', JSON.stringify({
        groupId: row.dataset.group,
        teamId: row.dataset.teamId
      }));
    });

    container.addEventListener('dragover', e => {
      e.preventDefault();
      const draggingRow = document.querySelector('.prow.dragging');
      const currentTarget = e.target.closest('.prow');
      if (!draggingRow || !currentTarget || draggingRow === currentTarget) return;
      if (draggingRow.dataset.group !== currentTarget.dataset.group) return;

      const bounding = currentTarget.getBoundingClientRect();
      const offset = e.clientY - bounding.top;
      if (offset > bounding.height / 2) {
        currentTarget.after(draggingRow);
      } else {
        currentTarget.before(draggingRow);
      }
    });

    container.addEventListener('drop', e => {
      e.preventDefault();
      const draggingRow = document.querySelector('.prow.dragging');
      if (!draggingRow) return;
      
      const groupId = draggingRow.dataset.group;
      const rowElements = Array.from(container.querySelectorAll('.prow'));
      const updatedTeamIds = rowElements.map(el => el.dataset.teamId);

      if (typeof window.updateGroupOrderState === 'function') {
         window.updateGroupOrderState(groupId, updatedTeamIds);
      }
    });

    container.addEventListener('dragend', e => {
      const row = e.target.closest('.prow');
      if (row) row.classList.remove('dragging');
    });
    
    container.addEventListener('touchstart', e => {
      if(e.target.classList.contains('drag-handle')) {
        document.body.style.overflow = 'hidden'; 
      }
    }, {passive: false});
    
    container.addEventListener('touchend', e => {
      document.body.style.overflow = '';
    });
  });
}

render();