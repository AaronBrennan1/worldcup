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
    .m-podium .pod .medal{position:absolute;top:8px;right:9px;font-size:15px}

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
  `;
  document.head.appendChild(style);
};

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

// shared axis bounds: pad the real data range, but keep a 0 baseline when data sits near zero
function axisBounds(vals){
  if(!vals.length) return [0,1];
  let lo=Math.min(...vals), hi=Math.max(...vals);
  if(lo===hi){ lo-=1; hi+=1; }
  const pad=(hi-lo)*0.12 || 1;
  let lo2=lo-pad; if(lo>=0 && lo2<0) lo2=0;
  return [lo2, hi+pad];
}

function players(){
  injectGlobalDashboardStyles();
  if(isMobile()){ return playersMobile(); }

  // local state (no leaky globals — resets cleanly on every visit)
  let q="", pos="", team="", minMin=270, topN=20;
  let ax="sh90", ay="xg90";
  let sortK="xg90", sortDir=-1, selName=null, tableLimit=25;

  const base = D.players.slice();
  const filtered = ()=> base.filter(p=>
      (!pos||p.pos===pos) && (!team||p.code===team) &&
      (p.min||0)>=minMin &&
      ((p.name||"").toLowerCase().includes(q) || (p.nat||"").toLowerCase().includes(q)));

  app.innerHTML = `
    <div class="dashboard-wrapper">
      <div class="dash-lead">
        <div class="lead-copy">
          <div class="kicker">Player Statistics</div>
          <div class="sec-h"><h1>Player Stats</h1><span class="pill" id="ptotal"></span></div>
          <p>Every metric is per-90-minutes unless marked as a total, so players are compared on equal footing. Use the chart to spot the standout performers, then read the full table below. Click any player to highlight them everywhere.</p>
        </div>
      </div>

      <div class="ctrlbar">
        <div class="ctrl">
          <label>Search player or nation</label>
          <input id="psearch" placeholder="e.g. Mbappé, Brazil…">
        </div>
        <div class="ctrl">
          <label>Position</label>
          <select id="ppos"><option value="">All positions</option>
            <option>Goalkeeper</option><option>Defender</option><option>Midfielder</option><option>Forward</option></select>
        </div>
        <div class="ctrl">
          <label>Team</label>
          <select id="pteam"><option value="">All teams</option>
            ${teamsArr().filter(t=>t.squad && t.squad.length).sort((a,b)=>a.name.localeCompare(b.name))
              .map(t=>`<option value="${t.code}">${esc(t.name)}</option>`).join("")}</select>
        </div>
        <div class="ctrl">
          <label>Minimum minutes played: <b id="mmval">270</b></label>
          <input type="range" id="pmin" min="0" max="900" step="90" value="270">
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-head">
          <h3 id="chart-title">xG / 90 vs Shots / 90</h3>
          <div class="axis-picks">
            <div class="axis-pick y"><span class="ax-tag">Y ↑</span>
              <select id="ay">${PMETRICS.map(([k,l])=>`<option value="${k}"${k==="xg90"?" selected":""}>${l}</option>`).join("")}</select></div>
            <div class="axis-pick"><span class="ax-tag">X →</span>
              <select id="ax">${PMETRICS.map(([k,l])=>`<option value="${k}"${k==="sh90"?" selected":""}>${l}</option>`).join("")}</select></div>
            <div class="axis-pick"><span class="ax-tag">Show</span>
              <select id="atop">
                <option value="10">Top 10</option>
                <option value="15">Top 15</option>
                <option value="20" selected>Top 20</option>
                <option value="30">Top 30</option>
              </select></div>
          </div>
        </div>
        <div class="chart-stage"><div id="scatter"></div></div>
        <div class="chart-foot">
          <span class="legend">
            <span><i style="background:var(--lime)"></i>Player</span>
            <span><i style="background:var(--mag)"></i>Selected</span>
            <span id="scount"></span>
          </span>
          <span class="hint">Dashed lines mark the median of the players shown · hover a dot for detail</span>
        </div>
        <div class="chart-foot" style="margin-top:4px"><span class="sel-note" id="selinfo"></span></div>
      </div>

      <div class="card" style="overflow:hidden;padding:0">
        <div class="tbl-wrap">
          <table class="dt adv" id="pt">
            <thead><tr>
              <th data-k="name" data-t="s">Player</th>
              <th data-k="team" data-t="s">Team</th>
              <th data-k="pos" data-t="s">Pos</th>
              <th class="num" data-k="age">Age</th>
              <th class="num" data-k="min">Min</th>
              <th class="num" data-k="gs">St</th>
              <th class="num" data-k="g">G</th>
              <th class="num" data-k="a">A</th>
              <th class="num" data-k="xg">xG</th>
              <th class="num" data-k="xg90">xG/90</th>
              <th class="num" data-k="sh90">Sh/90</th>
              <th class="num" data-k="sot90">SoT/90</th>
              <th class="num" data-k="kp90">KP/90</th>
              <th class="num" data-k="tk90">Tk/90</th>
              <th class="num" data-k="rt">Rating</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-foot" id="ptfoot"></div>
      </div>
    </div>`;

  const posTag = p => p.pos ? p.pos.substring(0,2).toUpperCase() : "—";

  /* ----- scatter: plot only the top N players by the Y-axis metric ----- */
  const drawScatter = ()=>{
    const rows = filtered();
    const valid = rows.filter(p=>p[ax]!=null && p[ay]!=null);
    // rank by the headline (Y) metric, then keep the requested number of leaders
    const ranked = [...valid].sort((a,b)=>(b[ay]??-Infinity)-(a[ay]??-Infinity));
    const shown = ranked.slice(0, topN);

    const W=860, H=460, pad={l:64,r:30,t:30,b:54};
    const xs=shown.map(p=>p[ax]), ys=shown.map(p=>p[ay]);
    const [xmin,xmax]=axisBounds(xs), [ymin,ymax]=axisBounds(ys);
    const sx=v=>pad.l+(v-xmin)/(xmax-xmin||1)*(W-pad.l-pad.r);
    const sy=v=>H-pad.b-(v-ymin)/(ymax-ymin||1)*(H-pad.t-pad.b);
    const med=a=>{if(!a.length)return 0;const s=[...a].sort((m,n)=>m-n);return s[Math.floor(s.length/2)];};
    const mx=med(xs), my=med(ys);
    const ticks=(lo,hi,n=5)=>Array.from({length:n+1},(_,i)=>lo+(hi-lo)*i/n);

    let dots="", labels="";
    shown.forEach((p,i)=>{
      const sel=p.name===selName, cx=sx(p[ax]), cy=sy(p[ay]), r=sel?9:6;
      dots+=`<circle class="dot" data-i="${i}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}"
        fill="${sel?"var(--mag)":"var(--lime)"}" fill-opacity="${sel?1:.85}"
        stroke="#080a0d" stroke-width="${sel?2.5:1.2}"/>`;
      const right=cx>W-150, tx=right?cx-10:cx+10, anc=right?"end":"start";
      labels+=`<text class="lbl" x="${tx.toFixed(1)}" y="${(cy+3.5).toFixed(1)}" text-anchor="${anc}"
        font-size="${sel?12:10.5}" fill="${sel?"var(--mag)":"#aebbd1"}">${esc(shortName(p.name))}</text>`;
    });

    const xlab=ticks(xmin,xmax).map(v=>`<text class="tick" x="${sx(v)}" y="${H-pad.b+18}" text-anchor="middle">${+v.toFixed(2)}</text>`).join("");
    const ylab=ticks(ymin,ymax).map(v=>`<text class="tick" x="${pad.l-9}" y="${sy(v)+4}" text-anchor="end">${+v.toFixed(2)}</text>`).join("");

    $("#scatter").innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" id="scsvg">
      <line class="guide" x1="${pad.l}" y1="${sy(my)}" x2="${W-pad.r}" y2="${sy(my)}"/>
      <line class="guide" x1="${sx(mx)}" y1="${pad.t}" x2="${sx(mx)}" y2="${H-pad.b}"/>
      <text class="quad" x="${W-pad.r-4}" y="${pad.t+12}" text-anchor="end">High ${esc(PMLABEL[ay])} · High ${esc(PMLABEL[ax])}</text>
      <line class="axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H-pad.b}"/>
      <line class="axis" x1="${pad.l}" y1="${H-pad.b}" x2="${W-pad.r}" y2="${H-pad.b}"/>
      ${xlab}${ylab}
      <text class="axttl" x="${pad.l+(W-pad.l-pad.r)/2}" y="${H-10}" text-anchor="middle">${esc(PMLABEL[ax])} →</text>
      <text class="axttl" transform="rotate(-90 16 ${pad.t+(H-pad.t-pad.b)/2})" x="16" y="${pad.t+(H-pad.t-pad.b)/2}" text-anchor="middle">${esc(PMLABEL[ay])} →</text>
      ${dots}${labels}
      <g id="tip" style="display:none"><rect rx="8" id="tipbg" fill="#16202e" stroke="#2b394e" filter="drop-shadow(0px 6px 14px rgba(0,0,0,.6))"/><text id="tiptx"></text></g>
    </svg>`;

    const totalQ = valid.length;
    $("#scount").textContent = `Showing the top ${shown.length} of ${totalQ} qualifying players, ranked by ${PMLABEL[ay]}.`;

    const svg=$("#scsvg"), tip=$("#tip",svg), tbg=$("#tipbg",svg), ttx=$("#tiptx",svg);
    svg.querySelectorAll(".dot").forEach(c=>{
      c.addEventListener("mousemove",()=>{
        const p=shown[+c.dataset.i];
        ttx.innerHTML=`<tspan x="12" dy="6" style="font-weight:800;fill:var(--lime);font-size:13px">${esc(p.name)}</tspan>`+
          `<tspan x="12" dy="17" fill="#8c93a0" font-size="11">${esc(p.team)} · ${esc(p.pos)}</tspan>`+
          `<tspan x="12" dy="18" fill="#fff" font-size="12">${esc(PMLABEL[ay])}: ${fmtN(p[ay])}</tspan>`+
          `<tspan x="12" dy="16" fill="#fff" font-size="12">${esc(PMLABEL[ax])}: ${fmtN(p[ax])}</tspan>`;
        const bb=ttx.getBBox?ttx.getBBox():{width:170,height:78};
        let tx=+c.getAttribute("cx")+16, ty=+c.getAttribute("cy")-22;
        if(tx+bb.width+24>W) tx=+c.getAttribute("cx")-bb.width-24;
        if(ty<10) ty=12;
        tip.setAttribute("transform",`translate(${tx},${ty})`);
        tbg.setAttribute("x",0); tbg.setAttribute("y",-12);
        tbg.setAttribute("width",bb.width+24); tbg.setAttribute("height",bb.height+22);
        tip.style.display="block";
      });
      c.addEventListener("mouseleave",()=>tip.style.display="none");
      c.addEventListener("click",()=>{const p=shown[+c.dataset.i]; selName=(selName===p.name?null:p.name); refresh();});
    });
  };

  /* ----- table ----- */
  const renderTable=()=>{
    const rows=filtered().sort((a,b)=>cmp(a[sortK],b[sortK])*sortDir);
    const view=rows.slice(0,tableLimit);
    const tbody=$("#pt tbody");

    tbody.innerHTML = view.map(p=>{
      const sel=p.name===selName, tag=posTag(p);
      return `<tr class="${sel?"selrow":""}" data-n="${esc(p.name)}" style="cursor:pointer">
        <td class="name" style="font-weight:700">${esc(p.name)}</td>
        <td><span class="flgcell">${p.flag||""}${esc(p.team)}</span></td>
        <td><span class="pos-badge pos-${tag}">${tag}</span></td>
        <td class="num">${fmtN(p.age,0)}</td>
        <td class="num" style="color:#fff;font-weight:600">${fmtN(p.min,0)}</td>
        <td class="num">${fmtN(p.gs,0)}</td>
        <td class="num">${fmtN(p.g,0)}</td>
        <td class="num">${fmtN(p.a,0)}</td>
        <td class="num">${fmtN(p.xg)}</td>
        <td class="num ${sortK==="xg90"?"colk":""}">${fmtN(p.xg90)}</td>
        <td class="num ${sortK==="sh90"?"colk":""}">${fmtN(p.sh90)}</td>
        <td class="num ${sortK==="sot90"?"colk":""}">${fmtN(p.sot90)}</td>
        <td class="num ${sortK==="kp90"?"colk":""}">${fmtN(p.kp90)}</td>
        <td class="num ${sortK==="tk90"?"colk":""}">${fmtN(p.tk90)}</td>
        <td class="num" style="font-weight:800;color:#fff">${fmtN(p.rt)}</td></tr>`;
    }).join("") || `<tr><td colspan="15" class="muted" style="text-align:center;padding:34px">No players match these filters — try lowering the minimum minutes.</td></tr>`;

    const foot=$("#ptfoot");
    if(!rows.length){ foot.innerHTML=""; }
    else if(rows.length>tableLimit){
      foot.innerHTML=`<span>Showing top <b>${tableLimit}</b> of <b>${rows.length}</b> players, sorted by <b>${PMLABEL[sortK]||sortK}</b>.</span>
        <span><button class="btn sm" id="moreBtn">Show 25 more</button> <button class="btn lime sm" id="allBtn">Show all</button></span>`;
      $("#moreBtn").addEventListener("click",()=>{tableLimit+=25;renderTable();});
      $("#allBtn").addEventListener("click",()=>{tableLimit=rows.length;renderTable();});
    } else {
      foot.innerHTML=`<span>Showing all <b>${rows.length}</b> players, sorted by <b>${PMLABEL[sortK]||sortK}</b>.</span>
        ${rows.length>25?`<button class="btn sm" id="lessBtn">Show fewer</button>`:""}`;
      const lb=$("#lessBtn"); if(lb) lb.addEventListener("click",()=>{tableLimit=25;renderTable();});
    }

    tbody.querySelectorAll("tr[data-n]").forEach(tr=>tr.addEventListener("click",()=>{
      selName = selName===tr.dataset.n?null:tr.dataset.n; refresh();
    }));
    document.querySelectorAll("#pt th[data-k]").forEach(th=>th.classList.toggle("sortk", th.dataset.k===sortK));
  };

  const refresh=()=>{
    drawScatter();
    renderTable();
    $("#chart-title").textContent = `${PMLABEL[ay]} vs ${PMLABEL[ax]}`;
    $("#ptotal").textContent = `${filtered().length} players shown`;
    $("#selinfo").innerHTML = selName
      ? `Highlighting <b>${esc(selName)}</b> in the chart and table — click again to clear.`
      : "";
  };

  $("#psearch").addEventListener("input",e=>{q=e.target.value.toLowerCase();tableLimit=25;refresh();});
  $("#ppos").addEventListener("change",e=>{pos=e.target.value;tableLimit=25;refresh();});
  $("#pteam").addEventListener("change",e=>{team=e.target.value;tableLimit=25;refresh();});
  $("#pmin").addEventListener("input",e=>{minMin=+e.target.value;$("#mmval").textContent=minMin;refresh();});
  $("#ay").addEventListener("change",e=>{ay=e.target.value;refresh();});
  $("#ax").addEventListener("change",e=>{ax=e.target.value;refresh();});
  $("#atop").addEventListener("change",e=>{topN=+e.target.value;drawScatter();$("#scount")&&null;});
  document.querySelectorAll("#pt th[data-k]").forEach(th=>th.addEventListener("click",()=>{
    const k=th.dataset.k; if(sortK===k)sortDir*=-1; else {sortK=k;sortDir=th.dataset.t==="s"?1:-1;} renderTable();
    document.querySelectorAll("#pt th[data-k]").forEach(t=>t.classList.toggle("sortk",t.dataset.k===sortK));
  }));

  refresh();
}

/* =========================================================
   MOBILE EXPERIENCE — players & team stats
   Shared helper: a slide-up filter sheet that any caller can
   populate with fields and read back on apply.
   ========================================================= */
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

/* ---------- PLAYERS (mobile) ---------- */
function playersMobile(){
  // focus metrics surfaced as quick chips (the rest live in the table-style detail)
  const FOCUS = [
    ["xg90","xG/90"],["g90","Goals/90"],["a90","Assists/90"],["ga90","G+A/90"],
    ["sh90","Shots/90"],["sot90","SoT/90"],["kp90","Key P/90"],["cc90","Chances/90"],
    ["drb90","Dribbles/90"],["tk90","Tackles/90"],["int90","Intercept/90"],["rt","Rating"],
    ["g","Goals"],["a","Assists"],["xg","xG total"],["min","Minutes"],
  ];
  const lowerBetter = new Set([]); // for players, every focus metric is higher-is-better
  let q="", pos="", team="", minMin=270;
  let focus="xg90", dir=-1, limit=15, openName=null, selName=null;

  const base = D.players.slice();
  const filtered = ()=> base.filter(p=>
      (!pos||p.pos===pos) && (!team||p.code===team) &&
      (p.min||0)>=minMin &&
      ((p.name||"").toLowerCase().includes(q) || (p.nat||"").toLowerCase().includes(q)));
  const posTag = p => p.pos ? p.pos.substring(0,2).toUpperCase() : "—";
  const activeFilters = ()=> (q?1:0)+(pos?1:0)+(team?1:0)+(minMin!==270?1:0);

  app.innerHTML = `
    <div class="mdash">
      <div class="m-hero">
        <div class="kicker">Player Statistics</div>
        <h1>Player Stats</h1>
        <p class="m-sub">Per-90 metrics so everyone’s compared on equal footing. Pick a stat to rank by, tap a card for the full breakdown.</p>
        <span class="m-count" id="m-count"></span>
      </div>

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

      <div class="m-list" id="m-list"></div>
      <div class="m-showmore" id="m-more"></div>
    </div>`;

  const draw = ()=>{
    const rows = filtered().sort((a,b)=>cmp(a[focus],b[focus])*dir);
    const view = rows.slice(0,limit);
    const maxAbs = Math.max(0.0001, ...rows.map(r=>Math.abs(parseFloat(r[focus])||0)));
    const lower = lowerBetter.has(focus);

    $("#m-count").textContent = `${rows.length} player${rows.length===1?"":"s"} shown`;
    $("#m-focus-name").textContent = PMLABEL[focus]||focus;
    $("#m-sort-lbl").textContent = PMLABEL[focus]||focus;
    $("#m-dir").textContent = dir<0 ? "▼ high→low" : "▲ low→high";
    const fb=$("#m-fbadge"), filt=activeFilters();
    $("#m-filter").classList.toggle("has-active", filt>0);
    fb.innerHTML = filt>0 ? `<span class="dotbadge"></span>` : "";

    const list=$("#m-list");
    if(!view.length){
      list.innerHTML=`<div class="m-empty">No players match these filters.<br>Try lowering the minimum minutes.</div>`;
      $("#m-more").innerHTML=""; return;
    }
    list.innerHTML = view.map((p,i)=>{
      const tag=posTag(p);
      const val=p[focus];
      const pct=Math.min(100,Math.max(4,(Math.abs(parseFloat(val)||0)/maxAbs)*100));
      const open=p.name===openName, sel=p.name===selName;
      const sg=(k,lbl)=>`<div class="sg ${k===focus?"hl":""}"><div class="k">${lbl}</div><div class="v">${fmtN(p[k])}</div></div>`;
      return `<div class="m-card${open?" open":""}${sel?" sel":""}" data-n="${esc(p.name)}">
        <div class="m-row" data-toggle="${esc(p.name)}">
          <div class="m-rank ${i<3?"top":""}">${i+1}</div>
          <div class="m-flag">${p.flag||"🏳️"}</div>
          <div class="m-id">
            <div class="m-name">${esc(p.name)}</div>
            <div class="m-meta"><span class="pos-badge pos-${tag}">${tag}</span>
              <span>${esc(p.team)}</span><span class="dot-sep">·</span><span>${fmtN(p.min,0)} min</span></div>
          </div>
          <div class="m-statend">
            <div class="m-bigval${lower?" lower":""}">${fmtN(val)}</div>
            <div class="m-statlbl">${PMLABEL[focus]||focus}</div>
          </div>
          <div class="m-chev">▶</div>
        </div>
        <div class="m-barrow"><div class="m-bar"><i class="${lower?"lower":""}" style="width:${pct}%"></i></div></div>
        <div class="m-detail">
          <div class="m-statgrid">
            ${sg("g","Goals")}${sg("a","Assists")}${sg("xg","xG")}
            ${sg("xg90","xG/90")}${sg("sh90","Sh/90")}${sg("sot90","SoT/90")}
            ${sg("kp90","KeyP/90")}${sg("drb90","Drb/90")}${sg("tk90","Tk/90")}
            ${sg("pasc","Pass%")}${sg("rt","Rating")}${sg("age","Age")}
          </div>
          <div class="m-detail-actions">
            <button class="btn lime sm" data-select="${esc(p.name)}">${sel?"Clear highlight":"Highlight player"}</button>
          </div>
        </div>
      </div>`;
    }).join("");

    list.querySelectorAll("[data-toggle]").forEach(row=>row.addEventListener("click",()=>{
      const n=row.dataset.toggle; openName = openName===n?null:n; draw();
    }));
    list.querySelectorAll("[data-select]").forEach(b=>b.addEventListener("click",e=>{
      e.stopPropagation(); const n=b.dataset.select; selName = selName===n?null:n; draw();
    }));

    const more=$("#m-more");
    if(rows.length>limit){
      more.innerHTML=`<button class="btn" id="m-morebtn">Show ${Math.min(15,rows.length-limit)} more · ${limit} of ${rows.length}</button>`;
      $("#m-morebtn").addEventListener("click",()=>{limit+=15;draw();});
    } else if(rows.length>15){
      more.innerHTML=`<button class="btn" id="m-lessbtn">Show fewer</button>`;
      $("#m-lessbtn").addEventListener("click",()=>{limit=15;draw();window.scrollTo({top:0,behavior:"smooth"});});
    } else { more.innerHTML=""; }
  };

  // focus rail
  $("#m-rail").querySelectorAll(".m-chip").forEach(ch=>ch.addEventListener("click",()=>{
    focus=ch.dataset.focus; dir=-1; limit=15;
    $("#m-rail").querySelectorAll(".m-chip").forEach(c=>c.classList.toggle("on",c===ch));
    ch.scrollIntoView({inline:"center",block:"nearest",behavior:"smooth"});
    draw();
  }));
  // sort direction toggle
  $("#m-sort").addEventListener("click",()=>{dir*=-1;draw();});

  // filter sheet
  $("#m-filter").addEventListener("click",()=>{
    const posOpts=["","Goalkeeper","Defender","Midfielder","Forward"];
    const posLbls=["All","GK","DEF","MID","FWD"];
    const teamsList = teamsArr().filter(t=>t.squad && t.squad.length).sort((a,b)=>a.name.localeCompare(b.name));
    openSheet(`
      <h3>Filter players</h3>
      <div class="m-field">
        <label>Search player or nation</label>
        <input type="text" id="sf-q" placeholder="e.g. Mbappé, Brazil…" value="${esc(q)}">
      </div>
      <div class="m-field">
        <label>Position</label>
        <div class="m-segwrap" id="sf-pos">
          ${posOpts.map((v,i)=>`<button class="m-seg${v===pos?" on":""}" data-v="${v}">${posLbls[i]}</button>`).join("")}
        </div>
      </div>
      <div class="m-field">
        <label>Team</label>
        <select id="sf-team"><option value="">All teams</option>
          ${teamsList.map(t=>`<option value="${t.code}"${t.code===team?" selected":""}>${esc(t.name)}</option>`).join("")}
        </select>
      </div>
      <div class="m-field">
        <label>Minimum minutes played: <b id="sf-mmval">${minMin}</b></label>
        <input type="range" id="sf-min" min="0" max="900" step="90" value="${minMin}">
      </div>`,
      (sheet,reset)=>{
        if(reset){ q="";pos="";team="";minMin=270; }
        else {
          q=(sheet.querySelector("#sf-q").value||"").toLowerCase().trim();
          pos=sheet.querySelector("#sf-pos .m-seg.on")?.dataset.v||"";
          team=sheet.querySelector("#sf-team").value||"";
          minMin=+sheet.querySelector("#sf-min").value;
        }
        limit=15; openName=null; draw();
      },
      (sheet)=>{
        sheet.querySelectorAll("#sf-pos .m-seg").forEach(b=>b.addEventListener("click",()=>{
          sheet.querySelectorAll("#sf-pos .m-seg").forEach(x=>x.classList.toggle("on",x===b));
        }));
        const rng=sheet.querySelector("#sf-min"), out=sheet.querySelector("#sf-mmval");
        rng.addEventListener("input",()=>out.textContent=rng.value);
      });
  });

  draw();
}

/* ---------- TEAM STATS ---------- */
function stats(){
  injectGlobalDashboardStyles();
  if(isMobile()){ return statsMobile(); }

  const cs = D.country_stats.slice();
  const metrics = [
    ["goals_scored","Goals scored",-1],["goals_conceded","Goals conceded",1],
    ["goal_difference","Goal difference",-1],["points_per_game","Points / game",-1],
    ["xg_for_avg_overall","xG / match",-1],["clean_sheets","Clean sheets",-1],
    ["average_possession","Possession %",-1],["win_percentage","Win %",-1],
    ["cards_total","Cards",1],
  ];
  const dirMap   = Object.fromEntries(metrics.map(([k,,d])=>[k,d]));
  const labelMap = Object.fromEntries(metrics.map(([k,l])=>[k,l]));

  let sortK="goals_scored", dir=-1;
  let ax="xg_for_avg_overall", ay="goals_scored";
  let selCode=null;

  app.innerHTML = `
    <div class="dashboard-wrapper">
      <div class="dash-lead">
        <div class="lead-copy">
          <div class="kicker">Team Statistics</div>
          <div class="sec-h"><h1>Team Stats</h1><span class="pill">${cs.length} teams</span></div>
          <p>Tournament performance for every nation. Choose a metric to rank by — the podium, chart and table all update together. Every team appears on the chart; click any team to highlight it, or tap a name to open its page.</p>
        </div>
        <div class="ctrl" style="min-width:220px">
          <label>Rank teams by</label>
          <select id="metric">${metrics.map(([k,l])=>`<option value="${k}"${k===sortK?" selected":""}>${l}</option>`).join("")}</select>
        </div>
      </div>

      <div class="podium-deck" id="podium"></div>

      <div class="chart-card">
        <div class="chart-head">
          <h3 id="t-chart-title"></h3>
          <div class="axis-picks">
            <div class="axis-pick y"><span class="ax-tag">Y ↑</span>
              <select id="tay">${metrics.map(([k,l])=>`<option value="${k}"${k===ay?" selected":""}>${l}</option>`).join("")}</select></div>
            <div class="axis-pick"><span class="ax-tag">X →</span>
              <select id="tax">${metrics.map(([k,l])=>`<option value="${k}"${k===ax?" selected":""}>${l}</option>`).join("")}</select></div>
          </div>
        </div>
        <div class="chart-stage"><div id="team-scatter"></div></div>
        <div class="chart-foot">
          <span class="legend">
            <span><i style="background:var(--lime)"></i>Team</span>
            <span><i style="background:var(--mag)"></i>Selected</span>
            <span id="tscount"></span>
          </span>
          <span class="hint">Labels are 3-letter team codes · dashed lines mark the median · hover for full detail</span>
        </div>
      </div>

      <div class="card" style="overflow:hidden;padding:0">
        <div class="tbl-wrap">
          <table class="dt adv" id="tt">
            <thead><tr>
              <th class="num" style="width:54px">#</th>
              <th data-k="name" data-t="s">Team</th>
              <th class="num" data-k="matches_played">P</th>
              <th class="num" data-k="wins">W</th>
              <th class="num" data-k="draws">D</th>
              <th class="num" data-k="losses">L</th>
              <th class="num" data-k="goals_scored">GF</th>
              <th class="num" data-k="goals_conceded">GA</th>
              <th class="num" data-k="goal_difference">GD</th>
              <th class="num" data-k="points_per_game">PPG</th>
              <th class="num" data-k="xg_for_avg_overall">xG/m</th>
              <th class="num" data-k="clean_sheets">CS</th>
              <th class="num" data-k="average_possession">Poss%</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-foot"><span id="ttnote"></span><span class="hint">Click a column header to sort · the highlighted column is the active ranking metric</span></div>
      </div>
    </div>`;

  const tbody=$("#tt tbody");

  /* ----- scatter: every team plotted, labelled by code ----- */
  const drawTeamScatter = (rows)=>{
    const pts = rows.filter(r=>r[ax]!=null && r[ay]!=null);
    const W=860, H=470, pad={l:64,r:34,t:30,b:54};
    const xs=pts.map(r=>parseFloat(r[ax])||0), ys=pts.map(r=>parseFloat(r[ay])||0);
    const [xmin,xmax]=axisBounds(xs), [ymin,ymax]=axisBounds(ys);
    const sx=v=>pad.l+(v-xmin)/(xmax-xmin||1)*(W-pad.l-pad.r);
    const sy=v=>H-pad.b-(v-ymin)/(ymax-ymin||1)*(H-pad.t-pad.b);
    const med=a=>{if(!a.length)return 0;const s=[...a].sort((m,n)=>m-n);return s[Math.floor(s.length/2)];};
    const mx=med(xs), my=med(ys);
    const ticks=(lo,hi,n=5)=>Array.from({length:n+1},(_,i)=>lo+(hi-lo)*i/n);

    let dots="", labels="";
    pts.forEach((r,i)=>{
      const sel=r.code===selCode, cx=sx(parseFloat(r[ax])||0), cy=sy(parseFloat(r[ay])||0), rad=sel?9:5.5;
      dots+=`<circle class="dot" data-i="${i}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad}"
        fill="${sel?"var(--mag)":"var(--lime)"}" fill-opacity="${sel?1:.8}"
        stroke="#080a0d" stroke-width="${sel?2.5:1.1}"/>`;
      const right=cx>W-70, tx=right?cx-8:cx+8, anc=right?"end":"start";
      labels+=`<text class="code" x="${tx.toFixed(1)}" y="${(cy+3).toFixed(1)}" text-anchor="${anc}"
        font-size="${sel?12:9.5}" fill="${sel?"var(--mag)":"#9aa7bd"}" fill-opacity="${sel?1:.85}">${esc(r.code)}</text>`;
    });

    const xlab=ticks(xmin,xmax).map(v=>`<text class="tick" x="${sx(v)}" y="${H-pad.b+18}" text-anchor="middle">${+v.toFixed(2)}</text>`).join("");
    const ylab=ticks(ymin,ymax).map(v=>`<text class="tick" x="${pad.l-9}" y="${sy(v)+4}" text-anchor="end">${+v.toFixed(2)}</text>`).join("");

    $("#team-scatter").innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" id="ts_svg">
      <line class="guide" x1="${pad.l}" y1="${sy(my)}" x2="${W-pad.r}" y2="${sy(my)}"/>
      <line class="guide" x1="${sx(mx)}" y1="${pad.t}" x2="${sx(mx)}" y2="${H-pad.b}"/>
      <text class="quad" x="${W-pad.r-4}" y="${pad.t+12}" text-anchor="end">High ${esc(labelMap[ay])} · High ${esc(labelMap[ax])}</text>
      <line class="axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H-pad.b}"/>
      <line class="axis" x1="${pad.l}" y1="${H-pad.b}" x2="${W-pad.r}" y2="${H-pad.b}"/>
      ${xlab}${ylab}
      <text class="axttl" x="${pad.l+(W-pad.l-pad.r)/2}" y="${H-10}" text-anchor="middle">${esc(labelMap[ax])} →</text>
      <text class="axttl" transform="rotate(-90 16 ${pad.t+(H-pad.t-pad.b)/2})" x="16" y="${pad.t+(H-pad.t-pad.b)/2}" text-anchor="middle">${esc(labelMap[ay])} →</text>
      ${dots}${labels}
      <g id="ttip" style="display:none"><rect rx="8" id="ttipbg" fill="#16202e" stroke="#2b394e" filter="drop-shadow(0px 6px 14px rgba(0,0,0,.6))"/><text id="ttiptx"></text></g>
    </svg>`;

    $("#tscount").textContent = `All ${pts.length} teams plotted.`;

    const svg=$("#ts_svg"), tip=$("#ttip",svg), tbg=$("#ttipbg",svg), ttx=$("#ttiptx",svg);
    svg.querySelectorAll(".dot").forEach(c=>{
      c.addEventListener("mousemove",()=>{
        const r=pts[+c.dataset.i];
        ttx.innerHTML=`<tspan x="12" dy="6" style="font-weight:800;fill:var(--lime);font-size:13px">${esc(r.name)}</tspan>`+
          `<tspan x="12" dy="17" fill="#8c93a0" font-size="11">Group ${esc(r.group)} · ${fmt(r.wins)}W ${fmt(r.draws)}D ${fmt(r.losses)}L</tspan>`+
          `<tspan x="12" dy="18" fill="#fff" font-size="12">${esc(labelMap[ay])}: ${fmt(r[ay])}</tspan>`+
          `<tspan x="12" dy="16" fill="#fff" font-size="12">${esc(labelMap[ax])}: ${fmt(r[ax])}</tspan>`;
        const bb=ttx.getBBox?ttx.getBBox():{width:180,height:78};
        let tx=+c.getAttribute("cx")+16, ty=+c.getAttribute("cy")-22;
        if(tx+bb.width+24>W) tx=+c.getAttribute("cx")-bb.width-24;
        if(ty<10) ty=12;
        tip.setAttribute("transform",`translate(${tx},${ty})`);
        tbg.setAttribute("x",0); tbg.setAttribute("y",-12);
        tbg.setAttribute("width",bb.width+24); tbg.setAttribute("height",bb.height+22);
        tip.style.display="block";
      });
      c.addEventListener("mouseleave",()=>tip.style.display="none");
      c.addEventListener("click",()=>{const r=pts[+c.dataset.i]; selCode=(selCode===r.code?null:r.code); draw();});
    });
  };

  const draw=()=>{
    const rows=[...cs].sort((a,b)=>cmp(a[sortK],b[sortK])*dir);
    const higherBetter = dirMap[sortK]===-1;
    const label = labelMap[sortK];

    // podium — the three best teams for the chosen metric
    const medals=["🥇","🥈","🥉"], cls=["p1","p2","p3"];
    $("#podium").innerHTML = rows.slice(0,3).map((t,i)=>`
      <div class="podium-card ${cls[i]}" data-code="${t.code}" style="cursor:pointer">
        <div class="medal">${medals[i]}</div>
        <div class="pflag">${t.flag||""}</div>
        <div class="pname">${esc(t.name)}</div>
        <div class="pgroup">Group ${esc(t.group)}</div>
        <span class="pval">${fmt(t[sortK])}${sortK==="average_possession"||sortK==="win_percentage"?"%":""}</span>
        <span class="plabel">${esc(label)} ${higherBetter?"(higher is better)":"(lower is better)"}</span>
        <div class="prec">P${fmt(t.matches_played)} · <b>${fmt(t.wins)}W</b> ${fmt(t.draws)}D ${fmt(t.losses)}L</div>
      </div>`).join("");
    $("#podium").querySelectorAll(".podium-card").forEach(el=>el.addEventListener("click",()=>{
      selCode = selCode===el.dataset.code?null:el.dataset.code; draw();
    }));

    drawTeamScatter(rows);

    // magnitude bar for the active metric (lime = higher-better, pink = lower-better)
    const maxAbs=Math.max(0.001,...rows.map(r=>Math.abs(parseFloat(r[sortK])||0)));
    const barColor = higherBetter ? "linear-gradient(90deg,var(--lime),#9fd400)" : "linear-gradient(90deg,#ff2d87,#b51e60)";

    tbody.innerHTML=rows.map((r,i)=>{
      const pct=Math.min(100,Math.max(3,(Math.abs(parseFloat(r[sortK])||0)/maxAbs)*100));
      const k=c=>sortK===c?"colk":"";
      return `<tr class="${r.code===selCode?"selrow":""}" data-code="${r.code}" style="cursor:pointer">
        <td class="num"><span class="rankcell ${i<3?"top":""}">${i+1}</span></td>
        <td class="name"><div class="teamcell">
          <a href="#/country/${r.code}">${r.flag||""} ${esc(r.name)}</a>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
        </div></td>
        <td class="num">${fmt(r.matches_played)}</td>
        <td class="num">${fmt(r.wins)}</td>
        <td class="num">${fmt(r.draws)}</td>
        <td class="num">${fmt(r.losses)}</td>
        <td class="num ${k("goals_scored")}">${fmt(r.goals_scored)}</td>
        <td class="num ${k("goals_conceded")}">${fmt(r.goals_conceded)}</td>
        <td class="num ${k("goal_difference")}">${fmt(r.goal_difference)}</td>
        <td class="num ${k("points_per_game")}" style="font-weight:700">${fmt(r.points_per_game)}</td>
        <td class="num ${k("xg_for_avg_overall")}">${fmt(r.xg_for_avg_overall)}</td>
        <td class="num ${k("clean_sheets")}">${fmt(r.clean_sheets)}</td>
        <td class="num ${k("average_possession")}">${fmt(r.average_possession)}%</td></tr>`;
    }).join("");

    tbody.querySelectorAll("tr[data-code]").forEach(tr=>tr.addEventListener("click",e=>{
      if(e.target.closest("a")) return; // let links through to the country page
      selCode = selCode===tr.dataset.code?null:tr.dataset.code; draw();
    }));

    document.querySelectorAll("#tt th[data-k]").forEach(th=>th.classList.toggle("sortk",th.dataset.k===sortK));
    $("#t-chart-title").textContent = `${labelMap[ay]} vs ${labelMap[ax]}`;
    $("#ttnote").innerHTML = `Ranked by <b>${esc(label)}</b> ${higherBetter?"(higher is better)":"(lower is better)"}.${selCode?` Highlighting <b>${esc(byCode(selCode)?.name||selCode)}</b>.`:""}`;
  };

  $("#metric").addEventListener("change",e=>{sortK=e.target.value;dir=dirMap[sortK]||-1;draw();});
  $("#tax").addEventListener("change",e=>{ax=e.target.value;draw();});
  $("#tay").addEventListener("change",e=>{ay=e.target.value;draw();});
  document.querySelectorAll("#tt th[data-k]").forEach(th=>th.addEventListener("click",()=>{
    const k=th.dataset.k; if(sortK===k)dir*=-1; else {sortK=k;dir=th.dataset.t==="s"?1:(dirMap[k]||-1);} draw();
  }));

  draw();
}

/* ---------- TEAM STATS (mobile) ---------- */
function statsMobile(){
  const cs = D.country_stats.slice();
  const metrics = [
    ["points_per_game","PPG",-1],["goals_scored","Goals",-1],["goal_difference","Goal Diff",-1],
    ["win_percentage","Win %",-1],["xg_for_avg_overall","xG/match",-1],["clean_sheets","Clean Sheets",-1],
    ["average_possession","Possession",-1],["goals_conceded","Conceded",1],["cards_total","Cards",1],
  ];
  const dirMap   = Object.fromEntries(metrics.map(([k,,d])=>[k,d]));
  const labelMap = Object.fromEntries(metrics.map(([k,l])=>[k,l]));
  const isPct = k => k==="average_possession" || k==="win_percentage";

  let focus="points_per_game", dir=-1, openCode=null, selCode=null, limit=16, q="";
  const filtered = ()=> cs.filter(r=> !q || (r.name||"").toLowerCase().includes(q) || (r.code||"").toLowerCase().includes(q) || (r.group||"").toLowerCase()===q);
  const activeFilters = ()=> (q?1:0);

  app.innerHTML = `
    <div class="mdash">
      <div class="m-hero">
        <div class="kicker">Team Statistics</div>
        <h1>Team Stats</h1>
        <p class="m-sub">Tournament performance for every nation. Pick a metric to rank by — podium and cards update together. Tap a team for the full line.</p>
        <span class="m-count" id="ms-count"></span>
      </div>

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

      <div class="m-list" id="ms-list"></div>
      <div class="m-showmore" id="ms-more"></div>
    </div>`;

  const val = (r,k)=> parseFloat(r[k])||0;
  const suffix = k => isPct(k) ? "%" : "";

  const draw = ()=>{
    const all = filtered().sort((a,b)=>cmp(a[focus],b[focus])*dir);
    const lower = dirMap[focus]===1;
    const higherBetter = !lower;
    // podium is always the BEST three for the metric regardless of sort direction
    const best = [...filtered()].sort((a,b)=>cmp(a[focus],b[focus])*(higherBetter?-1:1)).slice(0,3);
    const maxAbs = Math.max(0.0001, ...filtered().map(r=>Math.abs(val(r,focus))));

    $("#ms-count").textContent = `${all.length} team${all.length===1?"":"s"}`;
    $("#ms-focus-name").textContent = labelMap[focus];
    $("#ms-sort-lbl").textContent = labelMap[focus];
    $("#ms-dir").textContent = dir<0 ? "▼ high→low" : "▲ low→high";
    const filt=activeFilters();
    $("#ms-filter").classList.toggle("has-active", filt>0);
    $("#ms-fbadge").innerHTML = filt>0 ? `<span class="dotbadge"></span>` : "";

    // podium
    const medals=["🥇","🥈","🥉"], gcls=["g1","g2","g3"];
    $("#ms-podium").innerHTML = best.map((t,i)=>`
      <div class="pod ${gcls[i]}" data-code="${t.code}">
        <div class="medal">${medals[i]}</div>
        <div class="rk">#${i+1}</div>
        <div class="fl">${t.flag||"🏳️"}</div>
        <div class="nm">${esc(t.code)}</div>
        <div class="vl">${fmt(t[focus])}${suffix(focus)}</div>
      </div>`).join("");
    $("#ms-podium").querySelectorAll(".pod").forEach(el=>el.addEventListener("click",()=>{
      openCode = el.dataset.code; selCode = el.dataset.code;
      const card = $(`#ms-list .m-card[data-code="${el.dataset.code}"]`);
      draw();
      const c2 = $(`#ms-list .m-card[data-code="${el.dataset.code}"]`);
      if(c2) c2.scrollIntoView({block:"center",behavior:"smooth"});
    }));

    const view = all.slice(0,limit);
    const list=$("#ms-list");
    if(!view.length){ list.innerHTML=`<div class="m-empty">No teams match that search.</div>`; $("#ms-more").innerHTML=""; return; }

    const sg=(r,k,lbl)=>`<div class="sg ${k===focus?"hl":""}"><div class="k">${lbl}</div><div class="v">${fmt(r[k])}${isPct(k)?"%":""}</div></div>`;
    list.innerHTML = view.map((r,i)=>{
      const pct=Math.min(100,Math.max(4,(Math.abs(val(r,focus))/maxAbs)*100));
      const open=r.code===openCode, sel=r.code===selCode;
      return `<div class="m-card${open?" open":""}${sel?" sel":""}" data-code="${r.code}">
        <div class="m-row" data-toggle="${r.code}">
          <div class="m-rank ${i<3?"top":""}">${i+1}</div>
          <div class="m-flag">${r.flag||"🏳️"}</div>
          <div class="m-id">
            <div class="m-name">${esc(r.name)}</div>
            <div class="m-meta"><span>Group ${esc(r.group)}</span><span class="dot-sep">·</span>
              <span><b style="color:var(--txt)">${fmt(r.wins)}</b>W ${fmt(r.draws)}D ${fmt(r.losses)}L</span></div>
          </div>
          <div class="m-statend">
            <div class="m-bigval${lower?" lower":""}">${fmt(r[focus])}${suffix(focus)}</div>
            <div class="m-statlbl">${labelMap[focus]}</div>
          </div>
          <div class="m-chev">▶</div>
        </div>
        <div class="m-barrow"><div class="m-bar"><i class="${lower?"lower":""}" style="width:${pct}%"></i></div></div>
        <div class="m-detail">
          <div class="m-statgrid">
            ${sg(r,"matches_played","Played")}${sg(r,"wins","Wins")}${sg(r,"losses","Losses")}
            ${sg(r,"goals_scored","GF")}${sg(r,"goals_conceded","GA")}${sg(r,"goal_difference","GD")}
            ${sg(r,"points_per_game","PPG")}${sg(r,"xg_for_avg_overall","xG/m")}${sg(r,"clean_sheets","CS")}
            ${sg(r,"average_possession","Poss")}${sg(r,"win_percentage","Win%")}${sg(r,"cards_total","Cards")}
          </div>
          <div class="m-detail-actions">
            <a class="btn lime sm" href="#/country/${r.code}">Open ${esc(r.code)} team page →</a>
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

  $("#ms-rail").querySelectorAll(".m-chip").forEach(ch=>ch.addEventListener("click",()=>{
    focus=ch.dataset.focus; dir=dirMap[focus]||-1; limit=16;
    $("#ms-rail").querySelectorAll(".m-chip").forEach(c=>c.classList.toggle("on",c===ch));
    ch.scrollIntoView({inline:"center",block:"nearest",behavior:"smooth"});
    draw();
  }));
  $("#ms-sort").addEventListener("click",()=>{dir*=-1;draw();});

  $("#ms-filter").addEventListener("click",()=>{
    openSheet(`
      <h3>Filter teams</h3>
      <div class="m-field">
        <label>Search team, code or group</label>
        <input type="text" id="sf-q" placeholder="e.g. Brazil, BRA, or A" value="${esc(q)}">
      </div>`,
      (sheet,reset)=>{
        if(reset){ q=""; }
        else { q=(sheet.querySelector("#sf-q").value||"").toLowerCase().trim(); }
        limit=16; draw();
      });
  });

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
    _R32=r32map();
    const champ=winnerCode("M104");
    const secH=document.querySelector(".sec-h");
    if(secH){
      const existing=secH.querySelector(".champ-pill");
      if(champ){
        const pill=`<span class="pill champ-pill">${byCode(champ).flag} ${esc(byCode(champ).name)} — your champion</span>`;
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