import * as lark from "@larksuiteoapi/node-sdk";
import { createEventDispatcher } from "../src/event-handler";

jest.mock("@larksuiteoapi/node-sdk", () => ({
  Client: jest.fn(),
  EventDispatcher: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
  })),
}));

jest.mock("../src/config", () => ({
  config: {
    feishu: {
      appId: "test-app-id",
      appSecret: "test-app-secret",
      encryptKey: "test-encrypt-key",
      verificationToken: "test-verification-token",
    },
    ai: {
      model: "test-model",
      baseUrl: "https://test.com",
    },
  },
}));

jest.mock("../src/feishu-client", () => ({
  feishuClient: {
    im: {
      message: {
        create: jest.fn(),
        reply: jest.fn(),
      },
    },
  },
  replyTextMessage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/ai-service", () => ({
  generateReply: jest.fn().mockResolvedValue("AI 回复"),
  clearMemory: jest.fn(),
}));

describe("event-handler", () => {
  describe("createEventDispatcher", () => {
    it("should create event dispatcher", () => {
      const dispatcher = createEventDispatcher();
      expect(dispatcher).toBeDefined();
    });

    it("should register event handler", () => {
      const dispatcher = createEventDispatcher() as any;
      expect(dispatcher.register).toHaveBeenCalled();
    });
  });
});
