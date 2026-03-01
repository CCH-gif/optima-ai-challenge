import dotenv from "dotenv";
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  // 飞书应用配置
  feishu: {
    appId: requireEnv("FEISHU_APP_ID"),
    appSecret: requireEnv("FEISHU_APP_SECRET"),
    encryptKey: process.env.FEISHU_ENCRYPT_KEY || "",
    verificationToken: process.env.FEISHU_VERIFICATION_TOKEN || "",
  },

  // AI 模型配置
  ai: {
    baseUrl: process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: requireEnv("AI_API_KEY"),
    model: process.env.AI_MODEL || "gemini-2.5-flash",
    systemPrompt:
      process.env.AI_SYSTEM_PROMPT ||
      "你是一个友好的 AI 助手，部署在飞书群聊中。请用简洁的中文回复用户问题。",
  },

  // 服务器配置
  port: parseInt(process.env.PORT || "3000", 10),
} as const;
