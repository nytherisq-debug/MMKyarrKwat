/* ═══════════════════════════════════════════════════════════
   session-guard.js  v2
   — auth gate + presence heartbeat + friend online toast
   — profile chip injected in game topbar
   — auto-fill lobby name input
   ═══════════════════════════════════════════════════════════
   Usage: add ONE line inside index.html before </body>
   <script src="session-guard.js"></script>
*/
(function(){
  'use strict';
  const SB_URL='https://oxziinvwdhligrbllqbj.supabase.co';
  const SB_KEY='sb_publishable_8uBlwuN8DbyDfccT2uMaNw_9fpqYb6s';
  const AUTH='auth.html';
  let _sb=null,_user=null,_prof=null,_pch=null,_flist=[];
  const _online=new Set();

  function SB(){if(!_sb){if(!window.supabase)return null;_sb=window.supabase.createClient(SB_URL,SB_KEY);}return _sb;}

  /* ── wait for supabase CDN (already loaded by game) ── */
  function boot(){
    if(!window.supabase){let n=0;const iv=setInterval(()=>{if(window.supabase){clearInterval(iv);boot();}if(++n>80){clearInterval(iv);redirect();}},100);return;}
    checkSession();
  }

  function redirect(){window.location.replace(AUTH);}

  async function checkSession(){
    try{
      const{data:{session}}=await SB().auth.getSession();
      if(session){_user=session.user;await loadProf();inject();startPresence();return;}
    }catch(e){}
    if(localStorage.getItem('kk_guest')){inject();return;}
    redirect();
    SB().auth.onAuthStateChange((evt)=>{if(evt==='SIGNED_OUT'&&!localStorage.getItem('kk_guest'))redirect();});
  }

  /* ── load profile ── */
  async function loadProf(){
    if(!_user)return;
    try{
      const{data}=await SB().from('profiles').select('*').eq('id',_user.id).single();
      _prof=data;
    }catch(e){}
  }

  /* ── inject UI ── */
  function inject(){
    injectCSS();
    if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',injectAll);}
    else{injectAll();}
    /* watch for game screen appearing */
    const obs=new MutationObserver(()=>{
      if(document.getElementById('game')?.classList.contains('show'))buildTopbarChip();
      if(document.getElementById('lobby')?.classList.contains('show')){fillName();buildLobbyPill();}
    });
    obs.observe(document.body,{attributes:true,subtree:true,attributeFilter:['class']});
  }

  function injectAll(){
    fillName();buildLobbyPill();buildTopbarChip();
  }

  /* ── fill name ── */
  function fillName(){
    const inp=document.getElementById('inp-name');
    if(!inp||inp.value)return;
    const nm=_prof?.username||_user?.user_metadata?.full_name||_user?.email?.split('@')[0]||localStorage.getItem('kk_guest_name')||'Guest';
    inp.value=nm.slice(0,20);
  }

  /* ── CSS ── */
  function injectCSS(){
    if(document.getElementById('_sg-css'))return;
    const s=document.createElement('style');s.id='_sg-css';
    s.textContent=`
#_sg-pill{display:flex;align-items:center;gap:9px;padding:7px 11px;margin-bottom:13px;border-radius:12px;background:rgba(212,168,67,.055);border:1px solid rgba(212,168,67,.16);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);position:relative;overflow:hidden;animation:_sg-in .4s cubic-bezier(0,0,.2,1) both}
#_sg-pill::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(212,168,67,.45) 40%,rgba(212,168,67,.45) 60%,transparent)}
@keyframes _sg-in{from{opacity:0;transform:translateY(-9px)}to{opacity:1;transform:translateY(0)}}
._sg-av{width:32px;height:32px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(212,168,67,.32);box-shadow:0 0 8px rgba(212,168,67,.20);flex-shrink:0}
._sg-av-fb{width:32px;height:32px;border-radius:50%;background:rgba(212,168,67,.10);border:1.5px solid rgba(212,168,67,.26);display:flex;align-items:center;justify-content:center;font-size:.80rem;flex-shrink:0}
._sg-info{flex:1;min-width:0}
._sg-nm{font-size:.78rem;font-weight:600;color:#F0E8D8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
._sg-badge{font-size:.58rem;font-weight:500;letter-spacing:.06em;color:rgba(212,168,67,.62);margin-top:1px}
._sg-badge.guest{color:rgba(180,140,255,.68)}
._sg-btn{flex-shrink:0;padding:5px 10px;border:1px solid rgba(212,168,67,.17);border-radius:8px;background:transparent;color:rgba(200,184,136,.72);font-family:'Outfit',sans-serif;font-size:.68rem;font-weight:600;letter-spacing:.04em;cursor:pointer;transition:all .16s;-webkit-tap-highlight-color:transparent}
._sg-btn:hover{color:#F0CC72;background:rgba(212,168,67,.06);border-color:rgba(212,168,67,.36)}
#_sg-chip{display:flex;align-items:center;gap:5px;padding:3px 8px 3px 4px;border-radius:99px;background:rgba(212,168,67,.055);border:1px solid rgba(212,168,67,.16);cursor:pointer;transition:background .16s;-webkit-tap-highlight-color:transparent;position:relative}
#_sg-chip:hover{background:rgba(212,168,67,.10);border-color:rgba(212,168,67,.30)}
._sc-av{width:20px;height:20px;border-radius:50%;object-fit:cover;border:1px solid rgba(212,168,67,.28)}
._sc-av-fb{width:20px;height:20px;border-radius:50%;background:rgba(212,168,67,.12);display:flex;align-items:center;justify-content:center;font-size:.58rem}
._sc-nm{font-size:.63rem;font-weight:600;color:#C8B888;max-width:64px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#_sg-drop{display:none;position:absolute;top:calc(100% + 6px);right:0;width:170px;border-radius:12px;background:rgba(12,9,20,.94);border:1px solid rgba(212,168,67,.17);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:0 8px 28px rgba(0,0,0,.65);overflow:hidden;z-index:99999}
#_sg-drop.open{display:block;animation:_sg-in .18s ease both}
._sd-head{padding:9px 12px 7px;border-bottom:1px solid rgba(212,168,67,.08)}
._sd-nm{font-size:.76rem;font-weight:600;color:#F0E8D8}
._sd-em{font-size:.62rem;color:rgba(120,100,60,.75);margin-top:2px;word-break:break-all}
._sd-item{display:flex;align-items:center;gap:7px;width:100%;padding:8px 12px;background:none;border:none;cursor:pointer;font-family:'Outfit',sans-serif;font-size:.75rem;color:rgba(200,184,136,.78);text-align:left;transition:background .12s,color .12s}
._sd-item:hover{background:rgba(212,168,67,.06);color:#F0CC72}
._sd-item.d{color:rgba(239,100,100,.72)}_sd-item.d:hover{background:rgba(239,68,68,.07);color:#fca5a5}
/* FRIEND TOAST */
#_sg-toast{position:fixed;top:-60px;right:16px;z-index:99998;padding:10px 16px;border-radius:14px;background:rgba(12,9,20,.94);border:1px solid rgba(212,168,67,.22);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 6px 24px rgba(0,0,0,.60);font-family:'Outfit',sans-serif;font-size:.78rem;font-weight:600;color:#F0E8D8;max-width:240px;transition:all .35s cubic-bezier(0,0,.2,1);pointer-events:none;display:flex;align-items:center;gap:8px}
#_sg-toast .sg-dot{width:8px;height:8px;border-radius:50%;background:var(--ok,#10B981);box-shadow:0 0 8px var(--ok,#10B981);flex-shrink:0;animation:_sg-pulse 1.4s ease-in-out infinite alternate}
@keyframes _sg-pulse{0%{transform:scale(.8);opacity:.6}100%{transform:scale(1.3);opacity:1}}
`;
    document.head.appendChild(s);
  }

  /* ── lobby pill ── */
  function buildLobbyPill(){
    if(document.getElementById('_sg-pill'))return;
    const isGuest=!_user;
    const nm=_prof?.username||_user?.user_metadata?.full_name||_user?.email?.split('@')[0]||localStorage.getItem('kk_guest_name')||'Guest';
    const av=_prof?.avatar_url||_user?.user_metadata?.avatar_url||null;

    const w=document.createElement('div');w.id='_sg-pill';
    const avEl=document.createElement(av?'img':'div');
    if(av){avEl.src=av;avEl.className='_sg-av';avEl.alt='';avEl.onerror=()=>{avEl.className='_sg-av-fb';avEl.textContent='👤';};}
    else{avEl.className='_sg-av-fb';avEl.textContent='👤';}
    const info=document.createElement('div');info.className='_sg-info';
    info.innerHTML=`<div class="_sg-nm">${xe(nm)}</div><div class="_sg-badge${isGuest?' guest':''}">${isGuest?'👤 GUEST':'✦ SIGNED IN'}</div>`;
    const btn=document.createElement('button');btn.className='_sg-btn';
    btn.textContent=isGuest?'Sign In':'Profile';
    btn.onclick=()=>{ window.location.href = isGuest ? AUTH+'?mode=signin' : AUTH; };
    w.append(avEl,info,btn);
    const lbl=document.querySelector('.llbl');
    if(lbl)lbl.parentNode.insertBefore(w,lbl);
  }

  /* ── topbar chip ── */
  function buildTopbarChip(){
    if(document.getElementById('_sg-chip'))return;
    const tr=document.querySelector('.topbar-right');if(!tr)return;
    const isGuest=!_user;
    const nm=_prof?.username||_user?.user_metadata?.full_name||_user?.email?.split('@')[0]||localStorage.getItem('kk_guest_name')||'Guest';
    const av=_prof?.avatar_url||_user?.user_metadata?.avatar_url||null;
    const email=_user?.email||'';

    const chip=document.createElement('div');chip.id='_sg-chip';
    const avEl=document.createElement(av?'img':'div');
    if(av){avEl.src=av;avEl.className='_sc-av';avEl.alt='';avEl.onerror=()=>{avEl.className='_sc-av-fb';avEl.textContent='👤';};}
    else{avEl.className='_sc-av-fb';avEl.textContent='👤';}
    const nmEl=document.createElement('span');nmEl.className='_sc-nm';nmEl.textContent=nm;
    const drop=document.createElement('div');drop.id='_sg-drop';
    drop.innerHTML=`<div class="_sd-head"><div class="_sd-nm">${xe(nm)}</div>${email?`<div class="_sd-em">${xe(email)}</div>`:''}</div><button class="_sd-item" onclick="_sgProfile()">${isGuest?'🔑 &nbsp;Sign In / Sign Up':'👤 &nbsp;Profile & Friends'}</button><button class="_sd-item d" onclick="_sgLogout()">🚪 &nbsp;Log Out / Sign Out</button>`;
    chip.append(avEl,nmEl,drop);
    chip.addEventListener('click',e=>{e.stopPropagation();drop.classList.toggle('open');});
    document.addEventListener('click',()=>drop.classList.remove('open'));
    const pp=tr.querySelector('.ping-pill,#ping-pill');
    pp?tr.insertBefore(chip,pp):tr.prepend(chip);
  }

  window._sgProfile=function(){
    const isG = !_user && !!localStorage.getItem('kk_guest');
    window.location.href = isG ? AUTH+'?mode=signin' : AUTH;
  };
  window._sgLogout=async function(){
    stopP();localStorage.removeItem('kk_guest');localStorage.removeItem('kk_guest_name');
    try{await SB().auth.signOut();}catch(e){}
    window.location.replace(AUTH);
  };

  /* ── presence + friend online notifications ── */
  function startPresence(){
    if(!_user||!_prof)return;stopP();
    _pch=SB().channel('kk-presence',{config:{presence:{key:_user.id}}});
    _pch
      .on('presence',{event:'join'},({key})=>{
        _online.add(key);
        const f=_flist.find(x=>x.requester_id===key||x.addressee_id===key);
        if(f){const p=f.requester_id===_user.id?f.addressee:f.requester;notifyOnline(p.username||'Friend');}
      })
      .on('presence',{event:'leave'},({key})=>{_online.delete(key);})
      .subscribe(async(s)=>{if(s==='SUBSCRIBED')await _pch.track({user_id:_user.id,username:_prof?.username||'',online_at:new Date().toISOString()});});

    // load friends for notification matching
    SB().from('friendships').select(`id,requester_id,addressee_id,requester:profiles!requester_id(id,username),addressee:profiles!addressee_id(id,username)`).or(`requester_id.eq.${_user.id},addressee_id.eq.${_user.id}`).eq('status','accepted').then(({data})=>{_flist=data||[];});

    // new friend request notification
    SB().channel('kk-fri-sg').on('postgres_changes',{event:'INSERT',schema:'public',table:'friendships',filter:`addressee_id=eq.${_user.id}`},async(payload)=>{
      if(payload.new.status==='pending'){
        const{data:p}=await SB().from('profiles').select('username').eq('id',payload.new.requester_id).single();
        showFriToast('👤 '+xe(p?.username||'Someone')+' က သူငယ်ချင်း ခေါ်သည်',true);
      }
    }).subscribe();
  }
  function stopP(){if(_pch){SB().removeChannel(_pch);_pch=null;}}

  function notifyOnline(name){showFriToast('🟢 '+xe(name)+' Online ဖြစ်လာပါပြီ');chime(false);}

  /* ── friend toast (slides in from top-right) ── */
  let _ftTimer=null;
  function showFriToast(msg,isReq=false){
    if(!document.getElementById('_sg-toast')){
      const t=document.createElement('div');t.id='_sg-toast';
      const dot=document.createElement('div');dot.className='sg-dot';if(isReq)dot.style.background='#F0CC72';
      const txt=document.createElement('span');txt.id='_sg-toast-txt';
      t.append(dot,txt);document.body.appendChild(t);
    }
    document.getElementById('_sg-toast-txt').textContent=msg;
    document.getElementById('_sg-toast').style.top='80px';
    clearTimeout(_ftTimer);
    _ftTimer=setTimeout(()=>{const el=document.getElementById('_sg-toast');if(el)el.style.top='-60px';},4000);
    chime(isReq);
  }

  /* ── Web Audio chime ── */
  function chime(req=false){
    try{
      const ctx=new(window.AudioContext||window.webkitAudioContext)();
      if(req){
        [0,0.18].forEach((d,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(i===0?784:988,ctx.currentTime+d);g.gain.setValueAtTime(0,ctx.currentTime+d);g.gain.linearRampToValueAtTime(0.18,ctx.currentTime+d+0.02);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+d+0.32);o.start(ctx.currentTime+d);o.stop(ctx.currentTime+d+0.32);});
      }else{
        const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(880,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(660,ctx.currentTime+0.18);g.gain.setValueAtTime(0.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.40);o.start(ctx.currentTime);o.stop(ctx.currentTime+0.40);
      }
    }catch(e){}
  }

  function xe(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  boot();
})();
