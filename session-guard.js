/**
 * session-guard.js  v4.0
 * ──────────────────────────────────────────────────────────
 *  1. Auth→Game sync   (name / avatar / ID)
 *  2. Profile Edit     (avatar upload + username)
 *  3. Premium Friends  (Online widget + Add/Remove/Requests)
 *  4. Index bug fixes  (sfxMove / resyncFromDB / autoRejoin)
 *  Glass: --glass-bg:#ffffff14  --glass-border:#ffffff26
 *         blur-xl=24px  blur-2xl=40px  (0eb7fa540bde1768.css)
 */
(function(){
'use strict';

/* ═══════════════════════════════ TOKENS ═══════════════════════════════ */
var GL={
  bg:'#ffffff14', border:'#ffffff26', hi:'rgba(255,255,255,.18)',
  shadow:'0 8px 32px rgba(0,0,0,.55)',
  gold:'#D4A843', goldHi:'#F0CC72',
  goldDm:'rgba(212,168,67,.18)', goldBd:'rgba(212,168,67,.38)',
  ok:'#10B981', err:'#EF4444',
  r:{sm:'10px',md:'14px',xl:'22px',full:'999px'},
  bl:{md:'blur(12px)',xl:'blur(24px)',xl2:'blur(40px)'},
};

/* ═══════════════════════════════ HELPERS ══════════════════════════════ */
var $=function(id){return document.getElementById(id);};
var _x=function(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};
var _sb=function(){return(typeof window.SB==='function')?window.SB():null;};
var _kp=null;
try{var _r=sessionStorage.getItem('kk_player');if(_r)_kp=JSON.parse(_r);}catch(e){}
/* ── New feature state ── */       /* {uid: count} unread DMs */
var _inviteCh=null;     /* invite realtime channel */         /* DM realtime channel */
var _statusCh=null;     /* in-match status channel */
var _currentDMFriend=null; /* uid of open DM thread */
var _friendStatus={};   /* {uid: 'lobby'|'in_match'} */
var _authUser=null,_authProf=null;

async function _getUser(){
  if(_authUser)return _authUser;
  var sb=_sb();if(!sb)return null;
  try{var d=await sb.auth.getSession();_authUser=d.data.session?.user||null;}catch(e){_authUser=null;}
  return _authUser;
}
async function _getProf(){
  if(_authProf)return _authProf;
  var u=await _getUser();if(!u)return null;
  var sb=_sb();if(!sb)return null;
  try{var d=await sb.from('profiles').select('*').eq('id',u.id).single();_authProf=d.data;}catch(e){_authProf=null;}
  return _authProf;
}

/* ═══════════════════════════════ STYLES ═══════════════════════════════ */
function _css(){
  if($('_sg-st'))return;
  var s=document.createElement('style');s.id='_sg-st';
  s.textContent=`
@property --_sg-ang{syntax:'<angle>';initial-value:0deg;inherits:false}
@keyframes _sg-spin-bd{to{--_sg-ang:360deg}}
@keyframes _sg-up{from{opacity:0;transform:translateY(14px)scale(.97)}to{opacity:1;transform:none}}
@keyframes _sg-in{from{opacity:0;transform:translateY(-4px)scale(.97)}to{opacity:1;transform:none}}
@keyframes _sg-shimx{0%{transform:translateX(-120%)skewX(-18deg);opacity:0}30%{opacity:.5}70%{opacity:.5}100%{transform:translateX(240%)skewX(-18deg);opacity:0}}
@keyframes _sg-rot{to{transform:rotate(360deg)}}
@keyframes _sg-breathe{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.5)}50%{box-shadow:0 0 0 5px rgba(16,185,129,0)}}
@keyframes _sg-pulse{0%,100%{transform:scale(1);opacity:.75}50%{transform:scale(1.4);opacity:1}}
@keyframes _sg-ripple{0%{transform:scale(.8);opacity:.7}100%{transform:scale(2.4);opacity:0}}
@keyframes _sg-av-pop{from{opacity:0;transform:scale(.6)translateY(4px)}to{opacity:1;transform:none}}
@keyframes _sg-tab-slide{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:none}}

/* ── Backdrop ── */
#_sg-bd{
  position:fixed;inset:0;z-index:9000;
  background:rgba(0,0,0,0);backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0);
  display:flex;align-items:center;justify-content:center;
  transition:background .3s,backdrop-filter .3s;
  pointer-events:none;visibility:hidden;
}
#_sg-bd.on{
  background:rgba(0,0,0,.76);
  backdrop-filter:${GL.bl.xl};-webkit-backdrop-filter:${GL.bl.xl};
  pointer-events:all;visibility:visible;
}
/* ── Modal wrap (conic border) ── */
._sg-mw{
  position:relative;z-index:9001;border-radius:25px;padding:1.5px;
  animation:_sg-up .42s cubic-bezier(.16,1,.3,1)both;
}
._sg-mw::before{
  content:'';position:absolute;inset:0;border-radius:25px;z-index:-1;
  background:conic-gradient(from var(--_sg-ang),
    rgba(212,168,67,0),rgba(212,168,67,.5),rgba(240,204,114,.85),
    rgba(212,168,67,.5),rgba(212,168,67,0));
  animation:_sg-spin-bd 4s linear infinite;
}
/* ── Modal card ── */
._sg-mc{
  width:370px;max-width:93vw;max-height:88vh;overflow-y:auto;
  border-radius:24px;
  background:rgba(5,3,16,.97);
  backdrop-filter:${GL.bl.xl2};-webkit-backdrop-filter:${GL.bl.xl2};
  border:1px solid ${GL.border};border-top:1px solid ${GL.hi};
  box-shadow:${GL.shadow},0 0 70px rgba(212,168,67,.07);
  scrollbar-width:none;
}
._sg-mc::-webkit-scrollbar{display:none}
/* ── Header ── */
._sg-hdr{padding:18px 20px 0;display:flex;align-items:center;gap:10px}
._sg-htitle{
  flex:1;font-family:\'Cinzel Decorative\',serif;font-size:.86rem;font-weight:700;letter-spacing:.06em;
  background:linear-gradient(90deg,#D4A843,#F0CC72,#D4A843);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
._sg-hclose{
  width:26px;height:26px;border-radius:50%;cursor:pointer;flex-shrink:0;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
  display:flex;align-items:center;justify-content:center;
  color:rgba(255,255,255,.4);font-size:.88rem;transition:all .16s;
}
._sg-hclose:hover{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.3);color:#fca5a5}
._sg-body{padding:14px 18px 20px;display:flex;flex-direction:column;gap:12px}
._sg-lbl{font-size:.58rem;color:rgba(212,168,67,.52);letter-spacing:2px;text-transform:uppercase;font-family:\'Outfit\',sans-serif;font-weight:600}

/* ── Inputs ── */
._sg-inp{
  width:100%;padding:9px 13px;border-radius:10px;outline:none;
  background:rgba(255,255,255,.04);
  border:1px solid ${GL.border};border-top:1px solid ${GL.hi};
  color:#F0E8D8;font-family:\'Outfit\',sans-serif;font-size:.86rem;
  backdrop-filter:${GL.bl.md};-webkit-backdrop-filter:${GL.bl.md};
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
  transition:border-color .2s,box-shadow .2s;
  -webkit-user-select:auto!important;user-select:auto!important;
}
._sg-inp::placeholder{color:rgba(255,255,255,.18)}
._sg-inp:focus{border-color:${GL.goldBd};box-shadow:0 0 0 3px rgba(212,168,67,.08)}

/* ── Msg ── */
._sg-msg{padding:8px 12px;border-radius:9px;font-size:.72rem;line-height:1.5;display:none;font-family:\'Outfit\',sans-serif}
._sg-msg.on{display:block}
._sg-msg.ok{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.24);color:#6ee7b7}
._sg-msg.er{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.24);color:#fca5a5}
._sg-msg.info{background:rgba(212,168,67,.07);border:1px solid rgba(212,168,67,.2);color:${GL.goldHi}}

/* ── Buttons ── */
._sg-bgold{
  width:100%;padding:10px 16px;border:none;border-radius:12px;cursor:pointer;
  background:linear-gradient(135deg,#4A2A04,#C0902A 35%,#E0B848 50%,#C08828 65%,#6A4008);
  border:1px solid rgba(255,255,255,.20);border-top:1px solid rgba(255,255,255,.32);
  color:#060300;font-family:\'Outfit\',sans-serif;font-size:.86rem;font-weight:700;
  box-shadow:0 4px 18px rgba(200,150,42,.22),inset 0 1px 0 rgba(255,255,255,.18);
  transition:all .2s cubic-bezier(.16,1,.3,1);overflow:hidden;
}
._sg-bgold:hover{transform:translateY(-1px);box-shadow:0 6px 26px rgba(200,150,42,.35)}
._sg-bgold:disabled{opacity:.45;cursor:not-allowed;transform:none}
._sg-bglass{
  width:100%;padding:9px 16px;border-radius:10px;cursor:pointer;
  background:${GL.bg};border:1px solid ${GL.border};border-top:1px solid ${GL.hi};
  color:rgba(200,180,255,.65);font-family:\'Outfit\',sans-serif;font-size:.78rem;font-weight:600;
  backdrop-filter:${GL.bl.md};transition:all .2s;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
}
._sg-bglass:hover{background:rgba(255,255,255,.08);border-color:${GL.goldBd};color:${GL.goldHi}}
._sg-bsm{
  padding:5px 11px;border-radius:8px;cursor:pointer;
  font-family:\'Outfit\',sans-serif;font-size:.65rem;font-weight:600;
  border:1px solid;transition:all .16s;white-space:nowrap;
}
._sg-badd{color:#6ee7b7;border-color:rgba(16,185,129,.28);background:rgba(16,185,129,.07)}
._sg-badd:hover{background:rgba(16,185,129,.16)}
._sg-brem{color:#fca5a5;border-color:rgba(239,68,68,.24);background:rgba(239,68,68,.06)}
._sg-brem:hover{background:rgba(239,68,68,.14)}
._sg-bcan{color:rgba(180,148,70,.6);border-color:rgba(212,168,67,.15);background:rgba(212,168,67,.04)}
._sg-bcan:hover{color:${GL.goldHi};background:rgba(212,168,67,.10)}

/* ── Spinner ── */
._sg-spin{
  width:13px;height:13px;border-radius:50%;
  border:2px solid rgba(255,255,255,.12);border-top-color:rgba(255,255,255,.75);
  animation:_sg-rot .7s linear infinite;
  display:inline-block;vertical-align:middle;margin-right:5px;
}

/* ── Avatar wrap ── */
._sg-avw{
  position:relative;width:72px;height:72px;border-radius:50%;
  cursor:pointer;margin:0 auto 8px;
}
._sg-avw img,._sg-avfb{
  width:72px;height:72px;border-radius:50%;object-fit:cover;display:block;
  border:2px solid ${GL.goldBd};
  box-shadow:0 0 18px rgba(212,168,67,.22),0 4px 16px rgba(0,0,0,.5);
  transition:filter .2s;
}
._sg-avfb{background:rgba(212,168,67,.07);display:flex;align-items:center;justify-content:center;font-size:1.8rem}
._sg-avw:hover img,._sg-avw:hover ._sg-avfb{filter:brightness(.62)}
._sg-avov{
  position:absolute;inset:0;border-radius:50%;
  background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;
  font-size:1.3rem;opacity:0;transition:opacity .2s;pointer-events:none;
}
._sg-avw:hover ._sg-avov{opacity:1}

/* ── TABS ── */
._sg-tabs{display:flex;border-bottom:1px solid rgba(212,168,67,.08);margin:0 -18px;padding:0 18px}
._sg-tab{
  flex:1;padding:9px 0;background:none;border:none;cursor:pointer;
  font-family:\'Outfit\',sans-serif;font-size:.72rem;font-weight:600;
  color:rgba(180,148,70,.45);border-bottom:2px solid transparent;margin-bottom:-1px;
  transition:all .18s;position:relative;
}
._sg-tab.on{color:${GL.goldHi};border-bottom-color:${GL.gold}}
._sg-tab .tab-badge{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:16px;height:16px;border-radius:${GL.r.full};
  background:${GL.err};color:#fff;font-size:.52rem;font-weight:700;
  padding:0 4px;margin-left:4px;vertical-align:middle;
}
._sg-tab-body{display:none;animation:_sg-tab-slide .2s ease both}
._sg-tab-body.on{display:block}

/* ── Friend rows ── */
._sg-fri{
  display:flex;align-items:center;gap:10px;
  padding:9px 11px;border-radius:12px;
  background:${GL.bg};
  border:1px solid ${GL.border};border-top:1px solid ${GL.hi};
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 2px 8px rgba(0,0,0,.2);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  transition:all .2s cubic-bezier(.16,1,.3,1);
  animation:_sg-in .22s ease both;position:relative;overflow:hidden;
}
._sg-fri:hover{
  background:rgba(255,255,255,.07);
  border-color:rgba(212,168,67,.20);
  border-top-color:rgba(255,255,255,.16);
  transform:translateY(-1px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 4px 16px rgba(0,0,0,.28);
}
._sg-fri:active{transform:scale(.98);box-shadow:inset 0 2px 6px rgba(0,0,0,.3);transition:all .08s ease;}
._sg-fav-ring{
  position:relative;flex-shrink:0;
  width:38px;height:38px;
}
._sg-fav-ring img,._sg-fav-ring ._sg-ffb{
  width:38px;height:38px;border-radius:50%;object-fit:cover;
  border:1.5px solid ${GL.goldBd};display:block;
}
._sg-fav-ring ._sg-ffb{
  background:rgba(212,168,67,.08);display:flex;align-items:center;justify-content:center;font-size:1rem;
  border:1.5px solid rgba(212,168,67,.18);
}
/* Status dot on avatar */
._sg-sdot{
  position:absolute;bottom:1px;right:1px;
  width:11px;height:11px;border-radius:50%;
  border:2px solid rgba(5,3,16,.95);
}
._sg-sdot.on{background:${GL.ok};animation:_sg-breathe 2s ease-in-out infinite}
._sg-sdot.off{background:rgba(255,255,255,.22)}
._sg-binv{
  padding:7px 14px;border-radius:10px;cursor:pointer;
  font-family:\'Outfit\',sans-serif;font-size:.68rem;font-weight:700;
  letter-spacing:.3px;
  border:1px solid rgba(99,179,237,.30);
  border-top:1px solid rgba(255,255,255,.18);
  color:rgba(147,210,255,.9);
  background:rgba(99,179,237,.10);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 2px 8px rgba(0,0,0,.25);
  transition:all .22s cubic-bezier(.16,1,.3,1);
  white-space:nowrap;flex-shrink:0;
  position:relative;overflow:hidden;
}
._sg-binv::before{
  content:\'\';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,.07) 0%,transparent 60%);
  pointer-events:none;
}
._sg-binv:hover{
  background:rgba(99,179,237,.20);
  border-color:rgba(99,179,237,.55);
  border-top-color:rgba(255,255,255,.28);
  color:#bee3f8;
  transform:translateY(-1px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 4px 14px rgba(99,179,237,.18);
}
._sg-binv:active{
  transform:scale(.95) translateY(0);
  background:rgba(99,179,237,.25);
  box-shadow:inset 0 2px 4px rgba(0,0,50,.3),0 1px 4px rgba(0,0,0,.2);
  transition:all .08s ease;
}
/* ── DM Chat Modal ── */
._sg-dm-wrap{
  display:flex;flex-direction:column;
  height:420px;max-height:72vh;
}
._sg-dm-msgs{
  flex:1;overflow-y:auto;
  display:flex;flex-direction:column;
  gap:6px;padding:12px 4px 8px;
  scrollbar-width:thin;
  scrollbar-color:rgba(212,168,67,.12) transparent;
}
._sg-dm-msgs::-webkit-scrollbar{width:3px}
._sg-dm-msgs::-webkit-scrollbar-track{background:transparent}
._sg-dm-msgs::-webkit-scrollbar-thumb{background:rgba(212,168,67,.15);border-radius:2px}
._sg-dm-empty{
  text-align:center;padding:30px 16px;
  font-size:.70rem;color:rgba(180,148,70,.38);
  font-family:\'Outfit\',sans-serif;line-height:2;
}
._sg-dm-row{display:flex;width:100%;}
._sg-dm-row.me{justify-content:flex-end;}
._sg-dm-row.them{justify-content:flex-start;}
._sg-dm-bub{
  max-width:78%;padding:8px 12px;
  font-size:.74rem;color:#F0E8D8;
  font-family:\'Outfit\',sans-serif;line-height:1.55;
  word-break:break-word;
  position:relative;
  animation:_sg-in .18s ease both;
}
._sg-dm-row.me ._sg-dm-bub{
  background:rgba(212,168,67,.12);
  border:1px solid rgba(212,168,67,.22);
  border-top:1px solid rgba(255,255,255,.12);
  border-radius:14px 4px 14px 14px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 2px 8px rgba(0,0,0,.25);
  backdrop-filter:blur(8px);
}
._sg-dm-row.them ._sg-dm-bub{
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.08);
  border-top:1px solid rgba(255,255,255,.14);
  border-radius:4px 14px 14px 14px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 2px 8px rgba(0,0,0,.2);
  backdrop-filter:blur(8px);
}
._sg-dm-inp-row{
  display:flex;gap:8px;padding:10px 0 2px;
  border-top:1px solid rgba(212,168,67,.10);
  margin-top:2px;
}
._sg-dm-inp{
  flex:1;padding:9px 14px;
  background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.08);
  border-top:1px solid rgba(255,255,255,.16);
  border-radius:12px;
  color:#F0E8D8;font-size:.76rem;
  font-family:\'Outfit\',sans-serif;
  outline:none;
  backdrop-filter:blur(8px);
  transition:border-color .2s,box-shadow .2s;
}
._sg-dm-inp:focus{
  border-color:rgba(212,168,67,.42);
  box-shadow:0 0 0 3px rgba(212,168,67,.07),inset 0 1px 0 rgba(255,255,255,.06);
}
._sg-dm-inp::placeholder{color:rgba(212,168,67,.22);}
._sg-dm-send{
  padding:9px 16px;border-radius:12px;cursor:pointer;
  font-size:.85rem;font-weight:700;flex-shrink:0;
  background:linear-gradient(135deg,rgba(80,50,5,.9),rgba(200,150,42,.95),rgba(240,195,65,.98));
  border:1px solid rgba(255,255,255,.20);
  border-top:1px solid rgba(255,255,255,.32);
  color:#0A0600;
  box-shadow:0 2px 10px rgba(200,150,42,.25),inset 0 1px 0 rgba(255,255,255,.22);
  transition:all .2s cubic-bezier(.16,1,.3,1);
}
._sg-dm-send:hover{
  transform:translateY(-1px);
  box-shadow:0 5px 18px rgba(200,150,42,.38),inset 0 1px 0 rgba(255,255,255,.28);
}
._sg-dm-send:active{transform:scale(.95);transition:all .08s;}
/* DM notification floating banner */
._sg-dm-notif{
  position:fixed;top:64px;left:50%;
  transform:translateX(-50%) translateY(-20px);
  z-index:9500;display:flex;align-items:center;gap:10px;
  background:rgba(8,5,18,.97);
  border:1px solid rgba(212,168,67,.28);
  border-top:1px solid rgba(255,255,255,.16);
  border-radius:14px;padding:10px 16px;
  box-shadow:0 8px 32px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.07);
  backdrop-filter:blur(20px);
  cursor:pointer;max-width:88vw;
  font-family:\'Outfit\',sans-serif;
  opacity:0;transition:transform .3s cubic-bezier(.16,1,.3,1),opacity .3s;
  pointer-events:none;
}
._sg-dm-notif.show{
  transform:translateX(-50%) translateY(0);
  opacity:1;pointer-events:all;
}
/* Chat button in friend row */
._sg-bchat-wrap{
  position:relative;flex-shrink:0;display:flex;align-items:center;
}
._sg-bchat{
  padding:6px 10px;border-radius:9px;cursor:pointer;
  background:rgba(255,255,255,.05);
  border:1px solid ${GL.border};border-top:1px solid ${GL.hi};
  color:rgba(180,148,70,.65);font-size:.80rem;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  backdrop-filter:blur(8px);
  transition:all .2s cubic-bezier(.16,1,.3,1);
  position:relative;overflow:hidden;
}
._sg-bchat::before{content:'';position:absolute;top:0;left:0;right:0;height:50%;background:linear-gradient(to bottom,rgba(255,255,255,.06),transparent);pointer-events:none;border-radius:inherit;}
._sg-bchat:hover{
  background:rgba(212,168,67,.14);border-color:rgba(212,168,67,.38);
  color:rgba(212,168,67,.90);transform:translateY(-1px) scale(1.04);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 4px 14px rgba(212,168,67,.18);
}
._sg-bchat:active{transform:scale(.93) translateY(1px);box-shadow:inset 0 2px 5px rgba(0,0,0,.28);transition:all .07s ease;}
._sg-unread{
  position:absolute;top:-5px;right:-5px;
  background:#EF4444;color:#fff;
  border-radius:99px;padding:1px 5px;
  font-size:.52rem;font-weight:700;
  font-family:\'Outfit\',sans-serif;
  border:1.5px solid rgba(6,4,18,.95);
  animation:_sg-up .2s ease both;
  pointer-events:none;
}

/* ── Profile badge ── */
#_sg-badge{
  display:flex;align-items:center;gap:10px;
  padding:9px 13px;margin-bottom:0;
  background:${GL.bg};
  border:1px solid ${GL.goldDm};border-top:1px solid ${GL.hi};
  border-radius:${GL.r.md};
  backdrop-filter:${GL.bl.md};-webkit-backdrop-filter:${GL.bl.md};
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  cursor:pointer;position:relative;overflow:hidden;
  animation:_sg-in .4s cubic-bezier(.16,1,.3,1)both;
  transition:filter .18s,transform .18s;
}
#_sg-badge:hover{filter:brightness(1.08);transform:translateY(-1px)}
#_sg-badge:active{transform:none}
#_sg-badge ._sg-shim{
  position:absolute;top:0;left:0;width:35%;height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);
  animation:_sg-shimx 5s ease-in-out infinite;pointer-events:none;
}

/* ══ FRIENDS WIDGET (replaces text button) ══ */
#_sg-fw{
  margin-bottom:0;
  background:${GL.bg};
  border:1px solid ${GL.border};border-top:1px solid ${GL.hi};
  border-radius:${GL.r.md};
  backdrop-filter:${GL.bl.md};-webkit-backdrop-filter:${GL.bl.md};
  overflow:hidden;
  animation:_sg-in .4s ease both .06s;
  position:relative;
}
/* Widget header row */
#_sg-fw-hdr{
  display:flex;align-items:center;gap:8px;
  padding:9px 13px;cursor:pointer;
  transition:background .18s;
}
#_sg-fw-hdr:hover{background:rgba(255,255,255,.04)}
/* Animated avatar stack */
#_sg-av-stack{
  display:flex;align-items:center;
  flex-shrink:0;
}
._sg-stk-av{
  width:26px;height:26px;border-radius:50%;
  border:2px solid rgba(5,3,16,.9);
  background:rgba(212,168,67,.10);
  display:flex;align-items:center;justify-content:center;
  font-size:.68rem;overflow:hidden;object-fit:cover;
  animation:_sg-av-pop .3s cubic-bezier(.16,1,.3,1)both;
  flex-shrink:0;position:relative;
}
._sg-stk-av+._sg-stk-av{margin-left:-8px}
._sg-stk-av img{width:100%;height:100%;object-fit:cover;border-radius:50%}
/* Online pulse ring around avatar */
._sg-stk-av.online::after{
  content:'';position:absolute;inset:-2px;border-radius:50%;
  border:2px solid ${GL.ok};
  animation:_sg-ripple 2s ease-out infinite;
  opacity:.7;
}
/* More count bubble */
._sg-stk-more{
  width:26px;height:26px;border-radius:50%;
  background:rgba(212,168,67,.14);border:2px solid rgba(212,168,67,.28);
  margin-left:-8px;
  display:flex;align-items:center;justify-content:center;
  font-size:.52rem;font-weight:700;color:${GL.goldHi};
  animation:_sg-av-pop .3s ease both;
}
/* Widget label area */
#_sg-fw-label{
  flex:1;min-width:0;
}
._sg-fw-title{
  font-size:.74rem;font-weight:700;color:rgba(200,180,140,.82);
  font-family:\'Outfit\',sans-serif;
}
._sg-fw-sub{
  font-size:.58rem;color:rgba(180,148,70,.45);
  font-family:\'Outfit\',sans-serif;margin-top:1px;
}
/* Online count pill */
._sg-fw-pill{
  display:flex;align-items:center;gap:4px;
  padding:3px 9px;border-radius:${GL.r.full};
  background:rgba(16,185,129,.10);
  border:1px solid rgba(16,185,129,.28);
  font-size:.60rem;font-weight:700;color:${GL.ok};
  flex-shrink:0;transition:all .2s;
}
._sg-fw-pill .pill-dot{
  width:6px;height:6px;border-radius:50%;
  background:${GL.ok};
  animation:_sg-pulse 1.8s ease-in-out infinite;
}
/* Chevron */
._sg-fw-chev{
  font-size:.65rem;color:rgba(212,168,67,.35);flex-shrink:0;
  transition:transform .2s;
}
#_sg-fw-hdr.open ._sg-fw-chev{transform:rotate(180deg)}

/* Empty state */
._sg-empty{
  text-align:center;padding:22px 16px;
  font-size:.73rem;color:rgba(180,148,70,.38);
  font-family:\'Outfit\',sans-serif;line-height:1.7;
}
._sg-empty small{display:block;font-size:.62rem;opacity:.75;margin-top:3px}

/* Online dot standalone */
._sg-don{width:8px;height:8px;border-radius:50%;background:${GL.ok};display:inline-block;flex-shrink:0;animation:_sg-pulse 1.6s ease-in-out infinite,_sg-breathe 2s ease-in-out infinite}
._sg-doff{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.22);display:inline-block;flex-shrink:0}

/* Divider */
._sg-div{height:1px;background:linear-gradient(90deg,transparent,rgba(212,168,67,.10),transparent);margin:2px 0}

/* Search row */
._sg-srow{display:flex;gap:7px;align-items:center}
._sg-srow ._sg-inp{flex:1}
._sg-sadd{
  padding:9px 14px;border-radius:10px;border:none;cursor:pointer;
  background:linear-gradient(135deg,#0E5C1A,#16A34A);
  color:#fff;font-family:\'Outfit\',sans-serif;font-size:.78rem;font-weight:700;
  box-shadow:0 2px 12px rgba(22,163,74,.25);
  transition:all .18s;white-space:nowrap;flex-shrink:0;
}
._sg-sadd:hover{transform:translateY(-1px);box-shadow:0 4px 18px rgba(22,163,74,.36)}
._sg-sadd:disabled{opacity:.45;cursor:not-allowed;transform:none}

/* Requests pending badge */
._sg-req-badge{
  display:inline-flex;align-items:center;gap:4px;
  padding:2px 8px;border-radius:${GL.r.full};
  background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.28);
  font-size:.58rem;color:rgba(245,200,80,.85);font-weight:700;
}

/* ── DM Chat window ── */
._sg-dm-win{display:flex;flex-direction:column;background:rgba(6,4,16,.97);border:1px solid rgba(255,255,255,.08);border-top:1px solid rgba(255,255,255,.16);border-radius:20px;overflow:hidden;animation:_sg-in .3s cubic-bezier(.16,1,.3,1) both;}
._sg-dm-hdr{display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(0,0,0,.20);border-bottom:1px solid rgba(212,168,67,.10);}
._sg-dm-hdr-name{font-size:.78rem;font-weight:700;color:#F0E8D8;font-family:'Outfit',sans-serif;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
._sg-dm-hdr-status{font-size:.60rem;color:rgba(180,148,70,.45);font-family:'Outfit',sans-serif;}
._sg-dm-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:6px;max-height:300px;min-height:80px;scrollbar-width:thin;scrollbar-color:rgba(212,168,67,.10) transparent;}
._sg-dm-msgs::-webkit-scrollbar{width:3px}
._sg-dm-msgs::-webkit-scrollbar-thumb{background:rgba(212,168,67,.15);border-radius:99px}
._sg-bubble-out{align-self:flex-end;max-width:80%;padding:7px 12px;border-radius:14px 3px 14px 14px;background:rgba(212,168,67,.13);border:1px solid rgba(212,168,67,.22);border-top:1px solid rgba(255,255,255,.12);color:#F0E8D8;font-size:.72rem;line-height:1.5;font-family:'Outfit',sans-serif;word-break:break-word;animation:_sg-up .15s ease both;}
._sg-bubble-in{align-self:flex-start;max-width:80%;padding:7px 12px;border-radius:3px 14px 14px 14px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);border-top:1px solid rgba(255,255,255,.13);color:rgba(240,232,216,.85);font-size:.72rem;line-height:1.5;font-family:'Outfit',sans-serif;word-break:break-word;animation:_sg-up .15s ease both;}
._sg-dm-foot{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(212,168,67,.08);background:rgba(0,0,0,.15);}
._sg-dm-inp{flex:1;padding:8px 13px;background:rgba(255,255,255,.04);border:1px solid rgba(212,168,67,.16);border-top:1px solid rgba(255,255,255,.10);border-radius:12px;color:#F0E8D8;font-family:'Outfit',sans-serif;font-size:.74rem;outline:none;transition:all .2s;}
._sg-dm-inp:focus{border-color:rgba(212,168,67,.40);background:rgba(255,255,255,.07);box-shadow:0 0 0 3px rgba(212,168,67,.07);}
._sg-dm-inp::placeholder{color:rgba(212,168,67,.20);}
._sg-dm-send{padding:8px 14px;border-radius:12px;cursor:pointer;background:linear-gradient(135deg,rgba(80,50,5,.9),rgba(200,150,42,.9),rgba(240,195,65,.95));border:1px solid rgba(212,168,67,.42);border-top:1px solid rgba(255,255,255,.22);color:#0A0600;font-size:.78rem;font-weight:700;box-shadow:0 2px 10px rgba(200,150,42,.18);transition:all .2s cubic-bezier(.16,1,.3,1);}
._sg-dm-send:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(200,150,42,.32);}
._sg-dm-send:active{transform:scale(.94);transition:all .07s;}
._sg-dm-empty{text-align:center;padding:24px 0;font-size:.70rem;color:rgba(180,148,70,.28);font-family:'Outfit',sans-serif;}
`;
  document.head.appendChild(s);
}

/* ═══════════════════════════════ MODAL ════════════════════════════════ */
function _ensureBd(){
  if($('_sg-bd'))return;
  var bd=document.createElement('div');bd.id='_sg-bd';
  bd.addEventListener('click',function(e){if(e.target===bd)_close();});
  document.body.appendChild(bd);
}
function _open(html,onReady){
  _ensureBd();
  var bd=$('_sg-bd');
  bd.innerHTML='<div class="_sg-mw"><div class="_sg-mc" id="_sg-m">'+html+'</div></div>';
  bd.classList.add('on');
  if(onReady)setTimeout(function(){onReady($('_sg-m'));},60);
}
function _close(){
  var bd=$('_sg-bd');if(!bd)return;
  bd.classList.remove('on');
  setTimeout(function(){bd.innerHTML='';},320);
}
function _msg(id,t,html){
  var el=$(id);if(!el)return;
  el.className='_sg-msg on '+t;el.innerHTML=html;
}
window._sgClose=_close;

/* ═══════════════════════════ PROFILE EDIT ═════════════════════════════ */
async function _openEdit(){
  /* BUG FIX: Check _kp.type FIRST.
     If player arrived as Guest (_kp.type!=='auth'), always show Guest modal
     even if a stale Gmail Supabase session exists in the browser.
     Do NOT call _getUser() for guests — it would return the cached Gmail user. */
  var _isGuest = !_kp || _kp.type !== 'auth';
  var user = _isGuest ? null : await _getUser();
  var prof = _isGuest ? null : await _getProf();
  if(!user){
    _open(`
      <div class="_sg-hdr"><div class="_sg-htitle">Profile ပြင်မည်</div>
        <div class="_sg-hclose" onclick="window._sgClose()">✕</div></div>
      <div class="_sg-body">
        <div class="_sg-lbl">👤 Guest Name</div>
        <input class="_sg-inp" id="_sg-nm" maxlength="20" placeholder="နာမည်ထည့်ပါ..."
          value="${_x(_kp?.name||localStorage.getItem('kk_gnm')||'')}">
        <button class="_sg-bgold" onclick="window._sgSaveGuest()">✓ &nbsp;သိမ်းမည်</button>
        <div class="_sg-msg" id="_sg-emsg"></div>
        <button class="_sg-bglass" onclick="window._sgClose()">← ပြန်မည်</button>
      </div>`);
    return;
  }
  var nm=prof?.username||user.email?.split('@')[0]||'Player';
  var code=prof?.user_code||_kp?.id||'––––––';
  var av=prof?.avatar_url||user.user_metadata?.avatar_url||null;
  var avH=av
    ?'<img src="'+_x(av)+'" style="width:72px;height:72px;border-radius:50%;object-fit:cover;display:block" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="_sg-avfb" style="display:none">👤</div>'
    :'<div class="_sg-avfb">👤</div>';
  _open(`
    <div class="_sg-hdr"><div class="_sg-htitle">Profile ပြင်မည်</div>
      <div class="_sg-hclose" onclick="window._sgClose()">✕</div></div>
    <div class="_sg-body">
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div class="_sg-avw" onclick="document.getElementById('_sg-avinp').click()" title="ပုံ ပြောင်းရန်">
          ${avH}<div class="_sg-avov">📷</div>
        </div>
        <input type="file" id="_sg-avinp" accept="image/jpeg,image/png,image/webp,image/gif"
          style="display:none" onchange="window._sgUploadAv(this)">
        <div style="font-size:.58rem;color:rgba(212,168,67,.32);font-family:\'Outfit\',sans-serif">ပုံနှိပ်ပြောင်းနိုင် · 3MB အောက်</div>
      </div>
      <div>
        <div class="_sg-lbl" style="margin-bottom:6px">🪪 Player ID</div>
        <div onclick="window._sgCopyId('${_x(code)}')" style="
          display:inline-flex;align-items:center;gap:8px;padding:6px 13px;
          border-radius:${GL.r.full};background:${GL.goldDm};border:1px solid ${GL.goldBd};
          cursor:pointer;font-size:.72rem;font-family:\'Outfit\',monospace;font-weight:700;
          color:${GL.goldHi};letter-spacing:.08em;transition:background .16s;
        " onmouseover="this.style.background='rgba(212,168,67,.28)'"
           onmouseout="this.style.background='${GL.goldDm}'">
          🪪 <span id="_sg-idlbl">${_x(code)}</span>
          <span style="font-size:.48rem;opacity:.4">ကူးရန်</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="_sg-lbl">✏️ Username</div>
        <input class="_sg-inp" id="_sg-nm" maxlength="20" value="${_x(nm)}" placeholder="Username...">
        <button class="_sg-bgold" id="_sg-savebtn" onclick="window._sgSaveAuth()">✓ &nbsp;Username သိမ်းမည်</button>
      </div>
      <div style="font-size:.60rem;color:rgba(180,148,70,.40);text-align:center;font-family:\'Outfit\',sans-serif">${_x(user.email||'')}</div>
      <div class="_sg-msg" id="_sg-emsg"></div>
      <button class="_sg-bglass" onclick="window._sgClose()">← ပြန်မည်</button>
    </div>`);
}

window._sgSaveGuest=async function(){
  var nm=($('_sg-nm')?.value||'').trim();
  if(!nm||nm.length<2){_msg('_sg-emsg','er','⚠️ 2 လုံးနှင့်အထက်');return;}
  try{localStorage.setItem('kk_gnm',nm);}catch(e){}
  if(_kp){_kp.name=nm;try{sessionStorage.setItem('kk_player',JSON.stringify(_kp));}catch(e){}}
  var bnm=document.querySelector('#_sg-badge ._sg-bnm');if(bnm)bnm.textContent=nm;
  var ni=$('inp-name');if(ni)ni.value=nm;
  _msg('_sg-emsg','ok','✓ နာမည် ပြောင်းပြီးပါပြီ');
  setTimeout(_close,1200);
};

window._sgSaveAuth=async function(){
  var nm=($('_sg-nm')?.value||'').trim();
  if(!nm||nm.length<2){_msg('_sg-emsg','er','⚠️ 2 လုံးနှင့်အထက်');return;}
  var user=await _getUser();if(!user)return;
  var btn=$('_sg-savebtn');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="_sg-spin"></span>သိမ်းနေသည်…';}
  var sb=_sb();
  if(!sb){_msg('_sg-emsg','er','❌ Supabase မရပါ');if(btn&&$('_sg-m')){btn.disabled=false;btn.innerHTML='✓ &nbsp;Username သိမ်းမည်';}return;}
  try{
    var dup=await sb.from('profiles').select('id').ilike('username',nm).neq('id',user.id).maybeSingle();
    if(dup?.data){_msg('_sg-emsg','er','⚠️ Username ရှိပြီးသား — အခြား ရွေးပါ');if(btn&&$('_sg-m')){btn.disabled=false;btn.innerHTML='✓ &nbsp;Username သိမ်းမည်';}return;}
    await sb.from('profiles').update({username:nm,updated_at:new Date().toISOString()}).eq('id',user.id);
    if(_authProf)_authProf.username=nm;
    if(_kp){_kp.name=nm;try{sessionStorage.setItem('kk_player',JSON.stringify(_kp));}catch(e){}}
    var bnm=document.querySelector('#_sg-badge ._sg-bnm');if(bnm)bnm.textContent=nm;
    var ni=$('inp-name');if(ni)ni.value=nm;
    _msg('_sg-emsg','ok','✓ Username ပြောင်းပြီးပါပြီ');
    setTimeout(_close,1200);
  }catch(e){_msg('_sg-emsg','er','❌ '+(e.message||'မအောင်မြင်ပါ'));}
  if(btn&&$('_sg-m')){btn.disabled=false;btn.innerHTML='✓ &nbsp;Username သိမ်းမည်';}
};

window._sgUploadAv=async function(inp){
  var f=inp?.files?.[0];if(!f)return;
  var AL=['image/jpeg','image/png','image/webp','image/gif'];
  if(!AL.includes(f.type)){_msg('_sg-emsg','er','⚠️ JPEG/PNG/WEBP/GIF သာ');inp.value='';return;}
  if(f.size>3*1024*1024){_msg('_sg-emsg','er','⚠️ 3MB အောက်သာ');inp.value='';return;}
  var user=await _getUser();
  if(!user){_msg('_sg-emsg','er','⚠️ Gmail ဖြင့် ဝင်မှသာ');inp.value='';return;}
  _msg('_sg-emsg','ok','<span class="_sg-spin"></span>Upload နေသည်…');
  var EX={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
  var path=user.id+'/av.'+(EX[f.type]||'jpg');
  var sb=_sb();if(!sb)return;
  try{
    var ue=await sb.storage.from('avatars').upload(path,f,{upsert:true,contentType:f.type});
    if(ue.error)throw ue.error;
    var puRes=sb.storage.from('avatars').getPublicUrl(path);
    var pub=puRes?.data?.publicUrl||puRes?.publicUrl;
    if(!pub)throw new Error('URL ရမရပါ');
    /* Store CLEAN url in DB so other users get it without timestamp */
    var url=pub+'?t='+Date.now();
    await sb.from('profiles').update({avatar_url:pub,updated_at:new Date().toISOString()}).eq('id',user.id);
    if(_authProf)_authProf.avatar_url=url;
    if(_kp){_kp.avatar=url;try{sessionStorage.setItem('kk_player',JSON.stringify(_kp));}catch(e){}}
    var m=$('_sg-m');
    if(m){
      m.querySelectorAll('._sg-avw img').forEach(function(i){i.src=url;i.style.display='block';});
      m.querySelectorAll('._sg-avfb').forEach(function(fb){fb.style.display='none';});
    }
    var _bdg=document.querySelector('#_sg-badge');
    if(_bdg){
      var bav=_bdg.querySelector('img');
      if(bav){bav.src=url;}
      else{
        var bsp=_bdg.querySelector('span[style*="border-radius:50%"]');
        if(bsp){
          var bi=document.createElement('img');
          bi.src=url;bi.style.cssText='width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid '+GL.goldBd;
          bi.onerror=function(){bi.style.display='none';};
          _bdg.insertBefore(bi,bsp);bsp.remove();
        }
      }
    }
    _msg('_sg-emsg','ok','✓ ပုံ ပြောင်းပြီးပါပြီ');
  }catch(e){_msg('_sg-emsg','er','❌ '+(e.message||'Upload မရပါ'));}
  inp.value='';
};

window._sgCopyId=function(id){
  if(!id||id==='––––'||id==='––––––')return;
  navigator.clipboard?.writeText(id)
    .then(function(){
      var el=$('_sg-idlbl');if(el){el.textContent='✓ ကူးပြီး!';setTimeout(function(){el.textContent=id;},1400);}
    }).catch(function(){});
};

/* ═══════════════════════════ FRIENDS SYSTEM ═══════════════════════════ */
var _flist=[],_reqs={inc:[],out:[]},_online=new Set(),_pch=null;

async function _loadAll(){
  var user=await _getUser();if(!user)return;
  var sb=_sb();if(!sb)return;
  try{
    /* Accepted friends */
    var fd=await sb.from('friendships')
      .select('id,status,requester_id,addressee_id,req:profiles!requester_id(id,username,avatar_url,user_code),adr:profiles!addressee_id(id,username,avatar_url,user_code)')
      .or('requester_id.eq.'+user.id+',addressee_id.eq.'+user.id)
      .eq('status','accepted');
    _flist=fd.data||[];
    /* Pending requests */
    var rd=await sb.from('friendships')
      .select('id,status,requester_id,addressee_id,req:profiles!requester_id(id,username,avatar_url,user_code),adr:profiles!addressee_id(id,username,avatar_url,user_code)')
      .or('requester_id.eq.'+user.id+',addressee_id.eq.'+user.id)
      .neq('status','accepted');
    var raw=rd.data||[];
    _reqs.inc=raw.filter(function(f){return f.addressee_id===user.id&&f.status==='pending';});
    _reqs.out=raw.filter(function(f){return f.requester_id===user.id&&f.status==='pending';});
    /* Also load guest friend requests directed to this auth user */
    try{
      var gr=await sb.from('guest_friend_requests').select('*')
        .eq('to_uid',user.id).eq('status','pending');
      _reqs.guestInc=gr.data||[];
    }catch(e){_reqs.guestInc=[];}
  }catch(e){_flist=[];_reqs={inc:[],out:[]};}
  /* Fetch in-match status for all friends */
  var myId2=user.id;
  var friendUids=_flist.map(function(f){return f.requester_id===myId2?f.addressee_id:f.requester_id;}).filter(Boolean);
  if(friendUids.length){
    await _fetchFriendStatuses(friendUids);
    /* Subscribe to status changes (idempotent) */
    _startStatusListener(user,friendUids);
  }
}

async function _startPresence(user){
  var sb=_sb();if(!sb)return;
  if(_pch){
    if(_pch._sgFwch2){try{var _sb2=_sb();if(_sb2)_sb2.removeChannel(_pch._sgFwch2);}catch(e){}}
    if(_pch._sgBcast){try{sb.removeChannel(_pch._sgBcast);}catch(e){}}
    try{sb.removeChannel(_pch);}catch(e){}_pch=null;
  }

  /* ── BROADCAST channel for INSTANT online/offline ── */
  /* This fires in < 200ms vs presence which can take 5-30s */
  var _bcast=sb.channel('kk-online-bcast');
  _bcast
    .on('broadcast',{event:'online'},function(d){
      if(d.payload&&d.payload.uid&&d.payload.uid!==user.id){
        _online.add(d.payload.uid);
        _refreshWidget();_renderFriendTab();_renderOnlineCount();
      }
    })
    .on('broadcast',{event:'offline'},function(d){
      if(d.payload&&d.payload.uid){
        _online.delete(d.payload.uid);
        _refreshWidget();_renderFriendTab();_renderOnlineCount();
      }
    })
    .subscribe(async function(s){
      if(s==='SUBSCRIBED'){
        /* Announce myself as online instantly */
        try{await _bcast.send({type:'broadcast',event:'online',payload:{uid:user.id,ts:Date.now()}});}catch(e){}
      }
    });

  /* ── PRESENCE channel for initial sync & reconnect ── */
  _pch=sb.channel('kk-presence',{config:{presence:{key:user.id}}});
  _pch
    .on('presence',{event:'sync'},function(){
      var st=_pch.presenceState();
      _online=new Set(Object.keys(st).filter(function(k){return k!==user.id;}));
      _refreshWidget();_renderFriendTab();_renderOnlineCount();
    })
    .on('presence',{event:'join'},function(d){
      if(d.key&&d.key!==user.id)_online.add(d.key);
      _refreshWidget();_renderFriendTab();_renderOnlineCount();
    })
    .on('presence',{event:'leave'},function(d){
      if(d.key)_online.delete(d.key);
      _refreshWidget();_renderFriendTab();_renderOnlineCount();
    })
    .subscribe(async function(s){
      if(s==='SUBSCRIBED'){
        var prof=await _getProf();
        try{await _pch.track({user_id:user.id,username:prof?.username||'',ts:Date.now()});}catch(e){}
      }
    });

  /* Store broadcast channel on _pch for cleanup */
  _pch._sgBcast=_bcast
  /* Start DM listener (idempotent) */
  _startDMListener(user);;

  /* ── Heartbeat: re-announce online every 12s (keeps presence alive) ── */
  if(_pch._heartbeat)clearInterval(_pch._heartbeat);
  _pch._heartbeat=setInterval(function(){
    if(!_pch||!_pch._sgBcast)return;
    try{_pch._sgBcast.send({type:'broadcast',event:'online',payload:{uid:user.id,ts:Date.now()}});}catch(e){}
    /* Also re-track presence to prevent timeout */
    _getProf().then(function(prof){
      try{_pch.track({user_id:user.id,username:prof?.username||'',ts:Date.now()});}catch(e){}
    });
  },5000);

  /* ── Visibility: re-announce online / announce offline instantly ── */
  document.addEventListener('visibilitychange',function(){
    if(!_pch||!_pch._sgBcast)return;
    if(!document.hidden){
      /* Back to foreground → announce online */
      try{_pch._sgBcast.send({type:'broadcast',event:'online',payload:{uid:user.id,ts:Date.now()}});}catch(e){}
    } else {
      /* Hidden (background/locked) → announce offline */
      try{_pch._sgBcast.send({type:'broadcast',event:'offline',payload:{uid:user.id,ts:Date.now()}});}catch(e){}
    }
  });
  /* Page close/unload → announce offline (best-effort) */
  window.addEventListener('pagehide',function(){
    if(_pch&&_pch._sgBcast){
      try{_pch._sgBcast.send({type:'broadcast',event:'offline',payload:{uid:user.id,ts:Date.now()}});}catch(e){}
    }
  });

  /* Realtime friendship changes — refresh modal if open */
  var _fwch2=_sb().channel('_sg-frw-'+user.id);
  _fwch2
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'friendships',
      filter:'addressee_id=eq.'+user.id},
      async function(){
        await _loadAll();
        _renderReqTab();_updateReqBadge();_refreshWidget();
      })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'friendships'},
      async function(payload){
        var n=payload.new||{};
        if(n.requester_id===user.id||n.addressee_id===user.id){
          await _loadAll();
          _renderFriendTab();_renderReqTab();_updateReqBadge();_refreshWidget();
        }
      })
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'friendships'},
      async function(payload){
        var o=payload.old||{};
        if(o.requester_id===user.id||o.addressee_id===user.id){
          await _loadAll();
          _renderFriendTab();_renderReqTab();_updateReqBadge();_refreshWidget();
        }
      })
    .subscribe();
  /* Store so it gets cleaned up with presence */
  _pch._sgFwch2=_fwch2;
}

function _stopPresenceHeartbeat(){
  if(_pch&&_pch._heartbeat){clearInterval(_pch._heartbeat);_pch._heartbeat=null;}
}

/* ── Friend actions ── */
window._sgAddFriend=async function(){
  var code=($('_sg-addinp')?.value||'').trim().toUpperCase();
  if(!code||code.length<4){_msg('_sg-addmsg','er','⚠️ Player ID ထည့်ပါ');return;}
  var user=await _getUser();
  var isGuest=(!_kp)||(_kp.type!=='auth');

  /* ── GUEST MODE ── */
  if(!user||isGuest){
    var myGid=_kp?.id||'';
    if(code===myGid){_msg('_sg-addmsg','er','⚠️ ကိုယ့် ID မဖြစ်နိုင်');return;}
    if(_getGuestFriends().find(function(x){return x.user_code===code;})){
      _msg('_sg-addmsg','info','✓ ရှိပြီးသား သူငယ်ချင်း');return;
    }
    var sb=_sb();
    var btn=$('_sg-addbtn');if(btn){btn.disabled=true;btn.textContent='…';}
    try{
      /* Search auth profiles first, then guest_profiles */
      var target=null,targetUid=null,isTargetGuest=false;
      if(sb){
        var aRes=await sb.from('profiles').select('id,username,avatar_url,user_code').eq('user_code',code).maybeSingle();
        if(aRes?.data){target=aRes.data;targetUid=aRes.data.id;}
        if(!target){
          var gRes=await sb.from('guest_profiles').select('id,display_name').eq('id',code).maybeSingle();
          if(gRes?.data){
            target={user_code:gRes.data.id,username:gRes.data.display_name,avatar_url:null};
            isTargetGuest=true;
          }
        }
      }
      if(!target){
        _msg('_sg-addmsg','er','❌ ID မတွေ့ပါ: '+code);
        if(btn&&$('_sg-m')){btn.disabled=false;btn.textContent='ထည့်မည်';}
        return;
      }
      /* Send request via DB if target is auth, else store locally */
      if(!isTargetGuest&&targetUid&&sb){
        var myName=_kp?.name||'Guest';
        await sb.from('guest_friend_requests').insert({
          from_guest_id:myGid, from_guest_name:myName,
          to_player_code:code, to_uid:targetUid, status:'pending'
        });
        _msg('_sg-addmsg','ok','✓ '+_x(target.username||code)+' ထံ ခေါ်ချက် ပို့ပြီး');
      } else {
        /* Guest-to-guest: just store locally */
        _addGuestFriend({user_code:code,username:target.username||code,avatar_url:target.avatar_url||null,is_guest:true});
        _msg('_sg-addmsg','ok','✓ '+_x(target.username||code)+' ထည့်ပြီး');
        _renderFriendTab();
      }
      var inp=$('_sg-addinp');if(inp)inp.value='';
      setTimeout(function(){window._sgSetTab('fri');},800);
    }catch(e){
      console.error('addFriend guest:',e);
      _msg('_sg-addmsg','er','❌ '+(e.message||'မအောင်မြင်ပါ'));
    }
    if(btn&&$('_sg-m')){btn.disabled=false;btn.textContent='ထည့်မည်';}
    return;
  }

  if(!user)return;
  var prof=await _getProf();
  if(prof&&code===prof.user_code){_msg('_sg-addmsg','er','⚠️ ကိုယ့် ID မဖြစ်နိုင်');return;}
  var btn=$('_sg-addbtn');if(btn){btn.disabled=true;btn.textContent='…';}
  var sb=_sb();
  if(!sb){_msg('_sg-addmsg','er','❌ Supabase မရပါ');if(btn&&$('_sg-m')){btn.disabled=false;btn.textContent='ခေါ်မည်';}return;}
  /* ── Pre-flight: confirm own user_code is in DB before searching ──
     User may see their ID locally (deterministic fallback) but DB hasn't stored it.
     Try UPDATE then UPSERT to ensure it's persisted before the search. */
  if(user&&prof&&prof.user_code){
    try{
      var selfCheck=await sb.from('profiles').select('user_code').eq('id',user.id).single();
      if(!selfCheck.data?.user_code){
        _msg('_sg-addmsg','info','⏳ ID ကို DB မှာ သိမ်းနေသည်…');
        /* Try UPDATE first */
        var wr=await sb.from('profiles')
          .update({user_code:prof.user_code,updated_at:new Date().toISOString()})
          .eq('id',user.id).select('user_code').single();
        if(!wr.data?.user_code){
          /* UPDATE failed → UPSERT */
          await sb.from('profiles')
            .upsert({id:user.id,user_code:prof.user_code,updated_at:new Date().toISOString()},
                    {onConflict:'id',ignoreDuplicates:false});
        }
        await new Promise(function(r){setTimeout(r,600);});
      }
    }catch(e){console.warn('pre-flight write:',e);}
  }
  try{
    var tg=await sb.from('profiles').select('id,username').eq('user_code',code).single();
    if(tg.error||!tg.data){_msg('_sg-addmsg','er','❌ ID မတွေ့ပါ: '+code);if(btn&&$('_sg-m')){btn.disabled=false;btn.textContent='ခေါ်မည်';}return;}
    var ex=await sb.from('friendships').select('id,status')
      .or('and(requester_id.eq.'+user.id+',addressee_id.eq.'+tg.data.id+'),and(requester_id.eq.'+tg.data.id+',addressee_id.eq.'+user.id+')').maybeSingle();
    if(ex?.data){
      var _exRow=ex.data;
      if(_exRow.status==='accepted'){
        _msg('_sg-addmsg','ok','✓ ရှိပြီးသား သူငယ်ချင်း');
      } else if(_exRow.requester_id===user.id){
        _msg('_sg-addmsg','info','⏳ ခေါ်ချက် ပို့ပြီးသား — ပြန်ဖြေဆိုမည်ကို စောင့်နေသည်');
      } else {
        /* They already sent me a request */
        _msg('_sg-addmsg','info','💡 သူများကပဲ ခေါ်ထားသည် — ခေါ်ချက် Tab မှ လက်ခံနိုင်သည်');
        setTimeout(function(){window._sgSetTab('req');},800);
      }
      if(btn&&$('_sg-m')){btn.disabled=false;btn.textContent='ခေါ်မည်';}return;
    }
    await sb.from('friendships').insert({requester_id:user.id,addressee_id:tg.data.id,status:'pending'});
    var inp=$('_sg-addinp');if(inp)inp.value='';
    _msg('_sg-addmsg','ok','✓ '+_x(tg.data.username||code)+' ထံ ခေါ်ချက် ပို့ပြီးပါပြီ');
    await _loadAll();_renderReqTab();_updateReqBadge();
  }catch(e){_msg('_sg-addmsg','er','❌ '+(e.message||'မအောင်မြင်ပါ'));}
  if(btn&&$('_sg-m')){btn.disabled=false;btn.textContent='ခေါ်မည်';}
};

window._sgAccFri=async function(fid){
  var sb=_sb();if(!sb)return;
  try{await sb.from('friendships').update({status:'accepted'}).eq('id',fid);}catch(e){}
  await _loadAll();_renderFriendTab();_renderReqTab();_updateReqBadge();_refreshWidget();
};
window._sgDecFri=async function(fid){await window._sgDelFri(fid);};
window._sgDelFri=async function(fid){
  var sb=_sb();if(!sb)return;
  try{await sb.from('friendships').delete().eq('id',fid);}catch(e){}
  await _loadAll();_renderFriendTab();_renderReqTab();_updateReqBadge();_refreshWidget();
};

function _friAv(p,size){
  size=size||38;
  var _fb='<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:rgba(212,168,67,.08);display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(212,168,67,.18);font-size:'+Math.round(size*0.45)+'px">👤</div>';
  if(!p||!p.avatar_url)return _fb;
  /* Safe onerror: no nested quote escaping — show sibling fallback div */
  return '<img src="'+_x(p.avatar_url)+'"'+
    ' style="width:'+size+'px;height:'+size+'px;border-radius:50%;object-fit:cover;border:1.5px solid '+GL.goldBd+';display:block"'+
    ' loading="lazy"'+
    ' onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'flex\'">'+
    '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:rgba(212,168,67,.08);display:none;align-items:center;justify-content:center;border:1.5px solid rgba(212,168,67,.18);font-size:'+Math.round(size*0.45)+'px;flex-shrink:0">👤</div>';
}

function _renderFriendTab(){
  var box=$('_sg-ftab');if(!box)return;
  var myId=_authUser?.id||_kp?.uid||'';
  var isGuest=(!myId)||(_kp&&_kp.type!=='auth');

  /* Guest mode — localStorage friends */
  if(isGuest){
    var gfri=_getGuestFriends();
    if(!gfri.length){
      box.innerHTML='<div class="_sg-empty">သူငယ်ချင်း မရှိသေးပါ<small>Add tab မှ Player ID ဖြင့် ထည့်ပါ</small></div>';
      return;
    }
    box.innerHTML=gfri.map(function(g,idx){
      var avH=g.avatar_url
        ?'<img src="'+_x(g.avatar_url)+'" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:1.5px solid '+GL.goldBd+'" loading="lazy">'
        :'<div style="width:38px;height:38px;border-radius:50%;background:rgba(212,168,67,.08);display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(212,168,67,.18);font-size:1rem">👤</div>';
      return '<div class="_sg-fri _sg-fri-cl" style="animation-delay:'+(idx*0.04)+'s"'+
        ' onclick="window._sgOpenGuestFriProfile(\''+_x(g.user_code)+'\')">'+
        '<div class="_sg-fav-ring">'+avH+'<div class="_sg-sdot off"></div></div>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-size:.76rem;font-weight:700;color:#F0E8D8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:\'Outfit\',sans-serif">'+_x(g.username||'\u2013')+'</div>'+
          '<div style="display:flex;align-items:center;gap:5px;margin-top:2px">'+'<span style="font-size:.56rem;color:rgba(180,148,70,.55);background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.18);border-radius:4px;padding:1px 5px;font-family:\'Outfit\',sans-serif">👤 Guest</span>'+'<span style="font-size:.54rem;color:rgba(180,148,70,.35);font-family:\'Outfit\',monospace">'+_x(g.user_code||'')+'</span>'+'</div>'+
        '</div>'+
        '<button class="_sg-binv" onclick="event.stopPropagation();window._sgInviteFri(\''+_x(g.username||g.user_code||'')+'\')">📨 Invite</button>'+
      '</div>';
    }).join('');
    return;
  }

  /* Auth mode — DB friends */
  if(!_flist.length){
    box.innerHTML='<div class="_sg-empty">သူငယ်ချင်း မရှိသေးပါ<small>Add tab မှ Player ID ဖြင့် ထည့်ပါ</small></div>';
    return;
  }
  var onl=_flist.filter(function(f){var o=f.requester_id===myId?f.addressee_id:f.requester_id;return _online.has(o);});
  var off=_flist.filter(function(f){var o=f.requester_id===myId?f.addressee_id:f.requester_id;return !_online.has(o);});
  box.innerHTML=[...onl,...off].map(function(f,idx){
    var p=f.requester_id===myId?f.adr:f.req;if(!p)return'';
    var on=_online.has(p.id);
    return '<div class="_sg-fri _sg-fri-cl" style="animation-delay:'+(idx*0.04)+'s"'+
      ' onclick="window._sgOpenFriProfile(\''+f.id+'\')">'+
      '<div class="_sg-fav-ring">'+_friAv(p,38)+'<div class="_sg-sdot '+(on?'on':'off')+'"></div></div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:.76rem;font-weight:700;color:#F0E8D8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:\'Outfit\',sans-serif">'+_x(p.username||'–')+'</div>'+
        '<div style="display:flex;align-items:center;gap:5px;margin-top:2px">'+
          '<span class="'+(on?'_sg-don':'_sg-doff')+'"></span>'+
          '<span style="font-size:.60rem;color:'+(on?(_friendStatus[p.id]==='in_match'?'rgba(245,158,11,.85)':GL.ok):'rgba(255,255,255,.28)')+';font-family:\'Outfit\',sans-serif">'+(on?(_friendStatus[p.id]==='in_match'?'🎮 In Match':'Online'):'Offline')+'</span>'+
          (p.user_code?'<span style="font-size:.55rem;color:rgba(180,148,70,.40);font-family:\'Outfit\',monospace;margin-left:4px">'+_x(p.user_code)+'</span>':'')+
        '</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'+
      '<button class="_sg-binv" onclick="event.stopPropagation();window._sgInviteFri(\''+p.id+'\',\''+_x(p.username||p.user_code||'')+'\')">📨</button>'+
      '<div class="_sg-bchat-wrap" data-chat-uid="'+p.id+'" onclick="event.stopPropagation();window._sgOpenDM(\''+p.id+'\')">'+
        '<button class="_sg-bchat">💬</button>'+
        (_dmUnread[p.id]?'<span class="_sg-unread">'+_dmUnread[p.id]+'</span>':'')+
      '</div>'+
    '</div>'+
    '</div>';
  }).join('');
}

function _renderReqTab(){
  var inc=$('_sg-rinci');var out=$('_sg-routi');if(!inc||!out)return;
  var guestInc=_reqs.guestInc||[];
  var totalInc=_reqs.inc.length+guestInc.length;
  if(!totalInc&&!_reqs.out.length){
    inc.innerHTML='<div class="_sg-empty" style="padding:14px 0">ရောက်လာသော ခေါ်ချက် မရှိပါ</div>';
    out.innerHTML='<div class="_sg-empty" style="padding:14px 0">ပို့ထားသော ခေါ်ချက် မရှိပါ</div>';
    return;
  }
  /* Guest requests rendered first with Guest badge */
  var guestRows=guestInc.map(function(g){
    return '<div class="_sg-fri">'+
      '<div class="_sg-fav-ring">'+
        '<div style="width:38px;height:38px;border-radius:50%;background:rgba(212,168,67,.08);display:flex;align-items:center;justify-content:center;font-size:1rem;border:1px solid rgba(212,168,67,.18)">👤</div>'+
        '<div class="_sg-sdot off"></div>'+
      '</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:.76rem;font-weight:700;color:#F0E8D8;font-family:\'Outfit\',sans-serif">'+_x(g.from_guest_name||g.from_guest_id)+'</div>'+
        '<div style="display:flex;align-items:center;gap:5px;margin-top:2px">'+
          '<span style="font-size:.58rem;color:rgba(180,148,70,.55);background:rgba(212,168,67,.10);border:1px solid rgba(212,168,67,.2);border-radius:4px;padding:1px 5px;font-family:\'Outfit\',sans-serif">👤 Guest</span>'+
          '<span style="font-size:.56rem;color:rgba(180,148,70,.35);font-family:\'Outfit\',monospace">'+_x(g.from_guest_id)+'</span>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;gap:5px">'+
        '<button class="_sg-bsm _sg-badd" onclick="window._sgAccGuestFri(\''+g.id+'\'\,\''+_x(g.from_guest_id)+'\'\,\''+_x(g.from_guest_name||g.from_guest_id)+'\')">လက်ခံ</button>'+
        '<button class="_sg-bsm _sg-brem" onclick="window._sgDecGuestFri(\''+g.id+'\')">ငြင်းမည်</button>'+
      '</div>'+
    '</div>';
  }).join('');
  inc.innerHTML=_reqs.inc.map(function(f){
    var p=f.req;if(!p)return'';
    return '<div class="_sg-fri">'+
      '<div class="_sg-fav-ring">'+_friAv(p,38)+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:.76rem;font-weight:700;color:#F0E8D8;font-family:\'Outfit\',sans-serif">'+_x(p.username||'–')+'</div>'+
        (p.user_code?'<div style="font-size:.58rem;color:rgba(180,148,70,.40);font-family:\'Outfit\',monospace">'+_x(p.user_code)+'</div>':'')+
      '</div>'+
      '<div style="display:flex;gap:5px">'+
        '<button class="_sg-bsm _sg-badd" onclick="window._sgAccFri(\''+f.id+'\')">လက်ခံ</button>'+
        '<button class="_sg-bsm _sg-brem" onclick="window._sgDecFri(\''+f.id+'\')">ငြင်းမည်</button>'+
      '</div>'+
    '</div>';
  }).join('');
  inc.innerHTML = (guestRows + inc.innerHTML) || '<div class="_sg-empty" style="padding:14px 0">မရှိပါ</div>';
  out.innerHTML=_reqs.out.map(function(f){
    var p=f.adr;if(!p)return'';
    return '<div class="_sg-fri">'+
      '<div class="_sg-fav-ring">'+_friAv(p,38)+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:.76rem;font-weight:700;color:#F0E8D8;font-family:\'Outfit\',sans-serif">'+_x(p.username||'–')+'</div>'+
        (p.user_code?'<div style="font-size:.58rem;color:rgba(180,148,70,.40);font-family:\'Outfit\',monospace">'+_x(p.user_code)+'</div>':'')+
      '</div>'+
      '<span class="_sg-req-badge">⏳ Pending</span>'+
      '<button class="_sg-bsm _sg-bcan" style="margin-left:4px" onclick="window._sgDelFri(\''+f.id+'\')">ဖျက်မည်</button>'+
    '</div>';
  }).join('')||'<div class="_sg-empty" style="padding:14px 0">မရှိပါ</div>';
}

function _renderOnlineCount(){
  var pill=$('_sg-fw-pill-cnt');
  if(pill){
    var myId=_authUser?.id||_kp?.uid||'';
    var n=_flist.filter(function(f){var o=f.requester_id===myId?f.addressee_id:f.requester_id;return _online.has(o);}).length;
    pill.textContent=n;
    var pw=$('_sg-fw-pill');
    if(pw){pw.style.background=n>0?'rgba(16,185,129,.12)':'rgba(255,255,255,.05)';pw.style.borderColor=n>0?'rgba(16,185,129,.30)':'rgba(255,255,255,.08)';}
    var sub=$('_sg-fw-sub');
    if(sub){
      var tot=_flist.length;
      sub.textContent=tot?('သူငယ်ချင်း '+tot+' ဦး · Online '+n+' ဦး'):'သူငယ်ချင်း ထည့်မည်';
    }
  }
}

function _updateReqBadge(){
  var el=$('_sg-tab-req-badge');
  if(el){
    var n=(_reqs.inc?_reqs.inc.length:0)+(_reqs.guestInc?_reqs.guestInc.length:0);
    el.style.display=n?'':'none';el.textContent=n;
  }
}

/* ══════════════════════════════════════════════════════════
   FRIEND CHAT (DM) — real-time, both sides
══════════════════════════════════════════════════════════ */

var _dmCh=null;           /* DM realtime channel */
var _dmUnread={};         /* {uid: count} unread messages */
var _dmCurrentUid=null;   /* uid of currently open chat */

/* Start DM listener after auth user confirmed */
async function _startDMListener(user){
  if(_dmCh)return;
  var sb=_sb();if(!sb||!user)return;
  _dmCh=sb.channel('kk-dm-'+user.id);
  _dmCh
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'friend_messages',
        filter:'to_uid=eq.'+user.id},
      function(payload){
        var msg=payload.new;if(!msg)return;
        if(_dmCurrentUid===msg.from_uid){
          /* Chat is open → append message live */
          _appendDMMsg(msg.message,false,msg.from_uid);
        } else {
          /* Chat is closed → show notification + badge */
          _dmUnread[msg.from_uid]=(_dmUnread[msg.from_uid]||0)+1;
          _showDMNotif(msg.from_name||'Friend',msg.message,msg.from_uid);
          /* Update unread badge on friend row button */
          _updateDMBadge(msg.from_uid);
        }
      })
    .subscribe();
}

/* Show floating DM notification (works lobby + in-game) */
function _showDMNotif(senderName,text,fromUid){
  var old=document.getElementById('_sg-dm-notif');if(old)old.remove();
  var el=document.createElement('div');el.id='_sg-dm-notif';
  el.style.cssText='position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:9500;'+
    'background:rgba(8,5,18,.97);border:1px solid rgba(212,168,67,.25);'+
    'border-top:1px solid rgba(255,255,255,.14);border-radius:14px;'+
    'padding:10px 16px;display:flex;align-items:center;gap:10px;'+
    'box-shadow:0 8px 32px rgba(0,0,0,.6);cursor:pointer;max-width:88vw;'+
    'font-family:\'Outfit\',sans-serif;backdrop-filter:blur(20px);'+
    'animation:_sg-in .3s ease both';
  el.innerHTML=
    '<span style="font-size:1.1rem">💬</span>'+
    '<div style="flex:1;min-width:0">'+
      '<div style="font-size:.72rem;font-weight:700;color:#F0E8D8;white-space:nowrap">'+_x(senderName)+'</div>'+
      '<div style="font-size:.64rem;color:rgba(180,148,70,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">'+_x(text)+'</div>'+
    '</div>'+
    '<div style="font-size:.58rem;color:rgba(212,168,67,.45);flex-shrink:0;padding:3px 7px;background:rgba(212,168,67,.08);border-radius:6px;border:1px solid rgba(212,168,67,.15)">Reply ▸</div>';
  el.onclick=function(){el.remove();window._sgOpenDM(fromUid);};
  document.body.appendChild(el);
  setTimeout(function(){if(el&&el.parentNode){el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(function(){if(el.parentNode)el.remove();},300);}},5000);
}

/* Update unread badge on friend row chat button */
function _updateDMBadge(uid){
  var btn=document.querySelector('[data-chat-uid="'+uid+'"] ._sg-unread');
  if(!btn){
    var wrap=document.querySelector('[data-chat-uid="'+uid+'"]');
    if(wrap){
      var badge=document.createElement('span');badge.className='_sg-unread';
      badge.textContent=_dmUnread[uid];wrap.appendChild(badge);
    }
    return;
  }
  btn.textContent=_dmUnread[uid];
}

/* Open DM thread */
window._sgOpenDM=async function(friendUid){
  var user=await _getUser();if(!user)return;
  var sb=_sb();if(!sb)return;
  _currentDMFriend=friendUid;
  delete _dmUnread[friendUid];
  _updateDMBadge(friendUid);

  var myId=user.id;
  var friendName='Friend',friendAv=null,isOnline=false;
  var fr=_flist.find(function(f){return f.requester_id===friendUid||f.addressee_id===friendUid;});
  if(fr){var fp=fr.requester_id===myId?fr.adr:fr.req;if(fp){friendName=fp.username||'Friend';friendAv=fp.avatar_url;}}
  isOnline=_online.has(friendUid);

  var msgs=[];
  try{
    var res=await sb.from('friend_messages')
      .select('id,from_uid,message,created_at')
      .or('and(from_uid.eq.'+myId+',to_uid.eq.'+friendUid+'),and(from_uid.eq.'+friendUid+',to_uid.eq.'+myId+')')
      .order('created_at',{ascending:true}).limit(80);
    if(res.data)msgs=res.data;
  }catch(e){console.warn('DM load:',e);}

  var avH=friendAv
    ?'<img src="'+_x(friendAv)+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(212,168,67,.3)" loading="lazy">'
    :'<div style="width:28px;height:28px;border-radius:50%;background:rgba(212,168,67,.08);display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(212,168,67,.2);font-size:.85rem">👤</div>';

  var renderMsgs=function(list){
    if(!list.length)return'<div class="_sg-dm-empty">💬 Message မရှိသေးပါ<br><small>ပထမဆုံး Message ပေးပို့ပါ</small></div>';
    return list.map(function(m){
      return'<div class="'+(m.from_uid===myId?'_sg-bubble-out':'_sg-bubble-in')+'">'+_x(m.message)+'</div>';
    }).join('');
  };

  _open(
    '<div class="_sg-dm-win">'+
      '<div class="_sg-dm-hdr">'+
        '<div class="_sg-hclose" onclick="window._sgClose()" style="order:-1;margin-right:0">✕</div>'+
        avH+
        '<div style="flex:1;min-width:0">'+
          '<div class="_sg-dm-hdr-name">'+_x(friendName)+'</div>'+
          '<div class="_sg-dm-hdr-status"><span class="'+(isOnline?'_sg-don':'_sg-doff')+'" style="vertical-align:middle;margin-right:3px"></span>'+(isOnline?'Online':'Offline')+'</div>'+
        '</div>'+
      '</div>'+
      '<div class="_sg-dm-msgs" id="_sg-dm-msgs">'+renderMsgs(msgs)+'</div>'+
      '<div class="_sg-dm-foot">'+
        '<input class="_sg-dm-inp" id="_sg-dm-inp" placeholder="Message ရေးပါ…" maxlength="200"'+
          ' onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();window._sgSendDM(\''+friendUid+'\');}">'+
        '<button class="_sg-dm-send" onclick="window._sgSendDM(\''+friendUid+'\')">▶</button>'+
      '</div>'+
    '</div>',
    function(){
      var msgs=$('_sg-dm-msgs');if(msgs)msgs.scrollTop=msgs.scrollHeight;
      var inp=$('_sg-dm-inp');if(inp)inp.focus();
    }
  );
};

/* Append a message to the currently open chat */
function _appendDMMsg(text,isMe,fromUid){
  var box=document.getElementById('_sg-dm-msgs');if(!box)return;
  /* Remove empty placeholder */
  var empty=box.querySelector('._sg-dm-empty');if(empty)empty.remove();
  var d=document.createElement('div');
  d.className='_sg-dm-row '+(isMe?'me':'them');
  d.innerHTML='<div class="_sg-dm-bub">'+_x(text)+'</div>';
  box.appendChild(d);
  box.scrollTop=box.scrollHeight;
}

/* Send a message */
window._sgSendDM=async function(toUid){
  var inp=$('_sg-dm-inp');if(!inp)return;
  var msg=inp.value.trim();if(!msg)return;
  var user=await _getUser();if(!user)return;
  var sb=_sb();if(!sb)return;
  inp.value='';
  var fromName=_kp&&_kp.name?_kp.name:'Friend';
  /* Optimistic UI */
  var box=$('_sg-dm-msgs');
  if(box){
    var d=document.createElement('div');
    d.className='_sg-bubble-out';d.textContent=msg;
    box.appendChild(d);box.scrollTop=box.scrollHeight;
  }
  try{
    await sb.from('friend_messages').insert({
      from_uid:user.id,to_uid:toUid,message:msg,from_name:fromName
    });
  }catch(e){
    console.error('DM send:',e);
    /* Restore input on failure */
    if(inp)inp.value=msg;
    if(box&&box.lastChild&&box.lastChild.className==='_sg-bubble-out')box.removeChild(box.lastChild);
  }
};

/* ══════════════════════════════════════════════════════════
   ROOM INVITE SYSTEM — send, receive, accept, decline
══════════════════════════════════════════════════════════ */

/* Send room invite to a friend (both index.html lobby and auth.html) */
;

/* Start listening for incoming invites (runs after user verified) */
async function _startInviteListener(user){
  if(_inviteCh)return;
  var sb=_sb();if(!sb||!user)return;
  _inviteCh=sb.channel('kk-inv-'+user.id);
  _inviteCh
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'room_invites',
        filter:'to_uid=eq.'+user.id},
      function(payload){
        if(payload.new&&payload.new.status==='pending')_showInviteOverlay(payload.new);
      })
    .subscribe();
}

/* Show accept/decline overlay for incoming invite */
function _showInviteOverlay(inv){
  /* Don't interrupt if already in an active game */
  if(window.roomId&&window.roomId!=='AI'){return;}
  _ensureBd();
  var bd=$('_sg-bd');
  bd.innerHTML=
    '<div class="_sg-mw"><div class="_sg-mc" id="_sg-m">'+
      '<div class="_sg-hdr"><div class="_sg-htitle">📨 Room Invite</div></div>'+
      '<div class="_sg-body">'+
        '<div style="text-align:center;padding:18px 0 10px">'+
          '<div style="font-size:2rem;margin-bottom:10px">🎮</div>'+
          '<div style="font-size:.88rem;font-weight:700;color:#F0E8D8;margin-bottom:5px">'+_x(inv.from_name||'Friend')+'</div>'+
          '<div style="font-size:.70rem;color:rgba(180,148,70,.55);margin-bottom:14px">Room ကို ဖိတ်ခေါ်သည်</div>'+
          '<div style="font-family:\'Orbitron\',monospace;font-size:1.6rem;color:#F0CC72;letter-spacing:10px;font-weight:700;padding:10px;background:rgba(212,168,67,.08);border-radius:10px;border:1px solid rgba(212,168,67,.2)">'+_x(inv.room_code)+'</div>'+
        '</div>'+
        '<div class="_sg-fp-btns">'+
          '<button class="_sg-bgold" onclick="window._sgAcceptInvite(\''+inv.id+'\',\''+_x(inv.room_code)+'\')">✅ လက်ခံ</button>'+
          '<button class="_sg-brem _sg-bsm" style="flex:0.5;border-radius:10px;padding:10px" onclick="window._sgDeclineInvite(\''+inv.id+'\')">❌ ငြင်းမည်</button>'+
        '</div>'+
      '</div>'+
    '</div></div>';
  bd.classList.add('on');
}

window._sgAcceptInvite=async function(inviteId,roomCode){
  var sb=_sb();
  if(sb){try{await sb.from('room_invites').update({status:'accepted'}).eq('id',inviteId);}catch(e){}}
  window._sgClose&&window._sgClose();
  /* Pre-fill room code and join */
  var inp=$('inp-code');
  if(inp){inp.value=roomCode;}
  if(typeof window.joinRoom==='function'){
    /* Small delay to let modal close */
    setTimeout(function(){window.joinRoom();},100);
  }
};

window._sgDeclineInvite=async function(inviteId){
  var sb=_sb();
  if(sb){try{await sb.from('room_invites').update({status:'declined'}).eq('id',inviteId);}catch(e){}}
  window._sgClose&&window._sgClose();
};

/* Toast helper (works in index.html via game toast OR standalone) */
function _sgToast(msg){
  var t=document.getElementById('toast');
  if(t){t.textContent=msg;t.classList.add('on');clearTimeout(window._sgToastTimer);window._sgToastTimer=setTimeout(function(){t.classList.remove('on');},2800);return;}
  /* Fallback: floating div */
  var el=document.getElementById('_sg-toast');
  if(!el){el=document.createElement('div');el.id='_sg-toast';el.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(6,4,18,.97);border:1px solid rgba(212,168,67,.28);border-radius:12px;padding:10px 20px;font-size:.8rem;color:#F0E8D8;z-index:9999;pointer-events:none;font-family:\'Outfit\',sans-serif;transition:opacity .3s;white-space:nowrap';document.body.appendChild(el);}
  el.textContent=msg;el.style.opacity='1';
  clearTimeout(window._sgToastTimer);
  window._sgToastTimer=setTimeout(function(){el.style.opacity='0';},2800);
}

/* ══════════════════════════════════════════════════════════
   DIRECT MESSAGES — send, receive, in-game notification
══════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════
   IN-MATCH STATUS — track & display
══════════════════════════════════════════════════════════ */

/* Update own in-match status (called by showGame/doLeave wrappers) */
async function _updateMyStatus(status,roomCode){
  var user=await _getUser();if(!user)return;
  var sb=_sb();if(!sb)return;
  try{
    await sb.from('user_status').upsert({
      uid:user.id, status:status,
      room_code:roomCode||null,
      updated_at:new Date().toISOString()
    },{onConflict:'uid'});
  }catch(e){console.warn('status update:',e);}
}

/* Subscribe to friends' status changes */
async function _startStatusListener(user,friendUids){
  if(!friendUids||!friendUids.length)return;
  var sb=_sb();if(!sb||!user)return;
  /* Subscribe to user_status changes for each friend */
  var ch=sb.channel('kk-fstatus-'+user.id);
  ch.on('postgres_changes',{event:'*',schema:'public',table:'user_status'},
    function(payload){
      var row=payload.new||payload.old;
      if(!row)return;
      if(friendUids.indexOf(row.uid)>=0){
        _friendStatus[row.uid]=row.status||'lobby';
        /* Re-render friend list to update badge */
        _renderFriendTab();
      }
    })
    .subscribe();
}

/* Fetch current statuses for all friends */
async function _fetchFriendStatuses(uids){
  if(!uids||!uids.length)return;
  var sb=_sb();if(!sb)return;
  try{
    var res=await sb.from('user_status').select('uid,status').in('uid',uids);
    if(res.data)res.data.forEach(function(r){_friendStatus[r.uid]=r.status||'lobby';});
  }catch(e){}
}

/* Helper: close existing modal */
window._sgClose=function(){
  _dmCurrentUid=null;
  _close();
};

/* ══ FRIEND PROFILE MODAL ══ */
window._sgOpenFriProfile=function(fid){
  /* Find friend in _flist */
  var myId=_authUser?.id||_kp?.uid||'';
  var f=_flist.find(function(x){return x.id===fid;});
  if(!f)return;
  var p=f.requester_id===myId?f.adr:f.req;if(!p)return;
  var on=_online.has(p.id);
  var avH=p.avatar_url
    ?'<img class="_sg-fp-av" src="'+_x(p.avatar_url)+'" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'+'<div class="_sg-fp-avfb" style="display:none">👤</div>'
    :'<div class="_sg-fp-avfb">👤</div>';
  _open(`
    <div class="_sg-hdr">
      <div class="_sg-htitle">Friend Profile</div>
      <div class="_sg-hclose" onclick="window._sgClose()">✕</div>
    </div>
    <div class="_sg-body">
      <div class="_sg-fpcard">
        `+avH+`
        <div class="_sg-fp-name">`+_x(p.username||'–')+`</div>
        `+(p.user_code?'<div class="_sg-fp-id">🪪 '+_x(p.user_code)+'</div>':'')+`
        <div class="_sg-fp-status">
          <span class="`+(on?'_sg-don':'_sg-doff')+`"></span>
          <span style="color:`+(on?(_friendStatus[p.id]==='in_match'?'rgba(245,158,11,.9)':GL.ok):'rgba(255,255,255,.35)')+`">`+(on?(_friendStatus[p.id]==='in_match'?'🎮 In Match':'Online'):'Offline')+`</span>
        </div>
      </div>
      <div class="_sg-fp-btns">
        <button class="_sg-bgold" onclick="window._sgInviteFri('`+p.id+`','`+_x(p.username||p.user_code||'')+`')">
          📨 Invite
        </button>
        </button>
      </div>
      <button class="_sg-brem _sg-bsm" style="width:100%;border-radius:10px;padding:9px;margin-top:4px"
        onclick="if(confirm('`+_x(p.username||'–')+` ကို ဖယ်ရှားမည်လား?'))window._sgDelFri('`+fid+`')">
        ဖယ်ရှား
      </button>
      <button class="_sg-bglass" onclick="window._sgClose()">← ပြန်မည်</button>
    </div>`);
};

/* ══ GUEST FRIEND PROFILE MODAL ══ */
window._sgOpenGuestFriProfile=function(code){
  var gfri=_getGuestFriends();
  var g=gfri.find(function(x){return x.user_code===code;});if(!g)return;
  var avH=g.avatar_url
    ?'<img class="_sg-fp-av" src="'+_x(g.avatar_url)+'" loading="lazy">'
    :'<div class="_sg-fp-avfb">👤</div>';
  _open(`
    <div class="_sg-hdr">
      <div class="_sg-htitle">Friend Profile</div>
      <div class="_sg-hclose" onclick="window._sgClose()">✕</div>
    </div>
    <div class="_sg-body">
      <div class="_sg-fpcard">
        `+avH+`
        <div class="_sg-fp-name">`+_x(g.username||'–')+`</div>
        <div class="_sg-fp-id">🪪 `+_x(g.user_code)+`</div>
        <div class="_sg-fp-status">
          <span class="_sg-doff"></span>
          <span style="color:rgba(255,255,255,.35)">Status unknown (Guest mode)</span>
        </div>
      </div>
      <div class="_sg-fp-btns">
        <button class="_sg-bgold" onclick="window._sgInviteFri('`+_x(g.username||g.user_code)+`');window._sgClose()">
          📨 Room Invite
        </button>
        <button class="_sg-brem _sg-bsm" style="flex:0.5;border-radius:10px;padding:10px"
          onclick="if(confirm('`+_x(g.username||'–')+` ကို ဖယ်ရှားမည်လား?')){window._sgRemoveGuestFri('`+_x(code)+`');window._sgClose()}">
          ဖယ်ရှား
        </button>
      </div>
      <button class="_sg-bglass" onclick="window._sgClose()">← ပြန်မည်</button>
    </div>`);
};

/* ══ ROOM INVITE ══ */
window._sgInviteFri=function(name){
  /* Copy current lobby room code if exists, else just show hint */
  var rc=($('inp-code')||{}).value||'';
  if(rc&&rc.length>=4){
    var txt='မြန်မာ ကျားကွက် - Room: '+rc;
    navigator.clipboard?.writeText(txt)
      .then(function(){
        var t=document.getElementById('toast');
        if(t){t.textContent='📋 '+_x(name)+' ထံ Room Code ကူးပြီး: '+rc;t.style.opacity='1';t.style.bottom='80px';setTimeout(function(){t.style.opacity='0';t.style.bottom='-60px';},2800);}
      }).catch(function(){});
  } else {
    var t=document.getElementById('toast');
    if(t){t.textContent='💡 Room ဖန်တီးပြီးမှ Invite link ကူးနိုင်သည်';t.style.opacity='1';t.style.bottom='80px';setTimeout(function(){t.style.opacity='0';t.style.bottom='-60px';},2800);}
  }
};

/* ══ GUEST FRIEND SYSTEM (localStorage) ══ */
/* ML style: guests can add friends locally, carry over on account link */
var _GF_KEY='kk_gfri';

function _getGuestFriends(){
  try{var r=localStorage.getItem(_GF_KEY);return r?JSON.parse(r):[];}catch(e){return[];}
}
function _saveGuestFriends(arr){
  try{localStorage.setItem(_GF_KEY,JSON.stringify(arr));}catch(e){}
}
function _addGuestFriend(profile){
  /* profile = {user_code, username, avatar_url} */
  var list=_getGuestFriends();
  if(list.find(function(x){return x.user_code===profile.user_code;}))return false;
  list.push({user_code:profile.user_code,username:profile.username||'',avatar_url:profile.avatar_url||null,added_at:Date.now()});
  _saveGuestFriends(list);
  return true;
}
window._sgRemoveGuestFri=function(code){
  var list=_getGuestFriends().filter(function(x){return x.user_code!==code;});
  _saveGuestFriends(list);
  _renderFriendTab();
  /* update widget sub text */
  var sub=$('_sg-fw-sub');if(sub)sub.textContent=list.length?'သူငယ်ချင်း '+list.length+' ဦး (Guest)':'သူငယ်ချင်း ထည့်မည်';
};

/* ══ GUEST FRIEND REQUEST ACCEPT/DECLINE (by auth user) ══ */
window._sgAccGuestFri=async function(reqId,guestId,guestName){
  var sb=_sb();if(!sb)return;
  try{
    await sb.from('guest_friend_requests').update({status:'accepted'}).eq('id',reqId);
    /* Store as local guest friend on auth side */
    var gProf={user_code:guestId,username:guestName||guestId,avatar_url:null,is_guest:true};
    _addGuestFriend(gProf);
    await _loadAll();_renderFriendTab();_renderReqTab();_updateReqBadge();_refreshWidget();
  }catch(e){console.error('accGuestFri:',e);}
};
window._sgDecGuestFri=async function(reqId){
  var sb=_sb();if(!sb)return;
  try{
    await sb.from('guest_friend_requests').update({status:'declined'}).eq('id',reqId);
    if(_reqs.guestInc)_reqs.guestInc=_reqs.guestInc.filter(function(g){return g.id!==reqId;});
    _renderReqTab();_updateReqBadge();
  }catch(e){console.error('decGuestFri:',e);}
};

/* ══ LISTEN for incoming guest requests (auth users) ══ */
async function _startGuestReqListener(user){
  if(!user)return;
  var sb=_sb();if(!sb)return;
  var ch=sb.channel('kk-greq-'+user.id);
  ch.on('postgres_changes',{event:'INSERT',schema:'public',table:'guest_friend_requests',
      filter:'to_uid=eq.'+user.id},
    async function(payload){
      if(payload.new?.status==='pending'){
        if(!_reqs.guestInc)_reqs.guestInc=[];
        _reqs.guestInc.push(payload.new);
        _renderReqTab();_updateReqBadge();
        /* Toast notification */
        var nm=payload.new.from_guest_name||payload.new.from_guest_id||'Guest';
        var t=document.getElementById('toast');
        if(t){t.textContent='👤 '+_x(nm)+' (Guest) က သူငယ်ချင်း ခေါ်သည်';t.classList.add('on');
          setTimeout(function(){t.classList.remove('on');},3000);}
      }
    })
  .subscribe();
}

window._sgSetTab=function(t){
  ['fri','add','req'].forEach(function(x){
    var tb=$('_sg-tab-'+x);var bd=$('_sg-'+x+'tab');
    if(tb)tb.classList.toggle('on',x===t);
    if(bd)bd.classList.toggle('on',x===t);
  });
  if(t==='req')_renderReqTab();
};

/* ── Premium Friends Widget update ── */
function _refreshWidget(){
  var stack=$('_sg-av-stack');if(!stack)return;
  var myId=_authUser?.id||_kp?.uid||'';
  var onl=_flist.filter(function(f){var o=f.requester_id===myId?f.addressee_id:f.requester_id;return _online.has(o);});
  var off=_flist.filter(function(f){var o=f.requester_id===myId?f.addressee_id:f.requester_id;return !_online.has(o);});
  var show=[...onl,...off].slice(0,3);
  stack.innerHTML=show.map(function(f,i){
    var p=f.requester_id===myId?f.adr:f.req;if(!p)return'';
    var on=_online.has(p.id);
    var av=p.avatar_url
      ?'<img src="'+_x(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%" loading="lazy">'
      :'<span style="font-size:.65rem">👤</span>';
    return '<div class="_sg-stk-av'+(on?' online':'')+'" style="animation-delay:'+(i*0.06)+'s">'+av+'</div>';
  }).join('');
  if(!show.length)stack.innerHTML='<div class="_sg-stk-av" style="font-size:.7rem;color:rgba(212,168,67,.45)">+</div>';
  var extra=_flist.length-3;
  if(extra>0)stack.insertAdjacentHTML('beforeend','<div class="_sg-stk-more">+'+extra+'</div>');
  _renderOnlineCount();
}

/* ── Open Friends Modal ── */
async function _openFriends(){
  var user=await _getUser();
  if(!user){
    _open(`
      <div class="_sg-hdr"><div class="_sg-htitle">Friends</div>
        <div class="_sg-hclose" onclick="window._sgClose()">✕</div></div>
      <div class="_sg-body">
        <div style="padding:8px 12px;border-radius:9px;background:rgba(212,168,67,.07);border:1px solid rgba(212,168,67,.18);font-size:.70rem;color:rgba(212,168,67,.7);font-family:\'Outfit\',sans-serif;line-height:1.6">
          👤 Guest mode — သူငယ်ချင်းတွေ ဒီ device မှာ သိမ်းသည်<br>
          <span style="font-size:.62rem;opacity:.75">Gmail ဝင်ရောက်ရင် online status ကြည့်နိုင်မည်</span>
        </div>
        <div class="_sg-tabs">
          <button class="_sg-tab on" id="_sg-tab-fri" onclick="window._sgSetTab('fri')">👥 သူငယ်ချင်း</button>
          <button class="_sg-tab" id="_sg-tab-add" onclick="window._sgSetTab('add')">➕ ထည့်မည်</button>
        </div>
        <div class="_sg-tab-body on" id="_sg-fritab">
          <div id="_sg-ftab" style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;scrollbar-width:thin;padding-top:4px"></div>
        </div>
        <div class="_sg-tab-body" id="_sg-addtab">
          <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px">
            <div class="_sg-lbl">Player ID ဖြင့် ရှာမည်</div>
            <div class="_sg-srow">
              <input class="_sg-inp" id="_sg-addinp" maxlength="8" placeholder="e.g. KK3A7F2B"
                style="text-transform:uppercase;letter-spacing:2px"
                onkeydown="if(event.key==='Enter')window._sgAddFriend()">
              <button class="_sg-sadd" id="_sg-addbtn" onclick="window._sgAddFriend()">ထည့်မည်</button>
            </div>
            <div class="_sg-msg" id="_sg-addmsg"></div>
          </div>
        </div>
      </div>`,
      function(){ _renderFriendTab(); });
    return;
  }
  _open(`
    <div class="_sg-hdr">
      <div class="_sg-htitle">Friends</div>
      <div class="_sg-hclose" onclick="window._sgClose()">✕</div>
    </div>
    <div class="_sg-body">
      <div class="_sg-tabs">
        <button class="_sg-tab on" id="_sg-tab-fri" onclick="window._sgSetTab('fri')">👥 သူငယ်ချင်း</button>
        <button class="_sg-tab" id="_sg-tab-add" onclick="window._sgSetTab('add')">➕ ထည့်မည်</button>
        <button class="_sg-tab" id="_sg-tab-req" onclick="window._sgSetTab('req')">
          🔔 ခေါ်ချက်<span class="tab-badge" id="_sg-tab-req-badge" style="display:none">0</span>
        </button>
      </div>

      <!-- Friends tab -->
      <div class="_sg-tab-body on" id="_sg-fritab">
        <div id="_sg-ftab" style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(212,168,67,.10) transparent;padding-top:4px">
          <div style="text-align:center;padding:20px"><span class="_sg-spin"></span></div>
        </div>
      </div>

      <!-- Add tab -->
      <div class="_sg-tab-body" id="_sg-addtab">
        <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px">
          <div class="_sg-lbl">Player ID ဖြင့် ရှာမည်</div>
          <div class="_sg-srow">
            <input class="_sg-inp" id="_sg-addinp" maxlength="8" placeholder="e.g. KK3A7F2B"
              style="text-transform:uppercase;letter-spacing:2px"
              onkeydown="if(event.key==='Enter')window._sgAddFriend()">
            <button class="_sg-sadd" id="_sg-addbtn" onclick="window._sgAddFriend()">ခေါ်မည်</button>
          </div>
          <div class="_sg-msg" id="_sg-addmsg"></div>
        </div>
      </div>

      <!-- Requests tab -->
      <div class="_sg-tab-body" id="_sg-reqtab">
        <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px">
          <div class="_sg-lbl" style="margin-bottom:4px">📥 ရောက်လာသော ခေါ်ချက်</div>
          <div id="_sg-rinci" style="display:flex;flex-direction:column;gap:6px"></div>
          <div class="_sg-div"></div>
          <div class="_sg-lbl" style="margin-bottom:4px">📤 ပို့ထားသော ခေါ်ချက်</div>
          <div id="_sg-routi" style="display:flex;flex-direction:column;gap:6px"></div>
        </div>
      </div>

    </div>`,
    async function(){
      await _loadAll();
      if(!_pch){await _startPresence(user);}
      _startInviteListener(user);
      
      _renderFriendTab();_renderReqTab();_updateReqBadge();
    });
}

/* ═══════════════════════════ LOBBY WIDGET BUILD ═══════════════════════ */
function _buildLobby(p){
  if($('_sg-badge'))return;
  var lbox=document.querySelector('.lbox')
         ||document.querySelector('.lobby-box')
         ||document.querySelector('#lbox')
         ||document.querySelector('[class*="lobby"]');
  if(!lbox){
    if(window._sgBuildRetry===undefined)window._sgBuildRetry=0;
    if(window._sgBuildRetry<20){window._sgBuildRetry++;setTimeout(function(){_buildLobby(p);},150);}
    else{console.warn('[session-guard] .lbox not found after 3s');}
    return;
  }
  console.log('[session-guard] .lbox found, inserting badge...');

  /* ── Profile Badge ── */
  var badge=document.createElement('div');badge.id='_sg-badge';
  badge.title='Profile ပြင်ရန် နှိပ်ပါ';
  badge.addEventListener('click',_openEdit);
  var nm=p?p.name:(localStorage.getItem('kk_gnm')||'');
  /* Pre-fill name input from auth session or guest localStorage */
  var ni=$('inp-name');
  if(ni&&!ni.value&&nm)ni.value=nm;
  var avH=p&&p.avatar
    ?'<img src="'+_x(p.avatar)+'" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid '+GL.goldBd+';box-shadow:0 0 8px rgba(212,168,67,.18)" onerror="this.style.display=\'none\'">'
    :'<span style="width:32px;height:32px;border-radius:50%;background:'+GL.goldDm+';flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.05rem;border:1px solid '+GL.goldBd+'">👤</span>';
  var tag=p&&p.type==='auth'
    ?'<span style="color:'+GL.ok+';font-size:.56rem;font-family:\'Outfit\',sans-serif">✓ Gmail</span>'
    :'<span style="color:rgba(180,148,70,.45);font-size:.56rem;font-family:\'Outfit\',sans-serif">👤 Guest</span>';
  var idTag=p&&p.id?'<span style="color:rgba(212,168,67,.38);font-size:.56rem;font-family:\'Outfit\',monospace;letter-spacing:.05em">· '+_x(p.id)+'</span>':'';
  badge.innerHTML=
    '<div class="_sg-shim"></div>'+avH+
    '<div style="flex:1;min-width:0;overflow:hidden">'+
      '<div class="_sg-bnm" style="font-size:.76rem;font-weight:700;color:#F0E8D8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:\'Outfit\',sans-serif">'+_x(nm)+'</div>'+
      '<div style="display:flex;align-items:center;gap:5px;margin-top:1px;flex-wrap:wrap">'+tag+(idTag?'&nbsp;'+idTag:'')+'</div>'+
    '</div>'+
    '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">'+
    '<div style="font-size:.68rem;color:rgba(212,168,67,.32)">✎</div>'+
    ((_kp&&_kp.type==='auth')
      ? '<div id="_sg-logout-btn" style="font-size:.54rem;color:rgba(252,165,165,.55);cursor:pointer;font-family:Outfit,sans-serif;white-space:nowrap">Sign Out</div>'
      : '<div id="_sg-signin-btn" style="font-size:.54rem;color:rgba(16,185,129,.65);cursor:pointer;font-family:Outfit,sans-serif;white-space:nowrap">→ Sign In</div>'
    )+
    '</div>';

  /* ── Premium Friends Widget ── */
  var fw=document.createElement('div');fw.id='_sg-fw';
  fw.innerHTML=
    '<div id="_sg-fw-hdr" onclick="window._sgOpenFriends()">'+
      '<div id="_sg-av-stack"></div>'+
      '<div id="_sg-fw-label">'+
        '<div class="_sg-fw-title">Friends</div>'+
        '<div class="_sg-fw-sub" id="_sg-fw-sub">ရယူနေသည်…</div>'+
      '</div>'+
      '<div class="_sg-fw-pill" id="_sg-fw-pill">'+
        '<div class="pill-dot"></div>'+
        '<span id="_sg-fw-pill-cnt">–</span>'+
      '</div>'+
      '<div class="_sg-fw-chev">▾</div>'+
    '</div>';

  /* Wire Sign In / Log Out buttons after badge inserted */
  setTimeout(function(){
    var signinBtn=$('_sg-signin-btn');
    if(signinBtn){
      signinBtn.addEventListener('click',function(e){
        e.stopPropagation();
        /* Navigate to auth.html — clears guest mode */
        try{localStorage.setItem('kk_mode','auth');}catch(x){}
        var base=window.location.pathname.replace(/[^/]*$/,'');
        window.location.href=window.location.origin+base+'auth.html';
      });
    }
    var logoutBtn=$('_sg-logout-btn');
    if(logoutBtn){
      logoutBtn.addEventListener('click',function(e){
        e.stopPropagation();
        var base=window.location.pathname.replace(/[^/]*$/,'');
        window.location.href=window.location.origin+base+'auth.html?mode=logout';
      });
    }
  },80);
  var anchor=Array.from(lbox.querySelectorAll('.llbl')).find(function(el){return el.textContent.includes('သင့်အမည်');})||lbox.querySelector('.linp');
  if(anchor){lbox.insertBefore(badge,anchor);lbox.insertBefore(fw,anchor);}
  else{lbox.appendChild(badge);lbox.appendChild(fw);}
  console.log('[session-guard] badge + friends widget inserted ✓');

  /* Auto-start for auth */
  if(p&&p.type==='auth'){
    _getUser().then(function(u){
      if(!u)return;
      _loadAll().then(function(){
        _refreshWidget();
        if(!_pch)_startPresence(u).then(function(){_renderOnlineCount();_refreshWidget();});
        else{_renderOnlineCount();_refreshWidget();}
      });
      /* Start invite and DM listeners */
      _startInviteListener(u);
      
    });
  } else {
    var sub=$('_sg-fw-sub');
    if(sub){
      var gfri=_getGuestFriends();
      sub.textContent=gfri.length?'သူငယ်ချင်း '+gfri.length+' ဦး (Guest)':'သူငယ်ချင်း ထည့်မည်';
    }
    var pill=$('_sg-fw-pill');if(pill){pill.style.opacity='.4';}
    var stack=$('_sg-av-stack');if(stack)stack.innerHTML='<div class="_sg-stk-av" style="font-size:.7rem;color:rgba(212,168,67,.38)">👥</div>';
  }
}

window._sgOpenFriends=_openFriends;

/* ═══════════════════════════ GAME INJECT ══════════════════════════════ */
function _applyGame(p){
  if(window.spectatorMode)return;
  if(p.avatar){
    var av=$('my-av');
    if(av){
      av.style.backgroundImage='url(\''+p.avatar+'\')';
      av.style.backgroundSize='cover';av.style.backgroundPosition='center';
      av.style.backgroundRepeat='no-repeat';av.textContent='';
      var t=new Image();
      t.onerror=function(){av.style.backgroundImage='';av.textContent=window.myColor===1?'⬛':'⬜';};
      t.src=p.avatar;
    }
  }
  if(p.id){
    var prl=$('my-prl');
    if(prl){var blk=window.myColor===1;prl.textContent=(blk?'ပြာ':'နီ')+' · '+p.id;}
  }
}
function _cleanAv(){
  var av=$('my-av');
  if(av){av.style.backgroundImage=av.style.backgroundSize=av.style.backgroundPosition=av.style.backgroundRepeat='';}
}

/* ═════════════════════════ WRAP INDEX FUNCTIONS ═══════════════════════ */
var _oSG=window.showGame;
if(typeof _oSG==='function'){
  window.showGame=function(){
    _oSG.apply(this,arguments);
    if(_kp)_applyGame(_kp);
    /* Update in-match status */
    if(!window.spectatorMode&&window.roomId&&window.roomId!=='AI'){
      _updateMyStatus('in_match',window.roomId);
    }
  };
}
var _oDL=window.doLeave;
if(typeof _oDL==='function'){
  window.doLeave=async function(){
    _cleanAv();
    _updateMyStatus('lobby',null);
    return _oDL.apply(this,arguments);
  };
}
/* BUG 1: sfxMove in AI */
var _oAI=window.doAiMove;
if(typeof _oAI==='function'){
  window.doAiMove=async function(){
    var _f=false,_oL=window.addLog;
    if(typeof _oL==='function'){
      window.addLog=function(t){
        if(!_f&&typeof t==='string'&&t.includes('AI:')&&!t.includes('\u00d7')){_f=true;try{if(typeof window.sfxMove==='function')window.sfxMove();}catch(e){}}
        return _oL.apply(this,arguments);
      };
    }
    try{return await _oAI.apply(this,arguments);}
    finally{if(typeof _oL==='function')window.addLog=_oL;}
  };
}
/* BUG 2: resyncFromDB spectator guard */
var _oRS=window.resyncFromDB;
if(typeof _oRS==='function'){window.resyncFromDB=async function(){if(window.spectatorMode)return;return _oRS.apply(this,arguments);};}
/* BUG 3: autoRejoin oppName null */
var _oAR=window.autoRejoin;
if(typeof _oAR==='function'){
  window.autoRejoin=async function(){
    var _o=window.$s;
    if(typeof _o==='function'){
      window.$s=function(id,v){if((id==='opp-nm'||id==='opp-pnm')&&!v)v='\u1015\u103c\u102d\u102f\u1004\u103a\u1018\u1000\u103a';return _o.apply(this,arguments);};
      try{return await _oAR.apply(this,arguments);}
      finally{window.$s=_o;}
    }
    return _oAR.apply(this,arguments);
  };
}

/* ═══════════════════════════════ INIT ═════════════════════════════════ */
/* Diagnostic: prove this file loaded */
try{console.log('[session-guard v4] loaded. _kp=',_kp?'auth:'+_kp.type:'null');}catch(e){}
_css();
function _doInit(){
  _buildLobby(_kp);
  /* Always pre-fill name input regardless of badge state */
  var ni=$('inp-name');
  if(ni&&!ni.value){
    var _nm=(_kp&&_kp.name)||localStorage.getItem('kk_gnm')||'';
    if(_nm&&!_nm.startsWith('Guest·'))ni.value=_nm;
  }
  /* Auto-join room from invite (set by acceptInvite in auth.html) */
  var pendingRoom='';
  try{pendingRoom=sessionStorage.getItem('kk_pending_room')||'';}catch(e){}
  if(pendingRoom&&pendingRoom.length>=4){
    try{sessionStorage.removeItem('kk_pending_room');}catch(e){}
    var ci=$('inp-code');if(ci)ci.value=pendingRoom;
    /* Auto-join after short delay to let lobby render */
    setTimeout(function(){
      if(typeof window.joinRoom==='function')window.joinRoom();
    },600);
  }
  /* Start invite listener in index.html if user is authenticated */
  if(_kp&&_kp.type==='auth'){
    _getUser().then(function(u){
      if(u){_startInviteListener(u);}
    });
  }
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',_doInit);
}else{
  _doInit();
}
window._kkPlayer=_kp;
window._sgOpenEdit=_openEdit;

})();
