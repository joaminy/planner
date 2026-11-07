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
      ord: Number(t.ord) || Date.now(),
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
    return out;
  }
  /* 일정 칸 이름: '06'~'22' = 시간, 'a1'~'a3' = 종일 일정 (v1.5부터) */
  var SCHED_KEY_RE = /^(\d{2}|a[1-3])$/;
  /* 일정 글자 꾸미기: { c: 색 이름(빈칸 = 기본), b: 진하게 } */
  var SCHED_COLORS = ['', 'red', 'orange', 'green', 'blue', 'purple', 'pink'];
  function cleanStyle(v) {
    if (!v || typeof v !== 'object') return null;
    return { c: SCHED_COLORS.indexOf(v.c) >= 0 ? v.c : '', b: v.b === true };
  }
  /* 월간 달력의 날짜 바탕색 (빈칸 = 색 없음) */
  var DAY_BGS = ['red', 'orange', 'yellow', 'green', 'sky', 'blue', 'purple', 'pink', 'gray'];
  function cleanBg(v) { return DAY_BGS.indexOf(v) >= 0 ? v : ''; }
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
    if (typeof d.bg === 'string') out.bg = cleanBg(d.bg);
    return out;
  }
  /* 하루 문서에 변경 내용 합치기 (일정·글자 꾸미기는 시간별로 합치고, 메모·바탕색은 통째로 바꿈) */
  function mergeDay(d, patch) {
    ['sched', 'schedStyle'].forEach(function (k) {
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
    return out;
  }

  /* ───────────────────── LocalStore ───────────────────── */
  function LocalStore(key) {
    var self = this;
    this.kind = 'local';
    this.key = key || 'my-planner:local:v1';
    this.subs = [];
    this.onStatus = null;
    this.onError = null;
    this.data = this._load();
    this._queued = false;
    this._onStorage = function (e) {
      if (e.key === self.key) { self.data = self._load(); self._changed(); }
    };
    window.addEventListener('storage', this._onStorage);
  }
  LocalStore.prototype._load = function () {
    try {
      var raw = localStorage.getItem(this.key);
      if (raw) {
        var d = JSON.parse(raw);
        return { tasks: d.tasks || {}, days: d.days || {}, profile: d.profile || {} };
      }
    } catch (e) { /* 저장소를 읽을 수 없으면 빈 상태로 시작 */ }
    return { tasks: {}, days: {}, profile: {} };
  };
  LocalStore.prototype._save = function () {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); }
    catch (e) { if (this.onError) this.onError({ code: 'local-save-failed', message: String(e) }); }
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
     세 번째 값은 날짜 바탕색: { '2026-11-05': 'yellow' } */
  LocalStore.prototype.watchSchedRange = function (from, to, cb) {
    var self = this;
    return this._sub(function () {
      var days = self.data.days || {}, out = {}, style = {}, bg = {};
      Object.keys(days).forEach(function (date) {
        if (date < from || date > to || !days[date]) return;
        if (days[date].sched) out[date] = clone(days[date].sched);
        if (days[date].schedStyle) style[date] = clone(days[date].schedStyle);
        if (cleanBg(days[date].bg)) bg[date] = days[date].bg;
      });
      cb(out, style, bg);
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
    });
    this._save(); this._changed();
  };
  LocalStore.prototype.exportAll = function () {
    return Promise.resolve({
      tasks: this._tasks().map(clone),
      days: clone(this.data.days),
      profile: clone(this.data.profile)
    });
  };
  LocalStore.prototype.importAll = function (data) {
    this.commit(buildImportOps(data));
    return Promise.resolve();
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
    return ops;
  }

  /* ───────────────────── FirebaseStore ───────────────────── */
  function FirebaseStore(FB, db, uid) {
    var self = this;
    this.kind = 'firebase';
    this.FB = FB; this.db = db; this.uid = uid;
    this.tasksCol = FB.collection(db, 'users', uid, 'tasks');
    this.daysCol = FB.collection(db, 'users', uid, 'days');
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
      var out = {}, style = {}, bg = {};
      snap.docs.forEach(function (d) {
        var v = d.data();
        if (v && v.sched) out[d.id] = v.sched;
        if (v && v.schedStyle) style[d.id] = v.schedStyle;
        if (v && cleanBg(v.bg)) bg[d.id] = v.bg;
      });
      cb(out, style, bg);
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
      return { tasks: docsOf(r[0]), days: days, profile: prof, partial: partial };
    }
    function fromCache() {
      return Promise.all([
        FB.getDocsFromCache(self.tasksCol),
        FB.getDocsFromCache(self.daysCol),
        FB.getDocFromCache(self.profileRef).catch(function () { return null; })
      ]).then(function (r) { return build(r, true); });
    }
    var server = Promise.all([FB.getDocs(this.tasksCol), FB.getDocs(this.daysCol), FB.getDoc(this.profileRef)]);
    var timeout = new Promise(function (res) { timer = setTimeout(function () { res(null); }, 8000); });
    return Promise.race([server, timeout]).then(function (r) {
      clearTimeout(timer);
      return r ? build(r, false) : fromCache();
    }, function () {
      clearTimeout(timer);
      return fromCache();
    });
  };
  FirebaseStore.prototype.importAll = function (data) {
    this.commit(buildImportOps(data));
    return Promise.resolve();
  };
  FirebaseStore.prototype.destroy = function () {
    this.unsubs.slice().forEach(function (u) { u(); });
    window.removeEventListener('online', this._onNet);
    window.removeEventListener('offline', this._onNet);
  };

  /* v: 이 파일의 버전 (app.js가 store.js만 예전 파일로 남았는지 확인할 때 씀. 15 = v1.5) */
  window.PlannerStores = { LocalStore: LocalStore, FirebaseStore: FirebaseStore, cleanTask: cleanTask, v: 15 };
})();
