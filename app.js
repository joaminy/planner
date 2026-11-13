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
  /* 일정 글자 색 — 흰 바탕·종이 바탕 모두에서 글씨가 또렷하게 보이는 색(대비 4.5:1 이상)만 */
  var SCHED_COLORS = [
    { id: '', name: '기본', hex: '' },
    { id: 'red', name: '빨강', hex: '#C62828' },
    { id: 'orange', name: '주황', hex: '#C2410C' },
    { id: 'green', name: '초록', hex: '#2E7D32' },
    { id: 'blue', name: '파랑', hex: '#1565C0' },
    { id: 'purple', name: '보라', hex: '#6A1B9A' },
    { id: 'pink', name: '분홍', hex: '#AD1457' }
  ];
  function colorHex(id) {
    for (var i = 0; i < SCHED_COLORS.length; i++) if (id && SCHED_COLORS[i].id === id) return SCHED_COLORS[i].hex;
    return '';
  }
  /* 종일 일정 테두리 색 (월간 달력의 테두리 띠). 기본 = 글자 색을 골랐으면 그 색, 아니면 플래너 색 */
  var BORDER_COLORS = [
    { id: '', name: '기본', hex: '' },
    { id: 'red', name: '빨강', hex: '#C62828' },
    { id: 'orange', name: '주황', hex: '#E65100' },
    { id: 'yellow', name: '노랑', hex: '#C99400' },
    { id: 'green', name: '초록', hex: '#2E7D32' },
    { id: 'teal', name: '청록', hex: '#00897B' },
    { id: 'sky', name: '하늘', hex: '#0288D1' },
    { id: 'blue', name: '파랑', hex: '#1565C0' },
    { id: 'navy', name: '남색', hex: '#283593' },
    { id: 'purple', name: '보라', hex: '#6A1B9A' },
    { id: 'pink', name: '분홍', hex: '#D81B60' },
    { id: 'brown', name: '갈색', hex: '#795548' },
    { id: 'gray', name: '회색', hex: '#757575' },
    { id: 'black', name: '검정', hex: '#26241F' }
  ];
  function borderHex(id) {
    for (var i = 0; i < BORDER_COLORS.length; i++) if (id && BORDER_COLORS[i].id === id) return BORDER_COLORS[i].hex;
    return '';
  }
  /* 종일 일정 테두리 모양 (v1.7부터): 선 모양 bs — '' 실선 · 'dotted' 점선 · 'dashed' 긴 점선 / 굵기 bw — '' 보통 · 'thin' 얇게 */
  var BORDER_STYLES = [{ id: '', name: '실선', css: 'solid' }, { id: 'dotted', name: '점선', css: 'dotted' }, { id: 'dashed', name: '긴 점선', css: 'dashed' }];
  var BORDER_WIDTHS = [{ id: '', name: '보통' }, { id: 'thin', name: '얇게' }];
  function okBs(v) { return v === 'dotted' || v === 'dashed' ? v : ''; }
  function okBw(v) { return v === 'thin' ? v : ''; }
  /* 일정 글자 꾸미기 { c: 글자 색(빈칸 = 기본), b: 진하게, bc: 테두리 색, bs: 선 모양, bw: 굵기 (bc·bs·bw는 종일 일정만) } */
  function styleOf(map, h) {
    var s = map && map[h];
    return { c: s && colorHex(s.c) ? s.c : '', b: !!(s && s.b === true), bc: s && borderHex(s.bc) ? s.bc : '', bs: okBs(s && s.bs), bw: okBw(s && s.bw) };
  }
  function blankStyle(h) { return isAllDay(h) ? { c: '', b: false, bc: '', bs: '', bw: '' } : { c: '', b: false }; }
  function styleSet(st) { return !!(st && (st.c || st.b || st.bc || st.bs || st.bw)); }
  /* 일정 정보 (v1.8부터): 시작·끝 시각 ts·te('14:30'), 장소 loc, 메모 memo.
     하루 일정은 그날 문서의 schedInfo[칸], 여러 날 종일 일정은 그 일정 문서에 함께 저장 */
  var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  function okTime(v) { return typeof v === 'string' && TIME_RE.test(v) ? v : ''; }
  function infoClean(v) {
    return {
      ts: okTime(v && v.ts), te: okTime(v && v.te),
      loc: v && typeof v.loc === 'string' ? v.loc.slice(0, 100) : '',
      memo: v && typeof v.memo === 'string' ? v.memo.slice(0, 2000) : ''
    };
  }
  function blankInfo() { return { ts: '', te: '', loc: '', memo: '' }; }
  function infoOf(map, h) { return infoClean(map && map[h]); }
  function infoHas(i) { return !!(i && (i.ts || i.te || i.loc.trim() || i.memo.trim())); }
  /* 시각 표시: '10:30~11:30' · 시작만 '10:30' · 끝만 '~11:30' */
  function timeText(i) { return i.ts && i.te ? i.ts + '~' + i.te : i.ts || (i.te ? '~' + i.te : ''); }
  /* 월간 달력 칸 크기 (PC와 휴대폰은 화면이 달라 기기마다 따로 기억) */
  var CELL_SIZES = ['작게', '보통', '크게', '더 크게', '아주 크게'];
  /* 월간 달력 날짜 바탕색 (조르테처럼 날짜 칸을 색칠). 12가지 색 × 연하게·보통·진하게 = 36가지.
     '보통'은 v1.4~v1.5의 9가지 색과 같은 값(예전에 칠한 날짜는 그대로). 진하게도 글씨가 잘 읽히는 밝기까지만 */
  var BG_HUES = [
    { id: 'red', name: '빨강', l: '#FFE5E1', m: '#FFCBC3', d: '#F4A497' },
    { id: 'orange', name: '주황', l: '#FFEBD8', m: '#FFD7B0', d: '#F7BC86' },
    { id: 'yellow', name: '노랑', l: '#FDF6CE', m: '#FBEC9E', d: '#F3D96E' },
    { id: 'lime', name: '연두', l: '#EEF6D9', m: '#DCEDB4', d: '#C4DE8C' },
    { id: 'green', name: '초록', l: '#E4F3E1', m: '#C8E8C3', d: '#A3D49B' },
    { id: 'teal', name: '청록', l: '#DEF3EE', m: '#BCE7DD', d: '#8FD2C2' },
    { id: 'sky', name: '하늘', l: '#DBF4FA', m: '#B7E8F4', d: '#8ED3E8' },
    { id: 'blue', name: '파랑', l: '#E2EEFF', m: '#C6DDFF', d: '#A6C6F6' },
    { id: 'purple', name: '보라', l: '#EEE8FC', m: '#DED1FA', d: '#C6B3F1' },
    { id: 'pink', name: '분홍', l: '#FFE4EE', m: '#FFCADE', d: '#F5A9C7' },
    { id: 'brown', name: '갈색', l: '#F2E7DC', m: '#E8D5C0', d: '#D9BB99' },
    { id: 'gray', name: '회색', l: '#EAE9E6', m: '#D9D7D3', d: '#BFBBB4' }
  ];
  var BG_TONES = [{ k: 'l', suffix: '-l', name: '연한 ', label: '연하게' }, { k: 'm', suffix: '', name: '', label: '보통' }, { k: 'd', suffix: '-d', name: '진한 ', label: '진하게' }];
  var DAY_BGS = [];
  BG_TONES.forEach(function (t, ti) {
    BG_HUES.forEach(function (h) { DAY_BGS.push({ id: h.id + t.suffix, name: t.name + h.name, hex: h[t.k], tone: ti, deep: ti === 2 }); });
  });
  function dayBg(id) {
    for (var i = 0; i < DAY_BGS.length; i++) if (id && DAY_BGS[i].id === id) return DAY_BGS[i];
    return null;
  }
  /* 월간 달력 요일 칸 색: 기본 · 플래너 색 · 진한 색 12가지(흰 글씨) · 연한 색 12가지 · 직접 고르기 */
  var DOW_COLORS = [
    { id: 'dk-red', name: '진한 빨강', hex: '#B3261E' },
    { id: 'dk-orange', name: '진한 주황', hex: '#B45309' },
    { id: 'dk-mustard', name: '겨자색', hex: '#8A6A00' },
    { id: 'dk-green', name: '진한 초록', hex: '#2E7D32' },
    { id: 'dk-teal', name: '진한 청록', hex: '#00695C' },
    { id: 'dk-sky', name: '진한 하늘', hex: '#0277BD' },
    { id: 'dk-blue', name: '진한 파랑', hex: '#2952A3' },
    { id: 'dk-navy', name: '남색', hex: '#26386E' },
    { id: 'dk-purple', name: '진한 보라', hex: '#6A3FA0' },
    { id: 'dk-pink', name: '진한 분홍', hex: '#AD1457' },
    { id: 'dk-brown', name: '진한 갈색', hex: '#6D4C41' },
    { id: 'dk-gray', name: '진한 회색', hex: '#5F5B54' }
  ];
  BG_HUES.forEach(function (h) { DOW_COLORS.push({ id: 'lt-' + h.id, name: '연한 ' + h.name, hex: h.m }); });
  function dowById(id) {
    for (var i = 0; i < DOW_COLORS.length; i++) if (id && DOW_COLORS[i].id === id) return DOW_COLORS[i];
    return null;
  }
  /* 여러 날 이어지는 종일 일정의 기간은 최대 366일 */
  var SPAN_MAX = 366;
  function spanDays(s, e) {
    var a = s.split('-'), b = e.split('-');
    return Math.round((Date.UTC(+b[0], +b[1] - 1, +b[2]) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 86400000) + 1;
  }
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  var PRI_ORDER = { A: 0, B: 1, C: 2 };
  var ACTIVE = ['open', 'prog'];
  var HOURS = []; for (var hh = 6; hh <= 22; hh++) HOURS.push(pad(hh));
  /* 종일 일정 칸 (하루에 3개까지). 일정 저장 이름은 'a1'~'a3' — 예전 버전 앱은 이 칸을 그냥 건너뜀 */
  var ALLDAY = ['a1', 'a2', 'a3'];
  function isAllDay(h) { return ALLDAY.indexOf(h) >= 0; }
  function schedLabel(h) { return isAllDay(h) ? '종일' : (+h) + '시'; }
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
    { id: 'jua', name: '주아', en: 'Jua', group: 'hand', q: 'Jua', scale: 1.08 },
    /* 새로 더한 5종 (v1.4~) */
    { id: 'gothic-a1', name: '고딕 A1', en: 'Gothic A1', group: 'sans', q: 'Gothic+A1:wght@400;700', scale: 1, isNew: true },
    { id: 'hahmlet', name: '함렛', en: 'Hahmlet', group: 'serif', q: 'Hahmlet:wght@400;700', scale: 1, isNew: true },
    { id: 'diphylleia', name: '산하엽', en: 'Diphylleia', group: 'serif', q: 'Diphylleia', scale: 1, isNew: true },
    { id: 'poor-story', name: '푸어 스토리', en: 'Poor Story', group: 'hand', q: 'Poor+Story', scale: 1.1, isNew: true },
    { id: 'gamja-flower', name: '감자꽃', en: 'Gamja Flower', group: 'hand', q: 'Gamja+Flower', scale: 1.2, isNew: true }
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
    { id: 'rose', name: '로즈', accent: '#9C3D5D', cover: '#4A2232' },
    /* 새로 더한 5가지 (v1.4~) */
    { id: 'crimson', name: '크림슨', accent: '#A51C30', cover: '#5E1221', isNew: true },
    { id: 'mustard', name: '머스터드', accent: '#7D5E14', cover: '#42330F', isNew: true },
    { id: 'olive', name: '올리브', accent: '#4D5B2C', cover: '#2C331C', isNew: true },
    { id: 'royal', name: '로열 블루', accent: '#2B4C9E', cover: '#18295A', isNew: true },
    { id: 'lavender', name: '라벤더', accent: '#615296', cover: '#2F2949', isNew: true }
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
  /* 색칠한 칸 위에서도 또렷하도록, 바탕과의 대비가 min 이상이 될 때까지 조금씩 어둡게 */
  function readableOn(hex, bg, min) {
    var c = hex.toUpperCase(), i = 0;
    while (contrastOf(c, bg) < (min || 4.5) && i++ < 40) c = mixHex(c, '#000000', 0.06);
    return c;
  }
  /* 지금 플래너 색(강조색) — 직접 고른 색이나 테마 색이 적용된 값 */
  function accentHex() {
    var v = '';
    try { v = getComputedStyle(document.documentElement).getPropertyValue('--green').trim(); } catch (e) { v = ''; }
    return isHex(v) ? v.toUpperCase() : '#1F4D3C';
  }
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

  /* ───────── 메모 글자 꾸미기 (진하게) ─────────
     메모는 줄마다 글 조각 [{ t: 글자, b: 진하게 }]의 목록으로 다룹니다.
     저장할 때는 notes(그냥 글자 — 예전 버전·검색용)와 notesHtml(<b>·<br>만 쓴 HTML)을 함께 저장합니다. */
  var RT_BLOCK = /^(DIV|P|LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE|SECTION|ARTICLE|HEADER|FOOTER|ASIDE|NAV|MAIN|ADDRESS|FIGURE|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|DL|DT|DD|HR)$/;
  var RT_SKIP = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|IFRAME|OBJECT|EMBED|SVG|MATH|HEAD|TITLE|META|LINK|IMG|VIDEO|AUDIO|CANVAS|INPUT|TEXTAREA|SELECT|BUTTON)$/;
  function rtBold(el, bold) {
    if (el.nodeName === 'B' || el.nodeName === 'STRONG') bold = true;
    var fw = el.style && el.style.fontWeight;
    if (fw) {
      if (fw === 'bold' || fw === 'bolder' || +fw >= 600) bold = true;
      else if (fw === 'normal' || fw === 'lighter' || (+fw > 0 && +fw < 600)) bold = false;
    }
    return bold;
  }
  /* 화면(DOM)의 글 → 줄 목록. 브라우저가 줄바꿈을 <br>로 넣든 <div>로 넣든 보이는 줄 그대로 읽음 */
  function rtFromDom(root) {
    var lines = [], cur = null;
    function push(t, b) {
      if (!cur) cur = [];
      var last = cur[cur.length - 1];
      if (last && last.b === b) last.t += t; else cur.push({ t: t, b: b });
    }
    function brk() { lines.push(cur || []); cur = []; }                 // 줄바꿈: 지금 줄을 닫고 새 줄을 엶
    function boundary() { if (cur && cur.length) lines.push(cur); cur = null; }  // 문단 경계: 비어 있는 새 줄은 버림
    (function walk(node, bold) {
      for (var n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) {
          var parts = n.nodeValue.replace(/ /g, ' ').replace(/\r\n?/g, '\n').split('\n');
          for (var i = 0; i < parts.length; i++) {
            if (i) brk();
            if (parts[i]) push(parts[i], bold);
          }
        } else if (n.nodeType === 1 && !RT_SKIP.test(n.nodeName)) {
          if (n.nodeName === 'BR') { brk(); continue; }
          var block = RT_BLOCK.test(n.nodeName);
          if (block) boundary();
          walk(n, rtBold(n, bold));
          if (block) boundary();
        }
      }
    })(root, false);
    boundary();
    return lines;
  }
  function rtFromText(text) {
    return String(text || '').split('\n').map(function (l) { return l ? [{ t: l, b: false }] : []; });
  }
  function rtFromHtml(html) {
    var tpl = document.createElement('template');   // template 안의 내용은 실행·표시되지 않음
    tpl.innerHTML = html;
    return rtFromDom(tpl.content);
  }
  function rtText(lines) { return lines.map(function (l) { return l.map(function (r) { return r.t; }).join(''); }).join('\n'); }
  function rtHasBold(lines) { return lines.some(function (l) { return l.some(function (r) { return r.b && r.t.trim(); }); }); }
  /* 줄 목록 → 화면용 HTML (<b>와 <br>만 사용). ranges: 검색어 위치 [[시작, 끝), ...] → <mark> */
  function rtHtml(lines, ranges) {
    ranges = ranges || [];
    var out = '', pos = 0, ri = 0;
    lines.forEach(function (line, li) {
      if (li) { out += '<br>'; pos += 1; }
      line.forEach(function (run) {
        var t = run.t, start = pos, end = pos + t.length, c = start, h = '';
        while (c < end) {
          while (ri < ranges.length && ranges[ri][1] <= c) ri++;
          var r = ranges[ri];
          if (r && r[0] < end) {
            if (r[0] > c) { h += esc(t.slice(c - start, r[0] - start)); c = r[0]; }
            var e = Math.min(r[1], end);
            h += '<mark>' + esc(t.slice(c - start, e - start)) + '</mark>';
            c = e;
          } else { h += esc(t.slice(c - start)); c = end; }
        }
        out += run.b ? '<b>' + h + '</b>' : h;
        pos = end;
      });
    });
    if (lines.length > 1 && !lines[lines.length - 1].length) out += '<br>';   // 마지막 빈 줄이 보이도록
    return out;
  }
  /* 저장된 하루 메모 → 줄 목록. 예전 버전 앱이 그냥 글자(notes)만 고쳤으면 그쪽을 따름 */
  function memoLines(day) {
    var plain = day && typeof day.notes === 'string' ? day.notes : '';
    if (day && typeof day.notesHtml === 'string' && day.notesHtml) {
      var lines = rtFromHtml(day.notesHtml);
      if (rtText(lines) === plain) return lines;
    }
    return rtFromText(plain);
  }

  /* ───────── 앱 상태 ───────── */
  var S = {
    store: null, mode: null, user: null,
    date: today(), followToday: true,
    view: 'day', tab: 'tasks',
    tasks: [], day: {}, dayLoaded: false,
    pending: [], profile: {},
    sched: {}, schedStyle: {}, schedInfo: {}, dayBg: {}, spans: [], schedKey: '', monthCursor: monthKey(today()),
    info: null,   // 열려 있는 일정 정보 창 { date, key, lastText }
    cellSize: Math.min(5, Math.max(1, parseInt(readPref('cellSize', '2'), 10) || 2)),
    painting: false, paintColor: dayBg(readPref('paintColor', 'red')) ? readPref('paintColor', 'red') : 'red',
    dowOpen: false, dowColor: readPref('dowColor', ''), dowEach: null, dowTarget: 'all',
    memos: null, memoQ: '', memoLimit: 60,
    /* 메모장 (v1.11부터): sel = 보고 있는 곳 { kind: 'all' | 'fav' | 'trash' | 'folder', id }, pane = 휴대폰에서 보이는 단계, open = 열린 메모 id */
    pad: { folders: [], notes: [], loaded: false, tree: null, sel: { kind: 'all', id: '' }, pane: 'side', open: null, q: '' },
    padLayout: readPref('padLayout', 'grid') === 'list' ? 'list' : 'grid',
    padSort: ['updated', 'created', 'title'].indexOf(readPref('padSort', 'updated')) >= 0 ? readPref('padSort', 'updated') : 'updated',
    padOpen: (function () { var o = {}; try { (JSON.parse(readPref('padOpen', '[]')) || []).forEach(function (k) { if (typeof k === 'string') o[k] = 1; }); } catch (e) { /* 무시 */ } return o; })(),
    addPri: readPref('addPri', 'A'),
    font: 'noto-sans', fontAll: false,
    theme: 'green', themeColor: '',
    editId: null,
    unsub: { day: null, pending: null, sched: null, spans: null, profile: null, memos: null, pad: null }
  };
  var FBA = null; // { FB, app, auth, db }

  function readPref(k, def) { try { return localStorage.getItem('my-planner:' + k) || def; } catch (e) { return def; } }
  function writePref(k, v) { try { localStorage.setItem('my-planner:' + k, v); } catch (e) { /* 무시 */ } }

  /* ───────── 시작 ───────── */
  function boot() {
    window.__plannerBooted = true;
    window.__plannerApp = 'v1.11';   // index.html이 app.js 버전이 맞는지 확인할 때 씀
    try { S.dowEach = cleanDowEach(JSON.parse(readPref('dowEach', '') || 'null'), okDow(S.dowColor) || ''); } catch (e) { S.dowEach = null; }
    applyFont(readPref('font', 'noto-sans'), readPref('fontAll', '0') === '1');
    applyTheme(readPref('theme', 'green'), readPref('themeColor', ''));
    bindEvents();
    bindPad();
    buildSchedRows();
    buildSchedTools();
    buildRangeTools();
    buildPaintBar();
    buildDowBar();
    buildMonthTabs();
    setAddPri(S.addPri);
    applyCellSize(S.cellSize);
    try { document.execCommand('styleWithCSS', false, false); } catch (e) { /* 진하게는 <b>로 */ }
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
    if (!storeIsCurrent()) {   // store.js만 예전 파일일 때: 새 기능(바탕색·종일 일정 등)이 제대로 저장되지 않을 수 있으므로 바로 알림
      toast('store.js 파일이 예전 버전입니다. 업데이트 파일을 모두 다시 올려 주세요.', 'error', null, 10000);
    }
    S.unsub.profile = store.watchProfile(function (p) {
      S.profile = p || {};
      if (typeof S.profile.font === 'string' &&
          (fontById(S.profile.font).id !== S.font || !!S.profile.fontAll !== S.fontAll)) {
        applyFont(S.profile.font, !!S.profile.fontAll);
      }
      var pt = S.profile.theme, pc = String(S.profile.themeColor || '').toUpperCase();
      if (typeof pt === 'string' && (pt !== S.theme || (pt === 'custom' && pc !== S.themeColor))) applyTheme(pt, pc);
      if (typeof S.profile.dowColor === 'string' || S.profile.dowEach) {   // 요일 칸 색 (다른 기기에서 바꾼 것)
        var nb = typeof S.profile.dowColor === 'string' ? (okDow(S.profile.dowColor) || '') : S.dowColor, ne = cleanDowEach(S.profile.dowEach, nb);
        if (nb !== S.dowColor || JSON.stringify(ne) !== JSON.stringify(S.dowEach)) applyDow(nb, ne);
      }
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
    if (S.view === 'pad') { subscribePad(); renderPad(); }
  }

  /* store.js 버전 (v는 v1.4부터 있음, 16 = v1.6, 17 = v1.7, 18 = v1.8, 19 = v1.9, 20 = v1.11) */
  function storeV() { var P = window.PlannerStores; return (P && +P.v) || 0; }
  /* store.js가 v1.11 파일인지 (v1.11 store.js에 메모장 저장이 들어 있음) */
  function storeIsCurrent() { return storeV() >= 20; }
  /* 여러 날 종일 일정을 쓸 수 있는 저장소인지 (store.js가 예전 파일이면 안 됨) */
  function spansOk() { return !!(S.store && typeof S.store.watchSpans === 'function' && typeof S.store.setSpan === 'function'); }

  function detachStore() {
    flushInfo(); flushRange(); flushNotes(); flushSched(); flushSpans(); flushValues(); closePaint(); closeDow();
    padCloseNote(); closePadFolder(); closePadPick(); padMenu(false);
    closeInfo(true);
    Object.keys(S.unsub).forEach(function (k) { if (S.unsub[k]) S.unsub[k](); S.unsub[k] = null; });
    if (S.store && S.store.destroy) S.store.destroy();
    S.store = null;
    S.tasks = []; S.day = {}; S.pending = []; S.sched = {}; S.schedStyle = {}; S.schedInfo = {}; S.dayBg = {}; S.spans = []; S.schedKey = ''; S.profile = {};
    padReset();
    closeSheet(true);
  }

  function subscribeDay() {
    if (!S.store) return;
    if (S.unsub.day) S.unsub.day();
    var date = S.date;
    closeSchedTools(); closeRange();
    S.tasks = []; S.day = {}; S.dayLoaded = false;
    renderTasks(); renderSched(); renderNotes(true);
    S.unsub.day = S.store.watchDay(date, function (r) {
      if (date !== S.date) return;
      // 다른 날로 옮긴 할 일은 원래 날에 남기지 않음 (v1.10부터). 예전 버전에서 넘기면서 원래 날에 → 표시로 남겨 둔 일도 보이지 않게 함
      S.tasks = r.tasks.filter(function (t) { return t.status !== 'fwd'; });
      S.day = r.day || {}; S.dayLoaded = true;
      renderTasks(); renderSched(); renderNotes(false);
      if (S.editId) renderSheet();
      if (S.info) renderInfo(false);
      migrateLegacyProg();   // v1.8에서 진행 중으로 바꾼 일: 한 번만 맨 위로
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
    if (S.unsub.spans) { S.unsub.spans(); S.unsub.spans = null; }
    S.schedKey = mk; S.sched = {}; S.schedStyle = {}; S.schedInfo = {}; S.dayBg = {}; S.spans = [];
    var p = mk.split('-'), y = +p[0], m = +p[1];
    var from = mk + '-01', to = mk + '-' + pad(lastDay(y, m));
    S.unsub.sched = S.store.watchSchedRange(from, to, function (map, style, bg, info) {
      if (S.schedKey !== mk) return;
      S.sched = map || {};
      S.schedStyle = style || {};   // 예전 store.js면 비어 있음(글자 꾸미기 없이 표시)
      S.dayBg = bg || {};           // 예전 store.js면 비어 있음(바탕색 없이 표시)
      S.schedInfo = info || {};     // 일정 정보 (예전 store.js면 비어 있음)
      renderMiniCal();
      if (S.view === 'month') renderMonth();
      if (S.info) renderInfo(false);
    });
    // 여러 날 이어지는 종일 일정: 이 달과 겹치는 것 (하루 페이지·월간 달력·작은 달력에 함께 씀)
    if (spansOk()) {
      S.unsub.spans = S.store.watchSpans(from, to, function (list) {
        if (S.schedKey !== mk) return;
        S.spans = cleanSpans(list);
        renderMiniCal();
        if (S.view === 'month') renderMonth();
        if (S.view === 'day') renderSched();
        if (S.info) renderInfo(false);
      });
    }
  }
  /* 저장소에서 받은 여러 날 종일 일정 → 화면에서 쓰기 좋게 (날짜가 이상한 것은 건너뜀) */
  function cleanSpans(list) {
    var out = [];
    (list || []).forEach(function (v) {
      if (!v || !/^[A-Za-z0-9_-]{1,60}$/.test(String(v.id || '')) || !DATE_RE.test(String(v.s || '')) || !String(v.t == null ? '' : v.t).trim()) return;
      var e = DATE_RE.test(String(v.e || '')) && v.e >= v.s ? v.e : v.s, inf = infoClean(v);
      out.push({ id: String(v.id), s: v.s, e: e, t: String(v.t), c: colorHex(v.c) ? v.c : '', b: v.b === true, bc: borderHex(v.bc) ? v.bc : '', bs: okBs(v.bs), bw: okBw(v.bw),
        ts: inf.ts, te: inf.te, loc: inf.loc, memo: inf.memo, created: Number(v.created) || 0 });
    });
    return out.sort(spanOrder);
  }
  /* 먼저 시작하는 일정 → 더 긴 일정 → 먼저 만든 일정 순서 */
  function spanOrder(a, b) {
    return (a.s < b.s ? -1 : a.s > b.s ? 1 : 0) || (a.e > b.e ? -1 : a.e < b.e ? 1 : 0) || ((a.created || 0) - (b.created || 0)) || (a.id < b.id ? -1 : 1);
  }
  /* 여러 날 종일 일정 고치기 (지워진 일정은 되살리지 않음) */
  function spanEdit(id, patch) {
    if (!S.store) return;
    if (typeof S.store.updateSpan === 'function') S.store.updateSpan(id, patch); else S.store.setSpan(id, patch);
  }
  function spanById(id) {
    for (var i = 0; i < S.spans.length; i++) if (S.spans[i].id === id) return S.spans[i];
    return null;
  }
  /* 그 날짜에 걸쳐 있는 여러 날 종일 일정 (지금 읽어 둔 달 안에서만) */
  function spansOn(ds) {
    if (S.schedKey !== monthKey(ds)) return [];
    return S.spans.filter(function (v) { return v.s <= ds && ds <= v.e; });
  }

  /* 메모 모아보기: 그 화면을 보는 동안만 읽음 */
  function subscribeMemos() {
    if (!S.store || S.unsub.memos) return;
    if (typeof S.store.watchNotes !== 'function') {   // store.js가 예전 파일일 때
      S.memos = [];
      toast('메모 모아보기를 쓰려면 store.js 파일도 새 버전으로 올려 주세요.', 'error', null, 8000);
      return;
    }
    S.memos = null;
    S.unsub.memos = S.store.watchNotes(function (list) {
      S.memos = list || [];
      if (S.view === 'memos') renderMemos();
    });
  }
  function unsubscribeMemos() {
    if (S.unsub.memos) { S.unsub.memos(); S.unsub.memos = null; }
  }

  /* ───────── 메모장 (v1.11부터): 폴더 · 하위 폴더 · 메모 (삼성노트처럼) ─────────
     휴대폰은 폴더 목록(side) → 메모 목록(list) → 메모(note)를 한 화면씩 보여 주고, PC는 왼쪽에 폴더 목록을 늘 둠.
     폴더·메모 모음은 메모장을 처음 열 때부터 읽고(store.watchPad), 적는 내용은 잠깐 뒤 저절로 저장 */
  var PAD_COLORS = [
    { id: '', name: '기본', hex: '' },
    { id: 'red', name: '빨강', hex: '#E0524A' },
    { id: 'orange', name: '주황', hex: '#EF8A2B' },
    { id: 'yellow', name: '노랑', hex: '#E2AE16' },
    { id: 'green', name: '초록', hex: '#3F9B47' },
    { id: 'teal', name: '청록', hex: '#17978A' },
    { id: 'sky', name: '하늘', hex: '#2A9FD3' },
    { id: 'blue', name: '파랑', hex: '#3A6FD6' },
    { id: 'navy', name: '남색', hex: '#334189' },
    { id: 'purple', name: '보라', hex: '#8753C4' },
    { id: 'pink', name: '분홍', hex: '#DB5189' },
    { id: 'brown', name: '갈색', hex: '#8B6B5E' },
    { id: 'gray', name: '회색', hex: '#888478' }
  ];
  var PAD_TITLE_MAX = 200, PAD_BODY_MAX = 100000, PAD_HTML_MAX = 300000, PAD_NAME_MAX = 40;
  var PAD_SORT_KEYS = ['updated', 'created', 'title'];
  function padHex(id) {
    for (var i = 1; i < PAD_COLORS.length; i++) if (id && PAD_COLORS[i].id === id) return PAD_COLORS[i].hex;
    return '';
  }
  var PAD_FOLDER_PATH = 'M2.5 6.6c0-.9.7-1.6 1.6-1.6h5.1l2.1 2.3h8.6c.9 0 1.6.7 1.6 1.6v9c0 .9-.7 1.6-1.6 1.6H4.1c-.9 0-1.6-.7-1.6-1.6z';
  function padFolderIcon(color) {
    var h = padHex(color);
    return '<svg class="fic" viewBox="0 0 24 24" aria-hidden="true"' + (h ? ' style="color:' + h + '"' : '') + '><path d="' + PAD_FOLDER_PATH + '" fill="currentColor"/></svg>';
  }
  var PAD_ICON = {
    all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/></svg>',
    fav: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="currentColor"/></svg>',
    favOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    caret: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.6"/></svg>',
    root: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/></svg>'
  };

  function padOk() { return !!(S.store && typeof S.store.watchPad === 'function' && typeof S.store.padCommit === 'function' && typeof S.store.newPadId === 'function'); }
  function padIsPhone() { return !window.matchMedia || window.matchMedia('(max-width: 899px)').matches; }
  function padByName(a, b) { return a.name.localeCompare(b.name, 'ko', { numeric: true }) || ((a.created || 0) - (b.created || 0)); }

  /* 폴더 나무: byId · kids(위 폴더 id → 하위 폴더 목록) · parent(실제 위 폴더) · 메모 개수(direct: 그 폴더만, total: 하위 폴더까지) */
  function padBuild() {
    var P = S.pad, byId = {}, kids = {}, parent = {}, direct = {}, total = {};
    P.folders.forEach(function (f) { byId[f.id] = f; });
    P.folders.forEach(function (f) {
      var p = f.parent && byId[f.parent] ? f.parent : '', seen = {}, cur = p, n = 0;
      seen[f.id] = true;
      while (cur) {   // 서로가 서로의 안에 들어간 폴더(두 기기에서 동시에 옮긴 경우)는 맨 위에 둠
        if (seen[cur] || ++n > 500) { p = ''; break; }
        seen[cur] = true;
        cur = byId[cur].parent && byId[byId[cur].parent] ? byId[cur].parent : '';
      }
      parent[f.id] = p;
    });
    P.folders.forEach(function (f) { (kids[parent[f.id]] = kids[parent[f.id]] || []).push(f); });
    Object.keys(kids).forEach(function (k) { kids[k].sort(padByName); });
    var live = 0, fav = 0;
    P.notes.forEach(function (n) {
      if (n.trashed) return;
      live++; if (n.fav) fav++;
      var f = byId[n.folder] ? n.folder : '';
      direct[f] = (direct[f] || 0) + 1;
    });
    (function sum(pid) {
      var t = direct[pid] || 0;
      (kids[pid] || []).forEach(function (f) { t += sum(f.id); });
      total[pid] = t;
      return t;
    })('');
    P.tree = { byId: byId, kids: kids, parent: parent, direct: direct, total: total, all: live, fav: fav, trash: P.notes.length - live };
  }
  function padFolder(id) { return (id && S.pad.tree && S.pad.tree.byId[id]) || null; }
  function padNote(id) {
    for (var i = 0; i < S.pad.notes.length; i++) if (S.pad.notes[i].id === id) return S.pad.notes[i];
    return null;
  }
  function padNoteFolder(n) { return padFolder(n.folder) ? n.folder : ''; }
  function padPath(id) {   // 맨 위 폴더부터 그 폴더까지
    var out = [], cur = id, n = 0;
    while (cur && padFolder(cur) && n++ < 500) { out.unshift(padFolder(cur)); cur = S.pad.tree.parent[cur]; }
    return out;
  }
  function padDesc(id) {   // 하위 폴더 전부 (하위의 하위까지)
    var out = [];
    (function walk(pid) { (S.pad.tree.kids[pid] || []).forEach(function (f) { out.push(f.id); walk(f.id); }); })(id);
    return out;
  }
  /* 펼친 폴더 (기기마다 기억) */
  function padIsOpen(id) { return !!S.padOpen[id]; }
  function padOpenSet(id, on) {
    if (on) S.padOpen[id] = 1; else delete S.padOpen[id];
    writePref('padOpen', JSON.stringify(Object.keys(S.padOpen).slice(-300)));
  }

  /* 날짜 표시: 오늘이면 '오후 3:20', 올해면 '11월 13일', 그 밖에는 '2025. 11. 13.' */
  function padTime(d) { var h = d.getHours(); return (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + ':' + pad(d.getMinutes()); }
  function padWhen(ts) {
    if (!ts) return '';
    var d = new Date(ts), now = new Date();
    if (ymd(d) === today()) return padTime(d);
    if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
  }
  function padWhenFull(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WD[d.getDay()] + ') ' + padTime(d);
  }
  function padFirstLine(s) {
    var m = String(s || '').split('\n');
    for (var i = 0; i < m.length; i++) if (m[i].trim()) return m[i].trim();
    return '';
  }
  function padTitleOf(n) { return String(n.title || '').trim() || padFirstLine(n.body) || '제목 없음'; }
  /* 카드에 보일 내용: 제목이 없으면 첫 줄이 제목 자리에 나오므로 그다음부터. 찾는 낱말이 뒤쪽에 있으면 그 근처를 */
  function padPreview(n, q) {
    var b = String(n.body || '');
    if (!String(n.title || '').trim()) {
      var lines = b.split('\n'), i = 0;
      while (i < lines.length && !lines[i].trim()) i++;
      b = lines.slice(i + 1).join('\n');
    }
    b = b.replace(/^\s+/, '');
    if (q) {
      var k = b.toLowerCase().indexOf(q.toLowerCase());
      if (k > 120) b = '…' + b.slice(k - 50);
    }
    return b.slice(0, 420);
  }
  function padHl(text, q) {   // 찾는 낱말에 노란 표시
    text = String(text);
    if (!q) return esc(text);
    var lt = text.toLowerCase(), lq = q.toLowerCase(), out = '', i = 0, j;
    if (lt.length !== text.length) return esc(text);
    while ((j = lt.indexOf(lq, i)) >= 0) {
      out += esc(text.slice(i, j)) + '<mark>' + esc(text.slice(j, j + lq.length)) + '</mark>';
      i = j + lq.length;
    }
    return out + esc(text.slice(i));
  }
  function padLines(n) {   // 저장된 메모 내용 → 줄 목록 (진하게 포함). 예전 기기가 그냥 글자만 고쳤으면 그쪽을 따름
    var plain = typeof n.body === 'string' ? n.body : '';
    if (typeof n.bodyHtml === 'string' && n.bodyHtml) {
      var lines = rtFromHtml(n.bodyHtml);
      if (rtText(lines) === plain) return lines;
    }
    return rtFromText(plain);
  }
  function padNorm(d) {   // 받은 자료 정리 (빠진 값은 기본값으로)
    var folders = [], notes = [];
    (d && d.folders || []).forEach(function (f) {
      if (!f || !f.id || typeof f.name !== 'string' || !f.name.trim()) return;
      folders.push({ id: String(f.id), name: f.name.trim().slice(0, PAD_NAME_MAX), parent: typeof f.parent === 'string' ? f.parent : '', color: padHex(f.color) ? f.color : '', created: +f.created || 0, updated: +f.updated || 0 });
    });
    (d && d.notes || []).forEach(function (n) {
      if (!n || !n.id) return;
      notes.push({
        id: String(n.id), folder: typeof n.folder === 'string' ? n.folder : '',
        title: typeof n.title === 'string' ? n.title : '', body: typeof n.body === 'string' ? n.body : '',
        bodyHtml: typeof n.bodyHtml === 'string' ? n.bodyHtml : '', fav: n.fav === true,
        trashed: Number(n.trashed) > 0 ? Number(n.trashed) : 0, created: +n.created || 0, updated: +n.updated || +n.created || 0
      });
    });
    return { folders: folders, notes: notes };
  }

  function subscribePad() {
    if (!S.store || S.unsub.pad || !padOk()) return;
    S.unsub.pad = S.store.watchPad(function (d) {
      var nd = padNorm(d);
      S.pad.folders = nd.folders; S.pad.notes = nd.notes; S.pad.loaded = true;
      padBuild();
      padSyncEditor();
      if (S.view === 'pad') renderPad();
    });
  }
  function padReset() {
    clearTimeout(PE.timer);
    S.pad.folders = []; S.pad.notes = []; S.pad.loaded = false; S.pad.tree = null;
    S.pad.sel = { kind: 'all', id: '' }; S.pad.open = null; S.pad.q = '';
    PE = peBlank();
  }

  /* ── 화면 단계와 '뒤로 가기' (휴대폰: 폴더 목록 0 → 메모 목록 1 → 메모 2, PC: 메모를 열 때만) ── */
  var padHist = 0, padSkipPop = 0, padSheetPushed = false;   // 쌓아 둔 기록 수 · 무시할 '뒤로' 수 · 폴더 창이 기록을 하나 쌓았는지
  var PAD_DEPTH = { side: 0, list: 1, note: 2 };
  function padSetPane(p) {
    var deeper = PAD_DEPTH[p] > PAD_DEPTH[S.pad.pane];
    S.pad.pane = p;
    if (deeper && (p === 'note' || padIsPhone())) {
      try { history.pushState({ pad: PAD_DEPTH[p] }, ''); padHist++; } catch (e) { /* 뒤로 가기 없이 */ }
    }
  }
  function padPopOne() {   // 화면의 ‹ 단추로 돌아갔을 때, 쌓아 둔 뒤로 가기 기록도 하나 지움
    if (padHist > 0) { padHist--; padSkipPop++; try { history.back(); } catch (e) { padSkipPop--; } }
  }
  function padUp() {
    if (S.pad.pane === 'note') { padCloseNote(); S.pad.pane = 'list'; }
    else if (S.pad.pane === 'list') S.pad.pane = 'side';
    renderPad();
  }
  function padBackBtn() { padUp(); padPopOne(); }
  function padOnPop() {
    if (padSkipPop > 0) { padSkipPop--; return; }
    if (padHist <= 0) return;
    padHist--;
    if (padSheetPushed) { padSheetPushed = false; closePadFolder(true); closePadPick(true); return; }   // 폴더 창: 창만 닫음
    if (S.view !== 'pad') return;
    if (!$('#padMenu').hidden || !$('#drawer').hidden) {   // 메뉴가 열려 있으면 메뉴만 닫고, 지금 단계는 그대로
      padMenu(false); closeDrawer();
      try { history.pushState({ pad: PAD_DEPTH[S.pad.pane] }, ''); padHist++; } catch (e) { /* 무시 */ }
      return;
    }
    padUp();
  }
  function padSheetPush() {   // 폴더 창을 열 때: 휴대폰의 '뒤로'로 창만 닫히게 기록을 하나 쌓음
    if (padSheetPushed) return;
    try { history.pushState({ padSheet: 1 }, ''); padHist++; padSheetPushed = true; } catch (e) { /* 무시 */ }
  }
  function padEnter() {
    S.pad.pane = padIsPhone() ? 'side' : 'list';
    S.pad.q = ''; $('#padQ').value = '';
    renderPad();
  }
  function padLeave() {   // 메모장을 떠날 때: 저장하고 닫음, 쌓아 둔 뒤로 가기 기록도 한 번에 정리
    padSheetPushed = false;
    padCloseNote(); closePadFolder(true); closePadPick(true); padMenu(false);
    if (padHist > 0) { var n = padHist; padHist = 0; padSkipPop++; try { history.go(-n); } catch (e) { padSkipPop--; } }
  }

  /* ── 그리기 ── */
  function renderPad() {
    if (S.view !== 'pad') return;
    var root = $('#pad'), msg = $('#padMsg'), P = S.pad;
    if (!padOk() || !P.loaded) {
      msg.textContent = !S.store ? '' : !padOk() ? '메모장을 쓰려면 store.js 파일도 새 버전(v1.11)으로 올려 주세요. 업데이트 파일을 모두 다시 올리면 됩니다.' : '불러오는 중…';
      msg.hidden = false; root.hidden = true;
      return;
    }
    msg.hidden = true; root.hidden = false;
    if (P.sel.kind === 'folder' && !padFolder(P.sel.id)) P.sel = { kind: 'all', id: '' };   // 다른 기기에서 지운 폴더
    root.dataset.pane = P.pane;
    renderPadSide();
    var open = !!P.open;
    $('#padListWrap').hidden = open; $('#padEditor').hidden = !open;
    $('#padNew').hidden = open || (P.sel.kind === 'trash' && P.pane !== 'side');
    if (!open) renderPadList();
  }
  function renderPadSide() {
    var P = S.pad, T = P.tree, sel = P.sel;
    function nav(kind, label, n) {
      var on = sel.kind === kind;
      return '<button type="button" class="pn' + (on ? ' on' : '') + '" data-pad="' + kind + '"' + (on ? ' aria-current="true"' : '') + '>' + PAD_ICON[kind] +
        '<span class="pnm">' + label + '</span><span class="pc">' + n + '</span></button>';
    }
    $('#padNav').innerHTML = nav('all', '모든 메모', T.all) + nav('fav', '즐겨찾기', T.fav);
    $('#padNavEnd').innerHTML = nav('trash', '휴지통', T.trash);
    var html = '';
    (function rows(pid, lv) {
      (T.kids[pid] || []).forEach(function (f) {
        var kids = T.kids[f.id] || [], open = padIsOpen(f.id), on = sel.kind === 'folder' && sel.id === f.id, id = esc(f.id);
        html += '<div class="pt-row' + (on ? ' on' : '') + '" role="treeitem" aria-level="' + (lv + 1) + '"' + (kids.length ? ' aria-expanded="' + open + '"' : '') + ' style="--lv:' + Math.min(lv, 6) + '">' +
          (kids.length ? '<button type="button" class="pt-caret' + (open ? ' open' : '') + '" data-toggle="' + id + '" aria-label="' + esc(f.name) + ' 하위 폴더 ' + (open ? '접기' : '펼치기') + '">' + PAD_ICON.caret + '</button>' : '<span class="pt-caret none"></span>') +
          '<button type="button" class="pt-name" data-folder="' + id + '"' + (on ? ' aria-current="true"' : '') + '>' + padFolderIcon(f.color) +
          '<span class="ptn">' + esc(f.name) + '</span><span class="pc">' + (T.total[f.id] || 0) + '</span></button></div>';
        if (kids.length && open) rows(f.id, lv + 1);
      });
    })('', 0);
    $('#padTree').innerHTML = html || '<p class="pt-empty">아직 폴더가 없습니다.<br>‘+ 새 폴더’를 눌러 만들어 보세요.</p>';
  }
  function padScope() {   // 지금 보는 곳의 메모 (찾기 전)
    var P = S.pad, sel = P.sel;
    if (sel.kind === 'trash') return P.notes.filter(function (n) { return n.trashed; });
    var live = P.notes.filter(function (n) { return !n.trashed; });
    if (sel.kind === 'fav') return live.filter(function (n) { return n.fav; });
    if (sel.kind === 'folder') {
      if (P.q.trim()) {   // 폴더에서 찾을 때는 하위 폴더까지
        var ids = {}; ids[sel.id] = true;
        padDesc(sel.id).forEach(function (x) { ids[x] = true; });
        return live.filter(function (n) { return ids[padNoteFolder(n)]; });
      }
      return live.filter(function (n) { return padNoteFolder(n) === sel.id; });
    }
    return live;
  }
  function padSorted(list) {
    var k = S.padSort, trash = S.pad.sel.kind === 'trash';
    return list.slice().sort(function (a, b) {
      if (trash) return (b.trashed - a.trashed) || (b.updated - a.updated);   // 휴지통: 최근에 넣은 것부터
      if (k === 'title') return padTitleOf(a).localeCompare(padTitleOf(b), 'ko', { numeric: true }) || (b.updated - a.updated);
      return ((b[k] || 0) - (a[k] || 0)) || (b.updated - a.updated);
    });
  }
  function padCard(n, showFolder, q) {
    var hasTitle = !!String(n.title || '').trim(), first = padFirstLine(n.body), t = padTitleOf(n), pv = padPreview(n, q);
    var f = showFolder ? padFolder(padNoteFolder(n)) : null;
    var when = S.pad.sel.kind === 'trash' ? '휴지통 · ' + padWhen(n.trashed) : padWhen(S.padSort === 'created' ? n.created : n.updated);
    return '<button type="button" class="pcard" data-note="' + esc(n.id) + '">' +
      '<span class="pc-t' + (!hasTitle && !first ? ' none' : '') + '">' + padHl(t, q) + '</span>' +
      (pv.trim() ? '<span class="pc-b">' + padHl(pv, q) + '</span>' : '') +
      '<span class="pc-f">' + (n.fav ? '<span class="pc-star" aria-label="즐겨찾기">★</span>' : '') +
      (f ? '<span class="pc-fd">' + padFolderIcon(f.color) + esc(f.name) + '</span>' : '') +
      '<span class="pc-d">' + esc(when) + '</span></span></button>';
  }
  function renderPadList() {
    var P = S.pad, T = P.tree, sel = P.sel, q = P.q.trim(), f = sel.kind === 'folder' ? padFolder(sel.id) : null;
    var title = f ? f.name : sel.kind === 'fav' ? '즐겨찾기' : sel.kind === 'trash' ? '휴지통' : '모든 메모';
    var crumb = $('#padCrumb');
    if (f) {
      crumb.innerHTML = '<button type="button" data-pad="all">메모장</button>' + padPath(f.id).slice(0, -1).map(function (x) {
        return '<span class="sep">›</span><button type="button" data-folder="' + esc(x.id) + '">' + esc(x.name) + '</button>';
      }).join('');
      crumb.hidden = false;
    } else { crumb.innerHTML = ''; crumb.hidden = true; }
    $('#padTitle').innerHTML = (f ? padFolderIcon(f.color) : '') + '<span>' + esc(title) + '</span>';
    var subs = f ? (T.kids[f.id] || []) : [], sb = $('#padSubs');
    sb.hidden = !f || !!q;
    sb.innerHTML = f ? subs.map(function (x) {
      return '<button type="button" class="psub" data-folder="' + esc(x.id) + '">' + padFolderIcon(x.color) + '<span class="psn">' + esc(x.name) + '</span><span class="pc">' + (T.total[x.id] || 0) + '</span></button>';
    }).join('') + '<button type="button" class="psub add" data-pact="sub">+ 하위 폴더</button>' : '';
    var list = padScope();
    if (q) {
      var lq = q.toLowerCase();
      list = list.filter(function (n) { return (n.title + '\n' + n.body).toLowerCase().indexOf(lq) >= 0; });
    }
    list = padSorted(list);
    var showFolder = !f || !!q;
    $('#padCount').textContent = q ? '찾은 메모 ' + list.length + '개' : '메모 ' + list.length + '개' + (subs.length ? ' · 하위 폴더 ' + subs.length + '개' : '');
    var box = $('#padList');
    box.dataset.layout = S.padLayout;
    if (list.length) box.innerHTML = list.map(function (n) { return padCard(n, showFolder, q); }).join('');
    else {
      var empty = q ? '‘' + esc(q) + '’이(가) 들어간 메모가 없습니다.'
        : sel.kind === 'trash' ? '휴지통이 비어 있습니다.'
        : sel.kind === 'fav' ? '즐겨찾기한 메모가 없습니다.<br>메모를 연 뒤 ☆를 누르면 여기에 모입니다.'
        : f ? '이 폴더에는 아직 메모가 없습니다.<br>오른쪽 아래 연필 단추로 새 메모를 적어 보세요.'
        : '아직 메모가 없습니다.<br>오른쪽 아래 연필 단추로 첫 메모를 적어 보세요.';
      box.innerHTML = '<p class="pad-empty">' + empty + '</p>';
    }
    $('#padQ').placeholder = f ? '‘' + f.name + '’에서 찾기' : sel.kind === 'trash' ? '휴지통에서 찾기' : sel.kind === 'fav' ? '즐겨찾기에서 찾기' : '모든 메모에서 찾기';
    $('#padMore').hidden = !f;
    $('#padSort').hidden = sel.kind === 'trash';
    $('#padSort').value = S.padSort;
    var lb = $('#padLayout'), grid = S.padLayout !== 'list';
    lb.innerHTML = grid ? PAD_ICON.list : PAD_ICON.grid;
    lb.setAttribute('aria-label', grid ? '목록으로 보기' : '카드로 보기');
    lb.title = grid ? '목록으로 보기' : '카드로 보기';
    $('#padTrashBar').hidden = sel.kind !== 'trash';
    $('#padEmptyTrash').disabled = !T.trash;
  }

  /* ── 고르기 · 폴더 메뉴 ── */
  function padSelect(sel) {
    padMenu(false);
    if (S.pad.open) { padCloseNote(); padPopOne(); S.pad.pane = 'list'; }
    S.pad.sel = sel;
    S.pad.q = ''; $('#padQ').value = '';
    if (sel.kind === 'folder') padPath(sel.id).forEach(function (x) { if (x.id !== sel.id && !padIsOpen(x.id)) padOpenSet(x.id, true); });
    if (S.pad.pane === 'side') padSetPane('list');
    renderPad();
    window.scrollTo(0, 0);
  }
  function padMenu(on) {
    var m = $('#padMenu');
    if (!m) return;
    m.hidden = !on;
    $('#padMore').setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  function padMenuAct(act) {
    padMenu(false);
    var f = S.pad.sel.kind === 'folder' ? padFolder(S.pad.sel.id) : null;
    if (!f) return;
    if (act === 'sub') padFolderSheet('new', f.id);
    else if (act === 'edit') padFolderSheet('edit', f.id);
    else if (act === 'move') padPickOpen({ kind: 'folder', id: f.id });
    else if (act === 'del') padDeleteFolder(f.id);
  }

  /* ── 폴더 만들기 · 이름과 색 바꾸기 ── */
  var PF = null;   // { mode: 'new' | 'edit', id, parent, color }
  function padFolderSheet(mode, ref) {
    if (!padOk()) return;
    var f = mode === 'edit' ? padFolder(ref) : null, par = mode === 'new' ? padFolder(ref) : null;
    if (mode === 'edit' && !f) return;
    PF = { mode: mode, id: f ? f.id : '', parent: f ? S.pad.tree.parent[f.id] : (par ? par.id : ''), color: f ? f.color : (par ? par.color : '') };
    $('#pfTitle').textContent = f ? '폴더 이름 · 색 바꾸기' : par ? '하위 폴더 만들기' : '새 폴더';
    $('#pfWhere').textContent = f ? '' : par ? '‘' + par.name + '’ 폴더 안에 만듭니다.' : '맨 위에 만듭니다. (폴더를 연 뒤 ‘+ 하위 폴더’를 누르면 그 안에 만들어집니다.)';
    $('#pfWhere').hidden = !!f;
    $('#pfName').value = f ? f.name : '';
    $('#pfErr').textContent = '';
    $('#pfOk').textContent = f ? '저장' : '만들기';
    renderPfColors();
    $('#padFolderSheet').hidden = false;
    padSheetPush();
    setTimeout(function () { try { $('#pfName').focus(); } catch (e) { /* 무시 */ } }, 30);
  }
  function renderPfColors() {
    $('#pfColors').innerHTML = PAD_COLORS.map(function (c) {
      var on = PF && PF.color === c.id;
      return '<button type="button" role="radio" aria-checked="' + on + '" data-color="' + c.id + '" class="' + (on ? 'on' : '') + '" aria-label="' + c.name + '" title="' + c.name + '">' + padFolderIcon(c.id) + '</button>';
    }).join('');
  }
  function closePadFolder(fromPop) {
    var el = $('#padFolderSheet');
    if (!el || el.hidden) { PF = null; return; }
    el.hidden = true; PF = null;
    if (!fromPop && padSheetPushed) { padSheetPushed = false; padPopOne(); }
  }
  function pfSubmit() {
    if (!PF || !S.store) return;
    var name = $('#pfName').value.replace(/\s+/g, ' ').trim().slice(0, PAD_NAME_MAX), now = Date.now();
    if (!name) { $('#pfErr').textContent = '폴더 이름을 적어 주십시오.'; $('#pfName').focus(); return; }
    var dup = (S.pad.tree.kids[PF.parent] || []).some(function (x) { return x.id !== PF.id && x.name.toLowerCase() === name.toLowerCase(); });
    if (dup) { $('#pfErr').textContent = '같은 곳에 같은 이름의 폴더가 이미 있습니다. 다른 이름을 적어 주십시오.'; $('#pfName').focus(); return; }
    if (PF.mode === 'edit') {
      var f = padFolder(PF.id);
      if (f && (f.name !== name || f.color !== PF.color)) {
        S.store.padCommit([{ kind: 'folder', op: 'update', id: PF.id, data: { name: name, color: PF.color, updated: now } }]);
        toast('폴더를 바꿨습니다.');
      }
    } else {
      var id = S.store.newPadId(), parent = PF.parent;
      S.store.padCommit([{ kind: 'folder', op: 'set', id: id, data: { name: name, parent: parent, color: PF.color, created: now, updated: now } }]);
      if (parent && !padIsOpen(parent)) padOpenSet(parent, true);
      toast('‘' + name + '’ 폴더를 만들었습니다.');
    }
    closePadFolder();
  }

  /* ── 옮길 곳 고르기 (메모 또는 폴더) ── */
  var PP = null;   // { kind: 'note' | 'folder', id }
  function padPickOpen(what) {
    if (!padOk()) return;
    var T = S.pad.tree, cur, skip = {}, html = '';
    if (what.kind === 'note') {
      var n = what.id === PE.id ? peNote() : padNote(what.id);
      if (!n) return;
      cur = padFolder(n.folder) ? n.folder : '';
      $('#ppTitle').textContent = '메모를 옮길 폴더 고르기';
      $('#ppWhat').textContent = '‘' + padTitleOf(n).slice(0, 40) + '’';
    } else {
      var f = padFolder(what.id);
      if (!f) return;
      cur = T.parent[f.id];
      skip[f.id] = true; padDesc(f.id).forEach(function (x) { skip[x] = true; });   // 자기 자신과 그 안으로는 옮길 수 없음
      $('#ppTitle').textContent = '폴더를 옮길 곳 고르기';
      $('#ppWhat').textContent = '‘' + f.name + '’ 폴더(하위 폴더와 메모도 함께)';
    }
    PP = what;
    html += '<button type="button" class="pp-row pp-root" data-dest=""' + (cur === '' ? ' disabled' : '') + '>' + PAD_ICON.root +
      '<span>' + (what.kind === 'note' ? '폴더 없음' : '맨 위 (다른 폴더 밖)') + '</span>' + (cur === '' ? '<small>지금 있는 곳</small>' : '') + '</button>';
    (function rows(pid, lv) {
      (T.kids[pid] || []).forEach(function (x) {
        if (skip[x.id]) return;
        var here = x.id === cur;
        html += '<button type="button" class="pp-row" style="--lv:' + Math.min(lv, 6) + '" data-dest="' + esc(x.id) + '"' + (here ? ' disabled' : '') + '>' + padFolderIcon(x.color) +
          '<span>' + esc(x.name) + '</span>' + (here ? '<small>지금 있는 곳</small>' : '') + '</button>';
        rows(x.id, lv + 1);
      });
    })('', 0);
    $('#ppList').innerHTML = html;
    $('#padPickSheet').hidden = false;
    padSheetPush();
  }
  function closePadPick(fromPop) {
    var el = $('#padPickSheet');
    if (!el || el.hidden) { PP = null; return; }
    el.hidden = true; PP = null;
    if (!fromPop && padSheetPushed) { padSheetPushed = false; padPopOne(); }
  }
  function padMoveTo(dest) {
    var what = PP, now = Date.now(), name = dest ? (padFolder(dest) || {}).name : '';
    closePadPick();
    if (!what || !S.store || (dest && !padFolder(dest))) return;
    if (what.kind === 'note') {
      if (what.id === PE.id) {
        PE.cur.folder = dest;
        if (PE.exists) { peSave(); S.store.padCommit([{ kind: 'note', op: 'update', id: what.id, data: { folder: dest } }]); }
        padFillMeta(PE.cur);
      } else S.store.padCommit([{ kind: 'note', op: 'update', id: what.id, data: { folder: dest } }]);
      toast(dest ? '‘' + name + '’ 폴더로 옮겼습니다.' : '폴더 밖(폴더 없음)으로 옮겼습니다.');
    } else {
      if (dest === what.id || padDesc(what.id).indexOf(dest) >= 0) return;
      S.store.padCommit([{ kind: 'folder', op: 'update', id: what.id, data: { parent: dest, updated: now } }]);
      if (dest && !padIsOpen(dest)) padOpenSet(dest, true);
      toast(dest ? '‘' + name + '’ 폴더 안으로 옮겼습니다.' : '맨 위로 옮겼습니다.');
    }
  }

  /* ── 폴더 지우기: 하위 폴더도 함께, 안의 메모는 휴지통으로 (바로 뒤 '되돌리기'로 되살림) ── */
  function padDeleteFolder(id) {
    var f = padFolder(id);
    if (!f || !S.store) return;
    var ids = [id].concat(padDesc(id)), inSet = {};
    ids.forEach(function (x) { inSet[x] = true; });
    var inside = S.pad.notes.filter(function (n) { return !n.trashed && inSet[padNoteFolder(n)]; });
    var msg = '‘' + f.name + '’ 폴더를 지울까요?';
    if (ids.length > 1) msg += '\n안에 있는 하위 폴더 ' + (ids.length - 1) + '개도 함께 지워집니다.';
    msg += inside.length ? '\n폴더 안의 메모 ' + inside.length + '개는 휴지통으로 옮겨집니다(휴지통에서 복원할 수 있습니다).' : '\n폴더 안에 메모는 없습니다.';
    if (!window.confirm(msg)) return;
    var now = Date.now(), up = S.pad.tree.parent[id] || '';
    var keep = ids.map(function (x) { return padFolder(x); }).filter(Boolean).map(function (x) {
      return { id: x.id, name: x.name, parent: x.parent || '', color: x.color || '', created: x.created || now, updated: x.updated || now };
    });
    var ops = inside.map(function (n) { return { kind: 'note', op: 'update', id: n.id, data: { trashed: now } }; });
    ids.forEach(function (x) { ops.push({ kind: 'folder', op: 'remove', id: x }); });
    S.store.padCommit(ops);
    S.pad.sel = up && padFolder(up) ? { kind: 'folder', id: up } : { kind: 'all', id: '' };
    renderPad();
    toast('‘' + f.name + '’ 폴더를 지웠습니다.' + (inside.length ? ' 메모 ' + inside.length + '개는 휴지통에 있습니다.' : ''), null, {
      label: '되돌리기', fn: function () {
        if (!S.store || !padOk()) return;
        var back = keep.map(function (x) { return { kind: 'folder', op: 'set', id: x.id, data: { name: x.name, parent: x.parent, color: x.color, created: x.created, updated: x.updated } }; });
        inside.forEach(function (n) { back.push({ kind: 'note', op: 'update', id: n.id, data: { trashed: 0 } }); });
        S.store.padCommit(back);
        toast('폴더를 되살렸습니다.');
      }
    }, 8000);
  }
  function padEmptyTrash() {
    var list = S.pad.notes.filter(function (n) { return n.trashed; });
    if (!list.length || !S.store) return;
    if (!window.confirm('휴지통의 메모 ' + list.length + '개를 완전히 지울까요?\n지운 메모는 되돌릴 수 없습니다.')) return;
    S.store.padCommit(list.map(function (n) { return { kind: 'note', op: 'remove', id: n.id }; }));
    toast('휴지통을 비웠습니다.');
  }

  /* ── 메모 쓰기 ── */
  /* 열린 메모: id · exists(저장됨) · seen(목록에서 한 번이라도 봄) · cur(화면에 열린 메모의 가장 새 내용 — 방금 저장한 것이 목록에 오기 전에도 그대로) · dirty(아직 저장 안 한 고침) */
  function peBlank() { return { id: '', exists: false, seen: false, cur: null, dirty: false, timer: null, state: '' }; }
  var PE = peBlank(), peRange = null;
  function peNote() { return PE.id ? PE.cur : null; }
  function peFocused() { var a = document.activeElement; return !!a && (a.id === 'peTitle' || a.id === 'peBody' || $('#peBody').contains(a)); }
  function padOpenNote(id) {
    var n = padNote(id);
    if (!n) return;
    padMenu(false);
    S.pad.open = id;
    PE = peBlank(); PE.id = id; PE.exists = true; PE.seen = true; PE.cur = Object.assign({}, n);
    padFillEditor(n, true);
    padSetPane('note');
    renderPad();
    window.scrollTo(0, 0);
  }
  function padNewNote() {
    if (!padOk() || !S.pad.loaded) return;
    padMenu(false);
    if (S.pad.open) padCloseNote();
    if (S.pad.sel.kind === 'trash' || S.pad.pane === 'side') S.pad.sel = { kind: 'all', id: '' };   // 휴대폰 첫 화면(폴더 목록)에서 쓰면 폴더 없는 메모
    var sel = S.pad.sel, now = Date.now();
    PE = peBlank();
    PE.id = S.store.newPadId();
    PE.cur = { id: PE.id, folder: sel.kind === 'folder' && padFolder(sel.id) ? sel.id : '', title: '', body: '', bodyHtml: '', fav: sel.kind === 'fav', trashed: 0, created: now, updated: now };
    S.pad.open = PE.id;
    padFillEditor(PE.cur, true);
    if (S.pad.pane === 'side') padSetPane('list');   // 폴더 목록에서 바로 쓴 메모는 닫으면 메모 목록으로
    padSetPane('note');
    renderPad();
    window.scrollTo(0, 0);
    try { $('#peTitle').focus(); } catch (e) { /* 무시 */ }
  }
  function padFillEditor(n, force) {
    var t = $('#peTitle'), ed = $('#peBody');
    if (force || t.value !== (n.title || '')) t.value = n.title || '';
    var html = rtHtml(padLines(n));
    if (force || rtHtml(rtFromDom(ed)) !== html) { ed.innerHTML = html; peRange = null; }
    ed.classList.toggle('is-empty', notesLooksEmpty(ed));
    padFillMeta(n);
  }
  function padFillMeta(n) {
    var f = padFolder(n.folder), trashed = !!n.trashed;
    $('#peFolder').innerHTML = padFolderIcon(f ? f.color : '') + '<span>' + esc(f ? f.name : '폴더 없음') + '</span>';
    $('#peFolder').disabled = trashed;
    var fb = $('#peFav');
    fb.innerHTML = n.fav ? PAD_ICON.fav : PAD_ICON.favOff;
    fb.setAttribute('aria-pressed', n.fav ? 'true' : 'false');
    fb.setAttribute('aria-label', n.fav ? '즐겨찾기에서 빼기' : '즐겨찾기에 넣기');
    fb.title = n.fav ? '즐겨찾기에서 빼기' : '즐겨찾기에 넣기';
    fb.hidden = trashed; $('#peDel').hidden = trashed; $('#peBold').hidden = trashed;
    $('#peTrash').hidden = !trashed;
    $('#peTitle').readOnly = trashed;
    $('#peBody').setAttribute('contenteditable', trashed ? 'false' : 'true');
    peMeta(n);
  }
  function peMeta(n, state) {   // state: '저장 중…' · '저장됨' (주지 않으면 마지막 상태 그대로)
    n = n || peNote();
    if (!n) return;
    if (state !== undefined) PE.state = state;
    var txt = !PE.exists ? '새 메모' : '고친 날 ' + padWhenFull(n.updated) + (n.created && padWhenFull(n.created) !== padWhenFull(n.updated) ? ' · 만든 날 ' + padWhenFull(n.created) : '');
    if (n.trashed) txt += ' · 휴지통에 넣은 날 ' + padWhenFull(n.trashed);
    else if (PE.state) txt += ' · ' + PE.state;
    $('#peMeta').textContent = txt;
  }
  function peTouch() {
    if (!PE.id) return;
    var n = peNote();
    if (!n || n.trashed) return;
    PE.dirty = true;
    $('#peBody').classList.toggle('is-empty', notesLooksEmpty($('#peBody')));
    peMeta(n, '저장 중…');
    clearTimeout(PE.timer);
    PE.timer = setTimeout(peSave, 600);
  }
  function peSave() {
    clearTimeout(PE.timer); PE.timer = null;
    if (!PE.id || !PE.dirty || !S.store || !padOk()) return;
    var n = peNote();
    PE.dirty = false;
    if (!n || n.trashed) return;
    var title = $('#peTitle').value.slice(0, PAD_TITLE_MAX), lines = rtFromDom($('#peBody')), body = rtText(lines);
    var html = rtHasBold(lines) ? rtHtml(lines) : '', cut = false;
    if (body.length > PAD_BODY_MAX) { body = body.slice(0, PAD_BODY_MAX); html = ''; cut = true; }
    if (html.length > PAD_HTML_MAX) html = '';
    var now = Date.now();
    if (!PE.exists) {
      if (!title.trim() && !body.trim()) { peMeta(n, ''); return; }   // 아직 아무것도 적지 않은 새 메모는 저장하지 않음
      S.store.padCommit([{ kind: 'note', op: 'set', id: PE.id, data: { folder: n.folder, title: title, body: body, bodyHtml: html, fav: n.fav, trashed: 0, created: n.created, updated: now } }]);
      PE.exists = true;
    } else {
      if (title === n.title && body === n.body && html === (n.bodyHtml || '')) { peMeta(n, '저장됨'); return; }
      S.store.padCommit([{ kind: 'note', op: 'update', id: PE.id, data: { title: title, body: body, bodyHtml: html, updated: now } }]);
    }
    PE.cur = Object.assign({}, n, { title: title, body: body, bodyHtml: html, updated: now });
    peMeta(PE.cur, '저장됨');
    if (cut) toast('메모가 너무 길어 뒷부분은 저장되지 않았습니다. (10만 자까지)', 'error', null, 6000);
  }
  /* 메모를 닫을 때: 저장하고, 제목과 내용을 모두 비운 메모는 남기지 않음 */
  function padCloseNote() {
    if (!S.pad.open) return;
    peSave();
    var n = PE.exists ? PE.cur : null;
    if (n && !n.trashed && S.store && !$('#peTitle').value.trim() && !rtText(rtFromDom($('#peBody'))).trim()) {
      S.store.padCommit([{ kind: 'note', op: 'remove', id: PE.id }]);
    }
    S.pad.open = null; PE = peBlank();
    var a = document.activeElement;
    if (a && (a.id === 'peTitle' || a.id === 'peBody')) a.blur();
  }
  /* 다른 기기에서 바뀐 내용: 적는 중이 아니면 화면에 반영, 메모가 지워졌으면 닫음 */
  function padSyncEditor() {
    if (!S.pad.open || !PE.exists) return;
    var n = padNote(PE.id);
    if (!n) {
      if (!PE.seen) return;   // 방금 만든 메모가 아직 목록에 오기 전
      clearTimeout(PE.timer);
      S.pad.open = null; PE = peBlank();
      if (S.view === 'pad') { S.pad.pane = 'list'; padPopOne(); toast('다른 기기에서 지운 메모입니다.'); }
      return;
    }
    PE.seen = true;
    if ((n.updated || 0) >= (PE.cur.updated || 0) && !PE.dirty && !peFocused()) { PE.cur = Object.assign({}, n); padFillEditor(n, false); }
    else { PE.cur.folder = n.folder; PE.cur.fav = n.fav; PE.cur.trashed = n.trashed; padFillMeta(PE.cur); }
  }
  function peFav() {
    var n = peNote();
    if (!n || n.trashed || !S.store) return;
    var v = !n.fav;
    if (PE.exists) { peSave(); S.store.padCommit([{ kind: 'note', op: 'update', id: PE.id, data: { fav: v } }]); }
    PE.cur.fav = v;
    padFillMeta(PE.cur);
    toast(v ? '즐겨찾기에 넣었습니다.' : '즐겨찾기에서 뺐습니다.');
  }
  function peTrash() {
    var n = peNote();
    if (!n || !S.store) return;
    peSave();
    var id = PE.id, existed = PE.exists, empty = !$('#peTitle').value.trim() && !rtText(rtFromDom($('#peBody'))).trim();
    clearTimeout(PE.timer);
    S.pad.open = null; PE = peBlank();
    S.pad.pane = 'list'; padPopOne();
    if (!existed) { renderPad(); return; }   // 아직 저장하지 않은 새 메모: 그냥 닫음
    if (empty) { S.store.padCommit([{ kind: 'note', op: 'remove', id: id }]); renderPad(); return; }
    S.store.padCommit([{ kind: 'note', op: 'update', id: id, data: { trashed: Date.now() } }]);
    renderPad();
    toast('휴지통으로 옮겼습니다.', null, { label: '되돌리기', fn: function () { if (S.store && padOk()) S.store.padCommit([{ kind: 'note', op: 'update', id: id, data: { trashed: 0 } }]); } });
  }
  function peRestore() {
    var n = peNote();
    if (!n || !n.trashed || !S.store) return;
    var f = padFolder(n.folder) ? n.folder : '';
    S.store.padCommit([{ kind: 'note', op: 'update', id: n.id, data: { trashed: 0, folder: f } }]);
    PE.cur.trashed = 0; PE.cur.folder = f;
    padFillMeta(PE.cur);
    toast(f ? '‘' + padFolder(f).name + '’ 폴더로 복원했습니다.' : '복원했습니다.');
  }
  function peKill() {
    var n = peNote();
    if (!n || !S.store) return;
    if (!window.confirm('이 메모를 완전히 지울까요?\n지운 메모는 되돌릴 수 없습니다.')) return;
    var id = n.id;
    clearTimeout(PE.timer);
    S.pad.open = null; PE = peBlank();
    S.pad.pane = 'list'; padPopOne();
    S.store.padCommit([{ kind: 'note', op: 'remove', id: id }]);
    renderPad();
    toast('메모를 완전히 지웠습니다.');
  }
  /* 진하게 (하루 메모 칸과 같은 방식) */
  function peBoldState() {
    var ed = $('#peBody'), sel = window.getSelection(), on = false, b = $('#peBold');
    if (sel && sel.rangeCount && ed.contains(sel.anchorNode)) {
      try { on = document.queryCommandState('bold'); } catch (e) { on = false; }
    }
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function peToggleBold() {
    var ed = $('#peBody'), sel = window.getSelection(), n = peNote();
    if (!n || n.trashed) return;
    if (document.activeElement !== ed) {
      ed.focus();
      var r = peRange && ed.contains(peRange.startContainer) ? peRange : null;
      if (!r) { r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); }
      sel.removeAllRanges(); sel.addRange(r);
    }
    try { document.execCommand('bold', false, null); } catch (e) { /* 지원하지 않는 브라우저 */ }
    peTouch();
    peBoldState();
  }

  function bindPad() {
    var side = $('#pad .pad-side');
    side.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-toggle]'))) { padOpenSet(b.dataset.toggle, !padIsOpen(b.dataset.toggle)); renderPadSide(); return; }
      if ((b = e.target.closest('[data-folder]'))) { padSelect({ kind: 'folder', id: b.dataset.folder }); return; }
      if ((b = e.target.closest('[data-pad]'))) { padSelect({ kind: b.dataset.pad, id: '' }); return; }
    });
    $('#padAddFolder').addEventListener('click', function () { padFolderSheet('new', ''); });
    $('#padListWrap').addEventListener('click', function (e) {
      var b;
      if (!e.target.closest('#padMenu') && !e.target.closest('#padMore')) padMenu(false);
      if ((b = e.target.closest('[data-pact]'))) { padMenuAct(b.dataset.pact); return; }
      if ((b = e.target.closest('[data-note]'))) { padOpenNote(b.dataset.note); return; }
      if ((b = e.target.closest('[data-folder]'))) { padSelect({ kind: 'folder', id: b.dataset.folder }); return; }
      if ((b = e.target.closest('#padCrumb [data-pad]'))) { padSelect({ kind: 'all', id: '' }); return; }
    });
    $('#padBack').addEventListener('click', padBackBtn);
    $('#padMore').addEventListener('click', function () { padMenu($('#padMenu').hidden); });
    $('#padLayout').addEventListener('click', function () {
      S.padLayout = S.padLayout === 'list' ? 'grid' : 'list'; writePref('padLayout', S.padLayout); renderPadList();
    });
    $('#padSort').addEventListener('change', function (e) {
      S.padSort = PAD_SORT_KEYS.indexOf(e.target.value) >= 0 ? e.target.value : 'updated'; writePref('padSort', S.padSort); renderPadList();
    });
    var qTimer = null;
    $('#padQ').addEventListener('input', function (e) {
      clearTimeout(qTimer);
      qTimer = setTimeout(function () { S.pad.q = e.target.value.slice(0, 100); renderPadList(); }, 150);
    });
    $('#padSearch').addEventListener('submit', function (e) {
      e.preventDefault(); clearTimeout(qTimer); S.pad.q = $('#padQ').value.slice(0, 100); renderPadList();
      try { $('#padQ').blur(); } catch (x) { /* 무시 */ }
    });
    $('#padEmptyTrash').addEventListener('click', padEmptyTrash);
    $('#padNew').addEventListener('click', padNewNote);
    // 메모 쓰기
    $('#peBack').addEventListener('click', padBackBtn);
    $('#peFolder').addEventListener('click', function () { if (PE.id) padPickOpen({ kind: 'note', id: PE.id }); });
    $('#peFav').addEventListener('click', peFav);
    $('#peDel').addEventListener('click', peTrash);
    $('#peRestore').addEventListener('click', peRestore);
    $('#peKill').addEventListener('click', peKill);
    var t = $('#peTitle'), ed = $('#peBody');
    t.addEventListener('input', peTouch);
    t.addEventListener('blur', peSave);
    t.addEventListener('keydown', function (e) {   // 제목에서 Enter → 내용으로
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); ed.focus(); }
    });
    ed.addEventListener('input', peTouch);
    ed.addEventListener('blur', peSave);
    ed.addEventListener('paste', function (e) {   // 붙여 넣을 때는 글자만
      var cd = e.clipboardData || window.clipboardData; if (!cd) return;
      e.preventDefault();
      var text = String(cd.getData('text/plain') || cd.getData('Text') || '').replace(/\r\n?/g, '\n');
      if (text) document.execCommand('insertText', false, text);
    });
    ed.addEventListener('drop', function (e) { e.preventDefault(); });
    ed.addEventListener('beforeinput', function (e) {
      var tp = e.inputType || '';
      if (/^format/.test(tp) && tp !== 'formatBold') e.preventDefault();
    });
    ed.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        var k = String(e.key || '').toLowerCase();
        if (k === 'b') { e.preventDefault(); peToggleBold(); }
        else if (k === 'i' || k === 'u') e.preventDefault();
      }
    });
    document.addEventListener('selectionchange', function () {
      var sel = window.getSelection();
      if (sel && sel.rangeCount && ed.contains(sel.anchorNode)) peRange = sel.getRangeAt(0).cloneRange();
      if (S.view === 'pad' && S.pad.open) peBoldState();
    });
    var pb = $('#peBold');
    pb.addEventListener('mousedown', function (e) { e.preventDefault(); });
    pb.addEventListener('click', peToggleBold);
    // 폴더 만들기 창
    $('#pfForm').addEventListener('submit', function (e) { e.preventDefault(); pfSubmit(); });
    $('#pfColors').addEventListener('click', function (e) {
      var b = e.target.closest('[data-color]');
      if (!b || !PF) return;
      PF.color = b.dataset.color; renderPfColors();
    });
    // 옮길 곳 고르기 창
    $('#ppList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-dest]');
      if (b && !b.disabled) padMoveTo(b.dataset.dest);
    });
    document.addEventListener('click', function (e) {
      if (!$('#padMenu').hidden && !e.target.closest('#padMenu') && !e.target.closest('#padMore')) padMenu(false);
    });
    window.addEventListener('popstate', padOnPop);
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

  /* 순서: A → B → C, 같은 글자 안에서는 정해 둔 순서(ord). 완료(✓)한 일은 같은 글자 안에서 늘 맨 아래 (v1.9부터)
     진행 중(●)으로 바꾸면 그때 한 번 맨 위로 옮기고(statusPatch), 그 뒤에는 ▲▼로 옮긴 순서를 그대로 지킴 */
  function doneLast(t) { return t.status === 'done' ? 1 : 0; }
  function sortTasks(list) {
    return list.slice().sort(function (a, b) {
      return (PRI_ORDER[a.pri] - PRI_ORDER[b.pri]) || (doneLast(a) - doneLast(b)) || ((a.ord || 0) - (b.ord || 0)) || ((a.created || 0) - (b.created || 0));
    });
  }
  /* ▲▼로 순서를 바꿀 수 있는 무리: 같은 글자이면서 완료하지 않은 일끼리 / 완료한 일끼리 */
  function moveGroup(sorted, t) {
    return sorted.filter(function (x) { return x.pri === t.pri && doneLast(x) === doneLast(t); });
  }
  /* 같은 글자에서 맨 위가 되는 순서 값 (완료하지 않은 일 가운데 맨 앞보다 앞).
     그날 할 일 목록을 불러온 날짜면 실제 목록으로 계산하고, 아니면 지금 시각을 음수로 써서 맨 위에 둠 */
  function topOrd(t, pri) {
    pri = pri || t.pri;
    if (t.date !== S.date) return -Date.now();
    var min = null;
    S.tasks.forEach(function (x) {
      if (x.id === t.id || x.pri !== pri || x.status === 'done') return;
      var o = x.ord || 0;
      if (min === null || o < min) min = o;
    });
    var own = typeof t.ord === 'number' && pri === t.pri ? t.ord : null;
    if (min === null) return own === null ? -Date.now() : own;
    return own !== null && own < min ? own : min - 1;
  }
  /* 상태를 바꿀 때 순서도 함께 바꿈 (v1.9부터)
     · 진행 중(●)으로: 같은 글자 안에서 맨 위로 (그 뒤에는 ▲▼로 마음대로 옮길 수 있음)
     · 완료(✓)로: 같은 글자 안에서 맨 아래로. 원래 자리(ordPrev)는 기억해 두었다가 완료를 풀면 그 자리로 돌아감 */
  function statusPatch(t, st) {
    var from = t.status || 'open', p = {};
    if (st === from) return p;
    if (st === 'prog') { p.ord = topOrd(t); p.progAt = Date.now(); }
    else if (from === 'prog') p.progAt = null;
    if (st === 'done') {
      p.ordPrev = typeof t.ord === 'number' ? t.ord : 0;
      p.ord = Date.now();
    } else if (from === 'done') {
      if (st !== 'prog' && typeof t.ordPrev === 'number') p.ord = t.ordPrev;
      p.ordPrev = null;
    }
    return p;
  }
  /* v1.8에서 진행 중으로 바꾼 일(그때는 늘 맨 위에 보였음)은 한 번만 맨 위로 옮기고 표시해 둠.
     그 뒤로는 ▲▼로 옮긴 순서를 그대로 지킴 (다른 기기에서 같이 고쳐도 결과가 같음) */
  var progFixing = {};
  /* 예전 버전(v1.8 이하)에서 진행 중으로 바꾸고 아직 맨 위로 옮겨 두지 않은 일 */
  function legacyProg(t) { return t.status === 'prog' && !t.progAt ? 1 : 0; }
  function migrateLegacyProg() {
    if (!S.store || !S.dayLoaded) return;
    var ops = [], now = Date.now();
    Object.keys(PRI_ORDER).forEach(function (p) {
      var group = sortTasks(S.tasks.filter(function (x) { return x.pri === p && x.status !== 'done'; }));
      var legacy = group.filter(function (x) { return legacyProg(x) && !progFixing[x.id]; });
      if (!legacy.length) return;
      var min = group[0].ord || 0;
      legacy.forEach(function (x, k) {
        progFixing[x.id] = true;
        ops.push({ type: 'update', id: x.id, patch: { ord: min - (legacy.length - k), progAt: now } });
      });
    });
    if (ops.length) S.store.commit(ops);
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

  /* 할 일 아래 작은 글씨: 맡긴 사람만. 진행 중은 ● 표시로만,
     다른 날에서 옮겨 온 일은 내용만 보여 줌(어느 날에서 옮겨 왔는지·몇 번째인지는 표시하지 않음, v1.8부터) */
  function taskRow(t, label) {
    var st = t.status || 'open', meta = [];
    if (st === 'deleg') meta.push(esc(t.who || '누군가') + '에게 맡김');
    return '<li class="task st-' + st + ' pri-' + esc(t.pri) + (t.bold ? ' em' : '') + '" data-id="' + esc(t.id) + '">' +
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

  /* 일정 줄: 줄마다 작은 form이라서 Enter(휴대폰은 '완료')를 누르면 바로 저장됨 (한글 조합 중 Enter도 브라우저가 알아서 처리)
     종일 칸에는 '기간' 단추(며칠 동안 이어지는 일정)와 '가' 단추(글자 색·테두리 색·진하게)가 있음.
     일정을 적으면 '정보' 단추(시간·장소·메모)가 생기고, 적어 둔 정보는 내용 아래 작은 글씨 줄로 보임(누르면 정보 창) */
  var INFO_BTN_LABEL = ' 정보 (시간 · 장소 · 메모)';
  function infoBtnsHtml(k, name) {
    return '<button type="button" class="inf" data-inf="' + k + '" aria-label="' + name + INFO_BTN_LABEL + '" title="정보 — 시간 · 장소 · 메모" hidden>정보</button>';
  }
  function schedRowHtml(h, i) {
    var ad = isAllDay(h), name = ad ? '종일 일정' + (i ? ' ' + (i + 1) : '') : (+h) + '시 일정';
    var ph = ad ? (i ? '종일 일정 하나 더' : '예: 휴가, 출장, 생일') : '';
    return '<form class="sched-row' + (ad ? ' ad' : '') + '" data-h="' + h + '" autocomplete="off"' + (ad && i ? ' hidden' : '') + '>' +
      '<div class="hh">' + (ad ? '종일' : (+h) + '<small>시</small>') + '</div>' +
      '<input type="text" data-h="' + h + '" aria-label="' + name + '" maxlength="200" enterkeyhint="done" autocomplete="off"' + (ph ? ' placeholder="' + ph + '"' : '') + '>' +
      (ad ? '<button type="button" class="per" data-per="' + h + '" aria-label="' + name + ' 기간 정하기 (며칠 동안 이어지는 일정)" title="기간 — 며칠 동안 이어지는 일정" hidden>기간</button>' : '') +
      infoBtnsHtml(h, name) +
      '<button type="button" class="sty" data-sty="' + h + '" aria-label="' + name + (ad ? ' 글자 색 · 테두리 색 · 진하게' : ' 글자 색 · 진하게') + '" title="' + (ad ? '글자 색 · 테두리 색 · 진하게' : '글자 색 · 진하게') + '" hidden><span>가</span></button>' +
      '<button type="button" class="inf-sum" data-inf="' + h + '" hidden></button></form>';
  }
  /* 일정 아래 작은 글씨 줄: [시계] 10:30~11:30 [핀] 본사 3층 [메모] 첫 줄 */
  var INFO_ICONS = {
    t: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.1"/><path d="M8 4.7V8l2.2 1.4"/></svg>',
    l: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14.4s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0c0 3.3 4.5 7.5 4.5 7.5z"/><circle cx="8" cy="6.9" r="1.6"/></svg>',
    m: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.6 2.4h8.8v11.2H3.6z"/><path d="M5.8 5.6h4.4M5.8 8h4.4M5.8 10.4h2.6"/></svg>'
  };
  function memoFirst(s) { var l = String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); return l.length ? l[0] : ''; }
  function infoSumHtml(i) {
    var out = '', t = timeText(i), l = i.loc.trim(), m = memoFirst(i.memo);
    if (t) out += '<span class="is-t">' + INFO_ICONS.t + '<em>' + t + '</em></span>';
    if (l) out += '<span class="is-l">' + INFO_ICONS.l + '<em>' + esc(l) + '</em></span>';
    if (m) out += '<span class="is-m">' + INFO_ICONS.m + '<em>' + esc(m) + '</em></span>';
    return out;
  }
  function infoSumLabel(i) {
    var a = [], t = timeText(i);
    if (t) a.push('시간 ' + t);
    if (i.loc.trim()) a.push('장소 ' + i.loc.trim());
    if (i.memo.trim()) a.push('메모 있음');
    return '일정 정보: ' + a.join(', ') + ' (눌러서 보기·고치기)';
  }
  function buildSchedRows() {
    $('#schedList').innerHTML = '<div class="ad-block" role="group" aria-label="종일 일정"><div id="adSpans" class="ad-spans"></div>' + ALLDAY.map(schedRowHtml).join('') + '</div>' +
      HOURS.map(function (h) { return schedRowHtml(h, 0); }).join('');
  }
  /* 일정 줄 이름: 시간·종일 칸은 '09'·'a1'처럼, 여러 날 종일 일정은 's:' + 일정 번호 */
  function isSpanKey(k) { return typeof k === 'string' && k.indexOf('s:') === 0; }
  function rowKey(row) { return row.dataset.span ? 's:' + row.dataset.span : row.dataset.h; }
  function rowOf(k) {
    if (!k) return null;
    return isSpanKey(k) ? $('#schedList .sched-row[data-span="' + k.slice(2) + '"]') : $('#schedList .sched-row[data-h="' + k + '"]');
  }
  function isAllDayKey(k) { return isSpanKey(k) || isAllDay(k); }
  function styleOfKey(k) {
    if (isSpanKey(k)) { var sp = spanById(k.slice(2)); return sp ? { c: sp.c, b: sp.b, bc: sp.bc, bs: sp.bs, bw: sp.bw } : { c: '', b: false, bc: '', bs: '', bw: '' }; }
    return styleOf(S.day && S.day.schedStyle, k);
  }

  /* 일정 글자 꾸미기 창: 고른 줄 바로 아래에 펼쳐짐 (종일 일정은 테두리 색도 고름) */
  var schedToolsH = null;
  function buildSchedTools() {
    var el = document.createElement('div');
    el.id = 'schedTools'; el.className = 'sched-tools'; el.hidden = true;
    el.setAttribute('role', 'group'); el.setAttribute('aria-label', '일정 글자 꾸미기');
    el.innerHTML = '<div class="st-head"><b id="schedToolsTitle"></b> <span id="schedToolsWhat">글자 색 · 진하게</span><small id="schedToolsNote">월간 달력에도 같은 모양으로 나옵니다</small></div>' +
      '<div class="st-lbl" id="stTextLbl" hidden>글자 색</div>' +
      '<div class="swatches">' + SCHED_COLORS.map(function (c) {
        return '<button type="button" class="sw" data-c="' + c.id + '" style="--c:' + (c.hex || 'var(--ink)') + '" aria-label="글자 ' + c.name + '" title="' + c.name + '" aria-pressed="false"><i></i><span>' + c.name + '</span></button>';
      }).join('') + '</div>' +
      '<div id="stBorder" class="st-border" hidden><div class="st-lbl">테두리 색<small>월간 달력에서 종일 일정을 두르는 선</small></div>' +
      '<div class="swatches">' + BORDER_COLORS.map(function (c) {
        return '<button type="button" class="sw bsw" data-bc="' + c.id + '" style="--c:' + (c.hex || 'var(--green)') + '" aria-label="테두리 ' + c.name + '" title="' + (c.id ? c.name : '기본 (글자 색 또는 플래너 색)') + '" aria-pressed="false"><i></i><span>' + c.name + '</span></button>';
      }).join('') + '</div>' +
      '<div class="st-lbl">테두리 모양<small>선 모양과 굵기</small></div><div class="lsw-row">' +
      '<span class="lsw-grp" role="group" aria-label="선 모양">' + BORDER_STYLES.map(function (s) {
        return '<button type="button" class="lsw" data-bs="' + s.id + '" style="--ls:' + s.css + '" aria-label="선 모양 ' + s.name + '" aria-pressed="false"><i></i><span>' + s.name + '</span></button>';
      }).join('') + '</span>' +
      '<span class="lsw-grp" role="group" aria-label="선 굵기">' + BORDER_WIDTHS.map(function (w) {
        return '<button type="button" class="lsw" data-bw="' + w.id + '" aria-label="선 굵기 ' + w.name + '" aria-pressed="false"><i></i><span>' + w.name + '</span></button>';
      }).join('') + '</span></div></div>' +
      '<div class="st-foot"><button type="button" class="fmt-b" id="schedBold" aria-pressed="false"><b>B</b> 진하게</button>' +
      '<button type="button" class="btn small st-close">닫기</button></div>';
    document.body.appendChild(el);
  }
  function openSchedTools(k) {
    var row = rowOf(k), tools = $('#schedTools');
    if (!row || !tools) return;
    if (schedToolsH === k && !tools.hidden) { closeSchedTools(); return; }
    closeRange();
    schedToolsH = k;
    row.parentNode.insertBefore(tools, row.nextSibling);
    tools.hidden = false;
    renderSchedTools();
  }
  function closeSchedTools() {
    schedToolsH = null;
    var tools = $('#schedTools');
    if (tools) tools.hidden = true;
    $$('#schedList .sty.open').forEach(function (b) { b.classList.remove('open'); });
  }
  function renderSchedTools() {
    if (!schedToolsH) return;
    var k = schedToolsH, st = styleOfKey(k), ad = isAllDayKey(k);
    $('#schedToolsTitle').textContent = isSpanKey(k) ? '종일 일정' : schedLabel(k) + ' 일정';
    $('#schedToolsWhat').textContent = ad ? '글자 색 · 테두리 · 진하게' : '글자 색 · 진하게';
    $('#schedToolsNote').textContent = ad ? '월간 달력에는 테두리만 있는 띠로 나옵니다' : '월간 달력에도 같은 모양으로 나옵니다';
    $('#stTextLbl').hidden = !ad;
    $('#stBorder').hidden = !ad;
    $$('#schedTools .sw[data-c]').forEach(function (b) {
      var on = b.dataset.c === st.c;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $$('#schedTools .bsw').forEach(function (b) {
      var on = b.dataset.bc === st.bc;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var defB = $('#schedTools .bsw[data-bc=""]');   // '기본' 테두리는 지금 글자 색(없으면 플래너 색)으로 보여 줌
    if (defB) defB.style.setProperty('--c', colorHex(st.c) || 'var(--green)');
    // 테두리 모양: 미리 보기 선은 지금 고른 테두리 색 · 모양 · 굵기로
    var tools = $('#schedTools');
    tools.style.setProperty('--lc', borderHex(st.bc) || colorHex(st.c) || 'var(--green)');
    tools.style.setProperty('--lscur', st.bs || 'solid');
    tools.style.setProperty('--lwcur', st.bw === 'thin' ? '1px' : '2px');
    $$('#schedTools .lsw').forEach(function (b) {
      var on = 'bs' in b.dataset ? b.dataset.bs === st.bs : b.dataset.bw === st.bw;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var bb = $('#schedBold');
    bb.classList.toggle('on', st.b); bb.setAttribute('aria-pressed', st.b ? 'true' : 'false');
    $$('#schedList .sty').forEach(function (b) { b.classList.toggle('open', b.dataset.sty === schedToolsH); });
  }
  function paintSchedRow(row, st, info) {
    var input = $('input', row), btn = $('.sty', row), per = $('.per', row), hex = colorHex(st.c), k = rowKey(row);
    input.style.color = hex;
    input.style.fontWeight = st.b ? '700' : '';
    btn.style.setProperty('--c', hex || 'var(--ink-4)');
    btn.classList.toggle('is-set', !!hex);
    btn.classList.toggle('is-b', st.b);
    if (row.classList.contains('ad')) {   // '가' 둘레 = 월간 달력의 테두리 (색 · 모양 · 굵기)
      btn.style.setProperty('--bc', borderHex(st.bc) || hex || 'var(--green)');
      btn.style.setProperty('--bs', st.bs || 'solid');
      btn.style.setProperty('--bw', st.bw === 'thin' ? '1px' : '2px');
    }
    var show = !!input.value.trim() || schedToolsH === k || rangeKey === k;
    btn.hidden = !show;
    if (per) { per.hidden = !show; per.classList.toggle('open', rangeKey === k); }
    row.classList.toggle('bare', !show);   // 빈 종일 칸: 단추 자리까지 입력 칸으로 (예시 글이 잘리지 않게)
    paintInfoRow(row, info || blankInfo());
  }
  /* '정보' 단추(적어 둔 정보가 있으면 색이 들어감)와 내용 아래 요약 줄 */
  function paintInfoRow(row, info) {
    var input = $('input', row), inf = $('.inf', row), sum = $('.inf-sum', row), sty = $('.sty', row), has = infoHas(info);
    if (inf) {
      inf.hidden = sty.hidden;
      inf.classList.toggle('has', has);
    }
    if (!sum) return;
    var on = has && !!input.value.trim();   // 글이 있는 일정에만
    if (on) {
      var html = infoSumHtml(info);
      if (sum._html !== html) { sum.innerHTML = html; sum._html = html; }
      sum.setAttribute('aria-label', infoSumLabel(info));
    }
    sum.hidden = !on;
    row.classList.toggle('has-sum', on);
  }
  function setSchedStyle(k, patch) {
    if (!S.store || !k) return;
    var cur = styleOfKey(k), next = {
      c: 'c' in patch ? patch.c : cur.c, b: 'b' in patch ? !!patch.b : cur.b, bc: 'bc' in patch ? patch.bc : cur.bc,
      bs: 'bs' in patch ? okBs(patch.bs) : cur.bs, bw: 'bw' in patch ? okBw(patch.bw) : cur.bw
    };
    if (isSpanKey(k)) {
      var sp = spanById(k.slice(2)); if (!sp) return;
      flushSpans();
      sp.c = next.c; sp.b = next.b; sp.bc = next.bc; sp.bs = next.bs; sp.bw = next.bw;   // 화면에 바로 반영
      spanEdit(sp.id, { c: next.c, b: next.b, bc: next.bc, bs: next.bs, bw: next.bw, updated: Date.now() });
      renderSched(); renderMiniCal();
      return;
    }
    flushSched();   // 적고 있던 글자를 먼저 저장
    var map = {};
    map[k] = isAllDay(k) ? next : { c: next.c, b: next.b };
    S.day = S.day || {};
    S.day.schedStyle = Object.assign({}, S.day.schedStyle || {}, map);   // 화면에 바로 반영
    S.store.setDay(S.date, { schedStyle: map });
    renderSched();
  }

  /* ───── 종일 일정 기간 (예: 11월 6일 ~ 11월 8일) ─────
     하루짜리 종일 칸(a1~a3)에서 기간을 정하면 '여러 날 종일 일정'으로 옮겨 저장하고, 그 기간의 모든 날짜에 나옴 */
  var rangeKey = null;
  function buildRangeTools() {
    var el = document.createElement('div');
    el.id = 'adRange'; el.className = 'sched-tools ad-range'; el.hidden = true;
    el.setAttribute('role', 'group'); el.setAttribute('aria-label', '종일 일정 기간');
    el.innerHTML = '<div class="st-head"><b id="adRangeTitle">종일 일정</b> 기간<small>며칠 동안 이어지는 일정은 끝나는 날을 고르세요. 월간 달력에 이어진 띠로 나옵니다.</small></div>' +
      '<div class="ar-row"><label class="ar-l" for="adStart">시작</label><input type="date" id="adStart" class="date-in" aria-label="시작하는 날">' +
      '<label class="ar-l" for="adEnd">끝</label><input type="date" id="adEnd" class="date-in" aria-label="끝나는 날"></div>' +
      '<div class="st-foot"><span id="adDays" class="ar-days" aria-live="polite"></span><span class="ar-btns">' +
      '<button type="button" class="btn small" id="adOneDay">하루만</button><button type="button" class="btn small ar-close">닫기</button></span></div>';
    document.body.appendChild(el);
  }
  function rangeOf(k) {
    if (isSpanKey(k)) { var sp = spanById(k.slice(2)); return sp ? { s: sp.s, e: sp.e } : null; }
    return isAllDay(k) ? { s: S.date, e: S.date } : null;
  }
  function openRange(k) {
    if (!S.store) return;
    if (!spansOk()) { toast('기간을 정하려면 store.js 파일도 새 버전으로 올려 주세요.', 'error', null, 8000); return; }
    var row = rowOf(k), el = $('#adRange');
    if (!row || !el) return;
    if (rangeKey === k && !el.hidden) { closeRange(); return; }
    closeSchedTools();
    rangeKey = k;
    row.parentNode.insertBefore(el, row.nextSibling);
    el.hidden = false;
    renderRange(true);
    renderSched();
  }
  function closeRange() {
    clearTimeout(rangeTimer); rangePending = null;   // 저장하지 않은 날짜는 버림 (닫기 단추·Esc는 먼저 flushRange)
    if (!rangeKey) return;
    rangeKey = null;
    var el = $('#adRange');
    if (el) el.hidden = true;
    $$('#schedList .per.open').forEach(function (b) { b.classList.remove('open'); });
    $$('#schedList .sched-row').forEach(function (row) {   // 글이 없는 줄의 단추는 다시 숨김
      var input = $('input', row), per = $('.per', row), sty = $('.sty', row), inf = $('.inf', row);
      if (per && !input.value.trim()) { per.hidden = true; if (schedToolsH !== rowKey(row)) { sty.hidden = true; row.classList.add('bare'); } }
      if (inf) inf.hidden = sty.hidden;
    });
  }
  function renderRange(force) {
    if (!rangeKey) return;
    var r = rangeOf(rangeKey);
    if (!r) { closeRange(); return; }
    var a = $('#adStart'), b = $('#adEnd'), n = spanDays(r.s, r.e), pend = !!rangePending;
    if (force || (document.activeElement !== a && !pend)) a.value = r.s;
    if (force || (document.activeElement !== b && !pend)) b.value = r.e;
    b.min = r.s; b.max = addDays(r.s, SPAN_MAX - 1);
    if (force || !pend) rangeNote('');
    $('#adOneDay').hidden = n <= 1;
  }
  /* 기간 창 아래 줄: 평소에는 '3일 동안 · 11월 6일 ~ 11월 8일', 날짜가 맞지 않으면 그 까닭(빨간 글씨) */
  function rangeNote(msg) {
    var el = $('#adDays'), r = rangeKey && rangeOf(rangeKey);
    el.classList.toggle('warn', !!msg);
    if (msg) { el.textContent = msg; return; }
    if (r) { var n = spanDays(r.s, r.e); el.textContent = (n > 1 ? n + '일 동안 · ' : '하루 · ') + rangeLong(r.s, r.e); }
  }
  /* 날짜 칸에 지금 들어 있는 값으로 새 기간을 정함: 시작을 바꾸면 끝은 그대로(시작보다 앞이면 시작과 같게),
     끝은 시작과 같거나 그 뒤. 맞지 않으면 { err: 까닭 } */
  function rangeFromInputs(which) {
    var r = rangeKey && rangeOf(rangeKey);
    if (!r) return null;
    var v = (which === 'start' ? $('#adStart') : $('#adEnd')).value, s = r.s, e = r.e, y = +String(v).slice(0, 4);
    if (!DATE_RE.test(v) || y < 1900 || y > 2200) return { err: '날짜를 끝까지 골라 주세요.' };
    if (which === 'start') { s = v; if (e < s) e = s; }
    else { if (v < s) return { err: '끝나는 날은 시작하는 날과 같거나 그 뒤여야 합니다.' }; e = v; }
    if (spanDays(s, e) > SPAN_MAX) return { err: '기간은 최대 ' + SPAN_MAX + '일까지 정할 수 있습니다.' };
    return { s: s, e: e };
  }
  /* 날짜를 고르면 잠깐(0.6초) 뒤 저장 — PC에서 키보드로 날짜를 치는 동안(2 → 20 → 202 → 2026)에는 저장하지 않음.
     칸을 떠나거나 Enter·닫기를 누르면 바로 저장(맞지 않는 날짜면 원래대로 되돌리고 까닭을 알림) */
  var rangeTimer = null, rangePending = null;
  function onRangeInput(which) {
    if (!rangeKey) return;
    rangePending = { k: rangeKey, which: which };
    var res = rangeFromInputs(which);
    rangeNote(res && res.err ? res.err : '');
    clearTimeout(rangeTimer);
    if (res && !res.err) rangeTimer = setTimeout(flushRange, 600);
  }
  function flushRange(loud) {
    clearTimeout(rangeTimer);
    var p = rangePending; rangePending = null;
    if (!p || p.k !== rangeKey) return;
    var res = rangeFromInputs(p.which);
    if (!res) return;
    if (res.err) { renderRange(true); if (loud) toast(res.err); return; }
    setRange(p.k, res.s, res.e);
  }
  function setRange(k, s, e) {
    if (spanDays(s, e) > SPAN_MAX) { toast('기간은 최대 ' + SPAN_MAX + '일까지 정할 수 있습니다.'); renderRange(true); return; }
    var r = rangeOf(k);
    if (!r || (r.s === s && r.e === e)) { renderRange(true); return; }
    if (isSpanKey(k)) {
      var sp = spanById(k.slice(2)); if (!sp) { closeRange(); return; }
      flushSpans();
      sp.s = s; sp.e = e;   // 화면에 바로 반영
      S.spans.sort(spanOrder);
      spanEdit(sp.id, { s: s, e: e, updated: Date.now() });
    } else {
      k = slotToSpan(k, s, e);
      if (!k) { renderRange(true); return; }
      rangeKey = k;
    }
    if (s <= S.date && S.date <= e) {
      renderSched(); renderRange(true);
    } else {   // 이 날짜가 기간에서 빠지면 창을 닫고 알림
      closeRange();
      renderSched();
      toast('기간을 ' + rangeLong(s, e) + '로 바꿨습니다. 이 날짜에는 이제 나오지 않습니다.', null, { label: '그날 보기', fn: function () { setDate(s); setTab('sched'); } }, 7000);
    }
    renderMiniCal();
  }
  /* 하루짜리 종일 칸 → 여러 날 종일 일정 (한 번에 저장: 칸은 비우고 기간 일정을 새로 만듦) */
  function slotToSpan(h, s, e) {
    var input = $('#schedList input[data-h="' + h + '"]'), text = input ? input.value.trim() : '';
    if (!text) { toast('먼저 일정 내용을 적어 주세요.'); return null; }
    flushSched();
    var st = styleOf(S.day && S.day.schedStyle, h), inf = infoOf(S.day && S.day.schedInfo, h), id = S.store.newSpanId(), now = Date.now();
    var data = { s: s, e: e, t: text, c: st.c, b: st.b, bc: st.bc, bs: st.bs, bw: st.bw, created: now, updated: now };
    if (infoHas(inf)) { data.ts = inf.ts; data.te = inf.te; data.loc = inf.loc; data.memo = inf.memo; }   // 시간·장소·메모도 함께 옮김
    var clr = { sched: {}, schedStyle: {}, schedInfo: {} };
    clr.sched[h] = ''; clr.schedStyle[h] = blankStyle(h); clr.schedInfo[h] = blankInfo();
    patchLocalDay(S.date, clr);   // 화면에 바로 반영
    if (input) input.value = '';
    S.spans = S.spans.concat([Object.assign({ id: id }, data)]).sort(spanOrder);
    S.store.commit([{ type: 'day', date: S.date, data: clr }, { type: 'span', id: id, data: data }]);
    return 's:' + id;
  }
  /* 날짜 표시: '11월 6일 ~ 11월 8일' (올해가 아니면 연도도) · 짧게 '11.6(금) ~ 11.8(일)' */
  function dateLong(ds, withYear) { var d = parse(ds); return (withYear ? d.getFullYear() + '년 ' : '') + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }
  function rangeLong(s, e) {
    var y0 = S.date.slice(0, 4), wy = s.slice(0, 4) !== y0 || e.slice(0, 4) !== y0;
    return s === e ? dateLong(s, wy) : dateLong(s, wy) + ' ~ ' + dateLong(e, wy && e.slice(0, 4) !== s.slice(0, 4));
  }
  function dateShort(ds, withYear) { var d = parse(ds); return (withYear ? d.getFullYear() + '.' : '') + (d.getMonth() + 1) + '.' + d.getDate() + '(' + WD[d.getDay()] + ')'; }
  function rangeShort(s, e) {
    var wy = s.slice(0, 4) !== e.slice(0, 4);
    return s === e ? dateShort(s) : dateShort(s, wy) + ' ~ ' + dateShort(e, wy);
  }

  /* 여러 날 종일 일정 줄 (그 기간의 어느 날짜에서든 글자·기간·색을 고칠 수 있음) */
  function spanRowEl(id) {
    var f = document.createElement('form');
    f.className = 'sched-row ad span'; f.dataset.span = id; f.setAttribute('autocomplete', 'off');
    f.innerHTML = '<div class="hh">종일</div><input type="text" data-span="' + id + '" maxlength="200" enterkeyhint="done" autocomplete="off">' +
      '<button type="button" class="per" data-per="s:' + id + '" title="기간 바꾸기">기간</button>' +
      infoBtnsHtml('s:' + id, '종일 일정') +
      '<button type="button" class="sty" data-sty="s:' + id + '" aria-label="종일 일정 글자 색 · 테두리 색 · 진하게" title="글자 색 · 테두리 색 · 진하게"><span>가</span></button>' +
      '<span class="ad-cap"></span><button type="button" class="inf-sum" data-inf="s:' + id + '" hidden></button>';
    return f;
  }
  function renderSpanRows() {
    var box = $('#adSpans'); if (!box) return 0;
    var list = spansOn(S.date), want = {}, have = {};
    list.forEach(function (sp) { want[sp.id] = true; });
    $$('.sched-row', box).forEach(function (r) { if (want[r.dataset.span]) have[r.dataset.span] = r; else r.remove(); });
    list.forEach(function (sp, i) {
      var row = have[sp.id] || spanRowEl(sp.id), cur = $$('.sched-row', box)[i];
      if (cur !== row) { if (cur) box.insertBefore(row, cur); else box.appendChild(row); }
      var input = $('input', row), n = spanDays(sp.s, sp.e), k = spanDays(sp.s, S.date);
      if (document.activeElement !== input && !spanPending.has(sp.id)) input.value = sp.t;
      $('.ad-cap', row).textContent = rangeShort(sp.s, sp.e) + ' · ' + (n > 1 ? n + '일' + (k > 1 ? ' 중 ' + k + '일째' : '') : '하루');
      input.setAttribute('aria-label', '종일 일정, ' + rangeLong(sp.s, sp.e));
      $('.per', row).setAttribute('aria-label', '기간 바꾸기 (지금 ' + rangeLong(sp.s, sp.e) + ')');
      paintSchedRow(row, { c: sp.c, b: sp.b, bc: sp.bc, bs: sp.bs, bw: sp.bw }, infoClean(sp));
    });
    return list.length;
  }
  /* 꾸미기·기간 창이 그 줄 바로 아래에 있도록 (줄 순서가 바뀌었거나 줄이 없어졌을 때) */
  function placeTools() {
    [['#schedTools', schedToolsH, closeSchedTools], ['#adRange', rangeKey, closeRange]].forEach(function (p) {
      var el = $(p[0]), k = p[1]; if (!el || el.hidden || !k) return;
      var row = rowOf(k);
      if (!row || row.hidden) { p[2](); return; }
      if (row.nextElementSibling !== el) row.parentNode.insertBefore(el, row.nextSibling);
    });
  }

  function renderSched() {
    var sched = (S.day && S.day.sched) || {}, style = (S.day && S.day.schedStyle) || {}, info = (S.day && S.day.schedInfo) || {};
    var nowH = pad(new Date().getHours()), isToday = S.date === today(), n = 0;
    $$('#schedList .sched-row[data-h]').forEach(function (row) {
      var h = row.dataset.h, input = $('input', row), key = S.date + '|' + h;
      row.classList.toggle('now', isToday && h === nowH);
      if (document.activeElement !== input && !schedPending.has(key)) input.value = sched[h] || '';
      paintSchedRow(row, styleOf(style, h), infoOf(info, h));
      if ((sched[h] || '').trim()) n++;
    });
    n += renderSpanRows();
    $('#cntSched').textContent = n ? String(n) : '';
    showAllDayRows();
    placeTools();
    renderSchedTools();
    renderRange();
  }

  /* 종일 칸: 첫 칸은 늘 보이고, 위 칸에 글이 있으면 아래에 빈 칸이 하나 더 보임 (3개까지) */
  function showAllDayRows() {
    var prevHas = false;
    ALLDAY.forEach(function (h, i) {
      var row = $('#schedList .sched-row[data-h="' + h + '"]'); if (!row) return;
      var input = $('input', row), has = !!input.value.trim();
      var show = i === 0 || has || prevHas || document.activeElement === input || schedToolsH === h || rangeKey === h;
      if (row.hidden === show) row.hidden = !show;
      prevHas = has;
    });
  }
  /* 가운데 종일 칸을 비우면 아래 칸들을 위로 당겨 빈칸이 끼지 않게 함 (종일 칸에서 손을 뗀 뒤에만.
     force = 지금 바로 — 종일 일정의 '정보' 단추를 눌렀을 때). 시간·장소·메모도 일정과 함께 옮김 */
  function compactAllDay(date, force) {
    if (!S.store || date !== S.date || !S.dayLoaded) return;
    var ae = document.activeElement;
    if (!force && ae && ae.closest && ae.closest('#schedList .ad-block')) return;   // 아직 종일 칸에 적는 중
    var t = infoTarget();
    if (t && t.date === date && isAllDay(t.key)) return;   // 정보 창에서 이 날의 종일 일정을 보는 중(창을 닫으면 정리)
    var style = (S.day && S.day.schedStyle) || {}, info = (S.day && S.day.schedInfo) || {}, items = [], gap = false;
    ALLDAY.forEach(function (h) {
      var input = $('#schedList input[data-h="' + h + '"]'), v = input ? input.value : '';
      if (v.trim()) { if (gap) gap = 'move'; items.push({ text: v, st: styleOf(style, h), inf: infoOf(info, h) }); }
      else if (!gap) gap = true;
    });
    if (gap !== 'move') return;
    flushSched();
    var sched = {}, st = {}, inf = {};
    ALLDAY.forEach(function (h, i) {
      var it = items[i];
      sched[h] = it ? it.text : '';
      st[h] = it ? { c: it.st.c, b: it.st.b, bc: it.st.bc, bs: it.st.bs, bw: it.st.bw } : blankStyle(h);
      inf[h] = it ? it.inf : blankInfo();
      delete keptEmpty[date + '|' + h];
      var input = $('#schedList input[data-h="' + h + '"]');
      if (input) input.value = sched[h];
    });
    closeSchedTools();
    if (rangeKey && !isSpanKey(rangeKey)) closeRange();
    var patch = { sched: sched, schedStyle: st, schedInfo: inf };
    patchLocalDay(S.date, patch);   // 화면에 바로 반영
    S.store.setDay(S.date, patch);
    renderSched();
  }

  /* Enter(휴대폰 '완료')로 일정 한 줄을 마침: 저장하고 키보드를 닫은 뒤 잠깐 '✓ 저장' 표시 */
  function commitSchedRow(row) {
    var input = row && $('input', row); if (!input) return;
    if (row.dataset.span) flushSpans(); else flushSched();
    var has = !!input.value.trim();
    input.blur();   // 여러 날 종일 일정의 글자를 모두 지우고 Enter를 누르면, 칸을 떠날 때 지워짐(되돌리기 가능)
    if (!has) return;
    row.classList.remove('saved');
    void row.offsetWidth;   // 같은 줄에서 다시 눌러도 표시가 다시 나타나게
    row.classList.add('saved');
    clearTimeout(row._savedTimer);
    row._savedTimer = setTimeout(function () { row.classList.remove('saved'); }, 1700);
  }

  /* 메모 칸 (진하게를 쓸 수 있는 글 상자) */
  function notesLooksEmpty(ed) {
    return !ed.textContent && ed.querySelectorAll('br').length <= 1 && ed.querySelectorAll('div,p').length <= 1;
  }
  function renderNotes(force) {
    var ed = $('#notes');
    if (notesPending && notesPending.date === S.date) return;
    if (!force && document.activeElement === ed) return;
    var lines = memoLines(S.day || {}), html = rtHtml(lines);
    ed.dataset.date = S.date;
    if (force || rtHtml(rtFromDom(ed)) !== html) { ed.innerHTML = html; notesRange = null; }
    ed.classList.toggle('is-empty', notesLooksEmpty(ed));
    notesBoldState();
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

  /* 하루 일정({ 'a1': '휴가', '09': '회의', ... })을 목록으로: 종일 일정이 먼저, 그다음 시간 순서 (글자 색·진하게 포함) */
  function schedEntries(sched, style) {
    var out = [];
    if (!sched || typeof sched !== 'object') return out;
    ALLDAY.forEach(function (h) {
      var text = String(sched[h] == null ? '' : sched[h]).trim();
      if (text) { var st = styleOf(style, h); out.push({ h: h, allDay: true, label: '종일', text: text, c: st.c, b: st.b }); }
    });
    Object.keys(sched).sort().forEach(function (h) {
      var text = String(sched[h] == null ? '' : sched[h]).trim();
      if (/^\d{2}$/.test(h) && text) {
        var st = styleOf(style, h);
        out.push({ h: h, allDay: false, label: (+h) + '시', text: text, c: st.c, b: st.b });
      }
    });
    return out;
  }

  function renderMiniCal() {
    var mk = monthKey(S.date), p = mk.split('-'), y = +p[0], m = +p[1];
    var first = new Date(y, m - 1, 1).getDay(), days = lastDay(y, m), t0 = today();
    var cur = S.schedKey === mk, map = cur ? S.sched : {}, bgs = cur ? S.dayBg : {};
    var covered = coveredDays(cur ? S.spans : [], mk + '-01', mk + '-' + pad(days));   // 여러 날 종일 일정이 걸친 날
    var html = '<div class="mc-head"><span>' + y + '년 ' + m + '월</span><button data-go="month">월간 달력 ›</button></div>';
    html += '<table><thead><tr>' + WD.map(function (w) { return '<th>' + w + '</th>'; }).join('') + '</tr></thead><tbody><tr>';
    var cell = 0, i;
    for (i = 0; i < first; i++) { html += '<td></td>'; cell++; }
    for (var d = 1; d <= days; d++) {
      var ds = mk + '-' + pad(d), cls = [], bg = dayBg(bgs && bgs[ds]);
      if (schedEntries(map[ds]).length || covered[ds]) cls.push('has');
      if (ds === t0) cls.push('today');
      if (ds === S.date) cls.push('sel');
      if (bg) cls.push('bg');
      html += '<td><button data-date="' + ds + '" class="' + cls.join(' ') + '"' + (bg ? ' style="--cbg:' + bg.hex + '"' : '') + '>' + d + '</button></td>';
      cell++;
      if (cell % 7 === 0 && d < days) html += '</tr><tr>';
    }
    while (cell % 7 !== 0) { html += '<td></td>'; cell++; }
    html += '</tr></tbody></table>';
    $('#minical').innerHTML = html;
  }
  function coveredDays(spans, from, to) {
    var out = {};
    (spans || []).forEach(function (v) {
      for (var ds = v.s < from ? from : v.s, n = 0; ds <= v.e && ds <= to && n < 40; ds = addDays(ds, 1), n++) out[ds] = true;
    });
    return out;
  }

  /* 월간 달력에 그릴 종일 일정: 하루짜리(종일 칸 a1~a3)와 여러 날 종일 일정(기간을 정한 일정)
     먼저 시작하는 일정 → 더 긴 일정 → 여러 날 일정 → 칸 순서 */
  function allDayItems(map, smap, spans, from, to) {
    var out = [];
    Object.keys(map || {}).forEach(function (ds) {
      if (ds < from || ds > to || !map[ds]) return;
      ALLDAY.forEach(function (h, i) {
        var text = String(map[ds][h] == null ? '' : map[ds][h]).trim();
        if (!text) return;
        var st = styleOf(smap && smap[ds], h);
        out.push({ key: ds + '|' + h, s: ds, e: ds, text: text, c: st.c, b: st.b, bc: st.bc, bs: st.bs, bw: st.bw, rank: 1, ord: i });
      });
    });
    (spans || []).forEach(function (v) {
      if (v.e < from || v.s > to) return;
      out.push({ key: 's:' + v.id, s: v.s, e: v.e, text: v.t.trim(), c: v.c, b: v.b, bc: v.bc, bs: v.bs, bw: v.bw, rank: 0, ord: v.created || 0 });
    });
    return out.sort(function (a, b) {
      return (a.s < b.s ? -1 : a.s > b.s ? 1 : 0) || (a.e > b.e ? -1 : a.e < b.e ? 1 : 0) || (a.rank - b.rank) || (a.ord - b.ord);
    });
  }
  /* 달력 한 줄(일~토)의 종일 일정 조각: 겹치지 않게 위에서부터 줄(lane)을 나눠 줌 */
  function weekSegments(items, dates) {
    var from = null, to = null, lanes = [], segs = [];
    dates.forEach(function (ds) { if (ds) { if (!from) from = ds; to = ds; } });
    if (!from) return segs;
    items.forEach(function (it) {
      if (it.e < from || it.s > to) return;
      var c0 = dates.indexOf(it.s < from ? from : it.s), c1 = dates.indexOf(it.e > to ? to : it.e), k = 0;
      while (lanes[k] && lanes[k].some(function (g) { return !(c1 < g[0] || c0 > g[1]); })) k++;
      (lanes[k] = lanes[k] || []).push([c0, c1]);
      segs.push({ it: it, c0: c0, c1: c1, lane: k, cl: it.s < dates[c0], cr: it.e > dates[c1] });
    });
    return segs;
  }
  /* 종일 일정 띠: 칸 위에 겹쳐 그림(누르면 아래 날짜 칸이 눌림). 글자 둘레의 색은 없애고 테두리만.
     띠 안쪽은 아래 칸의 바탕색과 같은 색으로 채워 칸 사이 선만 가림 → 여러 날이 한 줄로 이어져 보임 */
  function barHtml(g, R, r, dates, bgs, accent) {
    var it = g.it, n = g.c1 - g.c0 + 1, cols = [], darkest = '#FFFFFF', x;
    for (x = g.c0; x <= g.c1; x++) {
      var b = dayBg(bgs && bgs[dates[x]]), hex = b ? b.hex : '#FFFFFF';
      cols.push(hex);
      if (lumOf(hex) < lumOf(darkest)) darkest = hex;
    }
    var same = cols.every(function (h) { return h === cols[0]; });
    var fill = same ? cols[0] : 'linear-gradient(90deg,' + cols.map(function (h, i) {
      return h + ' ' + (i * 100 / n).toFixed(3) + '% ' + ((i + 1) * 100 / n).toFixed(3) + '%';
    }).join(',') + ')';
    var tc = colorHex(it.c), bc = borderHex(it.bc) || tc || accent;
    if (tc && darkest !== '#FFFFFF') tc = readableOn(tc, darkest, 4.5);   // 색칠한 칸 위에서도 또렷하게
    if (contrastOf(bc, darkest) < 3) bc = readableOn(bc, darkest, 3);
    return '<span class="adbar' + (g.cl ? ' cl' : '') + (g.cr ? ' cr' : '') + (it.b ? ' em' : '') + (it.bs ? ' ' + it.bs : '') + (it.bw ? ' ' + it.bw : '') + '" data-r="' + r + '" data-c0="' + g.c0 + '" data-c1="' + g.c1 + '" data-lane="' + g.lane + '" data-key="' + esc(it.key) + '"' +
      ' style="grid-area:' + R + '/' + (g.c0 + 2) + '/auto/span ' + n + ';--lane:' + g.lane + ';--bc:' + bc + (tc ? ';--tc:' + tc : '') + ';background:' + fill + '" aria-hidden="true">' +
      '<span class="t">' + esc(it.text) + '</span></span>';
  }

  var mqWide = window.matchMedia ? window.matchMedia('(min-width:900px)') : null;
  function renderMonth() {
    var mk = S.monthCursor, p = mk.split('-'), y = +p[0], m = +p[1];
    $('#monthTitle').textContent = y + '년 ' + m + '월';
    var first = new Date(y, m - 1, 1).getDay(), days = lastDay(y, m), t0 = today();
    var cur = S.schedKey === mk;
    var map = cur ? S.sched : {}, smap = cur ? S.schedStyle : {}, bgs = cur ? S.dayBg : {};
    var items = allDayItems(map, smap, cur ? S.spans : [], mk + '-01', mk + '-' + pad(days)), accent = accentHex();
    var rows = Math.ceil((first + days) / 7);
    // 칸마다 자리를 정해 둠(grid-area) → 종일 일정 띠를 여러 칸에 걸쳐 겹쳐 그릴 수 있음
    var html = '<div class="wkh" style="grid-area:1/1">주차</div>' +
      WD.map(function (w, i) { return '<div class="wd ' + (i === 0 ? 'sun' : i === 6 ? 'sat' : '') + '" data-i="' + i + '" style="grid-area:1/' + (i + 2) + '">' + w + '</div>'; }).join('');
    for (var r = 0; r < rows; r++) {
      var R = r + 2, dates = [], cells = '', hasToday = false, c;
      for (c = 0; c < 7; c++) { var dd = r * 7 + c - first + 1; dates.push(dd >= 1 && dd <= days ? mk + '-' + pad(dd) : null); }
      var segs = weekSegments(items, dates), nAt = [0, 0, 0, 0, 0, 0, 0];
      segs.forEach(function (g) { for (var x = g.c0; x <= g.c1; x++) nAt[x] = Math.max(nAt[x], g.lane + 1); });
      for (c = 0; c < 7; c++) {
        var ds = dates[c];
        if (!ds) { cells += '<div class="cell blank" style="grid-area:' + R + '/' + (c + 2) + '"></div>'; continue; }
        var d = +ds.slice(8), list = schedEntries(map[ds], smap && smap[ds]).filter(function (e) { return !e.allDay; });
        var bg = dayBg(bgs && bgs[ds]);
        var cls = ['cell']; if (c === 0) cls.push('sun'); if (c === 6) cls.push('sat');
        if (ds === t0) { cls.push('today'); hasToday = true; }
        if (ds === S.date) cls.push('sel');
        if (bg) { cls.push('has-bg'); if (bg.deep) cls.push('bg-deep'); }
        var lu = c === 0 ? lunarOf(ds) : null;   // 일요일 칸 오른쪽 위 끝에 음력
        var inner = '<span class="top"><span class="dn">' + d + '</span>' +
          (lu ? '<span class="lunar" title="음력 ' + (lu.leap ? '윤' : '') + lu.m + '월 ' + lu.d + '일"><i>음 </i>' + (lu.leap ? '윤' : '') + lu.m + '.' + lu.d + '</span>' : '') + '</span>';
        if (nAt[c]) inner += '<span class="ad-space" data-n="' + nAt[c] + '" style="--n:' + nAt[c] + '"></span>';   // 종일 일정 띠 자리
        if (list.length || nAt[c]) {
          inner += '<span class="scs">' + list.map(function (e) {   // 시간 일정: 시간 순서로, 내용만 (앞에 시간은 붙이지 않음, v1.8부터)
            var hex = colorHex(e.c);
            if (hex && bg) hex = readableOn(hex, bg.hex, 4.5);   // 색칠한 칸에서도 글씨가 또렷하게
            return '<span class="sc' + (e.b ? ' em' : '') + '" data-h="' + e.h + '"' + (hex ? ' style="--sc:' + hex + '"' : '') + '>' + esc(e.text) + '</span>';
          }).join('') + '</span><span class="sc-more" hidden></span>';
        }
        var here = segs.filter(function (g) { return g.c0 <= c && c <= g.c1; }).map(function (g) {
          return g.it.text + (g.it.s !== g.it.e ? ' (' + rangeShort(g.it.s, g.it.e) + ')' : '');
        }).concat(list.map(function (e) { return e.text; }));
        cells += '<button class="' + cls.join(' ') + '" data-date="' + ds + '" data-r="' + r + '" data-c="' + c + '"' +
          ' style="grid-area:' + R + '/' + (c + 2) + (bg ? ';--cbg:' + bg.hex : '') + '"' + (bg ? ' data-bg="' + bg.id + '"' : '') +
          ' aria-label="' + m + '월 ' + d + '일' + (bg ? ', 바탕색 ' + bg.name : '') + (here.length ? ', 일정 ' + here.length + '개' : '') + '"' +
          (here.length ? ' title="' + esc(here.join('\n')) + '"' : '') + '>' + inner + '</button>';
      }
      var wn = weekOfYear(mk + '-' + pad(Math.max(1, r * 7 - first + 1)));   // 그 줄의 올해 주차
      html += '<div class="wkc' + (hasToday ? ' cur' : '') + '" style="grid-area:' + R + '/1">' + wn + '<small>주</small></div>' + cells +
        segs.map(function (g) { return barHtml(g, R, r, dates, bgs, accent); }).join('');
    }
    var grid = $('#mgrid');
    grid.innerHTML = html;
    grid.dataset.lines = String(cellLines());
    grid.classList.toggle('painting', S.painting);
    applyDowVars();
    fitMonth();
  }

  /* ───────── 날짜 바탕색 칠하기 (월간 달력) ─────────
     '바탕색' 단추 → 색을 고르고 날짜를 누르면 칠해짐. 같은 색으로 한 번 더 누르면 지워짐.
     색은 12가지 × 연하게·보통·진하게 (위 줄이 연하게, 아래 줄이 진하게) */
  function buildPaintBar() {
    var html = '';
    BG_TONES.forEach(function (t, ti) {
      html += '<span class="pb-tone">' + t.label + '</span>';
      DAY_BGS.filter(function (c) { return c.tone === ti; }).forEach(function (c) {
        html += '<button type="button" class="pbs" data-bg="' + c.id + '" style="--b:' + c.hex + '" aria-pressed="false" aria-label="' + c.name + '" title="' + c.name + '"><i></i></button>';
      });
    });
    $('#paintSwatches').innerHTML = html;
  }
  function renderPaintBar() {
    var c = S.paintColor, bg = dayBg(c);
    $$('#paintBar .pbs').forEach(function (b) {
      var on = b.dataset.bg === c;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('#paintNow').innerHTML = bg
      ? '<i style="background:' + bg.hex + '"></i>' + bg.name + '<span> — 날짜를 누르면 칠해집니다</span>'
      : '<i class="erase"></i>지우개<span> — 누른 날짜의 바탕색을 지웁니다</span>';
  }
  function openPaint() {
    if (!S.store) return;
    if (storeV() < 16) { toast('바탕색을 쓰려면 store.js 파일도 새 버전으로 올려 주세요.', 'error', null, 8000); return; }   // 바탕색은 v1.6 store.js부터
    closeDow();
    S.painting = true;
    $('#paintBar').hidden = false;
    var btn = $('#btnPaint');
    btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true');
    renderPaintBar();
    $('#mgrid').classList.add('painting');
  }
  function closePaint() {
    if (!S.painting) return;
    S.painting = false;
    $('#paintBar').hidden = true;
    var btn = $('#btnPaint');
    btn.classList.remove('on'); btn.setAttribute('aria-pressed', 'false');
    $('#mgrid').classList.remove('painting');
  }
  function paintDate(ds) {
    if (!S.store || !S.painting || S.schedKey !== monthKey(ds)) return;
    var cur = (S.dayBg && S.dayBg[ds]) || '', next = S.paintColor;
    if (next && next === cur) next = '';   // 같은 색을 한 번 더 누르면 지움
    if (next === cur) return;              // 지우개로 색 없는 날을 누른 경우
    S.dayBg = Object.assign({}, S.dayBg);  // 화면에 바로 반영
    if (next) S.dayBg[ds] = next; else delete S.dayBg[ds];
    S.store.setDay(ds, { bg: next });
    renderMonth();
    renderMiniCal();
  }

  /* ───────── 요일 칸 색 (월간 달력 맨 위 '일 월 화 …' 줄) ─────────
     '모두'를 고르면 일~토 전체가, 요일 하나를 고르면 그 요일 칸만 바뀜(v1.7부터). 고르면 바로 바뀌고,
     동기화를 설정했다면 PC·휴대폰에 함께 적용. 글씨 색은 칸마다 바탕에 맞춰 저절로(대비 4.5:1 이상)
     저장: dowColor = '모두'로 고른 색(v1.6과 같음, 주차 칸에도 씀) · dowEach = { 0(일)~6(토): 그 요일 색 } */
  var WD_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  function dowHex(v) {
    if (v === 'theme') return accentHex();
    if (isHex(v)) return v.toUpperCase();
    var d = dowById(v);
    return d ? d.hex : '';
  }
  /* 쓸 수 있는 요일 색 값이면 그 값('' = 기본), 아니면 null */
  function okDow(v) {
    if (typeof v !== 'string') return null;
    if (isHex(v)) return v.toUpperCase();
    return v === '' || v === 'theme' || dowById(v) ? v : null;
  }
  /* 요일별 색 정리. b = 요일별 색을 저장할 때의 '모두' 색 → 그 뒤에 예전 버전 앱(v1.6)이 '모두' 색만
     바꿨다면 b가 달라져 있으므로, 요일별 색은 버리고 새 '모두' 색을 따름 (마지막에 고른 색이 보이게) */
  function cleanDowEach(o, base) {
    if (!o || typeof o !== 'object') return null;
    if (typeof o.b === 'string' && okDow(o.b) !== base) return null;
    var out = {}, n = 0;
    for (var i = 0; i < 7; i++) { var v = okDow(o[i]); if (v !== null) { out[i] = v; n++; } }
    if (!n) return null;
    out.b = base;
    return out;
  }
  /* 그 요일(0 = 일 … 6 = 토)의 색: 요일마다 고른 색이 있으면 그 색, 없으면 '모두' 색 */
  function dowAt(i) { var e = S.dowEach; return e && typeof e[i] === 'string' ? e[i] : S.dowColor; }
  /* 일~토가 모두 같은 색이면 그 색, 요일마다 다르면 null */
  function dowAllSame() { var c = dowAt(0); for (var i = 1; i < 7; i++) if (dowAt(i) !== c) return null; return c; }
  function lightOn(hex, bg) {
    var c = hex, i = 0;
    while (contrastOf(c, bg) < 4.5 && i++ < 12) c = mixHex(c, '#FFFFFF', 0.25);
    return contrastOf(c, bg) >= 4.5 ? c : '#FFFFFF';
  }
  function dowVars(v) {
    var bg = dowHex(v);
    if (!bg) return null;
    var white = contrastOf('#FFFFFF', bg) >= 4.5;
    return {
      bg: bg,
      fg: white ? '#FFFFFF' : readableOn('#575247', bg, 4.5),
      sun: white ? lightOn('#FFC9C9', bg) : readableOn('#8A2B2B', bg, 4.5),
      sat: white ? lightOn('#CADFFF', bg) : readableOn('#4A5E70', bg, 4.5),
      line: white ? mixHex(bg, '#FFFFFF', 0.28) : mixHex(bg, '#000000', 0.14)
    };
  }
  /* 칸 하나에 그 색을 입힘 (글씨 색 · 칸 사이 선 색도 함께) */
  function setDowCell(el, v) {
    var x = dowVars(v);
    [['--wdbg', 'bg'], ['--wdfg', 'fg'], ['--wdsun', 'sun'], ['--wdsat', 'sat'], ['--wdline', 'line']].forEach(function (p) {
      if (x) el.style.setProperty(p[0], x[p[1]]); else el.style.removeProperty(p[0]);
    });
    el.classList.toggle('set', !!x);
  }
  function applyDowVars() {
    var grid = $('#mgrid'); if (!grid) return;
    var any = !!dowHex(S.dowColor);
    $$('.wd', grid).forEach(function (el) {
      var i = +el.dataset.i, v = dowAt(i);
      setDowCell(el, v);
      if (dowHex(v)) any = true;
      el.classList.toggle('target', !!S.dowOpen && S.dowTarget === i);   // 지금 바꾸는 요일 칸 표시
    });
    var wk = $('.wkh', grid);
    if (wk) setDowCell(wk, S.dowColor);   // 주차 칸은 '모두' 색
    grid.classList.toggle('dow-set', any);
    grid.classList.toggle('dow-pick', !!S.dowOpen);
  }
  function applyDow(base, each) {
    var b = okDow(base);
    S.dowColor = b === null ? '' : b;
    S.dowEach = cleanDowEach(each, S.dowColor);
    writePref('dowColor', S.dowColor);
    writePref('dowEach', S.dowEach ? JSON.stringify(S.dowEach) : '');
    applyDowVars();
    if (S.dowOpen) renderDowBar();
  }
  /* 지금 고른 칸('모두' 또는 요일 하나)에 색 v를 입힌 결과 */
  function dowWith(v) {
    var c = okDow(v), each = {}, i;
    if (c === null) c = '';
    if (S.dowTarget === 'all') { for (i = 0; i < 7; i++) each[i] = c; return { base: c, each: each }; }
    for (i = 0; i < 7; i++) each[i] = dowAt(i);
    each[S.dowTarget] = c;
    return { base: S.dowColor, each: each };
  }
  function previewDow(v) { var n = dowWith(v); applyDow(n.base, n.each); }   // 직접 고르는 동안 화면에만
  function chooseDow(v) {
    var n = dowWith(v);
    applyDow(n.base, n.each);
    if (S.store) S.store.setProfile({ dowColor: S.dowColor, dowEach: S.dowEach || {} });
  }
  function dowName(v) {
    if (!v) return '기본 (종이색)';
    if (v === 'theme') return '플래너 색';
    if (isHex(v)) return '직접 고른 색';
    var d = dowById(v);
    return d ? d.name : '기본 (종이색)';
  }
  function buildDowBar() {
    var sw = function (d) {
      return '<button type="button" class="pbs dws" data-dow="' + d.id + '" style="--b:' + d.hex + '" aria-pressed="false" aria-label="' + d.name + '" title="' + d.name + '"><i></i></button>';
    };
    $('#dowTargets').innerHTML = '<span class="dow-tg-l">바꿀 칸</span><div class="dow-tg-row">' +
      '<button type="button" class="dtg" data-t="all" aria-pressed="true" aria-label="모든 요일">모두</button>' +
      WD.map(function (w, i) { return '<button type="button" class="dtg" data-t="' + i + '" aria-pressed="false" aria-label="' + WD_FULL[i] + ' 칸만">' + w + '</button>'; }).join('') + '</div>';
    $('#dowSwatches').innerHTML =
      '<div class="dow-top">' +
        '<button type="button" class="dws wide" data-dow="" aria-pressed="false"><i class="def"></i><span>기본</span></button>' +
        '<button type="button" class="dws wide" data-dow="theme" aria-pressed="false"><i class="theme"></i><span>플래너 색</span></button>' +
        '<label class="dws wide custom" data-dow="custom"><i class="rainbow" id="dowCustomDot"></i><span>직접 고르기</span>' +
        '<input type="color" id="dowColorIn" value="#3a6ea5" aria-label="요일 칸 색 직접 고르기"></label>' +
      '</div>' +
      '<div class="pb-sw pb-grid"><span class="pb-tone">진한 색</span>' + DOW_COLORS.filter(function (d) { return d.id.indexOf('dk-') === 0; }).map(sw).join('') +
      '<span class="pb-tone">연한 색</span>' + DOW_COLORS.filter(function (d) { return d.id.indexOf('lt-') === 0; }).map(sw).join('') + '</div>';
  }
  function renderDowBar() {
    var t = S.dowTarget, cur = t === 'all' ? dowAllSame() : dowAt(t);   // null = 요일마다 다름
    $$('#dowTargets .dtg').forEach(function (b) {
      var on = b.dataset.t === String(t);
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (b.dataset.t === 'all') return;
      var i = +b.dataset.t, x = dowVars(dowAt(i));   // 요일 단추에 그 요일의 지금 색을 보여 줌
      b.style.setProperty('--b', x ? x.bg : 'var(--paper-2)');
      b.style.setProperty('--f', x ? (i === 0 ? x.sun : i === 6 ? x.sat : x.fg) : (i === 0 ? 'var(--wine)' : i === 6 ? 'var(--slate)' : 'var(--ink-2)'));
    });
    var custom = cur !== null && isHex(cur);
    $$('#dowSwatches .dws').forEach(function (b) {
      var on = cur !== null && (custom ? b.dataset.dow === 'custom' : b.dataset.dow === cur);
      b.classList.toggle('on', on);
      if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var dot = $('#dowCustomDot'), cin = $('#dowColorIn');
    if (dot) dot.style.background = custom ? cur : '';
    // 직접 고르기 창은 지금 그 칸의 색에서 시작 (요일을 바꿔 골라도 앞 요일의 색이 남아 있지 않게)
    if (cin && document.activeElement !== cin) cin.value = ((cur !== null && dowHex(cur)) || '#3A6EA5').toLowerCase();
    var who = t === 'all' ? '모든 요일' : WD_FULL[t], bg = cur === null ? '' : dowHex(cur);
    $('#dowNow').innerHTML = '<i style="background:' + (cur === null ? 'linear-gradient(90deg,#B3261E 50%,#2952A3 50%)' : (bg || 'var(--paper-2)')) + '"></i>' +
      who + ' · ' + esc(cur === null ? '요일마다 다름' : dowName(cur)) + '<span> — 고르면 바로 바뀝니다</span>';
    applyDowVars();
  }
  function setDowTarget(t) {
    S.dowTarget = t === 'all' ? 'all' : Math.max(0, Math.min(6, +t || 0));
    renderDowBar();
  }
  function openDow() {
    if (!S.store) return;
    closePaint();
    S.dowOpen = true; S.dowTarget = 'all';
    $('#dowBar').hidden = false;
    var btn = $('#btnDow');
    btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true');
    renderDowBar();
  }
  function closeDow() {
    if (!S.dowOpen) return;
    S.dowOpen = false;
    $('#dowBar').hidden = true;
    var btn = $('#btnDow');
    btn.classList.remove('on'); btn.setAttribute('aria-pressed', 'false');
    applyDowVars();
  }

  /* 일정 한 개가 칸에서 차지할 줄 수: 칸 크기와 상관없이 늘 한 줄 (내용이 길면 다음 줄로 넘기지 않고 잘라서 보임, v1.9부터).
     칸을 키우면 그만큼 일정이 더 많이 보임. 전체 내용은 일정을 누르면 정보 창에서 보임 */
  function cellLines() { return 1; }

  /* 칸에 다 들어가지 않는 일정은 숨기고 '+N'으로 (칸 크기·글꼴·화면 너비에 맞춰 계산)
     종일 일정 띠도 칸 높이에 들어가는 줄 수까지만 보이고, 나머지는 '+N'에 더함 */
  function fitMonth() {
    var grid = $('#mgrid');
    if (!grid || !grid.offsetWidth) return;   // 달력이 보이지 않을 때는 다음에 보일 때 계산
    var wide = !!(mqWide && mqWide.matches);
    var bars = $$('.adbar', grid), cells = $$('.cell:not(.blank)', grid);
    bars.forEach(function (b) { b.hidden = false; });
    cells.forEach(function (cell) {
      cell._adHidden = 0;
      var sp = $('.ad-space', cell);
      if (sp) { sp.hidden = false; sp.style.setProperty('--n', sp.dataset.n); }
    });
    if (bars.length && cells.length) {
      var probe = cells[0], cs = getComputedStyle(probe), more = $('.sc-more', grid);
      var gap = parseFloat(cs.rowGap) || 0, laneH = bars[0].offsetHeight + gap;
      var avail = probe.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - $('.top', probe).offsetHeight;
      var moreH = more ? parseFloat(getComputedStyle(more).fontSize) * 1.4 + gap : 16;
      var capFull = Math.floor((avail + 0.5) / laneH), capRes = Math.max(0, Math.floor((avail - moreH + 0.5) / laneH));
      var byRow = {};
      bars.forEach(function (b) { (byRow[b.dataset.r] = byRow[b.dataset.r] || []).push(b); });
      Object.keys(byRow).forEach(function (r) {
        var rb = byRow[r], need = 0;
        rb.forEach(function (b) { need = Math.max(need, +b.dataset.lane + 1); });
        if (need <= capFull) return;
        var rowCells = cells.filter(function (cl) { return cl.dataset.r === r; });
        rb.forEach(function (b) {
          if (+b.dataset.lane < capRes) return;
          b.hidden = true;
          rowCells.forEach(function (cl) { var x = +cl.dataset.c; if (x >= +b.dataset.c0 && x <= +b.dataset.c1) cl._adHidden++; });
        });
        rowCells.forEach(function (cl) {
          var sp = $('.ad-space', cl); if (!sp) return;
          var n = Math.min(+sp.dataset.n, capRes);
          if (n) sp.style.setProperty('--n', n); else sp.hidden = true;
        });
      });
    }
    cells.forEach(function (cell) {
      var box = $('.scs', cell), more = $('.sc-more', cell);
      if (!box || !more) return;
      var items = box.children, i, n = 0, adh = cell._adHidden || 0;
      for (i = 0; i < items.length; i++) items[i].hidden = false;
      more.hidden = true;
      if (!adh && box.scrollHeight <= box.clientHeight + 1) return;
      more.textContent = '+0'; more.hidden = false;   // '+N' 줄 자리를 비워 두고 다시 잼
      var lim = box.clientHeight;
      for (i = 0; i < items.length; i++) if (items[i].offsetTop + items[i].offsetHeight > lim + 1) break;
      for (var j = i; j < items.length; j++) { items[j].hidden = true; n++; }
      n += adh;
      more.textContent = '+' + n + (wide ? '개 더' : '');
      more.hidden = !n;
    });
  }

  function applyCellSize(n) {
    n = Math.min(5, Math.max(1, n || 2));
    S.cellSize = n;
    writePref('cellSize', String(n));
    $('#mgrid').dataset.size = String(n);
    $('#mgrid').dataset.lines = String(cellLines());
    $('#cellSizeLabel').textContent = CELL_SIZES[n - 1];
    $('#cellSmaller').disabled = n <= 1;
    $('#cellBigger').disabled = n >= 5;
    if (S.view === 'month') fitMonth();
  }

  function renderPendingView() {
    var t0 = today();
    var list = S.pending.filter(function (t) { return t.date < t0; })
      .sort(function (a, b) {   // 날짜별로, 그날 페이지와 같은 순서 (예전 버전에서 진행 중으로 바꾼 일은 그날 페이지를 열면 맨 위로 옮겨지므로 여기서도 위에)
        return a.date < b.date ? -1 : a.date > b.date ? 1 : (PRI_ORDER[a.pri] - PRI_ORDER[b.pri]) || (legacyProg(b) - legacyProg(a)) || ((a.ord || 0) - (b.ord || 0));
      });
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
        '<span class="ptxt' + (t.bold ? ' em' : '') + '">' + esc(t.text) + (t.status === 'prog' ? ' <small class="pdot" title="진행 중" aria-label="진행 중">●</small>' : '') + '</span>' +
        '<span class="acts"><button class="btn small primary" data-pact="today">→ 오늘로</button><button class="btn small" data-pact="done">✓</button><button class="btn small" data-pact="del">✕</button></span></div>';
    });
    html += '</div>';
    $('#pendList').innerHTML = html;
  }

  /* ───────── 메모 모아보기 ───────── */
  var memoCache = {};   // 날짜 → { notes, html, lines, text } (검색할 때마다 다시 읽지 않도록)
  function memoParsed(m) {
    var c = memoCache[m.date];
    if (!c || c.notes !== m.notes || c.html !== m.notesHtml) {
      var lines = memoLines(m);
      c = memoCache[m.date] = { notes: m.notes, html: m.notesHtml, lines: lines, text: rtText(lines) };
    }
    return c;
  }
  function renderMemos() {
    var box = $('#memoList'), q = S.memoQ.trim(), ql = q.toLowerCase(), qi = $('#memoQ');
    if (qi.value !== S.memoQ && document.activeElement !== qi) qi.value = S.memoQ;
    if (S.memos === null) { box.innerHTML = '<div class="memo-empty">불러오는 중…</div>'; $('#memoCount').textContent = ''; return; }
    var items = [];
    S.memos.forEach(function (m) {
      var pm = memoParsed(m), lines = pm.lines, text = pm.text, ranges = [];
      if (!text.trim()) return;
      if (q) {
        var low = text.toLowerCase(), i = low.indexOf(ql);
        while (i >= 0) { ranges.push([i, i + ql.length]); i = low.indexOf(ql, i + ql.length); }
        if (!ranges.length) return;
      }
      items.push({ date: m.date, lines: lines, ranges: ranges });
    });
    $('#memoCount').textContent = q ? '‘' + q + '’ 검색 결과 ' + items.length + '일' : '메모가 있는 날 ' + items.length + '일';
    if (!items.length) {
      box.innerHTML = '<div class="memo-empty">' + (q ? '‘' + esc(q) + '’ 검색 결과가 없습니다.'
        : '아직 적은 메모가 없습니다.<br>하루 페이지의 ‘메모’ 칸에 적으면 여기에 날짜별로 모입니다.') + '</div>';
      return;
    }
    var html = '', cur = '', t0 = today(), shown = items.slice(0, S.memoLimit);
    shown.forEach(function (it) {
      var mk = it.date.slice(0, 7), d = parse(it.date), w = d.getDay();
      if (mk !== cur) {
        if (cur) html += '</div>';
        cur = mk;
        html += '<div class="memo-month"><h3>' + d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월</h3>';
      }
      html += '<article class="memo-item' + (q ? '' : ' clamp') + '" data-date="' + it.date + '">' +
        '<button type="button" class="memo-date" data-open="' + it.date + '"><span class="md-d">' + d.getDate() + '일</span>' +
        '<span class="md-w' + (w === 0 ? ' sun' : w === 6 ? ' sat' : '') + '">' + WD[w] + '요일</span>' +
        (it.date === t0 ? '<span class="md-today">오늘</span>' : '') + '<span class="md-go">그날 페이지 ›</span></button>' +
        '<div class="memo-body">' + rtHtml(it.lines, it.ranges) + '</div>' +
        '<button type="button" class="memo-more" hidden>더 보기 ▾</button></article>';
    });
    if (cur) html += '</div>';
    if (items.length > shown.length) html += '<button type="button" class="btn memo-next" id="memoNext">이전 메모 더 보기 (' + (items.length - shown.length) + '일 남음)</button>';
    box.innerHTML = html;
    // 길게 적은 메모는 접어 두고 '더 보기'로 펼침 (검색 중에는 모두 펼쳐서 보여 줌)
    $$('.memo-item.clamp', box).forEach(function (a) {
      var body = $('.memo-body', a);
      if (body.scrollHeight > body.clientHeight + 4) $('.memo-more', a).hidden = false;
      else a.classList.remove('clamp');
    });
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
    if (S.view === 'month') renderMonth();   // 종일 일정 기본 테두리 · '플래너 색' 요일 칸이 새 색을 따라가도록
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
        '<span class="tc-name">' + esc(t.name) + (t.note ? '<small>' + t.note + '</small>' : t.isNew ? '<small class="new">새로 추가</small>' : '') + '</span><span class="tc-on">✓</span></button>';
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
    FONTS.forEach(loadFontCss); // 미리보기를 위해 15종을 모두 불러옴
    renderThemeList();
    $('#fontDesc').textContent = S.mode === 'firebase'
      ? '플래너 색깔과 글꼴을 고릅니다. 고른 설정은 PC와 휴대폰에 함께 적용됩니다.'
      : '플래너 색깔과 글꼴을 고릅니다. (미리보기 모드에서는 이 기기에만 적용됩니다)';
    var html = '';
    FONT_GROUPS.forEach(function (g) {
      html += '<h3 class="font-group">' + g.name + '<span>' + g.desc + '</span></h3><div class="font-grid">';
      FONTS.filter(function (f) { return f.group === g.id; }).forEach(function (f) {
        html += '<button class="font-card" data-font="' + f.id + '" aria-pressed="false">' +
          '<span class="fc-head"><b>' + esc(f.name) + '</b><small>' + esc(f.en) + (f.note ? ' · ' + f.note : '') + '</small>' +
          (f.isNew ? '<em class="new-tag">새로 추가</em>' : '') + '</span>' +
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
  var VIEWS = { day: '#dayView', month: '#monthView', pad: '#padView', memos: '#memosView', pending: '#pendingView', values: '#valuesView', font: '#fontView', help: '#helpView' };
  function showView(v) {
    flushInfo();
    if (v !== 'values') flushValues();
    if (v !== 'day') { flushRange(); flushNotes(); flushSched(); flushSpans(); closeSchedTools(); closeRange(); }
    if (v !== 'month') { closePaint(); closeDow(); }
    if (S.view === 'pad' && v !== 'pad') padLeave();
    S.view = v;
    Object.keys(VIEWS).forEach(function (k) { $(VIEWS[k]).hidden = k !== v; });
    if (v === 'month') { subscribeSched(S.monthCursor); renderMonth(); }
    else if (S.store) subscribeSched(monthKey(S.date));
    if (v === 'memos') { subscribeMemos(); renderMemos(); } else unsubscribeMemos();
    if (v === 'pad') { subscribePad(); padEnter(); }
    if (v === 'pending') renderPendingView();
    if (v === 'values') fillValues();
    if (v === 'font') renderFontView();
    if (v === 'day') { renderHeader(); renderMiniCal(); }
    window.scrollTo(0, 0);
  }

  function go(v) {
    closeDrawer();
    if (v === 'day' && (S.view === 'day' || (S.followToday && S.date !== today()))) { setDate(today()); return; }   // 메모장 등에 있는 동안 날짜가 바뀌었으면 오늘로
    if (v === 'pad' && S.view === 'pad') { padLeave(); padEnter(); window.scrollTo(0, 0); return; }   // 메모장에서 다시 누르면 처음 화면으로
    if (v === 'month') S.monthCursor = monthKey(S.date);
    showView(v);
  }

  function setDate(d) {
    if (!d) return;
    flushInfo(); flushRange(); flushNotes(); flushSched(); flushSpans();
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

  /* 동그라미 단추: 미완료 → 완료, 완료 → 미완료, 진행 중 → 완료 (그 밖의 상태는 편집 화면) */
  function toggle(id) {
    var t = findTask(id); if (!t) return;
    var from = t.status || 'open', st = from === 'open' || from === 'prog' ? 'done' : from === 'done' ? 'open' : null;
    if (!st) { openSheet(id); return; }
    S.store.updateTask(id, Object.assign(statusPatch(t, st), { status: st, updated: Date.now() }));
  }

  function setStatus(id, st, extra) {
    var t = findTask(id); if (!t) return;
    var patch = Object.assign(statusPatch(t, st), { status: st, updated: Date.now() });
    if (st !== 'deleg') patch.who = null;
    if (extra) Object.keys(extra).forEach(function (k) { patch[k] = extra[k]; });
    S.store.updateTask(id, patch);
  }

  /* 할 일을 다른 날로 옮김 (v1.10부터): 같은 할 일을 그날로 옮기므로 원래 날의 목록에서는 사라짐(→ 표시를 남기지 않음).
     내용 · A·B·C · 진하게 · 상태는 그대로 두고, 자리만 옮긴 날에 맞춰 다시 정함:
     진행 중은 같은 글자의 맨 위, 완료는 맨 아래, 나머지는 그 글자의 끝(완료한 일 위). k: 여러 개를 함께 옮길 때의 차례 */
  function movePatch(t, toDate, now, k) {
    k = k || 0;
    var p = { date: toDate, ord: now + k, updated: now };
    if (t.status === 'prog') { p.ord = -now + k; p.progAt = now; }
    if (t.status === 'done') p.ordPrev = null;   // 원래 날에서 완료하기 전 자리는 옮긴 날에서는 뜻이 없음
    ['fwdTo', 'fwdId', 'fwdFrom', 'fwdCount'].forEach(function (k2) { if (t[k2] != null) p[k2] = null; });   // 예전 버전의 넘김 기록은 정리
    return p;
  }

  function forward(t, toDate) {
    if (!toDate || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) { toast('날짜를 고르십시오.'); return false; }
    if (toDate === t.date) { toast('같은 날짜로는 옮길 수 없습니다.'); return false; }
    S.store.updateTask(t.id, movePatch(t, toDate, Date.now()));
    toast(md(toDate) + '로 옮겼습니다.');
    return true;
  }

  /* 미처리 할 일을 모두 오늘로 옮김 (지난 날의 목록에서는 사라짐). 오래된 날의 일부터, 그날의 순서대로 */
  function pullAllToToday() {
    var t0 = today();
    var list = S.pending.filter(function (t) { return t.date < t0; }).sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : (PRI_ORDER[a.pri] - PRI_ORDER[b.pri]) || (legacyProg(b) - legacyProg(a)) || ((a.ord || 0) - (b.ord || 0));
    });
    if (!list.length) return;
    var now = Date.now();
    S.store.commit(list.map(function (t, i) { return { type: 'update', id: t.id, patch: movePatch(t, t0, now, i) }; }));
    if (S.view !== 'day' || S.date !== t0) setDate(t0);
    toast(list.length + '개를 오늘로 가져왔습니다. A·B·C와 순서를 다시 정해 보세요.');
  }

  function moveTask(id, dir) {
    var t = findTask(id); if (!t) return;
    var group = moveGroup(sortTasks(S.tasks), t);   // 진행 중인 일도 마음대로 옮김. 완료한 일은 늘 맨 아래라서 완료한 일끼리만
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
    var tb = $('#btnTaskBold');
    tb.classList.toggle('on', !!t.bold); tb.setAttribute('aria-pressed', t.bold ? 'true' : 'false');
    $('#editText').classList.toggle('em', !!t.bold);
    $$('#editPri button').forEach(function (b) { b.classList.toggle('on', b.dataset.pri === t.pri); });
    $$('#statusGrid button').forEach(function (b) { b.classList.toggle('on', b.dataset.st === (t.status || 'open')); });
    var fd = $('#fwdDate');
    if (!fd.dataset.for || fd.dataset.for !== t.id) { fd.value = addDays(t.date, 1); fd.dataset.for = t.id; }
    var group = moveGroup(sorted, t);
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
  var notesTimer = null, notesPending = null, notesRange = null;
  function onNotesInput() {
    var ed = $('#notes');
    notesPending = { date: ed.dataset.date || S.date };
    ed.classList.toggle('is-empty', notesLooksEmpty(ed));
    clearTimeout(notesTimer);
    notesTimer = setTimeout(flushNotes, 700);
  }
  function flushNotes() {
    clearTimeout(notesTimer);
    var ed = $('#notes');
    if (notesPending && S.store && (ed.dataset.date || S.date) === notesPending.date) {
      var lines = rtFromDom(ed);   // 저장하는 순간의 메모 칸 내용
      S.store.setDay(notesPending.date, { notes: rtText(lines), notesHtml: rtHasBold(lines) ? rtHtml(lines) : '' });
    }
    notesPending = null;
  }
  /* 진하게 단추: 글자를 고른 뒤 누르면 진하게(다시 누르면 보통), 고르지 않고 누르면 이어서 쓰는 글자부터 */
  function notesBoldState() {
    var ed = $('#notes'), sel = window.getSelection(), on = false, b = $('#btnNotesBold');
    if (sel && sel.rangeCount && ed.contains(sel.anchorNode)) {
      try { on = document.queryCommandState('bold'); } catch (e) { on = false; }
    }
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function toggleNotesBold() {
    var ed = $('#notes'), sel = window.getSelection();
    if (document.activeElement !== ed) {
      ed.focus();
      var r = notesRange && ed.contains(notesRange.startContainer) ? notesRange : null;
      if (!r) { r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); }
      sel.removeAllRanges(); sel.addRange(r);
    }
    try { document.execCommand('bold', false, null); } catch (e) { /* 지원하지 않는 브라우저 */ }
    onNotesInput();
    notesBoldState();
  }

  var schedPending = new Map(), schedTimer = null;
  /* 일정 칸 정리용 기록 ('날짜|칸' 이름으로)
     keptEmpty: 적는 중에 글자를 모두 지운 칸 — 내용을 새로 고쳐 쓰는 중일 수 있어 꾸미기·정보를 아직 남겨 둠
     lastText:  그 칸의 마지막 내용 — 일정을 지운 뒤 '되돌리기'에 씀 */
  var keptEmpty = {}, lastText = {};
  function onSchedInput(e) {
    if (e.target.dataset.span) { onSpanInput(e); return; }
    var h = e.target.dataset.h; if (!h) return;
    schedPending.set(S.date + '|' + h, e.target.value);
    if (e.target.value.trim()) lastText[S.date + '|' + h] = e.target.value;
    var row = e.target.closest('.sched-row'), show = !!e.target.value.trim();
    var btn = $('.sty', row), per = $('.per', row);
    if (btn) btn.hidden = !show && schedToolsH !== h;
    if (per) per.hidden = !show && rangeKey !== h;
    row.classList.toggle('bare', !!btn && btn.hidden);
    paintInfoRow(row, infoOf(S.day && S.day.schedInfo, h));
    if (isAllDay(h)) showAllDayRows();   // 종일 칸에 적기 시작하면 아래에 빈 종일 칸이 하나 더 생김
    clearTimeout(schedTimer);
    schedTimer = setTimeout(flushSched, 700);
  }
  /* 그 칸을 지금 고치고 있는지 (하루 페이지의 그 칸에 적는 중이거나, 그 일정의 정보 창이 열려 있음) */
  function slotEditing(d, h) {
    var t = infoTarget();
    if (t && t.date === d && t.key === h) return true;
    if (d !== S.date) return false;
    var ae = document.activeElement;
    return !!(ae && ae.tagName === 'INPUT' && ae.dataset.h === h && ae.closest('#schedList'));
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
    Object.keys(byDate).forEach(function (d) {
      var patch = { sched: byDate[d] }, dd = dayData(d), cs = {}, ci = {}, gone = [];
      Object.keys(byDate[d]).forEach(function (h) {
        var v = String(byDate[d][h]), id = d + '|' + h, had = String(dd.sched[h] == null ? '' : dd.sched[h]).trim(), drop = false;
        if (!v.trim()) {
          // 글자를 모두 지운 칸: 그 칸을 떠났으면 색·진하게·테두리와 시간·장소·메모도 지움(나중에 새로 적는 일정에 남지 않도록).
          // 아직 그 칸에 적는 중이면(내용을 고쳐 쓰는 중) 남겨 두고, 칸을 떠날 때 정리
          if (slotEditing(d, h)) keptEmpty[id] = true; else { drop = true; if (had) gone.push(h); }
        } else if (!had && !keptEmpty[id]) {
          drop = true;   // 빈 칸에 새로 적는 일정: 예전에 남아 있던 꾸미기·정보는 버림
        }
        if (v.trim() || drop) delete keptEmpty[id];
        if (!drop) return;
        if (styleSet(dd.style[h])) cs[h] = blankStyle(h);
        if (infoHas(infoOf(dd.info, h))) ci[h] = blankInfo();
      });
      if (Object.keys(cs).length) patch.schedStyle = cs;
      if (Object.keys(ci).length) patch.schedInfo = ci;
      var back = gone.filter(function (h) { return ci[h]; }).map(function (h) { return { h: h, text: lastText[d + '|' + h] || String(dd.sched[h] || ''), style: styleOf(dd.style, h), info: infoOf(dd.info, h) }; });
      patchLocalDay(d, patch);   // 화면 자료에도 바로 반영 (월간 달력·정보 창이 새 내용을 쓰도록)
      S.store.setDay(d, patch);
      if (back.length) undoToast(d, back);
    });
  }
  /* 적는 중에 비운 칸을 떠난 뒤: 남겨 두었던 꾸미기·정보를 지움 */
  function dropExtrasIfEmpty(d, h) {
    if (!S.store || slotEditing(d, h)) return;
    var id = d + '|' + h;
    if (String(infoTextOf(d, h) || '').trim()) { delete keptEmpty[id]; return; }
    delete keptEmpty[id];
    var dd = dayData(d), st = dd.style[h], inf = infoOf(dd.info, h), p = {};
    if (styleSet(st)) { p.schedStyle = {}; p.schedStyle[h] = blankStyle(h); }
    if (infoHas(inf)) { p.schedInfo = {}; p.schedInfo[h] = blankInfo(); }
    if (!p.schedStyle && !p.schedInfo) return;
    var back = p.schedInfo ? [{ h: h, text: lastText[id] || '', style: styleOf(dd.style, h), info: inf }] : [];
    patchLocalDay(d, p);
    S.store.setDay(d, p);
    if (d === S.date && S.view === 'day') renderSched();
    if (back.length && back[0].text.trim()) undoToast(d, back);
  }
  /* 시간·장소·메모를 적어 둔 일정을 지웠을 때: '되돌리기'로 내용·꾸미기·정보를 함께 살림 */
  function undoToast(d, back) {
    back = back.filter(function (b) { return String(b.text || '').trim(); });
    if (!back.length) return;
    toast(back.length > 1 ? '일정 ' + back.length + '개를 지웠습니다.' : '‘' + cut(back[0].text, 16) + '’ 일정을 지웠습니다.', null,
      { label: '되돌리기', fn: function () { back.forEach(function (b) { restoreSched(d, b); }); } }, 7000);
  }
  /* 지운 일정 되살리기: 시간 칸은 원래 칸에(그사이 다른 일정을 적었으면 되살리지 않음), 종일 일정은 첫 빈 종일 칸에 */
  function restoreSched(d, b) {
    if (!S.store) return;
    flushSched();
    var free = function (x) { return !String(infoTextOf(d, x) || '').trim(); }, k = null;
    if (isAllDay(b.h)) ALLDAY.forEach(function (x) { if (!k && free(x)) k = x; });
    else if (free(b.h)) k = b.h;
    if (!k) { toast('그 자리에 이미 다른 일정이 있어 되돌리지 못했습니다.'); return; }
    var p = { sched: {}, schedStyle: {}, schedInfo: {} }, st = b.style || blankStyle(k);
    p.sched[k] = b.text;
    p.schedStyle[k] = isAllDay(k) ? { c: st.c, b: st.b, bc: st.bc || '', bs: st.bs || '', bw: st.bw || '' } : { c: st.c, b: st.b };
    p.schedInfo[k] = infoClean(b.info);
    delete keptEmpty[d + '|' + k];
    patchLocalDay(d, p);
    if (d === S.date) { var input = $('#schedList input[data-h="' + k + '"]'); if (input && document.activeElement !== input) input.value = b.text; }
    S.store.setDay(d, p);
    afterSchedChange(d);
  }
  /* 일정을 바꾼 뒤 보이는 화면을 다시 그림 */
  function afterSchedChange(d) {
    if (d === S.date && S.view === 'day') renderSched();
    if (S.view === 'month') renderMonth();
    renderMiniCal();
  }
  /* 여러 날 종일 일정의 글자: 적는 대로 저장. 모두 지운 채 칸을 떠나면 그 일정을 지움(되돌리기 가능) */
  var spanPending = new Map(), spanTimer = null;
  function onSpanInput(e) {
    var id = e.target.dataset.span;
    spanPending.set(id, e.target.value);
    var row = e.target.closest('.sched-row'), show = !!e.target.value.trim(), k = 's:' + id;
    $('.sty', row).hidden = !show && schedToolsH !== k;
    $('.per', row).hidden = !show && rangeKey !== k;
    row.classList.toggle('bare', $('.sty', row).hidden);
    var sp = spanById(id);
    paintInfoRow(row, sp ? infoClean(sp) : blankInfo());
    clearTimeout(spanTimer);
    spanTimer = setTimeout(flushSpans, 700);
  }
  function flushSpans() {
    clearTimeout(spanTimer);
    if (!S.store || !spanPending.size) { spanPending.clear(); return; }
    var now = Date.now();
    spanPending.forEach(function (v, id) {
      var sp = spanById(id);
      if (!sp || !String(v).trim() || sp.t === v) return;   // 빈칸은 저장하지 않음 (칸을 떠날 때 지움)
      sp.t = v;
      spanEdit(id, { t: v, updated: now });
    });
    spanPending.clear();
  }
  function deleteSpan(id) {
    var sp = spanById(id); if (!sp || !S.store) return;
    var backup = { s: sp.s, e: sp.e, t: sp.t, c: sp.c, b: sp.b, bc: sp.bc, bs: sp.bs, bw: sp.bw, created: sp.created || Date.now(), updated: Date.now() };
    var inf = infoClean(sp);
    if (infoHas(inf)) { backup.ts = inf.ts; backup.te = inf.te; backup.loc = inf.loc; backup.memo = inf.memo; }   // 되돌리면 시간·장소·메모도 함께
    spanPending.delete(id);
    var t = infoTarget(); if (t && t.key === 's:' + id) closeInfo(true);
    S.spans = S.spans.filter(function (v) { return v.id !== id; });   // 화면에 바로 반영
    if (schedToolsH === 's:' + id) closeSchedTools();
    if (rangeKey === 's:' + id) closeRange();
    S.store.removeSpan(id);
    renderSched(); renderMiniCal();
    if (S.view === 'month') renderMonth();
    toast('종일 일정을 지웠습니다.', null, { label: '되돌리기', fn: function () { if (S.store) S.store.setSpan(id, backup); } });
  }

  /* ───────── 일정 정보 창 (시간 · 장소 · 메모, v1.8부터) ─────────
     하루 페이지의 '정보' 단추·요약 줄이나 월간 달력의 일정을 누르면 열림. 적는 대로(0.6초 뒤) 저장 */
  /* 그 날짜의 일정 자료: 하루 페이지에 불러온 날짜면 그 자료, 아니면 월간 달력(한 달 치) 자료 */
  function dayData(d) {
    if (d === S.date && S.dayLoaded) {
      var x = S.day || {};
      return { sched: x.sched || {}, style: x.schedStyle || {}, info: x.schedInfo || {} };
    }
    if (S.schedKey === monthKey(d)) return { sched: S.sched[d] || {}, style: S.schedStyle[d] || {}, info: S.schedInfo[d] || {} };
    return { sched: {}, style: {}, info: {} };
  }
  /* 고친 내용을 화면 자료(하루 페이지 · 한 달 치)에 바로 반영 — 저장소의 새 값이 오기 전에도 보이게 */
  function patchLocalDay(d, patch) {
    ['sched', 'schedStyle', 'schedInfo'].forEach(function (k) {
      if (!patch || !patch[k]) return;
      if (d === S.date) { S.day = S.day || {}; S.day[k] = Object.assign({}, S.day[k] || {}, patch[k]); }
      if (S.schedKey === monthKey(d)) S[k][d] = Object.assign({}, S[k][d] || {}, patch[k]);
    });
  }
  function storeInfoOk() { return storeV() >= 18; }
  function infoTarget() { return S.info && !$('#infoSheet').hidden ? S.info : null; }
  /* 그 일정의 지금 내용 (적고 있는 글자까지). 여러 날 종일 일정이 없어졌으면 null */
  function infoTextOf(d, k) {
    if (isSpanKey(k)) {
      var id = k.slice(2), sp = spanById(id);
      if (!sp) return null;
      return spanPending.has(id) ? spanPending.get(id) : sp.t;
    }
    var key = d + '|' + k;
    if (schedPending.has(key)) return schedPending.get(key);
    if (d === S.date) {
      var input = $('#schedList input[data-h="' + k + '"]');
      if (input && (S.dayLoaded || input.value)) return input.value;
    }
    var v = dayData(d).sched[k];
    return v == null ? '' : String(v);
  }
  function infoOfKey(d, k) {
    if (isSpanKey(k)) { var sp = spanById(k.slice(2)); return sp ? infoClean(sp) : blankInfo(); }
    return infoOf(dayData(d).info, k);
  }
  function cut(s, n) { s = String(s || '').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }

  var infoTimer = null, infoDirty = false, infoTextDirty = false;
  function openInfo(d, k) {
    if (!S.store || !d || !k) return;
    if (!storeInfoOk()) { toast('일정 정보(시간·장소·메모)를 쓰려면 store.js 파일도 새 버전으로 올려 주세요.', 'error', null, 8000); return; }
    if (isSpanKey(k)) flushSpans(); else flushSched();
    var text = infoTextOf(d, k);
    if (text == null || !String(text).trim()) return;   // 없어진 일정 · 빈 칸은 열지 않음
    if (S.info) closeInfo();
    var ae = document.activeElement;
    S.info = { date: d, key: k, lastText: String(text), opener: ae && ae !== document.body ? ae : null };
    infoDirty = false; infoTextDirty = false;
    $('#infoSheet').hidden = false;
    renderInfo(true);
    // 키보드로 쓰는 경우를 위해 창 안으로 초점을 옮김 (입력 칸이 아니라 창 자체라서 휴대폰 키보드는 뜨지 않음)
    try { $('#infoSheet .sheet-card').focus({ preventScroll: true }); } catch (e) { /* 무시 */ }
  }
  /* 창을 닫은 뒤 초점을 창을 연 단추로 되돌림 (그 단추가 아직 보이면) */
  function infoRefocus(t) {
    var o = t && t.opener;
    if (o && o.isConnected && o.offsetParent !== null && !$('#app').hidden) { try { o.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
  }
  /* 하루 페이지의 '정보' 단추·요약 줄 */
  function openInfoFromRow(k) {
    if (!k) return;
    if (isSpanKey(k)) { openInfo(S.date, k); return; }
    var input = $('#schedList input[data-h="' + k + '"]'), text = input ? input.value : '';
    if (!text.trim()) return;
    flushSched();
    if (isAllDay(k)) {   // 종일 칸 사이에 빈칸이 있으면 먼저 위로 당겨 정리하고, 그 일정이 옮겨 간 칸을 엶
      compactAllDay(S.date, true);
      for (var i = 0; i < ALLDAY.length; i++) {
        var x = $('#schedList input[data-h="' + ALLDAY[i] + '"]');
        if (x && x.value === text) { k = ALLDAY[i]; break; }
      }
    }
    openInfo(S.date, k);
  }
  function setField(sel, v, force, busy) {
    var el = $(sel);
    if (force || (!busy && document.activeElement !== el)) el.value = v;
  }
  function renderInfo(force) {
    var t = infoTarget(); if (!t) return;
    var d = t.date, k = t.key, span = isSpanKey(k) ? spanById(k.slice(2)) : null;
    var text = infoTextOf(d, k);
    if ((isSpanKey(k) && !span) || (!isSpanKey(k) && !infoTextDirty && !String(text || '').trim())) {
      closeInfo(true); renderSched();
      toast('이 일정은 다른 곳에서 지워졌습니다.');
      return;
    }
    var info = infoOfKey(d, k), dt = parse(d);
    $('#infoWhen').textContent = span ? (span.s === span.e ? '종일' : '종일 ' + spanDays(span.s, span.e) + '일') : schedLabel(k);
    $('#infoTitle').textContent = span ? rangeLong(span.s, span.e) : dateLong(d, d.slice(0, 4) !== S.date.slice(0, 4)) + ' (' + WD[dt.getDay()] + ')';
    setField('#infoText', String(text || ''), force, infoTextDirty);
    setField('#infoTs', info.ts, force, infoDirty);
    setField('#infoTe', info.te, force, infoDirty);
    setField('#infoLoc', info.loc, force, infoDirty);
    setField('#infoMemo', info.memo, force, infoDirty);
    $('#infoTimeClear').hidden = !($('#infoTs').value || $('#infoTe').value);
    $('#infoGoDay').hidden = S.view === 'day' && d === S.date;   // 하루 페이지에서 연 창에는 필요 없음
    autoGrow($('#infoMemo'));
  }
  function autoGrow(el) {
    if (!el || el.offsetParent === null) return;
    el.style.height = 'auto';
    el.style.height = Math.min(Math.max(el.scrollHeight + 2, 84), 320) + 'px';
  }
  function onInfoInput(e) {
    var id = e.target.id;
    if (id === 'infoText') { onInfoText(e.target.value); return; }
    if (!/^info(Ts|Te|Loc|Memo)$/.test(id)) return;
    infoDirty = true;
    if (id === 'infoMemo') autoGrow(e.target);
    $('#infoTimeClear').hidden = !($('#infoTs').value || $('#infoTe').value);
    clearTimeout(infoTimer);
    infoTimer = setTimeout(flushInfo, 600);
  }
  /* 정보 창에서 일정 내용(제목)을 고침: 하루 페이지의 그 줄과 같은 방법으로 저장 */
  function onInfoText(v) {
    var t = infoTarget(); if (!t) return;
    infoTextDirty = true;
    if (v.trim()) t.lastText = v;
    if (isSpanKey(t.key)) {
      var id = t.key.slice(2), si = $('#schedList input[data-span="' + id + '"]');
      spanPending.set(id, v);
      if (si) si.value = v;
      clearTimeout(spanTimer); spanTimer = setTimeout(flushSpans, 700);
    } else {
      schedPending.set(t.date + '|' + t.key, v);
      if (v.trim()) lastText[t.date + '|' + t.key] = v;
      if (t.date === S.date) { var input = $('#schedList input[data-h="' + t.key + '"]'); if (input) input.value = v; }
      clearTimeout(schedTimer); schedTimer = setTimeout(flushSched, 700);
    }
  }
  function flushInfo() {
    clearTimeout(infoTimer);
    var t = infoTarget();
    if (!t || !S.store || !infoDirty) { infoDirty = false; return; }
    infoDirty = false;
    saveInfo(t.date, t.key, infoClean({ ts: $('#infoTs').value, te: $('#infoTe').value, loc: $('#infoLoc').value, memo: $('#infoMemo').value }));
  }
  function saveInfo(d, k, v) {
    if (isSpanKey(k)) {
      var sp = spanById(k.slice(2)); if (!sp) return;
      flushSpans();
      sp.ts = v.ts; sp.te = v.te; sp.loc = v.loc; sp.memo = v.memo;   // 화면에 바로 반영
      spanEdit(sp.id, { ts: v.ts, te: v.te, loc: v.loc, memo: v.memo, updated: Date.now() });
    } else {
      var p = { schedInfo: {} };
      p.schedInfo[k] = v;
      patchLocalDay(d, p);
      S.store.setDay(d, p);
    }
    if (S.view === 'day') renderSched();
  }
  /* 창 닫기 (silent = 저장·정리 없이 닫기만). 일정 내용을 모두 지운 채 닫으면 그 일정을 지움(되돌리기 가능) */
  function closeInfo(silent) {
    var t = S.info;
    if (!t) { $('#infoSheet').hidden = true; return; }
    if (!silent) flushInfo();
    clearTimeout(infoTimer); infoDirty = false;
    var emptied = infoTextDirty && !$('#infoText').value.trim();
    infoTextDirty = false;
    S.info = null;
    $('#infoSheet').hidden = true;
    if (silent) return;
    if (isSpanKey(t.key)) {
      var id = t.key.slice(2);
      if (emptied) { spanPending.delete(id); deleteSpan(id); }
      else flushSpans();
    } else if (emptied) {
      removeSched(t.date, t.key, t.lastText);
      return;
    } else {
      flushSched();
      if (t.date === S.date && isAllDay(t.key)) compactAllDay(t.date);
    }
    afterSchedChange(t.date);
    infoRefocus(t);
  }
  /* 일정 하나 지우기 (내용 · 꾸미기 · 정보를 함께) — '되돌리기'로 다시 살릴 수 있음 */
  function removeSched(d, k, text) {
    if (!S.store) return;
    if (isSpanKey(k)) { deleteSpan(k.slice(2)); return; }
    var key = d + '|' + k;
    schedPending.delete(key);
    flushSched();
    var dd = dayData(d);
    text = String(text || lastText[key] || dd.sched[k] || '');
    var back = { h: k, text: text, style: styleOf(dd.style, k), info: infoOf(dd.info, k) };
    var p = { sched: {}, schedStyle: {}, schedInfo: {} };
    p.sched[k] = ''; p.schedStyle[k] = blankStyle(k); p.schedInfo[k] = blankInfo();
    delete keptEmpty[key];
    patchLocalDay(d, p);
    if (d === S.date) { var input = $('#schedList input[data-h="' + k + '"]'); if (input) input.value = ''; }
    S.store.setDay(d, p);
    if (d === S.date && isAllDay(k)) compactAllDay(d);
    afterSchedChange(d);
    undoToast(d, [back]);
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
      var payload = { app: 'my-planner', version: 1, exportedAt: new Date().toISOString(), tasks: data.tasks, days: data.days, profile: data.profile, spans: data.spans || [],
        pad: data.pad || { folders: [], notes: [] } };
      var padN = payload.pad.notes ? payload.pad.notes.length : 0, padTxt = padN ? ', 메모장 메모 ' + padN + '개' : '';
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'planner-backup-' + today().replace(/-/g, '') + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      if (data.partial) toast('인터넷 연결이 없어, 이 기기에 내려받아 둔 내용만 저장했습니다. (할 일 ' + data.tasks.length + '개' + padTxt + ') 연결된 뒤 다시 저장하면 전체가 담깁니다.', null, null, 7000);
      else toast('백업 파일을 저장했습니다. (할 일 ' + data.tasks.length + '개' + padTxt + ')');
    }, function (e) { toast(describeError(e, 'export'), 'error'); });
  }

  function importBackup(file) {
    if (!file || !S.store) return;
    var reader = new FileReader();
    reader.onload = function () {
      var d;
      try { d = JSON.parse(reader.result); } catch (e) { toast('백업 파일을 읽지 못했습니다.', 'error'); return; }
      if (!d || d.app !== 'my-planner' || !Array.isArray(d.tasks)) { toast('이 앱의 백업 파일이 아닙니다.', 'error'); return; }
      var padN = d.pad && Array.isArray(d.pad.notes) ? d.pad.notes.length : 0;
      if (!window.confirm('백업 파일의 할 일 ' + d.tasks.length + '개와 일정·메모·사명' + (padN ? '·메모장 메모 ' + padN + '개' : '') + '를 불러올까요?\n같은 항목이 있으면 백업 내용으로 바뀝니다.')) return;
      if (padN && !padOk()) toast('메모장은 store.js가 새 버전이어야 불러옵니다. 업데이트 파일을 모두 다시 올려 주세요.', 'error', null, 8000);
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
    flushInfo(); flushNotes(); flushSched(); flushSpans(); flushValues(); peSave();
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
      if (c) {
        var cl = c.dataset.close;
        if (cl === 'drawer') closeDrawer(); else if (cl === 'info') closeInfo();
        else if (cl === 'padfolder') closePadFolder(); else if (cl === 'padpick') closePadPick();
        else closeSheet();
      }
    });

    // 일정 정보 창: 적는 대로 저장, 칸을 떠나면 바로 저장
    var isheet = $('#infoSheet');
    isheet.addEventListener('input', onInfoInput);
    isheet.addEventListener('change', onInfoInput);
    isheet.addEventListener('focusout', function (e) {
      var t = infoTarget(); if (!t) return;
      if (e.target.id === 'infoText') { if (isSpanKey(t.key)) flushSpans(); else flushSched(); }
      else flushInfo();
    });
    isheet.addEventListener('keydown', function (e) {   // 한 줄 칸에서 Enter(휴대폰 '완료') = 저장하고 키보드 닫기
      if (e.key === 'Enter' && !e.isComposing && (e.target.id === 'infoText' || e.target.id === 'infoLoc')) { e.preventDefault(); e.target.blur(); }
    });
    $('#infoForm').addEventListener('submit', function (e) { e.preventDefault(); });
    $('#infoTimeClear').addEventListener('click', function () {
      $('#infoTs').value = ''; $('#infoTe').value = '';
      infoDirty = true; flushInfo();
      $('#infoTimeClear').hidden = true;
    });
    $('#infoGoDay').addEventListener('click', function () {
      var t = infoTarget(); if (!t) return;
      var d = t.date;
      closeInfo();
      setDate(d); setTab('sched');
    });
    $('#infoDelete').addEventListener('click', function () {
      var t = infoTarget(); if (!t) return;
      flushInfo();
      var last = t.lastText;
      closeInfo(true);
      if (isSpanKey(t.key)) { spanPending.delete(t.key.slice(2)); deleteSpan(t.key.slice(2)); }
      else removeSched(t.date, t.key, last);
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
    $('#schedList').addEventListener('focusin', function (e) {   // 일정을 지운 뒤 '되돌리기'에 쓸 원래 내용
      var t = e.target;
      if (t.tagName === 'INPUT' && t.dataset.h && t.value.trim()) lastText[S.date + '|' + t.dataset.h] = t.value;
    });
    $('#schedList').addEventListener('focusout', function (e) {
      var t = e.target;
      flushSched();
      if (t.tagName === 'INPUT' && t.dataset.h) {   // 글자를 모두 지운 칸을 떠나면 꾸미기·정보도 정리
        var dh = S.date, hh = t.dataset.h;
        setTimeout(function () { dropExtrasIfEmpty(dh, hh); }, 0);
      }
      if ((t.id === 'adStart' || t.id === 'adEnd') && rangePending) flushRange(true);
      if (t.dataset && t.dataset.span) {   // 여러 날 종일 일정: 글자를 모두 지운 채 떠나면 지움(되돌리기 가능)
        var id = t.dataset.span;
        if (!t.value.trim()) setTimeout(function () { if (document.activeElement !== t) deleteSpan(id); }, 0);
        else flushSpans();
      }
      if (t.closest && t.closest('.ad-block')) {   // 종일 칸에서 손을 떼면 빈칸 정리
        var d = S.date;
        setTimeout(function () { compactAllDay(d); }, 0);
      }
    });
    // Enter(휴대폰 '완료') = 그 줄 저장
    $('#schedList').addEventListener('submit', function (e) {
      e.preventDefault();
      commitSchedRow(e.target.closest('.sched-row'));
    });
    // 일정 글자 색 · 테두리 색 · 진하게, 종일 일정 기간
    $('#schedList').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('inf') || b.classList.contains('inf-sum')) { openInfoFromRow(b.dataset.inf); return; }   // 일정 정보 창
      if (b.classList.contains('sty')) { openSchedTools(b.dataset.sty); return; }
      if (b.classList.contains('per')) { openRange(b.dataset.per); return; }
      if (b.id === 'adOneDay') { flushRange(); var r = rangeKey && rangeOf(rangeKey); if (r) setRange(rangeKey, r.s, r.s); return; }
      if (b.classList.contains('ar-close')) { flushRange(true); closeRange(); renderSched(); return; }
      if (!schedToolsH) return;
      if (b.classList.contains('lsw')) {
      // 선 모양·굵기는 v1.7 store.js부터 저장됨 (예전 store.js는 이 값을 버려서, 골라도 곧 되돌아감)
      if (storeV() < 17) { toast('선 모양·굵기를 쓰려면 store.js 파일도 새 버전으로 올려 주세요.', 'error', null, 8000); return; }
      setSchedStyle(schedToolsH, 'bs' in b.dataset ? { bs: b.dataset.bs } : { bw: b.dataset.bw });
      return;
    }
      if (b.classList.contains('bsw')) setSchedStyle(schedToolsH, { bc: b.dataset.bc || '' });
      else if (b.classList.contains('sw')) setSchedStyle(schedToolsH, { c: b.dataset.c || '' });
      else if (b.id === 'schedBold') setSchedStyle(schedToolsH, { b: !styleOfKey(schedToolsH).b });
      else if (b.classList.contains('st-close')) closeSchedTools();
    });
    // 종일 일정 기간: 날짜 칸
    $('#schedList').addEventListener('input', function (e) {
      if (e.target.id === 'adStart') onRangeInput('start');
      else if (e.target.id === 'adEnd') onRangeInput('end');
    });
    $('#schedList').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.target.id === 'adStart' || e.target.id === 'adEnd')) { e.preventDefault(); flushRange(true); }
    });

    // 메모 칸 (진하게)
    var ed = $('#notes');
    ed.addEventListener('input', onNotesInput);
    ed.addEventListener('blur', flushNotes);
    ed.addEventListener('paste', function (e) {   // 붙여 넣을 때는 글자만 (다른 곳의 색·크기는 빼고)
      var cd = e.clipboardData || window.clipboardData; if (!cd) return;
      e.preventDefault();
      var text = String(cd.getData('text/plain') || cd.getData('Text') || '').replace(/\r\n?/g, '\n');
      if (text) document.execCommand('insertText', false, text);
    });
    ed.addEventListener('drop', function (e) { e.preventDefault(); });   // 끌어다 놓기로 서식이 섞이지 않게
    ed.addEventListener('beforeinput', function (e) {   // 진하게 말고 다른 꾸미기(기울임·밑줄 등)는 막음
      var t = e.inputType || '';
      if (/^format/.test(t) && t !== 'formatBold') e.preventDefault();
    });
    ed.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        var k = String(e.key || '').toLowerCase();
        if (k === 'b') { e.preventDefault(); toggleNotesBold(); }
        else if (k === 'i' || k === 'u') e.preventDefault();
      }
    });
    document.addEventListener('selectionchange', function () {
      var sel = window.getSelection();
      if (sel && sel.rangeCount && ed.contains(sel.anchorNode)) notesRange = sel.getRangeAt(0).cloneRange();
      if (S.view === 'day') notesBoldState();
    });
    var nb = $('#btnNotesBold');
    nb.addEventListener('mousedown', function (e) { e.preventDefault(); });   // 고른 글자가 풀리지 않게
    nb.addEventListener('click', toggleNotesBold);

    // 메모 모아보기
    var memoTimer = null;
    $('#memoQ').addEventListener('input', function (e) {
      S.memoQ = e.target.value; S.memoLimit = 60;
      clearTimeout(memoTimer);
      memoTimer = setTimeout(renderMemos, 150);
    });
    // Enter(휴대폰 '검색') = 바로 찾고 키보드 닫기
    $('#memoSearch').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('#memoQ');
      clearTimeout(memoTimer);
      S.memoQ = q.value; S.memoLimit = 60;
      renderMemos();
      q.blur();
    });
    $('#memoList').addEventListener('click', function (e) {
      var o = e.target.closest('[data-open]');
      if (o) { setDate(o.dataset.open); setTab('notes'); return; }
      var mm = e.target.closest('.memo-more');
      if (mm) {
        var a = mm.closest('.memo-item'), open = a.classList.toggle('clamp');
        mm.textContent = open ? '더 보기 ▾' : '접기 ▴';
        return;
      }
      if (e.target.closest('#memoNext')) { S.memoLimit += 60; renderMemos(); }
    });

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
      var w = e.target.closest('.wd');
      if (w && S.dowOpen) { setDowTarget(w.dataset.i); return; }   // 요일 칸 색: 달력의 요일 칸을 눌러 고르기
      var b = e.target.closest('button[data-date]'); if (!b) return;
      if (Date.now() - monthSwipedAt < 350) return;   // 손가락으로 밀어 달을 넘긴 바로 뒤의 누름은 건너뜀
      if (S.painting) { paintDate(b.dataset.date); return; }   // 바탕색 칠하는 중에는 날짜를 열지 않고 칠함
      var hit = storeInfoOk() && monthHitInfo(e, b);   // 일정을 눌렀으면 그 일정의 정보 창(시간 · 장소 · 메모). store.js가 예전 파일이면 예전처럼 그날 페이지
      if (hit) { openInfo(hit.date, hit.key); return; }
      setDate(b.dataset.date);
      setTab('sched'); // 날짜 숫자나 빈 곳을 누르면 그날 페이지 — 휴대폰에서는 그날의 일정 화면을 엽니다
    });
    // 휴대폰: 월간 달력을 손가락으로 좌우로 밀면 다음 달 · 지난달
    var mx = 0, my = 0, mt = 0, mTrack = false, mv = $('#monthView');
    mv.addEventListener('touchstart', function (e) {
      mTrack = e.touches.length === 1 && !e.target.closest('input,textarea,select,.paint-bar');
      if (!mTrack) return;
      mx = e.touches[0].clientX; my = e.touches[0].clientY; mt = Date.now();
    }, { passive: true });
    mv.addEventListener('touchend', function (e) {
      if (!mTrack) return; mTrack = false;
      var t = e.changedTouches[0], dx = t.clientX - mx, dy = t.clientY - my;
      if (Date.now() - mt < 800 && Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * 0.6) {
        monthSwipedAt = Date.now();
        shiftMonth(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
    mv.addEventListener('touchcancel', function () { mTrack = false; }, { passive: true });
    // 요일 칸 색
    $('#btnDow').addEventListener('click', function () { if (S.dowOpen) closeDow(); else openDow(); });
    $('#dowBar').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.id === 'dowDone') { closeDow(); return; }
      if (b.classList.contains('dtg')) { setDowTarget(b.dataset.t); return; }   // 바꿀 칸: 모두 / 일~토
      if (b.classList.contains('dws') && 'dow' in b.dataset) {
        if (b.dataset.dow === (S.dowTarget === 'all' ? dowAllSame() : dowAt(S.dowTarget))) return;   // 이미 그 색
        chooseDow(b.dataset.dow);
      }
    });
    // 직접 고르기: 고르는 동안은 화면에만 미리 보여 주고, 다 고르면 저장
    $('#dowBar').addEventListener('input', function (e) { if (e.target.id === 'dowColorIn') previewDow(e.target.value); });
    $('#dowBar').addEventListener('change', function (e) { if (e.target.id === 'dowColorIn') chooseDow(e.target.value); });
    // 날짜 바탕색 칠하기
    $('#btnPaint').addEventListener('click', function () { if (S.painting) closePaint(); else openPaint(); });
    $('#paintBar').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.id === 'paintDone') { closePaint(); return; }
      if (b.classList.contains('pbs')) {
        S.paintColor = b.dataset.bg || '';
        if (S.paintColor) writePref('paintColor', S.paintColor);
        renderPaintBar();
      }
    });
    // PC 크기 ↔ 휴대폰 크기가 바뀌면 월간 달력을 다시 그림
    if (mqWide) {
      var onWide = function () { if (S.view === 'month') renderMonth(); };
      if (mqWide.addEventListener) mqWide.addEventListener('change', onWide); else if (mqWide.addListener) mqWide.addListener(onWide);
    }
    // 창 크기·글꼴이 바뀌면 칸에 들어가는 일정 수를 다시 계산
    var fitTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(fitTimer);
      fitTimer = setTimeout(function () { if (S.view === 'month') fitMonth(); }, 120);
    });
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', function () { if (S.view === 'month') fitMonth(); });
    }
    $('#cellSmaller').addEventListener('click', function () { applyCellSize(S.cellSize - 1); });
    $('#cellBigger').addEventListener('click', function () { applyCellSize(S.cellSize + 1); });
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
    $('#btnTaskBold').addEventListener('click', function () {
      var t = findTask(S.editId); if (!t) return;
      saveEditText();
      t.bold = !t.bold;   // 화면에 바로 반영
      S.store.updateTask(t.id, { bold: t.bold, updated: Date.now() });
      renderSheet(); renderTasks();
      if (S.view === 'pending') renderPendingView();
    });
    $('#editText').addEventListener('blur', saveEditText);
    $('#editText').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); saveEditText(); $('#editText').blur(); }
    });
    $('#editPri').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-pri]'); var t = findTask(S.editId);
      if (!b || !t || b.dataset.pri === t.pri) return;
      // 글자를 바꾸면 그 글자의 끝으로. 진행 중인 일은 그 글자의 맨 위로
      var patch = { pri: b.dataset.pri, ord: Date.now(), updated: Date.now() };
      if (t.status === 'prog') { patch.ord = topOrd(t, b.dataset.pri); patch.progAt = Date.now(); }
      if (t.status === 'done') patch.ordPrev = null;
      S.store.updateTask(t.id, patch);
    });
    $('#btnUp').addEventListener('click', function () { moveTask(S.editId, -1); });
    $('#btnDown').addEventListener('click', function () { moveTask(S.editId, 1); });
    $('#statusGrid').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-st]'); var t = findTask(S.editId);
      if (!b || !t || b.disabled) return;
      var st = b.dataset.st;
      if (st === 'fwd') {   // '→ 옮기기': 아래의 옮길 날짜 칸으로
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
    // 다른 날로 옮기기: 고치던 내용을 먼저 저장하고 옮긴 뒤 편집 화면을 닫음 (할 일은 이 날 목록에서 사라짐)
    $('#btnFwdTomorrow').addEventListener('click', function () {
      var t = findTask(S.editId); if (!t) return;
      saveEditText();
      if (forward(t, addDays(t.date, 1))) closeSheet(true);
    });
    $('#btnFwdDate').addEventListener('click', function () {
      var t = findTask(S.editId); if (!t) return;
      saveEditText();
      if (forward(t, $('#fwdDate').value)) closeSheet(true);
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
        if (!$('#padFolderSheet').hidden) { closePadFolder(); return; }
        if (!$('#padPickSheet').hidden) { closePadPick(); return; }
        if (S.view === 'pad' && !$('#padMenu').hidden) { padMenu(false); return; }
        if (S.view === 'pad' && S.pad.open && $('#drawer').hidden) { padBackBtn(); return; }
        if (infoTarget()) { closeInfo(); return; }
        if (!$('#sheet').hidden) { closeSheet(); return; }
        if (!$('#drawer').hidden) { closeDrawer(); return; }
        if (schedToolsH) { closeSchedTools(); return; }
        if (rangeKey) { flushRange(true); closeRange(); renderSched(); return; }
        if (S.painting) { closePaint(); return; }
        if (S.dowOpen) { closeDow(); return; }
      }
      var ae = document.activeElement, tag = (ae && ae.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (ae && ae.isContentEditable) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!$('#sheet').hidden || !$('#infoSheet').hidden || !$('#drawer').hidden || $('#app').hidden || S.view !== 'day') return;
      if (e.key === 'ArrowLeft') setDate(addDays(S.date, -1));
      else if (e.key === 'ArrowRight') setDate(addDays(S.date, 1));
      else if (e.key === 't' || e.key === 'T') setDate(today());
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setTab('tasks'); $('#addInput').focus(); }
    });

    // 휴대폰: 좌우로 밀어 날짜 이동
    var sx = 0, sy = 0, st = 0, tracking = false;
    $('#dayView').addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1 || e.target.closest('input,textarea,button,.sched-row,.sched-tools,[contenteditable]')) { tracking = false; return; }
      tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }, { passive: true });
    $('#dayView').addEventListener('touchend', function (e) {
      if (!tracking) return; tracking = false;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st < 600 && Math.abs(dx) > 70 && Math.abs(dy) < 45) setDate(addDays(S.date, dx < 0 ? 1 : -1));
    }, { passive: true });

    // 앱을 다시 열었을 때 날짜가 바뀌었으면 오늘로
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { flushInfo(); flushRange(); flushNotes(); flushSched(); flushSpans(); flushValues(); saveEditText(); peSave(); return; }
      if (S.followToday && S.date !== today() && S.store && !infoTarget() && S.view !== 'pad') setDate(today());
      else { renderSched(); renderPendingBanner(); }
    });
    window.addEventListener('pagehide', function () { flushInfo(); flushNotes(); flushSched(); flushSpans(); flushValues(); peSave(); });
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
    if (S.followToday && S.date !== today() && !infoTarget() && S.view !== 'pad') { setDate(today()); return; }
    var nowH = pad(new Date().getHours()), isToday = S.date === today();
    $$('#schedList .sched-row').forEach(function (row) { row.classList.toggle('now', isToday && row.dataset.h === nowH); });
  }
  setInterval(tick, 60000);

  function shiftMonth(n) {
    var p = S.monthCursor.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1);
    S.monthCursor = d.getFullYear() + '-' + pad(d.getMonth() + 1);
    subscribeSched(S.monthCursor);
    renderMonth();
    var g = $('#mgrid');   // 넘어가는 쪽에서 달력이 살짝 미끄러져 들어옴
    g.classList.remove('slide-next', 'slide-prev');
    void g.offsetWidth;
    g.classList.add(n > 0 ? 'slide-next' : 'slide-prev');
    clearTimeout(g._slideTimer);
    g._slideTimer = setTimeout(function () { g.classList.remove('slide-next', 'slide-prev'); }, 400);
  }
  var monthSwipedAt = 0;
  /* 월간 달력에서 누른 곳의 일정: 시간 일정 줄, 또는 종일 일정 띠(띠는 아래 날짜 칸이 눌리므로 누른 위치로 찾음) */
  function monthHitInfo(e, cell) {
    var sc = e.target.closest('.sc');
    if (sc && cell.contains(sc) && sc.dataset.h) return { date: cell.dataset.date, key: sc.dataset.h };
    if (!e.clientX && !e.clientY) return null;   // 키보드로 누른 경우
    var bars = $$('#mgrid .adbar[data-r="' + cell.dataset.r + '"]');
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      if (b.hidden) continue;
      var r = b.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        var key = b.dataset.key, p = key.split('|');
        return isSpanKey(key) ? { date: cell.dataset.date, key: key } : { date: p[0], key: p[1] };
      }
    }
    return null;
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
