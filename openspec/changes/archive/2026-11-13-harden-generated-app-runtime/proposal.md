## Why

真实千问生成的 Canvas 游戏返回了无法运行的 JavaScript，但首次生成未做语法校验，工作台仍将其保存为成功项目。预览只显示通用错误，用户无法判断原因或快速修复。

## What Changes

- 对首次生成和继续修改的 JavaScript 统一做服务端语法校验。
- 千问返回语法错误时自动请求一次定向修复，修复仍无效则不保存结果。
- 预览将受限的错误摘要传回工作台，并提供基于当前应用的修复入口。
- 补齐线上地址、GitHub 地址和真实模型验收说明。

## Capabilities

### New Capabilities

- `generated-app-validation` — 阻止无效脚本成为成功项目，并为运行时错误提供可恢复路径。

### Modified Capabilities

## Impact

- 生成路由、千问适配层、预览 iframe、工作台错误恢复和验收测试。
