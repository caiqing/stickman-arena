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
  // moves 为招式演示场的表演脚本：name 名称 / desc 招数说明 / anim 动作脚本 / dur 时长
  var WEAPONS = [
    { id: 'fist',    name: '赤手拳法', dmg: 1.0,  spd: 1.15, range: 1.0,
      desc: '空手迅捷，连击流畅', ult: { name: '升龙拳', type: 'upper', dmg: 30 },
      ult2: { name: '咏春·日字冲拳', type: 'ipman', dmg: 42 },
      moves: [
        { name: '疾风连拳', desc: '三段直拳连环出击，快得看不清影子', anim: 'punch', dur: 1.6 },
        { name: '无影腿', desc: '低身高段两连踢，破防利器', anim: 'kick', dur: 1.6 },
        { name: '升龙拳', desc: '终极奥义：腾空螺旋上击，把对手送上天', anim: 'ult-upper', dur: 2.2 },
        { name: '咏春·日字冲拳', desc: '叶问式连环快拳，残影重重', anim: 'ult-rush', dur: 2.0 }
      ],
      locked: 0 },
    { id: 'sword',   name: '青锋铁剑', dmg: 1.1,  spd: 1.0,  range: 1.15,
      desc: '攻守均衡的武林正道', ult: { name: '旋风斩', type: 'spin', dmg: 36 },
      moves: [
        { name: '拨云见日', desc: '自下而上的撩剑，剑锋如月', anim: 'slash', dur: 1.6 },
        { name: '流星赶月', desc: '突进直刺，一剑封喉', anim: 'thrust', dur: 1.6 },
        { name: '旋风斩', desc: '终极奥义：原地旋风三连斩，剑气护体', anim: 'ult-spin', dur: 2.2 }
      ],
      locked: 1 },
    { id: 'spear',   name: '红缨长枪', dmg: 1.05, spd: 0.9,  range: 1.4,
      desc: '一寸长一寸强', ult: { name: '破空突刺', type: 'dash', dmg: 32 },
      moves: [
        { name: '毒龙出洞', desc: '枪出如龙，直取中线', anim: 'thrust', dur: 1.6 },
        { name: '横扫千军', desc: '枪杆横扫，大范围压制', anim: 'sweep', dur: 1.6 },
        { name: '破空突刺', desc: '终极奥义：人枪合一，破空三百里', anim: 'ult-dash', dur: 2.2 }
      ],
      locked: 2 },
    { id: 'hammer',  name: '崩山战锤', dmg: 1.4,  spd: 0.72, range: 1.1,
      desc: '力劈华山，一锤定音', ult: { name: '崩地震', type: 'quake', dmg: 34 },
      moves: [
        { name: '力劈华山', desc: '过头重劈，势大力沉', anim: 'slam', dur: 1.6 },
        { name: '抡锤横扫', desc: '抡圆了扫，近身者退', anim: 'sweep', dur: 1.6 },
        { name: '崩地震', desc: '终极奥义：砸地引震，波及全场', anim: 'ult-quake', dur: 2.2 }
      ],
      locked: 3 },
    { id: 'staff',   name: '烈焰法杖', dmg: 0.95, spd: 1.0,  range: 1.2,
      desc: '远程施法，火球灼敌', magic: true, ult: { name: '烈焰火球', type: 'fire', dmg: 30 },
      moves: [
        { name: '火花弹', desc: '指尖火花，远程骚扰', anim: 'fire-small', dur: 1.6 },
        { name: '烈焰护体', desc: '周身火环，近身者退', anim: 'ring', dur: 1.6 },
        { name: '烈焰火球', desc: '终极奥义：滚滚火球，焚尽对手', anim: 'ult-fire', dur: 2.2 }
      ],
      locked: 4 },
    { id: 'nunchaku', name: '影风双截棍', dmg: 0.9, spd: 1.35, range: 1.05,
      desc: '快如闪电，密不透风', ult: { name: '影连击', type: 'rush', dmg: 33 },
      moves: [
        { name: '玉带缠腰', desc: '双截棍腰间快打，密不透风', anim: 'punch', dur: 1.5 },
        { name: '拨草寻蛇', desc: '低扫接上挑，防不胜防', anim: 'kick', dur: 1.5 },
        { name: '影连击', desc: '终极奥义：瞬身影袭，七步之内最快', anim: 'ult-rush', dur: 2.0 }
      ],
      locked: 5 },
    // ===== 传统武器扩充 =====
    { id: 'dagger', name: '影刃短匕', dmg: 0.8, spd: 1.45, range: 0.72,
      desc: '短小狠辣，出手带毒', ult: { name: '影杀·连刺', type: 'rush', dmg: 33 },
      moves: [
        { name: '毒蛇吐信', desc: '贴身短刺，快准狠', anim: 'thrust', dur: 1.3 },
        { name: '反手划割', desc: '反手横割，专破正面防御', anim: 'slash', dur: 1.3 },
        { name: '影杀·连刺', desc: '终极奥义：瞬身连刺，招招要害', anim: 'ult-rush', dur: 2.0 }
      ],
      locked: 0 },
    { id: 'emei', name: '峨眉刺', dmg: 0.85, spd: 1.4, range: 0.75,
      desc: '双刺藏袖，近身无解', ult: { name: '峨眉分刺', type: 'rush', dmg: 32 },
      moves: [
        { name: '白蛇吐信', desc: '双刺交替点穴', anim: 'punch', dur: 1.3 },
        { name: '玉女穿梭', desc: '身法飘忽，刺中带闪', anim: 'kick', dur: 1.3 },
        { name: '峨眉分刺', desc: '终极奥义：瞬身双刺齐出', anim: 'ult-rush', dur: 2.0 }
      ],
      locked: 0 },
    { id: 'twinblade', name: '鸳鸯双刀', dmg: 1.05, spd: 1.2, range: 0.95,
      desc: '双刀合璧，攻守兼备', ult: { name: '双刀风暴', type: 'rush', dmg: 34 },
      moves: [
        { name: '鸳鸯交错', desc: '双刀交叉连剪', anim: 'slash', dur: 1.4 },
        { name: '雪花盖顶', desc: '双刀上撩封喉', anim: 'punch', dur: 1.4 },
        { name: '双刀风暴', desc: '终极奥义：瞬身双刀乱舞', anim: 'ult-rush', dur: 2.0 }
      ],
      locked: 0 },
    { id: 'katana', name: '武士刀', dmg: 1.25, spd: 1.05, range: 1.2,
      desc: '一刀两断，居合无双', ult: { name: '居合·一闪', type: 'dash', dmg: 34 },
      moves: [
        { name: '霞斩', desc: '弧线斜劈，快而致命', anim: 'slash', dur: 1.5 },
        { name: '逆风刺', desc: '反手直刺破空', anim: 'thrust', dur: 1.5 },
        { name: '居合·一闪', desc: '终极奥义：拔刀瞬斩，快过闪光', anim: 'ult-dash', dur: 2.2 }
      ],
      locked: 0 },
    { id: 'longstaff', name: '齐眉长棍', dmg: 1.0, spd: 1.0, range: 1.35,
      desc: '一寸长一寸强，棍扫一大片', ult: { name: '疯魔棍法', type: 'spin', dmg: 35 },
      moves: [
        { name: '拨草寻蛇', desc: '棍扫下盘，掀翻对手', anim: 'sweep', dur: 1.5 },
        { name: '棍打枯木', desc: '长棍直点面门', anim: 'thrust', dur: 1.5 },
        { name: '疯魔棍法', desc: '终极奥义：棍影如山，密不透风', anim: 'ult-spin', dur: 2.2 }
      ],
      locked: 0 },
    { id: 'sanjie', name: '三节棍', dmg: 1.0, spd: 1.1, range: 1.25,
      desc: '软硬兼施，变化莫测', ult: { name: '盘龙三节', type: 'spin', dmg: 34 },
      moves: [
        { name: '白蛇缠身', desc: '三节甩击，缠腰锁喉', anim: 'sweep', dur: 1.4 },
        { name: '枯藤盘树', desc: '节节甩打，防不胜防', anim: 'punch', dur: 1.4 },
        { name: '盘龙三节', desc: '终极奥义：三节旋舞，风雪不透', anim: 'ult-spin', dur: 2.2 }
      ],
      locked: 0 },
    { id: 'guandao', name: '青龙偃月刀', dmg: 1.5, spd: 0.65, range: 1.45,
      desc: '武圣之刃，一刀断山河', ult: { name: '青龙摆尾', type: 'spin', dmg: 38 },
      moves: [
        { name: '拖刀计', desc: '佯退实进，回身猛劈', anim: 'slam', dur: 1.7 },
        { name: '刀劈华山', desc: '力劈千钧，势不可挡', anim: 'sweep', dur: 1.7 },
        { name: '青龙摆尾', desc: '终极奥义：刀气旋扫，山河变色', anim: 'ult-spin', dur: 2.4 }
      ],
      locked: 0 },
    { id: 'halberd', name: '方天画戟', dmg: 1.4, spd: 0.7, range: 1.5,
      desc: '戟尖钩魂，人中吕布', ult: { name: '画戟钩魂', type: 'quake', dmg: 38 },
      moves: [
        { name: '戟刺苍穹', desc: '长戟直刺，一击破甲', anim: 'thrust', dur: 1.6 },
        { name: '横戟扫军', desc: '画戟横扫，千军辟易', anim: 'sweep', dur: 1.6 },
        { name: '画戟钩魂', desc: '终极奥义：戟震大地，钩魂夺魄', anim: 'ult-quake', dur: 2.4 }
      ],
      locked: 0 },
    { id: 'changba', name: '丈八长矛', dmg: 1.2, spd: 0.8, range: 1.6,
      desc: '矛及丈八，先发制人', ult: { name: '回马枪', type: 'dash', dmg: 33 },
      moves: [
        { name: '长虹贯日', desc: '超远距直刺，先手压制', anim: 'thrust', dur: 1.5 },
        { name: '横矛立马', desc: '长矛横扫，封锁走位', anim: 'sweep', dur: 1.5 },
        { name: '回马枪', desc: '终极奥义：佯败回身，一枪夺魂', anim: 'ult-dash', dur: 2.2 }
      ],
      locked: 0 },
    { id: 'mjolnir', name: '雷神之锤', dmg: 1.6, spd: 0.6, range: 1.1,
      desc: '雷霆之怒，凡人莫当', ult: { name: '雷霆万钧', type: 'lightning', dmg: 40 },
      moves: [
        { name: '雷霆重击', desc: '神锤砸落，雷光四溅', anim: 'slam', dur: 1.8 },
        { name: '风暴横扫', desc: '神力横扫，携雷挟电', anim: 'sweep', dur: 1.8 },
        { name: '雷霆万钧', desc: '终极奥义：引九天之雷，轰击对手', anim: 'ult-lightning', dur: 2.4 }
      ],
      locked: 0 },
    { id: 'twinhammer', name: '混元双锤', dmg: 1.3, spd: 0.75, range: 0.95,
      desc: '双锤合击，铿锵震耳', ult: { name: '双锤旋风', type: 'quake', dmg: 35 },
      moves: [
        { name: '双锤合璧', desc: '双锤对砸，震耳欲聋', anim: 'slam', dur: 1.5 },
        { name: '流星双锤', desc: '双锤流星赶月', anim: 'punch', dur: 1.5 },
        { name: '双锤旋风', desc: '终极奥义：双锤旋地，地裂山崩', anim: 'ult-quake', dur: 2.2 }
      ],
      locked: 0 },
    // ===== 现代武器（乱入武林，趣味十足） =====
    { id: 'pistol', name: '配枪·掌心雷', dmg: 0.95, spd: 0.95, range: 1.7, ranged: { dmg: 7, projSpd: 1000, kind: 'bullet', cd: 0.35, sfx: 'shot' },
      desc: '现代乱入武林，一枪一个脆皮',
      ult: { name: '致命一击', type: 'gunburst', dmg: 30 },
      moves: [
        { name: '快拔枪法', desc: '西部快枪，抬手就射', anim: 'gun', dur: 1.4 },
        { name: '双点射', desc: '两发点射，弹无虚发', anim: 'gunburst', dur: 1.6 },
        { name: '致命一击', desc: '终极奥义：三连速射，专打面门', anim: 'gunburst', dur: 1.8 }
      ],
      locked: 0 },
    { id: 'smg', name: '冲锋枪·狂风', dmg: 0.55, spd: 1.5, range: 1.6, ranged: { dmg: 3.5, projSpd: 1100, kind: 'bullet', cd: 0.16, auto: true, sfx: 'shot' },
      desc: '弹雨如风，近战扫射',
      ult: { name: '扫射狂潮', type: 'spray', dmg: 36 },
      moves: [
        { name: '腰际扫射', desc: '腰际平扫，弹壳乱飞', anim: 'gun', dur: 1.3 },
        { name: '三连点放', desc: '哒哒哒三连发', anim: 'gunburst', dur: 1.4 },
        { name: '扫射狂潮', desc: '终极奥义：倾泻弹雨，寸草不生', anim: 'spray', dur: 2.2 }
      ],
      locked: 0 },
    { id: 'sniper', name: '狙击枪·鹰眼', dmg: 2.1, spd: 0.38, range: 2.3, ranged: { dmg: 26, projSpd: 1600, kind: 'sniper', cd: 1.4, sfx: 'shotBig' },
      desc: '一击必杀，千里之外',
      ult: { name: '致命瞄准', type: 'sniper', dmg: 45 },
      moves: [
        { name: '屏息瞄准', desc: '稳如磐石，静待时机', anim: 'gun', dur: 1.7 },
        { name: '穿云狙', desc: '穿云一击，势不可挡', anim: 'gunburst', dur: 1.7 },
        { name: '致命瞄准', desc: '终极奥义：锁定要害，一击必杀', anim: 'sniper', dur: 2.6 }
      ],
      locked: 0 },
    { id: 'gatling', name: '加特林·弹雨', dmg: 0.4, spd: 2.0, range: 1.7, ranged: { dmg: 2.4, projSpd: 1150, kind: 'bullet', cd: 0.09, auto: true, sfx: 'shot' },
      desc: '倾泻钢铁弹雨，火力即是正义',
      ult: { name: '弹雨风暴', type: 'rain', dmg: 70 },
      moves: [
        { name: '旋转启动', desc: '枪管旋转，弹雨将至', anim: 'gun', dur: 1.2 },
        { name: '持续压制', desc: '持续火力压制，对手抬不起头', anim: 'spray', dur: 2.0 },
        { name: '弹雨风暴', desc: '终极奥义：倾泻全部弹药', anim: 'spray', dur: 2.4 }
      ],
      locked: 0 },
    { id: 'longbow', name: '穿云长弓', dmg: 0.75, spd: 0.62, range: 2.0,
      ranged: { dmg: 8, projSpd: 950, kind: 'arrow', cd: 0.5, sfx: 'arrow' },
      desc: '箭出穿云，百里取物',
      ult: { name: '穿云箭雨', type: 'volley', dmg: 50 },
      moves: [
        { name: '拉弓射日', desc: '屏息拉弓，一箭穿云', anim: 'bow', dur: 1.6 },
        { name: '连珠箭', desc: '快速连珠三箭', anim: 'gun', dur: 1.5 },
        { name: '穿云箭雨', desc: '终极奥义：五箭齐发，遮天蔽日', anim: 'volley', dur: 2.4 }
      ],
      locked: 0 }
  ];

  // ---------- 装备（被动加成，仅可携带一件） ----------
  var GEARS = [
    { id: 'none',  name: '不带装备', },
    { id: 'boots', name: '疾风之靴', spd: 1.18, desc: '移动速度 +18%', locked: 2 },
    { id: 'mirror',name: '护心镜',   hp: 30,    desc: '最大生命 +30', locked: 4 },
    { id: 'bracer',name: '力量护腕', dmg: 1.12, desc: '伤害 +12%', locked: 5 },
    { id: 'robe',  name: '法袍·灵护', desc: '法术伤害 -60%', magicDef: 0.6, locked: 4 },
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

  // ---------- 商城：付费强化道具 ----------
  // usage: 'passive' 被动（装备后自动生效） / 'active' 主动（战斗中手动释放，带冷却）
  // how: 使用方式说明（商城卡片与选人界面展示）
  var SHOP_ITEMS = [
    // 挂件（一次购买，装备后永久生效）
    { id: 'iron_wall',   type: 'pendant', price: 500, usage: 'passive',
      name: '铁壁挂件', icon: '🔵',
      desc: '伤害低于 5 点的攻击完全免疫（大招与终极技仍会命中）',
      how: '被动技：选人界面「挂件」栏装备后自动生效，无需操作',
      effect: { immuneBelow: 5 } },
    { id: 'diamond_wall', type: 'pendant', price: 1500, usage: 'passive',
      name: '金刚挂件', icon: '💠', requires: 'iron_wall',
      desc: '伤害低于 12 点的攻击完全免疫（大招与终极技仍会命中）',
      how: '被动技：选人界面「挂件」栏装备后自动生效，无需操作',
      effect: { immuneBelow: 12 } },
    // 超级装备（一次购买，装备后大幅增强）
    { id: 'exo_titan',   type: 'super', price: 3000, usage: 'passive',
      name: '外骨骼·泰坦', icon: '🦾',
      desc: '弹道攻击 ×2.0 · 近战伤害 ×2.0 · 大招替换为「泰坦轰击」（跃起重砸，双重冲击）',
      how: '被动技：选人界面「超级装备」栏装备后自动生效；使用大招时自动改为「泰坦轰击」',
      effect: { atkMul: 2.0, dmgMul: 2.0, ultOverride: 'titan_slam' } },
    { id: 'exo_falcon',  type: 'super', price: 2500, usage: 'passive',
      name: '外骨骼·猎鹰', icon: '🦅',
      desc: '出招速度 ×1.8 · 移动速度 ×1.5',
      how: '被动技：选人界面「超级装备」栏装备后自动生效，无需操作',
      effect: { spdMul: 1.8, moveMul: 1.5 } },
    // 法术卷轴（一次购买，战斗中主动释放，带冷却）
    { id: 'scroll_gold',  type: 'scroll', price: 300, usage: 'active',
      name: '金身卷轴', icon: '📜',
      desc: '3 秒无敌金身，物理+法术全免',
      how: '主动技：选人界面「卷轴」栏装备后，战斗中按 O（P2 为 \\）释放 · 冷却 30 秒',
      effect: { duration: 3, cooldown: 30 } },
    { id: 'scroll_berserk', type: 'scroll', price: 250, usage: 'active',
      name: '狂暴卷轴', icon: '💢',
      desc: '5 秒攻击力 ×3.0',
      how: '主动技：选人界面「卷轴」栏装备后，战斗中按 O（P2 为 \\）释放 · 冷却 45 秒',
      effect: { duration: 5, cooldown: 45, atkMul: 3.0 } }
  ];

  // ---------- 修炼模式：可习得的武学（解锁后实战永久生效） ----------
  var TRAININGS = [
    { id: 'chain3', icon: '👊', name: '影三连 · 拳', need: 1,
      desc: '解锁拳链第三段「上勾拳」——伤害 ×1.45 并击退对手',
      trainLabel: '收招后 0.4 秒内再按 J，打出第三段「上勾拳」命中陪练' },
    { id: 'kick3', icon: '🦵', name: '回旋踢 · 腿', need: 1,
      desc: '解锁腿链第三段「回旋踢」——大击退并前冲追击',
      trainLabel: '连续按 K 两次，第二段「回旋踢」命中陪练' },
    { id: 'parry', icon: '🛡', name: '攻防转换 · 弹反', need: 2,
      desc: '被击中的瞬间按格挡 → 弹反！无伤反弹、对手硬直、蓄力 +20',
      trainLabel: '陪练出招的瞬间按 S 格挡——成功弹反 2 次' },
    { id: 'lastStand', icon: '🔥', name: '背水一战', need: 5,
      desc: '血量低于 35% 时伤害 +25%，绝境爆发',
      trainLabel: '命中陪练 5 次，激发血性' },
    { id: 'ipman', icon: '🥋', name: '咏春 · 日字冲拳', need: 1,
      desc: '解锁拳法第二奥义：近身时按 U，自动改出叶问式连环快拳（残影连击）',
      trainLabel: '贴近陪练按 U，用咏春快拳命中陪练' }
  ];

  // ---------- 修炼模式：可习得的武学（解锁后实战永久生效） ----------
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
    TRAININGS: TRAININGS, SHOP_ITEMS: SHOP_ITEMS, FAMILY_PRESETS: FAMILY_PRESETS,
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
