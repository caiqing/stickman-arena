/* 评分榜：本地 localStorage 存储，按分数排序 */
(function (global) {
  'use strict';
  var SG = global.SG = global.SG || {};
  var KEY = 'sga_leaderboard';
  var MAX = 50;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  SG.Board = {
    // entry: {name, mode, score, detail}  返回排名（0 为第一，被挤掉则为 -1）
    add: function (entry) {
      var item = {
        name: entry.name || '无名战士',
        mode: entry.mode || '对局',
        score: Math.round(entry.score || 0),
        detail: entry.detail || '',
        date: Date.now()
      };
      var list = load();
      list.push(item);
      list.sort(function (a, b) { return b.score - a.score; });
      if (list.length > MAX) list.length = MAX;
      save(list);
      return list.indexOf(item);
    },
    top: function (n) { return load().slice(0, n || 20); },
    all: function () { return load(); },
    clear: function () { save([]); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
