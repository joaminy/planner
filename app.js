/* 나의 플래너 — 화면과 동작 (app.js)
   프랭클린 플래너 방식: A·B·C 우선순위 + 번호, 상태 기호(✓ ● → 위임 ✕),
   시간별 일정, 일일 메모, 사명·가치·목표.
   이 파일은 수정하지 않아도 됩니다. */
(function () {
  'use strict';

  /* ───────── 기본 도구 ───────── */
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function today() { return ymd(new Date()); }
  function md(s) { var d = parse(s); return (d.getMonth() + 1) + '/' + d.getDate(); }
  function monthKey(s) { return s.slice(0, 7); }
  function dayOfYear(s) {
    var p = s.split('-');
    return Math.round((Date.UTC(+p[0], +p[1] - 1, +p[2]) - Date.UTC(+p[0], 0, 1)) / 86400000) + 1;
  }
  function daysInYear(y) { return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365; }
  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }
  /* 주차: 1월 1일이 들어 있는 주가 1주차, 일요일~토요일(달력 한 줄)이 한 주입니다.
     (엑셀 WEEKNUM 함수의 기본 방식과 같음) */
  function weekOfYear(s) {
    var d = parse(s);
    return Math.floor((dayOfYear(s) - 1 + new Date(d.getFullYear(), 0, 1).getDay()) / 7) + 1;
  }
  var WD = ['일', '월', '화', '수', '목', '금', '토'];

  /* 음력 (한국천문연구원 기준, lunar.js) — 범위 밖이거나 파일이 없으면 null */
  var lunarCal = null;
  function lunarOf(s) {
    try {
      if (!window.KoreanLunarCalendar) return null;
      if (!lunarCal) lunarCal = new window.KoreanLunarCalendar();
      var p = s.split('-');
      if (!lunarCal.setSolarDate(+p[0], +p[1], +p[2])) return null;
      var l = lunarCal.getLunarCalendar();
      return { m: l.month, d: l.day, leap: !!l.intercalation };
    } catch (e) { return null; }
  }
  var PRI_ORDER = { A: 0, B: 1, C: 2 };
  var ACTIVE = ['open', 'prog'];
  var HOURS = []; for (var hh = 6; hh <= 22; hh++) HOURS.push(pad(hh));
  var STATUS_NAME = { open: '미완료', done: '완료', prog: '진행 중', fwd: '넘김', deleg: '위임', del: '취소' };

  /* 벤저민 프랭클린의 글을 우리말로 옮긴 문장 (날마다 바뀜) */
  var QUOTES = [
    '잃어버린 시간은 다시 찾을 수 없다.',
    '말을 잘하는 것보다 잘 해내는 것이 낫다.',
    '삶을 사랑하는가? 그렇다면 시간을 낭비하지 마라. 삶은 시간으로 이루어져 있다.',
    '내일 해야 할 일이 있다면 오늘 하라.',
    '오늘 하루는 내일 이틀만큼의 값어치가 있다.',
    '작은 도끼질이 큰 참나무를 쓰러뜨린다.',
    '근면은 행운의 어머니다.',
    '일을 몰고 가라. 일에 쫓기지 말고.',
    '질서 — 모든 물건은 제자리에 두고, 모든 일은 제때에 하라.',
    '결단 — 해야 할 일은 하기로 결심하고, 결심한 일은 반드시 하라.',
    '근면 — 시간을 헛되이 쓰지 말고 늘 유익한 일을 하라. 쓸데없는 행동은 모두 끊어라.',
    '일찍 자고 일찍 일어나면 건강하고, 넉넉하고, 지혜로워진다.',
    '시간은 돈이다.',
    '늦게 일어나는 사람은 하루 종일 종종걸음을 쳐야 한다.',
    '게으른 사람이 잠든 사이에 밭을 깊이 갈아라.',
    '평정 — 사소한 일이나 흔한 일, 피할 수 없는 일에 마음을 어지럽히지 마라.',
    '절약 — 남이나 자신에게 이롭지 않은 일에는 돈을 쓰지 마라.',
    '침묵 — 남이나 자신에게 이롭지 않은 말은 하지 마라.'
  ];

  /* ───────── 글꼴 (Google Fonts, 모두 무료 OFL) ─────────
     scale: 같은 크기에서 글자가 작게 보이는 글꼴을 조금 키우는 배율 */
  var FONT_SANS = "'Noto Sans KR','Noto Sans CJK KR','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
  var FONT_SERIF = "'Noto Serif KR','Noto Serif CJK KR','AppleMyungjo','Batang',serif";
  var FONT_GROUPS = [
    { id: 'sans', name: '고딕', desc: '깔끔하고 또렷한 글씨' },
    { id: 'serif', name: '명조', desc: '인쇄된 플래너 같은 단정한 글씨' },
    { id: 'hand', name: '손글씨 · 개성', desc: '직접 쓴 듯한 친근한 글씨' }
  ];
  var FONTS = [
    { id: 'noto-sans', name: '노토 산스', en: 'Noto Sans KR', group: 'sans', q: null, scale: 1, note: '기본' },
    { id: 'nanum-gothic', name: '나눔고딕', en: 'Nanum Gothic', group: 'sans', q: 'Nanum+Gothic:wght@400;700', scale: 1 },
    { id: 'gowun-dodum', name: '고운돋움', en: 'Gowun Dodum', group: 'sans', q: 'Gowun+Dodum', scale: 1.02 },
    { id: 'ibm-plex', name: 'IBM 플렉스 산스', en: 'IBM Plex Sans KR', group: 'sans', q: 'IBM+Plex+Sans+KR:wght@400;500;700', scale: 1.03 },
    { id: 'noto-serif', name: '노토 세리프', en: 'Noto Serif KR', group: 'serif', q: null, scale: 1 },
    { id: 'nanum-myeongjo', name: '나눔명조', en: 'Nanum Myeongjo', group: 'serif', q: 'Nanum+Myeongjo:wght@400;700', scale: 1 },
    { id: 'gowun-batang', name: '고운바탕', en: 'Gowun Batang', group: 'serif', q: 'Gowun+Batang:wght@400;700', scale: 1 },
    { id: 'nanum-pen', name: '나눔손글씨 펜', en: 'Nanum Pen Script', group: 'hand', q: 'Nanum+Pen+Script', scale: 1.35 },
    { id: 'gaegu', name: '개구', en: 'Gaegu', group: 'hand', q: 'Gaegu:wght@400;700', scale: 1.2 },
    { id: 'jua', name: '주아', en: 'Jua', group: 'hand', q: 'Jua', scale: 1.08 }
  ];
  var FONT_SAMPLE = 'A1 분기 보고서 초안 작성<br>오후 2시 고객사 미팅 · 저녁 7시 운동';
  function fontById(id) {
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i];
    return FONTS[0];
  }
  function fontStack(f) { return "'" + f.en + "'," + (f.group === 'serif' ? FONT_SERIF : FONT_SANS); }
  var fontCssLoaded = {};
  function loadFontCss(f) {
    if (!f.q || fontCssLoaded[f.id]) return;
    fontCssLoaded[f.id] = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + f.q + '&display=swap';
    document.head.appendChild(l);
  }

  /* ───────── 플래너 색깔 ─────────
     accent: 제목·버튼·강조 색, cover: PC 화면 바탕(플래너 표지) 색 */
  var THEMES = [
    { id: 'green', name: '숲 초록', accent: '#1F4D3C', cover: '#3A2D24', note: '기본' },
    { id: 'navy', name: '네이비', accent: '#1F3A5F', cover: '#1C2636' },
    { id: 'burgundy', name: '버건디', accent: '#7A2333', cover: '#3A1820' },
    { id: 'brown', name: '브라운', accent: '#6B4226', cover: '#3B2A1E' },
    { id: 'charcoal', name: '차콜', accent: '#33383D', cover: '#1E2124' },
    { id: 'plum', name: '플럼', accent: '#55306A', cover: '#2B1C35' },
    { id: 'teal', name: '청록', accent: '#155E63', cover: '#123437' },
    { id: 'rose', name: '로즈', accent: '#9C3D5D', cover: '#4A2232' }
  ];
  var THEME_KEYS = ['--green', '--green-2', '--green-tint', '--green-line', '--leather', '--leather-hi', '--leather-lo'];
  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return null;
  }
  function isHex(h) { return /^#[0-9A-Fa-f]{6}$/.test(h || ''); }
  function rgbOf(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function hexOf(c) {
    return '#' + c.map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join('').toUpperCase();
  }
  function mixHex(a, b, t) { var A = rgbOf(a), B = rgbOf(b); return hexOf([0, 1, 2].map(function (i) { return A[i] + (B[i] - A[i]) * t; })); }
  function lumOf(h) {
    var w = [0.2126, 0.7152, 0.0722];
    return rgbOf(h).reduce(function (sum, v, i) { v /= 255; return sum + w[i] * (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); }, 0);
  }
  function contrastOf(a, b) { var x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  /* 직접 고른 색이 너무 밝으면 글씨가 안 보이므로, 종이색과 대비 4.5:1 이상이 될 때까지 조금씩 어둡게 */
  function readableAccent(h) {
    var c = h.toUpperCase(), i = 0;
    while (contrastOf(c, '#FCFAF4') < 4.5 && i++ < 60) c = mixHex(c, '#000000', 0.05);
    return c;
  }
  function themeVars(accent, cover) {
    return {
      '--green': accent, '--green-2': mixHex(accent, '#FFFFFF', 0.14), '--green-tint': mixHex(accent, '#FFFFFF', 0.88),
      '--green-line': mixHex(accent, '#FFFFFF', 0.72), '--leather': cover,
      '--leather-hi': mixHex(cover, '#FFFFFF', 0.12), '--leather-lo': mixHex(cover, '#000000', 0.28)
    };
  }

  /* ───────── 앱 상태 ───────── */
  var S = {
    store: null, mode: null, user: null,
    date: today(), followToday: true,
    view: 'day', tab: 'tasks',
    tasks: [], day: {}, dayLoaded: false,
    pending: [], profile: {},
    sched: {}, schedKey: '', monthCursor: monthKey(today()),
    addPri: readPref('addPri', 'A'),
    font: 'noto-sans', fontAll: false,
    theme: 'green', themeColor: '',
    editId: null,
    unsub: { day: null, pending: null, sched: null, profile: null }
  };
  var FBA = null; // { FB, app, auth, db }

  function readPref(k, def) { try { return localStorage.getItem('my-planner:' + k) || def; } catch (e) { return def; } }
  function writePref(k, v) { try { localStorage.setItem('my-planner:' + k, v); } catch (e) { /* 무시 */ } }

  /* ───────── 시작 ───────── */
  function boot() {
    window.__plannerBooted = true;
    applyFont(readPref('font', 'noto-sans'), readPref('fontAll', '0') === '1');
    applyTheme(readPref('theme', 'green'), readPref('themeColor', ''));
    bindEvents();
    buildSchedRows();
    buildMonthTabs();
    setAddPri(S.addPri);
    registerSW();

    var cfg = window.PLANNER_CONFIG;
    if (!cfg || typeof cfg !== 'object') return showFatal('config');
    if (!String(cfg.apiKey || '').trim() || !String(cfg.projectId || '').trim()) return startLocal('preview');
    if (location.protocol === 'file:') return startLocal('file');
    loadScript('firebase.js').then(function () { startFirebase(cfg); }, function () { showFatal('sdk'); });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.FB) return resolve();
      var s = document.createElement('script');
      s.src = src; s.onload = function () { window.FB ? resolve() : reject(); }; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function registerSW() {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* 없어도 동작 */ });
    }
  }

  function hideSplash() { $('#splash').hidden = true; }

  function startLocal(reason) {
    S.mode = 'local';
    $('#fatal').hidden = true;
    attachStore(new window.PlannerStores.LocalStore());
    setSync('local');
    $('#whoLine').textContent = '미리보기 모드 · 이 기기에만 저장';
    var msg = $('#localMsg');
    if (reason === 'file') {
      msg.innerHTML = '<b>파일로 직접 열었습니다</b> · 이 방식에서는 동기화가 동작하지 않아 이 기기에만 저장됩니다. 동기화하려면 GitHub Pages 주소로 여십시오.';
    }
    var hidden = false; try { hidden = sessionStorage.getItem('my-planner:hideLocal') === '1'; } catch (e) { /* 무시 */ }
    $('#localBanner').hidden = hidden;
    showApp();
  }

  function startFirebase(cfg) {
    var FB = window.FB;
    try {
      var app = FB.initializeApp(cfg);
      var auth = FB.initializeAuth(app, { persistence: [FB.indexedDBLocalPersistence, FB.browserLocalPersistence] });
      var db;
      try {
        db = FB.initializeFirestore(app, {
          localCache: FB.persistentLocalCache({ tabManager: FB.persistentMultipleTabManager() }),
          ignoreUndefinedProperties: true
        });
      } catch (e) {
        db = FB.initializeFirestore(app, { ignoreUndefinedProperties: true });
      }
      auth.languageCode = 'ko'; // 비밀번호 재설정 메일을 한국어로
      FBA = { FB: FB, app: app, auth: auth, db: db };
    } catch (e) {
      return showFatal('init', e);
    }
    S.mode = 'firebase';
    $('#btnLogout').hidden = false;
    FB.onAuthStateChanged(FBA.auth, function (user) {
      if (user) {
        S.user = user;
        $('#login').hidden = true;
        $('#whoLine').textContent = user.email || '로그인됨';
        attachStore(new window.PlannerStores.FirebaseStore(FB, FBA.db, user.uid));
        showApp();
      } else {
        S.user = null;
        detachStore();
        showLogin();
      }
    });
  }

  function showApp() {
    hideSplash();
    $('#app').hidden = false;
    renderAll();
  }

  function showLogin() {
    hideSplash();
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#loginErr').textContent = '';
    setSync('offline-login');
  }

  function showFatal(kind, err) {
    hideSplash();
    $('#app').hidden = true;
    var steps = $('#fatalSteps'), msg = $('#fatalMsg'), title = $('#fatalTitle');
    if (kind === 'config') {
      title.textContent = '설정 파일(config.js)을 확인해 주세요';
      msg.textContent = 'config.js 파일이 없거나, 붙여 넣은 내용에 오류가 있어 읽지 못했습니다.';
      steps.innerHTML = '<li>GitHub 저장소에서 <code>config.js</code>를 열고 연필(편집) 버튼을 누릅니다.</li>' +
        '<li><code>const firebaseConfig = {</code> 로 시작해서 <code>};</code> 로 끝나는 부분만 남아 있는지 확인합니다. <code>import</code> 줄이나 <code>initializeApp</code> 줄이 있으면 지웁니다.</li>' +
        '<li>맨 아래 <code>window.PLANNER_CONFIG = firebaseConfig;</code> 줄이 그대로 있는지 확인합니다.</li>' +
        '<li>저장(Commit changes) 후 1~2분 기다렸다가 이 화면을 새로고침합니다.</li>';
    } else if (kind === 'sdk') {
      title.textContent = 'firebase.js 파일을 불러오지 못했습니다';
      msg.textContent = '앱 폴더의 firebase.js 파일이 빠졌거나 아직 올라가지 않았습니다.';
      steps.innerHTML = '<li>GitHub 저장소 파일 목록에 <code>firebase.js</code>가 있는지 확인합니다.</li><li>없으면 압축을 푼 폴더에서 다시 올린 뒤 새로고침합니다.</li>';
    } else {
      title.textContent = 'Firebase 설정값을 확인해 주세요';
      msg.textContent = 'config.js의 값으로 Firebase를 시작하지 못했습니다. 복사한 값이 빠짐없이 들어갔는지 확인하십시오.';
      steps.innerHTML = '<li>Firebase 콘솔 → 톱니바퀴(프로젝트 설정) → 내 앱에서 firebaseConfig를 다시 복사합니다.</li><li>config.js의 같은 부분과 바꿔 넣고 저장합니다.</li>';
    }
    $('#fatalDetail').textContent = err ? String(err.message || err) : '';
    $('#fatal').hidden = false;
  }

  /* ───────── 저장소 연결 ───────── */
  function attachStore(store) {
    detachStore();
    S.store = store;
    store.onStatus = setSync;
    store.onError = function (e, ctx) { toast(describeError(e, ctx), 'error', null, 6000); };
    if (store.kind === 'local') setSync('local');
    S.unsub.profile = store.watchProfile(function (p) {
      S.profile = p || {};
      if (typeof S.profile.font === 'string' &&
          (fontById(S.profile.font).id !== S.font || !!S.profile.fontAll !== S.fontAll)) {
        applyFont(S.profile.font, !!S.profile.fontAll);
      }
      var pt = S.profile.theme, pc = String(S.profile.themeColor || '').toUpperCase();
      if (typeof pt === 'string' && (pt !== S.theme || (pt === 'custom' && pc !== S.themeColor))) applyTheme(pt, pc);
      renderMission();
      if (S.view === 'values') fillValues();
    });
    S.unsub.pending = store.watchPending(function (list) {
      S.pending = list;
      renderPendingBanner();
      if (S.view === 'pending') renderPendingView();
      if (S.editId) renderSheet();
    });
    subscribeDay();
    subscribeSched(S.view === 'month' ? S.monthCursor : monthKey(S.date));
  }

  function detachStore() {
    flushNotes(); flushSched(); flushValues();
    Object.keys(S.unsub).forEach(function (k) { if (S.unsub[k]) S.unsub[k](); S.unsub[k] = null; });
    if (S.store && S.store.destroy) S.store.destroy();
    S.store = null;
    S.tasks = []; S.day = {}; S.pending = []; S.sched = {}; S.schedKey = ''; S.profile = {};
    closeSheet(true);
  }

  function subscribeDay() {
    if (!S.store) return;
    if (S.unsub.day) S.unsub.day();
    var date = S.date;
    S.tasks = []; S.day = {}; S.dayLoaded = false;
    renderTasks(); renderSched(); renderNotes(true);
    S.unsub.day = S.store.watchDay(date, function (r) {
      if (date !== S.date) return;
      S.tasks = r.tasks; S.day = r.day || {}; S.dayLoaded = true;
      renderTasks(); renderSched(); renderNotes(false);
      if (S.editId) renderSheet();
    });
  }

  /* 한 달 치 일정 (월간 달력·작은 달력에 표시) */
  function subscribeSched(mk) {
    if (!S.store) return;
    if (typeof S.store.watchSchedRange !== 'function') {   // store.js가 예전 파일일 때
      toast('월간 달력에 일정을 보이려면 store.js 파일도 새 버전으로 올려 주세요.', 'error', null, 8000);
      return;
    }
    if (S.schedKey === mk && S.unsub.sched) return;
    if (S.unsub.sched) S.unsub.sched();
    S.schedKey = mk; S.sched = {};
    var p = mk.split('-'), y = +p[0], m = +p[1];
    var from = mk + '-01', to = mk + '-' + pad(lastDay(y, m));
    S.unsub.sched = S.store.watchSchedRange(from, to, function (map) {
      if (S.schedKey !== mk) return;
      S.sched = map || {};
      renderMiniCal();
      if (S.view === 'month') renderMonth();
    });
  }

  /* ───────── 동기화 표시 ───────── */
  var SYNC_LABEL = {
    local: '이 기기에만 저장', synced: '동기화됨', saving: '저장 중…',
    connecting: '연결 중…', offline: '오프라인 · 연결되면 자동 저장', 'offline-login': '로그인 필요'
  };
  function setSync(s) {
    var el = $('#sync');
    el.dataset.s = s;
    $('.label', el).textContent = SYNC_LABEL[s] || s;
  }

  function describeError(e, ctx) {
    var code = (e && e.code) || '';
    if (code === 'permission-denied') return '데이터 접근이 거부되었습니다. Firestore 보안 규칙을 게시했는지 확인한 뒤 새로고침하십시오. (설명서 2-5단계)';
    if (code === 'not-found') return ctx === 'listen'
      ? 'Firestore 데이터베이스를 찾지 못했습니다. 데이터베이스를 만들었는지 확인하십시오. (설명서 2-4단계)'
      : '다른 기기에서 이미 지운 항목입니다.';
    if (code === 'resource-exhausted') return 'Firebase 무료 사용 한도를 넘었습니다. 한도가 다시 채워질 때까지(Firestore는 매일) 저장이 멈출 수 있습니다.';
    if (code === 'unavailable') return '서버에 연결할 수 없습니다. 연결되면 자동으로 저장됩니다.';
    if (code === 'old-firebase-js') return '월간 달력에 일정을 보이려면 firebase.js 파일도 새 버전으로 올려 주세요.';
    if (code === 'local-save-failed') return '이 기기에 저장하지 못했습니다. 저장 공간이나 사생활 보호 모드를 확인하십시오.';
    return '문제가 생겼습니다: ' + ((e && e.message) || code || '알 수 없는 오류');
  }

  /* ───────── 그리기 ───────── */
  function renderAll() {
    showView(S.view);
    renderHeader(); renderTasks(); renderSched(); renderNotes(true);
    renderMiniCal(); renderMission(); renderPendingBanner();
  }

  function renderHeader() {
    var d = parse(S.date), y = d.getFullYear(), w = d.getDay();
    $('#dayNum').textContent = d.getDate();
    var wy = weekOfYear(S.date);
    $('#dayMonth').innerHTML = (d.getMonth() + 1) + '월 <span class="wk">' + wy + '주차</span> ' +
      '<span class="wd ' + (w === 0 ? 'sun' : w === 6 ? 'sat' : '') + '">' + WD[w] + '요일</span>';
    $('#dayWk').textContent = wy + '주차'; // 휴대폰: 큰 날짜 숫자 아래에 표시
    var doy = dayOfYear(S.date), lu = w === 0 ? lunarOf(S.date) : null;   // 음력은 일요일에만
    var yl = $('#dayYear');
    yl.classList.toggle('has-lunar', !!lu);
    yl.innerHTML = '<span>' + y + '년</span><span class="doy"> · ' + doy + '일째</span>' +
      (lu ? '<span class="lunar"> · 음력 ' + (lu.leap ? '윤' : '') + lu.m + '월 ' + lu.d + '일</span>' : '') +
      '<span class="left"> · 올해 ' + (daysInYear(y) - doy) + '일 남음</span>';
    $('#btnToday').classList.toggle('is-today', S.date === today());
    $('#quote').innerHTML = '“' + esc(QUOTES[(doy - 1) % QUOTES.length]) + '”<cite>— 벤저민 프랭클린</cite>';
    document.title = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 · 나의 플래너';
    $$('#monthTabs button').forEach(function (b) { b.classList.toggle('cur', +b.dataset.m === d.getMonth() + 1); });
  }

  function renderMission() {
    var m = String((S.profile && S.profile.mission) || '').trim();
    var first = m.split('\n')[0];
    var line = $('#missionLine'), card = $('#missionCard');
    line.hidden = !first; card.hidden = !m;
    if (first) line.innerHTML = '<b>나의 사명</b>' + esc(first);
    if (m) card.innerHTML = '<span class="lbl">나의 사명</span>' + esc(m);
  }

  function sortTasks(list) {
    return list.slice().sort(function (a, b) {
      return (PRI_ORDER[a.pri] - PRI_ORDER[b.pri]) || ((a.ord || 0) - (b.ord || 0)) || ((a.created || 0) - (b.created || 0));
    });
  }
  function labelMap(sorted) {
    var c = { A: 0, B: 0, C: 0 }, m = {};
    sorted.forEach(function (t) { c[t.pri] = (c[t.pri] || 0) + 1; m[t.id] = t.pri + c[t.pri]; });
    return m;
  }
  function initial(name) { var s = String(name || '').trim(); return s ? Array.from(s)[0] : '?'; }

  function statusSymbol(t) {
    switch (t.status) {
      case 'done': return '✓';
      case 'prog': return '●';
      case 'fwd': return '→';
      case 'del': return '✕';
      case 'deleg': return '<span class="ini">' + esc(initial(t.who)) + '</span>';
      default: return '';
    }
  }

  function taskRow(t, label) {
    var st = t.status || 'open', meta = [];
    if (t.fwdFrom) {
      var cnt = t.fwdCount || 1;
      meta.push('↪ ' + md(t.fwdFrom) + '에서 넘어옴' + (cnt >= 3 ? ' · <span class="warn">' + cnt + '번째 넘김 — 꼭 필요한 일인지 점검해 보세요</span>' : (cnt > 1 ? ' · ' + cnt + '번째' : '')));
    }
    if (st === 'fwd' && t.fwdTo) meta.push('→ ' + md(t.fwdTo) + '로 넘김');
    if (st === 'deleg') meta.push(esc(t.who || '누군가') + '에게 맡김');
    if (st === 'prog') meta.push('진행 중');
    return '<li class="task st-' + st + ' pri-' + esc(t.pri) + '" data-id="' + esc(t.id) + '">' +
      '<button class="st" data-act="toggle" aria-label="' + label + ' ' + STATUS_NAME[st] + ', 눌러서 상태 바꾸기">' + statusSymbol(t) + '</button>' +
      '<span class="pri">' + label + '</span>' +
      '<div class="body" data-act="edit"><div class="txt">' + esc(t.text) + '</div>' +
      (meta.length ? '<div class="meta">' + meta.join(' · ') + '</div>' : '') + '</div>' +
      '<button class="more" data-act="edit" aria-label="편집">⋯</button></li>';
  }

  function renderTasks() {
    var sorted = sortTasks(S.tasks), labels = labelMap(sorted), html = '';
    if (sorted.length) html = sorted.map(function (t) { return taskRow(t, labels[t.id]); }).join('');
    else html = '<li class="empty">' + (S.dayLoaded || !S.store ? '아직 적은 할 일이 없습니다.<br>오늘 꼭 해야 할 일(A)부터 적어 보세요.' : '불러오는 중…') + '</li>';
    for (var i = sorted.length; i < 8; i++) html += '<li class="blank" data-act="focus-add" aria-hidden="true"></li>';
    $('#taskList').innerHTML = html;
    var active = sorted.filter(function (t) { return t.status !== 'del' && t.status !== 'fwd'; });
    var done = sorted.filter(function (t) { return t.status === 'done' || t.status === 'deleg'; }).length;
    $('#taskProgress').textContent = active.length ? '완료 ' + done + ' / ' + active.length : '';
    var open = sorted.filter(function (t) { return ACTIVE.indexOf(t.status) >= 0; }).length;
    $('#cntTasks').textContent = sorted.length ? String(open) : '';
  }

  function buildSchedRows() {
    $('#schedList').innerHTML = HOURS.map(function (h) {
      return '<div class="sched-row" data-h="' + h + '"><div class="hh">' + (+h) + '<small>시</small></div>' +
        '<input type="text" data-h="' + h + '" aria-label="' + (+h) + '시 일정" maxlength="200"></div>';
    }).join('');
  }

  function renderSched() {
    var sched = (S.day && S.day.sched) || {}, nowH = pad(new Date().getHours()), isToday = S.date === today(), n = 0;
    $$('#schedList .sched-row').forEach(function (row) {
      var h = row.dataset.h, input = $('input', row), key = S.date + '|' + h;
      row.classList.toggle('now', isToday && h === nowH);
      if (document.activeElement !== input && !schedPending.has(key)) input.value = sched[h] || '';
      if ((sched[h] || '').trim()) n++;
    });
    $('#cntSched').textContent = n ? String(n) : '';
  }

  function renderNotes(force) {
    var ta = $('#notes');
    if (notesPending && notesPending.date === S.date) return;
    if (!force && document.activeElement === ta) return;
    ta.value = (S.day && S.day.notes) || '';
  }

  function renderPendingBanner() {
    var t0 = today();
    var past = S.pending.filter(function (t) { return t.date < t0; });
    $('#pendingBanner').hidden = !(S.date === t0 && past.length);
    $('#pendingCount').textContent = past.length;
    var badge = $('#pendingBadge');
    badge.textContent = past.length || '';
    badge.hidden = !past.length;
  }

  /* 하루 일정({ '09': '회의', ... })을 시간 순서 목록으로 */
  function schedEntries(sched) {
    var out = [];
    if (!sched || typeof sched !== 'object') return out;
    Object.keys(sched).sort().forEach(function (h) {
      var text = String(sched[h] == null ? '' : sched[h]).trim();
      if (/^\d{2}$/.test(h) && text) out.push({ h: +h, text: text });
    });
    return out;
  }

  function renderMiniCal() {
    var mk = monthKey(S.date), p = mk.split('-'), y = +p[0], m = +p[1];
    var first = new Date(y, m - 1, 1).getDay(), days = lastDay(y, m), t0 = today();
    var map = S.schedKey === mk ? S.sched : {};
    var html = '<div class="mc-head"><span>' + y + '년 ' + m + '월</span><button data-go="month">월간 달력 ›</button></div>';
    html += '<table><thead><tr>' + WD.map(function (w) { return '<th>' + w + '</th>'; }).join('') + '</tr></thead><tbody><tr>';
    var cell = 0, i;
    for (i = 0; i < first; i++) { html += '<td></td>'; cell++; }
    for (var d = 1; d <= days; d++) {
      var ds = mk + '-' + pad(d), cls = [];
      if (schedEntries(map[ds]).length) cls.push('has');
      if (ds === t0) cls.push('today');
      if (ds === S.date) cls.push('sel');
      html += '<td><button data-date="' + ds + '" class="' + cls.join(' ') + '">' + d + '</button></td>';
      cell++;
      if (cell % 7 === 0 && d < days) html += '</tr><tr>';
    }
    while (cell % 7 !== 0) { html += '<td></td>'; cell++; }
    html += '</tr></tbody></table>';
    $('#minical').innerHTML = html;
  }

  var mqWide = window.matchMedia ? window.matchMedia('(min-width:900px)') : null;
  function renderMonth() {
    var p = S.monthCursor.split('-'), y = +p[0], m = +p[1];
    $('#monthTitle').textContent = y + '년 ' + m + '월';
    var first = new Date(y, m - 1, 1).getDay(), days = lastDay(y, m), t0 = today();
    var map = S.schedKey === S.monthCursor ? S.sched : {};
    var wide = !!(mqWide && mqWide.matches), max = wide ? 4 : 3;   // 한 칸에 보일 일정 줄 수
    var rows = Math.ceil((first + days) / 7);
    var html = '<div class="wkh">주차</div>' +
      WD.map(function (w, i) { return '<div class="wd ' + (i === 0 ? 'sun' : i === 6 ? 'sat' : '') + '">' + w + '</div>'; }).join('');
    for (var r = 0; r < rows; r++) {
      var cells = '', hasToday = false;
      for (var c = 0; c < 7; c++) {
        var d = r * 7 + c - first + 1;
        if (d < 1 || d > days) { cells += '<div class="cell blank"></div>'; continue; }
        var ds = S.monthCursor + '-' + pad(d), list = schedEntries(map[ds]);
        var cls = ['cell']; if (c === 0) cls.push('sun'); if (c === 6) cls.push('sat');
        if (ds === t0) { cls.push('today'); hasToday = true; }
        if (ds === S.date) cls.push('sel');
        var shown = list.length > max ? list.slice(0, max - 1) : list;
        var lu = c === 0 ? lunarOf(ds) : null;   // 일요일 칸에는 음력
        var inner = '<span class="top"><span class="dn">' + d + '</span>' +
          (lu ? '<span class="lunar">음 ' + (lu.leap ? '윤' : '') + lu.m + '.' + lu.d + '</span>' : '') + '</span>';
        for (var k = 0; k < shown.length; k++) {
          inner += '<span class="sc"><b>' + shown[k].h + '시</b>' + esc(shown[k].text) + '</span>';
        }
        if (list.length > shown.length) inner += '<span class="sc-more">+' + (list.length - shown.length) + (wide ? '개 더' : '') + '</span>';
        cells += '<button class="' + cls.join(' ') + '" data-date="' + ds + '" aria-label="' + m + '월 ' + d + '일' +
          (list.length ? ', 일정 ' + list.length + '개' : '') + '">' + inner + '</button>';
      }
      var wn = weekOfYear(S.monthCursor + '-' + pad(Math.max(1, r * 7 - first + 1)));   // 그 줄의 올해 주차
      html += '<div class="wkc' + (hasToday ? ' cur' : '') + '">' + wn + '<small>주</small></div>' + cells;
    }
    $('#mgrid').innerHTML = html;
  }

  function renderPendingView() {
    var t0 = today();
    var list = S.pending.filter(function (t) { return t.date < t0; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (PRI_ORDER[a.pri] - PRI_ORDER[b.pri]) || ((a.ord || 0) - (b.ord || 0)); });
    $('#btnPullAll2').hidden = !list.length;
    if (!list.length) { $('#pendList').innerHTML = '<div class="pend-empty">미처리 할 일이 없습니다. 잘 정리하고 계십니다.</div>'; return; }
    var html = '', cur = '';
    list.forEach(function (t) {
      if (t.date !== cur) {
        if (cur) html += '</div>';
        cur = t.date;
        var d = parse(t.date);
        html += '<div class="pend-group"><h3>' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WD[d.getDay()] + ')</h3>';
      }
      html += '<div class="pend-item pri-' + esc(t.pri) + '" data-id="' + esc(t.id) + '"><span class="pri">' + esc(t.pri) + '</span>' +
        '<span class="ptxt">' + esc(t.text) + (t.status === 'prog' ? ' <small style="color:var(--gold)">● 진행 중</small>' : '') + '</span>' +
        '<span class="acts"><button class="btn small primary" data-pact="today">→ 오늘로</button><button class="btn small" data-pact="done">✓</button><button class="btn small" data-pact="del">✕</button></span></div>';
    });
    html += '</div>';
    $('#pendList').innerHTML = html;
  }

  function buildMonthTabs() {
    var html = '';
    for (var m = 1; m <= 12; m++) html += '<button data-m="' + m + '" title="' + m + '월 달력">' + m + '월</button>';
    $('#monthTabs').innerHTML = html;
  }

  /* ───────── 글꼴 바꾸기 ───────── */
  function applyFont(id, all) {
    var f = fontById(id), st = fontStack(f), root = document.documentElement.style;
    loadFontCss(f);
    root.setProperty('--content', st);
    root.setProperty('--fs', String(f.scale));
    root.setProperty('--fsu', all ? String(f.scale) : '1');
    if (all) { root.setProperty('--sans', st); root.setProperty('--serif', st); }
    else { root.removeProperty('--sans'); root.removeProperty('--serif'); }
    S.font = f.id; S.fontAll = !!all;
    writePref('font', f.id); writePref('fontAll', all ? '1' : '0');
    if (S.view === 'font') markFontCards();
  }

  function chooseFont(id, all) {
    applyFont(id, all);
    if (S.store) S.store.setProfile({ font: S.font, fontAll: S.fontAll });
  }

  function applyTheme(id, color) {
    var t = themeById(id), vars = null, root = document.documentElement.style;
    if (id === 'custom' && isHex(color)) {
      var acc = readableAccent(color);
      vars = themeVars(acc, mixHex(acc, '#000000', 0.55));
      S.theme = 'custom'; S.themeColor = color.toUpperCase();
    } else {
      if (!t) t = THEMES[0];
      if (t.id !== 'green') vars = themeVars(t.accent, t.cover); // 기본(숲 초록)은 원래 디자인 그대로
      S.theme = t.id;
    }
    THEME_KEYS.forEach(function (k) { if (vars) root.setProperty(k, vars[k]); else root.removeProperty(k); });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', vars ? vars['--green'] : '#1F4D3C');
    writePref('theme', S.theme);
    if (S.theme === 'custom') writePref('themeColor', S.themeColor);
    try {
      if (vars) localStorage.setItem('my-planner:themeVars', JSON.stringify(vars));
      else localStorage.removeItem('my-planner:themeVars');
    } catch (e) { /* 저장 못 해도 지금 화면에는 적용됨 */ }
    if (S.view === 'font') markThemeCards();
  }

  function chooseTheme(id, color) {
    applyTheme(id, color);
    if (S.store) S.store.setProfile({ theme: S.theme, themeColor: S.theme === 'custom' ? S.themeColor : '' });
  }

  function renderThemeList() {
    var cc = S.themeColor || '#3A6EA5';
    var html = THEMES.map(function (t) {
      return '<button class="theme-card" data-theme="' + t.id + '" aria-pressed="false">' +
        '<span class="tc-swatch" style="background:' + t.cover + '"><i style="background:' + t.accent + '"></i></span>' +
        '<span class="tc-name">' + esc(t.name) + (t.note ? '<small>' + t.note + '</small>' : '') + '</span><span class="tc-on">✓</span></button>';
    }).join('');
    html += '<label class="theme-card custom" data-theme="custom">' +
      '<span class="tc-swatch rainbow"><i id="customDot" style="background:' + cc + '"></i></span>' +
      '<span class="tc-name">직접 고르기<small>원하는 색 지정</small></span><span class="tc-on">✓</span>' +
      '<input type="color" id="themeColor" value="' + cc.toLowerCase() + '" aria-label="플래너 색 직접 고르기"></label>';
    $('#themeList').innerHTML = html;
    markThemeCards();
  }

  function markThemeCards() {
    $$('#themeList .theme-card').forEach(function (b) {
      var on = b.dataset.theme === S.theme;
      b.classList.toggle('on', on);
      if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var dot = $('#customDot');
    if (dot && S.themeColor) dot.style.background = readableAccent(S.themeColor);
  }

  function renderFontView() {
    FONTS.forEach(loadFontCss); // 미리보기를 위해 10종을 모두 불러옴
    renderThemeList();
    $('#fontDesc').textContent = S.mode === 'firebase'
      ? '플래너 색깔과 글꼴을 고릅니다. 고른 설정은 PC와 휴대폰에 함께 적용됩니다.'
      : '플래너 색깔과 글꼴을 고릅니다. (미리보기 모드에서는 이 기기에만 적용됩니다)';
    var html = '';
    FONT_GROUPS.forEach(function (g) {
      html += '<h3 class="font-group">' + g.name + '<span>' + g.desc + '</span></h3><div class="font-grid">';
      FONTS.filter(function (f) { return f.group === g.id; }).forEach(function (f) {
        html += '<button class="font-card" data-font="' + f.id + '" aria-pressed="false">' +
          '<span class="fc-head"><b>' + esc(f.name) + '</b><small>' + esc(f.en) + (f.note ? ' · ' + f.note : '') + '</small></span>' +
          '<span class="fc-check">✓ 사용 중</span>' +
          '<span class="fc-sample" style="font-family:' + esc(fontStack(f)) + ';font-size:' + (17 * f.scale).toFixed(1) + 'px">' + FONT_SAMPLE + '</span>' +
          '</button>';
      });
      html += '</div>';
    });
    $('#fontList').innerHTML = html;
    markFontCards();
  }

  function markFontCards() {
    $('#fontAll').checked = S.fontAll;
    $$('#fontList .font-card').forEach(function (b) {
      var on = b.dataset.font === S.font;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* ───────── 화면 전환 ───────── */
  var VIEWS = { day: '#dayView', month: '#monthView', pending: '#pendingView', values: '#valuesView', font: '#fontView', help: '#helpView' };
  function showView(v) {
    if (v !== 'values') flushValues();
    S.view = v;
    Object.keys(VIEWS).forEach(function (k) { $(VIEWS[k]).hidden = k !== v; });
    if (v === 'month') { subscribeSched(S.monthCursor); renderMonth(); }
    else if (S.store) subscribeSched(monthKey(S.date));
    if (v === 'pending') renderPendingView();
    if (v === 'values') fillValues();
    if (v === 'font') renderFontView();
    if (v === 'day') { renderHeader(); renderMiniCal(); }
    window.scrollTo(0, 0);
  }

  function go(v) {
    closeDrawer();
    if (v === 'day' && S.view === 'day') { setDate(today()); return; }
    if (v === 'month') S.monthCursor = monthKey(S.date);
    showView(v);
  }

  function setDate(d) {
    if (!d) return;
    flushNotes(); flushSched();
    S.date = d; S.followToday = d === today();
    if (S.view !== 'day') showView('day');
    subscribeDay();
    subscribeSched(monthKey(d));
    renderHeader(); renderMiniCal(); renderPendingBanner();
  }

  function setTab(tab) {
    S.tab = tab;
    $('#spread').dataset.tab = tab;
    $$('.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
  }

  /* ───────── 할 일 동작 ───────── */
  function setAddPri(p) {
    S.addPri = p; writePref('addPri', p);
    $$('#addPri button').forEach(function (b) { b.classList.toggle('on', b.dataset.pri === p); });
  }

  function addTask() {
    var input = $('#addInput'), text = input.value.trim();
    if (!text || !S.store) return;
    var now = Date.now();
    S.store.addTask({ date: S.date, pri: S.addPri, ord: now, text: text, status: 'open', created: now, updated: now });
    input.value = '';
    input.focus();
  }

  function findTask(id) {
    var i;
    for (i = 0; i < S.tasks.length; i++) if (S.tasks[i].id === id) return S.tasks[i];
    for (i = 0; i < S.pending.length; i++) if (S.pending[i].id === id) return S.pending[i];
    return null;
  }

  function toggle(id) {
    var t = findTask(id); if (!t) return;
    var now = Date.now();
    if (t.status === 'open' || !t.status) S.store.updateTask(id, { status: 'done', updated: now });
    else if (t.status === 'done' || t.status === 'prog') S.store.updateTask(id, { status: t.status === 'done' ? 'open' : 'done', updated: now });
    else openSheet(id);
  }

  /* 넘긴 일을 되돌릴 때: 아직 손대지 않은 사본은 지움 */
  function unforwardOps(t) {
    var ops = [];
    if (t.fwdId) {
      var copy = null;
      for (var i = 0; i < S.pending.length; i++) if (S.pending[i].id === t.fwdId) copy = S.pending[i];
      if (copy && copy.status === 'open') ops.push({ type: 'remove', id: t.fwdId });
    }
    ops.push({ type: 'update', id: t.id, patch: { status: 'open', fwdTo: null, fwdId: null, updated: Date.now() } });
    return ops;
  }

  function setStatus(id, st, extra) {
    var t = findTask(id); if (!t) return;
    var ops = t.status === 'fwd' ? unforwardOps(t) : [];
    var patch = { status: st, updated: Date.now() };
    if (st !== 'deleg') patch.who = null;
    if (extra) Object.keys(extra).forEach(function (k) { patch[k] = extra[k]; });
    ops.push({ type: 'update', id: id, patch: patch });
    S.store.commit(ops);
  }

  function forward(t, toDate) {
    if (!toDate || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) { toast('날짜를 고르십시오.'); return false; }
    if (toDate === t.date) { toast('같은 날짜로는 넘길 수 없습니다.'); return false; }
    var ops = t.status === 'fwd' ? unforwardOps(t) : [];
    var now = Date.now(), id = S.store.newId();
    ops.push({ type: 'set', task: {
      id: id, date: toDate, pri: t.pri, ord: now, text: t.text,
      status: t.status === 'prog' ? 'prog' : 'open',
      fwdFrom: t.date, fwdCount: (t.fwdCount || 0) + 1, created: now, updated: now
    } });
    ops.push({ type: 'update', id: t.id, patch: { status: 'fwd', fwdTo: toDate, fwdId: id, who: null, updated: now } });
    S.store.commit(ops);
    toast(md(toDate) + '로 넘겼습니다.');
    return true;
  }

  function pullAllToToday() {
    var t0 = today();
    var list = S.pending.filter(function (t) { return t.date < t0; });
    if (!list.length) return;
    var now = Date.now(), ops = [];
    list.forEach(function (t, i) {
      var id = S.store.newId();
      ops.push({ type: 'set', task: {
        id: id, date: t0, pri: t.pri, ord: now + i, text: t.text,
        status: t.status === 'prog' ? 'prog' : 'open',
        fwdFrom: t.date, fwdCount: (t.fwdCount || 0) + 1, created: now, updated: now
      } });
      ops.push({ type: 'update', id: t.id, patch: { status: 'fwd', fwdTo: t0, fwdId: id, updated: now } });
    });
    S.store.commit(ops);
    if (S.view !== 'day' || S.date !== t0) setDate(t0);
    toast(list.length + '개를 오늘로 가져왔습니다. A·B·C와 순서를 다시 정해 보세요.');
  }

  function moveTask(id, dir) {
    var t = findTask(id); if (!t) return;
    var group = sortTasks(S.tasks).filter(function (x) { return x.pri === t.pri; });
    var i = -1, k;
    for (k = 0; k < group.length; k++) if (group[k].id === id) i = k;
    var j = i + dir;
    if (i < 0 || j < 0 || j >= group.length) return;
    var a = group[i], b = group[j], oa = a.ord || 0, ob = b.ord || 0, now = Date.now();
    if (oa === ob) ob = oa + dir;
    S.store.commit([
      { type: 'update', id: a.id, patch: { ord: ob, updated: now } },
      { type: 'update', id: b.id, patch: { ord: oa, updated: now } }
    ]);
  }

  function removeTask(id) {
    var t = findTask(id); if (!t) return;
    var backup = JSON.parse(JSON.stringify(t));
    S.store.removeTask(id);
    closeSheet(true);
    toast('지웠습니다.', null, { label: '되돌리기', fn: function () { S.store.commit([{ type: 'set', task: backup }]); } });
  }

  /* ───────── 편집 시트 ───────── */
  var editTextOriginal = '';
  function openSheet(id) {
    var t = findTask(id); if (!t) return;
    S.editId = id;
    $('#editText').value = t.text || '';
    editTextOriginal = t.text || '';
    $('#delegRow').hidden = true;
    $('#sheet').hidden = false;
    renderSheet();
  }

  function renderSheet() {
    var t = findTask(S.editId);
    if (!t) { closeSheet(true); return; }
    var sorted = sortTasks(S.tasks), labels = labelMap(sorted);
    $('#sheetLabel').textContent = labels[t.id] || t.pri;
    $('#sheetLabel').style.color = 'var(--' + t.pri + ')';
    $('#sheetTitle').textContent = md(t.date) + ' 할 일';
    $$('#editPri button').forEach(function (b) { b.classList.toggle('on', b.dataset.pri === t.pri); });
    $$('#statusGrid button').forEach(function (b) { b.classList.toggle('on', b.dataset.st === (t.status || 'open')); });
    $('#statusGrid button[data-st="fwd"]').disabled = t.status === 'fwd';
    var isFwd = t.status === 'fwd';
    $('#fwdRow').hidden = isFwd;
    $('#fwdInfo').hidden = !isFwd;
    if (isFwd) $('#fwdInfoText').textContent = (t.fwdTo ? md(t.fwdTo) + '로 넘긴 할 일입니다.' : '다른 날로 넘긴 할 일입니다.');
    var fd = $('#fwdDate');
    if (!fd.dataset.for || fd.dataset.for !== t.id) { fd.value = addDays(t.date, 1); fd.dataset.for = t.id; }
    var group = sorted.filter(function (x) { return x.pri === t.pri; });
    var idx = group.map(function (x) { return x.id; }).indexOf(t.id);
    var onDay = t.date === S.date;
    $('#btnUp').disabled = !onDay || idx <= 0;
    $('#btnDown').disabled = !onDay || idx < 0 || idx >= group.length - 1;
  }

  function saveEditText() {
    var t = findTask(S.editId); if (!t) return;
    var v = $('#editText').value.replace(/\s+$/, '');
    if (v.trim() && v !== editTextOriginal) {
      S.store.updateTask(t.id, { text: v.trim(), updated: Date.now() });
      editTextOriginal = v;
    }
  }

  function closeSheet(silent) {
    if (!silent && S.editId) saveEditText();
    S.editId = null;
    $('#sheet').hidden = true;
    $('#fwdDate').dataset.for = '';
  }

  /* ───────── 일정·메모·가치 자동 저장 ───────── */
  var notesTimer = null, notesPending = null;
  function onNotesInput() {
    notesPending = { date: S.date, value: $('#notes').value };
    clearTimeout(notesTimer);
    notesTimer = setTimeout(flushNotes, 700);
  }
  function flushNotes() {
    clearTimeout(notesTimer);
    if (notesPending && S.store) S.store.setDay(notesPending.date, { notes: notesPending.value });
    notesPending = null;
  }

  var schedPending = new Map(), schedTimer = null;
  function onSchedInput(e) {
    var h = e.target.dataset.h; if (!h) return;
    schedPending.set(S.date + '|' + h, e.target.value);
    clearTimeout(schedTimer);
    schedTimer = setTimeout(flushSched, 700);
  }
  function flushSched() {
    clearTimeout(schedTimer);
    if (!S.store || !schedPending.size) { schedPending.clear(); return; }
    var byDate = {};
    schedPending.forEach(function (v, k) {
      var p = k.split('|');
      (byDate[p[0]] = byDate[p[0]] || {})[p[1]] = v;
    });
    schedPending.clear();
    Object.keys(byDate).forEach(function (d) { S.store.setDay(d, { sched: byDate[d] }); });
  }

  var valuesTimer = null, valuesPending = {};
  function fillValues() {
    $$('#valuesView textarea').forEach(function (ta) {
      var f = ta.dataset.field;
      if (document.activeElement !== ta && !(f in valuesPending)) ta.value = (S.profile && S.profile[f]) || '';
    });
  }
  function onValuesInput(e) {
    var f = e.target.dataset.field; if (!f) return;
    valuesPending[f] = e.target.value;
    $('#valuesSaved').textContent = '저장 중…';
    clearTimeout(valuesTimer);
    valuesTimer = setTimeout(flushValues, 800);
  }
  function flushValues() {
    clearTimeout(valuesTimer);
    if (S.store && Object.keys(valuesPending).length) {
      S.store.setProfile(valuesPending);
      $('#valuesSaved').textContent = '저장했습니다.';
    }
    valuesPending = {};
  }

  /* ───────── 백업 ───────── */
  function exportBackup() {
    if (!S.store) return;
    closeDrawer();
    toast('백업 파일을 준비하는 중…');
    S.store.exportAll().then(function (data) {
      var payload = { app: 'my-planner', version: 1, exportedAt: new Date().toISOString(), tasks: data.tasks, days: data.days, profile: data.profile };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'planner-backup-' + today().replace(/-/g, '') + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      if (data.partial) toast('인터넷 연결이 없어, 이 기기에 내려받아 둔 내용만 저장했습니다. (할 일 ' + data.tasks.length + '개) 연결된 뒤 다시 저장하면 전체가 담깁니다.', null, null, 7000);
      else toast('백업 파일을 저장했습니다. (할 일 ' + data.tasks.length + '개)');
    }, function (e) { toast(describeError(e, 'export'), 'error'); });
  }

  function importBackup(file) {
    if (!file || !S.store) return;
    var reader = new FileReader();
    reader.onload = function () {
      var d;
      try { d = JSON.parse(reader.result); } catch (e) { toast('백업 파일을 읽지 못했습니다.', 'error'); return; }
      if (!d || d.app !== 'my-planner' || !Array.isArray(d.tasks)) { toast('이 앱의 백업 파일이 아닙니다.', 'error'); return; }
      if (!window.confirm('백업 파일의 할 일 ' + d.tasks.length + '개와 일정·메모·사명을 불러올까요?\n같은 항목이 있으면 백업 내용으로 바뀝니다.')) return;
      S.store.importAll(d).then(function () { toast('불러왔습니다.'); });
    };
    reader.readAsText(file);
  }

  /* ───────── 로그인 ───────── */
  var AUTH_MSG = {
    'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
    'auth/missing-email': '이메일을 입력하십시오.',
    'auth/missing-password': '비밀번호를 입력하십시오.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.\n처음 쓰는 이메일이라면 아래 "계정 만들기"를 누르십시오.',
    'auth/invalid-login-credentials': '이메일 또는 비밀번호가 맞지 않습니다.\n처음 쓰는 이메일이라면 아래 "계정 만들기"를 누르십시오.',
    'auth/wrong-password': '비밀번호가 맞지 않습니다.',
    'auth/user-not-found': '등록되지 않은 이메일입니다. "계정 만들기"를 누르십시오.',
    'auth/email-already-in-use': '이미 계정이 있는 이메일입니다. "로그인"을 누르십시오.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/password-does-not-meet-requirements': '비밀번호 조건(길이 등)을 확인하십시오.',
    'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도하십시오.',
    'auth/network-request-failed': '인터넷에 연결되어 있지 않습니다. 연결을 확인하십시오.',
    'auth/operation-not-allowed': 'Firebase에서 이메일/비밀번호 로그인이 아직 켜져 있지 않습니다. (설명서 2-3단계)',
    'auth/configuration-not-found': 'Firebase Authentication이 아직 시작되지 않았습니다. (설명서 2-3단계)',
    'auth/invalid-api-key': 'config.js의 apiKey가 올바르지 않습니다. (설명서 3-4단계)',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'config.js의 apiKey가 올바르지 않습니다. (설명서 3-4단계)'
  };
  function authMsg(e) { var c = (e && e.code) || ''; return AUTH_MSG[c] || ('로그인하지 못했습니다. (' + (c || (e && e.message) || '오류') + ')'); }

  function loginBusy(b) { ['#btnLogin', '#btnSignup', '#btnReset'].forEach(function (s) { $(s).disabled = b; }); }

  function doAuth(kind) {
    if (!FBA) return;
    var email = $('#loginEmail').value.trim(), pw = $('#loginPw').value;
    if (!email || !pw) { $('#loginErr').textContent = '이메일과 비밀번호를 모두 입력하십시오.'; return; }
    if (kind === 'signup' && pw.length < 6) { $('#loginErr').textContent = '비밀번호는 6자 이상이어야 합니다.'; return; }
    $('#loginErr').textContent = '';
    loginBusy(true);
    var p = kind === 'signup'
      ? FBA.FB.createUserWithEmailAndPassword(FBA.auth, email, pw)
      : FBA.FB.signInWithEmailAndPassword(FBA.auth, email, pw);
    p.then(function () { $('#loginPw').value = ''; }, function (e) { $('#loginErr').textContent = authMsg(e); })
      .then(function () { loginBusy(false); });
  }

  function doReset() {
    if (!FBA) return;
    var email = $('#loginEmail').value.trim();
    if (!email) { $('#loginErr').textContent = '위 이메일 칸에 가입한 이메일을 적은 뒤 다시 누르십시오.'; return; }
    loginBusy(true);
    FBA.FB.sendPasswordResetEmail(FBA.auth, email).then(function () {
      $('#loginErr').textContent = '비밀번호 재설정 메일을 보냈습니다. 메일함(스팸함 포함)을 확인하십시오.';
    }, function (e) { $('#loginErr').textContent = authMsg(e); }).then(function () { loginBusy(false); });
  }

  function doLogout() {
    closeDrawer();
    if (!FBA) return;
    if (!window.confirm('로그아웃할까요? 다시 로그인하면 내용이 그대로 나타납니다.')) return;
    flushNotes(); flushSched(); flushValues();
    FBA.FB.signOut(FBA.auth);
  }

  /* ───────── 서랍·알림 ───────── */
  function openDrawer() { $('#drawer').hidden = false; }
  function closeDrawer() { $('#drawer').hidden = true; }

  var toastTimer = null;
  function toast(msg, kind, action, ms) {
    var el = $('#toast'), btn = $('#toastAct');
    $('#toastMsg').textContent = msg;
    el.className = 'toast' + (kind === 'error' ? ' error' : '');
    if (action) {
      btn.hidden = false; btn.textContent = action.label;
      btn.onclick = function () { el.hidden = true; action.fn(); };
    } else { btn.hidden = true; btn.onclick = null; }
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, ms || (action ? 6000 : 3000));
  }

  /* ───────── 이벤트 연결 ───────── */
  function bindEvents() {
    $('#btnMenu').addEventListener('click', openDrawer);
    $('#btnPrev').addEventListener('click', function () { setDate(addDays(S.date, -1)); });
    $('#btnNext').addEventListener('click', function () { setDate(addDays(S.date, 1)); });
    $('#btnToday').addEventListener('click', function () { setDate(today()); });
    $('#dateBlock').addEventListener('click', function () { S.monthCursor = monthKey(S.date); showView('month'); });

    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]');
      if (g) { go(g.dataset.go); return; }
      var c = e.target.closest('[data-close]');
      if (c) { if (c.dataset.close === 'drawer') closeDrawer(); else closeSheet(); }
    });

    $('.tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab);
    });

    $('#addPri').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-pri]'); if (b) setAddPri(b.dataset.pri);
    });
    $('#addForm').addEventListener('submit', function (e) { e.preventDefault(); addTask(); });

    $('#taskList').addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'focus-add') { $('#addInput').focus(); return; }
      var li = e.target.closest('.task'); if (!li) return;
      if (a.dataset.act === 'toggle') toggle(li.dataset.id);
      else if (a.dataset.act === 'edit') openSheet(li.dataset.id);
    });

    $('#schedList').addEventListener('input', onSchedInput);
    $('#schedList').addEventListener('focusout', function () { flushSched(); });
    $('#notes').addEventListener('input', onNotesInput);
    $('#notes').addEventListener('blur', flushNotes);
    $('#valuesView').addEventListener('input', onValuesInput);
    $('#fontList').addEventListener('click', function (e) {
      var b = e.target.closest('.font-card'); if (!b) return;
      if (b.dataset.font === S.font) return;
      chooseFont(b.dataset.font, S.fontAll);
      toast(fontById(b.dataset.font).name + ' 글꼴로 바꿨습니다.');
    });
    $('#fontAll').addEventListener('change', function (e) { chooseFont(S.font, e.target.checked); });
    $('#themeList').addEventListener('click', function (e) {
      var b = e.target.closest('button.theme-card'); if (!b) return;
      if (b.dataset.theme === S.theme) return;
      chooseTheme(b.dataset.theme);
      toast(themeById(b.dataset.theme).name + ' 색으로 바꿨습니다.');
    });
    // 직접 고르기: 고르는 동안은 화면에만 미리 보여 주고, 다 고르면 저장
    $('#themeList').addEventListener('input', function (e) { if (e.target.id === 'themeColor') applyTheme('custom', e.target.value); });
    $('#themeList').addEventListener('change', function (e) {
      if (e.target.id !== 'themeColor') return;
      chooseTheme('custom', e.target.value);
      toast(readableAccent(e.target.value) === e.target.value.toUpperCase() ? '고른 색으로 바꿨습니다.' : '글씨가 잘 보이도록 조금 어둡게 바꿔 적용했습니다.');
    });
    $('#valuesView').addEventListener('focusout', flushValues);

    $('#minical').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-date]'); if (b) setDate(b.dataset.date);
    });
    $('#mgrid').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-date]'); if (!b) return;
      setDate(b.dataset.date);
      setTab('sched'); // 월간 달력은 일정을 보여 주므로, 휴대폰에서는 그날의 일정 화면을 엽니다
    });
    // PC 크기 ↔ 휴대폰 크기가 바뀌면 월간 달력 칸에 보일 줄 수를 다시 계산
    if (mqWide) {
      var onWide = function () { if (S.view === 'month') renderMonth(); };
      if (mqWide.addEventListener) mqWide.addEventListener('change', onWide); else if (mqWide.addListener) mqWide.addListener(onWide);
    }
    $('#monthTabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-m]'); if (!b) return;
      S.monthCursor = S.date.slice(0, 4) + '-' + pad(+b.dataset.m);
      showView('month');
    });
    $('#mPrev').addEventListener('click', function () { shiftMonth(-1); });
    $('#mNext').addEventListener('click', function () { shiftMonth(1); });
    $('#mToday').addEventListener('click', function () { S.monthCursor = monthKey(today()); subscribeSched(S.monthCursor); renderMonth(); });

    $('#btnPullAll').addEventListener('click', pullAllToToday);
    $('#btnPullAll2').addEventListener('click', pullAllToToday);
    $('#pendList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pact]'), item = e.target.closest('.pend-item');
      if (!b || !item) return;
      var t = findTask(item.dataset.id); if (!t) return;
      if (b.dataset.pact === 'today') forward(t, today());
      else if (b.dataset.pact === 'done') setStatus(t.id, 'done');
      else if (b.dataset.pact === 'del') setStatus(t.id, 'del');
    });

    $('#btnHideLocal').addEventListener('click', function () {
      $('#localBanner').hidden = true;
      try { sessionStorage.setItem('my-planner:hideLocal', '1'); } catch (e) { /* 무시 */ }
    });

    // 편집 시트
    $('#editText').addEventListener('blur', saveEditText);
    $('#editText').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); saveEditText(); $('#editText').blur(); }
    });
    $('#editPri').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-pri]'); var t = findTask(S.editId);
      if (!b || !t || b.dataset.pri === t.pri) return;
      S.store.updateTask(t.id, { pri: b.dataset.pri, ord: Date.now(), updated: Date.now() });
    });
    $('#btnUp').addEventListener('click', function () { moveTask(S.editId, -1); });
    $('#btnDown').addEventListener('click', function () { moveTask(S.editId, 1); });
    $('#statusGrid').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-st]'); var t = findTask(S.editId);
      if (!b || !t || b.disabled) return;
      var st = b.dataset.st;
      if (st === 'fwd') {
        if (t.status === 'fwd') return;
        var fd = $('#fwdDate');
        fd.scrollIntoView({ block: 'center', behavior: 'smooth' });
        fd.focus();
        try { if (fd.showPicker) fd.showPicker(); } catch (err) { /* 일부 브라우저는 지원 안 함 */ }
        return;
      }
      if (st === 'deleg') {
        $('#delegRow').hidden = false;
        $('#whoInput').value = t.who || '';
        $('#whoInput').focus();
        return;
      }
      $('#delegRow').hidden = true;
      setStatus(t.id, st);
    });
    $('#btnDelegSave').addEventListener('click', saveDeleg);
    $('#whoInput').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); saveDeleg(); } });
    $('#btnFwdTomorrow').addEventListener('click', function () {
      var t = findTask(S.editId); if (!t) return;
      if (forward(t, addDays(t.date, 1))) closeSheet(true);
    });
    $('#btnFwdDate').addEventListener('click', function () {
      var t = findTask(S.editId); if (!t) return;
      if (forward(t, $('#fwdDate').value)) closeSheet(true);
    });
    $('#btnUnfwd').addEventListener('click', function () {
      var t = findTask(S.editId); if (!t) return;
      S.store.commit(unforwardOps(t));
      toast('넘기기를 취소했습니다.');
    });
    $('#btnRemove').addEventListener('click', function () {
      if (!S.editId) return;
      if (window.confirm('이 할 일을 완전히 지울까요?\n(기록을 남기려면 대신 ✕ 취소를 쓰십시오)')) removeTask(S.editId);
    });

    // 서랍 메뉴
    $('#btnExport').addEventListener('click', exportBackup);
    $('#btnImport').addEventListener('click', function () { closeDrawer(); $('#importFile').value = ''; $('#importFile').click(); });
    $('#importFile').addEventListener('change', function (e) { importBackup(e.target.files[0]); });
    $('#btnLogout').addEventListener('click', doLogout);

    // 로그인
    $('#loginForm').addEventListener('submit', function (e) { e.preventDefault(); doAuth('login'); });
    $('#btnSignup').addEventListener('click', function () { doAuth('signup'); });
    $('#btnReset').addEventListener('click', doReset);
    $('#btnLocalAnyway').addEventListener('click', function () { startLocal('preview'); });

    // 키보드 (PC)
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('#sheet').hidden) { closeSheet(); return; }
        if (!$('#drawer').hidden) { closeDrawer(); return; }
      }
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!$('#sheet').hidden || !$('#drawer').hidden || $('#app').hidden || S.view !== 'day') return;
      if (e.key === 'ArrowLeft') setDate(addDays(S.date, -1));
      else if (e.key === 'ArrowRight') setDate(addDays(S.date, 1));
      else if (e.key === 't' || e.key === 'T') setDate(today());
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setTab('tasks'); $('#addInput').focus(); }
    });

    // 휴대폰: 좌우로 밀어 날짜 이동
    var sx = 0, sy = 0, st = 0, tracking = false;
    $('#dayView').addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1 || e.target.closest('input,textarea,button,.sched-row')) { tracking = false; return; }
      tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }, { passive: true });
    $('#dayView').addEventListener('touchend', function (e) {
      if (!tracking) return; tracking = false;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st < 600 && Math.abs(dx) > 70 && Math.abs(dy) < 45) setDate(addDays(S.date, dx < 0 ? 1 : -1));
    }, { passive: true });

    // 앱을 다시 열었을 때 날짜가 바뀌었으면 오늘로
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { flushNotes(); flushSched(); flushValues(); saveEditText(); return; }
      if (S.followToday && S.date !== today() && S.store) setDate(today());
      else { renderSched(); renderPendingBanner(); }
    });
    window.addEventListener('pagehide', function () { flushNotes(); flushSched(); flushValues(); });
  }

  function saveDeleg() {
    var t = findTask(S.editId); if (!t) return;
    var who = $('#whoInput').value.trim() || '누군가';
    setStatus(t.id, 'deleg', { who: who });
    $('#delegRow').hidden = true;
  }

  /* 1분마다: 현재 시각 줄 표시, 자정이 지나면 오늘로 */
  function tick() {
    if (!S.store) return;
    if (S.followToday && S.date !== today()) { setDate(today()); return; }
    var nowH = pad(new Date().getHours()), isToday = S.date === today();
    $$('#schedList .sched-row').forEach(function (row) { row.classList.toggle('now', isToday && row.dataset.h === nowH); });
  }
  setInterval(tick, 60000);

  function shiftMonth(n) {
    var p = S.monthCursor.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1);
    S.monthCursor = d.getFullYear() + '-' + pad(d.getMonth() + 1);
    subscribeSched(S.monthCursor);
    renderMonth();
  }

  try {
    boot();
  } catch (e) {
    // 시작하다 멈추면(예: 새 app.js와 예전 index.html이 섞였을 때) 안내를 보여 줌
    var sp = document.getElementById('splash');
    if (sp) {
      sp.hidden = false;
      sp.style.padding = '24px'; sp.style.textAlign = 'center'; sp.style.lineHeight = '1.7';
      sp.innerHTML = '앱을 시작하지 못했습니다.<br>업데이트할 때 받은 파일이 <b>모두</b> GitHub 저장소에 올라갔는지 확인한 뒤<br>앱을 닫았다가 다시 열어 주십시오.' +
        '<br><small style="opacity:.75">(' + esc(String((e && e.message) || e)) + ')</small>';
    }
    if (window.console) console.error(e);
  }
})();
