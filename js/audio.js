/* 音频引擎：WebAudio 全程序化合成（音效 + 循环BGM），无外部素材 */
(function (global) {
  'use strict';
  var SG = global.SG = global.SG || {};

  var ctx = null, master = null, musicBus = null, sfxBus = null;
  var vol = { master: 0.8, music: 0.55, sfx: 0.9 };
  var curMusic = null, schedTimer = null, stepIdx = 0, nextTime = 0;

  // ---------- 音名 → 频率 ----------
  var NOTE_RE = /^([A-G])(#|b)?(-?\d)$/;
  var BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(name) {
    var m = NOTE_RE.exec(name);
    if (!m) return 0;
    var v = BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
    return v;
  }
  function freq(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  // ---------- 曲目库 ----------
  // 每轨: 16步/小节, 数组长度 = bars*16; 0=休止; 音符用音名
  function bar(seq) { return seq; }
  function rep(seq, n) {
    var out = [];
    for (var i = 0; i < n; i++) out = out.concat(seq);
    return out;
  }

  var TRACKS = {
    menu: {
      bpm: 84, wave: 'triangle', bassWave: 'sine',
      bass: rep(bar(['C2', 0, 0, 0, 'G2', 0, 0, 0, 'A2', 0, 0, 0, 'E2', 0, 0, 0,
                     'F2', 0, 0, 0, 'C2', 0, 0, 0, 'G2', 0, 0, 0, 'G2', 0, 0, 0]), 2),
      lead: rep(bar(['E4', 0, 'G4', 0, 'A4', 0, 'G4', 0, 'E4', 0, 'D4', 0, 'C4', 0, 0, 0,
                     'D4', 0, 'E4', 0, 'F4', 0, 'E4', 0, 'D4', 0, 0, 0, 0, 0, 0, 0]), 2),
      drums: rep(bar([0, 0, 'h', 0, 0, 0, 'h', 0, 0, 0, 'h', 0, 0, 0, 'h', 0]), 4),
      leadVol: 0.16
    },
    battle: {
      bpm: 132, wave: 'square', bassWave: 'sawtooth',
      bass: rep(bar(['A2', 0, 'A2', 0, 'A2', 0, 'E2', 0, 'A2', 0, 'A2', 'C3', 'B2', 0, 'E2', 0,
                     'F2', 0, 'F2', 0, 'F2', 0, 'C2', 0, 'G2', 0, 'G2', 0, 'E2', 0, 'E2', 0]), 2),
      lead: rep(bar(['A4', 0, 'C5', 'A4', 'E5', 0, 'C5', 0, 'D5', 0, 'C5', 0, 'B4', 0, 'G4', 0,
                     'A4', 0, 'C5', 'A4', 'E5', 0, 'G5', 0, 'E5', 0, 'D5', 'C5', 'B4', 0, 0, 0]), 2),
      drums: rep(bar(['k', 0, 'h', 0, 's', 0, 'h', 'h', 'k', 0, 'h', 0, 's', 'h', 'h', 0]), 4),
      leadVol: 0.13
    },
    boss: {
      bpm: 142, wave: 'sawtooth', bassWave: 'sawtooth',
      bass: rep(bar(['E2', 'E2', 0, 'E2', 0, 'E2', 'G2', 0, 'E2', 'E2', 0, 'D2', 0, 'D2', 'D2', 0,
                     'F2', 'F2', 0, 'F2', 0, 'F2', 'A2', 0, 'B2', 0, 'A2', 0, 'G2', 0, 'F2', 0]), 2),
      lead: rep(bar(['B4', 0, 'E5', 0, 'F5', 'E5', 0, 'B4', 'A4', 0, 'B4', 0, 'G4', 0, 0, 0,
                     'C5', 0, 'F5', 0, 'G5', 'F5', 0, 'C5', 'B4', 0, 'C5', 0, 'A4', 0, 0, 0]), 2),
      drums: rep(bar(['k', 'k', 'h', 0, 's', 0, 'h', 'k', 'k', 'k', 'h', 0, 's', 0, 's', 'h']), 4),
      leadVol: 0.15
    },
    dance1: {
      bpm: 120, wave: 'square', bassWave: 'triangle',
      bass: rep(bar(['C2', 0, 'C2', 0, 'G2', 0, 'C2', 0, 'A2', 0, 'A2', 0, 'G2', 0, 'E2', 0,
                     'F2', 0, 'F2', 0, 'C2', 0, 'F2', 0, 'G2', 0, 'B2', 0, 'C3', 0, 'G2', 0]), 2),
      lead: rep(bar(['E4', 'G4', 'C5', 0, 'G4', 0, 'E4', 0, 'A4', 'C5', 'E5', 0, 'C5', 0, 'A4', 0,
                     'F4', 'A4', 'C5', 0, 'A4', 0, 'F4', 0, 'G4', 'B4', 'D5', 0, 'B4', 0, 'G4', 0]), 2),
      drums: rep(bar(['k', 0, 'h', 0, 's', 0, 'h', 0, 'k', 0, 'h', 0, 's', 0, 'h', 'h']), 4),
      leadVol: 0.16
    },
    dance2: {
      bpm: 96, wave: 'triangle', bassWave: 'sine',
      bass: rep(bar(['D2', 0, 0, 'A2', 0, 0, 'D2', 0, 'B1', 0, 0, 'F#2', 0, 0, 'B1', 0,
                     'G2', 0, 0, 'D3', 0, 0, 'G2', 0, 'A2', 0, 0, 'E3', 0, 'D3', 'A2', 0]), 2),
      lead: rep(bar(['F#4', 0, 'A4', 0, 'D5', 0, 'A4', 'F#4', 'E4', 0, 'F#4', 0, 'B4', 0, 0, 0,
                     'G4', 0, 'B4', 0, 'D5', 0, 'B4', 'G4', 'A4', 0, 'B4', 0, 'E5', 0, 0, 0]), 2),
      drums: rep(bar(['k', 0, 0, 'h', 0, 's', 0, 0, 'k', 0, 'h', 0, 's', 0, 'h', 0]), 4),
      leadVol: 0.18
    },
    dance3: {
      bpm: 145, wave: 'sawtooth', bassWave: 'square',
      bass: rep(bar(['E2', 'E2', 'E3', 'E2', 'E2', 'E3', 'E2', 'E3',
                     'C2', 'C2', 'C3', 'C2', 'D2', 'D2', 'D3', 'D2']), 4),
      lead: rep(bar(['E5', 0, 'B4', 'E5', 'G5', 0, 'E5', 'B4', 'C5', 0, 'G4', 'C5', 'D5', 0, 'B4', 0]), 4),
      drums: rep(bar(['k', 'h', 'k', 'h', 's', 'h', 'k', 'h', 'k', 'h', 'k', 'h', 's', 'h', 's', 'h']), 4),
      leadVol: 0.12
    },
    boat: {
      bpm: 104, wave: 'triangle', bassWave: 'sine',
      bass: rep(bar(['C2', 0, 0, 0, 'G2', 0, 0, 0, 'F2', 0, 0, 0, 'C2', 0, 0, 0]), 4),
      lead: rep(bar(['E4', 0, 'G4', 0, 'C5', 0, 'G4', 0, 'A4', 0, 'G4', 0, 'E4', 0, 'D4', 0,
                     'E4', 0, 'G4', 0, 'A4', 0, 'C5', 0, 'D5', 0, 'C5', 0, 'G4', 0, 'E4', 0]), 2),
      drums: rep(bar([0, 0, 'h', 0, 0, 0, 'h', 0, 0, 0, 'h', 0, 0, 0, 'h', 0]), 4),
      leadVol: 0.16
    },
    fly: {
      bpm: 112, wave: 'square', bassWave: 'triangle',
      bass: rep(bar(['A2', 0, 'E3', 0, 'A2', 0, 'E3', 0, 'F2', 0, 'C3', 0, 'G2', 0, 'D3', 0]), 4),
      lead: rep(bar(['A4', 'B4', 'C5', 'E5', 0, 'C5', 'B4', 0, 'A4', 0, 'G4', 'A4', 0, 0, 0, 0,
                     'C5', 'D5', 'E5', 'G5', 0, 'E5', 'D5', 0, 'C5', 0, 'B4', 'C5', 0, 0, 0, 0]), 2),
      drums: rep(bar(['k', 0, 'h', 'h', 's', 0, 'h', 0, 'k', 0, 'h', 'h', 's', 0, 'h', 'h']), 4),
      leadVol: 0.13
    },
    ceremony: {
      bpm: 100, wave: 'square', bassWave: 'square',
      bass: rep(bar(['C2', 0, 'C2', 0, 'F2', 0, 'F2', 0, 'G2', 0, 'G2', 0, 'C2', 0, 'G2', 0]), 4),
      lead: rep(bar(['G4', 0, 'C5', 0, 'E5', 0, 'G5', 0, 'E5', 0, 'C5', 0, 'F5', 0, 'E5', 'D5',
                     'E5', 0, 'C5', 0, 'G4', 0, 'E5', 0, 'D5', 0, 'B4', 0, 'C5', 0, 0, 0]), 2),
      drums: rep(bar(['k', 0, 'k', 0, 'k', 0, 'k', 0]), 8),
      leadVol: 0.16
    }
  };

  // ---------- 初始化 ----------
  function ensureCtx() {
    if (ctx) return true;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = vol.master; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    return true;
  }

  SG.Audio = {
    init: function () { if (ensureCtx() && ctx.state === 'suspended') ctx.resume(); },
    unlock: function () { this.init(); },
    setVolumes: function (v) {
      for (var k in v) if (vol[k] !== undefined) vol[k] = v[k];
      if (master) master.gain.value = vol.master;
      if (musicBus) musicBus.gain.value = vol.music;
      if (sfxBus) sfxBus.gain.value = vol.sfx;
    },
    getVolumes: function () { return { master: vol.master, music: vol.music, sfx: vol.sfx }; },

    // ---------- 音效 ----------
    sfx: function (name) {
      if (!ensureCtx()) return;
      if (ctx.state === 'suspended') { ctx.resume(); }
      var t = ctx.currentTime, bus = sfxBus;
      switch (name) {
        case 'click':
          blip(t, 760, 540, 0.06, 'square', 0.16, bus); break;
        case 'punch':
          noise(t, 0.07, 0.28, 'bandpass', 1400, 1.2, bus);
          blip(t, 240, 120, 0.06, 'sine', 0.12, bus); break;
        case 'hit':
          blip(t, 190, 60, 0.13, 'sine', 0.5, bus);
          noise(t, 0.06, 0.3, 'lowpass', 900, 1, bus); break;
        case 'hitHeavy':
          blip(t, 130, 36, 0.22, 'sine', 0.7, bus);
          blip(t, 90, 30, 0.25, 'triangle', 0.5, bus);
          noise(t, 0.12, 0.4, 'lowpass', 700, 1, bus); break;
        case 'block':
          blip(t, 1250, 900, 0.07, 'square', 0.2, bus);
          noise(t, 0.05, 0.16, 'highpass', 3000, 1, bus); break;
        case 'jump':
          blip(t, 300, 640, 0.13, 'sine', 0.22, bus); break;
        case 'land':
          blip(t, 110, 50, 0.09, 'sine', 0.3, bus); break;
        case 'dash':
          noise(t, 0.14, 0.24, 'bandpass', 900, 2, bus); break;
        case 'chargeTick':
          blip(t, 340, 560, 0.1, 'sawtooth', 0.1, bus); break;
        case 'ultReady':
          [660, 880, 1320].forEach(function (f, i) {
            blip(t + i * 0.09, f, f, 0.18, 'triangle', 0.22, bus);
          }); break;
        case 'ult':
          blip(t, 90, 26, 0.6, 'sine', 0.85, bus);
          noise(t, 0.4, 0.5, 'lowpass', 1200, 0.8, bus);
          blip(t + 0.05, 520, 1300, 0.3, 'sawtooth', 0.14, bus); break;
        case 'fire':
          noise(t, 0.3, 0.32, 'bandpass', 600, 1.5, bus);
          blip(t, 200, 700, 0.2, 'sawtooth', 0.1, bus); break;
        case 'ko':
          blip(t, 220, 218, 1.4, 'sine', 0.5, bus);
          blip(t, 227, 224, 1.4, 'sine', 0.4, bus);
          blip(t, 440, 110, 0.9, 'triangle', 0.25, bus);
          noise(t, 0.3, 0.3, 'lowpass', 500, 1, bus); break;
        case 'bell':
          blip(t, 880, 876, 0.5, 'triangle', 0.3, bus);
          blip(t, 1760, 1750, 0.3, 'sine', 0.12, bus); break;
        case 'win':
          ['C5', 'E5', 'G5', 'C6'].forEach(function (n, i) {
            blip(t + i * 0.13, freq(midi(n)), freq(midi(n)), 0.22, 'square', 0.18, bus);
          }); break;
        case 'lose':
          ['E4', 'C4', 'A3'].forEach(function (n, i) {
            blip(t + i * 0.2, freq(midi(n)), freq(midi(n)) * 0.97, 0.3, 'triangle', 0.2, bus);
          }); break;
        case 'unlock':
          ['C5', 'D5', 'E5', 'G5', 'C6'].forEach(function (n, i) {
            blip(t + i * 0.08, freq(midi(n)), freq(midi(n)), 0.2, 'triangle', 0.2, bus);
          }); break;
        case 'coin':
          blip(t, 1200, 1900, 0.09, 'square', 0.16, bus); break;
        case 'splash':
          noise(t, 0.25, 0.3, 'lowpass', 900, 0.7, bus); break;
        case 'danceHit':
          blip(t, freq(midi('A5')), freq(midi('A5')), 0.14, 'triangle', 0.22, bus);
          blip(t + 0.02, freq(midi('E6')), freq(midi('E6')), 0.1, 'sine', 0.1, bus); break;
        case 'danceMiss':
          blip(t, 160, 90, 0.18, 'sawtooth', 0.16, bus); break;
        case 'countTick':
          blip(t, 520, 520, 0.1, 'square', 0.15, bus); break;
      }
    },

    // ---------- 背景音乐 ----------
    music: function (name) {
      if (!TRACKS[name]) return;
      if (curMusic === name) return;
      this.stopMusic();
      if (!ensureCtx()) return;
      curMusic = name;
      var tr = TRACKS[name];
      stepIdx = 0;
      nextTime = ctx.currentTime + 0.08;
      var stepDur = 60 / tr.bpm / 4;
      var total = tr.bass.length;
      schedTimer = setInterval(function () {
        if (!ctx || ctx.state !== 'running') return;
        while (nextTime < ctx.currentTime + 0.14) {
          scheduleStep(tr, stepIdx % total, nextTime, stepDur);
          stepIdx++;
          nextTime += stepDur;
        }
      }, 30);
    },
    stopMusic: function () {
      if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
      curMusic = null;
    },
    currentMusic: function () { return curMusic; },
    trackInfo: function (name) {
      var tr = TRACKS[name];
      return tr ? { bpm: tr.bpm, steps: tr.bass.length } : null;
    }
  };

  // ---------- BGM 调度 ----------
  function scheduleStep(tr, i, when, stepDur) {
    var b = tr.bass[i % tr.bass.length];
    if (b) noteVoice(b, when, stepDur * 1.8, tr.bassWave || 'sine', 0.16, musicBus);
    var l = tr.lead[i % tr.lead.length];
    if (l) noteVoice(l, when, stepDur * 1.6, tr.wave, tr.leadVol || 0.14, musicBus);
    var d = tr.drums[i % tr.drums.length];
    if (d === 'k') kick(when);
    else if (d === 's') snare(when);
    else if (d === 'h') hat(when);
  }

  function noteVoice(name, when, dur, wave, vol, bus) {
    var f = freq(midi(name));
    if (!f) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.value = f;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(bus);
    o.start(when); o.stop(when + dur + 0.05);
  }

  function kick(when) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, when);
    o.frequency.exponentialRampToValueAtTime(40, when + 0.11);
    g.gain.setValueAtTime(0.4, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.13);
    o.connect(g); g.connect(musicBus);
    o.start(when); o.stop(when + 0.16);
  }

  function snare(when) {
    var src = noiseSrc();
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.22, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.11);
    src.connect(f); f.connect(g); g.connect(musicBus);
    src.start(when); src.stop(when + 0.14);
  }

  function hat(when) {
    var src = noiseSrc();
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.09, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
    src.connect(f); f.connect(g); g.connect(musicBus);
    src.start(when); src.stop(when + 0.06);
  }

  // ---------- 基础合成 ----------
  function noiseSrc() {
    var len = ctx.sampleRate * 0.5;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    return src;
  }

  function blip(t, f0, f1, dur, wave, vol, bus) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noise(t, dur, vol, type, freq, q, bus) {
    var src = noiseSrc();
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t); src.stop(t + dur + 0.05);
  }
})(typeof window !== 'undefined' ? window : globalThis);
