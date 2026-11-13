# App Builder

一个根据自然语言需求生成可交互网页应用并提供在线预览的原型。

## 评审试用

1. 打开工作台，输入「做一个中文待办清单，可以新增任务，并用复选框标记完成」，点击「生成应用」。在预览里新增一条任务并勾选。
2. 再输入「做一个中文支出记录，能添加支出名称和金额，并显示总额」。在预览里分别添加 12 和 8，确认总额为 20。
3. 点击记账页预览上方的「继续修改」，输入「在每条支出右侧加一个删除按钮，删除后更新总额」，然后点击「应用修改」。在新版预览中添加并删除一条支出。
4. 刷新工作台，确认原始需求和修改后的记账应用都已恢复。预览中的交易记录会重置，工作台保存的是需求和应用代码。
5. 如果暂时无法连接模型，使用示例卡片上的「试用」操作内置应用。这个入口可以验证交互预览，不会发起模型请求。

## 实现说明

- **生成**：工作台把自然语言需求发给 `POST /api/generate`。服务端约束模型返回标题、HTML、CSS 和 JavaScript，并校验结果后再渲染。首版选用单页产物，一次请求就能得到可运行的应用，也省去了依赖安装和构建队列。
- **预览与恢复**：工作台在受限的 iframe 内运行生成的 JavaScript，隔离预览和宿主页面。只有成功生成的需求和代码才会覆盖最近项目。新请求失败时仍能查看上一次结果。
- **开发与验收**：用 Codex 和 Superpowers 拆解开发与验收步骤，用 OpenSpec 记录需求、技术取舍和验收场景。固定响应的浏览器测试覆盖等待、重试、隔离、恢复和移动端，独立的真实模型测试覆盖两种应用及其实际交互。
- **继续修改**：模型根据当前应用代码和新增要求返回新版。等待或失败时，原预览仍可操作。成功后保存新版代码和原始需求，预览重新运行。
- **扩展顺序**：先加入版本历史和回退，再支持预览应用保存其运行数据。有多人协作需求时，再加入服务端持久化和访问权限。

## 本地运行

使用 Node.js 24。在项目根目录执行以下命令。模型凭据放在服务端的 `.env.local`，改动后重启开发服务。

```bash
npm ci
cp .env.example .env.local
npm run dev
```

打开终端显示的本地地址。点击「待办清单」或「支出记录」填入示例需求，再点击「生成应用」。内置示例不会替换已保存的项目。

选择一种真实模型接入方式：

- **阿里云百炼（千问）**：将 `DASHSCOPE_API_KEY` 和 `DASHSCOPE_BASE_URL` 写入 `.env.local`，然后重启服务。`DASHSCOPE_MODEL` 默认为 `qwen-plus`。接口地址以百炼控制台为准，填写到 `/compatible-mode/v1`。北京业务空间的地址示例在 `.env.example`。
- **OpenAI**：在 `.env.local` 填写 `OPENAI_API_KEY`。`OPENAI_MODEL` 默认为 `gpt-5-mini`，可改为支持 Responses API 结构化输出的模型。
- **Ollama**：启动 [Ollama](https://docs.ollama.com/macos) 后运行 `ollama pull qwen2.5-coder:3b`，再用 `OLLAMA_MODEL=qwen2.5-coder:3b npm run dev` 启动工作台。也可以把 `OLLAMA_MODEL` 写入 `.env.local` 并重启工作台。本地开发服务会访问 `127.0.0.1:11434`。

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

将 GitHub 仓库导入 Vercel 项目，框架选择 Vite，Node.js 选择 24.x。启用项目的 OIDC Federation 后，部署函数可用项目身份访问 [Vercel AI Gateway](https://vercel.com/docs/ai-gateway/authentication-and-byok)。如果配置了 `OPENAI_API_KEY`，函数会直接使用 OpenAI。`OPENAI_MODEL` 默认选择 `gpt-5-mini`。`vercel.json` 将生成接口的运行上限设为 60 秒。部署后，用无痕窗口确认评审可以直接访问。

生成接口带有按实例计数的限流。对外开放前，在 Vercel 配置 `/api/generate` 的入口限流，并为模型项目配置用量告警。用无痕窗口分别生成待办清单和记账页，实际操作预览，再刷新确认项目恢复。

使用千问时，在 Vercel 项目的 **Environment Variables** 中为 **Production** 添加 `DASHSCOPE_API_KEY`（类型选 **Secret**）与 `DASHSCOPE_BASE_URL`。`DASHSCOPE_MODEL` 可选，默认 `qwen-plus`。保存后创建一次新的生产部署。项目发现百炼密钥或地址时优先使用千问，配置不完整或请求失败时返回错误。

只使用新人免费额度时，请在百炼控制台选 **华北 2（北京）**，确认所选模型还有额度，并在发送请求前开启「免费额度用完即停」。免费额度由百炼按模型管理。[百炼免费额度说明](https://help.aliyun.com/zh/model-studio/new-free-quota)

## 开发流程

在 Codex 的官方插件市场安装 Superpowers，并从本项目目录开始会话。项目已包含 OpenSpec 的 Codex 技能，可以用 `$openspec-explore` 梳理需求，或用 `$openspec-propose` 创建首个变更。

用 Superpowers 梳理需求、评估方案和指导实现。用 OpenSpec 记录变更的提案、设计、验收场景和任务清单。完成实现与验证后，用 `$openspec-archive-change` 归档变更。
