## Why

线上默认调用 `qwen-plus`，但该模型当前不提供新人免费额度，导致首次生成就进入按量计费。默认配置需要改为当前提供新人免费额度的模型，并明确免费资格以百炼控制台为准。

## What Changes

- 将千问默认模型从 `qwen-plus` 改为 `qwen3.7-plus`。
- 保留 `DASHSCOPE_MODEL` 覆盖能力，便于免费政策变化后显式切换。
- 更新部署文档和示例配置，说明地域、有效期和“用完即停”的限制。

## Capabilities

### New Capabilities

- `qwen-model-selection` — 在未显式配置模型时使用当前提供新人免费额度的千问模型。

### Modified Capabilities

## Impact

- 千问请求的默认 `model` 字段和部署说明发生变化；API 形状与已有密钥保持兼容。
