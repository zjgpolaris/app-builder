# Proposal

## Why

当前工作台只保存需求和生成代码，预览中的任务、支出等运行数据会在重新加载预览或刷新页面后丢失，不满足笔试题对“数据持久化”的明确要求。需要在保持生成代码与宿主页面隔离的前提下，为生成应用提供可控、可验证的浏览器持久化能力。

## What Changes

- 为每个生成项目和内置示例分配独立的数据命名空间，并在同一浏览器中保存其预览运行数据。
- 在受限 iframe 中提供兼容 Web Storage 的持久化接口，使生成应用可使用 `localStorage`，但不能直接读取工作台文档或宿主存储。
- 要求模型生成的有状态应用保存并恢复用户数据，并让待办、记账内置示例覆盖该能力。
- 在重新加载预览、刷新工作台和重新打开站点后恢复最近项目的应用代码与运行数据；新建项目与其他示例不得继承旧数据。
- 对存储不可用、数据损坏和容量超限提供安全降级，不影响当前预览继续交互。
- 增加自动化验收与交付文档，明确数据持久化范围和限制。

## Capabilities

### New Capabilities

- `preview-data-persistence`: 规定受限预览中的应用数据如何按项目隔离、保存、恢复及在存储异常时降级。

### Modified Capabilities

<!-- 无。现有 interactive-preview 的宿主隔离要求保持不变，新增能力通过受控桥接实现。 -->

## Impact

- 前端预览运行时：`src/Preview.tsx`、`src/Workspace.tsx`、`src/project.ts`、`src/examples.ts`。
- 模型生成约束：`server/instructions.ts`。
- 项目存储结构：最近项目记录需要稳定标识，并兼容现有版本数据。
- 测试与交付说明：`tests/workspace.spec.ts`、`tests/generation.live.spec.ts`、`README.md`。
- 不新增服务端数据库、账户体系或跨设备同步；数据仍仅保存在当前浏览器。
