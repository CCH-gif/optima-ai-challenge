# Task 2: 找 Bug 与修复方案

## 发现的 Bug

### Bug 1: 基于文本内容去重（不可靠）

**位置**: `buggy_bot.js:76-77`

```javascript
if (processedMessages.includes(text)) continue;
processedMessages.push(text);
```

**问题**:
- 使用文本内容去重，如果两个不同用户发送相同内容，只有第一个用户能收到回复
- 服务重启后 `processedMessages` 数组被重置，之前处理过的消息会再次被处理

---

### Bug 2: 缺少基于消息 ID 的去重机制

**位置**: `buggy_bot.js:70-80`

```javascript
for (const msg of messages) {
    if (msg.type !== "text") continue;
    
    const text = (msg.data?.message || "").trim();
    // ...
}
```

**问题**:
- 代码完全没有使用消息的唯一标识符（如 `msg.id`）进行去重
- 正确的做法应该是基于 `msg.id` 去重，而不是文本内容

---

### Bug 3: 定时器未清理 + 异步竞态风险

**位置**: `buggy_bot.js:93-116`

```javascript
pendingBatches[friendName].timer = setTimeout(async () => {
    const batch = pendingBatches[friendName];
    delete pendingBatches[friendName];  // 问题1：立即删除状态
    
    const combined = batch.texts.join("\n");
    // ...
    const reply = await callAI(aiMessages);  // 问题2：AI请求可能耗时 5-10 秒
    // ...
}, DEBOUNCE_MS);
```

**问题 1 - 定时器未清理**:
- 当同一用户的第二条消息在 3 秒内到达时，新的 `setTimeout` 被创建，但**旧的定时器没有被清除**
- 这会导致两个定时器都会执行，造成消息被重复处理

**问题 2 - 异步竞态风险**:
- `delete pendingBatches[friendName]` 在回调开头就执行了
- 但 `callAI()` 可能耗时 5-10 秒，在此期间用户又发来新消息
- 由于状态已被删除，系统会重新创建全新的 Batch
- 结果：前一个请求还没结束，后一个请求又开始了，导致同一段上下文产生两次回复

---

### Bug 4: 内存泄漏风险

**位置**: `buggy_bot.js:26`

```javascript
const processedMessages = [];  // 不断增长，没有清理机制
```

**问题**:
- 已处理的消息 ID/文本会无限累积在数组中
- 长时间运行后会导致内存泄漏

---

## 修复方案

### 修复 Bug 1 & 2: 使用消息 ID 进行去重

```javascript
// 状态
const processedMessages = new Set();  // 使用 Set 替代数组，提高查询效率

// 处理回调
async function handleCallback(body) {
    const { searchText: friendName, data: messages, mode } = body;

    if (mode === "online" || mode === "offline") return;
    if (mode !== "logs") return;

    const newTexts = [];
    for (const msg of messages) {
        if (msg.type !== "text") continue;
        
        const messageId = msg.id;  // 使用消息 ID
        if (!messageId) continue;
        
        // 基于消息 ID 去重
        if (processedMessages.has(messageId)) continue;
        processedMessages.add(messageId);
        
        const text = (msg.data?.message || "").trim();
        if (!text) continue;

        newTexts.push(text);
    }

    if (newTexts.length === 0) return;
    // ...
}

// 定期清理已处理消息，防止内存泄漏
setInterval(() => {
    // 保留最近 1000 条记录
    if (processedMessages.size > 1000) {
        const arr = Array.from(processedMessages);
        processedMessages.clear();
        arr.slice(-1000).forEach(id => processedMessages.add(id));
    }
}, 60000);
```

### 修复 Bug 3 & 4: 清除旧定时器 + 引入 processing 标记位

```javascript
const pendingBatches = {};

if (pendingBatches[friendName]) {
    // 清除旧的定时器
    clearTimeout(pendingBatches[friendName].timer);
    // 如果正在处理中，等当前处理完再合并
    if (!pendingBatches[friendName].processing) {
        pendingBatches[friendName].texts.push(...newTexts);
    }
} else {
    pendingBatches[friendName] = { texts: [...newTexts], timer: null, processing: false };
}

pendingBatches[friendName].timer = setTimeout(async () => {
    const batch = pendingBatches[friendName];
    
    // 标记正在处理，防止新消息打断
    batch.processing = true;
    
    const combined = batch.texts.join("\n");
    delete pendingBatches[friendName];
    
    // ... AI 调用逻辑 ...
    
    // 处理完成后清理
    batch.processing = false;
}, DEBOUNCE_MS);
```

**更好的方案**：使用锁机制，确保 AI 回复彻底完成后再接收新消息：

```javascript
const processingLock = new Set();

if (processingLock.has(friendName)) {
    // 正在处理中，将消息加入队列等待下一次处理
    if (pendingBatches[friendName]) {
        pendingBatches[friendName].texts.push(...newTexts);
    }
    return;
}

processingLock.add(friendName);
// ... 处理逻辑 ...
processingLock.delete(friendName);
```

---

## 排查过程

1. **代码审查**: 阅读 `buggy_bot.js` 源代码，分析消息处理流程
2. **对比参考实现**: 将上下文给到多个AI（gemini,opencode,chatgpt,cloude），询问不同模块的逻辑，进行对比。
3. **识别问题模式**:
   - 第 76 行使用 `includes(text)` 进行文本去重 → 不可靠
   - 第 93 行创建定时器但未清除旧定时器 → 会重复执行
   - 第 95 行在 AI 请求前就删除状态 → 异步竞态
   - processedMessages 数组无清理机制 → 内存泄漏
4. **验证**: 确认上述问题会导致"重复回复同一条消息"的用户反馈
