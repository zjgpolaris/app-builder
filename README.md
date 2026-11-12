# App Builder

一个根据自然语言需求生成可交互网页应用并提供在线预览的原型。

## 本地运行

使用 Node.js 24。在项目根目录执行以下命令。复制后在 `.env.local` 里填写 `OPENAI_API_KEY`，重启开发服务后生效。`OPENAI_MODEL` 默认为 `gpt-5-mini`，可改为支持 Responses API 结构化输出的模型。

```bash
npm ci
cp .env.example .env.local
npm run dev
```

打开终端显示的本地地址。点击「待办清单」或「支出记录」填入示例需求，再点击「生成应用」。没有密钥时，点击对应卡片上的「试用」即可操作内置示例。示例不会替换已保存的项目。

刷新工作台可恢复同一浏览器里最近一次成功生成的需求和应用代码。预览内部的任务、支出等运行数据会在重新加载预览时重置。

没有 OpenAI 密钥时，可以用 [Ollama](https://docs.ollama.com/macos) 在本机运行真实生成。启动 Ollama 后运行 `ollama pull qwen2.5-coder:3b`，再用 `OLLAMA_MODEL=qwen2.5-coder:3b npm run dev` 启动工作台。也可以把 `OLLAMA_MODEL` 写入 `.env.local` 并重启工作台。本地开发服务会访问 `127.0.0.1:11434`。

## 验证

```bash
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

端到端测试使用固定模型响应验证页面行为，可在无密钥时运行。若已安装 Chrome，也可以运行 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`。

模型配置完成后，用以下命令对本地或线上工作台运行真实生成验收。测试使用独立浏览器会话，实际调用两次生成接口，并验证待办勾选、记账合计和项目恢复。

```bash
APP_BUILDER_URL=http://127.0.0.1:5173 npm run test:live
```

## Vercel 部署

将 GitHub 仓库导入 Vercel 项目，框架选择 Vite，Node.js 选择 24.x。为生产环境配置 `OPENAI_API_KEY`，需要时再配置 `OPENAI_MODEL`。`vercel.json` 将生成接口的运行上限设为 60 秒。部署后，检查访问保护设置，使评审可以直接访问。

生成接口带有按实例计数的限流。对外开放前，在 Vercel 配置 `/api/generate` 的入口限流，并为模型项目配置用量告警。用无痕窗口分别生成待办清单和记账页，实际操作预览，再刷新确认项目恢复。

## 开发流程

在 Codex 的官方插件市场安装 Superpowers，并从本项目目录开始会话。项目已包含 OpenSpec 的 Codex 技能，可以用 `$openspec-explore` 梳理需求，或用 `$openspec-propose` 创建首个变更。

用 Superpowers 梳理需求、评估方案和指导实现。用 OpenSpec 记录变更的提案、设计、验收场景和任务清单。完成实现与验证后，用 `$openspec-archive-change` 归档变更。
