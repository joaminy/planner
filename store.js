/* 나의 플래너 — 데이터 저장소 (store.js)
   - LocalStore    : 이 기기(브라우저)에만 저장  ― 미리보기 모드
   - FirebaseStore : Firebase(Cloud Firestore)에 저장 ― PC·휴대폰 동기화
   두 저장소는 똑같은 사용법(함수 이름)을 가지므로 화면 코드는 그대로 둡니다.
   이 파일은 수정하지 않아도 됩니다. */
(function () {
  'use strict';

  var ACTIVE = ['open', 'prog'];

  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* 백업 파일에서 들어온 값을 안전하게 정리 */
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var STATUSES = ['open', 'done', 'prog', 'fwd', 'deleg', 'del'];
  function cleanTask(t) {
    if (!t || typeof t !== 'object') return null;
    if (!DATE_RE.test(String(t.date || ''))) return null;
    var out = {
      id: String(t.id || makeId()).replace(/[\/\s]/g, '').slice(0, 60) || makeId(),
      date: String(t.date),
      pri: ['A', 'B', 'C'].indexOf(t.pri) >= 0 ? t.pri : 'B',
      ord: typeof t.ord === 'number' && isFinite(t.ord) ? t.ord : (Number(t.ord) || Date.now()),   // 0·음수(맨 위)도 그대로
      text: String(t.text == null ? '' : t.text).slice(0, 2000),
      status: STATUSES.indexOf(t.status) >= 0 ? t.status : 'open',
      created: Number(t.created) || Date.now(),
      updated: Number(t.updated) || Date.now()
    };
    if (t.who) out.who = String(t.who).slice(0, 60);
    if (t.fwdTo && DATE_RE.test(t.fwdTo)) out.fwdTo = t.fwdTo;
    if (t.fwdId) out.fwdId = String(t.fwdId).slice(0, 60);
    if (t.fwdFrom && DATE_RE.test(t.fwdFrom)) out.fwdFrom = t.fwdFrom;
    if (t.fwdCount) out.fwdCount = Number(t.fwdCount) || 0;
    if (t.bold === true) out.bold = true;
    // v1.9부터: 완료하기 전 자리(완료를 풀면 돌아갈 곳) · 진행 중으로 바꿔 맨 위로 옮긴 시각
    if (typeof t.ordPrev === 'number' && isFinite(t.ordPrev)) out.ordPrev = t.ordPrev;
    if (Number(t.progAt) > 0) out.progAt = Number(t.progAt);
    return out;
  }
  /* 일정 칸 이름: '06'~'22' = 시간, 'a1'~'a3' = 종일 일정 (v1.5부터) */
  var SCHED_KEY_RE = /^(\d{2}|a[1-3])$/;
  /* 일정 글자 꾸미기: { c: 글자 색(빈칸 = 기본), b: 진하게, bc: 종일 일정 테두리 색(빈칸 = 기본, v1.6부터),
     bs: 테두리 선 모양('' 실선 · 'dotted' 점선 · 'dashed' 긴 점선), bw: 굵기('' 보통 · 'thin' 얇게) (v1.7부터) } */
  var SCHED_COLORS = ['', 'red', 'orange', 'green', 'blue', 'purple', 'pink'];
  var BORDER_COLORS = ['', 'red', 'orange', 'yellow', 'green', 'teal', 'sky', 'blue', 'navy', 'purple', 'pink', 'brown', 'gray', 'black'];
  function cleanStyle(v) {
    if (!v || typeof v !== 'object') return null;
    var out = { c: SCHED_COLORS.indexOf(v.c) >= 0 ? v.c : '', b: v.b === true };
    if (typeof v.bc === 'string') out.bc = BORDER_COLORS.indexOf(v.bc) >= 0 ? v.bc : '';
    if (typeof v.bs === 'string') out.bs = v.bs === 'dotted' || v.bs === 'dashed' ? v.bs : '';
    if (typeof v.bw === 'string') out.bw = v.bw === 'thin' ? 'thin' : '';
    return out;
  }
  /* 일정 정보 (v1.8부터): { ts: 시작 시각 'HH:MM', te: 끝 시각, loc: 장소, memo: 메모 } (빈칸 = 없음) */
  var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  function cleanTime(v) { return typeof v === 'string' && TIME_RE.test(v) ? v : ''; }
  function cleanInfo(v) {
    if (!v || typeof v !== 'object') return null;
    return {
      ts: cleanTime(v.ts), te: cleanTime(v.te),
      loc: typeof v.loc === 'string' ? v.loc.slice(0, 100) : '',
      memo: typeof v.memo === 'string' ? v.memo.slice(0, 2000) : ''
    };
  }
  /* 월간 달력의 날짜 바탕색 (빈칸 = 색 없음). 색마다 연하게(-l) · 보통 · 진하게(-d) 세 가지 (v1.6부터 36가지) */
  var BG_HUES = ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'sky', 'blue', 'purple', 'pink', 'brown', 'gray'];
  var DAY_BGS = [];
  BG_HUES.forEach(function (h) { DAY_BGS.push(h + '-l', h, h + '-d'); });
  function cleanBg(v) { return DAY_BGS.indexOf(v) >= 0 ? v : ''; }
  /* 여러 날 이어지는 종일 일정(v1.6부터): { s: 시작 날짜, e: 끝 날짜, t: 내용, c, b, bc, created, updated }
     (v1.8부터 일정 정보 ts · te · loc · memo도 같은 문서에) */
  var SPAN_MAX = 366;   // 기간은 최대 366일
  function spanDays(s, e) {
    var a = s.split('-'), b = e.split('-');
    return Math.round((Date.UTC(+b[0], +b[1] - 1, +b[2]) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 86400000) + 1;
  }
  function cleanSpan(v) {
    if (!v || typeof v !== 'object') return null;
    var s = String(v.s || ''), e = String(v.e || ''), t = String(v.t == null ? '' : v.t).slice(0, 500);
    if (!DATE_RE.test(s) || !t.trim()) return null;
    if (!DATE_RE.test(e) || e < s || spanDays(s, e) > SPAN_MAX) e = s;
    var out = {
      s: s, e: e, t: t,
      c: SCHED_COLORS.indexOf(v.c) >= 0 ? v.c : '', b: v.b === true,
      bc: BORDER_COLORS.indexOf(v.bc) >= 0 ? v.bc : '',
      bs: v.bs === 'dotted' || v.bs === 'dashed' ? v.bs : '', bw: v.bw === 'thin' ? 'thin' : '',
      created: Number(v.created) || Date.now(), updated: Number(v.updated) || Date.now()
    };
    var inf = cleanInfo(v);
    if (inf.ts || inf.te || inf.loc || inf.memo) { out.ts = inf.ts; out.te = inf.te; out.loc = inf.loc; out.memo = inf.memo; }
    return out;
  }
  function spanId(v) { return String((v && v.id) || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60); }
  function cleanDay(d) {
    var out = {};
    if (!d || typeof d !== 'object') return out;
    if (typeof d.notes === 'string') out.notes = d.notes.slice(0, 100000);
    if (typeof d.notesHtml === 'string') out.notesHtml = d.notesHtml.slice(0, 300000);
    if (d.sched && typeof d.sched === 'object') {
      out.sched = {};
      Object.keys(d.sched).forEach(function (h) {
        if (SCHED_KEY_RE.test(h)) out.sched[h] = String(d.sched[h] == null ? '' : d.sched[h]).slice(0, 500);
      });
    }
    if (d.schedStyle && typeof d.schedStyle === 'object') {
      out.schedStyle = {};
      Object.keys(d.schedStyle).forEach(function (h) {
        var s = cleanStyle(d.schedStyle[h]);
        if (SCHED_KEY_RE.test(h) && s) out.schedStyle[h] = s;
      });
    }
    if (d.schedInfo && typeof d.schedInfo === 'object') {
      out.schedInfo = {};
      Object.keys(d.schedInfo).forEach(function (h) {
        var v = cleanInfo(d.schedInfo[h]);
        if (SCHED_KEY_RE.test(h) && v) out.schedInfo[h] = v;
      });
    }
    if (typeof d.bg === 'string') out.bg = cleanBg(d.bg);
    return out;
  }
  /* 하루 문서에 변경 내용 합치기 (일정·글자 꾸미기·일정 정보는 시간별로 합치고, 메모·바탕색은 통째로 바꿈) */
  function mergeDay(d, patch) {
    ['sched', 'schedStyle', 'schedInfo'].forEach(function (k) {
      if (patch[k] && typeof patch[k] === 'object') d[k] = Object.assign({}, d[k] || {}, clone(patch[k]));
    });
    ['notes', 'notesHtml'].forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) d[k] = patch[k];
    });
    if (Object.prototype.hasOwnProperty.call(patch, 'bg')) {
      if (cleanBg(patch.bg)) d.bg = patch.bg; else delete d.bg;
    }
  }
  /* 메모가 있는 날만 골라 최신 날짜부터 */
  function memoList(entries) {
    return entries.filter(function (e) { return typeof e.notes === 'string' && e.notes.trim(); })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }
  var DOW_RE = /^(theme|(dk|lt)-[a-z]{2,10}|#[0-9A-Fa-f]{6})?$/;
  function cleanProfile(p) {
    var out = {};
    if (!p || typeof p !== 'object') return out;
    ['mission', 'values', 'goals', 'near'].forEach(function (k) {
      if (typeof p[k] === 'string') out[k] = p[k].slice(0, 20000);
    });
    if (typeof p.font === 'string') out.font = p.font.slice(0, 40);
    if (typeof p.fontAll === 'boolean') out.fontAll = p.fontAll;
    if (typeof p.theme === 'string') out.theme = p.theme.slice(0, 20);
    if (typeof p.themeColor === 'string' && /^(#[0-9A-Fa-f]{6})?$/.test(p.themeColor)) out.themeColor = p.themeColor;
    /* 월간 달력 요일 칸 색 (v1.6부터): 빈칸 = 기본, 'theme' = 플래너 색, 'dk-…'/'lt-…' = 고른 색, '#RRGGBB' = 직접 고른 색 */
    if (typeof p.dowColor === 'string' && DOW_RE.test(p.dowColor)) out.dowColor = p.dowColor;
    /* 요일마다 따로 고른 색 (v1.7부터): { '0'(일) … '6'(토): 위와 같은 값, b: 그때의 '모두' 색 } */
    if (p.dowEach && typeof p.dowEach === 'object') {
      var e = {}, n = 0;
      ['0', '1', '2', '3', '4', '5', '6', 'b'].forEach(function (k) {
        if (typeof p.dowEach[k] === 'string' && DOW_RE.test(p.dowEach[k])) { e[k] = p.dowEach[k]; if (k !== 'b') n++; }
      });
      if (n) out.dowEach = e;
    }
    return out;
  }

  /* ───────── 메모장 (v1.11부터): 폴더 안에 폴더를 둘 수 있는 메모 ─────────
     폴더 { name, parent: 위 폴더 id('' = 맨 위), color: 폴더 색('' = 기본), created, updated,
            ord: 끌어서 정한 순서(1부터, 0 = 이름 순서) (v1.12부터) }
     메모 { folder: 폴더 id('' = 폴더 없음), title, body: 그냥 글자(검색·미리보기용),
            bodyHtml: 진하게나 그림이 있을 때만 <b>·<br>·<img>로 쓴 HTML('' = 없음), fav: 즐겨찾기,
            trashed: 휴지통에 넣은 시각(0 = 휴지통 아님), created, updated,
            ord: 끌어서 정한 순서(작을수록 앞) · imgs: 메모 안 그림 id 목록 · thumb: 첫 그림의 작은 그림 · thumbId (v1.12부터) }
     그림 { note: 메모 id, data: 그림(data URL), thumb: 작은 그림, w, h, created } (v1.12부터)
            — 메모 문서가 너무 커지지 않게 그림은 따로 저장하고, 메모에는 그림 id만 적습니다.
     지울 값도 null 대신 ''·0·false로 저장합니다(Firebase와 이 기기 저장이 똑같이 동작하도록). */
  var PAD_COLORS = ['', 'red', 'orange', 'yellow', 'green', 'teal', 'sky', 'blue', 'navy', 'purple', 'pink', 'brown', 'gray'];
  var PAD_TITLE_MAX = 200, PAD_BODY_MAX = 100000, PAD_HTML_MAX = 300000, PAD_NAME_MAX = 40;
  var PAD_IMG_MAX = 900000, PAD_THUMB_MAX = 60000, PAD_IMGS_MAX = 300;   // Firebase 문서 하나는 1MB까지
  var PAD_IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+\/=]+$/;
  function padIdOf(v) { return String(v == null ? '' : v).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60); }
  function padNum(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function cleanPadFolder(v) {
    if (!v || typeof v !== 'object') return null;
    var name = String(v.name == null ? '' : v.name).replace(/\s+/g, ' ').trim().slice(0, PAD_NAME_MAX);
    if (!name) return null;
    var ord = padNum(v.ord);
    return {
      name: name, parent: padIdOf(v.parent), color: PAD_COLORS.indexOf(v.color) >= 0 ? v.color : '',
      created: Number(v.created) || Date.now(), updated: Number(v.updated) || Date.now(),
      ord: ord !== null && ord > 0 ? ord : 0
    };
  }
  function cleanPadNote(v) {
    if (!v || typeof v !== 'object') return null;
    var out = {
      folder: padIdOf(v.folder),
      title: String(v.title == null ? '' : v.title).slice(0, PAD_TITLE_MAX),
      body: String(v.body == null ? '' : v.body).slice(0, PAD_BODY_MAX),
      bodyHtml: typeof v.bodyHtml === 'string' ? v.bodyHtml.slice(0, PAD_HTML_MAX) : '',
      fav: v.fav === true,
      trashed: Number(v.trashed) > 0 ? Number(v.trashed) : 0,
      created: Number(v.created) || Date.now(), updated: Number(v.updated) || Date.now()
    };
    var ord = padNum(v.ord);
    if (ord !== null) out.ord = ord;
    var imgs = Array.isArray(v.imgs) ? v.imgs.map(padIdOf).filter(Boolean).slice(0, PAD_IMGS_MAX) : [];
    if (imgs.length) {
      out.imgs = imgs;
      if (typeof v.thumb === 'string' && v.thumb.length <= PAD_THUMB_MAX && PAD_IMG_RE.test(v.thumb)) { out.thumb = v.thumb; out.thumbId = padIdOf(v.thumbId); }
    }
    if (!out.title.trim() && !out.body.trim() && !imgs.length) return null;   // 빈 메모는 들여오지 않음
    return out;
  }
  /* 메모 속 그림: 알맞은 그림 자료만 받음 */
  function cleanPadImage(v) {
    if (!v || typeof v !== 'object') return null;
    var data = typeof v.data === 'string' ? v.data : '';
    if (!data || data.length > PAD_IMG_MAX || !PAD_IMG_RE.test(data)) return null;
    var thumb = typeof v.thumb === 'string' && v.thumb.length <= PAD_THUMB_MAX && PAD_IMG_RE.test(v.thumb) ? v.thumb : '';
    function side(x) { x = Math.round(Number(x) || 0); return x > 0 ? Math.min(x, 20000) : 1; }
    return { note: padIdOf(v.note), data: data, thumb: thumb, w: side(v.w), h: side(v.h), created: Number(v.created) || Date.now() };
  }
  function buildPadImportOps(data) {
    var ops = [], pad = data && data.pad;
    if (!pad || typeof pad !== 'object') return ops;
    (Array.isArray(pad.folders) ? pad.folders : []).forEach(function (v) {
      var c = cleanPadFolder(v), id = padIdOf(v && v.id);
      if (c && id) ops.push({ kind: 'folder', op: 'set', id: id, data: c });
    });
    (Array.isArray(pad.notes) ? pad.notes : []).forEach(function (v) {
      var c = cleanPadNote(v), id = padIdOf(v && v.id);
      if (c && id) ops.push({ kind: 'note', op: 'set', id: id, data: c });
    });
    return ops;
  }
  function buildPadImgImport(data) {   // 백업 파일의 그림 [{ id, rec }]
    var pad = data && data.pad, out = [];
    (pad && Array.isArray(pad.images) ? pad.images : []).forEach(function (v) {
      var c = cleanPadImage(v), id = padIdOf(v && v.id);
      if (c && id) out.push({ id: id, rec: c });
    });
    return out;
  }
  /* 이 기기에만 저장할 때 그림은 IndexedDB에 (localStorage는 5MB 안팎이라 그림을 담기에 작음) */
  function idbOpen(name) {
    return new Promise(function (res, rej) {
      var rq;
      try {
        if (!window.indexedDB) throw new Error('no-indexeddb');
        rq = window.indexedDB.open(name, 1);
      } catch (e) { rej(e); return; }
      rq.onupgradeneeded = function () { var db = rq.result; if (!db.objectStoreNames.contains('img')) db.createObjectStore('img'); };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error || new Error('indexeddb')); };
      rq.onblocked = function () { rej(new Error('indexeddb-blocked')); };
    });
  }
  function idbRun(db, mode, fn) {
    return new Promise(function (res, rej) {
      var tx = db.transaction('img', mode), out = null, rq = fn(tx.objectStore('img'));
      if (rq) rq.onsuccess = function () { out = rq.result; };
      tx.oncomplete = function () { res(out); };
      tx.onerror = tx.onabort = function () { rej(tx.error || new Error('indexeddb')); };
    });
  }

  /* ───────────────────── LocalStore ───────────────────── */
  function LocalStore(key) {
    var self = this;
    this.kind = 'local';
    this.key = key || 'my-planner:local:v1';
    this.spanKey = this.key + ':spans';   // 여러 날 종일 일정은 따로 저장 (예전 버전 앱이 저장해도 지워지지 않게)
    this.padKey = this.key + ':pad';      // 메모장도 따로 저장 (v1.11부터, 같은 까닭)
    this.subs = [];
    this.onStatus = null;
    this.onError = null;
    this.data = this._load();
    this._queued = false;
    this._onStorage = function (e) {
      if (e.key === self.key || e.key === self.spanKey || e.key === self.padKey) { self.data = self._load(); self._changed(); }
    };
    window.addEventListener('storage', this._onStorage);
  }
  LocalStore.prototype._load = function () {
    var out = { tasks: {}, days: {}, profile: {}, spans: {}, pad: { folders: {}, notes: {} } };
    try {
      var raw = localStorage.getItem(this.key);
      if (raw) {
        var d = JSON.parse(raw);
        out = { tasks: d.tasks || {}, days: d.days || {}, profile: d.profile || {}, spans: {}, pad: out.pad };
      }
      var rs = localStorage.getItem(this.spanKey);
      if (rs) { var sp = JSON.parse(rs); if (sp && typeof sp === 'object') out.spans = sp; }
      var rp = localStorage.getItem(this.padKey);
      if (rp) {
        var pd = JSON.parse(rp);
        if (pd && typeof pd === 'object') out.pad = { folders: pd.folders && typeof pd.folders === 'object' ? pd.folders : {}, notes: pd.notes && typeof pd.notes === 'object' ? pd.notes : {} };
      }
    } catch (e) { /* 저장소를 읽을 수 없으면 빈 상태로 시작 */ }
    return out;
  };
  LocalStore.prototype._save = function () {
    try {
      var main = { tasks: this.data.tasks, days: this.data.days, profile: this.data.profile };
      localStorage.setItem(this.key, JSON.stringify(main));
      if (Object.keys(this.data.spans || {}).length || localStorage.getItem(this.spanKey) !== null) {
        localStorage.setItem(this.spanKey, JSON.stringify(this.data.spans || {}));
      }
      var pad = this.data.pad || { folders: {}, notes: {} };
      if (Object.keys(pad.folders).length || Object.keys(pad.notes).length || localStorage.getItem(this.padKey) !== null) {
        localStorage.setItem(this.padKey, JSON.stringify(pad));
      }
    }
    catch (e) { if (this.onError) this.onError({ code: 'local-save-failed', message: String(e) }); }
  };
  LocalStore.prototype._spans = function () {
    var sp = this.data.spans || {};
    return Object.keys(sp).map(function (id) { var o = clone(sp[id]); o.id = id; return o; });
  };
  LocalStore.prototype._changed = function () {
    var self = this;
    if (this._queued) return;
    this._queued = true;
    Promise.resolve().then(function () {
      self._queued = false;
      self.subs.slice().forEach(function (s) { s(); });
    });
  };
  LocalStore.prototype._sub = function (run) {
    var self = this;
    this.subs.push(run);
    Promise.resolve().then(function () { if (self.subs.indexOf(run) >= 0) run(); });
    return function () {
      var i = self.subs.indexOf(run);
      if (i >= 0) self.subs.splice(i, 1);
    };
  };
  LocalStore.prototype._tasks = function () {
    var t = this.data.tasks;
    return Object.keys(t).map(function (k) { return t[k]; });
  };
  LocalStore.prototype.watchDay = function (date, cb) {
    var self = this;
    return this._sub(function () {
      cb({
        tasks: self._tasks().filter(function (t) { return t.date === date; }).map(clone),
        day: clone(self.data.days[date] || {})
      });
    });
  };
  LocalStore.prototype.watchPending = function (cb) {
    var self = this;
    return this._sub(function () {
      cb(self._tasks().filter(function (t) { return ACTIVE.indexOf(t.status) >= 0; }).map(clone));
    });
  };
  /* (예전 버전 호환용) 기간 안의 할 일 */
  LocalStore.prototype.watchRange = function (from, to, cb) {
    var self = this;
    return this._sub(function () {
      cb(self._tasks().filter(function (t) { return t.date >= from && t.date <= to; }).map(clone));
    });
  };
  /* 한 달 치 일정: { '2026-11-05': { 'a1': '휴가', '09': '회의', ... }, ... }  ('a1'~'a3'은 종일 일정)
     두 번째 값은 글자 꾸미기: { '2026-11-05': { '09': { c: 'red', b: true } } }
     세 번째 값은 날짜 바탕색: { '2026-11-05': 'yellow' }
     네 번째 값은 일정 정보(v1.8부터): { '2026-11-05': { '09': { ts: '09:30', te: '', loc: '본사', memo: '' } } } */
  LocalStore.prototype.watchSchedRange = function (from, to, cb) {
    var self = this;
    return this._sub(function () {
      var days = self.data.days || {}, out = {}, style = {}, bg = {}, info = {};
      Object.keys(days).forEach(function (date) {
        if (date < from || date > to || !days[date]) return;
        if (days[date].sched) out[date] = clone(days[date].sched);
        if (days[date].schedStyle) style[date] = clone(days[date].schedStyle);
        if (cleanBg(days[date].bg)) bg[date] = days[date].bg;
        if (days[date].schedInfo) info[date] = clone(days[date].schedInfo);
      });
      cb(out, style, bg, info);
    });
  };
  /* 메모 모아보기: [{ date, notes, notesHtml }, ...] 최신 날짜부터 */
  LocalStore.prototype.watchNotes = function (cb) {
    var self = this;
    return this._sub(function () {
      var days = self.data.days || {};
      cb(memoList(Object.keys(days).map(function (date) {
        var d = days[date] || {};
        return { date: date, notes: d.notes, notesHtml: d.notesHtml };
      })));
    });
  };
  LocalStore.prototype.watchProfile = function (cb) {
    var self = this;
    return this._sub(function () { cb(clone(self.data.profile || {})); });
  };
  /* 여러 날 종일 일정 가운데 from~to 기간과 겹치는 것: [{ id, s, e, t, c, b, bc, ... }] */
  LocalStore.prototype.watchSpans = function (from, to, cb) {
    var self = this;
    return this._sub(function () {
      cb(self._spans().filter(function (v) { return v.e >= from && v.s <= to; }));
    });
  };
  LocalStore.prototype.newSpanId = function () { return makeId(); };
  /* 메모장: 폴더와 메모 전부 { folders: [{ id, ... }], notes: [{ id, ... }] } */
  LocalStore.prototype._padLists = function () {
    var pad = this.data.pad || { folders: {}, notes: {} };
    function list(m) { return Object.keys(m).map(function (id) { var o = clone(m[id]); o.id = id; return o; }); }
    return { folders: list(pad.folders), notes: list(pad.notes) };
  };
  LocalStore.prototype.watchPad = function (cb) {
    var self = this;
    return this._sub(function () { cb(self._padLists()); });
  };
  LocalStore.prototype.newPadId = function () { return makeId(); };
  /* 메모장 바꾸기: [{ kind: 'folder' | 'note', op: 'set'(새로·통째로) | 'update'(있는 것만 고침) | 'remove', id, data }] */
  LocalStore.prototype.padCommit = function (ops) {
    var pad = this.data.pad || (this.data.pad = { folders: {}, notes: {} });
    (ops || []).forEach(function (o) {
      var m = o.kind === 'folder' ? pad.folders : o.kind === 'note' ? pad.notes : null, id = padIdOf(o.id);
      if (!m || !id) return;
      if (o.op === 'set') m[id] = clone(o.data);
      else if (o.op === 'update') {
        if (m[id]) Object.keys(o.data || {}).forEach(function (k) { if (o.data[k] === null || o.data[k] === undefined) delete m[id][k]; else m[id][k] = o.data[k]; });
      }
      else if (o.op === 'remove') delete m[id];
    });
    this._save(); this._changed();
  };
  /* 메모 속 그림 (v1.12부터): IndexedDB가 안 되는 브라우저(사생활 보호 모드 등)에서는 앱을 닫을 때까지만 기억 */
  LocalStore.prototype._imgDb = function () {
    var self = this;
    if (!this._idb) this._idb = idbOpen(this.key + ':img').catch(function () { self._imgMem = self._imgMem || {}; return null; });
    return this._idb;
  };
  LocalStore.prototype.padImgPut = function (id, rec) {
    var self = this, c = cleanPadImage(rec);
    id = padIdOf(id);
    if (!id || !c) return Promise.reject(new Error('bad-image'));
    return this._imgDb().then(function (db) {
      if (!db) { self._imgMem[id] = c; return; }
      return idbRun(db, 'readwrite', function (st) { return st.put(c, id); });
    }).then(null, function (e) {
      if (self.onError) self.onError({ code: 'local-save-failed', message: String(e) });
      throw e;
    });
  };
  LocalStore.prototype.padImgGet = function (id) {
    var self = this;
    id = padIdOf(id);
    if (!id) return Promise.resolve(null);
    return this._imgDb().then(function (db) {
      if (!db) return (self._imgMem && self._imgMem[id]) || null;
      return idbRun(db, 'readonly', function (st) { return st.get(id); });
    }).then(function (v) { return v ? clone(v) : null; }, function () { return null; });
  };
  LocalStore.prototype.padImgDel = function (ids) {
    var self = this;
    ids = (ids || []).map(padIdOf).filter(Boolean);
    if (!ids.length) return Promise.resolve();
    return this._imgDb().then(function (db) {
      if (!db) { ids.forEach(function (id) { delete self._imgMem[id]; }); return; }
      return idbRun(db, 'readwrite', function (st) { ids.forEach(function (id) { st['delete'](id); }); return null; });
    }).then(null, function () { /* 못 지운 그림은 남아 있어도 메모에는 영향 없음 */ });
  };
  LocalStore.prototype.padImgAll = function () {
    var self = this;
    return this._imgDb().then(function (db) {
      if (!db) return Object.keys(self._imgMem || {}).map(function (id) { var o = clone(self._imgMem[id]); o.id = id; return o; });
      return new Promise(function (res, rej) {
        var out = [], tx = db.transaction('img', 'readonly'), rq = tx.objectStore('img').openCursor();
        rq.onsuccess = function () {
          var c = rq.result;
          if (!c) return;
          var o = clone(c.value || {}); o.id = String(c.key); out.push(o);
          c['continue']();
        };
        tx.oncomplete = function () { res(out); };
        tx.onerror = tx.onabort = function () { rej(tx.error || new Error('indexeddb')); };
      });
    }).then(null, function () { return []; });
  };
  LocalStore.prototype.setSpan = function (id, patch) {
    if (!id) return;
    var sp = this.data.spans || (this.data.spans = {});
    sp[id] = Object.assign({}, sp[id] || {}, clone(patch));
    this._save(); this._changed();
  };
  /* 고치기: 이미 있는 일정만 (다른 기기에서 지운 일정을 되살리지 않음) */
  LocalStore.prototype.updateSpan = function (id, patch) {
    if (!id || !this.data.spans || !this.data.spans[id]) return;
    Object.assign(this.data.spans[id], clone(patch));
    this._save(); this._changed();
  };
  LocalStore.prototype.removeSpan = function (id) {
    if (!this.data.spans || !this.data.spans[id]) return;
    delete this.data.spans[id];
    this._save(); this._changed();
  };
  LocalStore.prototype.newId = function () { return makeId(); };
  LocalStore.prototype.addTask = function (t) {
    var id = t.id || makeId();
    var copy = clone(t); copy.id = id;
    this.data.tasks[id] = copy;
    this._save(); this._changed();
    return id;
  };
  LocalStore.prototype.updateTask = function (id, patch) {
    var t = this.data.tasks[id];
    if (!t) return;
    Object.keys(patch).forEach(function (k) {
      if (patch[k] === null) delete t[k]; else t[k] = patch[k];
    });
    this._save(); this._changed();
  };
  LocalStore.prototype.removeTask = function (id) {
    delete this.data.tasks[id];
    this._save(); this._changed();
  };
  LocalStore.prototype.setDay = function (date, patch) {
    var d = this.data.days[date] || (this.data.days[date] = {});
    mergeDay(d, patch);
    d.updated = Date.now();
    this._save(); this._changed();
  };
  LocalStore.prototype.setProfile = function (patch) {
    this.data.profile = Object.assign({}, this.data.profile || {}, patch, { updated: Date.now() });
    this._save(); this._changed();
  };
  /* 여러 변경을 한 번에: [{type:'set',task}, {type:'update',id,patch}, {type:'remove',id}] */
  LocalStore.prototype.commit = function (ops) {
    var self = this;
    ops.forEach(function (op) {
      if (op.type === 'set') { var c = clone(op.task); self.data.tasks[c.id] = c; }
      else if (op.type === 'update') {
        var t = self.data.tasks[op.id];
        if (t) Object.keys(op.patch).forEach(function (k) {
          if (op.patch[k] === null) delete t[k]; else t[k] = op.patch[k];
        });
      }
      else if (op.type === 'remove') { delete self.data.tasks[op.id]; }
      else if (op.type === 'day') {
        var d = self.data.days[op.date] || (self.data.days[op.date] = {});
        mergeDay(d, op.data);
      }
      else if (op.type === 'profile') {
        self.data.profile = Object.assign({}, self.data.profile || {}, op.data);
      }
      else if (op.type === 'span') {
        var sp = self.data.spans || (self.data.spans = {});
        sp[op.id] = Object.assign({}, sp[op.id] || {}, clone(op.data));
      }
      else if (op.type === 'unspan') {
        if (self.data.spans) delete self.data.spans[op.id];
      }
    });
    this._save(); this._changed();
  };
  LocalStore.prototype.exportAll = function () {
    var self = this, pad = this._padLists();
    return this.padImgAll().then(function (imgs) {
      pad.images = imgs;
      return {
        tasks: self._tasks().map(clone),
        days: clone(self.data.days),
        profile: clone(self.data.profile),
        spans: self._spans(),
        pad: pad
      };
    });
  };
  LocalStore.prototype.importAll = function (data) {
    var self = this;
    this.commit(buildImportOps(data));
    var po = buildPadImportOps(data);
    if (po.length) this.padCommit(po);
    var imgs = buildPadImgImport(data);
    return imgs.reduce(function (p, x) {
      return p.then(function () { return self.padImgPut(x.id, x.rec).then(null, function () { /* 다음 그림으로 */ }); });
    }, Promise.resolve());
  };
  LocalStore.prototype.destroy = function () {
    this.subs = [];
    window.removeEventListener('storage', this._onStorage);
  };

  function buildImportOps(data) {
    var ops = [];
    (data.tasks || []).forEach(function (t) {
      var c = cleanTask(t);
      if (c) ops.push({ type: 'set', task: c });
    });
    var days = data.days || {};
    Object.keys(days).forEach(function (date) {
      if (DATE_RE.test(date)) {
        var d = cleanDay(days[date]);
        if (Object.keys(d).length) ops.push({ type: 'day', date: date, data: d });
      }
    });
    var p = cleanProfile(data.profile);
    if (Object.keys(p).length) ops.push({ type: 'profile', data: p });
    (Array.isArray(data.spans) ? data.spans : []).forEach(function (v) {
      var c = cleanSpan(v), id = spanId(v);
      if (c && id) ops.push({ type: 'span', id: id, data: c });
    });
    return ops;
  }

  /* ───────────────────── FirebaseStore ───────────────────── */
  function FirebaseStore(FB, db, uid) {
    var self = this;
    this.kind = 'firebase';
    this.FB = FB; this.db = db; this.uid = uid;
    this.tasksCol = FB.collection(db, 'users', uid, 'tasks');
    this.daysCol = FB.collection(db, 'users', uid, 'days');
    this.spansCol = FB.collection(db, 'users', uid, 'spans');   // 여러 날 종일 일정 (v1.6부터)
    this.padFoldersCol = FB.collection(db, 'users', uid, 'padFolders');   // 메모장 폴더 (v1.11부터)
    this.padNotesCol = FB.collection(db, 'users', uid, 'padNotes');       // 메모장 메모 (v1.11부터)
    this.padImgCol = FB.collection(db, 'users', uid, 'padImages');        // 메모 속 그림 (v1.12부터)
    this.profileRef = FB.doc(db, 'users', uid, 'meta', 'profile');
    this.meta = {};        // 리스너별 { pending, cache }
    this.unsubs = [];
    this.inflight = 0;     // 서버 확인을 기다리는 저장 수
    this.onStatus = null;
    this.onError = null;
    this._seq = 0;
    this._lastStatus = '';
    this._onNet = function () { self._status(); };
    window.addEventListener('online', this._onNet);
    window.addEventListener('offline', this._onNet);
  }
  FirebaseStore.prototype._status = function () {
    var keys = Object.keys(this.meta), pending = this.inflight > 0, cache = false, i, m;
    for (i = 0; i < keys.length; i++) {
      m = this.meta[keys[i]];
      if (m.pending) pending = true;
      if (m.cache) cache = true;
    }
    var s;
    if (!navigator.onLine) s = 'offline';
    else if (pending) s = 'saving';
    else if (cache) s = 'connecting';
    else s = 'synced';
    if (s !== this._lastStatus) {
      this._lastStatus = s;
      if (this.onStatus) this.onStatus(s);
    }
  };
  FirebaseStore.prototype._err = function (e, ctx) {
    if (this.onError) this.onError(e, ctx);
  };
  FirebaseStore.prototype._track = function (p, ignoreCodes) {
    var self = this;
    this.inflight++;
    this._status();
    p.then(function () {
      self.inflight--; self._status();
    }, function (e) {
      self.inflight--; self._status();
      if (!(ignoreCodes && e && ignoreCodes.indexOf(e.code) >= 0)) self._err(e, 'write');
    });
  };
  FirebaseStore.prototype._listen = function (target, handler) {
    var self = this, FB = this.FB, key = 'l' + (++this._seq);
    this.meta[key] = { pending: false, cache: true };
    var off = FB.onSnapshot(target, { includeMetadataChanges: true }, function (snap) {
      self.meta[key] = { pending: snap.metadata.hasPendingWrites, cache: snap.metadata.fromCache };
      self._status();
      handler(snap);
    }, function (err) {
      delete self.meta[key];
      self._status();
      self._err(err, 'listen');
    });
    var done = false;
    var stop = function () {
      if (done) return; done = true;
      try { off(); } catch (e) { /* 이미 끝난 리스너 */ }
      delete self.meta[key];
      var i = self.unsubs.indexOf(stop);
      if (i >= 0) self.unsubs.splice(i, 1);
      self._status();
    };
    this.unsubs.push(stop);
    return stop;
  };
  function docsOf(snap) {
    return snap.docs.map(function (d) {
      var o = d.data(); o.id = d.id; return o;
    });
  }
  FirebaseStore.prototype.watchDay = function (date, cb) {
    var FB = this.FB, tasks = null, day = {};
    var emit = function () { if (tasks) cb({ tasks: tasks, day: day }); };
    var a = this._listen(FB.query(this.tasksCol, FB.where('date', '==', date)), function (snap) {
      tasks = docsOf(snap); emit();
    });
    var b = this._listen(FB.doc(this.daysCol, date), function (snap) {
      day = snap.exists() ? snap.data() : {}; emit();
    });
    return function () { a(); b(); };
  };
  FirebaseStore.prototype.watchPending = function (cb) {
    var FB = this.FB;
    return this._listen(FB.query(this.tasksCol, FB.where('status', 'in', ACTIVE)), function (snap) {
      cb(docsOf(snap));
    });
  };
  /* (예전 버전 호환용) 기간 안의 할 일 */
  FirebaseStore.prototype.watchRange = function (from, to, cb) {
    var FB = this.FB;
    return this._listen(FB.query(this.tasksCol, FB.where('date', '>=', from), FB.where('date', '<=', to)), function (snap) {
      cb(docsOf(snap));
    });
  };
  /* 한 달 치 일정: days 문서의 이름(날짜)으로 범위를 정해 읽음 */
  FirebaseStore.prototype.watchSchedRange = function (from, to, cb) {
    var FB = this.FB;
    if (typeof FB.documentId !== 'function') {   // firebase.js가 예전 파일일 때: 멈추지 않고 안내만
      this._err({ code: 'old-firebase-js' }, 'listen');
      Promise.resolve().then(function () { cb({}); });
      return function () {};
    }
    var q = FB.query(this.daysCol, FB.where(FB.documentId(), '>=', from), FB.where(FB.documentId(), '<=', to));
    return this._listen(q, function (snap) {
      var out = {}, style = {}, bg = {}, info = {};
      snap.docs.forEach(function (d) {
        var v = d.data();
        if (v && v.sched) out[d.id] = v.sched;
        if (v && v.schedStyle) style[d.id] = v.schedStyle;
        if (v && cleanBg(v.bg)) bg[d.id] = v.bg;
        if (v && v.schedInfo) info[d.id] = v.schedInfo;
      });
      cb(out, style, bg, info);
    });
  };
  /* 메모 모아보기: 메모 칸이 비어 있지 않은 날만 읽음 */
  FirebaseStore.prototype.watchNotes = function (cb) {
    var FB = this.FB;
    return this._listen(FB.query(this.daysCol, FB.where('notes', '>', '')), function (snap) {
      cb(memoList(snap.docs.map(function (d) {
        var v = d.data() || {};
        return { date: d.id, notes: v.notes, notesHtml: v.notesHtml };
      })));
    });
  };
  FirebaseStore.prototype.watchProfile = function (cb) {
    return this._listen(this.profileRef, function (snap) {
      cb(snap.exists() ? snap.data() : {});
    });
  };
  /* 여러 날 종일 일정: 끝 날짜(e)가 from 이후인 것만 서버에서 읽고(필드 하나 범위 → 따로 색인을 만들 필요 없음),
     시작 날짜(s)가 to 이전인 것만 골라 냄 */
  FirebaseStore.prototype.watchSpans = function (from, to, cb) {
    var FB = this.FB;
    return this._listen(FB.query(this.spansCol, FB.where('e', '>=', from)), function (snap) {
      cb(docsOf(snap).filter(function (v) { return typeof v.s === 'string' && v.s <= to; }));
    });
  };
  FirebaseStore.prototype.newSpanId = function () { return this.FB.doc(this.spansCol).id; };
  /* 메모장: 폴더·메모 모음을 통째로 지켜봄 (둘 다 처음 읽은 뒤부터 알려 줌) */
  FirebaseStore.prototype.watchPad = function (cb) {
    var folders = null, notes = null;
    var emit = function () { if (folders && notes) cb({ folders: folders, notes: notes }); };
    var a = this._listen(this.padFoldersCol, function (snap) { folders = docsOf(snap); emit(); });
    var b = this._listen(this.padNotesCol, function (snap) { notes = docsOf(snap); emit(); });
    return function () { a(); b(); };
  };
  FirebaseStore.prototype.newPadId = function () { return this.FB.doc(this.padNotesCol).id; };
  /* 하나씩 저장: 'update'는 다른 기기에서 그사이 지운 것이면 조용히 넘어감 (지운 메모가 빈 채로 되살아나지 않게) */
  FirebaseStore.prototype.padCommit = function (ops) {
    var FB = this.FB, self = this;
    (ops || []).forEach(function (o) {
      var col = o.kind === 'folder' ? self.padFoldersCol : o.kind === 'note' ? self.padNotesCol : null, id = padIdOf(o.id);
      if (!col || !id) return;
      var ref = FB.doc(col, id);
      if (o.op === 'set') self._track(FB.setDoc(ref, strip(o.data)));
      else if (o.op === 'update') self._track(FB.updateDoc(ref, strip(o.data)), ['not-found']);
      else if (o.op === 'remove') self._track(FB.deleteDoc(ref));
    });
  };
  /* 메모 속 그림 (v1.12부터): 그림 하나가 문서 하나. 한 번 저장한 그림은 바뀌지 않으므로 이 기기에 받아 둔 것을 먼저 씀 */
  FirebaseStore.prototype.padImgPut = function (id, rec) {
    var c = cleanPadImage(rec);
    id = padIdOf(id);
    if (!id || !c) return Promise.reject(new Error('bad-image'));
    var p = this.FB.setDoc(this.FB.doc(this.padImgCol, id), c);
    this._track(p);
    return p;
  };
  FirebaseStore.prototype.padImgGet = function (id) {
    var FB = this.FB, ref;
    id = padIdOf(id);
    if (!id) return Promise.resolve(null);
    ref = FB.doc(this.padImgCol, id);
    function val(s) { return s && s.exists() ? s.data() : null; }
    var cached = typeof FB.getDocFromCache === 'function' ? FB.getDocFromCache(ref).then(val, function () { return null; }) : Promise.resolve(null);
    return cached.then(function (v) {
      return v || FB.getDoc(ref).then(val, function () { return null; });
    });
  };
  FirebaseStore.prototype.padImgDel = function (ids) {
    var FB = this.FB, self = this;
    (ids || []).map(padIdOf).filter(Boolean).forEach(function (id) { self._track(FB.deleteDoc(FB.doc(self.padImgCol, id))); });
    return Promise.resolve();
  };
  FirebaseStore.prototype.setSpan = function (id, patch) {
    if (!id) return;
    this._track(this.FB.setDoc(this.FB.doc(this.spansCol, id), strip(patch), { merge: true }));
  };
  /* 고치기: 이미 있는 일정만 (다른 기기에서 그사이 지웠으면 조용히 넘어감 — 빈 일정이 새로 생기지 않게) */
  FirebaseStore.prototype.updateSpan = function (id, patch) {
    if (!id) return;
    this._track(this.FB.updateDoc(this.FB.doc(this.spansCol, id), strip(patch)), ['not-found']);
  };
  FirebaseStore.prototype.removeSpan = function (id) {
    if (!id) return;
    this._track(this.FB.deleteDoc(this.FB.doc(this.spansCol, id)));
  };
  FirebaseStore.prototype.newId = function () { return this.FB.doc(this.tasksCol).id; };
  function strip(t) {
    var o = {};
    Object.keys(t).forEach(function (k) { if (k !== 'id' && t[k] !== undefined && t[k] !== null) o[k] = t[k]; });
    return o;
  }
  FirebaseStore.prototype.addTask = function (t) {
    var id = t.id || this.newId();
    this._track(this.FB.setDoc(this.FB.doc(this.tasksCol, id), strip(t)));
    return id;
  };
  FirebaseStore.prototype.updateTask = function (id, patch) {
    this._track(this.FB.updateDoc(this.FB.doc(this.tasksCol, id), patch), ['not-found']);
  };
  FirebaseStore.prototype.removeTask = function (id) {
    this._track(this.FB.deleteDoc(this.FB.doc(this.tasksCol, id)));
  };
  FirebaseStore.prototype.setDay = function (date, patch) {
    var data = Object.assign({}, patch, { updated: Date.now() });
    this._track(this.FB.setDoc(this.FB.doc(this.daysCol, date), data, { merge: true }));
  };
  FirebaseStore.prototype.setProfile = function (patch) {
    var data = Object.assign({}, patch, { updated: Date.now() });
    this._track(this.FB.setDoc(this.profileRef, data, { merge: true }));
  };
  FirebaseStore.prototype.commit = function (ops) {
    var FB = this.FB, self = this, i, batch, n;
    for (i = 0; i < ops.length; i += 400) {
      batch = FB.writeBatch(this.db);
      n = 0;
      ops.slice(i, i + 400).forEach(function (op) {
        if (op.type === 'set') { batch.set(FB.doc(self.tasksCol, op.task.id), strip(op.task)); n++; }
        else if (op.type === 'update') { batch.update(FB.doc(self.tasksCol, op.id), op.patch); n++; }
        else if (op.type === 'remove') { batch.delete(FB.doc(self.tasksCol, op.id)); n++; }
        else if (op.type === 'day') { batch.set(FB.doc(self.daysCol, op.date), op.data, { merge: true }); n++; }
        else if (op.type === 'profile') { batch.set(self.profileRef, op.data, { merge: true }); n++; }
        else if (op.type === 'span') { batch.set(FB.doc(self.spansCol, op.id), strip(op.data), { merge: true }); n++; }
        else if (op.type === 'unspan') { batch.delete(FB.doc(self.spansCol, op.id)); n++; }
      });
      if (n) this._track(batch.commit());
    }
  };
  /* 백업: 서버에서 전부 받아 옴. 8초 안에 안 되면(오프라인) 이 기기에 있는 내용만 */
  FirebaseStore.prototype.exportAll = function () {
    var FB = this.FB, self = this, timer = null;
    function build(r, partial) {
      var days = {};
      r[1].docs.forEach(function (d) { days[d.id] = d.data(); });
      var prof = r[2] && r[2].exists() ? r[2].data() : {};
      return { tasks: docsOf(r[0]), days: days, profile: prof, spans: r[3] ? docsOf(r[3]) : [],
        pad: { folders: r[4] ? docsOf(r[4]) : [], notes: r[5] ? docsOf(r[5]) : [], images: r[6] ? docsOf(r[6]) : [] }, partial: partial };
    }
    function fromCache() {
      return Promise.all([
        FB.getDocsFromCache(self.tasksCol),
        FB.getDocsFromCache(self.daysCol),
        FB.getDocFromCache(self.profileRef).catch(function () { return null; }),
        FB.getDocsFromCache(self.spansCol).catch(function () { return null; }),
        FB.getDocsFromCache(self.padFoldersCol).catch(function () { return null; }),
        FB.getDocsFromCache(self.padNotesCol).catch(function () { return null; }),
        FB.getDocsFromCache(self.padImgCol).catch(function () { return null; })
      ]).then(function (r) { return build(r, true); });
    }
    var server = Promise.all([FB.getDocs(this.tasksCol), FB.getDocs(this.daysCol), FB.getDoc(this.profileRef), FB.getDocs(this.spansCol),
      FB.getDocs(this.padFoldersCol), FB.getDocs(this.padNotesCol), FB.getDocs(this.padImgCol)]);
    var timeout = new Promise(function (res) { timer = setTimeout(function () { res(null); }, 12000); });
    return Promise.race([server, timeout]).then(function (r) {
      clearTimeout(timer);
      return r ? build(r, false) : fromCache();
    }, function () {
      clearTimeout(timer);
      return fromCache();
    });
  };
  FirebaseStore.prototype.importAll = function (data) {
    var self = this;
    this.commit(buildImportOps(data));
    var po = buildPadImportOps(data);
    if (po.length) this.padCommit(po);
    buildPadImgImport(data).forEach(function (x) { self.padImgPut(x.id, x.rec).then(null, function () { /* 오류는 _track이 알림 */ }); });
    return Promise.resolve();
  };
  FirebaseStore.prototype.destroy = function () {
    this.unsubs.slice().forEach(function (u) { u(); });
    window.removeEventListener('online', this._onNet);
    window.removeEventListener('offline', this._onNet);
  };

  /* v: 이 파일의 버전 (app.js가 store.js만 예전 파일로 남았는지 확인할 때 씀. 19 = v1.9, 20 = v1.11, 21 = v1.12) */
  window.PlannerStores = { LocalStore: LocalStore, FirebaseStore: FirebaseStore, cleanTask: cleanTask, cleanSpan: cleanSpan,
    cleanPadFolder: cleanPadFolder, cleanPadNote: cleanPadNote, cleanPadImage: cleanPadImage, v: 21 };
})();
