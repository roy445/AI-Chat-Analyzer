import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { analyzeChat } from "./analyzers";
import { ChatParseError, parseChatFile } from "./parsers";

async function fixture(name: string, type: string) {
  const content = await readFile(`test-data/${name}`, "utf8");
  return new File([content], name, { type });
}

describe("platform parser adapters", () => {
  it("normalizes LINE plain text into two participants", async () => {
    const result = await parseChatFile("line", await fixture("line-two-person.txt", "text/plain"));
    expect(result.participants).toHaveLength(2);
    expect(result.messages).toHaveLength(6);
    expect(result.messages[0].sender_name).toBe("小藍");
    expect(result.messages[1].message_type).toBe("text");
  });

  it("reads Meta-style Instagram JSON and media types", async () => {
    const result = await parseChatFile("instagram", await fixture("instagram-two-person.json", "application/json"));
    expect(result.participants.map((person) => person.name)).toEqual(["Mina", "Kai"]);
    expect(result.messages).toHaveLength(3);
    expect(result.messages[2].message_type).toBe("image");
  });

  it("reads Messenger JSON without coupling analysis to its shape", async () => {
    const result = await parseChatFile("messenger", await fixture("messenger-two-person.json", "application/json"));
    expect(result.messages).toHaveLength(3);
    expect(result.messages[2].message_type).toBe("video");
  });

  it("keeps group chats safe for the UI instead of crashing", async () => {
    const result = await parseChatFile("messenger", await fixture("group-chat.json", "application/json"));
    expect(result.participants).toHaveLength(3);
  });

  it("returns a user-facing error for empty files", async () => {
    await expect(parseChatFile("line", await fixture("empty.txt", "text/plain"))).rejects.toMatchObject({ kind: "empty" } satisfies Partial<ChatParseError>);
  });
});

describe("analysis engine", () => {
  it("produces objective metrics and qualified event analysis", async () => {
    const parsed = await parseChatFile("line", await fixture("line-two-person.txt", "text/plain"));
    const me = parsed.participants[0].id;
    const report = analyzeChat(parsed.messages, "line", me);
    expect(report.overview.total).toBe(6);
    expect(report.overview.myMessages + report.overview.theirMessages).toBe(6);
    expect(report.initiative.me + report.initiative.them).toBe(100);
    expect(report.unanswered.note).toContain("無法確認");
    expect(report.quality.note).toContain("推測");
    expect(Array.isArray(report.words)).toBe(true);
  });
});
