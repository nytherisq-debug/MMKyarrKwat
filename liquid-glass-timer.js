/**
 * liquid-glass-timer.js  v2.0
 * ══════════════════════════════════════════════════════════════════════
 *  Myanmar ကျားကွက် — Premium Liquid Glass 30-Second Turn Timer
 * ──────────────────────────────────────────────────────────────────────
 *  index.html ထဲ </body> မတိုင်မီ ဒီ line ထည့်ပါ —
 *
 *  <script src="liquid-glass-timer.js" defer></script>
 *
 *  liquid-glass.css ကို ထည့်ပြီးသား ဖြစ်ရမည်။
 * ══════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  /* ────────────────────────────────────────────────────────────────
     CONFIG
  ──────────────────────────────────────────────────────────────── */
  var TIMER_SECONDS   = 30;     /* per-turn duration              */
  var WARN_AT         = 10;     /* seconds — switches to amber     */
  var DANGER_AT       = 5;      /* seconds — switches to red pulse */
  var TICK_MS         = 1000;   /* update interval                 */
  var AUTO_RESIGN     = true;   /* resign when MY timer hits 0     */
  var BEEP_ON_WARN    = true;   /* audio beep at warning threshold */
  var BEEP_ON_DANGER  = true;   /* audio beep at danger threshold  */

  /* ────────────────────────────────────────────────────────────────
     STATE
  ──────────────────────────────────────────────────────────────── */
  var _remaining    = TIMER_SECONDS;
  var _interval     = null;
  var _lastTurnText = '';       /* tracks #tlbl to detect turn change */
  var _lastOver     = false;    /* tracks game-over state              */
  var _lastLobby    = false;    /* tracks lobby visibility             */
  var _isMyTurn     = false;
  var _timerEl      = null;     /* root .lg-timer element              */
  var _progressEl   = null;     /* SVG circle.lg-timer-progress        */
  var _numEl        = null;     /* span.lg-timer-num                   */
  var _whoEl        = null;     /* span.lg-timer-who                   */
  var _subEl        = null;     /* span.lg-timer-sub                   */
  var _dotEl        = null;     /* span.lg-timer-dot                   */
  var _warned       = false;    /* beep guard — warn level             */
  var _dangered     = false;    /* beep guard — danger level           */

  /* SVG circle geometry: r=19 → circ = 2π×19 ≈ 119.38 */
  var RADIUS = 19;
  var CIRC   = 2 * Math.PI * RADIUS;

  /* ────────────────────────────────────────────────────────────────
     AUDIO UTILITY (reuse game's AudioContext if available)
  ──────────────────────────────────────────────────────────────── */
  function _beep(freq, dur, vol) {
    try {
      var ac = window._SAC;
      if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); window._SAC = ac; }
      if (ac.state === 'suspended') ac.resume();
      var o = ac.createOscillator();
      var g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sine';
      o.frequency.value = freq;
      var t = ac.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol || 0.18, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.10));
      o.start(t); o.stop(t + (dur || 0.12));
    } catch (e) {}
  }

  function _beepWarn() {
    _beep(660, 0.12, 0.15);
    setTimeout(function () { _beep(880, 0.10, 0.12); }, 100);
  }
  function _beepDanger() {
    _beep(440, 0.14, 0.22);
    setTimeout(function () { _beep(330, 0.12, 0.18); }, 120);
    setTimeout(function () { _beep(280, 0.16, 0.14); }, 240);
  }
  function _beepTick() {
    _beep(1100, 0.05, 0.06);
  }

  /* ────────────────────────────────────────────────────────────────
     TIMER ELEMENT BUILD
  ──────────────────────────────────────────────────────────────── */
  function _buildTimer() {
    var el = document.createElement('div');
    el.id        = 'lg-timer';
    el.className = 'lg-timer hidden';

    /* SVG ring */
    var ringWrap = document.createElement('div');
    ringWrap.className = 'lg-timer-ring';

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'lg-timer-svg');
    svg.setAttribute('viewBox', '0 0 44 44');

    /* track circle */
    var track = document.createElementNS(svgNS, 'circle');
    track.setAttribute('class', 'lg-timer-track');
    track.setAttribute('cx', '22'); track.setAttribute('cy', '22');
    track.setAttribute('r', String(RADIUS));

    /* progress circle */
    var progress = document.createElementNS(svgNS, 'circle');
    progress.setAttribute('class', 'lg-timer-progress');
    progress.setAttribute('cx', '22'); progress.setAttribute('cy', '22');
    progress.setAttribute('r', String(RADIUS));
    progress.style.strokeDasharray  = CIRC + 'px';
    progress.style.strokeDashoffset = '0px';

    svg.appendChild(track);
    svg.appendChild(progress);
    _progressEl = progress;

    /* center number overlay */
    var center = document.createElement('div');
    center.className = 'lg-timer-center';

    var numSpan = document.createElement('span');
    numSpan.className = 'lg-timer-num';
    numSpan.textContent = String(TIMER_SECONDS);
    _numEl = numSpan;

    center.appendChild(numSpan);
    ringWrap.appendChild(svg);
    ringWrap.appendChild(center);

    /* info text */
    var info = document.createElement('div');
    info.className = 'lg-timer-info';

    var who = document.createElement('span');
    who.className = 'lg-timer-who';
    who.textContent = 'Turn Timer';
    _whoEl = who;

    var sub = document.createElement('span');
    sub.className = 'lg-timer-sub';
    sub.textContent = '30s';
    _subEl = sub;

    info.appendChild(who);
    info.appendChild(sub);

    /* color dot */
    var dot = document.createElement('span');
    dot.className = 'lg-timer-dot';
    _dotEl = dot;

    el.appendChild(dot);
    el.appendChild(ringWrap);
    el.appendChild(info);

    _timerEl = el;
    return el;
  }

  /* ────────────────────────────────────────────────────────────────
     INJECT TIMER INTO DOM
     Placed between #opp-bar and .bframe in .center div
  ──────────────────────────────────────────────────────────────── */
  function _injectTimer() {
    if (document.getElementById('lg-timer')) return;

    var el = _buildTimer();
    var bframe = document.querySelector('.bframe');
    if (bframe && bframe.parentNode) {
      bframe.parentNode.insertBefore(el, bframe);
    } else {
      /* fallback: append to .center */
      var center = document.querySelector('.center');
      if (center) center.insertBefore(el, center.firstChild);
    }
  }

  /* ────────────────────────────────────────────────────────────────
     DISPLAY UPDATE
  ──────────────────────────────────────────────────────────────── */
  function _updateDisplay(secs, isMyTurn, isOver, isSpectator) {
    if (!_timerEl) return;

    var pct = secs / TIMER_SECONDS;
    var offset = CIRC * (1 - pct);

    if (_progressEl) {
      _progressEl.style.strokeDashoffset = offset + 'px';
    }

    if (_numEl) {
      var prevVal = _numEl.textContent;
      var newVal  = String(secs);
      if (prevVal !== newVal) {
        _numEl.classList.remove('tick');
        void _numEl.offsetWidth; /* reflow to restart animation */
        _numEl.classList.add('tick');
        _numEl.textContent = newVal;
      }
    }

    if (_subEl) _subEl.textContent = secs + 's';

    /* Remove all state classes */
    _timerEl.classList.remove('my-turn', 'opp-turn', 'warning', 'danger', 'game-over', 'hidden');

    if (isOver) {
      _timerEl.classList.add('game-over');
      if (_whoEl) _whoEl.textContent = 'ဂိမ်းပြီးဆုံးပြီ';
      return;
    }

    if (isMyTurn) {
      _timerEl.classList.add('my-turn');
      if (secs <= DANGER_AT) {
        _timerEl.classList.add('danger');
        if (_whoEl) _whoEl.textContent = '⚡ သင့်အလှည့်!';
      } else if (secs <= WARN_AT) {
        _timerEl.classList.add('warning');
        if (_whoEl) _whoEl.textContent = '⚠️ မြန်မြန်ဆော့!';
      } else {
        if (_whoEl) _whoEl.textContent = '▶ သင့်အလှည့်';
      }
    } else {
      _timerEl.classList.add('opp-turn');
      if (_whoEl) _whoEl.textContent = '⏳ ပြိုင်ဘက် အလှည့်';
    }
  }

  /* ────────────────────────────────────────────────────────────────
     RESET TIMER
  ──────────────────────────────────────────────────────────────── */
  function _resetTimer(isMyTurn, isSpectator) {
    _stopInterval();
    _remaining = TIMER_SECONDS;
    _warned    = false;
    _dangered  = false;
    _isMyTurn  = isMyTurn;
    _updateDisplay(_remaining, isMyTurn, false, isSpectator);
    _startInterval(isSpectator);
  }

  /* ────────────────────────────────────────────────────────────────
     INTERVAL
  ──────────────────────────────────────────────────────────────── */
  function _startInterval(isSpectator) {
    _stopInterval();
    _interval = setInterval(function () {
      _remaining--;

      /* Warning beep */
      if (BEEP_ON_WARN && _isMyTurn && _remaining === WARN_AT && !_warned) {
        _warned = true;
        _beepWarn();
      }
      /* Danger beep */
      if (BEEP_ON_DANGER && _isMyTurn && _remaining === DANGER_AT && !_dangered) {
        _dangered = true;
        _beepDanger();
      }
      /* Ticking in last 5 seconds */
      if (_isMyTurn && _remaining <= DANGER_AT && _remaining > 0) {
        _beepTick();
      }

      _updateDisplay(_remaining, _isMyTurn, false, isSpectator);

      if (_remaining <= 0) {
        _stopInterval();
        _onTimerExpired(isSpectator);
      }
    }, TICK_MS);
  }

  function _stopInterval() {
    if (_interval) { clearInterval(_interval); _interval = null; }
  }

  /* ────────────────────────────────────────────────────────────────
     TIMER EXPIRED
  ──────────────────────────────────────────────────────────────── */
  function _onTimerExpired(isSpectator) {
    if (!_timerEl) return;

    /* Flash timer */
    _timerEl.classList.add('danger');

    if (_isMyTurn && !isSpectator && AUTO_RESIGN) {
      /* Brief delay so player sees the 0 */
      setTimeout(function () {
        if (typeof window.doResign === 'function') {
          /* Bypass confirm dialog on timeout — call resign directly */
          try {
            if (!window.over) {
              var origConfirm = window.confirm;
              window.confirm = function () { return true; };
              window.doResign();
              window.confirm = origConfirm;
            }
          } catch (e) {}
        }
      }, 500);
    } else if (!isSpectator) {
      /* Opponent ran out of time — just show toast */
      if (typeof window.toast === 'function') {
        window.toast('⏰ ပြိုင်ဘက်တာပြည့်သွားပြီ');
      }
    }
  }

  /* ────────────────────────────────────────────────────────────────
     READ GAME STATE FROM DOM
  ──────────────────────────────────────────────────────────────── */
  function _readState() {
    var state = {};

    /* Is lobby visible? */
    var lobbyEl = document.getElementById('lobby');
    state.isLobby = lobbyEl ? lobbyEl.classList.contains('show') : true;

    /* Is game visible? */
    var gameEl = document.getElementById('game');
    state.isGame = gameEl ? gameEl.classList.contains('show') : false;

    /* Is game over? */
    var winoEl = document.getElementById('wino');
    state.isOver = winoEl ? winoEl.classList.contains('on') : false;

    /* Turn label text */
    var tlblEl = document.getElementById('tlbl');
    state.turnText = tlblEl ? tlblEl.textContent : '';

    /* Detect my turn via #my-bar having my-turn class */
    var myBarEl = document.getElementById('my-bar');
    state.isMyTurn = myBarEl ? myBarEl.classList.contains('my-turn') : false;

    /* Spectator mode — my-bar won't have my-turn, detect via spectator badge */
    var badgeEl = document.getElementById('spectator-badge');
    state.isSpectator = badgeEl ? (badgeEl.style.display === 'flex') : false;

    /* Also check global window vars if accessible */
    try {
      if (typeof window.spectatorMode !== 'undefined') state.isSpectator = window.spectatorMode;
      if (typeof window.over !== 'undefined') state.isOver = state.isOver || window.over;
    } catch (e) {}

    return state;
  }

  /* ────────────────────────────────────────────────────────────────
     POLL LOOP — detects turn changes without patching core JS
  ──────────────────────────────────────────────────────────────── */
  function _poll() {
    var s = _readState();

    /* Not in game — hide timer, stop ticking */
    if (!s.isGame || s.isLobby) {
      if (_timerEl) _timerEl.classList.add('hidden');
      _stopInterval();
      _lastTurnText = '';
      _lastOver     = false;
      _lastLobby    = true;
      return;
    }

    /* Just entered game screen — force timer reset on first valid turn text */
    if (_lastLobby) {
      _lastLobby    = false;
      _lastTurnText = '';   /* reset so next check always triggers _resetTimer */
    }

    /* Show timer (remove hidden) */
    if (_timerEl) _timerEl.classList.remove('hidden');

    /* Game just ended */
    if (s.isOver && !_lastOver) {
      _lastOver = true;
      _stopInterval();
      if (_timerEl) {
        _timerEl.classList.remove('my-turn', 'opp-turn', 'warning', 'danger', 'hidden');
        _timerEl.classList.add('game-over');
        if (_whoEl) _whoEl.textContent = 'ဂိမ်းပြီးဆုံးပြီ';
      }
      return;
    }
    /* Game was over, now it's not (rematch) */
    if (!s.isOver && _lastOver) {
      _lastOver     = false;
      _lastTurnText = '';
      if (_timerEl) _timerEl.classList.remove('game-over');
    }

    if (s.isOver) return;

    /* Detect turn change via turn label text */
    if (s.turnText !== _lastTurnText) {
      _lastTurnText = s.turnText;
      _resetTimer(s.isMyTurn, s.isSpectator);
    }
  }

  /* ────────────────────────────────────────────────────────────────
     MUTATION OBSERVER — more responsive than polling alone
     Watches #tlbl for text changes and #wino for class changes
  ──────────────────────────────────────────────────────────────── */
  function _attachObservers() {
    /* Observe #tlbl text changes */
    var tlblEl = document.getElementById('tlbl');
    if (tlblEl) {
      var textObs = new MutationObserver(function () {
        /* Let poll handle it — just force an immediate check */
        _poll();
      });
      textObs.observe(tlblEl, { childList: true, characterData: true, subtree: true });
    }

    /* Observe #my-bar class changes (my-turn added/removed) */
    var myBarEl = document.getElementById('my-bar');
    if (myBarEl) {
      var barObs = new MutationObserver(function () { _poll(); });
      barObs.observe(myBarEl, { attributes: true, attributeFilter: ['class'] });
    }

    /* Observe #wino class changes (game over) */
    var winoEl = document.getElementById('wino');
    if (winoEl) {
      var winoObs = new MutationObserver(function () { _poll(); });
      winoObs.observe(winoEl, { attributes: true, attributeFilter: ['class'] });
    }

    /* Observe #game / #lobby class changes (screen switches) */
    var gameEl  = document.getElementById('game');
    var lobbyEl = document.getElementById('lobby');
    if (gameEl) {
      var gameObs = new MutationObserver(function () { _poll(); });
      gameObs.observe(gameEl,  { attributes: true, attributeFilter: ['class'] });
    }
    if (lobbyEl) {
      var lobbyObs = new MutationObserver(function () { _poll(); });
      lobbyObs.observe(lobbyEl, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ────────────────────────────────────────────────────────────────
     INIT
  ──────────────────────────────────────────────────────────────── */
  function _init() {
    /* Wait for game to be injected into DOM */
    var gameEl = document.getElementById('game');
    if (!gameEl) {
      setTimeout(_init, 200);
      return;
    }

    /* Inject timer element */
    _injectTimer();

    /* Attach MutationObservers for responsive detection */
    _attachObservers();

    /* Slow poll fallback (every 1.2s) to catch any edge cases */
    setInterval(_poll, 1200);

    /* Initial state check */
    _poll();
  }

  /* ────────────────────────────────────────────────────────────────
     BOOT
  ──────────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    /* DOM already ready (defer script runs after parse) */
    setTimeout(_init, 50);
  }

})();
