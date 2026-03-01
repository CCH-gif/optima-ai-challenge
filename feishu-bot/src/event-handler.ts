import * as lark from "@larksuiteoapi/node-sdk";
import { config } from "./config";
import { feishuClient, replyTextMessage } from "./feishu-client";
import { generateReply, clearMemory } from "./ai-service";

/**
 * 飞书事件处理器
 *
 * 处理流程:
 *  1. 接收飞书事件订阅的 HTTP 回调
 *  2. 验证事件并解析消息内容
 *  3. 过滤非文本消息和机器人自身消息
 *  4. 调用 AI 生成回复
 *  5. 通过飞书 API 发送回复
 */

// 消息去重：记录已处理的 message_id，防止飞书重试导致重复回复
const processedMessages = new Set<string>();
const MESSAGE_EXPIRY_MS = 5 * 60 * 1000; // 5 分钟后清除去重记录

/**
 * 创建飞书事件分发器
 */
export function createEventDispatcher() {
  const dispatcher = new lark.EventDispatcher({
    encryptKey: config.feishu.encryptKey,
    verificationToken: config.feishu.verificationToken,
  });

  // 注册 im.message.receive_v1 事件 — 接收群聊/私聊消息
  dispatcher.register({
    "im.message.receive_v1": async (data: any) => {
      try {
        await handleMessageEvent(data);
      } catch (error) {
        console.error("[事件处理] 处理消息时出错:", error);
      }
    },
  });

  return dispatcher;
}

/**
 * 处理收到的消息事件
 */
async function handleMessageEvent(data: any): Promise<void> {
  const message = data.message;
  if (!message) {
    console.warn("[事件处理] 收到无消息体的事件");
    return;
  }

  const messageId = message.message_id;
  const chatId = message.chat_id;
  const chatType = message.chat_type; // "p2p" | "group"
  const msgType = message.message_type;
  const senderId = data.sender?.sender_id?.open_id;

  console.log(
    `[事件处理] 收到消息 | chat_type=${chatType} chat_id=${chatId} msg_type=${msgType} message_id=${messageId}`
  );

  // === 去重检查 ===
  if (processedMessages.has(messageId)) {
    console.log(`[事件处理] 跳过已处理的消息: ${messageId}`);
    return;
  }
  processedMessages.add(messageId);
  // 5 分钟后清除去重记录，防止内存泄漏
  setTimeout(() => processedMessages.delete(messageId), MESSAGE_EXPIRY_MS);

  // === 过滤非文本消息 ===
  if (msgType !== "text") {
    console.log(`[事件处理] 跳过非文本消息: ${msgType}`);
    return;
  }

  // === 解析消息内容 ===
  let userText: string;
  try {
    const content = JSON.parse(message.content);
    userText = content.text || "";
  } catch {
    console.warn("[事件处理] 解析消息内容失败");
    return;
  }

  if (!userText.trim()) {
    return;
  }

  // === 群聊场景：只回复 @机器人 的消息 ===
  // 在群聊中，用户需要 @机器人 才会触发回复
  // 飞书会在 mentions 中提供 @信息，同时 text 中会包含 @_user_x 格式的占位符
  if (chatType === "group") {
    const mentions: any[] = message.mentions || [];
    const botMentioned = mentions.some((m: any) => m.id?.open_id === undefined);
    // 当消息包含 @ 时，清理掉 @_user_x 占位符
    userText = userText.replace(/@_user_\d+/g, "").trim();

    if (!userText) {
      // 只有 @ 没有实际内容
      userText = "你好";
    }
  }

  console.log(`[事件处理] 用户消息: "${userText.slice(0, 100)}"`);

  // === 特殊指令处理 ===
  if (userText === "/clear" || userText === "清除记忆") {
    clearMemory(chatId);
    await replyTextMessage(messageId, "已清除对话记忆，让我们重新开始吧！");
    return;
  }

  if (userText === "/help" || userText === "帮助") {
    const helpText = [
      "我是 AI 助手，你可以直接问我问题。",
      "",
      "可用指令：",
      "  /clear 或 清除记忆 — 清除对话上下文",
      "  /help 或 帮助 — 显示此帮助信息",
      "",
      `当前 AI 模型: ${config.ai.model}`,
    ].join("\n");
    await replyTextMessage(messageId, helpText);
    return;
  }

  // === 调用 AI 生成回复 ===
  const reply = await generateReply(chatId, userText);

  // === 发送回复 ===
  await replyTextMessage(messageId, reply);
}
