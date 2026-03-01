import OpenAI from "openai";
import { config } from "./config";

/**
 * AI 服务 — 使用 OpenAI 兼容接口，支持多种 AI 提供商
 *
 * 支持的提供商（通过配置 AI_BASE_URL 切换）：
 *  - OpenAI (GPT-4o, GPT-4, GPT-3.5-turbo)
 *  - Google Gemini (gemini-2.5-flash, gemini-2.5-pro)
 *  - Anthropic Claude (通过 OpenAI 兼容代理)
 *  - 本地模型 (Ollama, LM Studio 等)
 */

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// 每个聊天会话的上下文记忆（chat_id -> messages[]）
const chatMemory = new Map<string, ChatMessage[]>();
const MAX_HISTORY = 20; // 保留最近 20 条对话

const client = new OpenAI({
  apiKey: config.ai.apiKey,
  baseURL: config.ai.baseUrl,
});

/**
 * 调用 AI 模型生成回复
 * @param chatId 聊天会话 ID（用于维护上下文）
 * @param userMessage 用户消息内容
 * @returns AI 生成的回复文本
 */
export async function generateReply(
  chatId: string,
  userMessage: string
): Promise<string> {
  // 获取或初始化会话历史
  if (!chatMemory.has(chatId)) {
    chatMemory.set(chatId, []);
  }
  const history = chatMemory.get(chatId)!;

  // 添加用户消息到历史
  history.push({ role: "user", content: userMessage });

  // 构建发送给 AI 的消息列表
  const messages: ChatMessage[] = [
    { role: "system", content: config.ai.systemPrompt },
    ...history.slice(-MAX_HISTORY), // 只取最近的历史记录
  ];

  try {
    const response = await client.chat.completions.create({
      model: config.ai.model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    });

    const reply = response.choices[0]?.message?.content || "抱歉，我暂时无法回复。";

    // 将 AI 回复添加到历史
    history.push({ role: "assistant", content: reply });

    // 裁剪历史记录防止内存增长
    if (history.length > MAX_HISTORY * 2) {
      const trimmed = history.slice(-MAX_HISTORY);
      chatMemory.set(chatId, trimmed);
    }

    return reply;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[AI] 调用失败: ${errMsg}`);
    return `AI 服务暂时不可用，请稍后再试。(错误: ${errMsg})`;
  }
}

/**
 * 清除指定聊天的上下文记忆
 */
export function clearMemory(chatId: string): void {
  chatMemory.delete(chatId);
}
