import * as lark from "@larksuiteoapi/node-sdk";
import { config } from "./config";

/**
 * 飞书客户端 — 封装飞书 API 调用
 */
export const feishuClient = new lark.Client({
  appId: config.feishu.appId,
  appSecret: config.feishu.appSecret,
  disableTokenCache: false, // 启用 token 缓存，自动管理 tenant_access_token
});

/**
 * 向指定聊天发送文本消息
 * @param chatId 群聊 chat_id
 * @param text 消息文本内容
 */
export async function sendTextMessage(
  chatId: string,
  text: string
): Promise<void> {
  try {
    await feishuClient.im.message.create({
      params: {
        receive_id_type: "chat_id",
      },
      data: {
        receive_id: chatId,
        msg_type: "text",
        content: JSON.stringify({ text }),
      },
    });
    console.log(`[飞书] 消息已发送到群聊 ${chatId}: ${text.slice(0, 80)}...`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[飞书] 发送消息失败: ${errMsg}`);
    throw error;
  }
}

/**
 * 回复指定消息（引用回复）
 * @param messageId 要回复的消息 ID
 * @param text 回复文本内容
 */
export async function replyTextMessage(
  messageId: string,
  text: string
): Promise<void> {
  try {
    await feishuClient.im.message.reply({
      path: {
        message_id: messageId,
      },
      data: {
        msg_type: "text",
        content: JSON.stringify({ text }),
      },
    });
    console.log(`[飞书] 已回复消息 ${messageId}: ${text.slice(0, 80)}...`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[飞书] 回复消息失败: ${errMsg}`);
    throw error;
  }
}
