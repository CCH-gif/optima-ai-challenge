import * as lark from "@larksuiteoapi/node-sdk";
import { sendTextMessage, replyTextMessage, feishuClient } from "../src/feishu-client";

jest.mock("@larksuiteoapi/node-sdk", () => ({
  Client: jest.fn().mockImplementation(() => ({
    im: {
      message: {
        create: jest.fn(),
        reply: jest.fn(),
      },
    },
  })),
}));

jest.mock("../src/config", () => ({
  config: {
    feishu: {
      appId: "test-app-id",
      appSecret: "test-app-secret",
    },
  },
}));

describe("feishu-client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendTextMessage", () => {
    it("should call im.message.create with correct params", async () => {
      const chatId = "test-chat-id";
      const text = "Hello, World!";

      await sendTextMessage(chatId, text);

      expect(feishuClient.im.message.create).toHaveBeenCalledWith({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          msg_type: "text",
          content: JSON.stringify({ text }),
        },
      });
    });

    it("should log success message", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      await sendTextMessage("chat-id", "test");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should throw error when API fails", async () => {
      (feishuClient.im.message.create as jest.Mock).mockRejectedValueOnce(
        new Error("API Error")
      );

      await expect(sendTextMessage("chat-id", "test")).rejects.toThrow("API Error");
    });
  });

  describe("replyTextMessage", () => {
    it("should call im.message.reply with correct params", async () => {
      const messageId = "test-message-id";
      const text = "Reply message";

      await replyTextMessage(messageId, text);

      expect(feishuClient.im.message.reply).toHaveBeenCalledWith({
        path: { message_id: messageId },
        data: {
          msg_type: "text",
          content: JSON.stringify({ text }),
        },
      });
    });

    it("should throw error when API fails", async () => {
      (feishuClient.im.message.reply as jest.Mock).mockRejectedValueOnce(
        new Error("Reply Error")
      );

      await expect(replyTextMessage("msg-id", "test")).rejects.toThrow("Reply Error");
    });
  });
});
