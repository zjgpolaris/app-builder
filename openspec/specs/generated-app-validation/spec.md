# generated-app-validation Specification

## Purpose
阻止语法无效的生成脚本成为成功项目，并让用户可以理解和修复只能在受限浏览器预览中发现的运行时错误。校验过程只编译不执行生成代码，运行时恢复由用户主动触发，避免不可控的模型请求与额度消耗。

## Requirements

### Requirement: 无效脚本不得成为成功项目

生成服务 SHALL 在返回应用前编译检查 JavaScript，且 SHALL NOT 在服务端执行生成脚本。

#### Scenario: 首次生成返回语法错误

- **WHEN** 模型返回字段完整但 JavaScript 语法无效的应用
- **THEN** 服务不将它返回为成功项目

#### Scenario: 千问可修复语法错误

- **WHEN** 千问首次返回的脚本语法无效，修复请求返回有效脚本
- **THEN** 服务最多请求一次修复并返回完整的修复应用

### Requirement: 运行时错误可诊断且可恢复

预览 SHALL 显示生成脚本的受限错误摘要，并 SHALL 让用户将该错误作为修改要求应用到当前项目。

#### Scenario: 预览脚本抛出异常

- **WHEN** 已生成脚本在受限 iframe 中抛出异常
- **THEN** 工作台显示错误摘要和「修复应用」入口
- **AND** 用户触发后进入继续修改流程，原预览保留到修复成功
