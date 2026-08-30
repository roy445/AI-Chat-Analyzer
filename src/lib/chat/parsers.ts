import type {
  MessageType,
  NormalizedMessage,
  ParseResult,
  Platform,
} from "./types";

export class ChatParseError extends Error {
  constructor(
    public readonly kind: "empty" | "format" | "participants" | "unsupported",
    message: string,
  ) {
    super(message);
    this.name = "ChatParseError";
  }
  get code() {
    return this.kind === "empty" ? "FILE-005" : this.kind === "format" ? "FILE-004" : this.kind === "participants" ? "FILE-011" : "FILE-002";
  }
}

const DATE_HEADER = /^(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})[.]?(?:\s+[^\d].*)?$/;
const BRACKET_LINE = /^\[?(\d{2,4})[./-](\d{1,2})[./-](\d{1,2})(?:,?\s+|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*(?:-|–)?\s*(.+?)\s*:\s*(.*)$/;
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

function idFor(index: number, timestamp: string, sender: string) {
  return `${index}-${Date.parse(timestamp) || timestamp}-${sender}`;
}

function makeMessage(
  index: number,
  sender: string,
  content: string,
  timestamp: string,
  messageType: MessageType = "text",
  mediaType?: string,
): NormalizedMessage {
  const cleanContent = content.trim();
  return {
    message_id: idFor(index, timestamp, sender),
    sender_id: sender.trim().toLowerCase().replace(/\s+/g, "_") || `sender_${index}`,
    sender_name: sender.trim() || `使用者 ${index + 1}`,
    timestamp,
    content: cleanContent,
    message_type: messageType,
    emoji: cleanContent.match(EMOJI_PATTERN) ?? [],
    media_type: mediaType,
    is_system_message: messageType === "system",
  };
}

function dateFromParts(year: number, month: number, day: number, hour = 12, minute = 0, second = 0) {
  const fullYear = year < 100 ? 2000 + year : year;
  return new Date(fullYear, month - 1, day, hour, minute, second).toISOString();
}

function classifyText(text: string): { type: MessageType; media?: string; content: string } {
  const lower = text.toLowerCase();
  if (/^(image|photo|照片|圖片|已刪除照片|[📷🖼️])/.test(lower)) return { type: "image", media: "image", content: text || "圖片" };
  if (/^(video|影片|視頻|[🎥])/.test(lower)) return { type: "video", media: "video", content: text || "影片" };
  if (/^(audio|voice|語音|語音訊息|[🎤🎙️])/.test(lower)) return { type: "audio", media: "audio", content: text || "語音" };
  if (/^(sticker|貼圖|[🧸])/.test(lower)) return { type: "sticker", media: "sticker", content: text || "貼圖" };
  if (/^(file|檔案|文件)/.test(lower)) return { type: "file", media: "file", content: text || "檔案" };
  return { type: "text", content: text };
}

function participantsFrom(messages: NormalizedMessage[]) {
  const map = new Map<string, { id: string; name: string }>();
  messages.forEach((message) => {
    if (!message.is_system_message && !map.has(message.sender_id)) {
      map.set(message.sender_id, { id: message.sender_id, name: message.sender_name });
    }
  });
  return Array.from(map.values());
}

function normalizeMessages(messages: NormalizedMessage[], platform: Platform, warnings: string[] = []): ParseResult {
  const sorted = messages
    .filter((message) => message.sender_name && message.timestamp && !Number.isNaN(Date.parse(message.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const participants = participantsFrom(sorted);
  if (!sorted.length) throw new ChatParseError("format", "這個檔案目前無法辨識。");
  if (participants.length < 2) throw new ChatParseError("participants", "這看起來不是兩人聊天紀錄，至少需要兩位聊天者。");
  return { platform, messages: sorted, participants, warnings };
}

function parseLine(text: string): ParseResult {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
  const messages: NormalizedMessage[] = [];
  let currentDate = dateFromParts(new Date().getFullYear(), 1, 1);
  let index = 0;
  let pendingSender = "";
  let pendingContent: string[] = [];
  let pendingTime: string | undefined;

  const flush = () => {
    if (!pendingSender || !pendingContent.length) return;
    const raw = pendingContent.join("\n").trim();
    if (raw) {
      const classified = classifyText(raw);
      messages.push(makeMessage(index++, pendingSender, classified.content, pendingTime ?? currentDate, classified.type, classified.media));
    }
    pendingSender = "";
    pendingContent = [];
    pendingTime = undefined;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    const bracket = line.match(BRACKET_LINE);
    if (bracket) {
      flush();
      const year = Number(bracket[1]);
      const time = dateFromParts(Number(year), Number(bracket[2]), Number(bracket[3]), Number(bracket[4]), Number(bracket[5]), Number(bracket[6] ?? 0));
      pendingSender = bracket[7].trim();
      pendingTime = time;
      pendingContent = [bracket[8]];
      continue;
    }
    const date = line.trim().match(DATE_HEADER);
    if (date) {
      flush();
      currentDate = dateFromParts(Number(date[1]), Number(date[2]), Number(date[3]));
      continue;
    }
    // LINE exports generally put the sender on its own line after each date.
    if (!pendingSender && line.trim() && !/^\d{1,2}:\d{2}/.test(line.trim())) {
      pendingSender = line.trim();
      continue;
    }
    if (pendingSender) {
      // A new non-indented line is the next sender in LINE's plain-text format.
      // Content continuation lines are indented in most exports; keep both forms safe.
      if (/^\S[^:]{0,40}$/.test(line) && pendingContent.length) {
        flush();
        pendingSender = line.trim();
      } else {
        pendingContent.push(line.trim());
      }
    }
  }
  flush();
  return normalizeMessages(messages, "line", ["LINE 匯出格式可能因版本不同略有差異，請確認日期與發送者都被辨識。"]);
}

type UnknownRecord = Record<string, unknown>;

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

const MOJIBAKE_MARKERS = /[ÃÂâæçåèéêëïðñòóôõö÷øùúûü]/g;

/** Repairs strings that were decoded as Latin-1 before their UTF-8 bytes were preserved. */
function repairMojibake(value: string) {
  if (!value || !MOJIBAKE_MARKERS.test(value)) return value;
  MOJIBAKE_MARKERS.lastIndex = 0;
  const bytes = Uint8Array.from(Array.from(value).map((character) => character.charCodeAt(0) & 0xff));
  const repaired = new TextDecoder("utf-8").decode(bytes);
  const originalScore = (value.match(MOJIBAKE_MARKERS) ?? []).length;
  MOJIBAKE_MARKERS.lastIndex = 0;
  const repairedScore = (repaired.match(MOJIBAKE_MARKERS) ?? []).length;
  return repairedScore < originalScore ? repaired : value;
}

function decodeChatBytes(bytes: ArrayBuffer) {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacementCount > 0) {
    try {
      const legacy = new TextDecoder("big5").decode(bytes);
      if ((legacy.match(/\uFFFD/g) ?? []).length < replacementCount) return legacy;
    } catch {
      // Big5 is not available in every runtime; UTF-8 remains the safe fallback.
    }
  }
  return utf8;
}

function timestampFrom(value: unknown): string | null {
  if (typeof value === "number") {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function mediaFromRecord(record: UnknownRecord): { type: MessageType; label: string; content: string } {
  const content = stringValue(record.content) || stringValue(record.text);
  const attachments = Array.isArray(record.attachments) ? record.attachments : [];
  const attachment = attachments[0] as UnknownRecord | undefined;
  const mime = stringValue(attachment?.mime_type).toLowerCase();
  const type = stringValue(attachment?.type).toLowerCase();
  if (mime.includes("image") || type.includes("photo") || record.photos) return { type: "image", label: "image", content: content || "圖片" };
  if (mime.includes("video") || type.includes("video") || record.videos) return { type: "video", label: "video", content: content || "影片" };
  if (mime.includes("audio") || type.includes("audio") || record.audio_files) return { type: "audio", label: "audio", content: content || "語音" };
  if (type.includes("sticker") || record.sticker) return { type: "sticker", label: "sticker", content: content || "貼圖" };
  if (attachments.length || record.files) return { type: "file", label: "file", content: content || "檔案" };
  return { type: content ? "text" : "unknown", label: "", content };
}

function walkJson(value: unknown, messages: NormalizedMessage[], index: { current: number }, participants: Map<string, string>) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkJson(item, messages, index, participants));
    return;
  }
  const record = value as UnknownRecord;
  const senderRecord = record.sender as UnknownRecord | undefined;
  const sender = repairMojibake(stringValue(record.sender_name) || stringValue(record.from) || stringValue(record.sender) || stringValue(senderRecord?.name));
  const time = timestampFrom(record.timestamp_ms ?? record.timestamp ?? record.created_at ?? record.date);
  if (sender && time) {
    const media = mediaFromRecord(record);
    const message = makeMessage(index.current++, sender, repairMojibake(media.content), time, media.type, media.label || undefined);
    messages.push(message);
    participants.set(message.sender_id, message.sender_name);
    return;
  }
  Object.values(record).forEach((child) => walkJson(child, messages, index, participants));
}

function parseJson(value: unknown, platform: Platform): ParseResult {
  const messages: NormalizedMessage[] = [];
  const participants = new Map<string, string>();
  walkJson(value, messages, { current: 0 }, participants);
  // Some Meta exports provide participant names at the thread level but no message sender in a few system records.
  const result = normalizeMessages(messages, platform, ["已忽略無法對應到發送者或時間的系統資料。"]);
  return result;
}

function parseHtml(text: string, platform: Platform): ParseResult {
  if (typeof DOMParser === "undefined") throw new ChatParseError("format", "這個檔案目前無法辨識。");
  const doc = new DOMParser().parseFromString(text, "text/html");
  const textContent = doc.body.textContent ?? "";
  return platform === "line" ? parseLine(textContent) : parseLine(textContent);
}

export async function parseChatFile(platform: Platform, file: File): Promise<ParseResult> {
  if (!file || file.size === 0) throw new ChatParseError("empty", "這個檔案是空的，請重新匯出聊天紀錄。");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["txt", "json", "html", "htm"].includes(extension)) {
    throw new ChatParseError("unsupported", "目前支援 .txt、.json 或 .html 聊天檔案。");
  }
  const text = decodeChatBytes(await file.arrayBuffer());
  if (!text.trim()) throw new ChatParseError("empty", "這個檔案沒有可讀取的內容。");
  try {
    if (extension === "json") return parseJson(JSON.parse(text), platform);
    if (extension === "html" || extension === "htm") return parseHtml(text, platform);
    if (platform === "line") return parseLine(text);
    try {
      return parseJson(JSON.parse(text), platform);
    } catch {
      return parseLine(text);
    }
  } catch (error) {
    if (error instanceof ChatParseError) throw error;
    throw new ChatParseError("format", "這個檔案目前無法辨識，請確認已下載完整的聊天資料。");
  }
}

export const platformLabels: Record<Platform, string> = {
  line: "LINE",
  instagram: "Instagram",
  messenger: "Messenger",
};
