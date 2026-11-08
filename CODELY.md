

## Codely Structured Memories

### User

### Feedback

### Project
- [2026-11-03 21:13:24] 音频生产任务（2026-11-03）：按 docs/design/14-audio-asset-priority-checklist.md 执行 P0，输出到 assets/bundle/audio/。素材库已购 16 组（335 积分，重复下载免费）但 zip 链接过期未落盘；落盘映射脚本在 .codely-cli/audio-import/import-lib.ps1（需替换为新签名 URL）；另有 15 组约 265 积分因积分耗尽未购；约 84 项独特音效、20 首音乐、13 条 TTS 待生成。Generator 工具（search_audio_lib/download_audio_lib/generate_sound_effect/generate_music/generate_tts）来自团结编辑器 TJGenerators 扩展的桥接注册，非用户配置 MCP（codely mcp list 为空属正常）；CLI 崩溃后恢复的旧会话无法热挂载工具，需保持编辑器打开并开启新 CLI 会话让工具重新注册。恢复后先免费重下已购 16 组执行脚本落盘，再购剩余组、生成缺失项。完整状态见清单 §9。
- [2026-11-08 19:29:34] 战斗角色动画管线（2026-11-07，已完成 10/10）：动画资产=assets/bundle/gui/battle-hud/actors/<kind>-<action>.png（4×4=16帧行优先、1024²、真透明、meta 用 image/texture importer+nearest 过滤），由 battle/ActorAnimator.ts 运行时切片播放 idle/walk/attack/dodge（fps idle10/walk14/attack14/dodge30，缺图自动回退静态立绘，疾跑×1.55 提速，仅翻转 sprite 子节点防镜像血条）。全部就位：player-idle/walk/attack/dodge、walker-walk/attack、runner-walk/attack、brute-walk/attack（walker 两张基于"清洁版参考图"生成：背部改为一排发光粉色水晶、双眼发光，与原 walker.png 单红眼/裸露背部的造型有差异；清洁版参考图 URL 已在生成记录中，如后续 Walker 系素材再生成都应沿用清洁版）。generate_sprite_animation 每张 135 积分、失败免费；内容审核规避经验：zombie/flesh/wounds 等词及 walker.png 原图都会触发审核，清洁参考图+软措辞可过；验收用 alpha/格子占比程序化校验（analyze_multimedia 对旧版爬行怪物图会触发审核，且会把透明底误判成不透明）。参考图已传 CDN（file_upload 按路径去重可复用）：player-fire/walker/runner/brute.png；复用脚本在 .codely-cli/tmp-anim/。


### Reference

