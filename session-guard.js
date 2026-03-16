/**
 * session-guard.js
 * Auth (auth.html) → Game (index.html) player data sync
 * Reads kk_player from sessionStorage (written by auth.html goGame())
 * and applies name / avatar / player-ID into the game UI.
 */
(function () {
  'use strict';

  const KEY = 'kk_player';

  /* ── Read player written by auth.html goGame() ── */
  let _kp = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) _kp = JSON.parse(raw);
  } catch (e) {}

  /* ── Sanitise HTML ── */
  function _esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ════════════════════════════════════════════════════════
     LOBBY — pre-fill name + show player badge
  ════════════════════════════════════════════════════════ */
  function _applyLobby(p) {
    /* Pre-fill name input if empty */
    const ni = document.getElementById('inp-name');
    if (ni && !ni.value && p.name) ni.value = p.name;

    /* Inject player info pill into lobby card */
    if (document.getElementById('_kk-player-badge')) return;
    const lbox = document.querySelector('.lbox');
    if (!lbox) return;

    const badge = document.createElement('div');
    badge.id = '_kk-player-badge';
    badge.style.cssText = [
      'display:flex', 'align-items:center', 'gap:10px',
      'padding:8px 13px', 'margin-bottom:8px',
      'background:rgba(212,168,67,0.06)',
      'border:1px solid rgba(212,168,67,0.16)',
      'border-top:1px solid rgba(255,255,255,0.10)',
      'border-radius:12px',
      'font-family:\'Outfit\',sans-serif',
      'backdrop-filter:blur(10px)',
      '-webkit-backdrop-filter:blur(10px)',
    ].join(';');

    const avHTML = p.avatar
      ? `<img src="${_esc(p.avatar)}"
           style="width:30px;height:30px;border-radius:50%;object-fit:cover;
                  border:1.5px solid rgba(212,168,67,0.38);flex-shrink:0;
                  box-shadow:0 0 8px rgba(212,168,67,0.20)"
           onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'👤',style:'font-size:1.1rem'}))">`
      : `<span style="width:30px;height:30px;border-radius:50%;
                      background:rgba(212,168,67,0.10);
                      display:flex;align-items:center;justify-content:center;
                      font-size:1rem;flex-shrink:0;
                      border:1px solid rgba(212,168,67,0.20)">👤</span>`;

    const typeLabel = p.type === 'auth'
      ? '<span style="color:var(--ok,#10B981);font-size:.58rem">✓ Gmail</span>'
      : '<span style="color:rgba(180,148,70,.60);font-size:.58rem">👤 Guest</span>';

    const idLabel = p.id
      ? `<span style="color:rgba(212,168,67,0.48);font-size:.58rem;
                      font-family:\'Outfit\',monospace;letter-spacing:.05em">${_esc(p.id)}</span>`
      : '';

    badge.innerHTML = `
      ${avHTML}
      <div style="flex:1;min-width:0;overflow:hidden">
        <div style="font-size:.76rem;font-weight:700;color:#F0E8D8;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${_esc(p.name)}
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:1px">
          ${typeLabel}${idLabel ? '&nbsp;·&nbsp;' + idLabel : ''}
        </div>
      </div>
    `;

    /* Insert right before the name label (llbl "👤 သင့်အမည်") */
    const nameLbl = Array.from(lbox.querySelectorAll('.llbl'))
      .find(el => el.textContent.includes('သင့်အမည်'));
    if (nameLbl) {
      lbox.insertBefore(badge, nameLbl);
    } else {
      /* Fallback: append before the first linp */
      const firstInp = lbox.querySelector('.linp');
      if (firstInp) lbox.insertBefore(badge, firstInp);
      else lbox.appendChild(badge);
    }
  }

  /* ════════════════════════════════════════════════════════
     GAME — apply avatar + player ID after showGame()
  ════════════════════════════════════════════════════════ */
  function _applyGame(p) {
    const spectatorMode = window.spectatorMode;
    if (spectatorMode) return;

    /* Avatar in player card (.pav) via background-image */
    if (p.avatar) {
      const myAv = document.getElementById('my-av');
      if (myAv) {
        myAv.style.backgroundImage  = `url('${p.avatar}')`;
        myAv.style.backgroundSize   = 'cover';
        myAv.style.backgroundPosition = 'center';
        myAv.style.backgroundRepeat = 'no-repeat';
        myAv.textContent = ''; /* hide fallback emoji */
        /* Fallback: if image fails to load, restore emoji */
        const testImg = new Image();
        testImg.onerror = function () {
          myAv.style.backgroundImage = '';
          myAv.textContent = window.myColor === 1 ? '⬛' : '⬜'; /* B===1 */
        };
        testImg.src = p.avatar;
      }
    }

    /* Player ID shown alongside role label */
    if (p.id) {
      const myPrl = document.getElementById('my-prl');
      if (myPrl) {
        const isBlk = (window.myColor === 1); /* B===1 */
        myPrl.textContent = (isBlk ? 'ပြာ' : 'နီ') + ' · ' + p.id;
      }
      /* Also add tooltip on name */
      const myNm = document.getElementById('my-nm');
      if (myNm) myNm.title = 'ID: ' + p.id;
    }
  }

  /* ════════════════════════════════════════════════════════
     LEAVE — clean up avatar CSS so next game starts fresh
  ════════════════════════════════════════════════════════ */
  function _cleanAvatarCSS() {
    const myAv = document.getElementById('my-av');
    if (myAv) {
      myAv.style.backgroundImage   = '';
      myAv.style.backgroundSize    = '';
      myAv.style.backgroundPosition = '';
      myAv.style.backgroundRepeat  = '';
    }
  }

  /* ════════════════════════════════════════════════════════
     WRAP global functions
  ════════════════════════════════════════════════════════ */

  /* showGame — wrap to inject player data after original runs */
  var _origShowGame = window.showGame;
  if (typeof _origShowGame === 'function') {
    window.showGame = function () {
      _origShowGame.apply(this, arguments);
      if (_kp) _applyGame(_kp);
    };
  }

  /* doLeave / _softLeave — wrap to clean up avatar CSS */
  var _origDoLeave = window.doLeave;
  if (typeof _origDoLeave === 'function') {
    window.doLeave = async function () {
      _cleanAvatarCSS();
      return _origDoLeave.apply(this, arguments);
    };
  }

  /* ── BUG FIX 1: sfxMove() missing in AI normal-move branch ──
     doAiMove mutates board + promotes + calls addLog but never sfxMove().
     We temporarily wrap addLog which is called right after the normal move. */
  var _origDoAiMove = window.doAiMove;
  if (typeof _origDoAiMove === 'function') {
    window.doAiMove = async function () {
      var _sfxFired = false;
      var _origAddLog = window.addLog;
      if (typeof _origAddLog === 'function') {
        window.addLog = function (t) {
          if (!_sfxFired && typeof t === 'string' && t.includes('AI:') && !t.includes('×')) {
            _sfxFired = true;
            try { if (typeof window.sfxMove === 'function') window.sfxMove(); } catch(e){}
          }
          return _origAddLog.apply(this, arguments);
        };
      }
      try {
        return await _origDoAiMove.apply(this, arguments);
      } finally {
        if (typeof _origAddLog === 'function') window.addLog = _origAddLog;
      }
    };
  }

  /* ── BUG FIX 2: resyncFromDB missing spectatorMode guard ──
     Spectators receive all state via broadcast already; a periodic
     DB re-sync can cause double-apply and stale-board flickers. */
  var _origResync = window.resyncFromDB;
  if (typeof _origResync === 'function') {
    window.resyncFromDB = async function () {
      if (window.spectatorMode) return;
      return _origResync.apply(this, arguments);
    };
  }

  /* ── BUG FIX 3: autoRejoin — oppName null/undefined safety ──
     Very old saved sessions may have oppName=undefined which renders
     as the string "undefined" in the DOM. */
  var _origAutoRejoin = window.autoRejoin;
  if (typeof _origAutoRejoin === 'function') {
    window.autoRejoin = async function () {
      var _origSet = window.$s;
      if (typeof _origSet === 'function') {
        window.$s = function (id, v) {
          if ((id === 'opp-nm' || id === 'opp-pnm') && !v) v = 'ပြိုင်ဘက်';
          return _origSet.apply(this, arguments);
        };
        try { return await _origAutoRejoin.apply(this, arguments); }
        finally { window.$s = _origSet; }
      }
      return _origAutoRejoin.apply(this, arguments);
    };
  }

  /* ════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════ */
  if (_kp) {
    _applyLobby(_kp);
  } else {
    /* No auth session — still pre-fill from localStorage guest name if present */
    const guestNm = (() => {
      try { return localStorage.getItem('kk_gnm'); } catch(e) { return null; }
    })();
    const ni = document.getElementById('inp-name');
    if (ni && !ni.value && guestNm && !guestNm.startsWith('Guest\u00b7')) {
      ni.value = guestNm;
    }
  }

  /* Expose for external debugging */
  window._kkPlayer = _kp;

})();
