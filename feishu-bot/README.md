# 飞书 AI 群聊机器人

一个基于 Node.js + TypeScript 的飞书群聊机器人，能够接收群聊消息并使用 AI 模型（Gemini / Claude / GPT 等）自动生成回复。

---

## 目录

- [设计思路](#设计思路)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [飞书应用配置指南](#飞书应用配置指南)
- [AI 模型配置](#ai-模型配置)
- [部署方式](#部署方式)
- [功能说明](#功能说明)
- [开发过程记录](#开发过程记录)
- [遇到的问题与解决方案](#遇到的问题与解决方案)

---

## 设计思路

### 核心架构

```
飞书群聊用户
    │
    ▼
飞书服务器 ──(事件订阅 HTTP POST)──▶ Express 服务器 (/webhook/event)
                                          │
                                          ▼
                                    EventDispatcher (飞书 SDK)
                                          │
                                          ▼
                                    event-handler.ts
                                    ├── 消息去重 (Set + TTL)
                                    ├── 消息过滤 (仅文本)
                                    ├── 指令处理 (/help, /clear)
                                    └── AI 调用
                                          │
                                          ▼
                                    ai-service.ts
                                    ├── OpenAI 兼容接口
                                    ├── 会话上下文记忆
                                    └── 多模型支持
                                          │
                                          ▼
                                    feishu-client.ts
                                    └── 引用回复消息到群聊
```

### 设计决策

1. **使用飞书官方 SDK (`@larksuiteoapi/node-sdk`)**
   - 自动处理 `tenant_access_token` 的获取和刷新
   - 内置事件订阅验证（Encrypt Key / Verification Token）
   - 自动处理飞书的 URL Challenge 验证
   - 比手动调用 HTTP API 更可靠

2. **使用 OpenAI 兼容接口作为 AI 统一层**
   - 通过 `openai` SDK + 可配置的 `baseURL`，一套代码支持所有主流 AI 提供商
   - Google Gemini 已原生支持 OpenAI 兼容格式
   - 切换模型只需改环境变量，无需改代码

3. **消息去重机制**
   - 使用 `Set<string>` 存储已处理的 `message_id`
   - 设置 5 分钟 TTL 自动清除，防止内存泄漏
   - 应对飞书因超时等原因重试推送同一事件的场景

4. **引用回复而非直接发送**
   - 使用 `reply` API 而非 `create` API
   - 在群聊中明确显示机器人在回复哪条消息，体验更好

5. **会话上下文记忆**
   - 以 `chat_id` 为维度维护对话历史
   - 保留最近 20 条对话，超出自动裁剪
   - 支持 `/clear` 指令手动清除

---

## 技术栈

| 技术 | 用途 |
|------|------|
| Node.js 20+ | 运行时 |
| TypeScript 5 | 类型安全 |
| Express | HTTP 服务器 |
| @larksuiteoapi/node-sdk | 飞书 API & 事件订阅 |
| openai (SDK) | AI 模型调用（兼容多提供商） |
| dotenv | 环境变量管理 |
| Docker | 容器化部署（可选） |

---

## 项目结构

```
feishu-bot/
├── src/
│   ├── index.ts            # 入口：Express 服务器 + 路由
│   ├── config.ts           # 环境变量配置加载与校验
│   ├── event-handler.ts    # 飞书事件处理（接收消息、去重、分发）
│   ├── feishu-client.ts    # 飞书 API 客户端封装（发送/回复消息）
│   └── ai-service.ts       # AI 模型调用（多提供商支持 + 上下文记忆）
├── dist/                   # TypeScript 编译输出
├── .env.example            # 环境变量模板
├── .gitignore
├── Dockerfile              # Docker 容器化构建
├── package.json
├── tsconfig.json
└── README.md
```

---

## 快速开始

### 前提条件

- Node.js >= 20
- 飞书开放平台开发者账号（[注册地址](https://open.feishu.cn)）
- 至少一个 AI 模型的 API Key

### 1. 安装依赖

```bash
cd feishu-bot
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的配置：

```env
# 飞书应用凭证
FEISHU_APP_ID=cli_xxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_ENCRYPT_KEY=your-encrypt-key
FEISHU_VERIFICATION_TOKEN=your-verification-token

# AI 配置（以 Gemini 为例）
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_API_KEY=your-gemini-api-key
AI_MODEL=gemini-2.5-flash

# 服务端口
PORT=3000
```

### 3. 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build && npm start
```

### 4. 暴露公网地址

飞书事件订阅需要公网可访问的 URL。开发时可使用 ngrok：

```bash
ngrok http 3000
```

将获得的公网地址（如 `https://xxxx.ngrok-free.app`）用于飞书事件订阅配置。

---

## 飞书应用配置指南

### Step 1: 创建飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn)，登录后进入开发者后台
2. 点击「创建企业自建应用」
3. 填写应用名称和描述
4. 记录 `App ID` 和 `App Secret`

### Step 2: 配置机器人能力

1. 在应用详情页，进入「添加应用能力」
2. 启用「机器人」能力

### Step 3: 配置事件订阅

1. 进入「事件订阅」页面
2. 配置请求地址为：`https://你的域名/webhook/event`
3. 飞书会发送一个 challenge 请求进行验证（本项目已自动处理）
4. 添加事件：`im.message.receive_v1`（接收消息）
5. 记录页面上的 `Encrypt Key` 和 `Verification Token`

### Step 4: 配置权限

在「权限管理」中申请以下权限：

| 权限 | 说明 |
|------|------|
| `im:message` | 获取与发送单聊、群组消息 |
| `im:message:send_as_bot` | 以机器人身份发送消息 |
| `im:message.group_at_msg` | 接收群聊中 @ 机器人的消息 |
| `im:message.group_at_msg:readonly` | 读取群聊中 @ 机器人的消息 |

### Step 5: 发布应用

1. 进入「版本管理与发布」
2. 创建版本并提交审核（企业内部应用通常自动通过）
3. 发布后将机器人添加到目标群聊

---

## AI 模型配置

通过修改环境变量即可切换不同的 AI 提供商，无需改动代码：

### Google Gemini（推荐，有免费额度）

```env
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_API_KEY=your-gemini-api-key
AI_MODEL=gemini-2.5-flash
```

### OpenAI (GPT)

```env
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-xxxxxxxxxxxx
AI_MODEL=gpt-4o
```

### Anthropic Claude（通过 OpenRouter 等兼容代理）

```env
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=your-openrouter-key
AI_MODEL=anthropic/claude-sonnet-4
```

### 本地模型（Ollama）

```env
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=llama3
```

---

## 部署方式

### Docker 部署

```bash
# 构建镜像
docker build -t feishu-ai-bot .

# 运行容器
docker run -d \
  --name feishu-bot \
  --env-file .env \
  -p 3000:3000 \
  feishu-ai-bot
```

### 直接部署

```bash
npm install
npm run build
npm start
```

建议配合 PM2 等进程管理工具：

```bash
npm install -g pm2
pm2 start dist/index.js --name feishu-bot
```

---

## 功能说明

### 已实现功能

- **群聊消息接收**：通过飞书事件订阅接收群内消息
- **AI 自动回复**：调用 AI 模型生成智能回复
- **多模型支持**：Gemini / GPT / Claude / 本地模型，配置切换
- **消息去重**：基于 `message_id` 的去重机制，防止重复回复
- **引用回复**：回复时引用原消息，在群聊中清晰关联
- **上下文记忆**：维护每个群的对话历史，支持多轮对话
- **指令系统**：`/help` 查看帮助，`/clear` 清除记忆
- **健康检查**：`GET /` 端点返回服务状态
- **自动 Challenge 验证**：飞书 URL 配置验证自动处理

### 消息处理流程

1. 飞书服务器推送 `im.message.receive_v1` 事件到 `/webhook/event`
2. SDK 自动验证签名、解密事件内容
3. `event-handler.ts` 检查 message_id 是否已处理（去重）
4. 过滤非文本消息，解析消息内容
5. 群聊场景下清理 `@` 占位符
6. 检查是否为特殊指令（`/help`, `/clear`）
7. 调用 `ai-service.ts` 将消息连同上下文发给 AI 模型
8. AI 返回回复后，通过 `feishu-client.ts` 的 reply API 引用回复

---

## 开发过程记录

### 思路

面试要求搭建一个飞书群聊机器人 demo，核心需求是：
1. 能接收飞书群聊消息
2. 能使用 AI 模型自动生成回复

我的技术选型思路：
- **飞书 SDK**：使用官方 `@larksuiteoapi/node-sdk`，避免手动管理 token 刷新和事件验证的复杂度
- **AI 接口**：使用 OpenAI 兼容接口作为统一抽象层，因为 Gemini 已经原生支持这个格式，Claude 可通过 OpenRouter 等代理使用，一套代码多处适用
- **TypeScript**：匹配 Optima 的技术栈要求，也提供更好的代码质量保证

### 开发步骤

1. **项目初始化**：创建 TypeScript + Express 项目骨架
2. **配置管理**：用 dotenv + 环境变量，敏感信息不入代码
3. **飞书客户端封装**：使用官方 SDK 初始化 Client，封装消息发送/回复方法
4. **事件处理器**：注册 `im.message.receive_v1` 事件监听，处理消息去重、过滤、解析
5. **AI 服务**：基于 OpenAI SDK 封装，支持上下文记忆和多模型切换
6. **入口整合**：Express 路由 + 飞书 SDK 的 `adaptExpress` 适配器
7. **Docker 化**：多阶段构建，生产镜像精简

### 使用的 AI 工具

- **OpenCode (Claude Code CLI)**：全程使用 AI 辅助编码，从架构设计到代码实现

---

## 遇到的问题与解决方案

### 问题 1: 飞书事件订阅的 URL 验证（Challenge）

**问题描述**：飞书在配置事件订阅 URL 时会发送一个 POST 请求，包含 `challenge` 字段，要求服务器原样返回以验证 URL 的有效性。

**解决方案**：飞书官方 SDK 的 `adaptExpress` 方法支持 `autoChallenge: true` 选项，会自动处理这个验证流程，不需要手动编写验证逻辑。

```typescript
app.post(
  "/webhook/event",
  lark.adaptExpress(eventDispatcher, {
    autoChallenge: true,
  })
);
```

### 问题 2: 飞书事件重试导致重复回复

**问题描述**：如果服务器处理事件较慢（比如等待 AI 响应），飞书可能认为推送失败而重试，导致同一条消息被处理多次。

**解决方案**：使用 `Set` 存储已处理的 `message_id`，在处理前进行去重检查。同时设置 5 分钟 TTL 自动清除旧记录，防止内存泄漏。

```typescript
const processedMessages = new Set<string>();
const MESSAGE_EXPIRY_MS = 5 * 60 * 1000;

if (processedMessages.has(messageId)) {
  return; // 跳过已处理消息
}
processedMessages.add(messageId);
setTimeout(() => processedMessages.delete(messageId), MESSAGE_EXPIRY_MS);
```

### 问题 3: 群聊中 @机器人 的消息解析

**问题描述**：在群聊中用户 @机器人 发送消息时，飞书传递的消息文本中会包含类似 `@_user_1` 的占位符，需要清理后才能送入 AI。

**解决方案**：使用正则表达式清理 `@_user_x` 占位符，并处理用户只发了 @ 没有其他内容的边界情况。

```typescript
userText = userText.replace(/@_user_\d+/g, "").trim();
if (!userText) {
  userText = "你好"; // 兜底处理
}
```

### 问题 4: 多 AI 提供商的统一接入

**问题描述**：需求要求支持 Gemini / Claude / GPT 等多种模型，但各家 API 格式不完全一致。

**解决方案**：利用 OpenAI SDK 的 `baseURL` 配置能力。Google Gemini 已原生支持 OpenAI 兼容端点（`/v1beta/openai`），Claude 可通过 OpenRouter 等代理服务使用兼容格式。只需修改环境变量 `AI_BASE_URL` 和 `AI_MODEL` 即可切换，代码零改动。

### 问题 5: npm 安装超时

**问题描述**：开发环境中 `npm install` 首次运行耗时较长，可能因为网络环境导致超时。

**解决方案**：可以配置 npm 镜像源加速，或使用 `--prefer-offline` 优先使用缓存。生产环境中使用 Docker 多阶段构建，依赖安装只在构建阶段执行一次。

---

## License

MIT
