import express from "express";
import * as lark from "@larksuiteoapi/node-sdk";
import { config } from "./config";
import { createEventDispatcher } from "./event-handler";

/**
 * 飞书 AI 群聊机器人 — 入口文件
 *
 * 启动一个 Express HTTP 服务器，接收飞书事件订阅的回调请求，
 * 并使用 AI 模型自动生成回复。
 */

const app = express();

// ─── 健康检查端点 ────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    status: "running",
    bot: "feishu-ai-bot",
    model: config.ai.model,
    timestamp: new Date().toISOString(),
  });
});

// ─── 飞书事件订阅端点 ────────────────────────────────
const eventDispatcher = createEventDispatcher();

// 使用飞书 SDK 提供的 Express 适配器处理事件
app.post(
  "/webhook/event",
  lark.adaptExpress(eventDispatcher, {
    autoChallenge: true, // 自动处理飞书 URL 验证的 challenge 请求
  })
);

// ─── 启动服务器 ──────────────────────────────────────
app.listen(config.port, () => {
  console.log("=".repeat(50));
  console.log("  飞书 AI 群聊机器人已启动");
  console.log("=".repeat(50));
  console.log(`  监听端口:    ${config.port}`);
  console.log(`  事件端点:    http://localhost:${config.port}/webhook/event`);
  console.log(`  健康检查:    http://localhost:${config.port}/`);
  console.log(`  AI 模型:     ${config.ai.model}`);
  console.log(`  AI Base URL: ${config.ai.baseUrl}`);
  console.log("=".repeat(50));
});
