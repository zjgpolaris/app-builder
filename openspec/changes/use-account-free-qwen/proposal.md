## Why

百炼控制台显示当前账户可用免费额度包含 `qwen3.8-flash`，但不包含先前的默认模型 `qwen3.7-plus`。默认值应与该账户实际剩余额度保持一致。

## What Changes

- 将默认千问模型改为 `qwen3.8-flash`。
- 同步测试、示例配置和部署文档。
- 生产环境显式设置 `DASHSCOPE_MODEL=qwen3.8-flash`。

## Capabilities

### New Capabilities

### Modified Capabilities

- `qwen-model-selection` — 默认模型改为当前账户已确认有额度的模型。

## Impact

- 新部署与未显式配置的本地请求将使用 `qwen3.8-flash`。
