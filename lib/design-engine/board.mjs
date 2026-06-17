/**
 * Board UI generator — ONE self-contained HTML file (inline CSS/JS, no CDN,
 * works offline, localhost only). The board is the CHOOSER; AskUserQuestion is
 * only the blocking wait (hard rule 2).
 *
 * v0.19.3 shell: a design-tool layout —
 *   ┌ top bar: title · mode · Interact/Pin · panel toggles ┐
 *   │ left rail: variants (live state) + versions/A-B      │
 *   │ stage: the selected design, full-bleed on a dot grid │
 *   │ right rail: inspector — rating, notes, pins, actions │
 *   └ approve dock lives at the inspector's foot ──────────┘
 * Both rails collapse (⌘/ctrl-free: click, or [ and ] keys). Density is
 * compact (12.5–13px chrome); ONE accent family (teal) on layered cream
 * neutrals — structure is drawn with warm hairlines, teal means interactive.
 *
 * Interaction: html artifacts (canvases, walkthroughs) load in Interact mode —
 * the pin layer passes pointer events through so pan/zoom works natively;
 * Pin (or the P key) arms annotation. Images/SVGs default to Pin.
 * Submission morphs the approve dock into a receipt of what was written.
 *
 * Handshake (unchanged): POST api/feedback {kind: submit|pending, feedback};
 * progress.json + reloadGen polling; pins carry normalized coords (+ screen id
 * in review mode, captured from the artifact's <section id>/[data-screen]).
 *
 * Palette: #f7f3e7 cream · #efe9d8 stage · #e1f2e8 mint · #b4e7d9 soft hairline
 *          #7cd2c1 · #4ab8a1 hover · #1f8f7d primary · ink #1d2a26.
 */

import { embedJson } from '../design/escape.mjs';

export function renderBoardHtml(config) {
  const {
    boardId,
    title = 'Design board',
    mode = 'loop',
    variants = [], // [{ id: 'A', label, src, type: 'image'|'svg'|'html' }]
  } = config;

  const cfg = { boardId, title, mode, variants };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title.replace(/</g, '&lt;')}</title>
<style>
  :root {
    --cream:#f7f3e7; --stage:#efe9d8; --panel:#fcfaf3; --card:#ffffff;
    --mint:#e1f2e8; --soft:#b4e7d9; --accent2:#7cd2c1; --hover:#4ab8a1; --primary:#1f8f7d;
    --ink:#1d2a26; --muted:#6b7a74; --line:#e6dfcc; --line-strong:#d8d0b8;
    --r:10px; --rs:7px;
    --shadow:0 1px 2px rgba(29,42,38,.05), 0 6px 20px rgba(29,42,38,.06);

    /* SPEC-017 collaborative review layer — calm cool-neutral skin (design-spec §1).
       Scoped under --rb-* so the legacy board chrome is untouched; the identity
       modal + attribution avatars render ONLY from these §1 palette tokens. */
    --rb-canvas:#f5f6f8; --rb-stage:#eceef2; --rb-panel:#fafbfc; --rb-card:#ffffff;
    --rb-ink:#1c2330; --rb-muted:#667085; --rb-line:#e6e8ee; --rb-line-strong:#d4d8e0;
    --rb-primary:#4f46e5; --rb-primary-fg:#ffffff;
    /* SPEC-017 T-005.2 — intent + status pin tokens (design-spec §1). Token-only;
       markers carry NO raw hex. fix = destructive red, improve = indigo accent,
       question = teal-cyan, resolved = muted slate (dashed ring). */
    --pin-fix:#dc2626; --pin-improve:#4f46e5; --pin-question:#0e7490; --pin-resolved:#94a3b8;
    /* SPEC-017 T-007 — intent badge tint backgrounds (design-spec §1). Token-only;
       the soft surfaces a fix/improve/question badge sits on. */
    --pin-fix-tint:#fdecec; --pin-improve-tint:#ecebfd; --pin-question-tint:#e0f2f7;
    --rb-r:14px; --rb-rs:10px;
    --rb-shadow-lg:0 12px 36px rgba(28,35,48,.18), 0 2px 8px rgba(28,35,48,.08);
    --rb-shadow-md:0 6px 18px rgba(28,35,48,.12), 0 1px 4px rgba(28,35,48,.08);
    --rb-shadow-sm:0 1px 2px rgba(28,35,48,.06), 0 2px 6px rgba(28,35,48,.07);
    --rb-ease:cubic-bezier(.2,0,0,1);
  }
  * { box-sizing:border-box }
  html, body { height:100% }
  body { margin:0; background:var(--cream); color:var(--ink);
         font:12.5px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
         -webkit-font-smoothing:antialiased; overflow:hidden }
  button { font:inherit; cursor:pointer }
  ::-webkit-scrollbar { width:10px; height:10px }
  ::-webkit-scrollbar-thumb { background:var(--line-strong); border-radius:6px; border:3px solid var(--panel) }
  ::-webkit-scrollbar-track { background:transparent }

  .app { display:grid; grid-template-rows:44px 1fr; height:100vh }
  /* SPEC-017 T-007: a 4th column for the persistent feedback rail (right-most). */
  .main { display:grid; grid-template-columns:auto 1fr auto auto; min-height:0 }

  /* ── top bar ─────────────────────────────────────────────────────────── */
  .top { display:flex; align-items:center; gap:10px; padding:0 12px;
         background:var(--panel); border-bottom:1px solid var(--line) }
  .top .dot { width:9px; height:9px; border-radius:3px; background:var(--primary) }
  .top h1 { font-size:13px; margin:0; font-weight:600; letter-spacing:-.01em; white-space:nowrap;
            overflow:hidden; text-overflow:ellipsis; max-width:38vw }
  .chip { font-size:10px; font-weight:700; color:var(--primary); background:var(--mint);
          padding:3px 8px; border-radius:999px; text-transform:uppercase; letter-spacing:.08em }
  .top .spacer { flex:1 }
  .seg { display:flex; background:var(--cream); border:1px solid var(--line); border-radius:999px; padding:2px }
  .seg button { border:0; background:transparent; color:var(--muted); font-size:11.5px; font-weight:600;
                padding:4px 12px; border-radius:999px; transition:all .14s ease }
  .seg button.on { background:var(--primary); color:#fff }
  .iconbtn { width:28px; height:28px; border:1px solid var(--line); background:var(--panel);
             border-radius:var(--rs); color:var(--muted); display:flex; align-items:center;
             justify-content:center; font-size:13px; transition:all .14s ease }
  .iconbtn:hover { color:var(--primary); border-color:var(--soft) }
  .iconbtn.off { background:var(--cream); color:var(--line-strong) }
  .exportwrap { position:relative }
  .menu { position:absolute; right:0; top:34px; z-index:60; min-width:214px; background:var(--card);
          border:1px solid var(--line); border-radius:var(--r); padding:5px;
          box-shadow:0 12px 36px rgba(29,42,38,.16) }
  .menu button { display:block; width:100%; text-align:left; border:0; background:transparent;
                 color:var(--ink); font-size:12.5px; padding:8px 10px; border-radius:var(--rs); cursor:pointer }
  .menu button:hover { background:var(--mint); color:var(--primary) }
  .menu .mhint { color:var(--muted); font-size:10.5px; padding:6px 10px 4px; line-height:1.45 }
  .menu .sep { height:1px; background:var(--line); margin:4px 2px }
  .hint { color:var(--muted); font-size:11.5px; white-space:nowrap }

  .banner { position:fixed; top:52px; left:50%; transform:translateX(-50%); z-index:80;
            display:none; align-items:center; gap:10px; padding:9px 16px; font-weight:600;
            font-size:12.5px; border-radius:999px; box-shadow:var(--shadow);
            background:var(--ink); color:var(--mint) }
  .banner.show { display:flex; animation:drop .3s cubic-bezier(.2,1.4,.4,1) }
  @keyframes drop { from { transform:translate(-50%,-8px); opacity:0 } to { transform:translate(-50%,0); opacity:1 } }
  .banner .badge { color:var(--accent2) }

  /* ── rails ───────────────────────────────────────────────────────────── */
  .rail { background:var(--panel); overflow-y:auto; min-height:0; transition:width .16s ease }
  .rail.left { width:216px; border-right:1px solid var(--line) }
  .rail.right { width:296px; border-left:1px solid var(--line); display:flex; flex-direction:column }
  .rail.closed { width:0; overflow:hidden; border:0 }
  .sect { padding:12px 12px 4px }
  .sect h2 { margin:0 0 8px; font-size:10px; font-weight:700; text-transform:uppercase;
             letter-spacing:.1em; color:var(--muted) }

  .vitem { display:flex; align-items:center; gap:9px; padding:6px 8px; border-radius:var(--rs);
           cursor:pointer; border:1px solid transparent; margin-bottom:2px }
  .vitem:hover { background:var(--cream) }
  .vitem.on { background:var(--mint); border-color:var(--soft) }
  .vitem .thumb { width:44px; height:32px; border-radius:5px; background:var(--card);
                  border:1px solid var(--line); overflow:hidden; flex:0 0 auto;
                  display:flex; align-items:center; justify-content:center;
                  font-size:10px; font-weight:700; color:var(--muted) }
  .vitem .thumb img, .vitem .thumb object { width:100%; height:100%; object-fit:cover; pointer-events:none }
  .vitem .nm { flex:1; min-width:0 }
  .vitem .nm b { display:block; font-size:12px; font-weight:600 }
  .vitem .nm span { display:block; font-size:10.5px; color:var(--muted); white-space:nowrap;
                    overflow:hidden; text-overflow:ellipsis }
  .vitem .st { font-size:10px; font-weight:600; color:var(--muted) }
  .vitem .st.done { color:var(--primary) } .vitem .st.failed { color:#b4452f }
  .spin { display:inline-block; width:9px; height:9px; border:2px solid var(--soft);
          border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite }
  @keyframes spin { to { transform:rotate(360deg) } }

  .verthumb { display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:var(--rs);
              cursor:pointer; border:1px solid transparent; font-size:11px; color:var(--muted) }
  .verthumb:hover { background:var(--cream) }
  .verthumb.sel { background:var(--mint); border-color:var(--soft); color:var(--primary) }
  .verthumb .vt { width:36px; height:26px; border-radius:4px; border:1px solid var(--line);
                  background:#fff; overflow:hidden; flex:0 0 auto }
  .verthumb .vt img, .verthumb .vt object { width:100%; height:100%; object-fit:cover; pointer-events:none }

  /* ── stage ───────────────────────────────────────────────────────────── */
  .stage { position:relative; min-width:0; min-height:0; overflow:auto; background:var(--stage);
           background-image:radial-gradient(rgba(29,42,38,.10) 1px, transparent 1px);
           background-size:22px 22px }
  .stagein { min-height:100%; display:flex; align-items:flex-start; justify-content:center; padding:20px }
  .frame { position:relative; flex:0 0 auto; background:var(--card); border-radius:var(--r);
           box-shadow:var(--shadow); overflow:hidden; border:1px solid var(--line) }
  .frame img, .frame object { display:block; max-width:100%; height:auto }
  .frame.fill { width:100%; height:calc(100vh - 44px - 40px) }
  .frame.fill iframe { width:100%; height:100%; border:0; display:block; background:#fff }
  .stagein.fillwrap { padding:12px; align-items:stretch }
  .stagein.fillwrap .frame { flex:1 }
  .pinlayer { position:absolute; inset:0; cursor:crosshair; z-index:6 }
  .pinlayer.pass { pointer-events:none }
  .pin { position:absolute; transform:translate(-50%,-100%); z-index:8; pointer-events:auto }
  .pin .pd { width:22px; height:22px; border-radius:50% 50% 50% 0; background:var(--primary);
             color:#fff; font-size:10.5px; font-weight:700; display:flex; align-items:center;
             justify-content:center; transform:rotate(-45deg); border:2px solid #fff;
             box-shadow:0 2px 8px rgba(29,42,38,.3) }
  .pin .pd span { transform:rotate(45deg) }
  .pin.hl .pd { background:var(--hover); transform:rotate(-45deg) scale(1.25) }
  .region { position:absolute; border:1.5px dashed var(--primary); background:rgba(31,143,125,.07);
            border-radius:4px; z-index:7; pointer-events:none }
  .popover { position:absolute; z-index:60; width:264px; background:var(--card);
             border:1px solid var(--line); border-radius:var(--r); padding:10px;
             box-shadow:0 12px 36px rgba(29,42,38,.16) }
  .popover .row { display:flex; gap:6px; margin-top:8px }
  .diffwrap { position:relative; max-width:100%; }
  .diffwrap img { display:block; max-width:100% }
  .diffwrap .topimg { position:absolute; inset:0; overflow:hidden }
  .diffwrap .topimg img { max-width:none; width:100% }
  .diffwrap input[type=range] { position:absolute; left:16px; right:16px; bottom:12px;
                                width:calc(100% - 32px); z-index:6 }
  /* HTML/canvas artifacts can't be image-diffed; compare them as live iframes side by side. */
  .diffab { display:flex; gap:10px; width:100%; height:calc(100vh - 44px - 40px) }
  .diffab .abcol { flex:1; position:relative; border:1px solid var(--line); border-radius:var(--r);
                   overflow:hidden; background:#fff }
  .diffab .abcol iframe { width:100%; height:100%; border:0; display:block }
  .diffab .ablab { position:absolute; top:8px; left:8px; z-index:2; font-size:10px; font-weight:700;
                   letter-spacing:.06em; background:var(--mint); color:var(--primary);
                   border:1px solid var(--soft); border-radius:6px; padding:2px 7px }
  .stagebar { position:sticky; bottom:0; display:flex; justify-content:center; padding:8px; z-index:10; pointer-events:none }
  .stagebar .inner { pointer-events:auto; display:flex; align-items:center; gap:10px; background:var(--ink);
                     color:var(--cream); border-radius:999px; padding:6px 14px; font-size:11.5px;
                     box-shadow:var(--shadow) }
  .stagebar b { color:#fff; font-weight:600 }
  .stagebar button { border:0; background:transparent; color:var(--accent2); font-size:13px; padding:0 2px }

  /* ── inspector ───────────────────────────────────────────────────────── */
  .insp { flex:1; overflow-y:auto; min-height:0 }
  .insp .sect { border-bottom:1px solid var(--line); padding-bottom:12px }
  .stars { display:flex; gap:1px }
  .stars button { background:none; border:0; font-size:19px; color:var(--line-strong);
                  padding:0 2px; transition:color .1s ease, transform .1s ease }
  .stars button:hover { transform:scale(1.12) }
  .stars button.on { color:var(--hover) }
  textarea, select, input[type=text] { background:var(--card); color:var(--ink);
            border:1px solid var(--line); border-radius:var(--rs); padding:7px 9px;
            font:inherit; width:100% }
  textarea:focus, select:focus, input[type=text]:focus { outline:2px solid var(--soft);
            outline-offset:1px; border-color:var(--hover) }
  textarea { min-height:54px; resize:vertical }
  select { width:auto; cursor:pointer }
  .btn { background:var(--card); color:var(--ink); border:1px solid var(--line);
         border-radius:var(--rs); padding:7px 12px; font-weight:500; font-size:12px;
         transition:all .14s ease }
  .btn:hover { border-color:var(--hover); color:var(--primary); background:var(--mint) }
  .btn:active { transform:scale(.985) }
  .btn.primary { background:var(--primary); border-color:var(--primary); color:#fff; font-weight:600;
                 padding:9px 16px; font-size:12.5px }
  .btn.primary:hover { background:var(--hover); border-color:var(--hover); color:#fff }
  .btn.block { width:100% }
  .pinrow { display:flex; gap:8px; align-items:flex-start; padding:7px 8px; border-radius:var(--rs);
            cursor:pointer; border:1px solid transparent; margin-bottom:2px }
  .pinrow:hover { background:var(--cream) }
  .pinrow .n { width:18px; height:18px; border-radius:50%; background:var(--primary); color:#fff;
               font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center;
               flex:0 0 auto; margin-top:1px }
  .pinrow .tx { flex:1; min-width:0; font-size:11.5px; line-height:1.45 }
  .pinrow .tx .it { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
                    color:var(--primary); background:var(--mint); border-radius:4px; padding:1px 6px; margin-right:6px }
  .pinrow .tx .sc { color:var(--muted); font-size:10.5px }
  .pinrow .del { border:0; background:transparent; color:var(--muted); font-size:13px; padding:2px }
  .pinrow .del:hover { color:#b4452f }
  .empty { color:var(--muted); font-size:11.5px; padding:2px 8px }
  .fieldlbl { font-size:11px; color:var(--muted); margin:8px 0 4px }
  .inline { display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:12px; color:var(--muted) }

  /* ── approve dock ────────────────────────────────────────────────────── */
  .dock { border-top:1px solid var(--line); background:var(--panel); padding:12px }
  .dock .inline { margin-bottom:8px }
  .receipt { display:none; align-items:flex-start; gap:10px; font-size:12.5px; line-height:1.5 }
  .receipt.show { display:flex }
  .receipt .check { width:26px; height:26px; border-radius:50%; background:var(--primary); color:#fff;
                    display:flex; align-items:center; justify-content:center; font-size:13px;
                    flex:0 0 auto; animation:pop .35s cubic-bezier(.2,1.6,.4,1) }
  @keyframes pop { 0% { transform:scale(.3); opacity:0 } 100% { transform:scale(1); opacity:1 } }
  .receipt b { color:var(--primary) }
  .receipt .meta { color:var(--muted); font-size:11.5px }

  /* ── SPEC-017: attribution avatar (design-spec §4) ─────────────────────── */
  /* Round, white initials on a deterministic jewel hue from the name hash.
     Inline background/color are set per-instance in JS (renderAvatar). */
  .rb-avatar { display:inline-flex; align-items:center; justify-content:center;
               border-radius:50%; flex:0 0 auto; font-weight:600; line-height:1;
               color:var(--rb-primary-fg); letter-spacing:.01em;
               text-transform:uppercase; user-select:none }
  .rb-avatar--sm { width:20px; height:20px; font-size:9px }
  .rb-avatar--base { width:28px; height:28px; font-size:12px }
  .rb-avatar--lg { width:48px; height:48px; font-size:18px }
  /* marker attribution avatar — tucked at the pin's base (refined in T-005) */
  .pin .rb-pin-avatar { position:absolute; left:14px; top:-4px; box-shadow:0 0 0 2px var(--rb-card) }
  .pinrow .rb-avatar { margin-top:1px }

  /* edit-identity chip in the top bar */
  .rb-id-chip { display:inline-flex; align-items:center; gap:7px; height:28px;
                padding:0 10px 0 6px; border:1px solid var(--rb-line);
                background:var(--rb-panel); color:var(--rb-ink); border-radius:999px;
                font-size:12px; font-weight:600; transition:border-color .15s var(--rb-ease) }
  .rb-id-chip:hover { border-color:var(--rb-primary) }
  .rb-id-chip .rb-id-name { max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
  .rb-id-chip svg { color:var(--rb-muted) }

  /* authors-seen cluster — stacked, overlapping sm avatars of everyone in the roster */
  .rb-seen { display:inline-flex; align-items:center; padding-left:6px }
  .rb-seen .rb-avatar { margin-left:-6px; box-shadow:0 0 0 2px var(--rb-panel) }
  .rb-seen .rb-avatar:first-child { margin-left:0 }

  /* ── SPEC-017: identity modal (design-spec §4 + s-identity, §9) ────────── */
  .rb-identity-modal { position:fixed; inset:0; z-index:200; display:none;
                       align-items:center; justify-content:center; padding:24px }
  .rb-identity-modal.open { display:flex }
  .rb-identity-modal .rb-scrim { position:absolute; inset:0; background:rgba(28,35,48,.40);
                                 -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px) }
  .rb-identity-modal .rb-card { position:relative; z-index:1; width:100%; max-width:380px;
                                background:var(--rb-card); color:var(--rb-ink);
                                border:1px solid var(--rb-line); border-radius:var(--rb-r);
                                box-shadow:var(--rb-shadow-lg); padding:24px;
                                animation:rb-modal-in .2s var(--rb-ease) }
  @keyframes rb-modal-in { from { opacity:0; transform:translateY(8px) scale(.98) } to { opacity:1; transform:none } }
  .rb-identity-modal h2 { margin:0; font-size:14px; font-weight:600; line-height:1.3 }
  .rb-identity-modal .rb-sub { margin:4px 0 0; font-size:12px; line-height:1.45; color:var(--rb-muted) }
  .rb-identity-preview { display:flex; align-items:center; gap:12px; margin:16px 0 0 }
  .rb-identity-preview .rb-pv-text { font-size:14px; font-weight:600; color:var(--rb-ink) }
  .rb-identity-preview .rb-pv-text.muted { color:var(--rb-muted); font-weight:400 }
  .rb-identity-modal label { display:block; font-size:12px; font-weight:500;
                             color:var(--rb-muted); margin:16px 0 4px }
  .rb-identity-modal input.rb-name { width:100%; height:44px; padding:0 12px;
                             background:var(--rb-card); color:var(--rb-ink);
                             border:1px solid var(--rb-line); border-radius:var(--rb-rs);
                             font:inherit; font-size:14px }
  .rb-identity-modal input.rb-name::placeholder { color:var(--rb-muted) }
  .rb-identity-modal input.rb-name:focus-visible,
  .rb-identity-modal input.rb-name:focus { outline:2px solid var(--rb-primary); outline-offset:1px;
                             border-color:var(--rb-primary) }
  .rb-identity-actions { display:flex; gap:8px; margin-top:24px }
  .rb-identity-actions .rb-btn { flex:1; height:44px; border-radius:var(--rb-rs);
                             font:inherit; font-size:13px; font-weight:600;
                             transition:background .15s var(--rb-ease), border-color .15s var(--rb-ease) }
  .rb-btn.rb-ghost { background:var(--rb-card); color:var(--rb-ink); border:1px solid var(--rb-line) }
  .rb-btn.rb-ghost:hover { border-color:var(--rb-line-strong); background:var(--rb-stage) }
  .rb-btn.rb-primary { background:var(--rb-primary); color:var(--rb-primary-fg); border:1px solid var(--rb-primary) }
  .rb-btn.rb-primary:hover { filter:brightness(.92) }
  .rb-btn.rb-primary:disabled { opacity:.55; cursor:default }
  .rb-btn:focus-visible { outline:2px solid var(--rb-primary); outline-offset:2px }
  @media (prefers-reduced-motion: reduce) {
    .rb-identity-modal .rb-card { animation:none }
  }

  /* ── SPEC-017 T-005: persisted pin overlay (design-spec §4 + s-board, §9) ──── */
  /* Stored pins (from GET /api/feedback) render as numbered teardrop markers on
     the pin layer: intent sets the accent, status sets the ring. Token-only — no
     raw hex on a marker. Each marker carries data-pin-id for two-way select (T-007). */
  .rb-overlay-hidden .rb-pin-marker { display:none }
  .rb-pin-marker { position:absolute; transform:translate(-50%,-100%); z-index:9;
                   pointer-events:auto; --rb-pin-accent:var(--rb-primary) }
  .rb-pin-marker--fix { --rb-pin-accent:var(--pin-fix) }
  .rb-pin-marker--improve { --rb-pin-accent:var(--pin-improve) }
  .rb-pin-marker--question { --rb-pin-accent:var(--pin-question) }
  .rb-pin-marker .rb-pin-dot { position:relative; width:24px; height:24px;
                   border-radius:50% 50% 50% 0; background:var(--rb-pin-accent);
                   color:var(--rb-primary-fg); border:1.5px solid var(--rb-card);
                   box-shadow:var(--rb-shadow-md); transform:rotate(-45deg);
                   display:flex; align-items:center; justify-content:center }
  /* status ring: open = solid accent, addressed = dashed accent, resolved below */
  .rb-pin-marker .rb-pin-dot { outline:1.5px solid var(--rb-pin-accent); outline-offset:1.5px }
  .rb-pin-marker--addressed .rb-pin-dot { outline-style:dashed }
  .rb-pin-marker--resolved .rb-pin-dot { background:var(--pin-resolved);
                   border:1.5px dashed var(--pin-resolved); outline:none }
  .rb-pin-marker--resolved { --rb-pin-accent:var(--pin-resolved) }
  /* numbered teardrop — mono 12/600, counter-rotated to read upright */
  .rb-pin-number { font:600 12px/1 ui-monospace, "SF Mono", "Segoe UI Mono", monospace;
                   font-variant-numeric:tabular-nums; transform:rotate(45deg); user-select:none }
  /* author avatar chip — offset to the marker's top-right corner, sm (16px here) */
  .rb-pin-marker .rb-pin-avatar { position:absolute; top:-6px; right:-8px; z-index:1;
                   width:16px; height:16px; font-size:8px;
                   box-shadow:0 0 0 1.5px var(--rb-card) }
  .rb-pin-marker:hover .rb-pin-dot { filter:brightness(1.06);
                   box-shadow:var(--rb-shadow-lg) } /* hover-card trigger stub (T-007) */
  .rb-pin-marker--selected .rb-pin-dot { outline-width:2.5px;
                   box-shadow:0 0 0 4px color-mix(in srgb, var(--rb-pin-accent) 22%, transparent), var(--rb-shadow-md) }

  /* Show/Hide pins toggle — switch in the top bar (design-spec §4). role=switch. */
  .rb-toggle-switch { display:inline-flex; align-items:center; gap:8px; height:28px;
                   padding:0 10px; border:1px solid var(--rb-line); border-radius:999px;
                   background:var(--rb-panel); color:var(--rb-ink); font:inherit;
                   font-size:12px; font-weight:600; cursor:pointer;
                   transition:border-color .15s var(--rb-ease) }
  .rb-toggle-switch:hover { border-color:var(--rb-primary) }
  .rb-toggle-switch:focus-visible { outline:2px solid var(--rb-primary); outline-offset:2px }
  .rb-toggle-switch svg { color:var(--rb-muted); flex:0 0 auto }
  .rb-toggle-switch .rb-toggle-track { position:relative; width:30px; height:18px; flex:0 0 auto;
                   border-radius:999px; background:var(--rb-line-strong);
                   transition:background .2s var(--rb-ease) }
  .rb-toggle-switch .rb-toggle-thumb { position:absolute; top:2px; left:2px; width:14px; height:14px;
                   border-radius:50%; background:var(--rb-card); box-shadow:var(--rb-shadow-md);
                   transition:transform .2s var(--rb-ease) }
  .rb-toggle-switch[aria-checked="true"] .rb-toggle-track { background:var(--rb-primary) }
  .rb-toggle-switch[aria-checked="true"] .rb-toggle-thumb { transform:translateX(12px) }
  .rb-toggle-label { white-space:nowrap }

  /* floating hidden-pins bar — pill at the stage's bottom-centre when hidden (§4, s-hidden) */
  .rb-pins-hidden-bar { position:absolute; left:50%; bottom:20px; transform:translateX(-50%);
                   z-index:11; display:none; align-items:center; gap:12px;
                   padding:8px 8px 8px 16px; border-radius:999px;
                   background:var(--rb-card); color:var(--rb-ink);
                   border:1px solid var(--rb-line); box-shadow:var(--rb-shadow-lg);
                   font-size:12px; font-weight:500 }
  .rb-pins-hidden-bar.show { display:flex }
  .rb-pins-hidden-bar .rb-hidden-count { color:var(--rb-muted) }
  .rb-pins-hidden-bar .rb-show-pins { border:0; border-radius:999px; cursor:pointer;
                   display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 12px;
                   background:var(--rb-primary); color:var(--rb-primary-fg); font:inherit;
                   font-size:12px; font-weight:600;
                   transition:filter .15s var(--rb-ease) }
  .rb-pins-hidden-bar .rb-show-pins:hover { filter:brightness(.92) }
  .rb-pins-hidden-bar .rb-show-pins:focus-visible { outline:2px solid var(--rb-primary); outline-offset:2px }

  /* pin-drop motion — guarded; pins appear instantly when reduced-motion is on (§7) */
  @media (prefers-reduced-motion: no-preference) {
    .rb-pin-marker { animation:rb-pin-drop 150ms var(--rb-ease) both }
    @keyframes rb-pin-drop { from { opacity:0; transform:translate(-50%,-100%) scale(.6) }
                             to { opacity:1; transform:translate(-50%,-100%) scale(1) } }
  }

  /* ── SPEC-017 T-007: feedback rail / inbox (design-spec §4 + s-inbox, §9) ─────
     The persistent right rail — the durable list of every stored pin, grouped,
     filterable, with two-way jump-to-pin selection, threaded replies and resolve.
     Token-only: --rb-panel rail bg, --rb-card item bg, --rb-ink/--rb-muted text,
     --rb-primary active chips, intent tint tokens for badges. 4-pt grid throughout. */
  .rb-feedback-rail { width:368px; flex:0 0 368px; background:var(--rb-panel);
                   border-left:1px solid var(--rb-line); display:flex; flex-direction:column;
                   min-height:0; container-type:inline-size; container-name:rb-screen }
  .rb-feedback-rail[hidden] { display:none }

  /* header: title "Feedback" (14/600), open-count badge (--rb-stage pill, tabular-nums),
     resolved chip. Sticky so it stays in view as the item list scrolls. */
  .rb-rail-header { position:sticky; top:0; z-index:2; background:var(--rb-panel);
                   display:flex; align-items:center; gap:8px; padding:16px 16px 12px;
                   border-bottom:1px solid var(--rb-line) }
  .rb-rail-header .rb-rail-title { font-size:14px; font-weight:600; color:var(--rb-ink); margin-right:auto }
  .rb-rail-count { font-size:12px; font-weight:600; color:var(--rb-ink);
                   background:var(--rb-stage); border-radius:999px; padding:2px 9px;
                   font-variant-numeric:tabular-nums }
  .rb-rail-resolved-chip { font-size:12px; font-weight:500; color:var(--rb-muted);
                   display:inline-flex; align-items:center; gap:5px;
                   font-variant-numeric:tabular-nums }
  .rb-rail-resolved-chip svg { color:var(--rb-muted) }

  /* filter bar: All · fix · improve · question · open · resolved · author chips.
     active chip = --rb-primary fill + --rb-primary-fg text; inactive = --rb-stage fill. */
  .rb-filter-bar { display:flex; flex-wrap:wrap; gap:6px; padding:12px 16px;
                   border-bottom:1px solid var(--rb-line) }
  .rb-filter-chip { display:inline-flex; align-items:center; gap:6px; height:26px; padding:0 11px;
                   border:1px solid transparent; border-radius:999px;
                   background:var(--rb-stage); color:var(--rb-ink);
                   font:inherit; font-size:12px; font-weight:500; cursor:pointer;
                   transition:background .15s var(--rb-ease), color .15s var(--rb-ease) }
  .rb-filter-chip:hover { background:var(--rb-line) }
  .rb-filter-chip:focus-visible { outline:2px solid var(--rb-primary); outline-offset:2px }
  .rb-filter-chip .rb-chip-dot { width:8px; height:8px; border-radius:50%; flex:0 0 auto }
  .rb-filter-chip .rb-chip-count { font-variant-numeric:tabular-nums; color:var(--rb-muted) }
  .rb-filter-chip--active { background:var(--rb-primary); color:var(--rb-primary-fg) }
  .rb-filter-chip--active:hover { background:var(--rb-primary); filter:brightness(.94) }
  .rb-filter-chip--active .rb-chip-count { color:var(--rb-primary-fg) }
  .rb-filter-chip .rb-fc-avatar { margin:0 -2px 0 -4px }

  /* item list: scrollable column of grouped .rb-rail-item cards. */
  .rb-rail-list { flex:1; overflow-y:auto; min-height:0; padding:8px 12px 16px }
  .rb-rail-group-label { font-size:10px; font-weight:700; letter-spacing:.1em;
                   text-transform:uppercase; color:var(--rb-muted); padding:12px 4px 6px }
  .rb-rail-empty { color:var(--rb-muted); font-size:13px; line-height:1.5; padding:24px 8px; text-align:center }

  /* rail item: avatar sm + name (13/500) + pin # (mono 12/600) + time (12) + 2-line comment
     + intent badge + status chip. hover: border --rb-line-strong + shadow lift.
     active (selected): left border --rb-primary, background --rb-card. */
  .rb-rail-item { display:grid; grid-template-columns:auto 1fr; gap:4px 10px;
                   align-items:start; padding:10px 12px; margin-bottom:6px;
                   background:var(--rb-card); border:1px solid var(--rb-line);
                   border-left:3px solid transparent; border-radius:var(--rb-rs);
                   cursor:pointer; transition:border-color .15s var(--rb-ease), box-shadow .15s var(--rb-ease) }
  .rb-rail-item:hover { border-color:var(--rb-line-strong); box-shadow:var(--rb-shadow-sm) }
  .rb-rail-item:focus-visible { outline:2px solid var(--rb-primary); outline-offset:2px }
  .rb-rail-item--active { border-left-color:var(--rb-primary); background:var(--rb-card);
                   box-shadow:var(--rb-shadow-sm) }
  .rb-rail-item .rb-ri-avatar { grid-row:1 / span 1; align-self:center }
  .rb-rail-item .rb-ri-head { grid-column:2; display:flex; align-items:baseline; gap:8px; min-width:0 }
  .rb-rail-item .rb-ri-name { font-size:13px; font-weight:500; color:var(--rb-ink);
                   white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
  .rb-rail-item .rb-ri-num { font:600 12px/1 ui-monospace, "SF Mono", "Segoe UI Mono", monospace;
                   color:var(--rb-muted); font-variant-numeric:tabular-nums; flex:0 0 auto }
  .rb-rail-item .rb-ri-time { font-size:12px; font-weight:500; color:var(--rb-muted);
                   margin-left:auto; flex:0 0 auto }
  .rb-rail-item .rb-ri-comment { grid-column:2; font-size:14px; line-height:1.45; color:var(--rb-ink);
                   display:-webkit-box; -webkit-line-clamp:2; line-clamp:2; -webkit-box-orient:vertical;
                   overflow:hidden }
  .rb-rail-item .rb-ri-badges { grid-column:2; display:flex; flex-wrap:wrap; gap:6px; margin-top:2px }
  .rb-rail-item .rb-ri-replies { grid-column:2; font-size:12px; color:var(--rb-muted);
                   display:inline-flex; align-items:center; gap:5px }
  .rb-rail-item .rb-ri-replies svg { color:var(--rb-muted) }

  /* intent + status badges (design-spec §4) — same-class sizing, tinted intents,
     muted/primary status. All colours are §1 tokens (no raw hex on a badge). */
  .rb-badge { display:inline-flex; align-items:center; gap:4px; height:20px; padding:0 8px;
                   border-radius:999px; font-size:12px; font-weight:600; line-height:1;
                   text-transform:lowercase; letter-spacing:.01em }
  .rb-badge--fix { color:var(--pin-fix); background:var(--pin-fix-tint) }
  .rb-badge--improve { color:var(--pin-improve); background:var(--pin-improve-tint) }
  .rb-badge--question { color:var(--pin-question); background:var(--pin-question-tint) }
  .rb-badge--open { color:var(--rb-muted); background:var(--rb-stage) }
  .rb-badge--resolved { color:var(--rb-primary-fg); background:var(--pin-resolved) }

  /* ── detail card (design-spec §4 + s-thread, §9) — scrim-less overlay on the stage,
     caps at 600px with a scrollable body so a long thread always fits the frame. */
  .rb-detail-card { position:absolute; z-index:40; right:20px; top:20px; width:380px;
                   max-width:calc(100% - 40px); max-height:600px; display:none;
                   flex-direction:column; background:var(--rb-card); color:var(--rb-ink);
                   border:1px solid var(--rb-line); border-radius:var(--rb-r);
                   box-shadow:var(--rb-shadow-lg) }
  .rb-detail-card.open { display:flex; animation:rb-modal-in .18s var(--rb-ease) }
  @media (prefers-reduced-motion: reduce) { .rb-detail-card.open { animation:none } }
  .rb-detail-head { display:flex; align-items:flex-start; gap:12px; padding:16px 16px 12px;
                   border-bottom:1px solid var(--rb-line) }
  .rb-detail-head .rb-dh-meta { flex:1; min-width:0 }
  .rb-detail-head .rb-dh-name { font-size:14px; font-weight:600; color:var(--rb-ink) }
  .rb-detail-head .rb-dh-time { font-size:12px; font-weight:500; color:var(--rb-muted); margin-top:2px }
  .rb-detail-head .rb-dh-num { font:600 12px/1 ui-monospace, "SF Mono", "Segoe UI Mono", monospace;
                   color:var(--rb-muted); font-variant-numeric:tabular-nums }
  .rb-detail-close { width:28px; height:28px; flex:0 0 auto; border:1px solid var(--rb-line);
                   background:var(--rb-card); color:var(--rb-muted); border-radius:var(--rb-rs);
                   display:inline-flex; align-items:center; justify-content:center;
                   cursor:pointer; transition:border-color .15s var(--rb-ease), color .15s var(--rb-ease) }
  .rb-detail-close:hover { color:var(--rb-ink); border-color:var(--rb-line-strong) }
  .rb-detail-close:focus-visible { outline:2px solid var(--rb-primary); outline-offset:2px }
  .rb-detail-body { flex:1; overflow-y:auto; min-height:0; padding:16px }
  .rb-detail-intent { margin-bottom:10px }
  .rb-detail-comment { font-size:14px; line-height:1.55; color:var(--rb-ink); white-space:pre-wrap;
                   word-break:break-word }
  .rb-detail-sep { height:1px; background:var(--rb-line); margin:16px 0 12px }
  .rb-thread-list { display:flex; flex-direction:column; gap:14px; margin:0 }
  .rb-thread-empty { font-size:13px; color:var(--rb-muted) }
  .rb-thread-reply { display:grid; grid-template-columns:auto 1fr; gap:2px 10px; align-items:start }
  .rb-thread-reply .rb-tr-avatar { grid-row:1 / span 2; align-self:start }
  .rb-thread-reply .rb-tr-head { display:flex; align-items:baseline; gap:8px; min-width:0 }
  .rb-thread-reply .rb-tr-name { font-size:13px; font-weight:500; color:var(--rb-ink) }
  .rb-thread-reply .rb-tr-time { font-size:12px; color:var(--rb-muted); margin-left:auto }
  .rb-thread-reply .rb-tr-text { font-size:14px; line-height:1.45; color:var(--rb-ink);
                   word-break:break-word }
  /* reply input — a 2-row textarea + Send; inline error surfaces under the input on failure. */
  .rb-reply-input { margin-top:16px }
  .rb-reply-input textarea { width:100%; min-height:48px; resize:vertical; padding:8px 10px;
                   background:var(--rb-card); color:var(--rb-ink); border:1px solid var(--rb-line);
                   border-radius:var(--rb-rs); font:inherit; font-size:14px }
  .rb-reply-input textarea::placeholder { color:var(--rb-muted) }
  .rb-reply-input textarea:focus-visible, .rb-reply-input textarea:focus {
                   outline:2px solid var(--rb-primary); outline-offset:1px; border-color:var(--rb-primary) }
  .rb-reply-row { display:flex; align-items:center; gap:8px; margin-top:8px }
  .rb-reply-row .rb-reply-error { flex:1; font-size:12px; color:var(--pin-fix) }
  .rb-reply-send { display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 14px;
                   border:1px solid var(--rb-primary); border-radius:var(--rb-rs);
                   background:var(--rb-primary); color:var(--rb-primary-fg);
                   font:inherit; font-size:13px; font-weight:600; cursor:pointer;
                   transition:filter .15s var(--rb-ease) }
  .rb-reply-send:hover { filter:brightness(.92) }
  .rb-reply-send:focus-visible { outline:2px solid var(--rb-primary); outline-offset:2px }
  .rb-reply-send:disabled { opacity:.55; cursor:default }
  /* detail footer — Resolve (ghost → primary fill on hover; muted/disabled when resolved)
     + delete (ghost destructive, own items only). */
  .rb-detail-foot { display:flex; align-items:center; gap:8px; padding:12px 16px;
                   border-top:1px solid var(--rb-line); background:var(--rb-card);
                   border-radius:0 0 var(--rb-r) var(--rb-r) }
  .rb-resolve-btn { display:inline-flex; align-items:center; gap:7px; height:36px; padding:0 16px;
                   border:1px solid var(--rb-primary); border-radius:var(--rb-rs);
                   background:var(--rb-card); color:var(--rb-primary);
                   font:inherit; font-size:13px; font-weight:600; cursor:pointer;
                   transition:background .15s var(--rb-ease), color .15s var(--rb-ease) }
  .rb-resolve-btn:hover { background:var(--rb-primary); color:var(--rb-primary-fg) }
  .rb-resolve-btn:focus-visible { outline:2px solid var(--rb-primary); outline-offset:2px }
  .rb-resolve-btn:disabled, .rb-resolve-btn[aria-disabled="true"] {
                   border-color:var(--rb-line); background:var(--rb-card); color:var(--rb-muted);
                   cursor:default }
  .rb-resolve-btn:disabled:hover, .rb-resolve-btn[aria-disabled="true"]:hover {
                   background:var(--rb-card); color:var(--rb-muted) }
  .rb-delete-btn { display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 12px;
                   margin-left:auto; border:1px solid var(--rb-line); border-radius:var(--rb-rs);
                   background:var(--rb-card); color:var(--pin-fix);
                   font:inherit; font-size:13px; font-weight:500; cursor:pointer;
                   transition:background .15s var(--rb-ease), border-color .15s var(--rb-ease) }
  .rb-delete-btn:hover { background:var(--pin-fix-tint); border-color:var(--pin-fix) }
  .rb-delete-btn:focus-visible { outline:2px solid var(--pin-fix); outline-offset:2px }
  .rb-delete-btn[hidden] { display:none }

  /* all-resolved empty state stub (fully designed in T-011) */
  .rb-rail-all-resolved { color:var(--rb-muted); font-size:13px; line-height:1.5;
                   padding:24px 12px; text-align:center }
  .rb-rail-all-resolved .rb-ar-mark { display:inline-flex; align-items:center; justify-content:center;
                   width:40px; height:40px; border-radius:50%; margin-bottom:10px;
                   background:var(--pin-improve-tint); color:var(--rb-primary) }

  /* container-query reflow (design-spec §3): ≤1023 the rail moves below the stage. */
  @container rb-screen (max-width: 1023px) { .rb-feedback-rail { position:static; width:100% } }
</style>
</head>
<body>
<div class="app">
<header class="top">
  <span class="dot"></span>
  <h1>${title.replace(/</g, '&lt;')}</h1>
  <span class="chip">${mode}</span>
  <span class="spacer"></span>
  <div class="seg" id="modeSeg" title="press P to toggle">
    <button id="m-interact">Interact</button>
    <button id="m-pin">Pin</button>
  </div>
  <span class="hint" id="modeHint"></span>
  <!-- SPEC-017 T-005.5: Show/Hide pins toggle (design-spec §4) — role=switch, keyboard
       operable (Space/Enter); aria-checked mirrors visibility. The eye / eye-off icon is
       an inline outline SVG (never emoji). Hidden until the overlay is wired on load. -->
  <button class="rb-toggle-switch" id="rbPinsToggle" type="button" role="switch" aria-checked="true"
          title="show or hide all pins (Space / Enter)" hidden>
    <span class="rb-toggle-icon" id="rbToggleIcon" aria-hidden="true"></span>
    <span class="rb-toggle-track"><span class="rb-toggle-thumb"></span></span>
    <span class="rb-toggle-label" id="rbToggleLabel">Pins</span>
  </button>
  <!-- SPEC-017 T-004.2: authors-seen cluster — one stacked avatar per reviewer in the
       durable record, driven by GET /api/feedback's authors[] roster on initial load. -->
  <div class="rb-seen" id="rbSeen" title="reviewers who contributed to this board" hidden></div>
  <button class="rb-id-chip" id="rbIdChip" type="button" title="edit your reviewer identity" hidden>
    <span id="rbIdChipAvatar"></span>
    <span class="rb-id-name" id="rbIdChipName"></span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
  </button>
  <div class="exportwrap">
    <button class="iconbtn" id="btnExport" title="export PNG / HTML" aria-haspopup="true">⤓</button>
    <div class="menu" id="exportMenu" hidden></div>
  </div>
  <button class="iconbtn" id="tgL" title="toggle variants panel ( [ )">⟨</button>
  <button class="iconbtn" id="tgR" title="toggle inspector ( ] )">⟩</button>
</header>
<div class="banner" id="banner"><span class="badge" id="bannerBadge">✓</span><span id="bannerText"></span></div>

<div class="main">
  <nav class="rail left" id="railL">
    <div class="sect">
      <h2>Variants</h2>
      <div id="vlist"></div>
    </div>
    <div class="sect" id="versSect" hidden>
      <h2>Versions <span class="hint" style="text-transform:none;letter-spacing:0">· pick two to A/B</span></h2>
      <div id="vers"></div>
    </div>
  </nav>

  <section class="stage" id="stage">
    <div class="stagein" id="stagein"></div>
    <!-- SPEC-017 T-005.6: floating hidden-pins bar (s-hidden, §9) — shown only when the
         overlay is toggled off. "Show pins" is keyboard-operable and toggles the overlay on. -->
    <div class="rb-pins-hidden-bar" id="rbPinsHiddenBar">
      <span class="rb-hidden-count" id="rbHiddenCount">0 pins hidden</span>
      <button class="rb-show-pins" id="rbShowPins" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        Show pins
      </button>
    </div>
    <!-- SPEC-017 T-007.5: pin detail card (s-thread, §9) — scrim-less overlay anchored to
         the stage, caps at 600px with a scrollable body. Author row + intent badge + comment
         + reply thread + reply input + Resolve, with a close + own-item delete affordance. -->
    <div class="rb-detail-card" id="rbDetailCard" role="dialog" aria-modal="false" aria-labelledby="rbDetailName" hidden>
      <div class="rb-detail-head">
        <span id="rbDetailAvatar" aria-hidden="true"></span>
        <div class="rb-dh-meta">
          <div class="rb-dh-name" id="rbDetailName"></div>
          <div class="rb-dh-time"><span id="rbDetailNum" class="rb-dh-num"></span> · <span id="rbDetailTime"></span></div>
        </div>
        <button class="rb-detail-close" id="rbDetailClose" type="button" title="close" aria-label="close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="rb-detail-body">
        <div class="rb-detail-intent" id="rbDetailIntent"></div>
        <div class="rb-detail-comment" id="rbDetailComment"></div>
        <div class="rb-detail-sep"></div>
        <div class="rb-thread-list" id="rbThreadList"></div>
        <div class="rb-reply-input">
          <textarea id="rbReplyText" rows="2" placeholder="Reply to this pin…" aria-label="reply"></textarea>
          <div class="rb-reply-row">
            <span class="rb-reply-error" id="rbReplyError" role="alert"></span>
            <button class="rb-reply-send" id="rbReplySend" type="button">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
              Send
            </button>
          </div>
        </div>
      </div>
      <div class="rb-detail-foot">
        <button class="rb-resolve-btn" id="rbResolveBtn" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          <span id="rbResolveLabel">Resolve</span>
        </button>
        <button class="rb-delete-btn" id="rbDeleteBtn" type="button" hidden>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          Delete
        </button>
      </div>
    </div>
    <div class="stagebar" id="stagebar" hidden>
      <div class="inner">
        <button id="pgPrev" aria-label="previous">‹</button>
        <b id="pgLabel"></b>
        <button id="pgNext" aria-label="next">›</button>
      </div>
    </div>
  </section>

  <aside class="rail right" id="railR">
    <div class="insp">
      <div class="sect">
        <h2>Rate <span id="selName" style="text-transform:none;letter-spacing:0;color:var(--primary)"></span></h2>
        <div class="stars" id="stars"></div>
        <div class="fieldlbl">Notes</div>
        <textarea id="notes" placeholder="What works, what doesn't…"></textarea>
        <div id="moreWrap" style="margin-top:8px"></div>
      </div>
      <div class="sect">
        <h2>Pins <span id="pinCount" style="text-transform:none;letter-spacing:0"></span></h2>
        <div id="pinlist"><div class="empty">Switch to <b>Pin</b> and click the design — drag to mark a region.</div></div>
      </div>
      <div class="sect">
        <h2>Next round</h2>
        <div class="fieldlbl">Overall direction</div>
        <textarea id="overall" placeholder="What should the next round do?"></textarea>
        <div class="fieldlbl" id="remixLbl">Remix</div>
        <div class="inline" id="remixRow">
          layout <select id="remixLayout"></select>
          colors <select id="remixColors"></select>
        </div>
        <input type="text" id="remixNote" placeholder="remix note (optional)" style="margin-top:6px" />
        <div class="inline" style="margin-top:10px">
          <button class="btn" id="iterateBtn">Regenerate</button>
          <button class="btn" id="remixBtn">Remix</button>
          <span class="hint">sends feedback-pending.json</span>
        </div>
      </div>
    </div>
    <div class="dock">
      <div id="approveForm">
        <div class="inline">We'll run with <select id="approveSel"></select></div>
        <button class="btn primary block" id="submitBtn">Approve &amp; submit feedback</button>
        <div class="hint" style="margin-top:6px">writes feedback.json — then return to your coding agent</div>
      </div>
      <div class="receipt" id="receipt">
        <span class="check">✓</span>
        <div><b>Feedback submitted</b> <span id="receiptMeta" class="meta"></span><br>
        <span class="meta">return to your coding agent and tell it you're done</span></div>
      </div>
    </div>
  </aside>

  <!-- SPEC-017 T-007: feedback rail / inbox (s-inbox, §9) — the persistent right rail.
       Header (title + open count + resolved chip), filter bar, grouped item list. The
       rail is hidden until the durable overlay is loaded so an empty board never shows
       a stray empty rail before the first GET resolves. -->
  <aside class="rb-feedback-rail" id="rbFeedbackRail" hidden>
    <header class="rb-rail-header">
      <span class="rb-rail-title">Feedback</span>
      <span class="rb-rail-count" id="rbRailOpenCount" title="open items">0</span>
      <span class="rb-rail-resolved-chip" id="rbRailResolvedChip" title="resolved items">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
        <span id="rbRailResolvedCount">0</span>
      </span>
    </header>
    <div class="rb-filter-bar" id="rbFilterBar" role="toolbar" aria-label="filter feedback"></div>
    <div class="rb-rail-list" id="rbRailList"></div>
  </aside>
</div>
</div>

<!-- SPEC-017: identity modal (s-identity) — name → deterministic avatar before first contribution -->
<div class="rb-identity-modal" id="rbIdentityModal" role="dialog" aria-modal="true" aria-labelledby="rbIdentityTitle" hidden>
  <div class="rb-scrim" id="rbIdentityScrim"></div>
  <div class="rb-card">
    <h2 id="rbIdentityTitle">Who's reviewing?</h2>
    <p class="rb-sub">Your name labels every pin and reply you add — a local display name only, no account.</p>
    <div class="rb-identity-preview">
      <span id="rbIdentityPreviewAvatar"></span>
      <span class="rb-pv-text muted" id="rbIdentityPreviewName">Your avatar</span>
    </div>
    <label for="rbNameInput">Display name</label>
    <input type="text" class="rb-name" id="rbNameInput" placeholder="e.g. Alice Chen" autocomplete="name"
           maxlength="40" aria-describedby="rbIdentityTitle" />
    <div class="rb-identity-actions">
      <button type="button" class="rb-btn rb-ghost" id="rbIdentitySkip">Skip</button>
      <button type="button" class="rb-btn rb-primary" id="rbIdentityStart" disabled>Start reviewing</button>
    </div>
  </div>
</div>

<script>
var CFG = /* GENERATOR:config */ ${embedJson(cfg)};
(function () {
  'use strict';
  var hasHtml = CFG.variants.some(function (v) { return v.type === 'html'; });
  var state = { ratings:{}, comments:{}, pins:[], sel:0, railSel:[], lastReloadGen:null,
                pinMode: !hasHtml, diff:null,
                // SPEC-017 T-005: the durable, attributed pins loaded from GET /api/feedback
                // (separate from state.pins, the reviewer's in-session drafts). pinsVisible drives
                // the Show/Hide overlay toggle, restored from sessionStorage on load.
                loadedPins: [], pinsVisible: true };
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function cur() { return CFG.variants[state.sel]; }

  // ── SPEC-017: reviewer identity + deterministic avatars (design-spec §1/§4) ──
  // Identity is a LOCAL display name only (no auth/PII), persisted in
  // localStorage['rb-identity']. The avatar colour is a deterministic djb2 hash
  // of the name into an 8-hue jewel palette, so the same name always renders the
  // same avatar across pins, rail items and replies (attribution on every item).
  var AVATAR_PALETTE = ['#4f46e5', '#0e7490', '#7c3aed', '#0f766e', '#be185d', '#2563eb', '#a16207', '#475569'];
  var IDENTITY_KEY = 'rb-identity';
  var IDENTITY_SKIP = '\\u0000skip'; // sentinel: skipped — not re-prompted until edited

  // djb2 hash → modulo 8 → jewel hue + 1–2 letter initials + white foreground. Pure.
  function computeAvatar(name) {
    var s = (name == null ? '' : String(name)).trim();
    var h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; }
    var color = AVATAR_PALETTE[h % AVATAR_PALETTE.length];
    var words = s.split(/\\s+/).filter(Boolean);
    var initials;
    if (words.length >= 2) initials = (words[0][0] + words[1][0]);
    else if (words.length === 1) initials = words[0].slice(0, 2);
    else initials = '?';
    return { initials: initials.toUpperCase(), color: color, foreground: '#ffffff' };
  }

  function readStored() {
    try { return window.localStorage.getItem(IDENTITY_KEY); } catch (e) { return state._identityMem || null; }
  }
  function writeStored(value) {
    try { window.localStorage.setItem(IDENTITY_KEY, value); } catch (e) { state._identityMem = value; }
  }

  // getIdentity(): the saved reviewer name, or null when none is set yet.
  // A stored "skip" sentinel also returns null (no identity) but suppresses the
  // auto-prompt — checked separately via identityResolved().
  function getIdentity() {
    var v = readStored();
    if (v == null || v === '' || v === IDENTITY_SKIP) return null;
    return v;
  }
  // True once the reviewer has either named themselves OR explicitly skipped.
  function identityResolved() { return readStored() != null && readStored() !== ''; }
  // setIdentity('Skip') stores the sentinel; any other value stores the trimmed name.
  function setIdentity(name) {
    if (name === 'Skip') { writeStored(IDENTITY_SKIP); return null; }
    var clean = (name == null ? '' : String(name)).trim();
    if (!clean) { writeStored(IDENTITY_SKIP); return null; }
    writeStored(clean);
    return clean;
  }

  // renderAvatar({ initials, color }, size) → a <span class="rb-avatar rb-avatar--{size}">
  function renderAvatar(identity, size) {
    var a = (identity && identity.initials) ? identity : computeAvatar(identity && identity.name ? identity.name : identity);
    var span = el('span', 'rb-avatar rb-avatar--' + (size || 'base'), a.initials);
    span.style.background = a.color;
    span.style.color = a.foreground || '#ffffff';
    span.setAttribute('aria-hidden', 'true');
    return span;
  }
  function avatarFor(name, size) { return renderAvatar(computeAvatar(name), size); }

  // ── SPEC-017 T-006: client-side stable item id (mirrors feedback.mjs generateStableId) ──
  // The same 12-char sha256 hex prefix of (author + newline + createdAt + newline + comment)
  // the daemon's normalizeLegacy assigns server-side — computed here so a dropped pin keys consistently
  // for optimistic render + idempotent re-submit, with no server round-trip needed first.
  // crypto.subtle.digest is async; a synchronous djb2 fallback keeps the flow working when
  // SubtleCrypto is unavailable (e.g. an insecure-context shim) — the daemon re-derives the
  // canonical id on merge either way, so attribution + de-dup never depend on this fallback.
  function fallbackStableId(seed) {
    var h1 = 5381, h2 = 52711;
    for (var i = 0; i < seed.length; i++) {
      var c = seed.charCodeAt(i);
      h1 = ((h1 << 5) + h1 + c) >>> 0;
      h2 = ((h2 << 5) + h2 + c) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('0000' + (h2 & 0xffff).toString(16)).slice(-4);
  }
  function generateStableId(item) {
    var it = item || {};
    var seed = (it.author == null ? '' : String(it.author)) + '\\n' +
               (it.createdAt == null ? '' : String(it.createdAt)) + '\\n' +
               (it.comment == null ? '' : String(it.comment));
    var subtle = (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null;
    if (!subtle || typeof TextEncoder === 'undefined') {
      return Promise.resolve(fallbackStableId(seed));
    }
    try {
      return subtle.digest('SHA-256', new TextEncoder().encode(seed)).then(function (buf) {
        var bytes = new Uint8Array(buf), hex = '';
        for (var i = 0; i < 6; i++) hex += ('0' + bytes[i].toString(16)).slice(-2);
        return hex; // first 6 bytes → 12 hex chars
      }).catch(function () { return fallbackStableId(seed); });
    } catch (e) { return Promise.resolve(fallbackStableId(seed)); }
  }

  // ── identity modal wiring ──────────────────────────────────────────────
  var idModal = document.getElementById('rbIdentityModal');
  var idInput = document.getElementById('rbNameInput');
  var idStart = document.getElementById('rbIdentityStart');
  var idSkip = document.getElementById('rbIdentitySkip');
  var idScrim = document.getElementById('rbIdentityScrim');
  var idPvAvatar = document.getElementById('rbIdentityPreviewAvatar');
  var idPvName = document.getElementById('rbIdentityPreviewName');
  var idChip = document.getElementById('rbIdChip');
  var idChipAvatar = document.getElementById('rbIdChipAvatar');
  var idChipName = document.getElementById('rbIdChipName');
  var afterIdentity = null; // queued action to run once identity is set

  function setNode(parent, node) { parent.innerHTML = ''; parent.appendChild(node); }

  function refreshPreview() {
    var name = idInput.value.trim();
    if (name) {
      setNode(idPvAvatar, avatarFor(name, 'lg'));
      idPvName.textContent = name;
      idPvName.classList.remove('muted');
      idStart.disabled = false;
    } else {
      idPvAvatar.innerHTML = '';
      var ph = el('span', 'rb-avatar rb-avatar--lg', '?');
      ph.style.background = 'var(--rb-stage)'; ph.style.color = 'var(--rb-muted)';
      idPvAvatar.appendChild(ph);
      idPvName.textContent = 'Your avatar';
      idPvName.classList.add('muted');
      idStart.disabled = true;
    }
  }
  function openIdentityModal() {
    var current = getIdentity();
    idInput.value = current || '';
    refreshPreview();
    idModal.hidden = false;
    idModal.classList.add('open');
    setTimeout(function () { idInput.focus(); }, 0);
  }
  function closeIdentityModal() {
    idModal.classList.remove('open');
    idModal.hidden = true;
    var queued = afterIdentity; afterIdentity = null;
    refreshIdentityChip();
    if (queued) queued();
  }
  function refreshIdentityChip() {
    var name = getIdentity();
    if (name) {
      idChip.hidden = false;
      setNode(idChipAvatar, avatarFor(name, 'sm'));
      idChipName.textContent = name;
      idChip.title = 'Reviewing as ' + name + ' — click to edit';
    } else {
      // resolved-but-skipped (or unset): still offer a way to set a name later
      idChip.hidden = false;
      idChipAvatar.innerHTML = '';
      idChipName.textContent = 'Add your name';
      idChip.title = 'Add your reviewer identity';
    }
  }

  idInput.oninput = refreshPreview;
  idInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !idStart.disabled) { e.preventDefault(); idStart.click(); }
  });
  idStart.onclick = function () {
    var saved = setIdentity(idInput.value);
    if (!saved) { idInput.focus(); return; }
    closeIdentityModal();
  };
  idSkip.onclick = function () { setIdentity('Skip'); closeIdentityModal(); };
  idScrim.onclick = function () {
    // dismissing the scrim counts as skip ONLY when no identity exists yet
    if (!identityResolved()) setIdentity('Skip');
    closeIdentityModal();
  };
  idModal.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!identityResolved()) setIdentity('Skip'); closeIdentityModal(); }
  });
  idChip.onclick = function () { openIdentityModal(); };

  // Identity gate: run the action immediately if the reviewer has already
  // resolved their identity; otherwise open the modal and run it once they do.
  function withIdentity(action) {
    if (identityResolved()) { action(); return; }
    afterIdentity = action;
    openIdentityModal();
  }

  refreshIdentityChip();

  // ── mode (Interact ↔ Pin) ─────────────────────────────────────────────
  var segI = document.getElementById('m-interact');
  var segP = document.getElementById('m-pin');
  function applyMode() {
    segI.classList.toggle('on', !state.pinMode);
    segP.classList.toggle('on', state.pinMode);
    var layer = document.querySelector('.pinlayer');
    if (layer) layer.classList.toggle('pass', !state.pinMode);
    document.getElementById('modeHint').textContent = state.pinMode
      ? 'click to pin · drag to mark a region'
      : (cur() && cur().type === 'html' ? 'pan / zoom freely — Pin to annotate' : '');
  }
  segI.onclick = function () { state.pinMode = false; applyMode(); };
  segP.onclick = function () { state.pinMode = true; applyMode(); };

  // ── rails toggle ──────────────────────────────────────────────────────
  function toggleRail(which) {
    var r = document.getElementById(which === 'L' ? 'railL' : 'railR');
    var b = document.getElementById(which === 'L' ? 'tgL' : 'tgR');
    r.classList.toggle('closed');
    b.classList.toggle('off', r.classList.contains('closed'));
  }
  document.getElementById('tgL').onclick = function () { toggleRail('L'); };
  document.getElementById('tgR').onclick = function () { toggleRail('R'); };

  document.addEventListener('keydown', function (e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    var k = e.key.toLowerCase();
    if (k === 'p') { state.pinMode = !state.pinMode; applyMode(); }
    if (k === '[') toggleRail('L');
    if (k === ']') toggleRail('R');
    if (e.key === 'ArrowLeft' && CFG.variants.length > 1) select(state.sel - 1);
    if (e.key === 'ArrowRight' && CFG.variants.length > 1) select(state.sel + 1);
  });

  // ── export (PNG reference image / HTML handoff) ───────────────────────
  // Self-contained rasteriser, the same pipeline the canvas uses: clone the
  // node with computed styles + @font-face + <img> urls inlined, wrap in
  // foreignObject→canvas (≤3×) for PNG. Everything derives from the node's OWN
  // document, so it operates on an element inside the same-origin artifact
  // iframe. PNG is a REFERENCE image; the HTML (+ design-spec.md) is the real
  // design→implementation handoff — the menu copy says so.
  function domExport(node, w, h, name, kind) {
    var doc = node.ownerDocument, win = doc.defaultView || window;
    var ready = (doc.fonts && doc.fonts.ready) ? doc.fonts.ready.catch(function () {}) : Promise.resolve();
    var toDataURL = function (url) {
      return fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
        return new Promise(function (res) {
          var fr = new FileReader();
          fr.onload = function () { res(fr.result); };
          fr.onerror = function () { res(url); };
          fr.readAsDataURL(b);
        });
      }).catch(function () { return url; });
    };
    var save = function (blob, ext) {
      if (!blob) return;
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name + '.' + ext; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    return ready.then(function () {
      var fontRules = [], pending = [], seen = {};
      var scrapeCss = function (href) {
        if (seen[href]) return; seen[href] = 1;
        pending.push(fetch(href).then(function (r) { return r.text(); }).then(function (css) {
          (css.match(/@font-face\\s*{[^}]*}/g) || []).forEach(function (m) { fontRules.push({ css: m, base: href }); });
        }).catch(function () {}));
      };
      var sheets = doc.styleSheets;
      for (var i = 0; i < sheets.length; i++) {
        var ss = sheets[i], base = ss.href || doc.baseURI;
        try {
          var rules = ss.cssRules;
          for (var j = 0; j < rules.length; j++) if (rules[j].type === 5) fontRules.push({ css: rules[j].cssText, base: base });
        } catch (e) { if (ss.href) scrapeCss(ss.href); }
      }
      return Promise.all(pending).then(function () {
        return Promise.all(fontRules.map(function (rule) {
          var out = rule.css, m, re = /url\\((['"]?)([^'")]+)\\1\\)/g, urls = [];
          while ((m = re.exec(rule.css))) { if (m[2].indexOf('data:') !== 0) urls.push(m); }
          var chain = Promise.resolve();
          urls.forEach(function (mm) {
            chain = chain.then(function () {
              var abs; try { abs = new URL(mm[2], rule.base).href; } catch (e) { return; }
              return toDataURL(abs).then(function (d) { out = out.split(mm[0]).join('url("' + d + '")'); });
            });
          });
          return chain.then(function () { return out; });
        }));
      }).then(function (fontList) {
        var fontCss = fontList.join('\\n');
        var cloneStyled = function (src) {
          if (src.nodeType === 8 || (src.nodeType === 1 && src.tagName === 'SCRIPT')) return doc.createTextNode('');
          var dst = src.cloneNode(false);
          if (src.nodeType === 1) {
            var cs = win.getComputedStyle(src), txt = '';
            for (var i = 0; i < cs.length; i++) txt += cs[i] + ':' + cs.getPropertyValue(cs[i]) + ';';
            dst.setAttribute('style', txt + 'animation:none;transition:none;');
            if (src.tagName === 'CANVAS') { try { var im = doc.createElement('img'); im.src = src.toDataURL(); im.setAttribute('style', txt); return im; } catch (e) {} }
          }
          for (var c = src.firstChild; c; c = c.nextSibling) dst.appendChild(cloneStyled(c));
          return dst;
        };
        var clone = cloneStyled(node);
        clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        clone.style.boxShadow = 'none'; clone.style.borderRadius = '0';
        var jobs = [];
        clone.querySelectorAll('img').forEach(function (im) {
          var s = im.getAttribute('src');
          if (s && s.indexOf('data:') !== 0) {
            try { var abs = new URL(s, doc.baseURI).href; jobs.push(toDataURL(abs).then(function (d) { im.setAttribute('src', d); })); } catch (e) {}
          }
        });
        return Promise.all(jobs).then(function () {
          var xml = new XMLSerializer().serializeToString(clone);
          if (kind === 'html') {
            var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + name + '</title>' +
              (fontCss ? '<style>' + fontCss + '</style>' : '') + '</head><body style="margin:0">' + xml + '</body></html>';
            return save(new Blob([html], { type: 'text/html' }), 'html');
          }
          var px = Math.max(1, Math.min(3, Math.floor(11000 / Math.max(w, h)) || 1));
          var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (w * px) + '" height="' + (h * px) +
            '" viewBox="0 0 ' + w + ' ' + h + '"><foreignObject width="' + w + '" height="' + h + '">' +
            (fontCss ? '<style><![CDATA[' + fontCss + ']]></style>' : '') + xml + '</foreignObject></svg>';
          var img = new Image();
          return new Promise(function (res, rej) {
            img.onload = res; img.onerror = function () { rej(new Error('render failed')); };
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          }).then(function () {
            var cv = document.createElement('canvas'); cv.width = w * px; cv.height = h * px;
            cv.getContext('2d').drawImage(img, 0, 0);
            cv.toBlob(function (blob) { save(blob, 'png'); }, 'image/png');
          });
        });
      });
    });
  }

  function exportName(suffix) {
    var v = cur();
    var base = (CFG.boardId || 'design') + (v && v.id && v.id !== 'artifact' ? '-' + v.id : '');
    return (base + (suffix ? '-' + suffix : '')).replace(/[^\\w.-]+/g, '_');
  }
  function currentScreenEl() {
    var m = state.media;
    if (!m || m.tagName !== 'IFRAME') return null;
    try {
      var doc = m.contentDocument;
      var node = doc.elementFromPoint(m.clientWidth / 2, m.clientHeight / 2);
      while (node && node !== doc.documentElement) {
        if ((node.dataset && (node.dataset.dcSlot || node.dataset.screen)) || (node.tagName === 'SECTION' && node.id)) return node;
        node = node.parentElement;
      }
      return doc.body;
    } catch (e) { return null; }
  }
  function downloadSrc(src, name) {
    var a = document.createElement('a'); a.href = src; a.download = name; a.click();
  }
  function toast(text) {
    banner('ok', text);
    setTimeout(function () { document.getElementById('banner').classList.remove('show'); }, 2800);
  }
  function exportRun(target) {
    closeMenu();
    var v = cur();
    if (target === 'html-file') { downloadSrc(v.src, exportName('') + '.html'); return; }
    if (target === 'src') { downloadSrc(v.src, exportName('') + (/\\.svg(\\?|$)/.test(v.src) ? '.svg' : '.png')); return; }
    var node, w, h, label;
    if (target === 'screen') {
      node = currentScreenEl();
      if (!node) { toast('No screen under the viewport to export.'); return; }
      w = node.offsetWidth || node.scrollWidth; h = node.offsetHeight || node.scrollHeight;
      label = (node.dataset && (node.dataset.dcSlot || node.dataset.screen)) || node.id || 'screen';
    } else {
      if (!state.media || state.media.tagName !== 'IFRAME') { toast('Nothing to rasterise.'); return; }
      var d = state.media.contentDocument;
      node = d.body;
      w = Math.max(d.documentElement.scrollWidth, d.body.scrollWidth);
      h = Math.max(d.documentElement.scrollHeight, d.body.scrollHeight);
      label = 'full';
    }
    toast('Rendering PNG…');
    domExport(node, w, h, exportName(label), 'png')
      .then(function () { toast('PNG downloaded — reference image (HTML + design-spec.md is the real handoff).'); })
      .catch(function (e) { toast('Export failed: ' + (e && e.message ? e.message : e)); });
  }

  var exportMenu = document.getElementById('exportMenu');
  function closeMenu() { exportMenu.hidden = true; }
  function buildMenu() {
    var v = cur();
    exportMenu.innerHTML = '';
    var add = function (label, fn) { var b = el('button', '', label); b.onclick = fn; exportMenu.appendChild(b); };
    if (v.type === 'html') {
      add('PNG — current screen', function () { exportRun('screen'); });
      add('PNG — full design', function () { exportRun('full'); });
      exportMenu.appendChild(el('div', 'sep'));
      add('HTML — download artifact', function () { exportRun('html-file'); });
      exportMenu.appendChild(el('div', 'mhint', 'PNG is a reference image. The HTML (+ design-spec.md) is the real design→build handoff.'));
    } else {
      add('Download ' + (/\\.svg(\\?|$)/.test(v.src) ? 'SVG' : 'PNG'), function () { exportRun('src'); });
      exportMenu.appendChild(el('div', 'mhint', 'Reference image for sharing.'));
    }
  }
  document.getElementById('btnExport').onclick = function (e) {
    e.stopPropagation();
    if (exportMenu.hidden) { buildMenu(); exportMenu.hidden = false; } else closeMenu();
  };
  document.addEventListener('click', function () { closeMenu(); });

  // ── left rail: variants ───────────────────────────────────────────────
  var vlist = document.getElementById('vlist');
  CFG.variants.forEach(function (v, i) {
    var it = el('div', 'vitem');
    it.dataset.variant = v.id;
    var tb = v.type === 'image' ? '<img src="' + v.src + '" alt="">'
           : v.type === 'svg' ? '<object type="image/svg+xml" data="' + v.src + '"></object>'
           : '◈';
    it.innerHTML = '<span class="thumb">' + tb + '</span>' +
      '<span class="nm"><b>' + (v.id === 'artifact' ? 'Artifact' : v.id) + '</b><span>' + (v.label || '') + '</span></span>' +
      '<span class="st"></span>';
    it.onclick = function () { select(i); };
    vlist.appendChild(it);
  });

  function select(i) {
    state.sel = (i + CFG.variants.length) % CFG.variants.length;
    state.diff = null;
    document.querySelectorAll('.vitem').forEach(function (x, j) { x.classList.toggle('on', j === state.sel); });
    document.querySelectorAll('.verthumb').forEach(function (x) { x.classList.remove('sel'); });
    state.railSel = [];
    renderStage();
    renderInspector();
  }

  // ── stage ─────────────────────────────────────────────────────────────
  var stagein = document.getElementById('stagein');
  function renderStage() {
    var v = cur();
    stagein.innerHTML = '';
    state.media = null;
    stagein.className = 'stagein' + (v.type === 'html' ? ' fillwrap' : '');

    if (state.diff) {
      // HTML/canvas artifacts aren't images — an image clip-slider would render
      // them as broken <img>. Compare them as two live iframes side by side.
      if (v.type === 'html') {
        var ab = el('div', 'diffab');
        ab.innerHTML = '<div class="abcol"><span class="ablab">A</span><iframe src="' + state.diff[0] + '"></iframe></div>' +
          '<div class="abcol"><span class="ablab">B</span><iframe src="' + state.diff[1] + '"></iframe></div>';
        stagein.appendChild(ab);
        updatePager('A / B compare');
        return;
      }
      var d = el('div', 'frame');
      d.style.maxWidth = '920px';
      d.innerHTML = '<div class="diffwrap"><img src="' + state.diff[0] + '" alt="base">' +
        '<div class="topimg"><img src="' + state.diff[1] + '" alt="compare"></div>' +
        '<input type="range" min="0" max="100" value="50"></div>';
      stagein.appendChild(d);
      d.querySelector('input').oninput = function () {
        d.querySelector('.topimg').style.clipPath = 'inset(0 ' + (100 - this.value) + '% 0 0)';
      };
      updatePager('A / B compare');
      return;
    }

    var frame = el('div', 'frame' + (v.type === 'html' ? ' fill' : ''));
    var media;
    if (v.type === 'html') { media = el('iframe'); media.src = v.src; }
    else if (v.type === 'svg') { media = el('object'); media.type = 'image/svg+xml'; media.data = v.src; }
    else { media = el('img'); media.src = v.src; media.alt = v.id; }
    frame.appendChild(media);
    state.media = media;
    var layer = el('div', 'pinlayer');
    frame.appendChild(layer);
    stagein.appendChild(frame);
    attachPinLayer(layer, media, v);
    drawPins(layer, v.id);
    // SPEC-017 T-005.1: paint the durable overlay (stored, attributed pins) for this
    // variant on top of the in-session drafts, then mirror the current Show/Hide state.
    loadAndRenderPins();
    applyOverlayVisibility();
    // anchored pins track the content through pan/zoom/scroll
    if (state.trackTimer) clearInterval(state.trackTimer);
    if (v.type === 'html') {
      state.trackTimer = setInterval(function () {
        positionPins(layer, v.id);
        positionLoadedPins(layer, v.id);
      }, 120);
    }
    applyMode();
    updatePager((v.id === 'artifact' ? 'Artifact' : v.id) + (v.label ? ' · ' + v.label : ''));
  }
  function updatePager(label) {
    var bar = document.getElementById('stagebar');
    if (CFG.variants.length > 1) {
      bar.hidden = false;
      document.getElementById('pgLabel').textContent = label + '  ·  ' + (state.sel + 1) + ' / ' + CFG.variants.length;
    } else bar.hidden = true;
  }
  document.getElementById('pgPrev').onclick = function () { select(state.sel - 1); };
  document.getElementById('pgNext').onclick = function () { select(state.sel + 1); };

  // ── pins ──────────────────────────────────────────────────────────────
  // For iframe artifacts, pins are CONTENT-ANCHORED: coordinates are stored
  // relative to the screen/artboard element under the click (a canvas artboard
  // is [data-dc-slot]; walkthroughs use <section id>/[data-screen]). Those
  // ratios are invariant under pan/zoom/scroll, so the pin means the same spot
  // no matter the viewport state — and markers track the content live.
  // Images/SVGs keep plain layer-relative ratios (the media IS the content).
  function attachPinLayer(layer, media, variant) {
    var down = null;
    layer.addEventListener('mousedown', function (e) {
      if (e.target.closest('.pin') || e.target.closest('.popover')) return;
      var r = layer.getBoundingClientRect();
      down = { x: e.clientX - r.left, y: e.clientY - r.top, anchor: anchorAt(media, e) };
    });
    layer.addEventListener('mouseup', function (e) {
      if (!down) return;
      var r = layer.getBoundingClientRect();
      var up = { x: e.clientX - r.left, y: e.clientY - r.top };
      var box, anchor = down.anchor;
      if (anchor) {
        // anchor-space ratios: the layer box coincides with the iframe viewport,
        // so element rects from the iframe document map 1:1 onto layer coords.
        var ar = anchor.rect;
        box = {
          x: (Math.min(down.x, up.x) - ar.left) / ar.width,
          y: (Math.min(down.y, up.y) - ar.top) / ar.height,
          w: Math.abs(up.x - down.x) / ar.width,
          h: Math.abs(up.y - down.y) / ar.height,
        };
        if (Math.abs(up.x - down.x) < 8 && Math.abs(up.y - down.y) < 8) { box.w = 0; box.h = 0; }
        box.x = Math.min(1, Math.max(0, box.x)); box.y = Math.min(1, Math.max(0, box.y));
      } else {
        box = {
          x: Math.min(down.x, up.x) / r.width,
          y: Math.min(down.y, up.y) / r.height,
          w: Math.abs(up.x - down.x) / r.width,
          h: Math.abs(up.y - down.y) / r.height,
        };
        if (box.w * r.width < 8 && box.h * r.height < 8) { box.w = 0; box.h = 0; }
      }
      down = null;
      // SPEC-017 identity gate: the first pin-drop opens the identity modal if
      // the reviewer hasn't named (or explicitly skipped) yet; the pin's popover
      // opens once identity is resolved so the contribution is attributable.
      withIdentity(function () {
        openPopover(layer, box, variant.id, anchor ? anchor.id : undefined, up);
      });
    });
  }
  // Nearest content anchor under the pointer: canvas artboard [data-dc-slot],
  // then [data-screen], then <section id>. Returns { id, el, rect } or null.
  function anchorAt(media, e) {
    try {
      if (media.tagName !== 'IFRAME') return null;
      var doc = media.contentDocument;
      var ir = media.getBoundingClientRect();
      var node = doc.elementFromPoint(e.clientX - ir.left, e.clientY - ir.top);
      while (node && node !== doc.documentElement) {
        var id = (node.dataset && (node.dataset.dcSlot || node.dataset.screen)) ||
                 (node.tagName === 'SECTION' && node.id ? node.id : null);
        if (id) return { id: id, el: node, rect: node.getBoundingClientRect() };
        node = node.parentElement;
      }
    } catch (err) { /* cross-origin — fall back to layer-relative coords */ }
    return null;
  }
  // Re-find an anchor element by id inside the iframe document.
  function anchorEl(media, id) {
    try {
      var doc = media.contentDocument;
      return doc.querySelector('[data-dc-slot="' + id + '"]') ||
             doc.getElementById(id) ||
             doc.querySelector('[data-screen="' + id + '"]');
    } catch (err) { return null; }
  }
  function openPopover(layer, box, variantId, screen, at) {
    document.querySelectorAll('.popover').forEach(function (p) { p.remove(); });
    var pop = el('div', 'popover');
    var lr = layer.getBoundingClientRect();
    var px = at ? at.x : box.x * lr.width;
    var py = at ? at.y : box.y * lr.height;
    pop.style.left = Math.max(8, Math.min(px, lr.width - 280)) + 'px';
    pop.style.top = Math.max(8, Math.min(py, lr.height - 180)) + 'px';
    if (screen) pop.appendChild(el('div', 'hint', 'screen: ' + screen));
    var ta = el('textarea'); ta.placeholder = 'What should change here?';
    var sel = el('select', '', '<option value="fix">fix</option><option value="improve">improve</option><option value="question">question</option>');
    var row = el('div', 'row');
    var ok = el('button', 'btn primary', 'Pin it');
    var cancel = el('button', 'btn', 'Cancel');
    ok.onclick = function () {
      if (!ta.value.trim()) { ta.focus(); return; }
      var author = getIdentity() || 'Anonymous';
      var createdAt = new Date().toISOString();
      var comment = ta.value.trim();
      var pin = { variant: screen || variantId, x: box.x, y: box.y, w: box.w, h: box.h,
                  comment: comment, intent: sel.value, _v: variantId,
                  author: author, createdAt: createdAt };
      if (screen) pin.screen = screen;
      // SPEC-017 T-006.2: optimistic render first (the marker appears instantly), then
      // PERSIST the drop — construct the fully-attributed item payload with a client-side
      // stable id and POST it to /api/feedback so the pin survives refresh/close/re-serve.
      state.pins.push(pin);
      pop.remove();
      drawPins(layer, variantId);
      renderPinList();
      Promise.resolve(generateStableId({ author: author, createdAt: createdAt, comment: comment }))
        .then(function (id) {
          var item = {
            id: id,
            author: author,
            variant: screen || variantId,
            x: box.x, y: box.y, w: box.w, h: box.h,
            comment: comment,
            intent: sel.value,
            status: 'open',
            createdAt: createdAt,
            replies: [],
          };
          if (screen) item.screen = screen;
          postPin(item, pin);
        });
    };
    cancel.onclick = function () { pop.remove(); };
    row.appendChild(ok); row.appendChild(cancel);
    pop.appendChild(ta); pop.appendChild(sel); pop.appendChild(row);
    layer.appendChild(pop);
    ta.focus();
  }
  function drawPins(layer, variantId) {
    layer.querySelectorAll('.pin,.region').forEach(function (x) { x.remove(); });
    state.pins.forEach(function (pin, idx) {
      if (pin._v !== variantId) return;
      if (pin.w > 0 || pin.h > 0) {
        var reg = el('div', 'region');
        reg.dataset.idx = idx;
        layer.appendChild(reg);
      }
      var marker = el('div', 'pin');
      marker.dataset.idx = idx;
      marker.title = (pin.author ? pin.author + ' · ' : '') + '[' + pin.intent + '] ' + pin.comment;
      marker.appendChild(el('div', 'pd', '<span>' + (idx + 1) + '</span>'));
      // SPEC-017 T-003.7: attribution avatar on the marker (minimal — fully styled in T-005).
      if (pin.author) { var av = avatarFor(pin.author, 'sm'); av.classList.add('rb-pin-avatar'); marker.appendChild(av); }
      layer.appendChild(marker);
    });
    positionPins(layer, variantId);
  }
  // Place markers/regions: anchored pins resolve their element's CURRENT rect
  // (tracks pan/zoom/scroll); plain pins use layer ratios. Runs on a light
  // interval while an iframe artifact is on stage.
  function positionPins(layer, variantId) {
    var media = layer.parentNode ? layer.parentNode.querySelector('iframe,img,object') : null;
    state.pins.forEach(function (pin, idx) {
      if (pin._v !== variantId) return;
      var marker = layer.querySelector('.pin[data-idx="' + idx + '"]');
      var reg = layer.querySelector('.region[data-idx="' + idx + '"]');
      var left, top, w, h, visible = true;
      if (pin.screen && media && media.tagName === 'IFRAME') {
        var a = anchorEl(media, pin.screen);
        if (a) {
          var r = a.getBoundingClientRect(); // iframe viewport coords == layer coords
          left = r.left + pin.x * r.width; top = r.top + pin.y * r.height;
          w = pin.w * r.width; h = pin.h * r.height;
          var lr = layer.getBoundingClientRect();
          visible = left > -40 && top > -40 && left < lr.width + 40 && top < lr.height + 40;
        } else visible = false;
        if (marker) {
          marker.style.left = left + 'px'; marker.style.top = top + 'px';
          marker.style.display = visible ? '' : 'none';
        }
        if (reg) {
          reg.style.left = left + 'px'; reg.style.top = top + 'px';
          reg.style.width = w + 'px'; reg.style.height = h + 'px';
          reg.style.display = visible ? '' : 'none';
        }
      } else {
        if (marker) { marker.style.left = (pin.x * 100) + '%'; marker.style.top = (pin.y * 100) + '%'; }
        if (reg) {
          reg.style.left = (pin.x * 100) + '%'; reg.style.top = (pin.y * 100) + '%';
          reg.style.width = (pin.w * 100) + '%'; reg.style.height = (pin.h * 100) + '%';
        }
      }
    });
  }

  // ── SPEC-017 T-005: persisted pin overlay (design-spec §4 + s-board, §9) ─────
  // The durable, attributed pins loaded from GET /api/feedback render as numbered
  // teardrop markers on the active variant's pin layer: intent → accent, status →
  // ring, with the author avatar tucked at the marker's top-right. These are read-only
  // here (selection/threads land in T-007); each carries data-pin-id for two-way select.
  var INTENT_CLASS = { fix: 'rb-pin-marker--fix', improve: 'rb-pin-marker--improve', question: 'rb-pin-marker--question' };
  var STATUS_CLASS = { addressed: 'rb-pin-marker--addressed', resolved: 'rb-pin-marker--resolved' };

  // A loaded pin belongs to the current variant when its anchor screen is in play
  // (iframe artifact), or — for image/svg variants where the media IS the content —
  // when its variant field matches the variant id (a legacy unattributed pin with neither
  // still shows, so a record from an older board never silently disappears).
  function loadedPinForVariant(pin, variant) {
    if (pin.screen) return variant.type === 'html';
    if (pin.variant != null && pin.variant !== '') {
      return pin.variant === variant.id || pin.variant === variant.label;
    }
    return true;
  }

  // loadAndRenderPins(feedbackRecord?) — clear existing .rb-pin-marker nodes, then for
  // every stored item create a marker positioned at (item.x*w, item.y*h). Called on the
  // initial GET, on every stage render, and whenever the record changes. Passing a record
  // refreshes state.loadedPins; calling it bare re-paints the current overlay.
  function loadAndRenderPins(feedbackRecord) {
    if (feedbackRecord !== undefined) {
      // the durable record uses pins[]; the daemon's empty fallback uses items[] — accept both.
      var items = (feedbackRecord && (feedbackRecord.pins || feedbackRecord.items)) || [];
      state.loadedPins = Array.isArray(items) ? items : [];
      // SPEC-017 T-007: retain the durable record + its authors roster so reply/resolve/delete
      // can construct a valid single-item merge contribution to POST back to the daemon.
      state.loadedRecord = feedbackRecord || null;
      state.loadedAuthors = (feedbackRecord && Array.isArray(feedbackRecord.authors)) ? feedbackRecord.authors : [];
    }
    var layer = document.querySelector('.pinlayer');
    if (!layer) return;
    layer.querySelectorAll('.rb-pin-marker').forEach(function (m) { m.remove(); });
    var v = cur();
    state.loadedPins.forEach(function (pin, idx) {
      if (!loadedPinForVariant(pin, v)) return;
      var marker = el('div', 'rb-pin-marker');
      // intent accent + status ring (open = solid; addressed = dashed; resolved = muted dashed)
      if (INTENT_CLASS[pin.intent]) marker.classList.add(INTENT_CLASS[pin.intent]);
      if (STATUS_CLASS[pin.status]) marker.classList.add(STATUS_CLASS[pin.status]);
      if (pin.id != null) marker.setAttribute('data-pin-id', pin.id); // two-way select (T-007)
      marker.dataset.loadedIdx = idx;
      marker.title = (pin.author ? pin.author + ' · ' : '') +
        '[' + (pin.intent || 'note') + (pin.status && pin.status !== 'open' ? '/' + pin.status : '') + '] ' +
        (pin.comment || '');
      var dot = el('div', 'rb-pin-dot');
      dot.appendChild(el('span', 'rb-pin-number', String(idx + 1)));
      marker.appendChild(dot);
      // T-005.4: author avatar chip (sm) — deterministic colour, offset to the corner.
      if (pin.author) { var av = avatarFor(pin.author, 'sm'); av.classList.add('rb-pin-avatar'); marker.appendChild(av); }
      // SPEC-017 T-007.4: clicking a canvas marker is the canvas→rail half of two-way
      // selection — highlight its rail item + open the detail card (selectRailItem).
      if (pin.id != null) {
        marker.style.cursor = 'pointer';
        (function (pid) { marker.onclick = function (e) { e.stopPropagation(); selectRailItem(pid); }; })(pin.id);
      }
      layer.appendChild(marker);
    });
    positionLoadedPins(layer, v.id);
    refreshHiddenBar();
    // SPEC-017 T-007: keep the rail + open detail card in sync with the durable overlay.
    renderRail();
    syncDetailCard();
  }

  // Position loaded markers: anchored (screen) pins resolve their element's CURRENT
  // rect so they track pan/zoom/scroll; plain pins use layer-relative percentages.
  function positionLoadedPins(layer, variantId) {
    var media = layer.parentNode ? layer.parentNode.querySelector('iframe,img,object') : null;
    var v = cur();
    state.loadedPins.forEach(function (pin, idx) {
      if (!loadedPinForVariant(pin, v)) return;
      var marker = layer.querySelector('.rb-pin-marker[data-loaded-idx="' + idx + '"]');
      if (!marker) return;
      if (pin.screen && media && media.tagName === 'IFRAME') {
        var a = anchorEl(media, pin.screen);
        if (a) {
          var r = a.getBoundingClientRect(); // iframe viewport coords == layer coords
          var left = r.left + pin.x * r.width;
          var top = r.top + pin.y * r.height;
          var lr = layer.getBoundingClientRect();
          var visible = left > -40 && top > -40 && left < lr.width + 40 && top < lr.height + 40;
          marker.style.left = left + 'px'; marker.style.top = top + 'px';
          marker.style.display = visible ? '' : 'none';
        } else { marker.style.display = 'none'; }
      } else {
        marker.style.left = (pin.x * 100) + '%';
        marker.style.top = (pin.y * 100) + '%';
        marker.style.display = '';
      }
    });
  }

  // ── SPEC-017 T-007: feedback rail / inbox + detail card (design-spec §4, s-inbox/s-thread) ──
  // The durable, attributed pins (state.loadedPins) are projected into the right rail as a
  // grouped, filterable list with two-way jump-to-pin selection; clicking an item opens the
  // detail card (author, intent, comment, thread, reply input, resolve, own-item delete).
  // Reply / resolve / delete each POST a single-item merge contribution to /api/feedback — the
  // daemon's non-destructive merge (keyed by id+author, under the per-board mutex) folds it in
  // without touching anyone else's items, and the returned durable record re-paints everything.
  var railList = document.getElementById('rbRailList');
  var filterBar = document.getElementById('rbFilterBar');
  var feedbackRail = document.getElementById('rbFeedbackRail');
  var railOpenCount = document.getElementById('rbRailOpenCount');
  var railResolvedChip = document.getElementById('rbRailResolvedChip');
  var railResolvedCount = document.getElementById('rbRailResolvedCount');
  var INTENT_LABEL = { fix: 'fix', improve: 'improve', question: 'question' };
  var INTENT_BADGE = { fix: 'rb-badge--fix', improve: 'rb-badge--improve', question: 'rb-badge--question' };
  var INTENT_DOT = { fix: 'var(--pin-fix)', improve: 'var(--pin-improve)', question: 'var(--pin-question)' };
  var REPLY_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>';

  // state.filter: the active filter — { kind: 'all' } | { kind:'intent', value } |
  // { kind:'status', value } | { kind:'author', value }. Default: all (nothing narrowed).
  state.filter = state.filter || { kind: 'all' };
  state.selectedPinId = state.selectedPinId || null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'; }); }

  // relativeTime(iso) → a compact "just now / 5m / 3h / 2d / Jun 17" caption.
  function relativeTime(iso) {
    if (!iso) return '';
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    var diff = Date.now() - t;
    if (diff < 0) diff = 0;
    var s = Math.floor(diff / 1000);
    if (s < 45) return 'just now';
    var m = Math.floor(s / 60);
    if (m < 60) return m + 'm';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h';
    var d = Math.floor(h / 24);
    if (d < 7) return d + 'd';
    try {
      return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) { return d + 'd'; }
  }

  function intentBadge(intent) {
    var key = INTENT_BADGE[intent] ? intent : null;
    var b = el('span', 'rb-badge ' + (key ? INTENT_BADGE[key] : 'rb-badge--open'), key ? INTENT_LABEL[key] : (intent || 'note'));
    return b;
  }
  function statusBadge(status) {
    var st = status === 'resolved' ? 'resolved' : 'open';
    return el('span', 'rb-badge rb-badge--' + st, st);
  }

  // The current variant's stored pins, in stored order (so the rail # matches the marker #).
  function railPinsForVariant() {
    var v = cur();
    var out = [];
    (state.loadedPins || []).forEach(function (pin, idx) {
      if (!loadedPinForVariant(pin, v)) return;
      out.push({ pin: pin, num: idx + 1 });
    });
    return out;
  }
  function matchesFilter(pin) {
    var f = state.filter;
    if (!f || f.kind === 'all') return true;
    if (f.kind === 'intent') return pin.intent === f.value;
    if (f.kind === 'status') {
      var st = pin.status === 'resolved' ? 'resolved' : 'open';
      return st === f.value;
    }
    if (f.kind === 'author') return (pin.author || 'Anonymous') === f.value;
    return true;
  }
  function isActiveFilter(kind, value) {
    var f = state.filter;
    if (kind === 'all') return !f || f.kind === 'all';
    return f && f.kind === kind && f.value === value;
  }
  function setFilter(kind, value) {
    state.filter = kind === 'all' ? { kind: 'all' } : { kind: kind, value: value };
    renderRail();
  }

  // ── filter bar (T-007.2): All · fix · improve · question · open · resolved · author chips ──
  function renderFilterBar(rows) {
    filterBar.innerHTML = '';
    var counts = { intent: { fix: 0, improve: 0, question: 0 }, status: { open: 0, resolved: 0 }, author: {} };
    rows.forEach(function (r) {
      var p = r.pin;
      if (counts.intent[p.intent] != null) counts.intent[p.intent]++;
      var st = p.status === 'resolved' ? 'resolved' : 'open';
      counts.status[st]++;
      var au = p.author || 'Anonymous';
      counts.author[au] = (counts.author[au] || 0) + 1;
    });
    var addChip = function (label, kind, value, opts) {
      opts = opts || {};
      var chip = el('button', 'rb-filter-chip' + (isActiveFilter(kind, value) ? ' rb-filter-chip--active' : ''));
      chip.type = 'button';
      if (opts.dot) { var d = el('span', 'rb-chip-dot'); d.style.background = opts.dot; chip.appendChild(d); }
      if (opts.avatar) { var av = avatarFor(value, 'sm'); av.classList.add('rb-fc-avatar'); chip.appendChild(av); }
      chip.appendChild(document.createTextNode(label));
      if (opts.count != null) chip.appendChild(el('span', 'rb-chip-count', String(opts.count)));
      chip.onclick = function () { setFilter(kind, value); };
      filterBar.appendChild(chip);
    };
    addChip('All', 'all', null, { count: rows.length });
    addChip('fix', 'intent', 'fix', { dot: INTENT_DOT.fix, count: counts.intent.fix });
    addChip('improve', 'intent', 'improve', { dot: INTENT_DOT.improve, count: counts.intent.improve });
    addChip('question', 'intent', 'question', { dot: INTENT_DOT.question, count: counts.intent.question });
    addChip('open', 'status', 'open', { count: counts.status.open });
    addChip('resolved', 'status', 'resolved', { count: counts.status.resolved });
    Object.keys(counts.author).sort().forEach(function (name) {
      addChip(name, 'author', name, { avatar: true, count: counts.author[name] });
    });
  }

  // ── rail item list (T-007.1/.3): grouped, filtered items + header counts ──
  function renderRail() {
    if (!railList) return;
    var rows = railPinsForVariant();
    // header counts (open vs resolved) over the WHOLE variant (filter narrows the list, not counts)
    var openN = 0, resolvedN = 0;
    rows.forEach(function (r) { if (r.pin.status === 'resolved') resolvedN++; else openN++; });
    railOpenCount.textContent = String(openN);
    railResolvedCount.textContent = String(resolvedN);
    railResolvedChip.style.display = resolvedN ? '' : 'none';
    railResolvedChip.title = resolvedN + ' resolved';

    renderFilterBar(rows);

    // The rail itself appears once there is durable feedback to manage (or a filter is set).
    feedbackRail.hidden = false;

    var shown = rows.filter(function (r) { return matchesFilter(r.pin); });
    railList.innerHTML = '';

    if (!rows.length) {
      railList.appendChild(el('div', 'rb-rail-empty',
        'No feedback yet. Switch to <b>Pin</b> and click the design to drop the first pin.'));
      return;
    }
    if (rows.length && openN === 0 && (!state.filter || state.filter.kind === 'all')) {
      // all-resolved empty state stub (fully designed in T-011) — still lists resolved items below.
      var ar = el('div', 'rb-rail-all-resolved');
      ar.innerHTML = '<span class="rb-ar-mark"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>' +
        '<div>All feedback resolved.</div>';
      railList.appendChild(ar);
    }
    if (!shown.length) {
      railList.appendChild(el('div', 'rb-rail-empty', 'No items match this filter.'));
      return;
    }
    shown.forEach(function (r) { railList.appendChild(buildRailItem(r.pin, r.num)); });
  }

  function buildRailItem(pin, num) {
    var item = el('div', 'rb-rail-item');
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('data-pin-id', pin.id == null ? '' : pin.id);
    item.setAttribute('data-intent', pin.intent || '');
    item.setAttribute('data-status', pin.status === 'resolved' ? 'resolved' : 'open');
    item.setAttribute('data-author', pin.author || 'Anonymous');
    if (pin.id != null && pin.id === state.selectedPinId) item.classList.add('rb-rail-item--active');

    var av = avatarFor(pin.author || 'Anonymous', 'sm'); av.classList.add('rb-ri-avatar');
    item.appendChild(av);

    var head = el('div', 'rb-ri-head');
    head.appendChild(el('span', 'rb-ri-name', esc(pin.author || 'Anonymous')));
    head.appendChild(el('span', 'rb-ri-num', '#' + num));
    head.appendChild(el('span', 'rb-ri-time', esc(relativeTime(pin.createdAt))));
    item.appendChild(head);

    item.appendChild(el('div', 'rb-ri-comment', esc(pin.comment || '')));

    var badges = el('div', 'rb-ri-badges');
    badges.appendChild(intentBadge(pin.intent));
    badges.appendChild(statusBadge(pin.status));
    var nReplies = (pin.replies && pin.replies.length) || 0;
    if (nReplies) {
      var rc = el('span', 'rb-ri-replies', REPLY_SVG + ' ' + nReplies);
      badges.appendChild(rc);
    }
    item.appendChild(badges);

    var open = function () { if (pin.id != null) selectPin(pin.id); };
    item.onclick = open;
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); open(); }
    });
    return item;
  }

  // findLoadedPin(id) → the stored pin object with this id (current variant or any).
  function findLoadedPin(id) {
    var found = null;
    (state.loadedPins || []).forEach(function (p) { if (p.id != null && p.id === id) found = p; });
    return found;
  }

  // ── two-way selection (T-007.4) ──────────────────────────────────────────
  // selectPin(id): rail→canvas — mark the canvas marker selected, highlight the rail item,
  //   open the detail card. selectRailItem(id): canvas→rail — scroll the rail item into view
  //   + highlight, then open the same detail card. Both routes converge on openDetailCard.
  function highlightMarker(id) {
    document.querySelectorAll('.rb-pin-marker--selected').forEach(function (m) { m.classList.remove('rb-pin-marker--selected'); });
    var marker = document.querySelector('.rb-pin-marker[data-pin-id="' + cssId(id) + '"]');
    if (marker) {
      marker.classList.add('rb-pin-marker--selected');
      try { marker.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch (e) {}
    }
    return marker;
  }
  function highlightRailItem(id, scroll) {
    document.querySelectorAll('.rb-rail-item--active').forEach(function (x) { x.classList.remove('rb-rail-item--active'); });
    var rowEl = railList ? railList.querySelector('.rb-rail-item[data-pin-id="' + cssId(id) + '"]') : null;
    if (rowEl) {
      rowEl.classList.add('rb-rail-item--active');
      if (scroll) { try { rowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
    }
    return rowEl;
  }
  // Escape an id for use inside an attribute selector (ids are 12-char hex, but be safe).
  function cssId(id) { return String(id).replace(/["\\\\]/g, '\\\\$&'); }

  function selectPin(id) {
    state.selectedPinId = id;
    highlightMarker(id);
    highlightRailItem(id, true);
    openDetailCard(id);
  }
  function selectRailItem(id) {
    state.selectedPinId = id;
    // ensure the marker's variant is the active one, then highlight + scroll the rail item.
    var pin = findLoadedPin(id);
    if (pin) {
      var v = cur();
      if (!loadedPinForVariant(pin, v)) {
        // jump to a variant that shows this pin (image/svg variants keyed by id/label)
        var vi = CFG.variants.findIndex(function (vv) { return loadedPinForVariant(pin, vv); });
        if (vi >= 0 && vi !== state.sel) { select(vi); }
      }
    }
    highlightRailItem(id, true);
    highlightMarker(id);
    openDetailCard(id);
  }

  // ── detail card (T-007.5/.6/.7/.8) ───────────────────────────────────────
  var detailCard = document.getElementById('rbDetailCard');
  var detailAvatar = document.getElementById('rbDetailAvatar');
  var detailName = document.getElementById('rbDetailName');
  var detailNum = document.getElementById('rbDetailNum');
  var detailTime = document.getElementById('rbDetailTime');
  var detailIntent = document.getElementById('rbDetailIntent');
  var detailComment = document.getElementById('rbDetailComment');
  var threadList = document.getElementById('rbThreadList');
  var replyText = document.getElementById('rbReplyText');
  var replySend = document.getElementById('rbReplySend');
  var replyError = document.getElementById('rbReplyError');
  var resolveBtn = document.getElementById('rbResolveBtn');
  var resolveLabel = document.getElementById('rbResolveLabel');
  var detailClose = document.getElementById('rbDetailClose');
  var deleteBtn = document.getElementById('rbDeleteBtn');

  function railNumFor(id) {
    var n = 0;
    (state.loadedPins || []).some(function (p, idx) { if (p.id === id) { n = idx + 1; return true; } return false; });
    return n;
  }
  function openDetailCard(id) {
    var pin = findLoadedPin(id);
    if (!pin) { closeDetailCard(); return; }
    state.detailPinId = id;
    setNode(detailAvatar, avatarFor(pin.author || 'Anonymous', 'lg'));
    detailName.textContent = pin.author || 'Anonymous';
    detailNum.textContent = '#' + railNumFor(id);
    detailTime.textContent = relativeTime(pin.createdAt) || '';
    detailIntent.innerHTML = '';
    detailIntent.appendChild(intentBadge(pin.intent));
    detailIntent.appendChild(statusBadge(pin.status));
    detailComment.textContent = pin.comment || '';
    renderThread(pin);
    replyText.value = '';
    replyError.textContent = '';
    replySend.disabled = false;

    var resolved = pin.status === 'resolved';
    resolveLabel.textContent = resolved ? 'Resolved' : 'Resolve';
    resolveBtn.disabled = resolved;
    resolveBtn.setAttribute('aria-disabled', resolved ? 'true' : 'false');

    // delete affordance: own items only (item.author === the local identity name).
    var me = getIdentity();
    deleteBtn.hidden = !(me && (pin.author || '') === me);

    detailCard.hidden = false;
    detailCard.classList.add('open');
    try { replyText.focus(); } catch (e) {}
  }
  function closeDetailCard() {
    state.detailPinId = null;
    detailCard.classList.remove('open');
    detailCard.hidden = true;
    document.querySelectorAll('.rb-pin-marker--selected').forEach(function (m) { m.classList.remove('rb-pin-marker--selected'); });
    document.querySelectorAll('.rb-rail-item--active').forEach(function (x) { x.classList.remove('rb-rail-item--active'); });
    state.selectedPinId = null;
  }
  // re-sync the open card against the freshly merged record after a reply/resolve/delete reload.
  function syncDetailCard() {
    if (!state.detailPinId) return;
    if (!findLoadedPin(state.detailPinId)) { closeDetailCard(); return; }
    openDetailCard(state.detailPinId);
  }
  function renderThread(pin) {
    threadList.innerHTML = '';
    var replies = (pin.replies && pin.replies.length) ? pin.replies : [];
    if (!replies.length) { threadList.appendChild(el('div', 'rb-thread-empty', 'No replies yet.')); return; }
    replies.forEach(function (rep) {
      var row = el('div', 'rb-thread-reply');
      var av = avatarFor(rep.author || 'Anonymous', 'sm'); av.classList.add('rb-tr-avatar');
      row.appendChild(av);
      var head = el('div', 'rb-tr-head');
      head.appendChild(el('span', 'rb-tr-name', esc(rep.author || 'Anonymous')));
      head.appendChild(el('span', 'rb-tr-time', esc(relativeTime(rep.createdAt))));
      row.appendChild(head);
      row.appendChild(el('div', 'rb-tr-text', esc(rep.comment || rep.text || '')));
      threadList.appendChild(row);
    });
  }

  detailClose.onclick = function () { closeDetailCard(); };
  detailCard.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDetailCard(); }
  });

  // ── persist a single durable item (reply / resolve / delete) ──────────────
  // Build a single-pin merge contribution carrying the FULL item (so the daemon's
  // last-write-wins-per-item replaces the stored pin in place) plus this reviewer's
  // roster entry. On 2xx we re-paint from the merged record the daemon returns; on
  // error we surface a non-silent message and keep the card open (never silent loss).
  function itemContribution(item) {
    var name = getIdentity();
    var roster = [];
    if (name) { var a = computeAvatar(name); roster.push({ name: name, initials: a.initials, color: a.color, lastSeen: new Date().toISOString() }); }
    // include the item's own author in the roster so attribution survives even if it isn't me
    var au = item.author;
    if (au && au !== name && !roster.some(function (r) { return r.name === au; })) {
      var ea = computeAvatar(au); roster.push({ name: au, initials: ea.initials, color: ea.color });
    }
    return {
      schema_version: '1.0.0',
      boardId: CFG.boardId,
      publishedAt: new Date().toISOString(),
      regenerated: false,
      ratings: {},
      comments: {},
      authors: roster,
      pins: [item],
    };
  }
  function postItem(item, onOk) {
    fetch('api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'submit', feedback: itemContribution(item) }),
    }).then(function (r) {
      return r.json().then(function (body) { return { ok: r.ok, status: r.status, body: body }; });
    }).then(function (res) {
      if (!res.ok || (res.body && res.body.error)) {
        onOk(new Error(res.body && res.body.error ? res.body.error : ('save failed (' + res.status + ')')));
        return;
      }
      if (res.body && res.body.feedback) {
        if (res.body.feedback.authors) renderSeen(res.body.feedback.authors);
        loadAndRenderPins(res.body.feedback); // re-paint overlay + rail + open card from the merge
      }
      onOk(null, res.body && res.body.feedback);
    }).catch(function (e) { onOk(e instanceof Error ? e : new Error(String(e))); });
  }

  // submitReply(pinId, text) (T-007.6): append a { author, comment, createdAt } reply to the
  // item's replies[] and POST the updated item. Optimistic: the reply appears in the thread
  // immediately; a failure surfaces an inline error under the input and the optimistic node stays
  // until the next authoritative reload, so the reviewer never loses what they typed.
  function submitReply(pinId, text) {
    var clean = (text == null ? '' : String(text)).trim();
    if (!clean) { replyText.focus(); return; }
    var pin = findLoadedPin(pinId);
    if (!pin) return;
    var doSend = function () {
      var author = getIdentity() || 'Anonymous';
      var reply = { author: author, comment: clean, createdAt: new Date().toISOString() };
      var existing = Array.isArray(pin.replies) ? pin.replies.slice() : [];
      existing.push(reply);
      var updated = {}; Object.keys(pin).forEach(function (k) { updated[k] = pin[k]; });
      updated.replies = existing;
      // optimistic render into the thread DOM
      pin.replies = existing;
      renderThread(pin);
      replyText.value = '';
      replyError.textContent = '';
      replySend.disabled = true;
      postItem(updated, function (err) {
        replySend.disabled = false;
        if (err) { replyError.textContent = 'Could not send reply — ' + err.message + '. Try again.'; return; }
      });
    };
    withIdentity(doSend);
  }
  replySend.onclick = function () { if (state.detailPinId) submitReply(state.detailPinId, replyText.value); };
  replyText.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); replySend.click(); }
  });

  // resolvePin(pinId) (T-007.7): POST the item with status:'resolved'. On 2xx the merged
  // record re-paints — the marker ring becomes resolved, the rail chip flips, the open count
  // decrements; loadAndRenderPins→renderRail handles the all-resolved empty-state stub.
  function resolvePin(pinId) {
    var pin = findLoadedPin(pinId);
    if (!pin || pin.status === 'resolved') return;
    var updated = {}; Object.keys(pin).forEach(function (k) { updated[k] = pin[k]; });
    updated.status = 'resolved';
    resolveBtn.disabled = true;
    resolveLabel.textContent = 'Resolving…';
    postItem(updated, function (err) {
      if (err) { resolveBtn.disabled = false; resolveLabel.textContent = 'Resolve';
        toast('Could not resolve — ' + err.message + '. Try again.'); return; }
      // success path re-paints via syncDetailCard (status now resolved → button disabled/muted)
    });
  }
  resolveBtn.onclick = function () { if (state.detailPinId) resolvePin(state.detailPinId); };

  // deletePin(pinId) (T-007.8): own items only. POST a delete marker { id, author, deleted:true }
  // (the per-item, author-scoped delete wire-shape). Guard: the delete button is only shown for own
  // items, and we re-check identity here so a delete is never issued for someone else's pin. The
  // marker is removed from the canvas + rail optimistically; the merged record re-paints on 2xx.
  function deletePin(pinId) {
    var pin = findLoadedPin(pinId);
    if (!pin) return;
    var me = getIdentity();
    if (!me || (pin.author || '') !== me) { return; } // own-item guard
    var marker = { id: pin.id, author: pin.author, deleted: true };
    // optimistic removal: drop the pin from the loaded set so the marker + rail item disappear now.
    state.loadedPins = (state.loadedPins || []).filter(function (p) { return p.id !== pin.id; });
    closeDetailCard();
    var layer = document.querySelector('.pinlayer');
    if (layer) { loadAndRenderPins(); }
    postDelete(marker);
  }
  // The delete marker carries only { id, author, deleted } (the author-scoped per-item delete).
  function postDelete(marker) {
    fetch('api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'submit', feedback: {
        schema_version: '1.0.0', boardId: CFG.boardId, publishedAt: new Date().toISOString(),
        regenerated: false, ratings: {}, comments: {}, authors: authorRoster(), pins: [marker],
      } }),
    }).then(function (r) {
      return r.json().then(function (body) { return { ok: r.ok, status: r.status, body: body }; });
    }).then(function (res) {
      if (res.ok && res.body && res.body.feedback) {
        if (res.body.feedback.authors) renderSeen(res.body.feedback.authors);
        loadAndRenderPins(res.body.feedback);
      }
      // A daemon that doesn't yet honor the delete marker leaves the durable record unchanged;
      // the optimistic local removal still reflects the intent for this session (never a dead end).
    }).catch(function () { /* offline — optimistic removal holds; eventual consistency on reload */ });
  }
  deleteBtn.onclick = function () { if (state.detailPinId) deletePin(state.detailPinId); };

  // close the card when clicking empty stage space (but not when interacting with a marker/card).
  document.getElementById('stage').addEventListener('mousedown', function (e) {
    if (!detailCard.classList.contains('open')) return;
    if (e.target.closest('.rb-detail-card') || e.target.closest('.rb-pin-marker')) return;
    // a fresh pin-drop popover and selection both manage their own state; only a bare stage
    // click in Interact mode dismisses the open card.
    if (!state.pinMode) closeDetailCard();
  });

  // ── Show/Hide overlay toggle + floating hidden-pins bar (T-005.5/.6/.7) ──────
  var PINS_VISIBLE_KEY = 'rb-pins-visible';
  var pinsToggle = document.getElementById('rbPinsToggle');
  var pinsHiddenBar = document.getElementById('rbPinsHiddenBar');
  var hiddenCount = document.getElementById('rbHiddenCount');
  var showPinsBtn = document.getElementById('rbShowPins');
  var toggleIcon = document.getElementById('rbToggleIcon');
  var toggleLabel = document.getElementById('rbToggleLabel');
  var EYE_ON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a16.6 16.6 0 0 1-2.36 3.32M6.6 6.6A16.4 16.4 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 4.4-1.1"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/><path d="m2 2 20 20"/></svg>';

  function readPinsVisible() {
    try {
      var v = window.sessionStorage.getItem(PINS_VISIBLE_KEY);
      return v == null ? true : v !== '0';
    } catch (e) { return state._pinsVisibleMem == null ? true : state._pinsVisibleMem; }
  }
  function writePinsVisible(visible) {
    try { window.sessionStorage.setItem(PINS_VISIBLE_KEY, visible ? '1' : '0'); }
    catch (e) { state._pinsVisibleMem = visible; }
  }

  // Count of loaded markers that belong to the current variant (drives the hidden-bar pill).
  function visiblePinCount() {
    var v = cur();
    return state.loadedPins.filter(function (pin) { return loadedPinForVariant(pin, v); }).length;
  }
  function refreshHiddenBar() {
    var n = visiblePinCount();
    if (!state.pinsVisible && n > 0) {
      hiddenCount.textContent = n + ' pin' + (n === 1 ? '' : 's') + ' hidden';
      pinsHiddenBar.classList.add('show');
    } else {
      pinsHiddenBar.classList.remove('show');
    }
  }
  // applyOverlayVisibility(): mirror state.pinsVisible onto the DOM — the overlay container
  // (the pin layer) gets .rb-overlay-hidden (CSS: markers display:none), the toggle's
  // aria-checked/label/icon reflect the state, and the floating bar appears when hidden.
  function applyOverlayVisibility() {
    var layer = document.querySelector('.pinlayer');
    if (layer) layer.classList.toggle('rb-overlay-hidden', !state.pinsVisible);
    pinsToggle.hidden = false;
    pinsToggle.setAttribute('aria-checked', state.pinsVisible ? 'true' : 'false');
    toggleLabel.textContent = state.pinsVisible ? 'Pins' : 'Pins hidden';
    toggleIcon.innerHTML = state.pinsVisible ? EYE_ON : EYE_OFF;
    refreshHiddenBar();
  }
  function setPinsVisible(visible) {
    state.pinsVisible = !!visible;
    writePinsVisible(state.pinsVisible);
    applyOverlayVisibility();
  }
  function togglePins() { setPinsVisible(!state.pinsVisible); }

  state.pinsVisible = readPinsVisible();
  toggleIcon.innerHTML = state.pinsVisible ? EYE_ON : EYE_OFF;
  pinsToggle.setAttribute('aria-checked', state.pinsVisible ? 'true' : 'false');
  toggleLabel.textContent = state.pinsVisible ? 'Pins' : 'Pins hidden';
  pinsToggle.onclick = togglePins;
  // role=switch: Space/Enter activate it (T-005.7). preventDefault stops Space from scrolling.
  pinsToggle.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') { e.preventDefault(); togglePins(); }
  });
  showPinsBtn.onclick = function () { setPinsVisible(true); };

  function renderPinList() {
    var list = document.getElementById('pinlist');
    document.getElementById('pinCount').textContent = state.pins.length ? '· ' + state.pins.length : '';
    if (!state.pins.length) {
      list.innerHTML = '<div class="empty">Switch to <b>Pin</b> and click the design — drag to mark a region.</div>';
      return;
    }
    list.innerHTML = '';
    state.pins.forEach(function (pin, idx) {
      var row = el('div', 'pinrow');
      row.innerHTML = '<span class="n">' + (idx + 1) + '</span>' +
        '<span class="tx"><span class="it">' + pin.intent + '</span>' + pin.comment.replace(/</g, '&lt;') +
        (pin.author ? '<br><span class="sc">' + String(pin.author).replace(/</g, '&lt;') + '</span>' : '') +
        (pin.screen ? '<br><span class="sc">screen: ' + pin.screen + '</span>' : '') + '</span>' +
        '<button class="del" title="remove pin">×</button>';
      // SPEC-017 T-003.7: attribution avatar on the rail item (minimal — fully wired in T-006).
      if (pin.author) { row.insertBefore(avatarFor(pin.author, 'sm'), row.firstChild); }
      row.onclick = function (e) {
        if (e.target.classList.contains('del')) {
          state.pins.splice(idx, 1);
          var layer = document.querySelector('.pinlayer');
          if (layer) drawPins(layer, cur().id);
          renderPinList();
          return;
        }
        var vi = CFG.variants.findIndex(function (v) { return v.id === pin._v; });
        if (vi >= 0 && vi !== state.sel) select(vi);
        var m = document.querySelector('.pin[data-idx="' + idx + '"]');
        if (m) { m.classList.add('hl'); setTimeout(function () { m.classList.remove('hl'); }, 900); m.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      };
      list.appendChild(row);
    });
  }

  // ── inspector (per-selection) ─────────────────────────────────────────
  var stars = document.getElementById('stars');
  for (var s = 1; s <= 5; s++) (function (n) {
    var b = el('button', '', '★');
    b.setAttribute('aria-label', n + ' star' + (n > 1 ? 's' : ''));
    b.onclick = function () { state.ratings[cur().id] = n; paintStars(); };
    stars.appendChild(b);
  })(s);
  function paintStars() {
    var n = state.ratings[cur().id] || 0;
    Array.prototype.forEach.call(stars.children, function (c, i) { c.classList.toggle('on', i < n); });
  }
  var notes = document.getElementById('notes');
  notes.oninput = function () { state.comments[cur().id] = notes.value; };
  function renderInspector() {
    document.getElementById('selName').textContent = '· ' + (cur().id === 'artifact' ? 'artifact' : cur().id);
    paintStars();
    notes.value = state.comments[cur().id] || '';
    var mw = document.getElementById('moreWrap');
    mw.innerHTML = '';
    if (CFG.mode === 'loop') {
      var more = el('button', 'btn block', 'More like ' + cur().id);
      more.onclick = function () { sendPending('more-like', { preferred: cur().id }); };
      mw.appendChild(more);
    }
  }

  // ── selectors ─────────────────────────────────────────────────────────
  ['remixLayout', 'remixColors', 'approveSel'].forEach(function (id) {
    var sel = document.getElementById(id);
    CFG.variants.forEach(function (v) {
      var o = document.createElement('option'); o.value = v.id; o.textContent = v.id; sel.appendChild(o);
    });
  });
  if (CFG.variants.length < 2) {
    document.getElementById('remixRow').style.display = 'none';
    document.getElementById('remixLbl').style.display = 'none';
    document.getElementById('remixBtn').style.display = 'none';
    document.getElementById('remixNote').style.display = 'none';
  }

  // ── handshake ─────────────────────────────────────────────────────────
  // SPEC-017 T-004.1: stamp the reviewer's identity onto an outgoing contribution
  // item before it is POSTed. author is the display-name STRING (the schema's
  // pin.author + the daemon merge key); the full { name, initials, color } object
  // lives once in the payload's authors[] roster. createdAt anchors the stable id.
  // A null identity falls back to "Anonymous" so a skipped reviewer still produces
  // a schema-valid, attributable item (the modal gate runs at pin-drop time).
  function submitContribution(item) {
    var out = {}; Object.keys(item).forEach(function (k) { if (k !== '_v') out[k] = item[k]; });
    var name = getIdentity();
    if (!out.author || out.author === '') out.author = name || 'Anonymous';
    if (!out.createdAt) out.createdAt = new Date().toISOString();
    return out;
  }
  function cleanPins() {
    return state.pins.map(submitContribution);
  }
  // The current reviewer's roster entry: { name, initials, color }. Each author
  // appears once in authors[]; the daemon's mergeFeedback unions by name so a
  // returning reviewer's entry is updated, not duplicated (T-004.3).
  function authorRoster() {
    var name = getIdentity();
    if (!name) return [];
    var a = computeAvatar(name);
    return [{ name: name, initials: a.initials, color: a.color, lastSeen: new Date().toISOString() }];
  }
  function payload(extra) {
    var base = {
      schema_version: '1.0.0',
      boardId: CFG.boardId,
      publishedAt: new Date().toISOString(),
      ratings: state.ratings,
      comments: state.comments,
      overall: document.getElementById('overall').value || '',
      regenerated: false,
      authors: authorRoster(),
      pins: cleanPins(),
    };
    Object.keys(extra || {}).forEach(function (k) { base[k] = extra[k]; });
    return base;
  }
  function post(kind, feedback, after) {
    fetch('api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: kind, feedback: feedback }),
    }).then(function (r) { return r.json(); }).then(function (r) {
      if (r.error) { alert('Feedback rejected: ' + r.error); return; }
      // SPEC-017 T-004.2/.3: the daemon returns the merged durable record (with the
      // unioned authors[] roster) on a submit — refresh the seen cluster from it so
      // the current reviewer's avatar appears the moment their first item lands.
      if (r.feedback && r.feedback.authors) renderSeen(r.feedback.authors);
      after();
    }).catch(function (e) { alert('Could not reach the board daemon: ' + e); });
  }

  // ── SPEC-017 T-006: persist a single dropped pin (merge POST) ────────────
  // The non-destructive daemon merge keys by (id + author), so a contribution
  // carrying ONLY the just-dropped pin is correct — it folds in without touching
  // anyone else's stored items. We send the fully-attributed item payload
  // ({ id, author, x, y, w, h, intent, comment, status:'open', createdAt, replies:[] })
  // plus this reviewer's authors[] roster entry. On 2xx the daemon returns the merged
  // durable record: we re-paint the overlay + seen cluster from THAT authoritative copy
  // (so the pin is now a persisted, attributed marker, not just an in-session draft) and
  // verify persistence on the next refresh via loadFeedback(). On failure we surface the
  // save-failed state (stub toast — the full retry affordance lands in T-011) and never
  // silently drop the contribution.
  function pinContribution(pin) {
    return {
      schema_version: '1.0.0',
      boardId: CFG.boardId,
      publishedAt: new Date().toISOString(),
      regenerated: false,
      ratings: {},
      comments: {},
      authors: authorRoster(),
      pins: [pin],
    };
  }
  function postPin(pin, draftPin) {
    fetch('api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'submit', feedback: pinContribution(pin) }),
    }).then(function (r) {
      return r.json().then(function (body) { return { ok: r.ok, status: r.status, body: body }; });
    }).then(function (res) {
      if (!res.ok || (res.body && res.body.error)) {
        saveFailed(res.body && res.body.error ? res.body.error : ('save failed (' + res.status + ')'));
        return;
      }
      // Confirmed persisted: the pin now lives in the durable record. Drop the in-session
      // optimistic DRAFT (state.pins) so the same pin isn't drawn twice — once as a draft
      // .pin and once as a durable .rb-pin-marker — then re-render the durable overlay + seen
      // cluster from the merged record the daemon wrote (the dropped pin now carries the
      // server's canonical id and is part of the persistent, attributed projection).
      if (draftPin) {
        var di = state.pins.indexOf(draftPin);
        if (di >= 0) {
          state.pins.splice(di, 1);
          var layer = document.querySelector('.pinlayer');
          if (layer) drawPins(layer, cur().id);
          renderPinList();
        }
      }
      if (res.body && res.body.feedback) {
        if (res.body.feedback.authors) renderSeen(res.body.feedback.authors);
        loadAndRenderPins(res.body.feedback);
      }
    }).catch(function (e) { saveFailed(e && e.message ? e.message : String(e)); });
  }
  // Save-failed state stub (T-006.2) — a non-silent error toast. The full save-failed
  // toast with a Retry affordance is designed + wired in T-011 (design-spec §6 states).
  function saveFailed(detail) {
    toast('Could not save pin' + (detail ? ' — ' + detail : '') + '. Your note is still on screen; try again.');
  }

  function summary(fb) {
    var bits = [];
    if (fb.preferred) bits.push('running with ' + fb.preferred);
    var rated = Object.keys(fb.ratings).length;
    if (rated) bits.push(rated + ' rating' + (rated > 1 ? 's' : ''));
    if (fb.pins.length) bits.push(fb.pins.length + ' pin' + (fb.pins.length > 1 ? 's' : ''));
    if (fb.overall) bits.push('overall note');
    return bits.join(' · ') || 'recorded';
  }
  function banner(kind, text) {
    var b = document.getElementById('banner');
    document.getElementById('bannerBadge').textContent = kind === 'ok' ? '✓' : '↻';
    document.getElementById('bannerText').textContent = text;
    b.classList.add('show');
  }
  function sendPending(action, extra) {
    var fb = payload(extra);
    fb.regenerated = true;
    fb.regenerateAction = action;
    post('pending', fb, function () {
      banner('pending', 'Sent to your agent (' + action + ' · ' + summary(fb) + ') — this tab reloads when the new round lands.');
    });
  }
  document.getElementById('remixBtn').onclick = function () {
    sendPending('remix', { remixSpec: {
      layoutFrom: document.getElementById('remixLayout').value,
      colorsFrom: document.getElementById('remixColors').value,
      note: document.getElementById('remixNote').value || '',
    } });
  };
  document.getElementById('iterateBtn').onclick = function () { sendPending('iterate', {}); };
  document.getElementById('submitBtn').onclick = function () {
    var fb = payload({ preferred: document.getElementById('approveSel').value });
    var btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = 'Writing feedback.json…';
    post('submit', fb, function () {
      document.getElementById('approveForm').style.display = 'none';
      document.getElementById('receiptMeta').textContent = '(' + summary(fb) + ')';
      document.getElementById('receipt').classList.add('show');
      banner('ok', 'Feedback received — feedback.json written next to the board. Return to your coding agent.');
      document.title = '✓ ' + document.title;
    });
  };

  // ── progress / versions / reload ──────────────────────────────────────
  function applyProgress(p) {
    (p.variants ? Object.keys(p.variants) : []).forEach(function (vid) {
      var it = document.querySelector('.vitem[data-variant="' + vid + '"] .st');
      if (!it) return;
      var st = p.variants[vid];
      it.className = 'st ' + st;
      it.innerHTML = st === 'generating' || st === 'checking' || st === 'queued'
        ? '<span class="spin"></span>'
        : st === 'failed' ? '✗' : st === 'done' ? '✓' : st;
    });
    if (p.versions && Object.keys(p.versions).some(function (k) { return (p.versions[k] || []).length; })) {
      renderVersions(p.versions);
    }
    if (state.lastReloadGen === null) state.lastReloadGen = p.reloadGen;
    else if (p.reloadGen !== state.lastReloadGen) location.reload();
  }
  function renderVersions(versions) {
    var box = document.getElementById('vers');
    document.getElementById('versSect').hidden = false;
    box.innerHTML = '';
    Object.keys(versions).forEach(function (vid) {
      versions[vid].forEach(function (file, i) {
        var t = el('div', 'verthumb');
        t.dataset.file = file;
        t.innerHTML = '<span class="vt">' + (/\\.svg$/.test(file)
          ? '<object type="image/svg+xml" data="' + file + '"></object>'
          : /\\.(png|jpe?g|webp)$/i.test(file) ? '<img src="' + file + '" alt="">'
          : '◈') + '</span>' + vid + ' · v' + (i + 1);
        t.onclick = function () {
          var ix = state.railSel.indexOf(t);
          if (ix >= 0) state.railSel.splice(ix, 1); else state.railSel.push(t);
          while (state.railSel.length > 2) state.railSel.shift();
          document.querySelectorAll('.verthumb').forEach(function (x) { x.classList.remove('sel'); });
          state.railSel.forEach(function (x) { x.classList.add('sel'); });
          if (state.railSel.length === 2) {
            state.diff = [state.railSel[0].dataset.file, state.railSel[1].dataset.file];
            renderStage();
          } else if (state.diff) { state.diff = null; renderStage(); }
        };
        box.appendChild(t);
      });
    });
  }
  function poll() {
    fetch('api/progress').then(function (r) { return r.json(); }).then(applyProgress).catch(function () {});
  }
  setInterval(poll, 1500);
  poll();

  // ── SPEC-017 T-004.2: initial load — populate the authors-seen cluster ──
  // GET /api/feedback returns the durable record (normalizeLegacy'd by the daemon):
  // { authors: [{ name, initials?, color? }], pins: [...] } — or { authors: [], items: [] }
  // before any submit. We read authors[], dedupe by name, and render one small
  // avatar chip per reviewer so returning reviewers and other tabs see each other.
  var rbSeen = document.getElementById('rbSeen');
  function renderSeen(authors) {
    state.seenAuthors = Array.isArray(authors) ? authors : [];
    rbSeen.innerHTML = '';
    var byName = {};
    var unique = [];
    state.seenAuthors.forEach(function (a) {
      var name = a && a.name;
      if (!name || byName[name]) return;
      byName[name] = true;
      unique.push(a);
    });
    if (!unique.length) { rbSeen.hidden = true; return; }
    rbSeen.hidden = false;
    unique.forEach(function (entry) {
      // Prefer the roster's stored initials/color; fall back to deriving from the
      // name so a legacy/partial entry still renders a deterministic avatar.
      var avatar = (entry.initials && entry.color)
        ? renderAvatar({ initials: entry.initials, color: entry.color }, 'sm')
        : avatarFor(entry.name, 'sm');
      avatar.title = entry.name;
      rbSeen.appendChild(avatar);
    });
  }
  function loadFeedback() {
    // SPEC-017 T-006.1: on board open/refresh, GET the durable record and render every
    // stored pin (loadAndRenderPins) + the authors-seen cluster. This is the load half of
    // the persistence round-trip — a refresh after a pin drop re-renders that pin from here.
    fetch('api/feedback').then(function (r) {
      if (!r.ok) throw new Error('feedback load failed (' + r.status + ')');
      return r.json();
    }).then(function (rec) {
      renderSeen(rec && rec.authors);
      // SPEC-017 T-005.1: paint the durable, attributed pin overlay from the loaded record.
      loadAndRenderPins(rec);
    }).catch(function (e) {
      // Loading-error state (stub toast — fully designed in T-011). The board still works
      // through merge-on-submit (eventual consistency on the next successful load), so this
      // degrades cleanly to a usable board rather than a blank/broken screen.
      toast('Could not load existing feedback' + (e && e.message ? ' — ' + e.message : '') + '. The board still works; pins you add will save.');
    });
  }

  select(0);
  // Apply the restored Show/Hide state to the first paint, then load the durable overlay.
  applyOverlayVisibility();
  loadFeedback();
})();
</script>
</body>
</html>
`;
}
