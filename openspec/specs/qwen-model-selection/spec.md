# qwen-model-selection Specification

## Purpose
规定百炼默认模型与环境变量覆盖行为，并要求部署时核验当前账户的免费额度资格，避免因默认模型无免费额度而产生意外费用。

## Requirements

### Requirement: 默认选择有新人免费额度的千问模型

生成服务 SHALL 在未设置 `DASHSCOPE_MODEL` 时使用 `qwen3.7-plus`，并 SHALL 在设置环境变量时使用显式指定的模型。

#### Scenario: 未配置模型名称

- **WHEN** 生产环境配置百炼 API Key 和北京地域接口但未设置 `DASHSCOPE_MODEL`
- **THEN** 模型请求使用 `qwen3.7-plus`

#### Scenario: 显式覆盖模型名称

- **WHEN** 生产环境设置 `DASHSCOPE_MODEL`
- **THEN** 模型请求使用该环境变量指定的模型

#### Scenario: 核验免费资格

- **WHEN** 运维人员按照部署文档配置千问
- **THEN** 文档提示在百炼控制台核验该账户、地域和有效期下的剩余额度并开启用完即停
