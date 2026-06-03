# MT大冒险美术素材清单

## 目标风格

- 方向：荒诞职场绘本感，手绘卡通，粗黑描边，暖色，轻喜剧。
- 原则：减少杂乱背景，把主角、关卡冲突、梦境能力放大；游戏内 sprite 要比当前矢量小人更有表情和辨识度。
- 文本策略：图片尽量不生成文字，关卡名和说明由 HTML/CSS 叠加，避免 AI 字体错误。

## 第一优先级：展示与进入关卡

1. `level1-opening-banner-v2`：上班路上，堵车、公交站、施工、积水，主角准备飞起。
2. `level2-opening-banner-v2`：公司大厅，闸机、电梯、工牌、无敌护盾。
3. `level3-opening-banner-v2`：会议室，插话同事、话筒、甩锅、全员定格。
4. `level4-opening-banner-v2`：食堂高峰，餐盘、人群让路、油污与餐车。
5. `level5-opening-banner-v2`：CEO 办公室，任命书、工牌、董事会、老板光环。
6. `dream-wakeup-ending-banner-v2`：梦醒卧室，闹钟、床、梦泡泡、CEO 梦消散。

## 第二优先级：人物 sprite

1. 主角基础动作：站立、跑步、跳跃、飞行、受伤/摔倒、CEO 光环状态。
2. NPC/敌人：路人、同事、行政、经理、插话同事、食客、秘书/助理。
3. 表情差异：疲惫、惊讶、得意、慌张、插话、严肃。

## 第三优先级：道具 sprite

1. 通用：MT 币、咖啡、香蕉皮、积水/油污、伞/防滑贴、工牌。
2. 关卡机关：闸机、门、电梯、打印机、公交、餐车、餐盘、回收区。
3. 会议室：润喉糖、话筒、PPT、文件夹、飞来的锅、便签。
4. CEO 办公室：任命书、CEO 工牌、文件夹、董事会椅子、老板椅、闹钟。

## 第四优先级：梦境特效

1. 飞行梦：上升气流、梦云、翅膀光效。
2. 无敌梦：打卡章护盾、金色描边。
3. 定格梦：暂停波纹、冻结线。
4. 让路梦：人群分开光路、餐盘悬浮。
5. 老板光环：CEO 光环、金色身份气场。

## 接入建议

1. 先替换开始弹窗和结尾图，收益最大，风险最小。
2. 再用 sprite sheet 做图像预加载和绘制 helper，逐步替换 `drawPlayer`、`drawEnemy`、`drawCoffee` 等函数。
3. 最后补梦境特效层，强化“梦境模式”的视觉记忆点。

## 已生成资产

### 关卡背景横图

- `assets/images/generated/level1-sky-panorama-borderless.webp`
- `assets/images/generated/level2-sky-panorama-borderless.webp`
- `assets/images/generated/level3-sky-panorama-borderless.webp`
- `assets/images/generated/level4-sky-panorama-borderless.webp`
- `assets/images/generated/level5-sky-panorama-borderless.webp`

### 关卡开场图与结尾图

- `assets/images/generated/level1-opening-banner.webp`
- `assets/images/generated/level2-opening-banner.webp`
- `assets/images/generated/level3-opening-banner.webp`
- `assets/images/generated/level4-opening-banner.webp`
- `assets/images/generated/level5-opening-banner.webp`
- `assets/images/generated/dream-wakeup-ending-banner.webp`

### 角色与敌人

- `assets/images/generated/art-v2/characters-atlas-v1.webp`
- `assets/images/generated/art-v2/hero-idle-v2.webp`
- `assets/images/generated/art-v2/hero-run-v2.webp`
- `assets/images/generated/art-v2/hero-jump-v2.webp`
- `assets/images/generated/art-v2/enemy-walk-v2.webp`
- `assets/images/generated/art-v2/manager-v2.webp`

### 道具与梦境特效

- `assets/images/generated/art-v2/props-atlas-v1.webp`
- `assets/images/generated/art-v2/dream-effects-atlas-v1.webp`

## 已接入代码

- 5 个关卡的背景长图已切到 `level*-sky-panorama-borderless`。
- 5 个关卡开始弹窗已支持并使用关卡开场图。
- 结尾梦醒页已使用 `dream-wakeup-ending-banner`。
- 主角 `idle/run/jump` 已切到 art-v2 美术。
- 通用敌人 `enemySprites.walk` 已切到 art-v2 美术。
- `props-atlas-v1` 已拆成单个道具图，并接入关卡内常用道具：MT 币、咖啡、香蕉、水洼、油污、雨伞/防滑提示、工牌、闸机、打印机、箱子、电梯、便签、飞锅、话筒、润喉糖、餐盘、餐车、文件夹等。
- `dream-effects-atlas-v1` 已拆成单个特效图，并接入梦境状态：第 2 关无敌盾、第 3 关静止场、第 4 关让路/餐盘光效、第 5 关 CEO 光环/聚光。
- 第一关梦境飞行已接入翅膀和上升气流。

## 待接入代码

- 经理、行政、食客、秘书等敌人类型可进一步细分 sprite。
- 当前 `manager-v2` 已在第 5 关 NPC 试用，后续可继续为秘书、食客、行政等生成更准确的单独角色。
