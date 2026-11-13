# App Builder

一个根据自然语言需求生成可交互网页应用并提供在线预览的原型。

- **在线工作台**：https://app-builder-zjgpolaris.vercel.app/
- **GitHub 源码**：https://github.com/zjgpolaris/app-builder

## 评审试用

1. 打开工作台，输入「做一个中文待办清单，可以新增任务，并用复选框标记完成；用 localStorage 保存任务和勾选状态，刷新后恢复」，点击「生成应用」。在预览里新增一条任务并勾选，再点「重新加载预览」确认保留。
2. 输入「做一个 2048 游戏，支持方向键移动、相同数字合并、计分，刷新后保留进度」。生成后直接按方向键；若稍后在需求框输入过文字，先点击预览。确认棋盘移动、相同数字合并后分数增加，再点「重新加载预览」和刷新工作台确认进度保留。
3. 输入「做一个费用记录应用，输入名称和金额后能新增记录，显示总额，能删除单条记录；刷新后保留数据」。新增 20 元和 30 元，确认总额为 50 元；删除 20 元记录后总额为 30 元。重载预览并刷新工作台，确认剩余记录和总额恢复。
4. 如果暂时无法连接模型，可点击示例卡片上的「试用支出记录」，重复 20+30=50、删除和刷新恢复。内置示例无需模型，不会替换已保存项目。

## 实现说明

- **生成**：工作台把自然语言需求发给 `POST /api/generate`。服务端约束模型返回标题、HTML、CSS 和 JavaScript，并校验结果后再渲染。首版选用单页产物，一次请求就能得到可运行的应用，也省去了依赖安装和构建队列。
- **预览与恢复**：工作台在受限的 iframe 内运行生成的 JavaScript，隔离预览和宿主页面。只有成功生成的需求和代码才会覆盖最近项目。生成应用通过隔离的 `localStorage` 兼容接口保存业务数据，宿主按项目命名空间落盘；新请求失败时仍能查看上一次结果。
- **开发与验收**：用 Codex 和 Superpowers 拆解开发与验收步骤，用 OpenSpec 记录需求、技术取舍和验收场景。固定响应的浏览器测试覆盖等待、重试、隔离、恢复和移动端，独立的真实模型测试覆盖两种应用及其实际交互。
- **继续修改**：模型根据当前应用代码和新增要求返回新版。等待或失败时，原预览仍可操作。成功后保存新版代码和原始需求，预览重新运行。
- **生成可靠性**：所有生成脚本在服务端只编译不执行。千问语法错误自动修复一次；浏览器运行时错误会显示摘要，并可用当前代码继续修复。
- **扩展顺序**：先加入版本历史和回退；有跨设备协作需求时，再加入服务端持久化和访问权限。

### 已知限制

- 只保存最近一个项目的需求和应用代码。预览业务数据仅在生成代码使用 `localStorage` 时保存于当前浏览器；不会自动保存任意 DOM、Canvas 或内存状态。内置待办和记账示例已实现该能力。
- 每个预览的数据容量有限，浏览器清除站点数据或拒绝存储时无法跨刷新恢复。旧版项目此前未保存的业务数据无法补回。
- 无账户、跨设备同步、多项目列表和版本回退。
- 公开生成接口只有按实例内存限流；正式长期开放前需要接入持久化限流或访问控制。
- 自由文本生成仍受模型输出影响。发布前的真实模型验收覆盖具体的 2048 和费用记录操作；不同措辞或更复杂需求仍可能需要使用「继续修改」修正生成代码。

## 本地运行

使用 Node.js 24。在项目根目录执行以下命令。模型凭据放在服务端的 `.env.local`，改动后重启开发服务。

```bash
npm ci
cp .env.example .env.local
npm run dev
```

打开终端显示的本地地址。点击「待办清单」或「支出记录」填入示例需求，再点击「生成应用」。内置示例不会替换已保存的项目。

选择一种真实模型接入方式：

- **阿里云百炼（千问）**：将 `DASHSCOPE_API_KEY` 和 `DASHSCOPE_BASE_URL` 写入 `.env.local`，然后重启服务。`DASHSCOPE_MODEL` 默认为 `qwen3.8-flash`。接口地址以百炼控制台为准，填写到 `/compatible-mode/v1`。北京业务空间的地址示例在 `.env.example`。
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

模型配置完成后，用以下命令对本地或线上工作台运行真实生成验收。测试使用独立浏览器会话，实际调用模型，并验证待办勾选、2048 移动合并计分、费用新增删除，以及重载预览和页面刷新后的恢复。模型生成质量不稳定时，测试会明确失败。

```bash
APP_BUILDER_URL=http://127.0.0.1:5173 npm run test:live
```

## Vercel 部署

将 GitHub 仓库导入 Vercel 项目，框架选择 Vite，Node.js 选择 24.x。启用项目的 OIDC Federation 后，部署函数可用项目身份访问 [Vercel AI Gateway](https://vercel.com/docs/ai-gateway/authentication-and-byok)。如果配置了 `OPENAI_API_KEY`，函数会直接使用 OpenAI。`OPENAI_MODEL` 默认选择 `gpt-5-mini`。`vercel.json` 将生成接口的运行上限设为 60 秒。部署后，用无痕窗口确认评审可以直接访问。

生成接口带有按实例计数的限流。对外开放前，在 Vercel 配置 `/api/generate` 的入口限流，并为模型项目配置用量告警。用无痕窗口分别生成待办清单和记账页，实际操作预览，再刷新确认项目恢复。

使用千问时，在 Vercel 项目的 **Environment Variables** 中为 **Production** 添加 `DASHSCOPE_API_KEY`（类型选 **Secret**）与 `DASHSCOPE_BASE_URL`。`DASHSCOPE_MODEL` 可选，默认 `qwen3.8-flash`。保存后创建一次新的生产部署。项目发现百炼密钥或地址时优先使用千问，配置不完整或请求失败时返回错误。

`qwen3.8-flash` 的新人免费额度仅在符合百炼当期政策、华北2（北京）地域和有效期的账户下生效。部署前必须在百炼控制台的「免费额度」页确认该模型显示剩余 Token，并为它开启「免费额度用完即停」。模型政策变更时，通过 `DASHSCOPE_MODEL` 显式切换，不要仅根据模型可调用判断是否免费。

只使用新人免费额度时，请在百炼控制台选 **华北 2（北京）**，确认所选模型还有额度，并在发送请求前开启「免费额度用完即停」。免费额度由百炼按模型管理。[百炼免费额度说明](https://help.aliyun.com/zh/model-studio/new-free-quota)

## 开发流程

在 Codex 的官方插件市场安装 Superpowers，并从本项目目录开始会话。项目已包含 OpenSpec 的 Codex 技能，可以用 `$openspec-explore` 梳理需求，或用 `$openspec-propose` 创建首个变更。

用 Superpowers 梳理需求、评估方案和指导实现。用 OpenSpec 记录变更的提案、设计、验收场景和任务清单。完成实现与验证后，用 `$openspec-archive-change` 归档变更。
