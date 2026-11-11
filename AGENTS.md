# App Builder 开发约定

- 用 Superpowers 梳理需求、评估方案，并在实现时采用其适用的测试、调试和审查流程。
- 用 OpenSpec 管理功能变更。将设计、验收场景和任务记录在 `openspec/changes/`，实现时以对应变更为准，验证完成后归档。规范和任务统一维护在 OpenSpec 的变更文件中。
- 从项目根目录通过 `npm exec -- openspec <命令>` 运行项目锁定的 CLI。
