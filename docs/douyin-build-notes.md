# 抖音小游戏构建预留

本阶段只做工程与适配预留，**未**接入抖音登录 / 广告 / 真机提审。

## Creator 构建

1. 菜单：**项目 → 构建发布**
2. 发布平台选择：**字节跳动小游戏**（或当前 Creator 显示的「抖音小游戏」）
3. 确认横屏：与 `settings/v2/packages/device.json`、设计分辨率 `1334×750` 一致
4. 包名 / AppID：使用抖音开放平台申请的值替换 `config.json` 中的 `package` 占位

## 后续接入点（未实现）

| 能力 | 建议落点 |
|------|----------|
| 抖音登录 | `assets/script/game/account/` |
| 开放能力 / 分享 | `account` 或独立 `platform/douyin/` |
| 远程 Bundle | `assets/resources/config.json` → `bundle` |

## 本地验证顺序

1. 编辑器预览：Loading → 主界面（Hall）
2. 构建抖音包 → 开发者工具预览
3. 再接登录与真机
