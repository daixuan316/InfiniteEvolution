# 《无限进化：末日方舟》音频资产优先级清单

> 项目：Cocos Creator 3.8.8 + Oops Framework  
> 状态：P0 执行中（2026-11-03 起分批落盘，进度见 §9）  
> 建议运行时根目录：`assets/bundle/audio/`  
> 优先级：P0 核心原型 → P1 首章纵向切片 → P2 完整版本

## 1. 使用规则

- 清单中的路径均相对于 `assets/bundle/audio/`，暂不写文件扩展名。
- `{01..05}` 表示需要生成 5 个独立变体文件，而不是一个文件。
- 短音效保留无损 WAV 母版；音乐和长环境循环在导入目标平台前再决定压缩格式。
- 所有声音必须进入 `Music`、`SFX`、`Ambience`、`UI` 或 `Voice` 总线，不直接绕过用户音量设置。
- 动态音乐层必须使用相同 BPM、小节长度、起止点和尾部处理，保证量化切换时不跳拍。
- 脚步、枪声、命中等高频音效使用 3–6 个样本池，并配置轻微随机音高和音量。
- 语音或关键机制播报播放时，音乐降低约 6–10 dB，并在 300–500 ms 内恢复。
- 移动端代表性完整昼夜流程目标约为 `-18 LUFS（±2）`，Master 真峰值不高于 `-1 dBTP`。

## 2. P0｜核心原型

P0 对应一个白天街区、一个方舟防守场景、突击步枪与霰弹枪、行尸/奔袭者/巨躯者，以及机枪塔、装甲板、发电机和工坊构成的完整昼夜闭环。

### 2.1 动态音乐

- [ ] `music/main-theme-loop`
- [ ] `music/day/day-atmosphere-loop`
- [ ] `music/day/day-exploration-pulse-loop`
- [ ] `music/day/day-danger-pulse-loop`
- [ ] `music/day/dusk-return-loop`
- [ ] `music/night/night-base-loop`
- [ ] `music/night/night-horde-loop`
- [ ] `music/night/night-special-threat-loop`
- [ ] `music/night/night-climax-loop`
- [ ] `music/night/night-respite-loop`

### 2.2 阶段音乐标记

- [ ] `music/stinger/threat-discovered`
- [ ] `music/stinger/dusk-warning`
- [ ] `music/stinger/night-start`
- [ ] `music/stinger/main-wave`
- [ ] `music/stinger/respite-start`
- [ ] `music/stinger/climax-warning`
- [ ] `music/stinger/horde-cleared`
- [ ] `music/stinger/ark-critical`
- [ ] `music/stinger/day-success`
- [ ] `music/stinger/day-failure`

### 2.3 原型环境声

- [ ] `ambience/ch01-gray-harbor/surface-loop`
- [ ] `ambience/ch01-gray-harbor/ark-loop`
- [ ] `ambience/overlay/wind-ruins-loop`
- [ ] `ambience/overlay/distant-zombies-loop`
- [ ] `ambience/overlay/distant-horde-loop`
- [ ] `ambience/overlay/ark-beacon-loop`
- [ ] `environment/ark-beacon-directional`

### 2.4 玩家动作与状态

- [ ] `player/footstep-concrete-{01..05}`
- [ ] `player/footstep-rubble-{01..05}`
- [ ] `player/footstep-metal-{01..05}`
- [ ] `player/dodge-start`
- [ ] `player/dodge-land-{01..03}`
- [ ] `player/weapon-swap`
- [ ] `player/target-mark`
- [ ] `player/interact`
- [ ] `player/manual-repair-start`
- [ ] `player/manual-repair-loop`
- [ ] `player/manual-repair-complete`
- [ ] `player/hit-health-{01..04}`
- [ ] `player/hit-shield-{01..03}`
- [ ] `player/shield-break`
- [ ] `player/down`
- [ ] `player/revived`
- [ ] `player/heal`
- [ ] `player/pollution-warning`

### 2.5 原型武器

#### 突击步枪

- [ ] `weapon/assault-rifle/fire-{01..05}`
- [ ] `weapon/assault-rifle/mech-{01..03}`
- [ ] `weapon/assault-rifle/tail-{01..03}`
- [ ] `weapon/assault-rifle/reload`

#### 霰弹枪

- [ ] `weapon/shotgun/fire-{01..05}`
- [ ] `weapon/shotgun/pump-{01..03}`
- [ ] `weapon/shotgun/shell-load`
- [ ] `weapon/shotgun/tail-{01..03}`
- [ ] `weapon/shotgun/reload`

#### 通用命中

- [ ] `weapon/impact/flesh-{01..06}`
- [ ] `weapon/impact/armor-{01..05}`
- [ ] `weapon/impact/metal-{01..05}`
- [ ] `weapon/impact/concrete-{01..04}`
- [ ] `weapon/impact/shield-{01..04}`
- [ ] `weapon/impact/weakpoint-{01..04}`
- [ ] `weapon/impact/critical-{01..03}`

### 2.6 原型怪物

#### 行尸

- [ ] `enemy/walker/idle-{01..04}`
- [ ] `enemy/walker/alert-{01..03}`
- [ ] `enemy/walker/attack-{01..04}`
- [ ] `enemy/walker/hit-{01..04}`
- [ ] `enemy/walker/death-{01..04}`

#### 奔袭者

- [ ] `enemy/runner/distant-warning`
- [ ] `enemy/runner/sprint-loop`
- [ ] `enemy/runner/pounce-{01..03}`
- [ ] `enemy/runner/hit-{01..03}`
- [ ] `enemy/runner/death-{01..03}`

#### 巨躯者

- [ ] `enemy/brute/distant-warning`
- [ ] `enemy/brute/charge-telegraph`
- [ ] `enemy/brute/charge-loop`
- [ ] `enemy/brute/impact-{01..04}`
- [ ] `enemy/brute/weakpoint-break`
- [ ] `enemy/brute/death-{01..03}`

### 2.7 方舟核心、电力与原型模块

#### 方舟核心

- [ ] `ark/core/idle-loop`
- [ ] `ark/core/hit-{01..04}`
- [ ] `ark/core/warning`
- [ ] `ark/core/critical-alarm`
- [ ] `ark/core/recovered`
- [ ] `ark/core/destroyed`

#### 发电机与供电

- [ ] `ark/generator/start`
- [ ] `ark/generator/normal-loop`
- [ ] `ark/generator/damaged-loop`
- [ ] `ark/generator/overload-loop`
- [ ] `ark/generator/shutdown`
- [ ] `ark/generator/fault`
- [ ] `ark/power/switch`
- [ ] `ark/power/reroute`
- [ ] `ark/power/shortage`
- [ ] `ark/power/outage`
- [ ] `ark/power/restored`
- [ ] `ark/power/emergency-battery`

#### 装甲与机枪塔

- [ ] `ark/armor/hit-{01..05}`
- [ ] `ark/armor/crack`
- [ ] `ark/armor/breach`
- [ ] `ark/turret/machine-gun/rotate`
- [ ] `ark/turret/machine-gun/fire-{01..05}`
- [ ] `ark/turret/machine-gun/reload`
- [ ] `ark/turret/machine-gun/overheat`
- [ ] `ark/turret/machine-gun/damaged-loop`
- [ ] `ark/turret/machine-gun/offline`

#### 工坊

- [ ] `ark/workshop/working-loop`
- [ ] `ark/workshop/damaged-loop`
- [ ] `ark/workshop/offline`
- [ ] `ark/workshop/craft-complete`

### 2.8 原型搜刮与交互

- [ ] `world/pickup/coin`
- [ ] `world/pickup/scrap`
- [ ] `world/pickup/mechanical-parts`
- [ ] `world/pickup/rare-drop`
- [ ] `world/container/supply-crate-open`
- [ ] `world/container/heavy-safe-open`
- [ ] `world/event/evacuation`
- [ ] `world/event/extreme-night-start`

### 2.9 原型 UI

- [ ] `ui/click`
- [ ] `ui/confirm`
- [ ] `ui/cancel`
- [ ] `ui/tab-switch`
- [ ] `ui/panel-open`
- [ ] `ui/panel-close`
- [ ] `ui/warning`
- [ ] `ui/invalid-action`
- [ ] `ui/insufficient-resource`
- [ ] `ui/item-equip`
- [ ] `ui/item-unequip`
- [ ] `ui/craft-start`
- [ ] `ui/craft-complete`
- [ ] `ui/upgrade`
- [ ] `ui/module-place`
- [ ] `ui/module-move`
- [ ] `ui/module-remove`
- [ ] `ui/power-toggle`
- [ ] `ui/save-complete`
- [ ] `ui/pause`
- [ ] `ui/resume`

### 2.10 原型系统广播

- [ ] `voice/system/dusk-warning`
- [ ] `voice/system/nightfall`
- [ ] `voice/system/extreme-night`
- [ ] `voice/system/return-to-ark`
- [ ] `voice/system/wave-probing`
- [ ] `voice/system/wave-main`
- [ ] `voice/system/wave-respite`
- [ ] `voice/system/wave-climax`
- [ ] `voice/system/wave-cleared`
- [ ] `voice/system/power-shortage`
- [ ] `voice/system/module-damaged`
- [ ] `voice/system/core-critical`
- [ ] `voice/system/player-down`

## 3. P1｜首章纵向切片

P1 在 P0 基础上补齐灰港废城七天、五类探索地点、六种基础敌人、两类精英、六种武器模板、屠夫母体以及完整 UI 和方舟反馈。

### 3.1 首章环境声

- [ ] `ambience/ch01-gray-harbor/indoor-loop`
- [ ] `ambience/ch01-gray-harbor/underground-loop`
- [ ] `ambience/location/hospital-loop`
- [ ] `ambience/location/supermarket-loop`
- [ ] `ambience/location/police-station-loop`
- [ ] `ambience/location/factory-loop`
- [ ] `ambience/location/residential-loop`
- [ ] `ambience/location/subway-loop`
- [ ] `environment/generator-distant-loop`
- [ ] `environment/elevator-distant-loop`
- [ ] `environment/water-flow-distant-loop`
- [ ] `environment/nest-distant-loop`

### 3.2 首章补充玩家反馈

- [ ] `player/footstep-tile-{01..05}`
- [ ] `player/footstep-water-{01..05}`
- [ ] `player/injury-gained`
- [ ] `player/pollution-critical`
- [ ] `player/extreme-night-breath-loop`

### 3.3 首章其余武器模板

> 首章最终采用哪四种补充武器，应以装备配置表为准。以下先按通用武器类别准备。

#### 冲锋枪

- [ ] `weapon/smg/fire-{01..05}`
- [ ] `weapon/smg/mech-{01..03}`
- [ ] `weapon/smg/tail-{01..03}`
- [ ] `weapon/smg/reload`

#### 狙击枪

- [ ] `weapon/sniper/fire-{01..04}`
- [ ] `weapon/sniper/bolt-{01..03}`
- [ ] `weapon/sniper/tail-{01..03}`
- [ ] `weapon/sniper/reload`

#### 轻机枪

- [ ] `weapon/lmg/fire-{01..05}`
- [ ] `weapon/lmg/belt-mech-{01..03}`
- [ ] `weapon/lmg/tail-{01..03}`
- [ ] `weapon/lmg/reload`
- [ ] `weapon/lmg/overheat`
- [ ] `weapon/lmg/cooldown`

#### 榴弹武器

- [ ] `weapon/grenade/launch-{01..04}`
- [ ] `weapon/grenade/reload`
- [ ] `weapon/grenade/projectile-fly`
- [ ] `weapon/grenade/explosion-{01..05}`

#### 补充命中

- [ ] `weapon/impact/water-{01..04}`
- [ ] `weapon/impact/biomass-{01..05}`
- [ ] `weapon/impact/melee-{01..05}`

### 3.4 首章新增怪物

#### 喷吐者

- [ ] `enemy/spitter/distant-warning`
- [ ] `enemy/spitter/inhale`
- [ ] `enemy/spitter/spit-{01..03}`
- [ ] `enemy/spitter/projectile-loop`
- [ ] `enemy/spitter/acid-impact-{01..04}`
- [ ] `enemy/spitter/acid-puddle-loop`
- [ ] `enemy/spitter/death-{01..03}`

#### 尖啸者

- [ ] `enemy/screamer/distant-warning`
- [ ] `enemy/screamer/charge-up`
- [ ] `enemy/screamer/scream-{01..03}`
- [ ] `enemy/screamer/summon`
- [ ] `enemy/screamer/interrupted`
- [ ] `enemy/screamer/death-{01..03}`

#### 攀爬者

- [ ] `enemy/climber/distant-warning`
- [ ] `enemy/climber/climb-loop`
- [ ] `enemy/climber/scrape-{01..04}`
- [ ] `enemy/climber/leap-{01..03}`
- [ ] `enemy/climber/land-{01..03}`
- [ ] `enemy/climber/attack-{01..03}`
- [ ] `enemy/climber/death-{01..03}`

### 3.5 首章精英词缀

- [ ] `enemy/affix/armored-hit`
- [ ] `enemy/affix/armor-break`
- [ ] `enemy/affix/frenzy-trigger`
- [ ] `enemy/affix/frenzy-loop`

### 3.6 屠夫母体

- [ ] `music/boss/butcher-matriarch-p1-loop`
- [ ] `music/boss/butcher-matriarch-p2-loop`
- [ ] `music/boss/butcher-matriarch-p3-loop`
- [ ] `music/stinger/boss-intro`
- [ ] `music/stinger/boss-phase-change`
- [ ] `music/stinger/boss-stagger`
- [ ] `music/stinger/boss-defeated`
- [ ] `boss/butcher-matriarch/intro`
- [ ] `boss/butcher-matriarch/summon`
- [ ] `boss/butcher-matriarch/charge-telegraph`
- [ ] `boss/butcher-matriarch/charge-loop`
- [ ] `boss/butcher-matriarch/wreck-impact`
- [ ] `boss/butcher-matriarch/stagger`
- [ ] `boss/butcher-matriarch/weakpoint-exposed`
- [ ] `boss/butcher-matriarch/ark-hit`
- [ ] `boss/butcher-matriarch/death`

### 3.7 首章方舟模块与防线

- [ ] `ark/defense/barrier-deploy`
- [ ] `ark/defense/barrier-hit-{01..04}`
- [ ] `ark/defense/barrier-break`
- [ ] `ark/defense/electric-grid-loop`
- [ ] `ark/defense/electric-grid-zap-{01..05}`
- [ ] `ark/defense/spike-hit-{01..04}`
- [ ] `ark/defense/decoy-loop`
- [ ] `ark/defense/decoy-destroyed`
- [ ] `ark/repair-drone/launch`
- [ ] `ark/repair-drone/flight-loop`
- [ ] `ark/repair-drone/repair-loop`
- [ ] `ark/repair-drone/return`
- [ ] `ark/radar/sweep-loop`
- [ ] `ark/radar/target-ping`
- [ ] `ark/medical/working-loop`
- [ ] `ark/medical/heal`
- [ ] `ark/medical/revive`

### 3.8 首章搜刮、地点与事件

- [ ] `world/pickup/electronics`
- [ ] `world/pickup/medicine`
- [ ] `world/pickup/mutation-tissue`
- [ ] `world/pickup/boss-core`
- [ ] `world/pickup/legendary-drop`
- [ ] `world/container/military-crate-open`
- [ ] `world/container/bio-crate-open`
- [ ] `world/container/airdrop-open`
- [ ] `world/container/hidden-cache-open`
- [ ] `world/device/keypad`
- [ ] `world/device/locked-door`
- [ ] `world/device/power-restored`
- [ ] `world/device/elevator-start`
- [ ] `world/device/production-line`
- [ ] `world/device/crane`
- [ ] `world/device/nest-destroyed`
- [ ] `world/event/distress-signal`
- [ ] `world/event/merchant-arrival`
- [ ] `world/event/ambush-reveal`
- [ ] `world/event/building-collapse`
- [ ] `world/event/airdrop-arrival`
- [ ] `world/event/elite-migration`

### 3.9 完整 UI 补充

- [ ] `ui/compare-better`
- [ ] `ui/compare-worse`
- [ ] `ui/item-drop`
- [ ] `ui/rare-loot`
- [ ] `ui/legendary-loot`
- [ ] `ui/recycle`
- [ ] `ui/evolution-complete`
- [ ] `ui/technology-unlocked`
- [ ] `ui/talent-unlocked`
- [ ] `ui/level-up`
- [ ] `ui/quest-accept`
- [ ] `ui/quest-update`
- [ ] `ui/quest-complete`
- [ ] `ui/quest-failed`
- [ ] `ui/map-reveal`
- [ ] `ui/map-marker`
- [ ] `ui/safe-route`
- [ ] `ui/high-risk-route`
- [ ] `ui/loadout-save`
- [ ] `ui/dialogue-choice`

### 3.10 首章广播补充

- [ ] `voice/system/core-damaged`
- [ ] `voice/system/special-breach`
- [ ] `voice/system/boss-arrival`
- [ ] `voice/system/evacuation`

## 4. P2｜完整版本

P2 在首章通过验收后扩展至后四章、其余怪物和精英词缀、全部方舟武器、五章 BOSS、三个结局与长期玩法。

### 4.1 后四章环境声

- [ ] `ambience/ch02-acid-industrial/surface-loop`
- [ ] `ambience/ch02-acid-industrial/indoor-loop`
- [ ] `ambience/ch02-acid-industrial/underground-loop`
- [ ] `ambience/ch02-acid-industrial/ark-loop`
- [ ] `ambience/ch03-flooded-metro/surface-loop`
- [ ] `ambience/ch03-flooded-metro/indoor-loop`
- [ ] `ambience/ch03-flooded-metro/underground-loop`
- [ ] `ambience/ch03-flooded-metro/ark-loop`
- [ ] `ambience/ch04-hive-lab/surface-loop`
- [ ] `ambience/ch04-hive-lab/indoor-loop`
- [ ] `ambience/ch04-hive-lab/underground-loop`
- [ ] `ambience/ch04-hive-lab/ark-loop`
- [ ] `ambience/ch05-zero-zone/surface-loop`
- [ ] `ambience/ch05-zero-zone/indoor-loop`
- [ ] `ambience/ch05-zero-zone/underground-loop`
- [ ] `ambience/ch05-zero-zone/ark-loop`
- [ ] `ambience/overlay/rain-loop`
- [ ] `ambience/overlay/acid-rain-loop`
- [ ] `ambience/overlay/flooded-water-loop`
- [ ] `ambience/overlay/electrified-water-loop`
- [ ] `ambience/overlay/pollution-hum-loop`
- [ ] `ambience/overlay/hallucination-loop`
- [ ] `ambience/overlay/biomass-pulse-loop`
- [ ] `ambience/overlay/extreme-night-pursuit-loop`

### 4.2 后续武器

#### 火焰武器

- [ ] `weapon/flame/start`
- [ ] `weapon/flame/loop`
- [ ] `weapon/flame/end`
- [ ] `weapon/flame/ignite-{01..04}`
- [ ] `weapon/flame/overheat`
- [ ] `weapon/flame/cooldown`

#### 电弧武器

- [ ] `weapon/arc/charge`
- [ ] `weapon/arc/fire-{01..04}`
- [ ] `weapon/arc/chain-{01..05}`
- [ ] `weapon/arc/wet-chain`
- [ ] `weapon/arc/cooldown`

#### 生化武器

- [ ] `weapon/bio/charge`
- [ ] `weapon/bio/fire-{01..04}`
- [ ] `weapon/bio/splash-{01..05}`
- [ ] `weapon/bio/infection-loop`
- [ ] `weapon/bio/backlash`

### 4.3 后续怪物

#### 掘地者

- [ ] `enemy/burrower/distant-warning`
- [ ] `enemy/burrower/underground-loop`
- [ ] `enemy/burrower/false-target`
- [ ] `enemy/burrower/true-target`
- [ ] `enemy/burrower/emerge-{01..03}`
- [ ] `enemy/burrower/death-{01..03}`

#### 寄生体

- [ ] `enemy/parasite/distant-warning`
- [ ] `enemy/parasite/skitter-{01..04}`
- [ ] `enemy/parasite/leap-{01..03}`
- [ ] `enemy/parasite/attach`
- [ ] `enemy/parasite/parasite-loop`
- [ ] `enemy/parasite/cleared`
- [ ] `enemy/parasite/death-{01..03}`

#### 自爆体

- [ ] `enemy/exploder/distant-warning`
- [ ] `enemy/exploder/approach-pulse-loop`
- [ ] `enemy/exploder/detonate-charge`
- [ ] `enemy/exploder/explosion-{01..04}`
- [ ] `enemy/exploder/interrupted`

### 4.4 后续精英词缀

- [ ] `enemy/affix/electromagnetic-charge`
- [ ] `enemy/affix/electromagnetic-pulse`
- [ ] `enemy/affix/split-spawn`
- [ ] `enemy/affix/regeneration-loop`
- [ ] `enemy/affix/regeneration-interrupted`
- [ ] `enemy/affix/symbiosis-link`
- [ ] `enemy/affix/symbiosis-break`

### 4.5 后四章 BOSS 音乐

- [ ] `music/boss/acid-rain-colossus-p1-loop`
- [ ] `music/boss/acid-rain-colossus-p2-loop`
- [ ] `music/boss/acid-rain-colossus-p3-loop`
- [ ] `music/boss/metro-devourer-p1-loop`
- [ ] `music/boss/metro-devourer-p2-loop`
- [ ] `music/boss/metro-devourer-p3-loop`
- [ ] `music/boss/hive-mind-beacon-p1-loop`
- [ ] `music/boss/hive-mind-beacon-p2-loop`
- [ ] `music/boss/hive-mind-beacon-p3-loop`
- [ ] `music/boss/primal-evolution-p1-loop`
- [ ] `music/boss/primal-evolution-p2-loop`
- [ ] `music/boss/primal-evolution-p3-loop`

### 4.6 后四章 BOSS 音效

以下每个 `{boss-id}` 均需要一套：

- `acid-rain-colossus`
- `metro-devourer`
- `hive-mind-beacon`
- `primal-evolution`

每套文件：

- [ ] `boss/{boss-id}/intro`
- [ ] `boss/{boss-id}/phase-change`
- [ ] `boss/{boss-id}/signature-attack-warning`
- [ ] `boss/{boss-id}/signature-attack-impact`
- [ ] `boss/{boss-id}/stagger`
- [ ] `boss/{boss-id}/weakpoint-exposed`
- [ ] `boss/{boss-id}/ark-hit`
- [ ] `boss/{boss-id}/death`

### 4.7 完整方舟武器与设施

- [ ] `ark/turret/shotgun/{rotate,fire-01..04,reload}`
- [ ] `ark/turret/flame/{start,loop,end,overheat}`
- [ ] `ark/turret/arc/{charge,fire-01..04,chain-01..04}`
- [ ] `ark/turret/missile/{lock,launch-01..03,impact-01..04}`
- [ ] `ark/turret/drone/{launch,flight-loop,fire,return}`
- [ ] `ark/purifier/working-loop`
- [ ] `ark/purifier/pulse`
- [ ] `ark/research/scan-loop`
- [ ] `ark/research/complete`
- [ ] `ark/storage/door`
- [ ] `ark/bio-module/idle-pulse-loop`
- [ ] `ark/bio-module/implant`
- [ ] `ark/bio-module/mutate`
- [ ] `ark/bio-module/instability-warning`
- [ ] `ark/migration/engine-start`
- [ ] `ark/migration/drive-loop`
- [ ] `ark/migration/departure`

### 4.8 章节迁徙与结局

- [ ] `music/stinger/chapter-migration`
- [ ] `music/ending/purification`
- [ ] `music/ending/coexistence`
- [ ] `music/ending/domination`

## 5. 暂缓生成项

以下内容尚缺最终配置或脚本，过早生成容易返工：

- [ ] 主动技能音效：等待技能 ID、施放阶段和元素定义确认。
- [ ] 完整幸存者对白：等待人物姓名、台词、情绪和字幕表确认。
- [ ] 任务对白：等待五章任务脚本锁定。
- [ ] 三个结局旁白：等待最终文案和配音方向确认。
- [ ] 首章最终六种武器模板：等待装备配置表确认后，从 P1/P2 武器池中调整优先级。
- [ ] 后四章新增普通敌人：等待各章怪物配置表补齐。

## 6. 单项验收字段

每个音频文件或变体组完成后至少记录：

- [ ] 稳定音频 ID 与实际文件路径一致。
- [ ] 总线归属正确。
- [ ] 单次音效或循环属性正确。
- [ ] 循环点无爆音、无明显接缝。
- [ ] 变体组不会连续播放同一条样本。
- [ ] 音高随机不破坏武器或怪物身份。
- [ ] 特殊怪预警在进入视野前 0.5–1.5 秒可听见。
- [ ] 方舟警报、特殊怪预警和角色受击不会被尸潮与枪声掩盖。
- [ ] 手机扬声器和耳机上均可识别关键声音。
- [ ] 综合响度和真峰值符合移动端混音目标。
- [ ] 对应关键声音同时具有视觉提示或字幕。

## 7. 建议目录结构

```text
assets/bundle/audio/
├─ music/
│  ├─ day/
│  ├─ night/
│  ├─ boss/
│  ├─ ending/
│  └─ stinger/
├─ ambience/
│  ├─ ch01-gray-harbor/
│  ├─ ch02-acid-industrial/
│  ├─ ch03-flooded-metro/
│  ├─ ch04-hive-lab/
│  ├─ ch05-zero-zone/
│  └─ overlay/
├─ environment/
├─ player/
├─ weapon/
│  └─ impact/
├─ enemy/
│  └─ affix/
├─ boss/
├─ ark/
├─ world/
├─ ui/
└─ voice/
   └─ system/
```

## 8. 项目依据

- `docs/design/11-production-roadmap.md`：核心原型、首章纵向切片与完整版本的生产顺序。
- `docs/design/08-presentation-mobile-ux.md`：音频总线、自适应音乐、音效变体和混音目标。
- `docs/design/04-combat-equipment.md`：九种武器类别、换弹、过热与元素机制。
- `docs/design/06-monsters-horde-bosses.md`：九种怪物、精英词缀和五章 BOSS。
- `docs/design/03-mobile-ark.md`：方舟模块、炮塔、供电、损坏、过载、停机与寄生状态。
- `docs/implementation/07-ui-audio-mobile-plan.md`：`AudioCueService`、`AudioCues.json` 和 Oops AudioManager 接入方式。

## 9. 执行进度（2026-11-03）

获取策略：变体池类音效用素材库整组下载，独特关键声（警报/预警/音乐/语音广播）用 AI 生成。

### 9.1 已完成

- 目录结构已按 §7 建好（`assets/bundle/audio/` 下 30 个子目录）。
- 素材库检索完成，选中 31 个音组；其中 **16 组已扣费购买（335 积分）**，下载链接在落盘前过期（签名 1 小时）。重复下载免费，待 MCP 工具恢复后重新获取链接即可落盘：
  - 怪物：`zombie_voice_groan_croak`(9)、`zombie_voice_hiss`(6)、`zombie_voice_general_emote`(14)、`zombie_voice_groan`(13)、`troll_monster_growl_slow`(4)
  - 武器：`gun_semi_auto_rifle_shot`(8)、`gun_semi_auto_rifle_shot_00_tail_only`(1)、`sci-fi_weapon_rifle_large_shot`(5)、`gun_shotgun_shot`(4)、`gun_shotgun_cock`(5)、`gun_shotgun_load_bullet`(8)
  - 命中：`bullet_impact_body_flesh`(8)、`bullet_impact_concrete_brick`(8)、`bullet_impact_metal_light`(8)、`bullet_impact_metal_heavy`(8)、`metal_tin_impacts_hit_hard`(5)
- 落盘映射脚本已就绪：`.codely-cli/audio-import/import-lib.ps1`（含全部重命名映射，替换其中 URL 为新签名即可执行，覆盖 83 个 P0 文件）。

### 9.2 素材库映射方案（已购 16 组 → 83 个 P0 文件）

| 清单项 | 来源素材组 |
|---|---|
| `enemy/walker/idle-{01..04}` | zombie_voice_groan_croak 01–04 |
| `enemy/walker/alert-{01..03}` | zombie_voice_hiss 01–03 |
| `enemy/walker/attack-{01..04}` | zombie_voice_general_emote 01–04 |
| `enemy/walker/hit-{01..04}` | zombie_voice_general_emote 05–08 |
| `enemy/walker/death-{01..04}` | zombie_voice_groan 01–04 |
| `enemy/runner/pounce-{01..03}` | zombie_voice_hiss 04–06 |
| `enemy/runner/hit-{01..03}` | zombie_voice_general_emote 09–11 |
| `enemy/runner/death-{01..03}` | zombie_voice_general_emote 12–14 |
| `enemy/brute/death-{01..03}` | troll_monster_growl_slow 01–03 |
| `weapon/assault-rifle/fire-{01..05}` | sci-fi_weapon_rifle_large_shot 01–05 |
| `weapon/assault-rifle/mech-{01..03}` | gun_semi_auto_rifle_shot 01–03 |
| `weapon/assault-rifle/tail-01` | gun_semi_auto_rifle_shot_00_tail_only 01 |
| `ark/turret/machine-gun/fire-{01..05}` | gun_semi_auto_rifle_shot 04–08 |
| `weapon/shotgun/fire-{01..04}` | gun_shotgun_shot 01–04 |
| `weapon/shotgun/pump-{01..03}` | gun_shotgun_cock 01–03 |
| `weapon/shotgun/shell-load`、`reload` | gun_shotgun_load_bullet 01、02 |
| `weapon/impact/flesh-{01..06}` | bullet_impact_body_flesh 01–06 |
| `weapon/impact/concrete-{01..04}` | bullet_impact_concrete_brick 01–04 |
| `weapon/impact/metal-{01..05}` | bullet_impact_metal_light 01–05 |
| `weapon/impact/armor-{01..05}` | bullet_impact_metal_heavy 01–05 |
| `ark/core/hit-{01..04}` | bullet_impact_metal_light 06–08 ＋ metal_heavy 06 |
| `ark/armor/hit-{01..05}` | metal_tin_impacts_hit_hard 01,02,04,05,06 |

### 9.3 待购买音组（积分不足被拒，约 265 积分）

`footstep_concrete_walk`(35)、`footstep_concrete_land`(35)、`footstep_gravel_walk`(35)、`ui_menu_button_confirm`(35)、`ui_menu_button_cancel`(10)、`Standard Humanoid Hurt (9)/(8)/(7)/(6)`(4×10)、`engine_generator`(35)、`GENERATOR_Pulsating`(20)、`GENERATOR_Dark_Deep`(10)、`Coin Single Drop On Metal Surface`(10)。

映射：footstep_concrete_walk→`player/footstep-concrete-{01..05}`；footstep_concrete_land→`player/dodge-land-{01..03}`＋`enemy/brute/impact-{01..04}`；footstep_gravel_walk→`player/footstep-rubble-{01..05}`；ui confirm 组 16 条拆分→`ui/{click,confirm,tab-switch,module-place,module-move,module-remove,item-equip,item-unequip}`；cancel→`ui/cancel`；Hurt×4→`player/hit-health-{01..04}`；engine_generator 4 循环→`ark/generator/{normal,damaged}-loop`＋`ark/workshop/{working,damaged}-loop`；Pulsating→`ark/generator/overload-loop`；Dark_Deep→`ark/core/idle-loop`；Coin→`world/pickup/coin`。

### 9.4 生成缺口（清单其余全部）

- 下载失败：`metal_lid_movement_impact` 素材组不存在（补给箱/保险箱开启改为生成）。
- 待生成独特音效约 84 项：方舟核心警报/恢复/损毁、供电系列、炮塔状态、玩家翻滚/换枪/维修/治疗/倒地/复活/护盾系列、金属脚步×5、武器尾音与第 5 变体、impact 的 shield/weakpoint/critical 系列、特殊怪远程预警、搜刮与事件、UI 其余 12 项、环境床 7 项。
- 待生成音乐 20 首（§2.1 十段循环＋§2.2 十个 stinger）。
- 待生成系统语音广播 13 条（§2.10，TTS）。

### 9.5 阻塞原因

执行中素材库扣费后积分耗尽（`NotEnoughBalance`），随后 Generator MCP 服务器与本会话断开（`download_audio_lib` 等工具不再可用）。恢复条件：① 重新连接 Generator MCP；② 充值积分。已购 16 组可免费重下，不会重复扣费。
