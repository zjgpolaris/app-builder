# Design

## Context

预览在工作台右侧的 `.preview-panel` 内，iframe 的默认最小高度为 384px；手机为 320px。iframe 隔离与项目命名空间已经由现有组件提供。

## Goals / Non-Goals

**Goals:** 扩大默认视口；以浏览器全屏能力展示整个预览面板；切换时不重建 iframe。

**Non-Goals:** 改变生成应用的代码或存储方式。

## Decisions

- 在已有预览面板上调用 Fullscreen API，使用 `fullscreenchange` 同步按钮状态。面板位置不变，避免切换时重新挂载 iframe。
- 桌面预览采用视口高度相关的下限；手机使用适合窄屏的高度。全屏时面板和内部 iframe 填满屏幕，覆盖默认最小高度。
- 全屏按钮使用明确的进入/退出标签；浏览器 Esc 退出后状态也同步。

## Risks / Trade-offs

- 浏览器可能拒绝全屏请求 → 保持原有工作台可用，并在控制台记录失败；默认预览已扩大。
