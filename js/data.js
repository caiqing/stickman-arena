/* 数据层：自定义选项 / 武器技能 / 关卡剧情 / Boss 配置 */
(function (global) {
  'use strict';
  var SG = global.SG = global.SG || {};

  // ---------- 身体颜色 ----------
  var COLORS = [
    { id: 'red',    name: '赤焰红', hex: '#e84545' },
    { id: 'orange', name: '落日橙', hex: '#f08c2e' },
    { id: 'yellow', name: '明黄',   hex: '#f2d02f' },
    { id: 'green',  name: '翠竹绿', hex: '#4caf50' },
    { id: 'cyan',   name: '碧波青', hex: '#26c6da' },
    { id: 'blue',   name: '深海蓝', hex: '#4a7de0' },
    { id: 'purple', name: '紫霞',   hex: '#9c5ce0' },
    { id: 'pink',   name: '樱花粉', hex: '#f06fa0' },
    { id: 'black',  name: '玄墨黑', hex: '#3a3a44' },
    { id: 'white',  name: '月白',   hex: '#e8e8f0' },
    { id: 'brown',  name: '大地棕', hex: '#9b6a3f' },
    { id: 'gold',   name: '鎏金',   hex: '#f5b942', locked: 6 },   // 通关第6关
    { id: 'shadow', name: '暗影',   hex: '#2a2438', locked: 6 }
  ];

  var HAIRS = [
    { id: 'none',   name: '光头' },
    { id: 'short',  name: '短发' },
    { id: 'spiky',  name: '刺猬头' },
    { id: 'pony',   name: '马尾' },
    { id: 'long',   name: '披肩长发' },
    { id: 'bun',    name: '丸子头' },
    { id: 'twintail', name: '双马尾' },
    { id: 'curly',  name: '卷发' }
  ];

  var HATS = [
    { id: 'none',     name: '不戴' },
    { id: 'cap',      name: '鸭舌帽' },
    { id: 'straw',    name: '草帽' },
    { id: 'headband', name: '武者发带' },
    { id: 'helmet',   name: '战盔',   locked: 3 },   // 通关第3关
    { id: 'wizard',   name: '巫师帽', locked: 4 },
    { id: 'crown',    name: '盟主金冠', locked: 6 }
  ];

  var CLOTHES = [
    { id: 'none',   name: '无' },
    { id: 'scarf',  name: '飘扬围巾' },
    { id: 'belt',   name: '武者腰带' },
    { id: 'skirt',  name: '短裙' },
    { id: 'cape',   name: '英雄披风', locked: 2 },  // 通关第2关
    { id: 'armor',  name: '护心铠甲', locked: 5 },
    { id: 'ninja',  name: '忍者蒙面', locked: 4 }
  ];

  // ---------- 武器（决定攻击段数/伤害/速度 与 大招技能） ----------
  var WEAPONS = [
    { id: 'fist',    name: '赤手拳法', dmg: 1.0,  spd: 1.15, range: 1.0,
      desc: '空手迅捷，连击流畅', ult: { name: '升龙拳', type: 'upper', dmg: 30 },
      locked: 0 },
    { id: 'sword',   name: '青锋铁剑', dmg: 1.1,  spd: 1.0,  range: 1.15,
      desc: '攻守均衡的武林正道', ult: { name: '旋风斩', type: 'spin', dmg: 36 },
      locked: 1 },
    { id: 'spear',   name: '红缨长枪', dmg: 1.05, spd: 0.9,  range: 1.4,
      desc: '一寸长一寸强', ult: { name: '破空突刺', type: 'dash', dmg: 32 },
      locked: 2 },
    { id: 'hammer',  name: '崩山战锤', dmg: 1.4,  spd: 0.72, range: 1.1,
      desc: '力劈华山，一锤定音', ult: { name: '崩地震', type: 'quake', dmg: 34 },
      locked: 3 },
    { id: 'staff',   name: '烈焰法杖', dmg: 0.95, spd: 1.0,  range: 1.2,
      desc: '远程施法，火球灼敌', ult: { name: '烈焰火球', type: 'fire', dmg: 30 },
      locked: 4 },
    { id: 'nunchaku', name: '影风双截棍', dmg: 0.9, spd: 1.35, range: 1.05,
      desc: '快如闪电，密不透风', ult: { name: '影连击', type: 'rush', dmg: 33 },
      locked: 5 }
  ];

  // ---------- 装备（被动加成，仅可携带一件） ----------
  var GEARS = [
    { id: 'none',  name: '不带装备', },
    { id: 'boots', name: '疾风之靴', spd: 1.18, desc: '移动速度 +18%', locked: 2 },
    { id: 'mirror',name: '护心镜',   hp: 30,    desc: '最大生命 +30', locked: 4 },
    { id: 'bracer',name: '力量护腕', dmg: 1.12, desc: '伤害 +12%', locked: 5 }
  ];

  // ---------- 战斗场地 ----------
  var STAGES = [
    { id: 'dojo',   name: '演武场', sky: ['#2b3358', '#151a2e'], ground: '#4a3b2a', deco: 'dojo' },
    { id: 'bamboo', name: '竹林',   sky: ['#2e5d46', '#12241c'], ground: '#3c5a34', deco: 'bamboo' },
    { id: 'desert', name: '大漠',   sky: ['#c9863f', '#5a3418'], ground: '#caa05a', deco: 'desert' },
    { id: 'snow',   name: '雪山',   sky: ['#7fa8d8', '#2a3c58'], ground: '#dfe8f2', deco: 'snow' },
    { id: 'volcano',name: '火山',   sky: ['#4a1414', '#1a0a0a'], ground: '#3a2420', deco: 'volcano' },
    { id: 'castle', name: '暗影王城', sky: ['#2a1a4a', '#0d0a1a'], ground: '#241a38', deco: 'castle' }
  ];

  function bc(color, hair, hat, clothes, weapon) {
    return { color: color, hair: hair, hat: hat, clothes: clothes, weapon: weapon, gear: 'none' };
  }

  // ---------- 故事模式：6 关 ----------
  var STORY = [
    {
      id: 1, name: '新手村·立威', stage: 'dojo', scoreBase: 1000,
      desc: '在村里比武场打出名声',
      boss: { name: '村头混混·阿棍', hp: 80, custom: bc('brown', 'spiky', 'none', 'belt', 'fist'),
              ai: { aggr: 0.35, block: 0.1, jump: 0.05, reaction: 0.5 } },
      intro: [
        { who: '旁白', text: '墨水大陆上有一个火柴人王国，三年一度的"武林大会"即将召开。' },
        { who: '长老', text: '年轻人，想上武林大会的擂台？先在村里打出名气吧！' },
        { who: '阿棍', text: '嘿嘿，就凭你？村口这条街我还从来没输过！' },
        { who: '旁白', text: '战胜阿棍，拿到长老的信物，踏上闯荡武林之路！' }
      ],
      outro: [
        { who: '阿棍', text: '好……好厉害！大哥我服了，这条街以后归你罩！' },
        { who: '长老', text: '干得漂亮！这柄"青锋铁剑"赠予你，去闯出更大的名堂吧。' }
      ],
      rewards: [{ type: 'weapon', id: 'sword' }]
    },
    {
      id: 2, name: '竹林·飞刀客', stage: 'bamboo', scoreBase: 1200,
      desc: '竹林深处藏着身法如风的刺客',
      boss: { name: '飞刀客·燕子三', hp: 95, custom: bc('cyan', 'pony', 'headband', 'scarf', 'nunchaku'),
              ai: { aggr: 0.5, block: 0.2, jump: 0.15, reaction: 0.4, rush: true } },
      intro: [
        { who: '旁白', text: '穿过迷雾竹林，脚下落叶无声。' },
        { who: '燕子三', text: '停下！这片竹林是"暗影军团"的地盘。' },
        { who: '旁白', text: '原来入侵王国的暗影军团，已经在各处安插了爪牙……' },
        { who: '燕子三', text: '赢了我就告诉你暗影武帝的老巢。出招吧！' }
      ],
      outro: [
        { who: '燕子三', text: '你的速度……比我快。好吧，我燕子三认赌服输！' },
        { who: '燕子三', text: '送你"红缨长枪"和"疾风之靴"。记住，暗影武帝就住在北方的暗影王城！' }
      ],
      rewards: [{ type: 'weapon', id: 'spear' }, { type: 'gear', id: 'boots' }]
    },
    {
      id: 3, name: '大漠·沙之巨汉', stage: 'desert', scoreBase: 1400,
      desc: '大漠废墟中的力量型守护者',
      boss: { name: '沙漠之鹰·砂大锤', hp: 115, custom: bc('yellow', 'none', 'straw', 'belt', 'hammer'),
              ai: { aggr: 0.55, block: 0.35, jump: 0.05, reaction: 0.42, heavy: true } },
      intro: [
        { who: '旁白', text: '黄沙漫天，一座半埋的古代王陵静静矗立。' },
        { who: '砂大锤', text: '想过去？先接我三锤！我的锤下从不留活口！' },
        { who: '旁白', text: '此人力大无穷，硬拼吃亏，要以巧破千斤。' }
      ],
      outro: [
        { who: '砂大锤', text: '轰……轰不动你？你这细胳膊小伙有点东西！' },
        { who: '砂大锤', text: '这把"崩山战锤"跟了我二十年，今天送你！还有护身的"战盔"也拿去。' }
      ],
      rewards: [{ type: 'weapon', id: 'hammer' }, { type: 'hat', id: 'helmet' }]
    },
    {
      id: 4, name: '雪山·冰霜法师', stage: 'snow', scoreBase: 1600,
      desc: '会远程施法的冰雪法师',
      boss: { name: '冰霜法师·凛', hp: 110, custom: bc('white', 'long', 'wizard', 'cape', 'staff'),
              ai: { aggr: 0.4, block: 0.25, jump: 0.1, reaction: 0.35, ranged: true } },
      intro: [
        { who: '旁白', text: '雪山之巅，风雪呼啸，一座冰晶祭坛泛着幽光。' },
        { who: '凛', text: '圣火令的碎片，就封在这座祭坛里。你是来送死的吗？' },
        { who: '旁白', text: '圣火令！原来暗影军团抢走的国宝碎片在这里！' },
        { who: '凛', text: '接得住我的冰霜法术，碎片就归你。' }
      ],
      outro: [
        { who: '凛', text: '冰雪……融化了。你的火焰比我烧得更旺。' },
        { who: '凛', text: '圣火令碎片给你。这根"烈焰法杖"与"巫师帽"，配你正好。' }
      ],
      rewards: [{ type: 'weapon', id: 'staff' }, { type: 'hat', id: 'wizard' },
                { type: 'gear', id: 'mirror' }]
    },
    {
      id: 5, name: '火山·烈焰武士', stage: 'volcano', scoreBase: 1800,
      desc: '暗影军团的先锋大将',
      boss: { name: '烈焰武士·焱', hp: 130, custom: bc('red', 'spiky', 'helmet', 'armor', 'sword'),
              ai: { aggr: 0.72, block: 0.3, jump: 0.12, reaction: 0.3 } },
      intro: [
        { who: '旁白', text: '岩浆翻涌的火山洞窟，热浪扑面。' },
        { who: '焱', text: '我是暗影军团先锋——焱！圣火令集齐了也没用，王城你进不去！' },
        { who: '旁白', text: '打败他，暗影王城的大门就再也没有屏障了！' }
      ],
      outro: [
        { who: '焱', text: '不可能……我的烈焰剑法，从没输过……' },
        { who: '旁白', text: '焱倒下了。"护心铠甲"与"力量护腕"归你了。最后一战——暗影王城！' }
      ],
      rewards: [{ type: 'clothes', id: 'armor' }, { type: 'gear', id: 'bracer' }]
    },
    {
      id: 6, name: '王城·暗影武帝', stage: 'castle', scoreBase: 2500,
      desc: '最终决战！夺回圣火令，拯救王国',
      finalBoss: true,
      boss: { name: '暗影武帝·玄', hp: 150, custom: bc('shadow', 'none', 'crown', 'cape', 'nunchaku'),
              ai: { aggr: 0.65, block: 0.4, jump: 0.15, reaction: 0.25, final: true } },
      intro: [
        { who: '旁白', text: '暗影王城，紫电撕裂夜空。王座之上，暗影武帝缓缓起身。' },
        { who: '玄', text: '三百年了，终于有人打到我的王座前。把圣火令交出来吧，小家伙。' },
        { who: '旁白', text: '这是最后一战。集齐的圣火令在剑鞘中嗡嗡作响——为了王国！' }
      ],
      outro: [
        { who: '玄', text: '呵……呵啊……好一个武林奇才。圣火令……还给你们……' },
        { who: '旁白', text: '暗影武帝化作黑烟消散，圣火重燃，王国恢复光明！' },
        { who: '旁白', text: '恭喜通关！你获得了"盟主金冠"与"武林盟主"称号——本届武林大会，以你为尊！' }
      ],
      rewards: [{ type: 'hat', id: 'crown' }, { type: 'color', id: 'gold' },
                { type: 'color', id: 'shadow' }, { type: 'title', id: '盟主' }]
    }
  ];

  // ---------- 武林大会预设选手（全家总动员） ----------
  var FAMILY_PRESETS = [
    { name: '爸爸', custom: bc('blue', 'short', 'none', 'belt', 'fist') },
    { name: '妈妈', custom: bc('pink', 'twintail', 'none', 'skirt', 'fist') },
    { name: '大宝', custom: bc('green', 'spiky', 'cap', 'none', 'fist') },
    { name: '小宝', custom: bc('orange', 'bun', 'none', 'scarf', 'fist') },
    { name: '哥哥', custom: bc('cyan', 'pony', 'headband', 'none', 'fist') },
    { name: '姐姐', custom: bc('purple', 'long', 'none', 'skirt', 'fist') },
    { name: '弟弟', custom: bc('yellow', 'short', 'cap', 'scarf', 'fist') },
    { name: '妹妹', custom: bc('red', 'twintail', 'none', 'skirt', 'fist') },
    { name: '爷爷', custom: bc('white', 'curly', 'straw', 'belt', 'fist') },
    { name: '奶奶', custom: bc('brown', 'bun', 'headband', 'skirt', 'fist') },
    { name: '外公', custom: bc('black', 'none', 'straw', 'belt', 'fist') },
    { name: '外婆', custom: bc('purple', 'bun', 'none', 'scarf', 'fist') },
    { name: '叔叔', custom: bc('black', 'spiky', 'none', 'belt', 'fist') },
    { name: '阿姨', custom: bc('green', 'curly', 'none', 'skirt', 'fist') }
  ];

  // ---------- 工具 ----------
  function firstBy(list, key, val) {
    for (var i = 0; i < list.length; i++) if (list[i][key] === val) return list[i];
    return null;
  }

  SG.DATA = {
    COLORS: COLORS, HAIRS: HAIRS, HATS: HATS, CLOTHES: CLOTHES,
    WEAPONS: WEAPONS, GEARS: GEARS, STAGES: STAGES, STORY: STORY,
    FAMILY_PRESETS: FAMILY_PRESETS,
    stageById: function (id) { return firstBy(STAGES, 'id', id) || STAGES[0]; },
    weaponById: function (id) { return firstBy(WEAPONS, 'id', id) || WEAPONS[0]; },
    gearById: function (id) { return firstBy(GEARS, 'id', id) || GEARS[0]; },
    colorById: function (id) { return firstBy(COLORS, 'id', id) || COLORS[0]; },

    defaultCustom: function () { return bc('red', 'short', 'none', 'none', 'fist'); },
    randomCustom: function (unlockedOnly) {
      function pick(list) {
        var pool = list.filter(function (it) { return !unlockedOnly || !it.locked; });
        return pool[Math.floor(Math.random() * pool.length)].id;
      }
      return {
        color: pick(COLORS), hair: pick(HAIRS), hat: pick(HATS),
        clothes: pick(CLOTHES), weapon: pick(WEAPONS), gear: pick(GEARS),
        name: ''
      };
    },
    // 故事模式主角默认配置持久化
    storyCustom: null
  };
})(typeof window !== 'undefined' ? window : globalThis);
