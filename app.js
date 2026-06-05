/* ============================================================
   WC26 Hub — vanilla SPA (hash routing)
   ============================================================ */
const D = window.WC_DATA;
const app = document.getElementById("app");
const $ = (s, r=document) => r.querySelector(s);

const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = v => v==null||v===""?"–":v;

/* mobile detection — the players/stats pages use a fully bespoke layout below this width */
const MOBILE_BP = 760;
const isMobile = () => window.matchMedia(`(max-width:${MOBILE_BP}px)`).matches;
/* re-run the active route if the viewport crosses the phone/desktop boundary,
   so the right (mobile vs desktop) layout is always shown after a rotate/resize */
let _wasMobile = isMobile();
window.addEventListener("resize", () => {
  const now = isMobile();
  if (now !== _wasMobile){
    _wasMobile = now;
    const [r] = parseHash();
    if (r === "players" || r === "stats") render();
  }
});
const teamsArr = () => Object.values(D.teams);
const byCode = c => D.teams[c];
const groupOf = code => byCode(code)?.group;

/* ============================================================
   LIVE API LAYER  (added in the WC26 revamp)
   The three rebuilt pages (#/stats, #/players, #/country/<code>)
   pull from the Neon-backed serverless endpoints rather than the
   static D.players / D.country_stats blobs.
   ============================================================ */

/* ---- in-memory cache: dedupes in-flight + repeat requests within a session.
   The Vercel edge cache (1 hr) sits in front of this; this layer just avoids
   firing the same fetch twice in one visit. Keyed by the full URL string. ---- */
const _cache = new Map();
async function apiGet(path){
  if(_cache.has(path)){
    const hit=_cache.get(path);
    // hit may be a resolved array or an in-flight promise — await either.
    return hit;
  }
  const p = fetch(path).then(async r=>{
    if(!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
    const data = await r.json();
    _cache.set(path, data);          // replace the promise with the resolved value
    return data;
  }).catch(err=>{
    _cache.delete(path);             // don't cache failures — allow a retry
    throw err;
  });
  _cache.set(path, p);
  return p;
}
function qs(obj){
  const u = new URLSearchParams();
  Object.entries(obj).forEach(([k,v])=>{ if(v!=null && v!=="") u.set(k, v); });
  return u.toString();
}
const fetchTeams   = (scope="TOTAL") => apiGet(`/api/teams?${qs({scope})}`);
const fetchTeam    = (team,scope="TOTAL") => apiGet(`/api/teams?${qs({team,scope})}`);
const fetchPlayers = (params={}) => apiGet(`/api/players?${qs(params)}`);
const fetchMatches = (team,scope="TOTAL",limit=10) => apiGet(`/api/matches?${qs({team,scope,limit})}`);

/* ---- name → local team mapping ----
   The API keys teams/nationalities by canonical full name ("Brazil", "USA",
   "Bosnia & Herzegovina"). The local D.teams blob uses slightly different
   spellings and 3-letter codes. Normalise to bridge the two so we can attach
   flags, codes and confederation colours to API rows. ---- */
const _normName = s => String(s||"")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")   // strip accents
  .toLowerCase()
  .replace(/&/g," and ")
  .replace(/[^a-z0-9]+/g," ")
  .trim();
const _NAME_ALIASES = {
  "usa":"USA","usmnt":"USA","united states":"USA","united states of america":"USA",
  "turkey":"TUR","turkiye":"TUR",
  "ivory coast":"CIV","cote d ivoire":"CIV",
  "dr congo":"COD","democratic republic of congo":"COD","democratic republic of the congo":"COD",
  "czechia":"CZE","czech republic":"CZE",
  "bosnia and herzegovina":"BIH","bosnia herzegovina":"BIH","bosnia":"BIH",
  "curacao":"CUW","cape verde":"CPV","cabo verde":"CPV",
  "south korea":"KOR","korea republic":"KOR","republic of korea":"KOR",
  "south africa":"RSA",
};
// build a normalised-name → code index from local data, then layer aliases on top
const _NAME_TO_CODE = (()=>{
  const m={};
  teamsArr().forEach(t=>{ m[_normName(t.name)] = t.code; });
  Object.entries(_NAME_ALIASES).forEach(([k,v])=>{ m[k]=v; });
  return m;
})();
function teamByName(name){
  const code = _NAME_TO_CODE[_normName(name)];
  return code ? byCode(code) : null;
}
function flagFor(name){ return teamByName(name)?.flag || "🏳️"; }
function codeFor(name){ return teamByName(name)?.code || null; }
function confFor(name){ return teamByName(name)?.conf || null; }

/* ---- number formatting (per the master-prompt contract) ---- */
const f1   = v => v==null||v===""?"–":Number(v).toFixed(1);
const f2   = v => v==null||v===""?"–":Number(v).toFixed(2);
const fInt = v => v==null||v===""?"–":Math.round(Number(v)).toLocaleString();
// percentages: data stores most rate columns as 0–1 fractions → ×100.
const fPct = v => v==null||v===""?"–":(Number(v)*100).toFixed(1)+"%";
// a value already on a 0–100 scale (avg_possession) just gets a % suffix
const fPctRaw = v => v==null||v===""?"–":Number(v).toFixed(1)+"%";

/* ---- skeleton + error helpers (shared across the three pages) ---- */
function skeletonRows(n=5){
  return `<div class="skeleton-rows">${'<div class="sk-row"></div>'.repeat(n)}</div>`;
}
function skeletonCards(n=4){
  return `<div class="skeleton-cards">${'<div class="sk-card"></div>'.repeat(n)}</div>`;
}
/* renders a retry block into `el`; calls `retry` when the button is pressed */
function fetchError(el, retry){
  el.innerHTML = `<div class="fetch-error">
    <span aria-hidden="true">⚠</span>
    <span>Could not load data.</span>
    <button class="btn sm" data-retry>Retry</button>
  </div>`;
  const b = el.querySelector("[data-retry]");
  if(b && retry) b.addEventListener("click", retry);
}

/* ============================================================
   SHARED SCOPE SWITCHER (used on all three rebuilt pages)
   ============================================================ */
const SCOPES = [
  ["TOTAL","All Competitions"],
  ["WC Qualifiers","WC Qualifiers"],
  ["Nations League","Nations League"],
  ["Continental Cup","Continental Cup"],
  ["International Friendlies","Friendlies"],
];
function scopeSwitcher(current, onChange){
  const wrap = document.createElement("div");
  wrap.className = "scope-rail";
  wrap.setAttribute("role","tablist");
  wrap.setAttribute("aria-label","Competition scope");
  SCOPES.forEach(([val,label])=>{
    const btn = document.createElement("button");
    btn.className = "scope-chip" + (val===current ? " on" : "");
    btn.textContent = label;
    btn.setAttribute("role","tab");
    btn.setAttribute("aria-selected", val===current ? "true" : "false");
    btn.onclick = ()=>{
      wrap.querySelectorAll(".scope-chip").forEach(b=>{
        b.classList.remove("on");
        b.setAttribute("aria-selected","false");
      });
      btn.classList.add("on");
      btn.setAttribute("aria-selected","true");
      onChange(val);
    };
    wrap.appendChild(btn);
  });
  return wrap;
}

/* ============================================================
   SHARED VISUAL COMPONENTS
   ============================================================ */

/* recent-form strip: array of {result:"W"|"D"|"L"} (newest last) */
function formStrip(matches){
  if(!matches || !matches.length) return `<div class="form-strip muted-mini">no recent matches</div>`;
  return `<div class="form-strip" aria-label="Recent form">
    ${matches.slice(-5).map(m=>{
      const r=m.result, cls=r==="W"?"fw":r==="D"?"fd":"fl";
      const lbl=r==="W"?"Win":r==="D"?"Draw":r==="L"?"Loss":"Unknown";
      return `<span class="form-pip ${cls}" aria-label="${lbl}">${esc(r||"?")}</span>`;
    }).join("")}
  </div>`;
}

/* match result card with an expandable inline detail drawer (no modal/route).
   `m` is a row from /api/matches (team-perspective columns). */
function matchCard(m, idx){
  const resClass = {W:"res-w",D:"res-d",L:"res-l"}[m.result] || "res-u";
  const resLbl   = {W:"Win",D:"Draw",L:"Loss"}[m.result] || "—";
  const oppFlag  = flagFor(m.opponent);
  const oppCode  = codeFor(m.opponent);
  const teamFlag = flagFor(m.team);
  let dateStr = "";
  try { dateStr = new Date(m.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }
  catch(e){ dateStr = esc(m.date||""); }
  const venue = (m.venue||"").toLowerCase()==="home" ? "Home" : (m.venue||"").toLowerCase()==="away" ? "Away" : "";
  const drawId = `mdrawer-${idx}`;

  // two-column comparison rows for the drawer
  const cmpRow = (label, a, b, fmtFn=f1) => `
    <div class="md-row">
      <span class="md-a">${fmtFn(a)}</span>
      <span class="md-lbl">${esc(label)}</span>
      <span class="md-b">${fmtFn(b)}</span>
    </div>`;
  const possFmt = v => v==null?"–":Math.round(Number(v))+"%";

  // xG performance bars: filled proportion = goals / max(goals,xg) per side
  const xgBar = (goals, xg, color) => {
    const g=Number(goals)||0, x=Number(xg)||0, mx=Math.max(g,x,0.001);
    return `<div class="xgbar"><i style="width:${Math.min(100,(g/mx)*100)}%;background:${color}"></i></div>`;
  };

  return `<div class="match-card" data-mc="${idx}">
    <button class="mc-trigger" aria-expanded="false" aria-controls="${drawId}">
      <div class="mc-top">
        <span class="mc-comp">${esc(m.competition||m.comp_type||"")}</span>
        <span class="mc-date">${dateStr}${venue?` · ${venue}`:""}</span>
      </div>
      <div class="mc-mid">
        <span class="mc-side mc-home">
          <span class="mc-fl">${teamFlag}</span>
          <span class="mc-nm">${esc(m.team)}</span>
        </span>
        <span class="mc-score">
          <b>${fInt(m.goals_for)}</b><span class="mc-dash">–</span><b>${fInt(m.goals_against)}</b>
        </span>
        <span class="mc-side mc-away">
          <span class="mc-nm">${esc(m.opponent)}</span>
          <span class="mc-fl">${oppFlag}</span>
        </span>
      </div>
      <div class="mc-foot">
        <span class="res-pip ${resClass}" aria-label="${resLbl}">${esc(m.result||"–")}</span>
        <span class="mc-mini">xG ${f1(m.team_xg)}–${f1(m.opp_xg)}</span>
        <span class="mc-mini">Shots ${fInt(m.team_shots)}–${fInt(m.opp_shots)}</span>
        <span class="mc-mini">Poss ${possFmt(m.team_possession)}–${possFmt(m.opp_possession)}</span>
        <span class="mc-chev" aria-hidden="true">▾</span>
      </div>
    </button>
    <div class="match-drawer" id="${drawId}" role="region">
      <div class="md-inner">
        <div class="md-head">
          <span>${teamFlag} ${esc(m.team)}</span>
          <span class="md-vs">vs</span>
          <span>${esc(m.opponent)} ${oppFlag}</span>
        </div>
        ${cmpRow("Goals", m.goals_for, m.goals_against, fInt)}
        ${cmpRow("xG", m.team_xg, m.opp_xg, f1)}
        ${cmpRow("Shots", m.team_shots, m.opp_shots, fInt)}
        ${cmpRow("On Target", m.team_shots_on_target, m.opp_shots_on_target, fInt)}
        ${cmpRow("Possession", m.team_possession, m.opp_possession, possFmt)}
        ${cmpRow("Corners", m.team_corners, m.opp_corners, fInt)}
        ${cmpRow("Yellows", m.team_yellow_cards, m.opp_yellow_cards, fInt)}
        <div class="md-xg">
          <span class="md-xg-lbl">xG performance</span>
          <div class="md-xg-bars">
            ${xgBar(m.goals_for, m.team_xg, "var(--lime)")}
            ${xgBar(m.goals_against, m.opp_xg, "var(--mag)")}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
/* wire expand/collapse for any match cards inside `root` */
function wireMatchCards(root){
  root.querySelectorAll(".match-card .mc-trigger").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const card = btn.closest(".match-card");
      const open = card.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });
}

/* SVG radar / spider chart — team per-90 profile vs competition average.
   teamVals / avgVals: arrays of 0–1 normalised values; labels: string[]. */
function radarChart(teamVals, avgVals, labels, size=240){
  const N = labels.length;
  const cx = size/2, cy = size/2, R = size*0.36;
  const ang = i => (Math.PI*2*i/N) - Math.PI/2;
  const clamp = v => Math.max(0, Math.min(1, Number(v)||0));
  const pt = (val,i)=>{ const r=R*clamp(val); return [cx + r*Math.cos(ang(i)), cy + r*Math.sin(ang(i))]; };
  const poly = vals => vals.map((v,i)=>pt(v,i).map(n=>n.toFixed(1)).join(",")).join(" ");

  // grid rings
  let rings="";
  for(let k=1;k<=5;k++){
    const rr=R*(k/5);
    const ringPts=Array.from({length:N},(_,i)=>{
      const a=ang(i); return [cx+rr*Math.cos(a), cy+rr*Math.sin(a)].map(n=>n.toFixed(1)).join(",");
    }).join(" ");
    rings+=`<polygon class="rdr-ring" points="${ringPts}"/>`;
  }
  // spokes + labels
  let spokes="", labelEls="";
  labels.forEach((lab,i)=>{
    const a=ang(i);
    const ex=cx+R*Math.cos(a), ey=cy+R*Math.sin(a);
    spokes+=`<line class="rdr-spoke" x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"/>`;
    const lx=cx+(R+16)*Math.cos(a), ly=cy+(R+16)*Math.sin(a);
    const anchor = Math.abs(Math.cos(a))<0.3 ? "middle" : (Math.cos(a)>0?"start":"end");
    labelEls+=`<text class="rdr-lbl" x="${lx.toFixed(1)}" y="${(ly+3).toFixed(1)}" text-anchor="${anchor}">${esc(lab)}</text>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" class="radar-svg" role="img" aria-label="Team performance radar versus competition average">
    ${rings}${spokes}
    <polygon class="rdr-avg" points="${poly(avgVals)}"/>
    <polygon class="rdr-team" points="${poly(teamVals)}"/>
    ${labelEls}
  </svg>`;
}

/* ---------- shared dashboard styles (stats + players) ---------- */
const injectGlobalDashboardStyles = () => {
  if (document.getElementById("wc26-dashboard-styles")) return;
  const style = document.createElement("style");
  style.id = "wc26-dashboard-styles";
  style.textContent = `
    /* Built on the site's own tokens so these pages match the broadcast theme. */
    .dashboard-wrapper{display:flex;flex-direction:column;gap:22px;animation:dashIn .4s ease}
    @keyframes dashIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

    /* lead-in: plain-language summary of what the page shows */
    .dash-lead{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;flex-wrap:wrap}
    .dash-lead .lead-copy{max-width:640px}
    .dash-lead p{color:var(--mut);font-size:14.5px;margin:8px 0 0}

    /* control bar */
    .ctrlbar{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;
      background:linear-gradient(180deg,var(--ink2),var(--ink));border:1px solid var(--line);
      border-radius:var(--r);padding:16px 18px;box-shadow:var(--shadow)}
    .ctrl{display:flex;flex-direction:column;gap:7px;min-width:0}
    .ctrl label{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--mut);font-weight:800}
    .ctrl label b{color:var(--lime);font-family:"Spline Sans Mono",monospace;font-weight:700}
    .ctrl input,.ctrl select{background:var(--ink3);border:1px solid var(--line);color:var(--txt);
      padding:10px 12px;border-radius:9px;font-size:14px;font-family:inherit;width:100%;transition:.16s}
    .ctrl input:focus,.ctrl select:focus{outline:none;border-color:var(--lime);box-shadow:0 0 0 3px rgba(200,255,0,.14)}
    .ctrl input[type=range]{padding:0;accent-color:var(--lime);height:22px}
    .ctrl select{cursor:pointer}

    /* chart card */
    .chart-card{background:linear-gradient(180deg,var(--ink2),var(--ink));border:1px solid var(--line);
      border-radius:18px;padding:20px 20px 16px;box-shadow:var(--shadow)}
    .chart-head{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px}
    .chart-head h3{font-family:"Anton",sans-serif;font-size:20px;text-transform:uppercase;letter-spacing:.02em}
    .axis-picks{display:flex;gap:10px;flex-wrap:wrap}
    .axis-pick{display:flex;align-items:center;gap:7px;background:var(--ink3);border:1px solid var(--line);
      border-radius:999px;padding:5px 6px 5px 12px;font-size:11px;font-weight:800;text-transform:uppercase;
      letter-spacing:.06em;color:var(--mut)}
    .axis-pick .ax-tag{color:var(--lime)} .axis-pick.y .ax-tag{color:var(--mag)}
    .axis-pick select{background:var(--ink2);border:1px solid var(--line);color:var(--txt);border-radius:999px;
      padding:5px 9px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;outline:none}
    .axis-pick select:focus{border-color:var(--lime)}
    .chart-stage{background:#080a0d;border:1px solid var(--line);border-radius:12px;padding:8px;overflow:hidden}
    .chart-svg{width:100%;height:auto;display:block;touch-action:none}
    .chart-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;
      margin-top:10px;font-size:12px;color:var(--mut)}
    .chart-foot .legend{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
    .chart-foot .legend i{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:5px;vertical-align:middle}
    .chart-foot .hint{color:var(--mut2)}
    .sel-note{color:var(--lime);font-weight:700}

    /* SVG primitives */
    .chart-svg .axis{stroke:var(--line);stroke-width:1}
    .chart-svg .guide{stroke:rgba(255,255,255,.10);stroke-width:1;stroke-dasharray:4 5}
    .chart-svg .tick{fill:var(--mut2);font-size:10px;font-family:"Spline Sans Mono",monospace}
    .chart-svg .axttl{fill:var(--mut);font-size:11px;font-weight:800;font-family:"Hanken Grotesque",sans-serif;
      text-transform:uppercase;letter-spacing:.08em}
    .chart-svg .quad{fill:var(--mut2);font-size:9.5px;font-weight:700;font-family:"Hanken Grotesque",sans-serif;
      text-transform:uppercase;letter-spacing:.08em;opacity:.65}
    .chart-svg .dot{cursor:pointer;transition:r .15s,fill-opacity .15s}
    .chart-svg .lbl{font-family:"Hanken Grotesque",sans-serif;font-weight:700;pointer-events:none}
    .chart-svg .code{font-family:"Spline Sans Mono",monospace;font-weight:700;pointer-events:none}
    .chart-svg #tiptx,.chart-svg #ttiptx{font-family:"Hanken Grotesque",sans-serif}

    /* podium */
    .podium-deck{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-items:end}
    .podium-card{position:relative;overflow:hidden;text-align:center;border-radius:16px;padding:22px 18px;
      background:linear-gradient(180deg,var(--ink2),var(--ink));border:1px solid var(--line);box-shadow:var(--shadow);
      transition:transform .2s}
    .podium-card:hover{transform:translateY(-4px)}
    .podium-card.p1{order:2;border-top:3px solid var(--gold);padding-top:32px}
    .podium-card.p2{order:1;border-top:3px solid #cdd3da}
    .podium-card.p3{order:3;border-top:3px solid #cd7f32}
    .podium-card .medal{font-size:26px;line-height:1}
    .podium-card .pflag{font-size:34px;margin:6px 0 2px;line-height:1}
    .podium-card .pname{font-family:"Anton",sans-serif;font-size:21px;text-transform:uppercase;line-height:1;margin-top:4px}
    .podium-card .pgroup{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.08em;margin-top:4px}
    .podium-card .pval{display:block;font-family:"Anton",sans-serif;font-size:40px;color:var(--lime);line-height:1;margin-top:14px}
    .podium-card .plabel{font-size:10.5px;color:var(--mut);text-transform:uppercase;letter-spacing:.08em}
    .podium-card .prec{font-family:"Spline Sans Mono",monospace;font-size:11.5px;color:var(--mut);margin-top:10px}
    .podium-card .prec b{color:var(--txt)}

    /* tables — extend the base .dt.adv */
    table.dt.adv th.sortk{color:var(--lime)}
    table.dt.adv td.colk{color:var(--lime);font-weight:800;background:rgba(200,255,0,.05)}
    table.dt.adv tr.selrow td{background:rgba(255,45,135,.10)}
    table.dt.adv tr.selrow td:first-child{box-shadow:inset 3px 0 0 var(--mag)}
    .rankcell{font-family:"Anton",sans-serif;font-size:18px;color:var(--mut);text-align:center}
    .rankcell.top{color:var(--lime)}
    .teamcell{display:flex;flex-direction:column;gap:6px;min-width:160px}
    .teamcell a{display:flex;align-items:center;gap:8px;font-weight:800;color:var(--txt)}
    .teamcell a:hover{color:var(--lime)}
    .bar-track{height:5px;border-radius:3px;background:var(--ink3);overflow:hidden}
    .bar-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--lime),#9fd400)}

    /* position badges */
    .pos-badge{display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;
      padding:2px 8px;border-radius:6px;text-transform:uppercase;letter-spacing:.04em}
    .pos-GK{background:rgba(255,194,75,.16);color:var(--gold)}
    .pos-DE{background:rgba(51,224,255,.15);color:var(--cyan)}
    .pos-MI{background:rgba(179,136,255,.16);color:#b388ff}
    .pos-FO{background:rgba(57,224,127,.15);color:var(--conf-CAF)}

    .table-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;
      padding:14px 16px;border-top:1px solid var(--line);background:var(--ink2);font-size:13px;color:var(--mut)}
    .table-foot .btn{padding:8px 14px}

    @media(max-width:780px){
      .podium-deck{grid-template-columns:1fr}
      .podium-card.p1,.podium-card.p2,.podium-card.p3{order:0;padding-top:22px}
      .ctrlbar{grid-template-columns:1fr 1fr}
      .chart-head h3{font-size:18px}
    }
    @media(max-width:520px){.ctrlbar{grid-template-columns:1fr}}

    /* =========================================================
       MOBILE-NATIVE LAYOUT (players + team stats)
       A bespoke phone experience: no horizontal scrolling tables,
       no cramped scatter plot. Instead: a sticky focus rail,
       ranked stat cards with inline bars, a podium strip, an
       expandable detail drawer, and a slide-up filter sheet.
       ========================================================= */
    .mdash{display:flex;flex-direction:column;gap:16px;animation:dashIn .35s ease}

    /* hero */
    .m-hero{padding:2px 2px 0}
    .m-hero .kicker{font-size:11px}
    .m-hero h1{font-family:"Anton",sans-serif;font-size:30px;line-height:.98;text-transform:uppercase;margin:4px 0 0}
    .m-hero .m-sub{color:var(--mut);font-size:13px;margin:8px 0 0;line-height:1.45}
    .m-hero .m-count{display:inline-block;margin-top:10px;font-family:"Spline Sans Mono",monospace;
      font-size:11.5px;color:var(--lime);background:rgba(200,255,0,.08);border:1px solid rgba(200,255,0,.25);
      padding:4px 10px;border-radius:999px;font-weight:700}

    /* sticky focus rail — choose the stat that everything ranks/sorts by */
    .m-focuswrap{position:sticky;top:0;z-index:30;margin:0 -16px;padding:10px 0 9px;
      background:linear-gradient(180deg,var(--bg,#0a0c10) 72%,rgba(10,12,16,0));backdrop-filter:blur(6px)}
    .m-focus-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--mut);
      font-weight:800;padding:0 16px 7px;display:flex;align-items:center;gap:8px}
    .m-focus-label b{color:var(--lime);font-family:"Spline Sans Mono",monospace}
    .m-rail{display:flex;gap:8px;overflow-x:auto;padding:0 16px 2px;scrollbar-width:none;
      -webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
    .m-rail::-webkit-scrollbar{display:none}
    .m-chip{flex:0 0 auto;scroll-snap-align:start;border:1px solid var(--line);background:var(--ink3);
      color:var(--mut);font-weight:800;font-size:13px;padding:9px 15px;border-radius:999px;white-space:nowrap;
      transition:.16s;cursor:pointer;font-family:inherit}
    .m-chip:active{transform:scale(.96)}
    .m-chip.on{background:var(--lime);border-color:var(--lime);color:#10130a;box-shadow:0 4px 14px rgba(200,255,0,.25)}

    /* toolbar: sort-direction + filter trigger */
    .m-toolbar{display:flex;gap:10px;align-items:center}
    .m-toolbar .m-sortbtn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;
      background:var(--ink3);border:1px solid var(--line);color:var(--txt);border-radius:12px;
      padding:11px 14px;font-weight:800;font-size:13px;font-family:inherit;cursor:pointer}
    .m-toolbar .m-sortbtn .dir{color:var(--lime);font-family:"Spline Sans Mono",monospace}
    .m-toolbar .m-filterbtn{position:relative;display:flex;align-items:center;gap:8px;background:var(--ink3);
      border:1px solid var(--line);color:var(--txt);border-radius:12px;padding:11px 16px;font-weight:800;
      font-size:13px;font-family:inherit;cursor:pointer}
    .m-toolbar .m-filterbtn.has-active{border-color:var(--lime);color:var(--lime)}
    .m-toolbar .m-filterbtn .dotbadge{width:7px;height:7px;border-radius:50%;background:var(--mag)}

    /* podium strip — top 3 for the chosen focus */
    .m-podium{display:flex;gap:10px}
    .m-podium .pod{flex:1;position:relative;border-radius:14px;padding:14px 10px 12px;text-align:center;
      background:linear-gradient(180deg,var(--ink2),var(--ink));border:1px solid var(--line);overflow:hidden}
    .m-podium .pod .rk{font-family:"Spline Sans Mono",monospace;font-size:11px;font-weight:700;color:var(--mut)}
    .m-podium .pod .fl{font-size:30px;line-height:1;margin:5px 0 3px}
    .m-podium .pod .nm{font-family:"Anton",sans-serif;font-size:14px;text-transform:uppercase;line-height:1;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .m-podium .pod .vl{font-family:"Anton",sans-serif;font-size:22px;color:var(--lime);line-height:1;margin-top:8px}
    .m-podium .pod.g1{border-top:3px solid var(--gold)}
    .m-podium .pod.g2{border-top:3px solid #cdd3da}
    .m-podium .pod.g3{border-top:3px solid #cd7f32}

    /* ranked stat cards */
    .m-list{display:flex;flex-direction:column;gap:9px}
    .m-card{background:linear-gradient(180deg,var(--ink2),var(--ink));border:1px solid var(--line);
      border-radius:14px;overflow:hidden;transition:border-color .15s}
    .m-card.sel{border-color:var(--mag);box-shadow:0 0 0 1px var(--mag) inset}
    .m-card .m-row{display:flex;align-items:center;gap:12px;padding:13px 14px;cursor:pointer}
    .m-card .m-rank{flex:0 0 26px;text-align:center;font-family:"Anton",sans-serif;font-size:19px;color:var(--mut)}
    .m-card .m-rank.top{color:var(--lime)}
    .m-card .m-flag{flex:0 0 auto;font-size:25px;line-height:1}
    .m-card .m-id{flex:1;min-width:0}
    .m-card .m-name{font-weight:800;font-size:15px;color:var(--txt);white-space:nowrap;overflow:hidden;
      text-overflow:ellipsis;display:flex;align-items:center;gap:7px}
    .m-card .m-meta{font-size:11.5px;color:var(--mut);margin-top:3px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .m-card .m-meta .dot-sep{opacity:.4}
    .m-card .m-statend{flex:0 0 auto;text-align:right;min-width:62px}
    .m-card .m-bigval{font-family:"Anton",sans-serif;font-size:23px;color:var(--lime);line-height:1}
    .m-card .m-bigval.lower{color:#ff5fa2}
    .m-card .m-statlbl{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);margin-top:3px}
    .m-card .m-chev{flex:0 0 auto;color:var(--mut2);transition:transform .2s;font-size:13px}
    .m-card.open .m-chev{transform:rotate(90deg)}
    /* inline bar under the name */
    .m-card .m-barrow{padding:0 14px 12px;margin-top:-3px}
    .m-card .m-bar{height:6px;border-radius:4px;background:var(--ink3);overflow:hidden}
    .m-card .m-bar i{display:block;height:100%;border-radius:4px;
      background:linear-gradient(90deg,var(--lime),#9fd400)}
    .m-card .m-bar i.lower{background:linear-gradient(90deg,#ff2d87,#b51e60)}

    /* expandable detail drawer */
    .m-detail{display:none;padding:2px 14px 15px;border-top:1px solid var(--line);
      background:rgba(255,255,255,.012)}
    .m-card.open .m-detail{display:block;animation:dashIn .25s ease}
    .m-detail .pos-badge{margin-bottom:10px}
    .m-statgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:11px}
    .m-statgrid .sg{background:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 8px;text-align:center}
    .m-statgrid .sg .k{font-size:8.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);font-weight:800}
    .m-statgrid .sg .v{font-family:"Spline Sans Mono",monospace;font-size:14px;color:#fff;font-weight:700;margin-top:4px}
    .m-statgrid .sg.hl{border-color:rgba(200,255,0,.4);background:rgba(200,255,0,.06)}
    .m-statgrid .sg.hl .v{color:var(--lime)}
    .m-detail .m-detail-actions{margin-top:12px;display:flex;gap:9px}
    .m-detail .m-detail-actions .btn{flex:1;justify-content:center;padding:10px}

    .m-empty{text-align:center;color:var(--mut);padding:40px 18px;background:var(--ink2);
      border:1px dashed var(--line);border-radius:14px;font-size:14px}
    .m-showmore{display:flex;justify-content:center;padding:4px 0 2px}
    .m-showmore .btn{width:100%;justify-content:center;padding:13px}

    /* slide-up filter sheet */
    .m-sheet-scrim{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(2px);z-index:200;
      opacity:0;pointer-events:none;transition:opacity .2s}
    .m-sheet-scrim.show{opacity:1;pointer-events:auto}
    .m-sheet{position:fixed;left:0;right:0;bottom:0;z-index:201;background:var(--ink2);
      border-top:1px solid var(--line);border-radius:20px 20px 0 0;padding:8px 18px calc(20px + env(safe-area-inset-bottom));
      transform:translateY(110%);transition:transform .26s cubic-bezier(.32,.72,0,1);max-height:86vh;overflow-y:auto}
    .m-sheet.show{transform:none}
    .m-sheet .grab{width:42px;height:5px;border-radius:3px;background:var(--line);margin:6px auto 14px}
    .m-sheet h3{font-family:"Anton",sans-serif;font-size:19px;text-transform:uppercase;margin-bottom:14px}
    .m-sheet .m-field{margin-bottom:16px}
    .m-sheet .m-field>label{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;
      color:var(--mut);font-weight:800;margin-bottom:8px}
    .m-sheet .m-field>label b{color:var(--lime);font-family:"Spline Sans Mono",monospace}
    .m-sheet input[type=text],.m-sheet select{width:100%;background:var(--ink3);border:1px solid var(--line);
      color:var(--txt);padding:13px 14px;border-radius:11px;font-size:16px;font-family:inherit}
    .m-sheet input:focus,.m-sheet select:focus{outline:none;border-color:var(--lime)}
    .m-sheet input[type=range]{width:100%;accent-color:var(--lime);height:30px}
    .m-segwrap{display:flex;flex-wrap:wrap;gap:8px}
    .m-seg{flex:1 1 auto;text-align:center;border:1px solid var(--line);background:var(--ink3);color:var(--mut);
      border-radius:10px;padding:11px 8px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;min-width:72px}
    .m-seg.on{background:var(--lime);border-color:var(--lime);color:#10130a}
    .m-sheet .m-sheet-foot{display:flex;gap:10px;margin-top:6px;position:sticky;bottom:0;
      background:var(--ink2);padding-top:10px}
    .m-sheet .m-sheet-foot .btn{flex:1;justify-content:center;padding:14px}

    /* hide the bespoke mobile layout above the breakpoint, just in case */
    @media(min-width:${MOBILE_BP + 1}px){ .mdash,.m-sheet,.m-sheet-scrim{display:none!important} }

    /* =========================================================
       REVAMP COMPONENTS — added for the live-API rebuild of the
       stats / players / country pages. All built on the existing
       design tokens so they match the broadcast theme.
       ========================================================= */

    /* scope switcher (shared) */
    .scope-rail{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px;
      -webkit-overflow-scrolling:touch}
    .scope-rail::-webkit-scrollbar{display:none}
    .scope-chip{flex:0 0 auto;border:1px solid var(--line);background:var(--ink3);color:var(--mut);
      font-weight:800;font-size:12.5px;padding:9px 15px;border-radius:999px;white-space:nowrap;
      cursor:pointer;font-family:inherit;transition:.16s;text-transform:uppercase;letter-spacing:.04em}
    .scope-chip:hover{color:var(--txt)}
    .scope-chip.on{background:var(--lime);border-color:var(--lime);color:#10130a;
      box-shadow:0 4px 14px rgba(200,255,0,.22)}

    /* skeleton loaders */
    @keyframes bgShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    .skeleton-rows{display:flex;flex-direction:column;gap:8px}
    .sk-row{height:46px;border-radius:10px;background:linear-gradient(90deg,var(--ink2) 25%,var(--ink3) 50%,var(--ink2) 75%);
      background-size:200% 100%;animation:bgShimmer 1.25s ease-in-out infinite}
    .skeleton-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
    .sk-card{height:120px;border-radius:16px;background:linear-gradient(90deg,var(--ink2) 25%,var(--ink3) 50%,var(--ink2) 75%);
      background-size:200% 100%;animation:bgShimmer 1.25s ease-in-out infinite}

    /* fetch error block */
    .fetch-error{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;
      padding:24px 18px;background:var(--ink2);border:1px dashed var(--line);border-radius:14px;
      color:var(--mut);font-size:14px}
    .fetch-error span[aria-hidden]{color:var(--gold);font-size:18px}
    .muted-mini{color:var(--mut2);font-size:11px;font-style:italic}

    /* hero ranking cards (stats page) */
    .hero-rankrow{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
    .rank-card{position:relative;overflow:hidden;border-radius:16px;padding:18px 18px 16px;
      background:linear-gradient(180deg,var(--ink2),var(--ink));border:1px solid var(--line);box-shadow:var(--shadow)}
    .rank-card .rc-lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--mut);font-weight:800}
    .rank-card .rc-team{display:flex;align-items:center;gap:9px;margin-top:12px}
    .rank-card .rc-flag{font-size:30px;line-height:1}
    .rank-card .rc-name{font-family:"Anton",sans-serif;font-size:19px;text-transform:uppercase;line-height:1;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rank-card a.rc-name{color:var(--txt)} .rank-card a.rc-name:hover{color:var(--lime)}
    .rank-card .rc-val{display:block;font-family:"Anton",sans-serif;font-size:34px;color:var(--lime);
      line-height:1;margin-top:12px}
    .rank-card .rc-sub{font-size:11px;color:var(--mut);margin-top:4px}
    @media(max-width:880px){.hero-rankrow{grid-template-columns:1fr 1fr}}
    @media(max-width:460px){.hero-rankrow{grid-template-columns:1fr}}

    /* league table extras */
    .lt-form{min-width:104px}
    .form-strip{display:flex;gap:3px}
    .form-pip{width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
      font-size:9px;font-weight:800;color:#10130a}
    .form-pip.fw{background:var(--lime)} .form-pip.fd{background:var(--gold)} .form-pip.fl{background:var(--mag);color:#fff}
    table.dt.adv td .micro-xg{display:none}
    table.dt.adv tr[data-code]:hover td .micro-xg{display:inline;color:var(--mut2);font-size:10px;margin-left:6px}

    /* confederation dot legend */
    .conf-legend{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
    .conf-legend span{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--mut);font-weight:700}
    .conf-legend i{width:9px;height:9px;border-radius:50%;display:inline-block}

    /* two side-by-side bar charts */
    .barpair{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    @media(max-width:780px){.barpair{grid-template-columns:1fr}}
    .barchart .bc-title{font-family:"Anton",sans-serif;font-size:17px;text-transform:uppercase;margin-bottom:12px}
    .barchart .bc-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:12.5px}
    .barchart .bc-rank{flex:0 0 18px;color:var(--mut2);font-family:"Spline Sans Mono",monospace;font-size:11px;text-align:right}
    .barchart .bc-name{flex:0 0 92px;display:flex;align-items:center;gap:6px;color:var(--txt);font-weight:700;
      overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    .barchart .bc-track{flex:1;height:16px;border-radius:5px;background:var(--ink3);overflow:hidden}
    .barchart .bc-fill{height:100%;border-radius:5px}
    .barchart .bc-val{flex:0 0 52px;text-align:right;font-family:"Spline Sans Mono",monospace;color:#fff;font-size:11.5px}

    /* scatter dot label helper for team confederation colouring */
    .chart-svg .code.conf{font-weight:700}

    /* ===== COUNTRY PAGE ===== */
    .cp-summary{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
    .cp-tile{background:linear-gradient(180deg,var(--ink2),var(--ink));border:1px solid var(--line);
      border-radius:14px;padding:14px 12px;text-align:center;box-shadow:var(--shadow)}
    .cp-tile .ct-v{font-family:"Anton",sans-serif;font-size:26px;color:var(--lime);line-height:1}
    .cp-tile .ct-k{font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);margin-top:6px;font-weight:800}
    @media(max-width:900px){.cp-summary{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:460px){.cp-summary{grid-template-columns:repeat(2,1fr)}}

    .cp-section{background:linear-gradient(180deg,var(--ink2),var(--ink));border:1px solid var(--line);
      border-radius:18px;padding:18px 18px 16px;box-shadow:var(--shadow)}
    .cp-section > h3{font-family:"Anton",sans-serif;font-size:19px;text-transform:uppercase;letter-spacing:.02em;margin-bottom:14px}
    .cp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    @media(max-width:860px){.cp-grid2{grid-template-columns:1fr}}

    /* match cards */
    .match-list{display:flex;flex-direction:column;gap:10px}
    .match-card{background:var(--ink);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:border-color .15s}
    .match-card.open{border-color:var(--lime)}
    .mc-trigger{width:100%;text-align:left;background:none;border:0;color:inherit;cursor:pointer;
      font-family:inherit;padding:13px 15px;display:flex;flex-direction:column;gap:9px}
    .mc-top{display:flex;justify-content:space-between;gap:10px;font-size:11px}
    .mc-comp{text-transform:uppercase;letter-spacing:.06em;color:var(--cyan);font-weight:800}
    .mc-date{color:var(--mut)}
    .mc-mid{display:flex;align-items:center;justify-content:center;gap:14px}
    .mc-side{display:flex;align-items:center;gap:8px;flex:1;min-width:0}
    .mc-side.mc-home{justify-content:flex-end;text-align:right}
    .mc-side.mc-away{justify-content:flex-start}
    .mc-fl{font-size:22px;line-height:1;flex:0 0 auto}
    .mc-nm{font-weight:800;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .mc-score{flex:0 0 auto;font-family:"Anton",sans-serif;font-size:24px;display:flex;align-items:center;gap:6px}
    .mc-score b{color:var(--txt)} .mc-dash{color:var(--mut2);font-size:16px}
    .mc-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--mut)}
    .res-pip{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;
      font-weight:800;font-size:11px;color:#10130a}
    .res-pip.res-w{background:var(--lime)} .res-pip.res-d{background:var(--gold)}
    .res-pip.res-l{background:var(--mag);color:#fff} .res-pip.res-u{background:var(--ink3);color:var(--mut)}
    .mc-mini{font-family:"Spline Sans Mono",monospace}
    .mc-chev{margin-left:auto;transition:transform .2s;color:var(--mut2)}
    .match-card.open .mc-chev{transform:rotate(180deg)}
    .match-drawer{max-height:0;overflow:hidden;transition:max-height .3s ease}
    .match-card.open .match-drawer{max-height:520px}
    .md-inner{padding:6px 16px 16px;border-top:1px solid var(--line)}
    .md-head{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:800;font-size:13px;
      margin:10px 0 12px;color:var(--txt)}
    .md-head .md-vs{color:var(--mut2);font-weight:700}
    .md-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:6px 0;
      border-bottom:1px solid var(--ink3)}
    .md-row .md-a{text-align:right;font-family:"Spline Sans Mono",monospace;color:#fff;font-weight:700}
    .md-row .md-b{text-align:left;font-family:"Spline Sans Mono",monospace;color:#fff;font-weight:700}
    .md-row .md-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);font-weight:800;
      min-width:84px;text-align:center}
    .md-xg{margin-top:12px}
    .md-xg-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);font-weight:800}
    .md-xg-bars{display:flex;flex-direction:column;gap:6px;margin-top:7px}
    .xgbar{height:9px;border-radius:5px;background:var(--ink3);overflow:hidden}
    .xgbar i{display:block;height:100%;border-radius:5px}

    /* radar */
    .radar-wrap{display:flex;justify-content:center;align-items:center;padding:6px 0}
    .radar-svg{width:100%;max-width:320px;height:auto;overflow:visible}
    .rdr-ring{fill:none;stroke:rgba(255,255,255,.07);stroke-width:1}
    .rdr-spoke{stroke:rgba(255,255,255,.10);stroke-width:1}
    .rdr-lbl{fill:var(--mut);font-size:9.5px;font-weight:800;font-family:"Hanken Grotesque",sans-serif;
      text-transform:uppercase;letter-spacing:.04em}
    .rdr-avg{fill:rgba(255,255,255,.05);stroke:#fff;stroke-width:1.4;stroke-dasharray:4 4;opacity:.7}
    .rdr-team{fill:rgba(200,255,0,.2);stroke:var(--lime);stroke-width:2}
    .radar-legend{display:flex;gap:16px;justify-content:center;margin-top:10px;font-size:11px;color:var(--mut)}
    .radar-legend i{display:inline-block;width:16px;height:3px;margin-right:6px;vertical-align:middle}

    /* form chart */
    .formchart-svg{width:100%;height:auto;display:block}
    .formchart-svg .fc-grid{stroke:rgba(255,255,255,.07);stroke-width:1}
    .formchart-svg .fc-axis{fill:var(--mut2);font-size:9px;font-family:"Spline Sans Mono",monospace}
    .fc-legend{display:flex;gap:16px;margin-top:8px;font-size:11px;color:var(--mut)}
    .fc-legend i{display:inline-block;width:14px;height:3px;margin-right:6px;vertical-align:middle}

    /* head to head rivals */
    .h2h-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
    .h2h-card{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:12px;background:var(--ink);
      border:1px solid var(--line);transition:.15s}
    .h2h-card:hover{border-color:var(--lime);transform:translateY(-2px)}
    .h2h-card .h2h-fl{font-size:24px} .h2h-card .h2h-nm{font-weight:800;font-size:13.5px;color:var(--txt)}

    /* player column-group toggles + radar drawer */
    .colgroups{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    .colgroup-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--ink3);
      color:var(--mut);border-radius:999px;padding:7px 13px;font-size:11px;font-weight:800;text-transform:uppercase;
      letter-spacing:.05em;cursor:pointer;font-family:inherit;transition:.15s;user-select:none}
    .colgroup-chip.on{background:rgba(200,255,0,.12);border-color:var(--lime);color:var(--lime)}
    .pdrawer td{background:var(--ink)!important;padding:0!important}
    .pdrawer-inner{padding:16px 18px;display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center}
    @media(max-width:680px){.pdrawer-inner{grid-template-columns:1fr}}
    .pdrawer-meta{font-size:12.5px;color:var(--mut)}
    .pdrawer-meta b{color:var(--txt)}
    .pdrawer-actions{margin-top:12px}

    @media(min-width:${MOBILE_BP + 1}px){ .scope-rail.mobile-only{display:none} }
  `;
  document.head.appendChild(style);
};

/* ---------- router ---------- */
const routes = {
  "": home, "groups": groups, "bracket": bracket, "countries": countries,
  "country": country, "players": players, "stats": stats, "odds": odds, "fantasy": fantasy,
};
function parseHash(){
  const h = location.hash.replace(/^#\/?/,"").split("?")[0];
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
    ["#/countries","Countries","All 48 qualified nations.","03"],
    ["#/players","Player Stats","Per-90 metrics and player analytics.","04"],
    ["#/stats","Team Stats","Attack, defence, xG and discipline rankings.","05"],
    ["#/odds","Betting Odds","Live odds feed.","06","soon"],
    ["#/fantasy","Fantasy Zone","Build your XI and play.","07","soon"],
  ];
  app.innerHTML = `
  <section class="hero">
    <div class="kicker">USA · Canada · Mexico — 11 Jun → 19 Jul 2026</div>
    <h1>WORLD<br><span class="a">CUP</span> <span class="b">26</span></h1>
    <p>12 groups. A new Round of 32. 104 matches across three nations.</p>
    <a class="btn lime" href="#/groups">Explore the groups →</a>
    <a class="btn" href="#/bracket">See the bracket</a>
    <div class="meta">
      <div><b>${s.total_teams}</b><span>Teams</span></div>
      <div><b>${s.total_groups}</b><span>Groups</span></div>
      <div><b>104</b><span>Matches</span></div>
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
    </span>
  </a>`;
}
function groups(){
  app.innerHTML = `
    <div class="kicker">The Draw</div>
    <div class="sec-h"><h1>Groups</h1><span class="pill">12 groups · 4 per group</span></div>
    <p class="muted" style="max-width:620px;margin-bottom:22px">Group winners and runners-up advance automatically; the eight best third-placed teams join them in the Round of 32.</p>
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
        <div class="cm">${t.host?"Host":""}</div>
      </a>`).join("") : `<div class="empty">No nations match.</div>`;
  };
  $("#csearch").addEventListener("input",e=>{q=e.target.value;draw()});
  draw();
}

/* ---------- COUNTRY PAGE (rebuilt: live mini-dashboard) ---------- */
function country(rest){
  injectGlobalDashboardStyles();
  const code = rest[0];
  const t = byCode(code);
  if(!t){ return notfound(); }

  let scope = "TOTAL";
  const groupCodes = D.groups[t.group] || [];
  // per-section caches of the most recent successful payloads (for the radar, which
  // needs both this team's row and the all-teams set for the same scope)
  let lastTeamRow = null, lastMatches = null, allTeamsRow = null;

  app.innerHTML = `
    <div class="crumbs"><a href="#/countries">Countries</a> · Group ${esc(t.group)}</div>
    <div class="cp-hero">
      <div class="bigflag">${t.flag}</div>
      <div>
        <h1>${esc(t.name)}</h1>
        <div class="sub">
          <span class="pill">Group ${esc(t.group)}</span>
          ${t.host?'<span class="pill" style="border-color:var(--lime);color:var(--lime)">Host nation</span>':""}
          <span class="pill">${esc(t.conf||"")}</span>
        </div>
      </div>
    </div>
    <div id="cp-scope" style="margin:18px 0 4px"></div>
    <div class="dashboard-wrapper" style="gap:18px">
      <section id="cp-tiles"></section>
      <div class="cp-grid2">
        <section class="cp-section" id="cp-form"><h3>Goals — recent form</h3><div data-body>${skeletonRows(3)}</div></section>
        <section class="cp-section" id="cp-radar"><h3>Performance Profile</h3><div data-body>${skeletonRows(3)}</div></section>
      </div>
      <section class="cp-section" id="cp-results"><h3>Recent Results</h3><div data-body>${skeletonRows(4)}</div></section>
      <section class="cp-section" id="cp-squad"></section>
      <section class="cp-section" id="cp-h2h"></section>
    </div>`;

  // scope switcher
  $("#cp-scope").appendChild(scopeSwitcher(scope, (val)=>{ scope = val; loadAll(); }));

  /* ---- summary tiles ---- */
  function renderTiles(s){
    const wdl = `${fInt(s.wins)}–${fInt(s.draws)}–${fInt(s.losses)}`;
    const tiles = [
      ["Matches", fInt(s.matches_played)],
      ["W–D–L", wdl],
      ["Goals F / A", `${fInt(s.goals_for)} / ${fInt(s.goals_against)}`],
      ["xG F / A", `${f1(s.xg_for)} / ${f1(s.xg_against)}`],
      ["Avg Poss", fPctRaw(s.avg_possession)],
      ["Clean Sheets", fInt(s.clean_sheets)],
    ];
    $("#cp-tiles").innerHTML = `<div class="cp-summary">
      ${tiles.map(([k,v])=>`<div class="cp-tile"><div class="ct-v">${v}</div><div class="ct-k">${esc(k)}</div></div>`).join("")}
    </div>`;
  }

  /* ---- recent results (match cards w/ drawers) ---- */
  function renderResults(matches){
    const body = $("#cp-results [data-body]");
    if(!matches || !matches.length){
      body.innerHTML = `<div class="empty">No matches found for ${esc(t.name)} in this scope.</div>`;
      return;
    }
    body.innerHTML = `<div class="match-list">${matches.map((m,i)=>matchCard(m,i)).join("")}</div>`;
    wireMatchCards(body);
  }

  /* ---- form chart: goals_for (lime) vs goals_against (mag), result-tinted area ---- */
  function renderForm(matches){
    const body = $("#cp-form [data-body]");
    const ms = (matches||[]).slice().reverse(); // oldest → newest for a left-to-right timeline
    if(!ms.length){ body.innerHTML = `<div class="empty">No match data.</div>`; return; }
    const W=520, H=200, pad={l:30,r:14,t:16,b:30};
    const gf = ms.map(m=>Number(m.goals_for)||0), ga = ms.map(m=>Number(m.goals_against)||0);
    const ymax = Math.max(3, ...gf, ...ga);
    const n = ms.length;
    const sx = i => pad.l + (n<=1?0:(i/(n-1)))*(W-pad.l-pad.r);
    const sy = v => H-pad.b - (v/ymax)*(H-pad.t-pad.b);
    const line = arr => arr.map((v,i)=>`${i?"L":"M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
    // result tint segments along the x-axis
    const resColor = r => r==="W"?"rgba(200,255,0,.16)":r==="D"?"rgba(255,194,75,.14)":r==="L"?"rgba(255,45,135,.14)":"transparent";
    let bands="";
    ms.forEach((m,i)=>{
      const x0 = i===0?pad.l:(sx(i)+sx(i-1))/2;
      const x1 = i===n-1?(W-pad.r):(sx(i)+sx(i+1))/2;
      bands+=`<rect x="${x0.toFixed(1)}" y="${pad.t}" width="${(x1-x0).toFixed(1)}" height="${H-pad.t-pad.b}" fill="${resColor(m.result)}"/>`;
    });
    // y gridlines
    let grid="";
    for(let k=0;k<=ymax;k++){ grid+=`<line class="fc-grid" x1="${pad.l}" y1="${sy(k)}" x2="${W-pad.r}" y2="${sy(k)}"/>
      <text class="fc-axis" x="${pad.l-6}" y="${sy(k)+3}" text-anchor="end">${k}</text>`; }
    // x labels (abbreviated dates)
    let xlab="";
    ms.forEach((m,i)=>{
      if(n>8 && i%2!==0 && i!==n-1) return;
      let d=""; try{ d=new Date(m.date).toLocaleDateString("en-GB",{day:"numeric",month:"short"});}catch(e){}
      xlab+=`<text class="fc-axis" x="${sx(i)}" y="${H-pad.b+14}" text-anchor="middle">${esc(d)}</text>`;
    });
    const dot=(arr,color)=>arr.map((v,i)=>`<circle cx="${sx(i).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="3" fill="${color}"/>`).join("");
    body.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" class="formchart-svg" role="img" aria-label="Goals for and against across recent matches">
        ${bands}${grid}${xlab}
        <path d="${line(gf)}" fill="none" stroke="var(--lime)" stroke-width="2.4"/>
        <path d="${line(ga)}" fill="none" stroke="var(--mag)" stroke-width="2.4"/>
        ${dot(gf,"var(--lime)")}${dot(ga,"var(--mag)")}
      </svg>
      <div class="fc-legend">
        <span><i style="background:var(--lime)"></i>Goals for</span>
        <span><i style="background:var(--mag)"></i>Goals against</span>
        <span style="color:var(--mut2)">band = result (W/D/L)</span>
      </div>`;
  }

  /* ---- radar: team per-90 profile vs the average of all qualified nations (same scope) ---- */
  function renderRadar(teamRow, allRows){
    const body = $("#cp-radar [data-body]");
    if(!teamRow || !allRows || !allRows.length){ body.innerHTML = `<div class="empty">Not enough data for a profile.</div>`; return; }
    const SPOKES = [
      ["goals_per_90","Goals/90", false],
      ["xg_per_90","xG/90", false],
      ["xg_against_per_90","xGA/90", true],     // lower better — invert for display
      ["shot_accuracy","Shot Acc", false],
      ["clean_sheet_pct","CS %", false],
      ["points_per_game","Pts/Game", false],
    ];
    // normalise each spoke against the max across all teams; invert "lower better" ones
    const labels = SPOKES.map(s=>s[1]);
    const norm = (row)=> SPOKES.map(([k,,invert])=>{
      const vals = allRows.map(r=>Number(r[k])||0);
      const mx = Math.max(...vals, 0.0001);
      let v = (Number(row[k])||0)/mx;
      return invert ? (1-v) : v;
    });
    const avgRow = {};
    SPOKES.forEach(([k])=>{ avgRow[k] = allRows.reduce((a,r)=>a+(Number(r[k])||0),0)/allRows.length; });
    body.innerHTML = `
      <div class="radar-wrap">${radarChart(norm(teamRow), norm(avgRow), labels)}</div>
      <div class="radar-legend">
        <span><i style="background:var(--lime)"></i>${esc(t.name)}</span>
        <span><i style="background:#fff"></i>Field average</span>
      </div>`;
  }

  /* ---- squad table (live from /api/players for this nationality) ---- */
  function renderSquad(players){
    const sec = $("#cp-squad");
    if(!players || !players.length){
      sec.innerHTML = `<h3>Squad</h3><div class="empty">No player data for ${esc(t.name)} in this scope.</div>`;
      return;
    }
    const rows = players.slice().sort((a,b)=>(Number(b.minutes_played_overall)||0)-(Number(a.minutes_played_overall)||0));
    sec.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
        <h3 style="margin:0">Squad</h3>
        <a class="btn lime sm" href="#/players?nat=${encodeURIComponent(t.name)}">View in Player Rankings →</a>
      </div>
      <div class="tbl-wrap"><table class="dt adv" id="cp-sqt">
        <thead><tr>
          <th data-k="full_name" data-t="s">Player</th>
          <th data-k="position" data-t="s">Pos</th>
          <th data-k="current_club" data-t="s">Club</th>
          <th class="num" data-k="minutes_played_overall">Min</th>
          <th class="num" data-k="goals_overall">G</th>
          <th class="num" data-k="assists_overall">A</th>
          <th class="num" data-k="goals_per_90">G/90</th>
          <th class="num" data-k="xg_per_90">xG/90</th>
          <th class="num" data-k="goals_involved_per_90">G+A/90</th>
        </tr></thead><tbody></tbody></table></div>`;
    const renderRows = (tbody,rs)=>{
      tbody.innerHTML = rs.map(p=>{
        const tag = (p.position||"").substring(0,2).toUpperCase()||"—";
        return `<tr>
          <td class="name">${esc(p.full_name)}</td>
          <td><span class="pos-badge pos-${tag}">${tag}</span></td>
          <td>${esc(p.current_club||"—")}</td>
          <td class="num" style="color:#fff">${fInt(p.minutes_played_overall)}</td>
          <td class="num">${fInt(p.goals_overall)}</td>
          <td class="num">${fInt(p.assists_overall)}</td>
          <td class="num">${f2(p.goals_per_90)}</td>
          <td class="num">${f2(p.xg_per_90)}</td>
          <td class="num">${f2(p.goals_involved_per_90)}</td>
        </tr>`;
      }).join("");
    };
    makeSortable($("#cp-sqt"), rows, renderRows);
  }

  /* ---- head-to-head: group rivals (static, no extra API call) ---- */
  function renderH2H(){
    const sec = $("#cp-h2h");
    const rivals = groupCodes.filter(c=>c!==code);
    if(!rivals.length){ sec.innerHTML = ""; return; }
    sec.innerHTML = `<h3>Group ${esc(t.group)} Rivals</h3>
      <div class="h2h-grid">
        ${rivals.map(c=>{const o=byCode(c);return `<a class="h2h-card" href="#/country/${c}">
          <span class="h2h-fl">${o.flag}</span><span class="h2h-nm">${esc(o.name)}</span></a>`;}).join("")}
      </div>`;
  }

  /* ---- orchestration ---- */
  function setSkeleton(){
    $("#cp-tiles").innerHTML = skeletonCards(6);
    $("#cp-results [data-body]").innerHTML = skeletonRows(4);
    $("#cp-form [data-body]").innerHTML = skeletonRows(3);
    $("#cp-radar [data-body]").innerHTML = skeletonRows(3);
    $("#cp-squad").innerHTML = `<h3>Squad</h3>${skeletonRows(5)}`;
  }

  function loadAll(){
    setSkeleton();
    renderH2H(); // static — render immediately

    // team summary row (+ all teams for the radar)
    Promise.all([fetchTeam(t.name, scope), fetchTeams(scope)])
      .then(([teamRows, allRows])=>{
        const s = (teamRows && teamRows[0]) || null;
        if(s){ renderTiles(s); lastTeamRow=s; }
        else { $("#cp-tiles").innerHTML = `<div class="empty">No team data for ${esc(t.name)} in this scope.</div>`; }
        allTeamsRow = allRows||[];
        renderRadar(s, allTeamsRow);
      })
      .catch(()=>{
        fetchError($("#cp-tiles"), loadAll);
        $("#cp-radar [data-body]").innerHTML = "";
        fetchError($("#cp-radar [data-body]"), loadAll);
      });

    // matches → results list + form chart
    fetchMatches(t.name, scope, 10)
      .then(matches=>{ lastMatches=matches; renderResults(matches); renderForm(matches); })
      .catch(()=>{
        fetchError($("#cp-results [data-body]"), loadAll);
        $("#cp-form [data-body]").innerHTML = "";
        fetchError($("#cp-form [data-body]"), loadAll);
      });

    // squad via player endpoint, filtered to this nationality
    fetchPlayers({nationality:t.name, scope, sort:"minutes_played_overall", order:"desc", min_minutes:0, limit:60})
      .then(renderSquad)
      .catch(()=>{ $("#cp-squad").innerHTML = `<h3>Squad</h3><div></div>`; fetchError($("#cp-squad div"), loadAll); });
  }

  loadAll();
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

// shared axis bounds: pad the real data range, but keep a 0 baseline when data sits near zero
function axisBounds(vals){
  if(!vals.length) return [0,1];
  let lo=Math.min(...vals), hi=Math.max(...vals);
  if(lo===hi){ lo-=1; hi+=1; }
  const pad=(hi-lo)*0.12 || 1;
  let lo2=lo-pad; if(lo>=0 && lo2<0) lo2=0;
  return [lo2, hi+pad];
}

/* ---------- PLAYERS (rebuilt: live API analytics hub) ---------- */
/* full metric list for the axis pickers + sort options */
const METRICS = [
  ["goals_per_90","Goals / 90"],
  ["assists_per_90","Assists / 90"],
  ["goals_involved_per_90","G+A / 90"],
  ["xg_per_90","xG / 90"],
  ["xa_per_90","xA / 90"],
  ["npxg_per_90","npxG / 90"],
  ["shots_per_90","Shots / 90"],
  ["shots_on_target_per_90","Shots on T / 90"],
  ["shot_conversion_rate","Shot Conv %"],
  ["shot_accuracy","Shot Accuracy %"],
  ["key_passes_per_90","Key Passes / 90"],
  ["chances_created_per_90","Chances Created / 90"],
  ["dribbles_per_90","Dribbles / 90"],
  ["pass_completion_rate","Pass Completion %"],
  ["tackles_per_90","Tackles / 90"],
  ["tackle_success_rate","Tackle Success %"],
  ["interceptions_per_90","Interceptions / 90"],
  ["clearances_per_90","Clearances / 90"],
  ["pressures_per_90","Pressures / 90"],
  ["duels_won_per_90","Duels Won / 90"],
  ["saves_per_90","Saves / 90"],
  ["conceded_per_90","Goals Conceded / 90"],
  ["xg_overperformance","xG Overperformance"],
  ["minutes_played_overall","Total Minutes"],
  ["goals_overall","Total Goals"],
  ["assists_overall","Total Assists"],
  ["appearances_overall","Appearances"],
];
const MLABEL = Object.fromEntries(METRICS);
// which metric keys are stored as 0–1 fractions (→ render as %)
const PCT_METRICS = new Set(["shot_conversion_rate","shot_accuracy","pass_completion_rate","tackle_success_rate"]);
// position → bucket (GK/DEF/MID/FWD) for colouring
function posBucket(pos){
  const p=(pos||"").toLowerCase();
  if(p.startsWith("goal")||p==="gk") return "GK";
  if(p.startsWith("def")||p.includes("back")) return "DEF";
  if(p.startsWith("mid")) return "MID";
  if(p.startsWith("for")||p.startsWith("att")||p.includes("wing")||p.includes("striker")) return "FWD";
  return "MID";
}
const POS_COLOR = {GK:"var(--gold)", DEF:"var(--cyan)", MID:"#b388ff", FWD:"var(--conf-CAF)"};
// format a metric value according to its kind
function fmtMetric(key, v){
  if(v==null) return "–";
  if(PCT_METRICS.has(key)) return fPct(v);
  if(key==="minutes_played_overall"||key==="goals_overall"||key==="assists_overall"||key==="appearances_overall") return fInt(v);
  return f2(v);
}

function players(){
  injectGlobalDashboardStyles();
  if(isMobile()){ return playersMobile(); }

  // read an optional nationality pre-filter from the hash (set by country page deep-links)
  const hashParams = new URLSearchParams((location.hash.split("?")[1]||""));
  const preNat = hashParams.get("nat") || "";

  // state
  let scope="TOTAL", q="", pos="", nat=preNat, minMin=270, limit=50;
  let sortK="goals_per_90", sortDir="desc";
  let ax="shots_per_90", ay="xg_per_90";
  let selId=null, openId=null;
  let colGroups = {ATTACKING:true, CREATING:true, DEFENDING:false, GOALKEEPING:false};
  let rows = [];        // current API payload
  let avgByPos = {};    // positional averages for the drawer radar

  app.innerHTML = `
    <div class="dashboard-wrapper">
      <div class="dash-lead">
        <div class="lead-copy">
          <div class="kicker">Player Analytics</div>
          <div class="sec-h"><h1>Player Stats</h1><span class="pill" id="ptotal"></span></div>
          <p>Per-90 metrics unless marked as a total. Click any player to highlight them across the chart and table.</p>
        </div>
      </div>

      <div id="p-scope"></div>

      <div class="ctrlbar">
        <div class="ctrl"><label>Search player or nation</label>
          <input id="psearch" placeholder="e.g. Mbappé, Brazil…" value="${esc(q)}"></div>
        <div class="ctrl"><label>Position</label>
          <select id="ppos"><option value="">All positions</option>
            <option>Goalkeeper</option><option>Defender</option><option>Midfielder</option><option>Forward</option></select></div>
        <div class="ctrl"><label>Nationality</label>
          <select id="pnat"><option value="">All nations</option>
            ${teamsArr().slice().sort((a,b)=>a.name.localeCompare(b.name))
              .map(t=>`<option value="${esc(t.name)}"${t.name===nat?" selected":""}>${esc(t.name)}</option>`).join("")}</select></div>
        <div class="ctrl"><label>Min minutes: <b id="mmval">${minMin}</b></label>
          <input type="range" id="pmin" min="0" max="900" step="90" value="${minMin}"></div>
        <div class="ctrl"><label>Sort metric</label>
          <select id="psort">${METRICS.map(([k,l])=>`<option value="${k}"${k===sortK?" selected":""}>${l}</option>`).join("")}</select></div>
        <div class="ctrl"><label>Direction</label>
          <select id="porder"><option value="desc">High → Low</option><option value="asc">Low → High</option></select></div>
        <div class="ctrl"><label>Limit</label>
          <select id="plimit"><option>25</option><option selected>50</option><option>100</option></select></div>
      </div>

      <section id="p-podium"></section>

      <div class="chart-card">
        <div class="chart-head">
          <h3 id="chart-title"></h3>
          <div class="axis-picks">
            <div class="axis-pick y"><span class="ax-tag">Y ↑</span>
              <select id="ay">${METRICS.map(([k,l])=>`<option value="${k}"${k===ay?" selected":""}>${l}</option>`).join("")}</select></div>
            <div class="axis-pick"><span class="ax-tag">X →</span>
              <select id="ax">${METRICS.map(([k,l])=>`<option value="${k}"${k===ax?" selected":""}>${l}</option>`).join("")}</select></div>
          </div>
        </div>
        <div class="chart-stage"><div id="scatter">${skeletonRows(4)}</div></div>
        <div class="chart-foot">
          <span class="legend">
            <span><i style="background:var(--gold)"></i>GK</span>
            <span><i style="background:var(--cyan)"></i>DEF</span>
            <span><i style="background:#b388ff"></i>MID</span>
            <span><i style="background:var(--conf-CAF)"></i>FWD</span>
            <span id="scount"></span>
          </span>
          <span class="hint">Dot size = minutes · click to highlight · hover for detail</span>
        </div>
      </div>

      <div class="card" style="overflow:hidden;padding:0">
        <div style="padding:14px 16px;border-bottom:1px solid var(--line);display:flex;gap:14px;align-items:center;flex-wrap:wrap">
          <span style="font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--mut);font-weight:800">Columns</span>
          <div class="colgroups" id="p-colgroups">
            ${["ATTACKING","CREATING","DEFENDING","GOALKEEPING"].map(g=>`<button class="colgroup-chip${colGroups[g]?" on":""}" data-cg="${g}">${g}</button>`).join("")}
          </div>
        </div>
        <div class="tbl-wrap"><table class="dt adv" id="pt"><thead></thead><tbody></tbody></table></div>
        <div class="table-foot" id="ptfoot"></div>
      </div>
    </div>`;

  $("#p-scope").appendChild(scopeSwitcher(scope, (val)=>{ scope=val; load(); }));

  /* ---------- column definitions (grouped) ---------- */
  const COLS = {
    BASE: [
      ["rank","#", "num", v=>v],
    ],
    ATTACKING: [
      ["goals_overall","G","num",fInt],["assists_overall","A","num",fInt],
      ["goals_involved_per_90","G+A/90","num",f2],["xg_per_90","xG/90","num",f2],
      ["xa_per_90","xA/90","num",f2],["shots_per_90","Sh/90","num",f2],
      ["shot_accuracy","ShAcc","num",fPct],["shot_conversion_rate","Conv","num",fPct],
    ],
    CREATING: [
      ["key_passes_per_90","KP/90","num",f2],["chances_created_per_90","CC/90","num",f2],
      ["dribbles_per_90","Drb/90","num",f2],["pass_completion_rate","Pass%","num",fPct],
    ],
    DEFENDING: [
      ["tackles_per_90","Tk/90","num",f2],["tackle_success_rate","TkW%","num",fPct],
      ["interceptions_per_90","Int/90","num",f2],["clearances_per_90","Clr/90","num",f2],
      ["pressures_per_90","Pr/90","num",f2],
    ],
    GOALKEEPING: [
      ["saves_per_90","Sv/90","num",f2],["conceded_per_90","GA/90","num",f2],
    ],
  };
  const activeCols = ()=>{
    const cols = [
      ["rank","#","num",null],
      ["full_name","Player","s",null],
      ["nationality","Nat","s",null],
      ["position","Pos","s",null],
      ["current_club","Club","s",null],
      ["minutes_played_overall","Min","num",fInt],
      ["appearances_overall","Apps","num",fInt],
    ];
    ["ATTACKING","CREATING","DEFENDING","GOALKEEPING"].forEach(g=>{ if(colGroups[g]) cols.push(...COLS[g]); });
    return cols;
  };

  /* ---------- scatter ---------- */
  function drawScatter(){
    const stage=$("#scatter");
    const valid = rows.filter(p=>p[ax]!=null && p[ay]!=null);
    if(!valid.length){ stage.innerHTML=`<div class="empty">No players to plot.</div>`; $("#scount").textContent=""; return; }
    const W=860, H=460, pad={l:64,r:30,t:30,b:54};
    const xs=valid.map(p=>Number(p[ax])||0), ys=valid.map(p=>Number(p[ay])||0);
    const [xmin,xmax]=axisBounds(xs), [ymin,ymax]=axisBounds(ys);
    const mins=valid.map(p=>Number(p.minutes_played_overall)||0);
    const minMx=Math.max(...mins,1);
    const sx=v=>pad.l+(v-xmin)/(xmax-xmin||1)*(W-pad.l-pad.r);
    const sy=v=>H-pad.b-(v-ymin)/(ymax-ymin||1)*(H-pad.t-pad.b);
    const med=a=>{if(!a.length)return 0;const s=[...a].sort((m,n)=>m-n);return s[Math.floor(s.length/2)];};
    const mx=med(xs), my=med(ys);
    const ticks=(lo,hi,n=5)=>Array.from({length:n+1},(_,i)=>lo+(hi-lo)*i/n);

    let dots="";
    valid.forEach((p,i)=>{
      const sel=p.player_id===selId, cx=sx(Number(p[ax])||0), cy=sy(Number(p[ay])||0);
      const r = sel ? 9 : (4 + 5*((Number(p.minutes_played_overall)||0)/minMx));
      const col = sel ? "var(--mag)" : POS_COLOR[posBucket(p.position)];
      dots+=`<circle class="dot" data-i="${i}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"
        fill="${col}" fill-opacity="${sel?1:.78}" stroke="#080a0d" stroke-width="${sel?2.5:1}"/>`;
    });
    const xlab=ticks(xmin,xmax).map(v=>`<text class="tick" x="${sx(v)}" y="${H-pad.b+18}" text-anchor="middle">${+v.toFixed(2)}</text>`).join("");
    const ylab=ticks(ymin,ymax).map(v=>`<text class="tick" x="${pad.l-9}" y="${sy(v)+4}" text-anchor="end">${+v.toFixed(2)}</text>`).join("");

    stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" id="scsvg" role="img" aria-label="${esc(MLABEL[ay])} versus ${esc(MLABEL[ax])} scatter plot">
      <line class="guide" x1="${pad.l}" y1="${sy(my)}" x2="${W-pad.r}" y2="${sy(my)}"/>
      <line class="guide" x1="${sx(mx)}" y1="${pad.t}" x2="${sx(mx)}" y2="${H-pad.b}"/>
      <line class="axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H-pad.b}"/>
      <line class="axis" x1="${pad.l}" y1="${H-pad.b}" x2="${W-pad.r}" y2="${H-pad.b}"/>
      ${xlab}${ylab}
      <text class="axttl" x="${pad.l+(W-pad.l-pad.r)/2}" y="${H-10}" text-anchor="middle">${esc(MLABEL[ax])} →</text>
      <text class="axttl" transform="rotate(-90 16 ${pad.t+(H-pad.t-pad.b)/2})" x="16" y="${pad.t+(H-pad.t-pad.b)/2}" text-anchor="middle">${esc(MLABEL[ay])} →</text>
      ${dots}
      <g id="tip" style="display:none"><rect rx="8" id="tipbg" fill="#16202e" stroke="#2b394e" filter="drop-shadow(0px 6px 14px rgba(0,0,0,.6))"/><text id="tiptx"></text></g>
    </svg>`;
    $("#scount").textContent = `${valid.length} players plotted.`;

    const svg=$("#scsvg"), tip=$("#tip",svg), tbg=$("#tipbg",svg), ttx=$("#tiptx",svg);
    svg.querySelectorAll(".dot").forEach(c=>{
      c.addEventListener("mousemove",()=>{
        const p=valid[+c.dataset.i];
        ttx.innerHTML=`<tspan x="12" dy="6" style="font-weight:800;fill:var(--lime);font-size:13px">${esc(p.full_name)}</tspan>`+
          `<tspan x="12" dy="17" fill="#8c93a0" font-size="11">${flagFor(p.nationality)} ${esc(p.nationality)} · ${esc(p.current_club||"")}</tspan>`+
          `<tspan x="12" dy="18" fill="#fff" font-size="12">${esc(MLABEL[ay])}: ${fmtMetric(ay,p[ay])}</tspan>`+
          `<tspan x="12" dy="16" fill="#fff" font-size="12">${esc(MLABEL[ax])}: ${fmtMetric(ax,p[ax])}</tspan>`+
          `<tspan x="12" dy="16" fill="#8c93a0" font-size="11">${fInt(p.minutes_played_overall)} min</tspan>`;
        const bb=ttx.getBBox?ttx.getBBox():{width:180,height:92};
        let tx=+c.getAttribute("cx")+16, ty=+c.getAttribute("cy")-22;
        if(tx+bb.width+24>W) tx=+c.getAttribute("cx")-bb.width-24;
        if(ty<10) ty=12;
        tip.setAttribute("transform",`translate(${tx},${ty})`);
        tbg.setAttribute("x",0); tbg.setAttribute("y",-12);
        tbg.setAttribute("width",bb.width+24); tbg.setAttribute("height",bb.height+22);
        tip.style.display="block";
      });
      c.addEventListener("mouseleave",()=>tip.style.display="none");
      c.addEventListener("click",()=>{
        const p=valid[+c.dataset.i];
        selId = selId===p.player_id ? null : p.player_id;
        openId = selId;
        renderTable();
        drawScatter();
        const tr=$(`#pt tbody tr[data-id="${selId}"]`);
        if(tr) tr.scrollIntoView({block:"center",behavior:"smooth"});
      });
    });
  }

  /* ---------- positional averages (for drawer radar) ---------- */
  function computeAverages(){
    avgByPos = {};
    const buckets={};
    rows.forEach(p=>{ const b=posBucket(p.position); (buckets[b]=buckets[b]||[]).push(p); });
    const KEYS=["goals_per_90","xg_per_90","shots_per_90","key_passes_per_90","tackles_per_90","dribbles_per_90"];
    Object.entries(buckets).forEach(([b,arr])=>{
      const avg={};
      KEYS.forEach(k=>{ avg[k]=arr.reduce((a,p)=>a+(Number(p[k])||0),0)/arr.length; });
      avgByPos[b]=avg;
    });
  }

  /* ---------- table ---------- */
  function renderTable(){
    const cols=activeCols();
    $("#pt thead").innerHTML = `<tr>${cols.map(c=>{
      const k=c[0], lbl=c[1], cls=c[2]==="num"?"num":"";
      if(k==="rank") return `<th class="num" style="width:48px">#</th>`;
      const sortable = k!=="rank";
      return `<th class="${cls} ${k===sortK?"sortk":""}" ${sortable?`data-k="${k}" data-t="${c[2]}"`:""}>${esc(lbl)}</th>`;
    }).join("")}</tr>`;

    const tbody=$("#pt tbody");
    if(!rows.length){
      tbody.innerHTML=`<tr><td colspan="${cols.length}" class="muted" style="text-align:center;padding:34px">No players match — try lowering the minimum minutes or widening the filters.</td></tr>`;
      $("#ptfoot").innerHTML=""; return;
    }
    const radarKeys=["goals_per_90","xg_per_90","shots_per_90","key_passes_per_90","tackles_per_90","dribbles_per_90"];
    const radarLabs=["G/90","xG/90","Sh/90","KP/90","Tk/90","Drb/90"];

    tbody.innerHTML = rows.map((p,i)=>{
      const sel=p.player_id===selId, open=p.player_id===openId, tag=posBucket(p.position);
      const cells = cols.map(c=>{
        const k=c[0], cls=c[2]==="num"?"num":"", fn=c[3];
        if(k==="rank") return `<td class="num rankcell ${i<3?"top":""}">${i+1}</td>`;
        if(k==="full_name") return `<td class="name" style="font-weight:700">${esc(p.full_name)}</td>`;
        if(k==="nationality") return `<td><span class="flgcell">${flagFor(p.nationality)} ${esc(p.nationality)}</span></td>`;
        if(k==="position") return `<td><span class="pos-badge pos-${(p.position||"").substring(0,2).toUpperCase()}">${tag}</span></td>`;
        if(k==="current_club") return `<td>${esc(p.current_club||"—")}</td>`;
        const v = fn ? fn(p[k]) : fmtMetric(k,p[k]);
        return `<td class="${cls} ${k===sortK?"colk":""}">${v}</td>`;
      }).join("");

      let drawer="";
      if(open){
        const av = avgByPos[tag] || {};
        const norm = (vals)=>radarKeys.map(k=>{
          const mx=Math.max(...rows.map(r=>Number(r[k])||0),0.0001);
          return (Number(vals[k])||0)/mx;
        });
        drawer = `<tr class="pdrawer" data-drawer="${p.player_id}"><td colspan="${cols.length}">
          <div class="pdrawer-inner">
            <div class="radar-wrap" style="padding:0">${radarChart(norm(p), norm(av), radarLabs, 200)}</div>
            <div>
              <div class="pdrawer-meta"><b>${esc(p.full_name)}</b> · ${flagFor(p.nationality)} ${esc(p.nationality)} · ${esc(p.position||"")} · ${esc(p.current_club||"")}</div>
              <div class="pdrawer-meta" style="margin-top:6px">${fInt(p.minutes_played_overall)} min · ${fInt(p.goals_overall)} G · ${fInt(p.assists_overall)} A · ${f2(p.xg_per_90)} xG/90</div>
              <div class="radar-legend" style="justify-content:flex-start;margin-top:8px">
                <span><i style="background:var(--lime)"></i>${esc(p.full_name)}</span>
                <span><i style="background:#fff"></i>${esc(tag)} average</span>
              </div>
              <div class="pdrawer-actions">
                <a class="btn lime sm" href="#/country/${codeFor(p.nationality)||""}">View country page →</a>
              </div>
            </div>
          </div></td></tr>`;
      }
      return `<tr class="${sel?"selrow":""}" data-id="${esc(p.player_id)}" style="cursor:pointer">${cells}</tr>${drawer}`;
    }).join("");

    $("#ptfoot").innerHTML = `<span><b>${rows.length}</b> players · sorted by ${esc(MLABEL[sortK]||sortK)}</span>
      <span class="hint">Click a row to expand · click again to collapse</span>`;

    tbody.querySelectorAll("tr[data-id]").forEach(tr=>tr.addEventListener("click",e=>{
      if(e.target.closest("a")) return;
      const id=tr.dataset.id;
      openId = openId===id ? null : id;
      selId = openId;
      renderTable(); drawScatter();
    }));
    // header click → re-sort (server-side for known sortable columns)
    $("#pt thead").querySelectorAll("th[data-k]").forEach(th=>th.addEventListener("click",()=>{
      const k=th.dataset.k;
      if(MLABEL[k]){ // server-sortable metric
        if(sortK===k) sortDir = sortDir==="desc"?"asc":"desc";
        else { sortK=k; sortDir="desc"; }
        $("#psort").value = MLABEL[k] ? k : $("#psort").value;
        load();
      } else { // string column → client sort the current page
        rows.sort((a,b)=>cmp(a[k],b[k]) * (sortK===k && sortDir==="asc"?1:-1));
        sortDir = (sortK===k && sortDir!=="asc") ? "asc":"desc"; sortK=k; renderTable();
      }
    }));
  }

  /* ---------- podium ---------- */
  function renderPodium(){
    const sec=$("#p-podium");
    const top3 = rows.slice(0,3);
    if(!top3.length){ sec.innerHTML=""; return; }
    const order=["p2","p1","p3"], medals=["🥈","🥇","🥉"], idx=[1,0,2];
    sec.innerHTML = `<div class="podium-deck">
      ${idx.map((ri,slot)=>{
        const p=top3[ri]; if(!p) return "";
        return `<div class="podium-card ${order[slot]}">
          <div class="medal">${medals[slot]}</div>
          <div class="pflag">${flagFor(p.nationality)}</div>
          <div class="pname">${esc(p.full_name)}</div>
          <div class="pgroup">${esc(p.nationality)} · ${esc(p.position||"")}</div>
          <span class="pval">${fmtMetric(sortK,p[sortK])}</span>
          <span class="plabel">${esc(MLABEL[sortK])}</span>
          <div class="prec"><b>${fInt(p.minutes_played_overall)}</b> min · <b>${fInt(p.goals_overall)}</b>G <b>${fInt(p.assists_overall)}</b>A</div>
        </div>`;
      }).join("")}
    </div>`;
  }

  /* ---------- load (server-side filter/sort) ---------- */
  function setLoading(){
    $("#scatter").innerHTML = skeletonRows(4);
    $("#pt tbody").innerHTML = `<tr><td colspan="12">${skeletonRows(6)}</td></tr>`;
    $("#p-podium").innerHTML = skeletonCards(3);
  }
  function load(){
    setLoading();
    $("#chart-title").textContent = `${MLABEL[ay]} vs ${MLABEL[ax]}`;
    const params = { scope, sort:sortK, order:sortDir, min_minutes:minMin, limit };
    if(nat) params.nationality = nat;
    fetchPlayers(params)
      .then(data=>{
        // client-side search + position narrowing (the API doesn't take a free-text/position filter)
        rows = (data||[]).filter(p=>{
          if(pos && posBucket(p.position)!==posBucket(pos)) return false;
          if(q){
            const hay=((p.full_name||"")+" "+(p.nationality||"")+" "+(p.current_club||"")).toLowerCase();
            if(!hay.includes(q.toLowerCase())) return false;
          }
          return true;
        });
        computeAverages();
        $("#ptotal").textContent = `${rows.length} players`;
        renderPodium(); drawScatter(); renderTable();
      })
      .catch(()=>{
        fetchError($("#scatter"), load);
        $("#pt tbody").innerHTML=""; fetchError($("#ptfoot"), load);
        $("#p-podium").innerHTML="";
      });
  }

  /* ---------- wiring ---------- */
  let searchTimer=null;
  // search is purely client-side; load() re-runs against the cached API payload (same URL → cache hit)
  $("#psearch").addEventListener("input",e=>{ q=e.target.value; clearTimeout(searchTimer);
    searchTimer=setTimeout(load, 180); });
  $("#ppos").addEventListener("change",e=>{ pos=e.target.value; load(); });
  $("#pnat").addEventListener("change",e=>{ nat=e.target.value; selId=openId=null; load(); });
  $("#pmin").addEventListener("input",e=>{ minMin=+e.target.value; $("#mmval").textContent=minMin; });
  $("#pmin").addEventListener("change",()=>load());
  $("#psort").addEventListener("change",e=>{ sortK=e.target.value; load(); });
  $("#porder").addEventListener("change",e=>{ sortDir=e.target.value; load(); });
  $("#plimit").addEventListener("change",e=>{ limit=+e.target.value; load(); });
  $("#ay").addEventListener("change",e=>{ ay=e.target.value; $("#chart-title").textContent=`${MLABEL[ay]} vs ${MLABEL[ax]}`; drawScatter(); });
  $("#ax").addEventListener("change",e=>{ ax=e.target.value; $("#chart-title").textContent=`${MLABEL[ay]} vs ${MLABEL[ax]}`; drawScatter(); });
  $("#p-colgroups").querySelectorAll("[data-cg]").forEach(b=>b.addEventListener("click",()=>{
    const g=b.dataset.cg; colGroups[g]=!colGroups[g]; b.classList.toggle("on",colGroups[g]); renderTable();
  }));

  load();
}
function openSheet(innerHTML, onApply, onWire){
  // remove any stale sheet first
  document.querySelectorAll(".m-sheet,.m-sheet-scrim").forEach(n=>n.remove());
  const scrim=document.createElement("div"); scrim.className="m-sheet-scrim";
  const sheet=document.createElement("div"); sheet.className="m-sheet";
  sheet.innerHTML=`<div class="grab"></div>${innerHTML}
    <div class="m-sheet-foot">
      <button class="btn" data-sheet="reset">Reset</button>
      <button class="btn lime" data-sheet="apply">Show results</button>
    </div>`;
  document.body.appendChild(scrim); document.body.appendChild(sheet);
  document.body.style.overflow="hidden";
  requestAnimationFrame(()=>{ scrim.classList.add("show"); sheet.classList.add("show"); });
  const close=()=>{
    scrim.classList.remove("show"); sheet.classList.remove("show");
    document.body.style.overflow="";
    setTimeout(()=>{ scrim.remove(); sheet.remove(); },280);
  };
  scrim.addEventListener("click",close);
  sheet.querySelector('[data-sheet="apply"]').addEventListener("click",()=>{ onApply&&onApply(sheet,false); close(); });
  sheet.querySelector('[data-sheet="reset"]').addEventListener("click",()=>{ onApply&&onApply(sheet,true); close(); });
  onWire&&onWire(sheet);
  return {close};
}

/* ---------- PLAYERS (mobile, live API) ---------- */
function playersMobile(){
  const hashParams = new URLSearchParams((location.hash.split("?")[1]||""));
  const preNat = hashParams.get("nat") || "";

  // focus metrics surfaced as quick chips; "Goalkeeping" added per spec
  const FOCUS = [
    ["goals_involved_per_90","G+A/90"],["goals_per_90","Goals/90"],["assists_per_90","Assists/90"],
    ["xg_per_90","xG/90"],["xa_per_90","xA/90"],["shots_per_90","Shots/90"],
    ["key_passes_per_90","Key P/90"],["chances_created_per_90","Chances/90"],["dribbles_per_90","Dribbles/90"],
    ["tackles_per_90","Tackles/90"],["interceptions_per_90","Intercept/90"],
    ["saves_per_90","Saves/90"],["conceded_per_90","Conceded/90"],
    ["goals_overall","Goals"],["minutes_played_overall","Minutes"],
  ];
  const lowerBetter = new Set(["conceded_per_90"]);

  let scope="TOTAL", q="", pos="", nat=preNat, minMin=270;
  let focus="goals_involved_per_90", dir="desc", limit=15, openId=null, selId=null;
  let rows=[];

  app.innerHTML = `
    <div class="mdash">
      <div class="m-hero">
        <div class="kicker">Player Analytics</div>
        <h1>Player Stats</h1>
        <p class="m-sub">Per-90 metrics so everyone’s compared on equal footing. Pick a stat to rank by, tap a card for the breakdown.</p>
        <span class="m-count" id="m-count"></span>
      </div>

      <div id="m-scope" class="scope-rail mobile-only"></div>

      <div class="m-focuswrap">
        <div class="m-focus-label">Ranking by <b id="m-focus-name"></b></div>
        <div class="m-rail" id="m-rail">
          ${FOCUS.map(([k,l])=>`<button class="m-chip${k===focus?" on":""}" data-focus="${k}">${l}</button>`).join("")}
        </div>
      </div>

      <div class="m-toolbar">
        <button class="m-sortbtn" id="m-sort"><span id="m-sort-lbl"></span> <span class="dir" id="m-dir"></span></button>
        <button class="m-filterbtn" id="m-filter">Filters <span id="m-fbadge"></span></button>
      </div>

      <div class="m-list" id="m-list">${skeletonRows(6)}</div>
      <div class="m-showmore" id="m-more"></div>
    </div>`;

  $("#m-scope").appendChild(scopeSwitcher(scope,(val)=>{ scope=val; load(); }));

  const posTag = p => (p.position||"").substring(0,2).toUpperCase()||"—";
  const activeFilters = ()=> (q?1:0)+(pos?1:0)+(nat?1:0)+(minMin!==270?1:0);

  const draw = ()=>{
    const sorted = rows.slice(); // already sorted server-side by `focus`; respect local dir toggle
    if(dir==="asc") sorted.reverse();
    const view = sorted.slice(0,limit);
    const maxAbs = Math.max(0.0001, ...sorted.map(r=>Math.abs(Number(r[focus])||0)));
    const lower = lowerBetter.has(focus);

    $("#m-count").textContent = `${rows.length} player${rows.length===1?"":"s"} shown`;
    $("#m-focus-name").textContent = MLABEL[focus]||focus;
    $("#m-sort-lbl").textContent = MLABEL[focus]||focus;
    $("#m-dir").textContent = dir==="desc" ? "▼ high→low" : "▲ low→high";
    const filt=activeFilters();
    $("#m-filter").classList.toggle("has-active", filt>0);
    $("#m-fbadge").innerHTML = filt>0 ? `<span class="dotbadge"></span>` : "";

    const list=$("#m-list");
    if(!view.length){ list.innerHTML=`<div class="m-empty">No players match — try lowering the minimum minutes.</div>`; $("#m-more").innerHTML=""; return; }

    list.innerHTML = view.map((p,i)=>{
      const tag=posTag(p), val=p[focus];
      const pct=Math.min(100,Math.max(4,(Math.abs(Number(val)||0)/maxAbs)*100));
      const open=p.player_id===openId, sel=p.player_id===selId;
      const sg=(k,lbl)=>`<div class="sg ${k===focus?"hl":""}"><div class="k">${lbl}</div><div class="v">${fmtMetric(k,p[k])}</div></div>`;
      return `<div class="m-card${open?" open":""}${sel?" sel":""}" data-id="${esc(p.player_id)}">
        <div class="m-row" data-toggle="${esc(p.player_id)}">
          <div class="m-rank ${i<3?"top":""}">${i+1}</div>
          <div class="m-flag">${flagFor(p.nationality)}</div>
          <div class="m-id">
            <div class="m-name">${esc(p.full_name)}</div>
            <div class="m-meta"><span class="pos-badge pos-${tag}">${tag}</span>
              <span>${esc(p.nationality)}</span><span class="dot-sep">·</span><span>${fInt(p.minutes_played_overall)} min</span></div>
          </div>
          <div class="m-statend">
            <div class="m-bigval${lower?" lower":""}">${fmtMetric(focus,val)}</div>
            <div class="m-statlbl">${MLABEL[focus]||focus}</div>
          </div>
          <div class="m-chev">▶</div>
        </div>
        <div class="m-barrow"><div class="m-bar"><i class="${lower?"lower":""}" style="width:${pct}%"></i></div></div>
        <div class="m-detail">
          <div class="m-statgrid">
            ${sg("goals_overall","Goals")}${sg("assists_overall","Assists")}${sg("xg_per_90","xG/90")}
            ${sg("xa_per_90","xA/90")}${sg("shots_per_90","Sh/90")}${sg("shot_accuracy","ShAcc")}
            ${sg("key_passes_per_90","KeyP/90")}${sg("dribbles_per_90","Drb/90")}${sg("tackles_per_90","Tk/90")}
            ${sg("interceptions_per_90","Int/90")}${sg("pass_completion_rate","Pass%")}${sg("appearances_overall","Apps")}
          </div>
          <div class="m-detail-actions">
            <button class="btn lime sm" data-select="${esc(p.player_id)}">${sel?"Clear":"Highlight"}</button>
            <a class="btn sm" href="#/country/${codeFor(p.nationality)||""}">Country →</a>
          </div>
        </div>
      </div>`;
    }).join("");

    list.querySelectorAll("[data-toggle]").forEach(row=>row.addEventListener("click",()=>{
      const id=row.dataset.toggle; openId = openId===id?null:id; draw();
    }));
    list.querySelectorAll("[data-select]").forEach(b=>b.addEventListener("click",e=>{
      e.stopPropagation(); const id=b.dataset.select; selId = selId===id?null:id; draw();
    }));

    const more=$("#m-more");
    if(sorted.length>limit){
      more.innerHTML=`<button class="btn" id="m-morebtn">Show more · ${limit} of ${sorted.length}</button>`;
      $("#m-morebtn").addEventListener("click",()=>{limit+=15;draw();});
    } else if(sorted.length>15){
      more.innerHTML=`<button class="btn" id="m-lessbtn">Show fewer</button>`;
      $("#m-lessbtn").addEventListener("click",()=>{limit=15;draw();window.scrollTo({top:0,behavior:"smooth"});});
    } else { more.innerHTML=""; }
  };

  function load(){
    $("#m-list").innerHTML = skeletonRows(6);
    const params = { scope, sort:focus, order:"desc", min_minutes:minMin, limit:200 };
    if(nat) params.nationality = nat;
    fetchPlayers(params)
      .then(data=>{
        rows = (data||[]).filter(p=>{
          if(pos && posBucket(p.position)!==posBucket(pos)) return false;
          if(q){
            const hay=((p.full_name||"")+" "+(p.nationality||"")).toLowerCase();
            if(!hay.includes(q.toLowerCase())) return false;
          }
          return true;
        });
        draw();
      })
      .catch(()=>{ const l=$("#m-list"); fetchError(l, load); });
  }

  $("#m-rail").querySelectorAll(".m-chip").forEach(ch=>ch.addEventListener("click",()=>{
    focus=ch.dataset.focus; dir="desc"; limit=15;
    $("#m-rail").querySelectorAll(".m-chip").forEach(c=>c.classList.toggle("on",c===ch));
    ch.scrollIntoView({inline:"center",block:"nearest",behavior:"smooth"});
    load(); // refetch sorted by the new focus metric server-side
  }));
  $("#m-sort").addEventListener("click",()=>{dir=dir==="desc"?"asc":"desc";draw();});

  $("#m-filter").addEventListener("click",()=>{
    const posOpts=["","Goalkeeper","Defender","Midfielder","Forward"];
    const posLbls=["All","GK","DEF","MID","FWD"];
    const natList = teamsArr().slice().sort((a,b)=>a.name.localeCompare(b.name));
    openSheet(`
      <h3>Filter players</h3>
      <div class="m-field"><label>Search player or nation</label>
        <input type="text" id="sf-q" placeholder="e.g. Mbappé, Brazil…" value="${esc(q)}"></div>
      <div class="m-field"><label>Position</label>
        <div class="m-segwrap" id="sf-pos">
          ${posOpts.map((v,i)=>`<button class="m-seg${v===pos?" on":""}" data-v="${v}">${posLbls[i]}</button>`).join("")}
        </div></div>
      <div class="m-field"><label>Nationality</label>
        <select id="sf-nat"><option value="">All nations</option>
          ${natList.map(t=>`<option value="${esc(t.name)}"${t.name===nat?" selected":""}>${esc(t.name)}</option>`).join("")}
        </select></div>
      <div class="m-field"><label>Minimum minutes played: <b id="sf-mmval">${minMin}</b></label>
        <input type="range" id="sf-min" min="0" max="900" step="90" value="${minMin}"></div>`,
      (sheet,reset)=>{
        if(reset){ q="";pos="";nat="";minMin=270; }
        else {
          q=(sheet.querySelector("#sf-q").value||"").toLowerCase().trim();
          pos=sheet.querySelector("#sf-pos .m-seg.on")?.dataset.v||"";
          nat=sheet.querySelector("#sf-nat").value||"";
          minMin=+sheet.querySelector("#sf-min").value;
        }
        limit=15; openId=null; load();
      },
      (sheet)=>{
        sheet.querySelectorAll("#sf-pos .m-seg").forEach(b=>b.addEventListener("click",()=>{
          sheet.querySelectorAll("#sf-pos .m-seg").forEach(x=>x.classList.toggle("on",x===b));
        }));
        const rng=sheet.querySelector("#sf-min"), out=sheet.querySelector("#sf-mmval");
        rng.addEventListener("input",()=>out.textContent=rng.value);
      });
  });

  load();
}
/* ---------- TEAM STATS (rebuilt: live Team Statistics Hub) ---------- */
const CONF_COLOR = {
  UEFA:"var(--conf-UEFA)", CONMEBOL:"var(--conf-CONMEBOL)", CONCACAF:"var(--conf-CONCACAF)",
  CAF:"var(--conf-CAF)", AFC:"var(--conf-AFC)", OFC:"var(--conf-OFC)",
};
// metric options for the scatter axis pickers
const TEAM_METRICS = [
  ["xg_per_90","xG / 90"],["goals_per_90","Goals / 90"],["shots_per_90","Shots / 90"],
  ["avg_possession","Possession %"],["points_per_game","Points / Game"],["win_pct","Win %"],
  ["xg_against_per_90","xGA / 90"],["goals_against_per_90","Goals Against / 90"],
  ["clean_sheet_pct","Clean Sheet %"],["shot_accuracy","Shot Accuracy %"],["conversion_rate","Conversion %"],
  ["xg_overperformance","xG Overperformance"],
];
const TMLABEL = Object.fromEntries(TEAM_METRICS);
const TEAM_PCT = new Set(["win_pct","clean_sheet_pct","shot_accuracy","conversion_rate"]);
function fmtTeamMetric(key,v){
  if(v==null) return "–";
  if(TEAM_PCT.has(key)) return fPct(v);
  if(key==="avg_possession") return fPctRaw(v);
  return f2(v);
}

function stats(){
  injectGlobalDashboardStyles();
  if(isMobile()){ return statsMobile(); }

  let scope="TOTAL";
  let teams=[];                 // live /api/teams payload (decorated with code/flag/conf)
  let sortK="points", sortDir="desc";
  let ax="xg_per_90", ay="xg_against_per_90";
  let selName=null;
  const _formCache = new Map(); // team → matches (for lazy form strips)
  let formObserver=null;

  app.innerHTML = `
    <div class="dashboard-wrapper">
      <div class="dash-lead">
        <div class="lead-copy">
          <div class="kicker">Team Statistics</div>
          <div class="sec-h"><h1>Team Stats</h1><span class="pill" id="t-total"></span></div>
          <p>Tournament-wide performance for every qualified nation. Choose a scope and explore the rankings, comparison plot and full table together.</p>
        </div>
      </div>

      <div id="t-scope"></div>

      <section class="hero-rankrow" id="t-heroes">${skeletonCards(4)}</section>

      <div class="chart-card">
        <div class="chart-head">
          <h3 id="t-chart-title"></h3>
          <div class="axis-picks">
            <div class="axis-pick y"><span class="ax-tag">Y ↑</span>
              <select id="tay">${TEAM_METRICS.map(([k,l])=>`<option value="${k}"${k===ay?" selected":""}>${l}</option>`).join("")}</select></div>
            <div class="axis-pick"><span class="ax-tag">X →</span>
              <select id="tax">${TEAM_METRICS.map(([k,l])=>`<option value="${k}"${k===ax?" selected":""}>${l}</option>`).join("")}</select></div>
          </div>
        </div>
        <div class="chart-stage"><div id="team-scatter">${skeletonRows(4)}</div></div>
        <div class="chart-foot">
          <span class="conf-legend">
            <span><i style="background:var(--conf-UEFA)"></i>UEFA</span>
            <span><i style="background:var(--conf-CONMEBOL)"></i>CONMEBOL</span>
            <span><i style="background:var(--conf-CONCACAF)"></i>CONCACAF</span>
            <span><i style="background:var(--conf-CAF)"></i>CAF</span>
            <span><i style="background:var(--conf-AFC)"></i>AFC</span>
            <span><i style="background:var(--conf-OFC)"></i>OFC</span>
          </span>
          <span class="hint">click a dot → country page · dashed lines = median</span>
        </div>
      </div>

      <div class="card" style="overflow:hidden;padding:0">
        <div class="tbl-wrap"><table class="dt adv" id="tt"><thead></thead><tbody></tbody></table></div>
        <div class="table-foot"><span id="ttnote"></span><span class="hint">Click a column header to sort</span></div>
      </div>

      <div class="barpair">
        <div class="chart-card barchart" id="bc-goals"><div class="bc-title">Top 10 · Goals / 90</div><div data-body>${skeletonRows(5)}</div></div>
        <div class="chart-card barchart" id="bc-xgop"><div class="bc-title">Top 10 · xG Overperformance</div><div data-body>${skeletonRows(5)}</div></div>
      </div>
    </div>`;

  $("#t-scope").appendChild(scopeSwitcher(scope,(val)=>{ scope=val; load(); }));

  /* ---- hero "best in class" cards ---- */
  function renderHeroes(){
    const sec=$("#t-heroes");
    if(!teams.length){ sec.innerHTML=`<div class="empty">No team data in this scope.</div>`; return; }
    const best=(key,dir=-1,fmt=fInt,sub="")=>{
      const sorted=[...teams].sort((a,b)=>cmp(a[key],b[key])*dir);
      return {t:sorted[0], v:sorted[0]?fmt(sorted[0][key]):"–", sub};
    };
    const cards=[
      ["Most Goals Scored", best("goals_for",-1,fInt), t=>`${fInt(t.goals_for)} in ${fInt(t.matches_played)} games`],
      ["Fewest Conceded", best("goals_against",1,fInt), t=>`${f1(t.goals_against_per_90)} / 90`],
      ["Best xG Performance", best("xg_overperformance",-1,f1), t=>`${f1(t.xg_for)} xG for`],
      ["Top Win %", best("win_pct",-1,fPct), t=>`${fInt(t.wins)}W of ${fInt(t.matches_played)}`],
    ];
    sec.innerHTML = cards.map(([lbl,b,subFn])=>{
      const t=b.t; if(!t) return "";
      return `<div class="rank-card">
        <div class="rc-lbl">${esc(lbl)}</div>
        <div class="rc-team"><span class="rc-flag">${t._flag}</span>
          <a class="rc-name" href="#/country/${t._code||""}">${esc(t.team)}</a></div>
        <span class="rc-val">${b.v}</span>
        <div class="rc-sub">${subFn(t)}</div>
      </div>`;
    }).join("");
  }

  /* ---- comparison scatter ---- */
  function drawScatter(){
    const stage=$("#team-scatter");
    const pts=teams.filter(r=>r[ax]!=null && r[ay]!=null);
    if(!pts.length){ stage.innerHTML=`<div class="empty">No data to plot.</div>`; return; }
    const W=860, H=470, pad={l:64,r:34,t:30,b:54};
    const xs=pts.map(r=>Number(r[ax])||0), ys=pts.map(r=>Number(r[ay])||0);
    const [xmin,xmax]=axisBounds(xs), [ymin,ymax]=axisBounds(ys);
    const sx=v=>pad.l+(v-xmin)/(xmax-xmin||1)*(W-pad.l-pad.r);
    const sy=v=>H-pad.b-(v-ymin)/(ymax-ymin||1)*(H-pad.t-pad.b);
    const med=a=>{if(!a.length)return 0;const s=[...a].sort((m,n)=>m-n);return s[Math.floor(s.length/2)];};
    const mx=med(xs), my=med(ys);
    const ticks=(lo,hi,n=5)=>Array.from({length:n+1},(_,i)=>lo+(hi-lo)*i/n);

    let dots="", labels="";
    pts.forEach((r,i)=>{
      const sel=r.team===selName, cx=sx(Number(r[ax])||0), cy=sy(Number(r[ay])||0), rad=sel?9:5.5;
      const col=sel?"var(--mag)":(CONF_COLOR[r._conf]||"var(--lime)");
      dots+=`<circle class="dot" data-i="${i}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad}"
        fill="${col}" fill-opacity="${sel?1:.82}" stroke="#080a0d" stroke-width="${sel?2.5:1.1}"/>`;
      const right=cx>W-70, tx=right?cx-8:cx+8, anc=right?"end":"start";
      labels+=`<text class="code conf" x="${tx.toFixed(1)}" y="${(cy+3).toFixed(1)}" text-anchor="${anc}"
        font-size="${sel?12:9.5}" fill="${sel?"var(--mag)":"#9aa7bd"}" fill-opacity="${sel?1:.85}">${esc(r._code||r.team)}</text>`;
    });
    const xlab=ticks(xmin,xmax).map(v=>`<text class="tick" x="${sx(v)}" y="${H-pad.b+18}" text-anchor="middle">${+v.toFixed(2)}</text>`).join("");
    const ylab=ticks(ymin,ymax).map(v=>`<text class="tick" x="${pad.l-9}" y="${sy(v)+4}" text-anchor="end">${+v.toFixed(2)}</text>`).join("");

    stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" id="ts_svg" role="img" aria-label="${esc(TMLABEL[ay])} versus ${esc(TMLABEL[ax])} team comparison">
      <line class="guide" x1="${pad.l}" y1="${sy(my)}" x2="${W-pad.r}" y2="${sy(my)}"/>
      <line class="guide" x1="${sx(mx)}" y1="${pad.t}" x2="${sx(mx)}" y2="${H-pad.b}"/>
      <text class="quad" x="${W-pad.r-4}" y="${pad.t+12}" text-anchor="end">High ${esc(TMLABEL[ay])} · High ${esc(TMLABEL[ax])}</text>
      <line class="axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H-pad.b}"/>
      <line class="axis" x1="${pad.l}" y1="${H-pad.b}" x2="${W-pad.r}" y2="${H-pad.b}"/>
      ${xlab}${ylab}
      <text class="axttl" x="${pad.l+(W-pad.l-pad.r)/2}" y="${H-10}" text-anchor="middle">${esc(TMLABEL[ax])} →</text>
      <text class="axttl" transform="rotate(-90 16 ${pad.t+(H-pad.t-pad.b)/2})" x="16" y="${pad.t+(H-pad.t-pad.b)/2}" text-anchor="middle">${esc(TMLABEL[ay])} →</text>
      ${dots}${labels}
      <g id="ttip" style="display:none"><rect rx="8" id="ttipbg" fill="#16202e" stroke="#2b394e" filter="drop-shadow(0px 6px 14px rgba(0,0,0,.6))"/><text id="ttiptx"></text></g>
    </svg>`;

    const svg=$("#ts_svg"), tip=$("#ttip",svg), tbg=$("#ttipbg",svg), ttx=$("#ttiptx",svg);
    svg.querySelectorAll(".dot").forEach(c=>{
      c.addEventListener("mousemove",()=>{
        const r=pts[+c.dataset.i];
        ttx.innerHTML=`<tspan x="12" dy="6" style="font-weight:800;fill:var(--lime);font-size:13px">${r._flag} ${esc(r.team)}</tspan>`+
          `<tspan x="12" dy="17" fill="#8c93a0" font-size="11">${esc(r._conf||"")} · ${fInt(r.wins)}W ${fInt(r.draws)}D ${fInt(r.losses)}L</tspan>`+
          `<tspan x="12" dy="18" fill="#fff" font-size="12">${esc(TMLABEL[ay])}: ${fmtTeamMetric(ay,r[ay])}</tspan>`+
          `<tspan x="12" dy="16" fill="#fff" font-size="12">${esc(TMLABEL[ax])}: ${fmtTeamMetric(ax,r[ax])}</tspan>`;
        const bb=ttx.getBBox?ttx.getBBox():{width:190,height:80};
        let tx=+c.getAttribute("cx")+16, ty=+c.getAttribute("cy")-22;
        if(tx+bb.width+24>W) tx=+c.getAttribute("cx")-bb.width-24;
        if(ty<10) ty=12;
        tip.setAttribute("transform",`translate(${tx},${ty})`);
        tbg.setAttribute("x",0); tbg.setAttribute("y",-12);
        tbg.setAttribute("width",bb.width+24); tbg.setAttribute("height",bb.height+22);
        tip.style.display="block";
      });
      c.addEventListener("mouseleave",()=>tip.style.display="none");
      c.addEventListener("click",()=>{ const r=pts[+c.dataset.i]; if(r._code) location.hash=`#/country/${r._code}`; });
    });
  }

  /* ---- league table (with lazy per-row form strips) ---- */
  const TT_COLS = [
    ["matches_played","MP",fInt],["wins","W",fInt],["draws","D",fInt],["losses","L",fInt],
    ["goals_for","GF",fInt],["goals_against","GA",fInt],["_gd","GD",fInt],["points","Pts",fInt],
    ["points_per_game","PPG",f2],["xg_for","xGF",f1],["xg_against","xGA",f1],
    ["xg_overperformance","xG±",f1],["clean_sheet_pct","Clean%",fPct],["shot_accuracy","ShAcc",fPct],
  ];
  function renderTable(){
    const thead=$("#tt thead"), tbody=$("#tt tbody");
    thead.innerHTML = `<tr>
      <th class="num" style="width:46px">#</th>
      <th data-k="team" data-t="s">Team</th>
      <th class="lt-form">Form</th>
      ${TT_COLS.map(([k,l])=>`<th class="num ${k===sortK?"sortk":""}" data-k="${k}" data-t="n">${esc(l)}</th>`).join("")}
    </tr>`;
    const sorted=[...teams].sort((a,b)=>cmp(a[sortK],b[sortK])*(sortDir==="asc"?1:-1));
    tbody.innerHTML = sorted.map((r,i)=>`
      <tr data-code="${r._code||""}" data-team="${esc(r.team)}">
        <td class="num"><span class="rankcell ${i<3?"top":""}">${i+1}</span></td>
        <td class="name"><span class="flgcell"><a href="#/country/${r._code||""}">${r._flag} ${esc(r.team)}</a></span></td>
        <td class="lt-form" data-form><span class="muted-mini">…</span></td>
        ${TT_COLS.map(([k,l,fn])=>`<td class="num ${k===sortK?"colk":""}">${fn(r[k])}</td>`).join("")}
      </tr>`).join("");

    $("#ttnote").innerHTML = `<b>${sorted.length}</b> teams · sorted by ${esc(TT_COLS.find(c=>c[0]===sortK)?.[1]||sortK)}`;
    // header sort
    thead.querySelectorAll("th[data-k]").forEach(th=>th.addEventListener("click",()=>{
      const k=th.dataset.k;
      if(sortK===k) sortDir = sortDir==="asc"?"desc":"asc";
      else { sortK=k; sortDir="desc"; }
      renderTable();
    }));

    // lazy form strips via IntersectionObserver
    if(formObserver) formObserver.disconnect();
    formObserver = new IntersectionObserver((entries)=>{
      entries.forEach(en=>{
        if(!en.isIntersecting) return;
        const tr=en.target, team=tr.dataset.team, cell=tr.querySelector("[data-form]");
        formObserver.unobserve(tr);
        const apply = (matches)=>{ cell.innerHTML = formStrip(matches.map(m=>({result:m.result}))); };
        if(_formCache.has(team)){ apply(_formCache.get(team)); return; }
        fetchMatches(team, scope, 5)
          .then(ms=>{ _formCache.set(team, ms); apply(ms); })
          .catch(()=>{ cell.innerHTML = `<span class="muted-mini">—</span>`; });
      });
    }, {root:null, rootMargin:"120px"});
    tbody.querySelectorAll("tr[data-team]").forEach(tr=>formObserver.observe(tr));
  }

  /* ---- bottom bar charts ---- */
  function bars(containerSel, key, signed){
    const body=$(`${containerSel} [data-body]`);
    const arr=[...teams].sort((a,b)=>(Number(b[key])||0)-(Number(a[key])||0)).slice(0,10);
    if(!arr.length){ body.innerHTML=`<div class="empty">No data.</div>`; return; }
    const mxAbs=Math.max(0.001,...arr.map(t=>Math.abs(Number(t[key])||0)));
    body.innerHTML = arr.map((t,i)=>{
      const v=Number(t[key])||0, pct=Math.min(100,Math.max(3,(Math.abs(v)/mxAbs)*100));
      const color = signed ? (v>=0?"linear-gradient(90deg,var(--lime),#9fd400)":"linear-gradient(90deg,#ff2d87,#b51e60)")
                           : "linear-gradient(90deg,var(--lime),#9fd400)";
      return `<div class="bc-row">
        <span class="bc-rank">${i+1}</span>
        <span class="bc-name">${t._flag} ${esc(t._code||t.team)}</span>
        <span class="bc-track"><span class="bc-fill" style="width:${pct}%;background:${color}"></span></span>
        <span class="bc-val">${signed?f1(v):f2(v)}</span>
      </div>`;
    }).join("");
  }

  /* ---- decorate API rows with local code/flag/conf + derived GD ---- */
  function decorate(rowsIn){
    return (rowsIn||[]).map(r=>{
      const lt=teamByName(r.team);
      return Object.assign({}, r, {
        _code: lt?.code || null,
        _flag: lt?.flag || "🏳️",
        _conf: lt?.conf || null,
        _gd: (Number(r.goals_for)||0) - (Number(r.goals_against)||0),
      });
    });
  }

  function load(){
    $("#t-heroes").innerHTML = skeletonCards(4);
    $("#team-scatter").innerHTML = skeletonRows(4);
    $("#tt tbody").innerHTML = `<tr><td colspan="17">${skeletonRows(6)}</td></tr>`;
    $("#bc-goals [data-body]").innerHTML = skeletonRows(5);
    $("#bc-xgop [data-body]").innerHTML = skeletonRows(5);
    _formCache.clear();
    $("#t-chart-title").textContent = `${TMLABEL[ay]} vs ${TMLABEL[ax]}`;

    fetchTeams(scope)
      .then(data=>{
        teams = decorate(data);
        $("#t-total").textContent = `${teams.length} teams`;
        renderHeroes(); drawScatter(); renderTable();
        bars("#bc-goals","goals_per_90",false);
        bars("#bc-xgop","xg_overperformance",true);
      })
      .catch(()=>{
        fetchError($("#t-heroes"), load);
        $("#team-scatter").innerHTML=""; fetchError($("#team-scatter"), load);
        $("#tt tbody").innerHTML="";
      });
  }

  $("#tax").addEventListener("change",e=>{ ax=e.target.value; $("#t-chart-title").textContent=`${TMLABEL[ay]} vs ${TMLABEL[ax]}`; drawScatter(); });
  $("#tay").addEventListener("change",e=>{ ay=e.target.value; $("#t-chart-title").textContent=`${TMLABEL[ay]} vs ${TMLABEL[ax]}`; drawScatter(); });

  load();
}
/* ---------- TEAM STATS (mobile, live API) ---------- */
function statsMobile(){
  const metrics = [
    ["points_per_game","PPG","desc",f2],["goals_per_90","Goals/90","desc",f2],
    ["xg_overperformance","xG±","desc",f1],["win_pct","Win %","desc",fPct],
    ["xg_per_90","xG/90","desc",f2],["clean_sheet_pct","Clean Sheets","desc",fPct],
    ["avg_possession","Possession","desc",fPctRaw],["goals_against_per_90","Conceded/90","asc",f2],
    ["shot_accuracy","Shot Acc","desc",fPct],
  ];
  const metaDir = Object.fromEntries(metrics.map(([k,,d])=>[k,d]));
  const metaLab = Object.fromEntries(metrics.map(([k,l])=>[k,l]));
  const metaFmt = Object.fromEntries(metrics.map(([k,,,f])=>[k,f]));

  let scope="TOTAL", focus="points_per_game", dir="desc", openCode=null, selCode=null, limit=16, q="";
  let teams=[];

  app.innerHTML = `
    <div class="mdash">
      <div class="m-hero">
        <div class="kicker">Team Statistics</div>
        <h1>Team Stats</h1>
        <p class="m-sub">Tournament performance for every nation. Pick a metric to rank by.</p>
        <span class="m-count" id="ms-count"></span>
      </div>

      <div id="ms-scope" class="scope-rail mobile-only"></div>

      <div class="m-focuswrap">
        <div class="m-focus-label">Ranking by <b id="ms-focus-name"></b></div>
        <div class="m-rail" id="ms-rail">
          ${metrics.map(([k,l])=>`<button class="m-chip${k===focus?" on":""}" data-focus="${k}">${l}</button>`).join("")}
        </div>
      </div>

      <div class="m-podium" id="ms-podium"></div>

      <div class="m-toolbar">
        <button class="m-sortbtn" id="ms-sort"><span id="ms-sort-lbl"></span> <span class="dir" id="ms-dir"></span></button>
        <button class="m-filterbtn" id="ms-filter">Filters <span id="ms-fbadge"></span></button>
      </div>

      <div class="m-list" id="ms-list">${skeletonRows(6)}</div>
      <div class="m-showmore" id="ms-more"></div>
    </div>`;

  $("#ms-scope").appendChild(scopeSwitcher(scope,(val)=>{ scope=val; load(); }));

  const val = (r,k)=> Number(r[k])||0;
  const fmtF = (k,v)=> (metaFmt[k]||f2)(v);
  const filtered = ()=> teams.filter(r=> !q || (r.team||"").toLowerCase().includes(q) || (r._code||"").toLowerCase().includes(q));
  const activeFilters = ()=> (q?1:0);

  const draw = ()=>{
    const all = filtered().sort((a,b)=>cmp(a[focus],b[focus])*(dir==="asc"?1:-1));
    const lower = metaDir[focus]==="asc";
    const higherBetter = !lower;
    const best = [...filtered()].sort((a,b)=>cmp(a[focus],b[focus])*(higherBetter?-1:1)).slice(0,3);
    const maxAbs = Math.max(0.0001, ...filtered().map(r=>Math.abs(val(r,focus))));

    $("#ms-count").textContent = `${all.length} team${all.length===1?"":"s"}`;
    $("#ms-focus-name").textContent = metaLab[focus];
    $("#ms-sort-lbl").textContent = metaLab[focus];
    $("#ms-dir").textContent = dir==="desc" ? "▼ high→low" : "▲ low→high";
    const filt=activeFilters();
    $("#ms-filter").classList.toggle("has-active", filt>0);
    $("#ms-fbadge").innerHTML = filt>0 ? `<span class="dotbadge"></span>` : "";

    const gcls=["g1","g2","g3"];
    $("#ms-podium").innerHTML = best.map((t,i)=>`
      <div class="pod ${gcls[i]}" data-code="${t._code||""}">
        <div class="rk">#${i+1}</div>
        <div class="fl">${t._flag}</div>
        <div class="nm">${esc(t._code||t.team)}</div>
        <div class="vl">${fmtF(focus,t[focus])}</div>
      </div>`).join("");
    $("#ms-podium").querySelectorAll(".pod").forEach(el=>el.addEventListener("click",()=>{
      const code=el.dataset.code; openCode=code; selCode=code; draw();
      const c2=$(`#ms-list .m-card[data-code="${code}"]`);
      if(c2) c2.scrollIntoView({block:"center",behavior:"smooth"});
    }));

    const view=all.slice(0,limit);
    const list=$("#ms-list");
    if(!view.length){ list.innerHTML=`<div class="m-empty">No teams match that search.</div>`; $("#ms-more").innerHTML=""; return; }

    const sg=(r,k,lbl,fn)=>`<div class="sg ${k===focus?"hl":""}"><div class="k">${lbl}</div><div class="v">${(fn||f2)(r[k])}</div></div>`;
    list.innerHTML = view.map((r,i)=>{
      const pct=Math.min(100,Math.max(4,(Math.abs(val(r,focus))/maxAbs)*100));
      const open=r._code===openCode, sel=r._code===selCode;
      return `<div class="m-card${open?" open":""}${sel?" sel":""}" data-code="${r._code||""}">
        <div class="m-row" data-toggle="${r._code||""}">
          <div class="m-rank ${i<3?"top":""}">${i+1}</div>
          <div class="m-flag">${r._flag}</div>
          <div class="m-id">
            <div class="m-name">${esc(r.team)}</div>
            <div class="m-meta"><span>${esc(r._conf||"")}</span><span class="dot-sep">·</span>
              <span><b style="color:var(--txt)">${fInt(r.wins)}</b>W ${fInt(r.draws)}D ${fInt(r.losses)}L</span></div>
          </div>
          <div class="m-statend">
            <div class="m-bigval${lower?" lower":""}">${fmtF(focus,r[focus])}</div>
            <div class="m-statlbl">${metaLab[focus]}</div>
          </div>
          <div class="m-chev">▶</div>
        </div>
        <div class="m-barrow"><div class="m-bar"><i class="${lower?"lower":""}" style="width:${pct}%"></i></div></div>
        <div class="m-detail">
          <div class="m-statgrid">
            ${sg(r,"matches_played","Played",fInt)}${sg(r,"points","Points",fInt)}${sg(r,"points_per_game","PPG",f2)}
            ${sg(r,"goals_for","GF",fInt)}${sg(r,"goals_against","GA",fInt)}${sg(r,"clean_sheets","CS",fInt)}
            ${sg(r,"xg_for","xGF",f1)}${sg(r,"xg_against","xGA",f1)}${sg(r,"xg_overperformance","xG±",f1)}
            ${sg(r,"avg_possession","Poss",fPctRaw)}${sg(r,"win_pct","Win%",fPct)}${sg(r,"shot_accuracy","ShAcc",fPct)}
          </div>
          <div class="m-detail-actions">
            <a class="btn lime sm" href="#/country/${r._code||""}">${esc(r._code||r.team)} →</a>
          </div>
        </div>
      </div>`;
    }).join("");

    list.querySelectorAll("[data-toggle]").forEach(row=>row.addEventListener("click",()=>{
      const c=row.dataset.toggle; openCode = openCode===c?null:c; selCode=c; draw();
    }));

    const more=$("#ms-more");
    if(all.length>limit){
      more.innerHTML=`<button class="btn" id="ms-morebtn">Show more · ${limit} of ${all.length}</button>`;
      $("#ms-morebtn").addEventListener("click",()=>{limit+=16;draw();});
    } else if(all.length>16){
      more.innerHTML=`<button class="btn" id="ms-lessbtn">Show fewer</button>`;
      $("#ms-lessbtn").addEventListener("click",()=>{limit=16;draw();window.scrollTo({top:0,behavior:"smooth"});});
    } else { more.innerHTML=""; }
  };

  function decorate(rowsIn){
    return (rowsIn||[]).map(r=>{
      const lt=teamByName(r.team);
      return Object.assign({}, r, { _code:lt?.code||null, _flag:lt?.flag||"🏳️", _conf:lt?.conf||null });
    });
  }
  function load(){
    $("#ms-list").innerHTML = skeletonRows(6);
    fetchTeams(scope)
      .then(data=>{ teams=decorate(data); draw(); })
      .catch(()=>{ fetchError($("#ms-list"), load); $("#ms-podium").innerHTML=""; });
  }

  $("#ms-rail").querySelectorAll(".m-chip").forEach(ch=>ch.addEventListener("click",()=>{
    focus=ch.dataset.focus; dir=metaDir[focus]||"desc"; limit=16;
    $("#ms-rail").querySelectorAll(".m-chip").forEach(c=>c.classList.toggle("on",c===ch));
    ch.scrollIntoView({inline:"center",block:"nearest",behavior:"smooth"});
    draw();
  }));
  $("#ms-sort").addEventListener("click",()=>{dir=dir==="desc"?"asc":"desc";draw();});

  $("#ms-filter").addEventListener("click",()=>{
    openSheet(`
      <h3>Filter teams</h3>
      <div class="m-field"><label>Search team or code</label>
        <input type="text" id="sf-q" placeholder="e.g. Brazil or BRA" value="${esc(q)}"></div>`,
      (sheet,reset)=>{
        if(reset){ q=""; } else { q=(sheet.querySelector("#sf-q").value||"").toLowerCase().trim(); }
        limit=16; draw();
      });
  });

  load();
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
  app.innerHTML = `<div class="kicker">Predictor</div><div class="sec-h"><h1>Tournament Predictor</h1></div><div class="empty" id="bk">Loading…</div>`;
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
  if(!PRED || !PRED.picks) return null;
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
    <div class="sec-h"><h1>Tournament Predictor</h1>
      ${champ?`<span class="pill champ-pill">${byCode(champ).flag} ${esc(byCode(champ).name)}</span>`:""}</div>
    <p class="muted note">Favourites are pre-filled by power rating. Reorder groups, select the eight advancing third-placed teams, then pick your winner in each knockout tie.</p>
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
  const posLbl=["Winner","Runner-up","3rd","Eliminated"];
  const posCls=["adv-win","adv-run","adv-third","adv-out"];
  
  $("#pbody").innerHTML=`<p class="muted substep">Drag to reorder. Top two advance automatically; third place may advance in step 2.</p>
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
    <p class="muted substep">Select exactly eight third-placed teams to advance — <b id="tcount" class="${n===8?"ok":"warn"}">${n} of 8 selected</b>.</p>
    <div class="third-grid">
      ${cands.map(({g,code})=>{const t=byCode(code);const on=PRED.third.has(g);
        return `<button class="third-chip ${on?"on":""}" data-g="${g}">
          <span class="fl">${t.flag}</span>
          <span class="tc-n">${esc(t.name)}</span>
          <span class="tc-m">3rd · Group ${g}</span>
          <span class="tc-x">${on?"✓":"+"}</span></button>`;}).join("")}
    </div>
    <p class="muted substep" style="margin-top:14px">${scen?`Groups ${[...PRED.third].sort().join(", ")} — scenario #${scen.scenario_number}. Proceed to the knockout round.`:n===8?`Combination not found in the scenario set.`:`Select ${8-n>0?(8-n)+" more":""} to lock the Round of 32.`}</p>`;
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
    $("#pbody").innerHTML=`<div class="empty">Select eight third-placed teams in step 2 first. <button class="btn sm" id="toStep2">Step 2 →</button></div>`;
    $("#toStep2").addEventListener("click",()=>{PSTEP=2;renderPredictor();}); 
    return; 
  }

  function matchBox(id, label) {
    const {home,away,thirdPending}=participants(id);
    const w=winnerCode(id);
    if(thirdPending) return `<div class="bmatch"><div class="mm">${label||id}</div><div class="empty-bteam">TBD</div></div>`;
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
    <p class="muted substep">Click a team to advance them. Unfilled picks default to the higher-rated side.</p>
    
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
              <div class="finals-title">Final<span>Match 104 · MetLife Stadium</span></div>
              <div class="pred-bracket">
                ${matchBox("M104")}
              </div>
            </div>

            <div class="finals-card bronze">
              <div class="finals-title">Third Place<span>Match 103 · Hard Rock Stadium</span></div>
              <div class="pred-bracket">
                ${matchBox("M103")}
              </div>
            </div>

          </div>
          
          ${champ ? `
            <div class="champ-box animated-glowing">
              <span>World Cup 2026 Champion</span>
              <b>${esc(byCode(champ).name)}</b>
            </div>
          ` : ''}
        </div>
      </div>
    </div>`;

  $("#pbody").querySelectorAll(".bteam[data-c]").forEach(b=>b.addEventListener("click",()=>{
    PRED.picks[b.dataset.m]=b.dataset.c;
    _R32=r32map();
    const champ=winnerCode("M104");
    const secH=document.querySelector(".sec-h");
    if(secH){
      const existing=secH.querySelector(".champ-pill");
      if(champ){
        const pill=`<span class="pill champ-pill">${byCode(champ).flag} ${esc(byCode(champ).name)}</span>`;
        if(existing) existing.outerHTML=pill; else secH.insertAdjacentHTML("beforeend",pill);
      } else if(existing){ existing.remove(); }
    }
    stepKnockout();
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
      <p>Live betting markets across the tournament.</p>
      <a class="btn" href="#/stats" style="margin-top:22px">Team statistics →</a></div>`;
}
function fantasy(){
  app.innerHTML = `<div class="crumbs"><a href="#/">Home</a></div>
    <div class="soon-hero"><div class="kicker" style="color:var(--gold)">Coming soon</div>
      <div class="big">FANTASY</div>
      <p>Build your World Cup XI, pick a captain, and compete on the leaderboard.</p>
      <a class="btn" href="#/players" style="margin-top:22px">Player stats →</a></div>`;
}
function notfound(){
  app.innerHTML = `<div class="soon-hero"><div class="big" style="color:var(--mag)">404</div>
    <p>Page not found.</p><a class="btn lime" href="#/" style="margin-top:20px">Back home</a></div>`;
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