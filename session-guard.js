/**
 * session-guard.js  v3.0
 * ─────────────────────────────────────────────────────────
 *  1. Auth → Game player sync  (name / avatar / ID badge)
 *  2. Profile Edit modal       (name change + avatar upload)
 *  3. Friends Online/Offline   (Supabase Presence panel)
 *  4. Index.html bug fixes     (sfxMove, resyncFromDB, autoRejoin)
 * ─────────────────────────────────────────────────────────
 *  Glass tokens from 0eb7fa540bde1768.css:
 *    --glass-bg:#ffffff14  --glass-border:#ffffff26
 *    blur-xl=24px  blur-2xl=40px
 */
(function () {
  'use strict';

  /* ── Design tokens ── */
  var GL = {
    bg     : '#ffffff14',
    border : '#ffffff26',
    hi     : 'rgba(255,255,255,0.18)',
    shadow : '0 8px 32px rgba(0,0,0,0.55)',
    gold   : '#D4A843', goldHi:'#F0CC72',
    goldDm : 'rgba(212,168,67,0.18)',
    goldBd : 'rgba(212,168,67,0.38)',
    ok     : '#10B981', err:'#EF4444',
    r      : { sm:'10px', md:'14px', xl:'22px', full:'999px' },
    bl     : { md:'blur(12px)', xl:'blur(24px)', xl2:'blur(40px)' },
  };

  /* ── Helpers ── */
  var $  = function(id){ return document.getElementById(id); };
  var _x = function(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var _sb = function(){ return (typeof window.SB==='function') ? window.SB() : null; };

  /* ── kk_player from sessionStorage ── */
  var _kp = null;
  try{ var _r=sessionStorage.getItem('kk_player'); if(_r) _kp=JSON.parse(_r); }catch(e){}

  /* ── Auth state ── */
  var _authUser=null, _authProf=null;

  async function _getUser(){
    if(_authUser) return _authUser;
    var sb=_sb(); if(!sb) return null;
    try{ var d=await sb.auth.getSession(); _authUser=d.data.session?.user||null; }catch(e){ _authUser=null; }
    return _authUser;
  }
  async function _getProf(){
    if(_authProf) return _authProf;
    var u=await _getUser(); if(!u) return null;
    var sb=_sb(); if(!sb) return null;
    try{ var d=await sb.from('profiles').select('*').eq('id',u.id).single(); _authProf=d.data; }catch(e){ _authProf=null; }
    return _authProf;
  }

  /* ══════════════════════════════════════════════
     STYLES
  ══════════════════════════════════════════════ */
  function _injectStyles(){
    if($('_sg-st')) return;
    var s=document.createElement('style'); s.id='_sg-st';
    s.textContent=`
@property --_sg-ang{syntax:'<angle>';initial-value:0deg;inherits:false}
@keyframes _sg-spin-bd{to{--_sg-ang:360deg}}
@keyframes _sg-up{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
@keyframes _sg-badge-in{from{opacity:0;transform:translateY(-5px) scale(.96)}to{opacity:1;transform:none}}
@keyframes _sg-shimx{0%{transform:translateX(-120%) skewX(-18deg);opacity:0}30%{opacity:.5}70%{opacity:.5}100%{transform:translateX(240%) skewX(-18deg);opacity:0}}
@keyframes _sg-spin{to{transform:rotate(360deg)}}
@keyframes _sg-breathe{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.5)}50%{box-shadow:0 0 0 5px rgba(16,185,129,0)}}
@keyframes _sg-dot-pulse{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.35);opacity:1}}

#_sg-backdrop{
  position:fixed;inset:0;z-index:9000;
  background:rgba(0,0,0,0);backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0);
  display:flex;align-items:center;justify-content:center;
  transition:background .3s,backdrop-filter .3s;
  pointer-events:none;visibility:hidden;
}
#_sg-backdrop.on{
  background:rgba(0,0,0,.74);
  backdrop-filter:${GL.bl.xl};-webkit-backdrop-filter:${GL.bl.xl};
  pointer-events:all;visibility:visible;
}
._sg-mwrap{
  position:relative;z-index:9001;border-radius:25px;padding:1.5px;
  animation:_sg-up .42s cubic-bezier(.16,1,.3,1) both;
}
._sg-mwrap::before{
  content:'';position:absolute;inset:0;border-radius:25px;z-index:-1;
  background:conic-gradient(from var(--_sg-ang),rgba(212,168,67,0),rgba(212,168,67,.5),rgba(240,204,114,.85),rgba(212,168,67,.5),rgba(212,168,67,0));
  animation:_sg-spin-bd 4s linear infinite;
}
._sg-modal{
  width:360px;max-width:92vw;max-height:85vh;overflow-y:auto;
  border-radius:24px;
  background:rgba(6,4,18,.97);
  backdrop-filter:${GL.bl.xl2};-webkit-backdrop-filter:${GL.bl.xl2};
  border:1px solid ${GL.border};border-top:1px solid ${GL.hi};
  box-shadow:${GL.shadow},0 0 60px rgba(212,168,67,.07);
  scrollbar-width:none;
}
._sg-modal::-webkit-scrollbar{display:none}
._sg-mhdr{padding:20px 20px 0;display:flex;align-items:center;justify-content:space-between}
._sg-mtitle{
  font-family:'Cinzel Decorative',serif;font-size:.88rem;font-weight:700;letter-spacing:.06em;
  background:linear-gradient(90deg,#D4A843,#F0CC72,#D4A843);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
._sg-mclose{
  width:28px;height:28px;border-radius:50%;cursor:pointer;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);
  display:flex;align-items:center;justify-content:center;
  color:rgba(255,255,255,.45);font-size:.9rem;flex-shrink:0;
  transition:all .16s;
}
._sg-mclose:hover{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.32);color:#fca5a5}
._sg-mbody{padding:16px 20px 22px;display:flex;flex-direction:column;gap:13px}
._sg-lbl{font-size:.60rem;color:rgba(212,168,67,.55);letter-spacing:2px;text-transform:uppercase;font-family:'Outfit',sans-serif;font-weight:600}
._sg-inp{
  width:100%;padding:9px 13px;border-radius:10px;outline:none;
  background:rgba(255,255,255,.04);
  border:1px solid ${GL.border};border-top:1px solid ${GL.hi};
  color:#F0E8D8;font-family:'Outfit',sans-serif;font-size:.88rem;
  backdrop-filter:${GL.bl.md};-webkit-backdrop-filter:${GL.bl.md};
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
  transition:border-color .2s,box-shadow .2s;
}
._sg-inp:focus{border-color:${GL.goldBd};box-shadow:0 0 0 3px rgba(212,168,67,.08)}
._sg-msg{padding:8px 12px;border-radius:9px;font-size:.74rem;line-height:1.5;display:none;font-family:'Outfit',sans-serif}
._sg-msg.on{display:block}._sg-msg.ok{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.24);color:#6ee7b7}
._sg-msg.er{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.24);color:#fca5a5}
._sg-bgold{
  width:100%;padding:10px 16px;border:none;border-radius:12px;cursor:pointer;
  background:linear-gradient(135deg,#4A2A04,#C0902A 35%,#E0B848 50%,#C08828 65%,#6A4008);
  border:1px solid rgba(255,255,255,.20);border-top:1px solid rgba(255,255,255,.32);
  color:#060300;font-family:'Outfit',sans-serif;font-size:.86rem;font-weight:700;letter-spacing:.3px;
  box-shadow:0 4px 18px rgba(200,150,42,.22),inset 0 1px 0 rgba(255,255,255,.18);
  transition:all .2s cubic-bezier(.16,1,.3,1);position:relative;overflow:hidden;
}
._sg-bgold:hover{transform:translateY(-1px);box-shadow:0 6px 26px rgba(200,150,42,.35)}
._sg-bgold:disabled{opacity:.45;cursor:not-allowed;transform:none}
._sg-bglass{
  width:100%;padding:9px 16px;border-radius:10px;cursor:pointer;
  background:${GL.bg};border:1px solid ${GL.border};border-top:1px solid ${GL.hi};
  color:rgba(200,180,255,.72);font-family:'Outfit',sans-serif;font-size:.80rem;font-weight:600;
  backdrop-filter:${GL.bl.md};-webkit-backdrop-filter:${GL.bl.md};
  transition:all .2s;box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
}
._sg-bglass:hover{background:rgba(255,255,255,.08);border-color:${GL.goldBd};color:${GL.goldHi}}
._sg-spin{
  width:13px;height:13px;border-radius:50%;
  border:2px solid rgba(255,255,255,.12);border-top-color:rgba(255,255,255,.75);
  animation:_sg-spin .7s linear infinite;
  display:inline-block;vertical-align:middle;margin-right:5px;
}
._sg-av-wrap{
  position:relative;width:72px;height:72px;border-radius:50%;
  cursor:pointer;margin:0 auto 8px;
}
._sg-av-wrap img,._sg-av-fb{
  width:72px;height:72px;border-radius:50%;object-fit:cover;display:block;
  border:2px solid ${GL.goldBd};
  box-shadow:0 0 18px rgba(212,168,67,.22),0 4px 16px rgba(0,0,0,.5);
  transition:filter .2s;
}
._sg-av-fb{
  background:rgba(212,168,67,.07);
  display:flex;align-items:center;justify-content:center;font-size:1.8rem;
}
._sg-av-wrap:hover img,._sg-av-wrap:hover ._sg-av-fb{filter:brightness(.62)}
._sg-av-ov{
  position:absolute;inset:0;border-radius:50%;
  background:rgba(0,0,0,.45);
  display:flex;align-items:center;justify-content:center;
  font-size:1.3rem;opacity:0;transition:opacity .2s;pointer-events:none;
}
._sg-av-wrap:hover ._sg-av-ov{opacity:1}
._sg-fri{
  display:flex;align-items:center;gap:10px;
  padding:9px 12px;border-radius:12px;
  background:${GL.bg};border:1px solid ${GL.border};border-top:1px solid ${GL.hi};
  transition:background .16s,transform .16s;
  animation:_sg-up .2s ease both;position:relative;overflow:hidden;
}
._sg-fri:hover{background:rgba(255,255,255,.06);transform:translateY(-1px)}
._sg-fav{width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid ${GL.goldBd}}
._sg-ffb{width:34px;height:34px;border-radius:50%;flex-shrink:0;background:rgba(212,168,67,.08);display:flex;align-items:center;justify-content:center;font-size:1rem;border:1.5px solid ${GL.goldDm}}
._sg-don{width:8px;height:8px;border-radius:50%;background:${GL.ok};display:inline-block;flex-shrink:0;animation:_sg-dot-pulse 1.6s ease-in-out infinite,_sg-breathe 2s ease-in-out infinite}
._sg-doff{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.22);display:inline-block;flex-shrink:0}
#_sg-badge{
  display:flex;align-items:center;gap:10px;
  padding:9px 13px;margin-bottom:8px;
  background:${GL.bg};
  border:1px solid ${GL.goldDm};border-top:1px solid ${GL.hi};
  border-radius:${GL.r.md};
  backdrop-filter:${GL.bl.md};-webkit-backdrop-filter:${GL.bl.md};
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  cursor:pointer;position:relative;overflow:hidden;
  animation:_sg-badge-in .4s cubic-bezier(.16,1,.3,1) both;
  transition:filter .18s,transform .18s;
}
#_sg-badge:hover{filter:brightness(1.08);transform:translateY(-1px)}
#_sg-badge:active{transform:none}
#_sg-badge ._sg-shim{
  position:absolute;top:0;left:0;width:35%;height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);
  animation:_sg-shimx 5s ease-in-out infinite;pointer-events:none;
}
#_sg-onbtn{
  display:flex;align-items:center;gap:7px;
  padding:8px 14px;margin-bottom:6px;
  background:${GL.bg};border:1px solid ${GL.border};border-top:1px solid ${GL.hi};
  border-radius:12px;cursor:pointer;width:100%;
  font-family:'Outfit',sans-serif;font-size:.76rem;color:rgba(200,180,140,.72);
  backdrop-filter:${GL.bl.md};-webkit-backdrop-filter:${GL.bl.md};
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  transition:all .2s;position:relative;overflow:hidden;
  animation:_sg-badge-in .4s ease both .08s;
}
#_sg-onbtn:hover{background:rgba(255,255,255,.07);border-color:${GL.goldBd};color:${GL.goldHi}}
._sg-oncnt{
  margin-left:auto;background:rgba(16,185,129,.10);
  border:1px solid rgba(16,185,129,.26);border-radius:${GL.r.full};
  padding:1px 8px;font-size:.58rem;font-weight:700;color:${GL.ok};
}
`;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════
     MODAL
  ══════════════════════════════════════════════ */
  function _ensureBg(){
    if($('_sg-backdrop')) return;
    var bg=document.createElement('div');
    bg.id='_sg-backdrop';
    bg.addEventListener('click',function(e){ if(e.target===bg) _close(); });
    document.body.appendChild(bg);
  }
  function _open(html, onReady){
    _ensureBg();
    var bg=$('_sg-backdrop');
    bg.innerHTML='<div class="_sg-mwrap"><div class="_sg-modal" id="_sg-m">'+html+'</div></div>';
    bg.classList.add('on');
    if(onReady) setTimeout(function(){ onReady($('_sg-m')); }, 60);
  }
  function _close(){
    var bg=$('_sg-backdrop'); if(!bg) return;
    bg.classList.remove('on');
    setTimeout(function(){ bg.innerHTML=''; }, 320);
  }
  function _msg(id, t, txt){
    var el=$(id); if(!el) return;
    el.className='_sg-msg on '+t; el.innerHTML=txt;
  }
  window._sgClose = _close;

  /* ══════════════════════════════════════════════
     PROFILE EDIT
  ══════════════════════════════════════════════ */
  async function _openEdit(){
    var user=await _getUser(), prof=await _getProf();

    if(!user){
      /* Guest-only edit */
      _open(`
        <div class="_sg-mhdr">
          <div class="_sg-mtitle">Profile ပြင်မည်</div>
          <div class="_sg-mclose" onclick="window._sgClose()">✕</div>
        </div>
        <div class="_sg-mbody">
          <div class="_sg-lbl">👤 Guest Name</div>
          <input class="_sg-inp" id="_sg-nm" maxlength="20"
            placeholder="နာမည်ထည့်ပါ..."
            value="${_x(_kp?.name||localStorage.getItem('kk_gnm')||'')}">
          <button class="_sg-bgold" onclick="window._sgSaveGuest()">✓ &nbsp;သိမ်းမည်</button>
          <div class="_sg-msg" id="_sg-emsg"></div>
          <button class="_sg-bglass" onclick="window._sgClose()">← ပြန်မည်</button>
        </div>`);
      return;
    }

    var nm   = prof?.username || user.email?.split('@')[0] || 'Player';
    var code = prof?.user_code || _kp?.id || '––––';
    var av   = prof?.avatar_url || user.user_metadata?.avatar_url || null;
    var avH  = av
      ? '<img src="'+_x(av)+'" style="width:72px;height:72px;border-radius:50%;object-fit:cover;display:block" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="_sg-av-fb" style="display:none">👤</div>'
      : '<div class="_sg-av-fb">👤</div>';

    _open(`
      <div class="_sg-mhdr">
        <div class="_sg-mtitle">Profile ပြင်မည်</div>
        <div class="_sg-mclose" onclick="window._sgClose()">✕</div>
      </div>
      <div class="_sg-mbody">
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
          <div class="_sg-av-wrap" onclick="document.getElementById('_sg-av-inp').click()" title="ပုံ ပြောင်းရန်">
            ${avH}
            <div class="_sg-av-ov">📷</div>
          </div>
          <input type="file" id="_sg-av-inp" accept="image/jpeg,image/png,image/webp,image/gif"
            style="display:none" onchange="window._sgUploadAv(this)">
          <div style="font-size:.60rem;color:rgba(212,168,67,.35);font-family:'Outfit',sans-serif">
            ပုံနှိပ်ပြောင်းနိုင် · 3MB အောက်
          </div>
        </div>

        <div>
          <div class="_sg-lbl">🪪 Player ID</div>
          <div onclick="window._sgCopyId('${_x(code)}')" style="
            display:inline-flex;align-items:center;gap:8px;padding:6px 13px;
            border-radius:${GL.r.full};background:${GL.goldDm};
            border:1px solid ${GL.goldBd};cursor:pointer;
            font-size:.72rem;font-family:'Outfit',monospace;font-weight:700;
            color:${GL.goldHi};letter-spacing:.08em;transition:background .16s;
          " onmouseover="this.style.background='rgba(212,168,67,.28)'"
             onmouseout="this.style.background='${GL.goldDm}'">
            🪪 <span id="_sg-idlbl">${_x(code)}</span>
            <span style="font-size:.50rem;opacity:.45">ကူးရန်</span>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px">
          <div class="_sg-lbl">✏️ Username</div>
          <input class="_sg-inp" id="_sg-nm" maxlength="20" value="${_x(nm)}" placeholder="Username...">
          <button class="_sg-bgold" id="_sg-savebtn" onclick="window._sgSaveAuth()">✓ &nbsp;Username သိမ်းမည်</button>
        </div>

        <div style="font-size:.62rem;color:rgba(180,148,70,.45);text-align:center;font-family:'Outfit',sans-serif">
          ${_x(user.email||'')}
        </div>
        <div class="_sg-msg" id="_sg-emsg"></div>
        <button class="_sg-bglass" onclick="window._sgClose()">← ပြန်မည်</button>
      </div>`);
  }

  window._sgSaveGuest = async function(){
    var nm=($('_sg-nm')?.value||'').trim();
    if(!nm||nm.length<2){ _msg('_sg-emsg','er','⚠️ 2 လုံးနှင့်အထက်'); return; }
    try{ localStorage.setItem('kk_gnm',nm); }catch(e){}
    if(_kp){ _kp.name=nm; try{ sessionStorage.setItem('kk_player',JSON.stringify(_kp)); }catch(e){} }
    var bnm=document.querySelector('#_sg-badge ._sg-bnm'); if(bnm) bnm.textContent=nm;
    var ni=$('inp-name'); if(ni) ni.value=nm;
    _msg('_sg-emsg','ok','✓ နာမည် ပြောင်းပြီးပါပြီ');
    setTimeout(_close,1200);
  };

  window._sgSaveAuth = async function(){
    var nm=($('_sg-nm')?.value||'').trim();
    if(!nm||nm.length<2){ _msg('_sg-emsg','er','⚠️ 2 လုံးနှင့်အထက်'); return; }
    var user=await _getUser(); if(!user) return;
    var btn=$('_sg-savebtn');
    if(btn){ btn.disabled=true; btn.innerHTML='<span class="_sg-spin"></span>သိမ်းနေသည်…'; }
    var sb=_sb();
    if(!sb){ _msg('_sg-emsg','er','❌ Supabase မရပါ'); if(btn){btn.disabled=false;btn.innerHTML='✓ &nbsp;Username သိမ်းမည်';} return; }
    try{
      var dup=await sb.from('profiles').select('id').ilike('username',nm).neq('id',user.id).maybeSingle();
      if(dup?.data){ _msg('_sg-emsg','er','⚠️ Username ရှိပြီးသား — အခြား ရွေးပါ'); if(btn){btn.disabled=false;btn.innerHTML='✓ &nbsp;Username သိမ်းမည်';} return; }
      await sb.from('profiles').update({username:nm,updated_at:new Date().toISOString()}).eq('id',user.id);
      if(_authProf) _authProf.username=nm;
      if(_kp){ _kp.name=nm; try{sessionStorage.setItem('kk_player',JSON.stringify(_kp));}catch(e){} }
      var bnm=document.querySelector('#_sg-badge ._sg-bnm'); if(bnm) bnm.textContent=nm;
      var ni=$('inp-name'); if(ni) ni.value=nm;
      _msg('_sg-emsg','ok','✓ Username ပြောင်းပြီးပါပြီ');
      setTimeout(_close,1200);
    }catch(e){ _msg('_sg-emsg','er','❌ '+(e.message||'မအောင်မြင်ပါ')); }
    /* Only re-enable if modal is still open (not already closing after success) */
    if(btn && $('_sg-m')){ btn.disabled=false; btn.innerHTML='✓ &nbsp;Username သိမ်းမည်'; }
  };

  window._sgUploadAv = async function(inp){
    var f=inp?.files?.[0]; if(!f) return;
    var AL=['image/jpeg','image/png','image/webp','image/gif'];
    if(!AL.includes(f.type)){ _msg('_sg-emsg','er','⚠️ JPEG/PNG/WEBP/GIF သာ'); inp.value=''; return; }
    if(f.size>3*1024*1024){ _msg('_sg-emsg','er','⚠️ 3MB အောက်သာ'); inp.value=''; return; }
    var user=await _getUser();
    if(!user){ _msg('_sg-emsg','er','⚠️ Gmail ဖြင့် ဝင်မှသာ'); inp.value=''; return; }
    _msg('_sg-emsg','ok','<span class="_sg-spin"></span>Upload နေသည်…');
    var EX={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
    var path=user.id+'/av.'+(EX[f.type]||'jpg');
    var sb=_sb(); if(!sb) return;
    try{
      var ue=await sb.storage.from('avatars').upload(path,f,{upsert:true,contentType:f.type});
      if(ue.error) throw ue.error;
      var puRes=sb.storage.from('avatars').getPublicUrl(path);
      var pub=puRes?.data?.publicUrl||puRes?.publicUrl;
      if(!pub) throw new Error('URL ရမရပါ');
      var url=pub+'?t='+Date.now();
      await sb.from('profiles').update({avatar_url:url,updated_at:new Date().toISOString()}).eq('id',user.id);
      if(_authProf) _authProf.avatar_url=url;
      if(_kp){ _kp.avatar=url; try{sessionStorage.setItem('kk_player',JSON.stringify(_kp));}catch(e){} }
      /* Update modal */
      var m=$('_sg-m');
      if(m){ m.querySelectorAll('._sg-av-wrap img').forEach(function(i){i.src=url;i.style.display='block';}); m.querySelectorAll('._sg-av-fb').forEach(function(fb){fb.style.display='none';}); }
      /* Update badge — works whether badge was built with img or span fallback */
      var _badge=document.querySelector('#_sg-badge');
      if(_badge){
        var bav=_badge.querySelector('img');
        if(bav){ bav.src=url; bav.style.display='block'; }
        else{
          /* First upload: replace span fallback with real img */
          var bsp=_badge.querySelector('span');
          if(bsp){
            var bi=document.createElement('img');
            bi.src=url; bi.style.cssText='width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid '+GL.goldBd+';box-shadow:0 0 8px rgba(212,168,67,.18)';
            bi.onerror=function(){bi.style.display='none';};
            _badge.insertBefore(bi,bsp); bsp.remove();
          }
        }
      }
      _msg('_sg-emsg','ok','✓ ပုံ ပြောင်းပြီးပါပြီ');
    }catch(e){ _msg('_sg-emsg','er','❌ '+(e.message||'Upload မရပါ')); }
    inp.value='';
  };

  window._sgCopyId = function(id){
    if(!id||id==='––––'||id==='––––––') return;
    navigator.clipboard?.writeText(id)
      .then(function(){
        var el=$('_sg-idlbl'); if(el){ el.textContent='✓ ကူးပြီး!'; setTimeout(function(){el.textContent=id;},1400); }
      }).catch(function(){});
  };

  /* ══════════════════════════════════════════════
     FRIENDS ONLINE / OFFLINE
  ══════════════════════════════════════════════ */
  var _flist=[], _online=new Set(), _pch=null;

  async function _loadFriends(){
    var user=await _getUser(); if(!user) return;
    var sb=_sb(); if(!sb) return;
    try{
      var d=await sb.from('friendships')
        .select('id,status,requester_id,addressee_id,req:profiles!requester_id(id,username,avatar_url,user_code),adr:profiles!addressee_id(id,username,avatar_url,user_code)')
        .or('requester_id.eq.'+user.id+',addressee_id.eq.'+user.id)
        .eq('status','accepted');
      _flist=d.data||[];
    }catch(e){ _flist=[]; }
  }

  async function _startPresence(user){
    var sb=_sb(); if(!sb) return;
    if(_pch){ try{sb.removeChannel(_pch);}catch(e){} }
    _pch=sb.channel('kk-presence',{config:{presence:{key:user.id}}});
    _pch
      .on('presence',{event:'sync'},function(){
        var st=_pch.presenceState();
        _online=new Set(Object.keys(st).filter(function(k){return k!==user.id;}));
        _renderFriends(); _updateOnlineCount();
      })
      .on('presence',{event:'join'},function(d){
        if(d.key) _online.add(d.key); _renderFriends(); _updateOnlineCount();
      })
      .on('presence',{event:'leave'},function(d){
        if(d.key) _online.delete(d.key); _renderFriends(); _updateOnlineCount();
      })
      .subscribe(async function(s){
        if(s==='SUBSCRIBED'){
          var prof=await _getProf();
          try{ await _pch.track({user_id:user.id,username:prof?.username||'',ts:Date.now()}); }catch(e){}
        }
      });
  }

  function _updateOnlineCount(){
    var el=document.querySelector('#_sg-onbtn ._sg-oncnt'); if(!el) return;
    var myId=_authUser?.id||_kp?.uid||'';
    var n=_flist.filter(function(f){ var oid=f.requester_id===myId?f.addressee_id:f.requester_id; return _online.has(oid); }).length;
    el.textContent=n>0?('🟢 '+n):'–';
  }

  function _renderFriends(){
    var box=$('_sg-frilist'); if(!box) return;
    var myId=_authUser?.id||_kp?.uid||'';
    if(!_flist.length){
      box.innerHTML='<div style="text-align:center;padding:22px 0;font-size:.74rem;color:rgba(180,148,70,.38);font-family:\'Outfit\',sans-serif">သူငယ်ချင်း မရှိသေးပါ<br><span style="font-size:.62rem;opacity:.75">Profile မှ Player ID ဖြင့် ထည့်ပါ</span></div>';
      return;
    }
    var onl=_flist.filter(function(f){var o=f.requester_id===myId?f.addressee_id:f.requester_id;return _online.has(o);});
    var off=_flist.filter(function(f){var o=f.requester_id===myId?f.addressee_id:f.requester_id;return !_online.has(o);});
    box.innerHTML=[...onl,...off].map(function(f){
      var p=f.requester_id===myId?f.adr:f.req; if(!p) return '';
      var on=_online.has(p.id);
      var avH=p.avatar_url
        ?'<img class="_sg-fav" src="'+_x(p.avatar_url)+'" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="_sg-ffb" style="display:none">👤</div>'
        :'<div class="_sg-ffb">👤</div>';
      return '<div class="_sg-fri">'+
        '<div style="position:relative;flex-shrink:0">'+avH+
        '<div style="position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;border:1.5px solid rgba(6,4,18,.9);background:'+(on?GL.ok:'rgba(255,255,255,.2)')+(on?';animation:_sg-breathe 2s infinite':'')+'">&nbsp;</div></div>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-size:.78rem;font-weight:700;color:#F0E8D8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:\'Outfit\',sans-serif">'+_x(p.username||'–')+'</div>'+
          '<div style="font-size:.58rem;color:rgba(180,148,70,.50);font-family:\'Outfit\',monospace;letter-spacing:.05em">'+_x(p.user_code||'')+'</div>'+
          '<div style="display:flex;align-items:center;gap:4px;margin-top:2px">'+
            '<span class="'+(on?'_sg-don':'_sg-doff')+'"></span>'+
            '<span style="font-size:.60rem;color:'+(on?GL.ok:'rgba(255,255,255,.28)')+';font-family:\'Outfit\',sans-serif">'+(on?'Online':'Offline')+'</span>'+
          '</div>'+
        '</div>'+
      '</div>';
    }).join('');
  }

  async function _openFriends(){
    var user=await _getUser();
    if(!user){
      _open(`
        <div class="_sg-mhdr">
          <div class="_sg-mtitle">Friends Online</div>
          <div class="_sg-mclose" onclick="window._sgClose()">✕</div>
        </div>
        <div class="_sg-mbody">
          <div style="text-align:center;padding:18px 0;font-size:.78rem;color:rgba(180,148,70,.50);font-family:'Outfit',sans-serif;line-height:1.8">
            Gmail ဖြင့် ဝင်ရောက်မှသာ<br>Friends Online / Offline ကြည့်နိုင်သည်
          </div>
          <button class="_sg-bglass" onclick="window._sgClose()">← ပြန်မည်</button>
        </div>`);
      return;
    }
    _open(`
      <div class="_sg-mhdr">
        <div class="_sg-mtitle">Friends Online</div>
        <div class="_sg-mclose" onclick="window._sgClose()">✕</div>
      </div>
      <div class="_sg-mbody">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="_sg-don"></span>
          <span style="font-size:.62rem;color:${GL.ok};font-family:'Outfit',sans-serif" id="_sg-flbl">ချိတ်ဆက်နေသည်…</span>
        </div>
        <div id="_sg-frilist" style="display:flex;flex-direction:column;gap:6px;max-height:340px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(212,168,67,.12) transparent">
          <div style="text-align:center;padding:22px;font-size:.74rem;color:rgba(180,148,70,.38);font-family:'Outfit',sans-serif">
            <span class="_sg-spin"></span>ရယူနေသည်…
          </div>
        </div>
        <button class="_sg-bglass" onclick="window._sgClose()">← ပြန်မည်</button>
      </div>`,
      async function(){
        await _loadFriends();
        await _startPresence(user);
        _renderFriends();
        var lbl=$('_sg-flbl');
        if(lbl) lbl.textContent='သူငယ်ချင်း '+_flist.length+' ဦး';
      });
  }

  /* ══════════════════════════════════════════════
     LOBBY INJECT
  ══════════════════════════════════════════════ */
  function _buildBadge(p){
    if($('_sg-badge')) return;
    var lbox=document.querySelector('.lbox'); if(!lbox) return;

    /* Badge */
    var badge=document.createElement('div');
    badge.id='_sg-badge';
    badge.title='Profile ပြင်ရန် နှိပ်ပါ';
    badge.addEventListener('click', _openEdit);
    var avH=p&&p.avatar
      ?'<img src="'+_x(p.avatar)+'" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid '+GL.goldBd+';box-shadow:0 0 8px rgba(212,168,67,.18)" onerror="this.style.display=\'none\'">'
      :'<span style="width:32px;height:32px;border-radius:50%;background:'+GL.goldDm+';flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.05rem;border:1px solid '+GL.goldBd+'">👤</span>';
    var nm=p?p.name:(localStorage.getItem('kk_gnm')||'Player');
    var tag=p&&p.type==='auth'
      ?'<span style="color:'+GL.ok+';font-size:.58rem">✓ Gmail</span>'
      :'<span style="color:rgba(180,148,70,.50);font-size:.58rem">👤 Guest</span>';
    var idTag=p&&p.id?'<span style="color:rgba(212,168,67,.40);font-size:.58rem;font-family:\'Outfit\',monospace;letter-spacing:.05em">· '+_x(p.id)+'</span>':'';
    badge.innerHTML='<div class="_sg-shim"></div>'+avH+
      '<div style="flex:1;min-width:0;overflow:hidden">'+
        '<div class="_sg-bnm" style="font-size:.76rem;font-weight:700;color:#F0E8D8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:\'Outfit\',sans-serif">'+_x(nm)+'</div>'+
        '<div style="display:flex;align-items:center;gap:5px;margin-top:1px;flex-wrap:wrap">'+tag+(idTag?'&nbsp;'+idTag:'')+'</div>'+
      '</div>'+
      '<div style="font-size:.70rem;color:rgba(212,168,67,.35);flex-shrink:0">✎</div>';

    /* Online btn */
    var onBtn=document.createElement('button');
    onBtn.id='_sg-onbtn';
    onBtn.innerHTML='<span style="font-size:.85rem">🟢</span><span style="font-family:\'Outfit\',sans-serif">Friends Online / Offline</span><span class="_sg-oncnt">–</span>';
    onBtn.addEventListener('click', _openFriends);

    var anchor=Array.from(lbox.querySelectorAll('.llbl')).find(function(el){return el.textContent.includes('သင့်အမည်');})
      ||lbox.querySelector('.linp');
    if(anchor){ lbox.insertBefore(badge,anchor); lbox.insertBefore(onBtn,anchor); }
    else{ lbox.appendChild(badge); lbox.appendChild(onBtn); }

    /* Auto presence for auth */
    if(p&&p.type==='auth'){
      _getUser().then(function(u){
        if(!u) return;
        _loadFriends().then(function(){
          /* Only start presence if not already subscribed (avoids duplicate on re-render) */
          if(!_pch){ _startPresence(u).then(function(){ _updateOnlineCount(); }); }
          else { _updateOnlineCount(); }
        });
      });
    }
  }

  /* ══════════════════════════════════════════════
     GAME INJECT
  ══════════════════════════════════════════════ */
  function _applyGame(p){
    if(window.spectatorMode) return;
    if(p.avatar){
      var av=$('my-av');
      if(av){
        av.style.backgroundImage='url(\''+p.avatar+'\')';
        av.style.backgroundSize='cover';
        av.style.backgroundPosition='center';
        av.style.backgroundRepeat='no-repeat';
        av.textContent='';
        var t=new Image();
        t.onerror=function(){av.style.backgroundImage='';av.textContent=window.myColor===1?'⬛':'⬜';};
        t.src=p.avatar;
      }
    }
    if(p.id){
      var prl=$('my-prl');
      if(prl){ var blk=window.myColor===1; prl.textContent=(blk?'ပြာ':'နီ')+' · '+p.id; }
    }
  }
  function _cleanAv(){
    var av=$('my-av');
    if(av){ av.style.backgroundImage=av.style.backgroundSize=av.style.backgroundPosition=av.style.backgroundRepeat=''; }
  }

  /* ══════════════════════════════════════════════
     WRAP INDEX FUNCTIONS
  ══════════════════════════════════════════════ */
  var _oSG=window.showGame;
  if(typeof _oSG==='function'){
    window.showGame=function(){
      _oSG.apply(this,arguments);
      if(_kp) _applyGame(_kp);
    };
  }
  var _oDL=window.doLeave;
  if(typeof _oDL==='function'){
    window.doLeave=async function(){ _cleanAv(); return _oDL.apply(this,arguments); };
  }

  /* BUG FIX 1 — sfxMove in AI normal move */
  var _oAI=window.doAiMove;
  if(typeof _oAI==='function'){
    window.doAiMove=async function(){
      var _f=false,_oL=window.addLog;
      if(typeof _oL==='function'){
        window.addLog=function(t){
          if(!_f&&typeof t==='string'&&t.includes('AI:')&&!t.includes('\u00d7')){
            _f=true; try{if(typeof window.sfxMove==='function')window.sfxMove();}catch(e){}
          }
          return _oL.apply(this,arguments);
        };
      }
      try{ return await _oAI.apply(this,arguments); }
      finally{ if(typeof _oL==='function') window.addLog=_oL; }
    };
  }

  /* BUG FIX 2 — resyncFromDB spectator guard */
  var _oRS=window.resyncFromDB;
  if(typeof _oRS==='function'){
    window.resyncFromDB=async function(){
      if(window.spectatorMode) return;
      return _oRS.apply(this,arguments);
    };
  }

  /* BUG FIX 3 — autoRejoin oppName null safety */
  var _oAR=window.autoRejoin;
  if(typeof _oAR==='function'){
    window.autoRejoin=async function(){
      var _o=window.$s;
      if(typeof _o==='function'){
        window.$s=function(id,v){
          if((id==='opp-nm'||id==='opp-pnm')&&!v) v='\u1015\u103c\u102d\u102f\u1004\u103a\u1018\u1000\u103a';
          return _o.apply(this,arguments);
        };
        try{ return await _oAR.apply(this,arguments); }
        finally{ window.$s=_o; }
      }
      return _oAR.apply(this,arguments);
    };
  }

  /* ══════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════ */
  _injectStyles();
  _buildBadge(_kp);

  window._kkPlayer=_kp;
  window._sgOpenEdit=_openEdit;
  window._sgOpenFriends=_openFriends;

})();
