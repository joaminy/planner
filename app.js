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
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
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

  /* ───────── 앱 상태 ───────── */
  var S = {
    store: null, mode: null, user: null,
    date: today(), followToday: true,
    view: 'day', tab: 'tasks',
    tasks: [], day: {}, dayLoaded: false,
    pending: [], profile: {},
    range: [], rangeKey: '', monthCursor: monthKey(today()),
    addPri: readPref('addPri', 'A'),
    editId: null,
    unsub: { day: null, pending: null, range: null, profile: null }
  };
  var FBA = null; // { FB, app, auth, db }

  function readPref(k, def) { try { return localStorage.getItem('my-planner:' + k) || def; } catch (e) { return def; } }
  function writePref(k, v) { try { localStorage.setItem('my-planner:' + k, v); } catch (e) { /* 무시 */ } }

  /* ───────── 시작 ───────── */
  function boot() {
    window.__plannerBooted = true;
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
    subscribeRange(S.view === 'month' ? S.monthCursor : monthKey(S.date));
  }

  function detachStore() {
    flushNotes(); flushSched(); flushValues();
    Object.keys(S.unsub).forEach(function (k) { if (S.unsub[k]) S.unsub[k](); S.unsub[k] = null; });
    if (S.store && S.store.destroy) S.store.destroy();
    S.store = null;
    S.tasks = []; S.day = {}; S.pending = []; S.range = []; S.rangeKey = ''; S.profile = {};
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

  function subscribeRange(mk) {
    if (!S.store) return;
    if (S.rangeKey === mk && S.unsub.range) return;
    if (S.unsub.range) S.unsub.range();
    S.rangeKey = mk; S.range = [];
    var p = mk.split('-'), y = +p[0], m = +p[1];
    var from = mk + '-01', to = mk + '-' + pad(lastDay(y, m));
    S.unsub.range = S.store.watchRange(from, to, function (list) {
      if (S.rangeKey !== mk) return;
      S.range = list;
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
    $('#dayMonth').innerHTML = (d.getMonth() + 1) + '월 <span class="wd ' + (w === 0 ? 'sun' : w === 6 ? 'sat' : '') + '">' + WD[w] + '요일</span>';
    var doy = dayOfYear(S.date);
    $('#dayYear').textContent = y + '년 · ' + doy + '번째 날 · 올해 ' + (daysInYear(y) - doy) + '일 남음';
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

  function countsByDate(list) {
    var c = {};
    list.forEach(function (t) {
      var o = c[t.date] || (c[t.date] = { open: 0, done: 0, tops: [] });
      if (ACTIVE.indexOf(t.status) >= 0) { o.open++; o.tops.push(t); }
      else if (t.status === 'done' || t.status === 'deleg') o.done++;
    });
    Object.keys(c).forEach(function (k) { c[k].tops = sortTasks(c[k].tops).slice(0, 3); });
    return c;
  }

  function renderMiniCal() {
    var mk = monthKey(S.date), p = mk.split('-'), y = +p[0], m = +p[1];
    var first = new Date(y, m - 1, 1).getDay(), days = lastDay(y, m), t0 = today();
    var counts = S.rangeKey === mk ? countsByDate(S.range) : {};
    var html = '<div class="mc-head"><span>' + y + '년 ' + m + '월</span><button data-go="month">월간 달력 ›</button></div>';
    html += '<table><thead><tr>' + WD.map(function (w) { return '<th>' + w + '</th>'; }).join('') + '</tr></thead><tbody><tr>';
    var cell = 0, i;
    for (i = 0; i < first; i++) { html += '<td></td>'; cell++; }
    for (var d = 1; d <= days; d++) {
      var ds = mk + '-' + pad(d), cls = [];
      if (counts[ds] && counts[ds].open) cls.push('has');
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

  function renderMonth() {
    var p = S.monthCursor.split('-'), y = +p[0], m = +p[1];
    $('#monthTitle').textContent = y + '년 ' + m + '월';
    var first = new Date(y, m - 1, 1).getDay(), days = lastDay(y, m), t0 = today();
    var counts = S.rangeKey === S.monthCursor ? countsByDate(S.range) : {};
    var html = WD.map(function (w, i) { return '<div class="wd ' + (i === 0 ? 'sun' : i === 6 ? 'sat' : '') + '">' + w + '</div>'; }).join('');
    var cell = 0, i;
    for (i = 0; i < first; i++) { html += '<div class="cell blank"></div>'; cell++; }
    for (var d = 1; d <= days; d++) {
      var ds = S.monthCursor + '-' + pad(d), w = (first + d - 1) % 7, c = counts[ds];
      var cls = ['cell']; if (w === 0) cls.push('sun'); if (w === 6) cls.push('sat');
      if (ds === t0) cls.push('today'); if (ds === S.date) cls.push('sel');
      var inner = '<span class="dn">' + d + '</span>';
      if (c && (c.open || c.done)) {
        inner += '<span class="cnt-line">' + (c.open ? '<span class="c-open">● ' + c.open + '</span> ' : '') + (c.done ? '<span class="c-done">✓ ' + c.done + '</span>' : '') + '</span>';
        c.tops.forEach(function (t) { inner += '<span class="t">' + esc(t.pri) + ' ' + esc(t.text) + '</span>'; });
      }
      html += '<button class="' + cls.join(' ') + '" data-date="' + ds + '" aria-label="' + m + '월 ' + d + '일">' + inner + '</button>';
      cell++;
    }
    while (cell % 7 !== 0) { html += '<div class="cell blank"></div>'; cell++; }
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
        '<span>' + esc(t.text) + (t.status === 'prog' ? ' <small style="color:var(--gold)">● 진행 중</small>' : '') + '</span>' +
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

  /* ───────── 화면 전환 ───────── */
  var VIEWS = { day: '#dayView', month: '#monthView', pending: '#pendingView', values: '#valuesView', help: '#helpView' };
  function showView(v) {
    if (v !== 'values') flushValues();
    S.view = v;
    Object.keys(VIEWS).forEach(function (k) { $(VIEWS[k]).hidden = k !== v; });
    if (v === 'month') { subscribeRange(S.monthCursor); renderMonth(); }
    else if (S.store) subscribeRange(monthKey(S.date));
    if (v === 'pending') renderPendingView();
    if (v === 'values') fillValues();
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
    subscribeRange(monthKey(d));
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
    $('#valuesView').addEventListener('focusout', flushValues);

    $('#minical').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-date]'); if (b) setDate(b.dataset.date);
    });
    $('#mgrid').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-date]'); if (b) setDate(b.dataset.date);
    });
    $('#monthTabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-m]'); if (!b) return;
      S.monthCursor = S.date.slice(0, 4) + '-' + pad(+b.dataset.m);
      showView('month');
    });
    $('#mPrev').addEventListener('click', function () { shiftMonth(-1); });
    $('#mNext').addEventListener('click', function () { shiftMonth(1); });
    $('#mToday').addEventListener('click', function () { S.monthCursor = monthKey(today()); subscribeRange(S.monthCursor); renderMonth(); });

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
    subscribeRange(S.monthCursor);
    renderMonth();
  }

  boot();
})();
