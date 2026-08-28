/* 录像系统：逐帧记录双方输入 → RLE 压缩 → localStorage 保存 / 回放 */
(function (global) {
  'use strict';
  var SG = global.SG = global.SG || {};
  var KEY = 'sga_replays';
  var MAX = 12;   // 最多保存 12 条（约几MB以内）

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }

  // 输入对象 → 位掩码
  var BITS = { left: 1, right: 2, up: 4, down: 8, punch: 16, kick: 32, dash: 64, charge: 128, ult: 256 };
  function pack(inp) {
    var m = 0;
    for (var k in BITS) if (inp && inp[k]) m |= BITS[k];
    return m;
  }
  function unpack(m) {
    var o = {};
    for (var k in BITS) if (m & BITS[k]) o[k] = true;
    return o;
  }
  // RLE: [m1, m2, count, m1, m2, count, ...]
  function rleEncode(frames) {
    var out = [], cur = null, run = 0;
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (cur && cur[0] === f[0] && cur[1] === f[1]) run++;
      else {
        if (cur) out.push(cur[0], cur[1], run);
        cur = f; run = 1;
      }
    }
    if (cur) out.push(cur[0], cur[1], run);
    return out;
  }
  function rleDecode(arr) {
    var frames = [];
    for (var i = 0; i < arr.length; i += 3) {
      for (var r = 0; r < arr[i + 2]; r++) frames.push([arr[i], arr[i + 1]]);
    }
    return frames;
  }

  SG.Replay = {
    // ---------- 录制 ----------
    recorder: null,
    start: function (meta) {
      this.recorder = { meta: meta, frames: [] };
    },
    tick: function (i1, i2) {
      if (this.recorder) this.recorder.frames.push([pack(i1), pack(i2)]);
    },
    cancel: function () { this.recorder = null; },
    finalize: function (resultText) {
      if (!this.recorder) return null;
      var rec = this.recorder; this.recorder = null;
      if (rec.frames.length < 60) return null;   // 太短不保存
      var item = {
        id: 'r' + Date.now(),
        name: (rec.meta.modeLabel || '对局') + ' · ' + new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        date: Date.now(),
        modeLabel: rec.meta.modeLabel || '对局',
        result: resultText || '',
        duration: rec.frames.length / 60,
        p1: rec.meta.p1, p2: rec.meta.p2,
        stage: rec.meta.stage, roundsToWin: rec.meta.roundsToWin,
        data: rleEncode(rec.frames)
      };
      var list = load();
      list.unshift(item);
      while (list.length > MAX) list.pop();
      save(list);
      return item;
    },

    // ---------- 列表管理 ----------
    list: function () { return load(); },
    get: function (id) { return load().find(function (r) { return r.id === id; }) || null; },
    remove: function (id) { save(load().filter(function (r) { return r.id !== id; })); },
    clear: function () { save([]); },

    // ---------- 分享：编码 / 解码 / 导入 ----------
    // 压缩为可粘贴的分享码（微信里当文本消息发送）
    encode: function (item) {
      var compact = {
        v: 1,
        m: item.modeLabel, r: item.result, d: Math.round(item.duration || 0),
        s: item.stage, w: item.roundsToWin,
        p1: { n: item.p1.name, c: item.p1.custom },
        p2: { n: item.p2.name, c: item.p2.custom },
        f: item.data
      };
      var json = JSON.stringify(compact);
      return 'SGA1.' + btoa(unescape(encodeURIComponent(json)));
    },
    // 解析分享码或完整分享链接（含 #r=），失败返回 null
    decode: function (str) {
      try {
        str = String(str);
        var i = str.indexOf('SGA1.');
        if (i < 0) return null;
        var b64 = str.slice(i + 5).replace(/[\s"#&]+/g, '');
        var json = decodeURIComponent(escape(atob(b64)));
        var c = JSON.parse(json);
        if (!c || c.v !== 1 || !c.f || !c.p1 || !c.p2) return null;
        return {
          id: 'r' + Date.now(),
          name: (c.m || '对局') + ' · 分享',
          date: Date.now(),
          modeLabel: c.m || '对局', result: c.r || '', duration: c.d || 0,
          stage: c.s || 'dojo', roundsToWin: c.w || 2,
          p1: { name: c.p1.n, custom: c.p1.c }, p2: { name: c.p2.n, custom: c.p2.c },
          data: c.f
        };
      } catch (e) { return null; }
    },
    shareLink: function (item) {
      var base = global.location ? global.location.href.split('#')[0] : '';
      return base + '#r=' + this.encode(item);
    },
    fromHash: function () {
      if (!global.location || global.location.hash.indexOf('#r=') !== 0) return null;
      return this.decode(global.location.hash.slice(3));
    },
    importItem: function (item) {
      var list = load();
      item.id = 'r' + Date.now();
      list.unshift(item);
      while (list.length > MAX) list.pop();
      save(list);
      return item;
    },

    // ---------- 回放 ----------
    player: null,
    beginPlayback: function (item) {
      this.player = {
        item: item, frames: rleDecode(item.data), idx: 0,
        p1: { name: item.p1.name, custom: item.p1.custom },
        p2: { name: item.p2.name, custom: item.p2.custom }
      };
      return this.player;
    },
    nextInputs: function () {
      var p = this.player;
      if (!p) return null;
      if (p.idx >= p.frames.length) return null;   // 播放结束
      var f = p.frames[p.idx++];
      return { p1: unpack(f[0]), p2: unpack(f[1]) };
    },
    progress: function () {
      var p = this.player;
      return p ? p.idx / p.frames.length : 0;
    },
    endPlayback: function () { this.player = null; },
    unpack: unpack
  };
})(typeof window !== 'undefined' ? window : globalThis);
