import type {
  AnalysisReport,
  BehaviorProfile,
  InsightEvent,
  NormalizedMessage,
  Platform,
  ResponseStats,
  WordStat,
} from "./types";
import { platformLabels } from "./parsers";
import { analyzeV2 } from "./v2";

const WEEKDAYS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const PERIODS = ["早上", "下午", "晚上", "深夜"];
const STOP_WORDS = new Set([
  "的", "了", "是", "我", "你", "他", "她", "有", "在", "也", "就", "都", "不", "很", "嗎", "啊", "喔", "哦", "嗯", "好", "和", "與", "這", "那", "還", "會", "可以", "一個", "我們", "你們", "真的", "然後", "因為", "所以", "就是", "沒有", "什麼", "怎麼", "知道", "不是", "自己", "一下", "現在", "如果", "但是", "而且", "哈哈",
]);
const TOPIC_DICTIONARY: Record<string, string[]> = {
  學校: ["學校", "上課", "老師", "作業", "考試", "報告", "課堂"],
  工作: ["工作", "上班", "主管", "同事", "加班", "公司", "面試"],
  遊戲: ["遊戲", "排位", "打團", "隊友", "電玩", "switch", "steam"],
  音樂: ["音樂", "歌曲", "歌", "演唱會", "樂團", "專輯"],
  出遊: ["旅行", "出遊", "景點", "車票", "飯店", "旅行", "日本", "台北"],
  食物: ["吃飯", "好吃", "餐廳", "咖啡", "火鍋", "晚餐", "午餐"],
  日常: ["今天", "明天", "昨天", "回家", "睡覺", "起床", "天氣"],
  朋友: ["朋友", "同學", "聚會", "生日", "大家"],
};
const NEGATIVE_WORDS = ["生氣", "難過", "失望", "抱歉", "對不起", "煩", "討厭", "不爽", "算了", "隨便", "無言", "吵架", "不要理", "受不了", "誤會", "不懂你"];
const SOFT_WORDS = new Set(["嗯", "喔", "哦", "好", "哈哈", "哈", "蛤", "恩", "lol"]);
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

type Counts = Record<string, number>;

function dateOf(message: NormalizedMessage) {
  return new Date(message.timestamp);
}

function formatDate(date: Date) {
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatMinutes(value: number) {
  if (!value || !Number.isFinite(value)) return "—";
  const minutes = Math.round(value);
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} 小時 ${remaining} 分` : `${hours} 小時`;
}

function periodFor(hour: number) {
  if (hour < 12) return 0;
  if (hour < 18) return 1;
  if (hour < 23) return 2;
  return 3;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function robustValues(values: number[]) {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.1);
  return sorted.slice(trim, Math.max(trim + 1, sorted.length - trim));
}

function countsToSorted(counts: Counts) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function tokenize(text: string) {
  const tokens: string[] = [];
  for (const match of text.toLowerCase().matchAll(/[a-z\d][a-z\d'-]{1,}/gi)) tokens.push(match[0]);
  for (const run of text.match(/[\u4e00-\u9fff]+/g) ?? []) {
    if (run.length <= 5 && !STOP_WORDS.has(run)) tokens.push(run);
    // Bigram/trigram tokenization keeps Chinese usable without an English tokenizer.
    for (let size = 2; size <= 3; size += 1) {
      for (let index = 0; index <= run.length - size; index += 1) {
        const token = run.slice(index, index + size);
        if (!STOP_WORDS.has(token)) tokens.push(token);
      }
    }
  }
  return tokens.filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function profileFor(
  name: string,
  mine: NormalizedMessage[],
  all: NormalizedMessage[],
  responseMinutes: number[],
): BehaviorProfile {
  const total = Math.max(1, mine.length);
  const text = mine.filter((message) => message.message_type === "text");
  const questions = text.filter((message) => /[?？]/.test(message.content)).length;
  const shares = text.filter((message) => message.content.length >= 24).length;
  const night = mine.filter((message) => dateOf(message).getHours() >= 22 || dateOf(message).getHours() < 5).length;
  const emojis = mine.reduce((sum, message) => sum + message.emoji.length, 0);
  const averageLength = text.length ? text.reduce((sum, message) => sum + message.content.length, 0) / text.length : 0;
  const starts = all.filter((message, index) => message.sender_id === mine[0]?.sender_id && (index === 0 || dateOf(message).getTime() - dateOf(all[index - 1]).getTime() > 8 * 60 * 60 * 1000)).length;
  const candidates = [
    { tag: "話題發起型", score: starts / Math.max(1, all.length / 2), trait: "常在長時間間隔後重新開啟對話" },
    { tag: "提問型", score: questions / total * 2.2, trait: "會用問題把對話往前推進" },
    { tag: "分享型", score: shares / total * 2.4, trait: "較常傳送有內容的分享" },
    { tag: "夜貓型", score: night / total * 2.2, trait: "晚上十點後仍維持較多互動" },
    { tag: "長文型", score: averageLength / 42, trait: "文字訊息平均較完整" },
    { tag: "快速回應型", score: responseMinutes.length ? Math.max(0, 1 - median(responseMinutes) / 180) : 0, trait: "在有回覆的片段中等待時間較短" },
    { tag: "Emoji 派", score: emojis / total * 1.5, trait: "常用 Emoji 補充語氣" },
    { tag: "簡短回應型", score: averageLength ? Math.max(0, 1 - averageLength / 24) : 0, trait: "習慣用精簡訊息交流" },
  ];
  const selected = candidates.sort((a, b) => b.score - a.score).slice(0, 3);
  return {
    name,
    score: Math.min(99, Math.round(54 + selected[0]?.score * 20)),
    tags: selected.map((item) => item.tag),
    traits: selected.map((item) => item.trait),
  };
}

function responseStats(messages: NormalizedMessage[], meId: string): ResponseStats {
  const values: Record<string, number[]> = { me: [], them: [] };
  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    if (!previous || previous.sender_id === message.sender_id || previous.is_system_message || message.is_system_message) return;
    const gap = (dateOf(message).getTime() - dateOf(previous).getTime()) / 60000;
    if (gap >= 0 && gap <= 48 * 60) values[message.sender_id === meId ? "me" : "them"].push(gap);
  });
  const summary = (input: number[]) => {
    const clean = robustValues(input);
    return { average: clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0, median: median(input), fastest: input.length ? Math.min(...input) : 0, slowest: input.length ? Math.max(...input) : 0, count: input.length };
  };
  const periods = PERIODS.map((label, index) => {
    const grouped: Record<"me" | "them", number[]> = { me: [], them: [] };
    messages.forEach((message, position) => {
      const previous = messages[position - 1];
      if (!previous || previous.sender_id === message.sender_id) return;
      if (periodFor(dateOf(message).getHours()) !== index) return;
      const gap = (dateOf(message).getTime() - dateOf(previous).getTime()) / 60000;
      if (gap >= 0 && gap <= 48 * 60) grouped[message.sender_id === meId ? "me" : "them"].push(gap);
    });
    return { label, me: Math.round(summary(grouped.me).median), them: Math.round(summary(grouped.them).median) };
  });
  return { me: summary(values.me), them: summary(values.them), byPeriod: periods };
}

function engagementFor(messages: NormalizedMessage[], senderId: string) {
  const replies = messages.filter((message, index) => {
    const previous = messages[index - 1];
    return message.sender_id === senderId && previous && previous.sender_id !== senderId && previous.message_type === "text";
  });
  if (!replies.length) return { level: "中" as const, score: 50, confidence: 28 };
  const low = replies.filter((message, index) => {
    const previous = messages[messages.indexOf(message) - 1];
    const emotionallyLoaded = previous && (/\?|？/.test(previous.content) || previous.content.length > 12 || NEGATIVE_WORDS.some((word) => previous.content.includes(word)));
    return emotionallyLoaded && message.content.trim().length <= 4 && SOFT_WORDS.has(message.content.trim().toLowerCase());
  }).length;
  const followUps = messages.filter((message, index) => message.sender_id === senderId && /[?？]/.test(message.content) && messages[index + 1]?.sender_id !== senderId).length;
  const score = Math.round(Math.max(15, Math.min(92, 78 - (low / replies.length) * 48 + (followUps / Math.max(1, replies.length)) * 12)));
  return { level: score >= 70 ? "高" as const : score >= 45 ? "中" as const : "低" as const, score, confidence: Math.min(88, 46 + replies.length * 2) };
}

function getWords(messages: NormalizedMessage[], meId: string): WordStat[] {
  const map = new Map<string, WordStat>();
  messages.filter((message) => message.message_type === "text").forEach((message) => {
    tokenize(message.content).forEach((word) => {
      const current = map.get(word) ?? { word, total: 0, me: 0, them: 0 };
      current.total += 1;
      current[message.sender_id === meId ? "me" : "them"] += 1;
      map.set(word, current);
    });
  });
  return Array.from(map.values()).filter((item) => item.total >= 2).sort((a, b) => b.total - a.total).slice(0, 60);
}

function makeMedia(messages: NormalizedMessage[], meId: string) {
  const empty = () => ({ image: 0, video: 0, audio: 0, sticker: 0, file: 0 });
  const result = { me: empty(), them: empty() };
  messages.forEach((message) => {
    if (message.message_type in result.me) result[message.sender_id === meId ? "me" : "them"][message.message_type as keyof typeof result.me] += 1;
  });
  return result;
}

function makeEvents(messages: NormalizedMessage[], meId: string, months: { label: string; value: number }[], response: ResponseStats): InsightEvent[] {
  const events: InsightEvent[] = [];
  if (messages.length) {
    const first = dateOf(messages[0]);
    events.push({ id: "start", date: formatDate(first), type: "positive", title: "故事從這裡開始", description: `在 ${formatDate(first)} 找到第一則可辨識的訊息。` });
  }
  const negativeSignals = messages.map((message) => NEGATIVE_WORDS.filter((word) => message.content.includes(word)).length + (/[!?！？]{2,}/.test(message.content) ? 1 : 0));
  for (let i = 0; i < messages.length; i += 1) {
    const start = dateOf(messages[i]).getTime();
    const window = messages.slice(i, i + 10).filter((message) => dateOf(message).getTime() - start <= 6 * 60 * 60 * 1000);
    const signals = window.reduce((sum, message) => sum + NEGATIVE_WORDS.filter((word) => message.content.includes(word)).length + (/[!?！？]{2,}/.test(message.content) ? 1 : 0), 0);
    const speakers = new Set(window.map((message) => message.sender_id)).size;
    const hasShift = window.length >= 3 && window.some((message) => message.content.length <= 3) && speakers === 2;
    if (signals >= 2 && hasShift) {
      const date = formatDate(dateOf(messages[i]));
      if (!events.some((event) => event.type === "conflict" && event.date === date)) {
        events.push({ id: `conflict-${i}`, date, type: "conflict", title: "疑似互動摩擦", description: "從語氣強度、連續訊息與話題變化來看，這段互動可能出現明顯分歧。", confidence: Math.min(91, 54 + signals * 9), reasons: ["同一段對話出現多個情緒強度訊號", "雙方回覆節奏或長度出現變化", "僅根據可觀察訊息推測，無法確認真實情緒"] });
      }
    }
  }
  for (const conflict of events.filter((event) => event.type === "conflict")) {
    const at = messages.findIndex((message) => formatDate(dateOf(message)) === conflict.date);
    const later = at >= 0 ? messages.slice(at + 1, at + 45) : [];
    const calm = later.filter((message) => !NEGATIVE_WORDS.some((word) => message.content.includes(word)) && message.message_type === "text").length;
    if (later.length >= 8 && calm >= 5) {
      const recovery = later.find((message) => message.sender_id === meId) ?? later[0];
      events.push({ id: `recovery-${conflict.id}`, date: formatDate(dateOf(recovery)), type: "recovery", title: "疑似互動恢復", description: "衝突訊號後，雙方重新出現較穩定的文字往來；這是互動變化，不代表關係已被判定。", confidence: Math.min(86, 58 + Math.round(calm / 3)), reasons: ["後續仍有雙方訊息", "負面訊號比例下降", "訊息節奏逐步回到一般區間"] });
    }
  }
  const highest = [...months].sort((a, b) => b.value - a.value)[0];
  if (highest && highest.value > 0) events.push({ id: "peak", date: highest.label, type: "peak", title: "聊天量高峰", description: `${highest.label} 共記錄 ${highest.value.toLocaleString()} 則訊息，是這段期間最活躍的月份。` });
  if (response.me.count + response.them.count > 0) events.push({ id: "rhythm", date: formatDate(dateOf(messages[Math.floor(messages.length / 2)])), type: "neutral", title: "互動節奏形成", description: "這段紀錄中可以觀察到雙方輪流回應的對話片段。" });
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function analyzeChat(messages: NormalizedMessage[], platform: Platform, meId: string, warnings: string[] = []): AnalysisReport {
  const sorted = [...messages].filter((message) => !message.is_system_message).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const me = sorted.find((message) => message.sender_id === meId)?.sender_id ?? meId;
  const themMessage = sorted.find((message) => message.sender_id !== me);
  const them = themMessage?.sender_id ?? sorted.find((message) => message.sender_id !== meId)?.sender_id ?? "them";
  const names = new Map(sorted.map((message) => [message.sender_id, message.sender_name]));
  const start = dateOf(sorted[0]);
  const end = dateOf(sorted[sorted.length - 1]);
  const daySpan = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  const dayCounts: Counts = {};
  const hourCounts = Array.from({ length: 24 }, () => 0);
  const weekdayCounts = Array.from({ length: 7 }, () => 0);
  const monthCounts: Counts = {};
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  sorted.forEach((message) => {
    const date = dateOf(message);
    const dateKey = formatDate(date);
    const monthKey = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
    dayCounts[dateKey] = (dayCounts[dateKey] ?? 0) + 1;
    hourCounts[date.getHours()] += 1;
    weekdayCounts[date.getDay()] += 1;
    monthCounts[monthKey] = (monthCounts[monthKey] ?? 0) + 1;
    heatmap[date.getDay()][date.getHours()] += 1;
  });
  const sessions: NormalizedMessage[][] = [];
  sorted.forEach((message) => {
    const current = sessions[sessions.length - 1];
    if (!current || dateOf(message).getTime() - dateOf(current[current.length - 1]).getTime() > 8 * 3600000) sessions.push([message]);
    else current.push(message);
  });
  const initiativeScores = { me: 0, them: 0 };
  sessions.forEach((session) => {
    const first = session[0];
    const bucket = first.sender_id === me ? "me" : "them";
    initiativeScores[bucket] += 3;
    session.forEach((message) => {
      if (message.sender_id !== first.sender_id && message.sender_id === first.sender_id) initiativeScores[bucket] += 1;
      if (message.sender_id === first.sender_id && /[?？]/.test(message.content)) initiativeScores[bucket] += 1;
      if (message.sender_id === first.sender_id && message.content.length >= 20) initiativeScores[bucket] += 1;
    });
  });
  const initiativeTotal = Math.max(1, initiativeScores.me + initiativeScores.them);
  const response = responseStats(sorted, me);
  const unanswered = { me: 0, them: 0 };
  sorted.forEach((message, index) => {
    if (message.message_type !== "text" || !/[?？]/.test(message.content)) return;
    const next = sorted[index + 1];
    const afterNext = sorted[index + 2];
    if (next && next.sender_id === message.sender_id && dateOf(next).getTime() - dateOf(message).getTime() > 6 * 3600000 && (!afterNext || afterNext.sender_id === message.sender_id)) {
      unanswered[message.sender_id === me ? "me" : "them"] += 1;
    }
  });
  const emojiMap = new Map<string, { emoji: string; me: number; them: number; total: number }>();
  const emojiMonths: Counts = {};
  sorted.forEach((message) => {
    message.emoji.forEach((emoji) => {
      const item = emojiMap.get(emoji) ?? { emoji, me: 0, them: 0, total: 0 };
      item.total += 1;
      item[message.sender_id === me ? "me" : "them"] += 1;
      emojiMap.set(emoji, item);
      const monthKey = `${dateOf(message).getFullYear()}/${String(dateOf(message).getMonth() + 1).padStart(2, "0")}`;
      emojiMonths[monthKey] = (emojiMonths[monthKey] ?? 0) + 1;
    });
  });
  const emojis = Array.from(emojiMap.values()).sort((a, b) => b.total - a.total);
  const monthly = Object.entries(monthCounts).map(([label, value]) => ({ label, value }));
  const wordStats = getWords(sorted, me);
  const topics = Object.entries(TOPIC_DICTIONARY).map(([name, dictionary]) => ({ name, count: sorted.reduce((sum, message) => sum + dictionary.reduce((inner, word) => inner + (message.content.toLowerCase().split(word.toLowerCase()).length - 1), 0), 0) })).filter((topic) => topic.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
  const fallbackTopics = wordStats.filter((word) => word.word.length >= 2).slice(0, 5).map((word) => ({ name: word.word, count: word.total }));
  const engagementMe = engagementFor(sorted, me);
  const engagementThem = engagementFor(sorted, them);
  const meResponses = sorted.filter((message, index) => message.sender_id === me && sorted[index - 1]?.sender_id === them).map((message, index) => (Date.parse(message.timestamp) - Date.parse(sorted[sorted.indexOf(message) - 1].timestamp)) / 60000).filter((value) => value >= 0);
  const themResponses = sorted.filter((message, index) => message.sender_id === them && sorted[index - 1]?.sender_id === me).map((message) => (Date.parse(message.timestamp) - Date.parse(sorted[sorted.indexOf(message) - 1].timestamp)) / 60000).filter((value) => value >= 0);
  const profiles = { me: profileFor(names.get(me) ?? "我", sorted.filter((message) => message.sender_id === me), sorted, meResponses), them: profileFor(names.get(them) ?? "對方", sorted.filter((message) => message.sender_id === them), sorted, themResponses) };
  const monthRows = Object.entries(monthCounts).map(([label, value]) => ({ label, value }));
  const events = makeEvents(sorted, me, monthRows, response);
  const textCount = sorted.filter((message) => message.message_type === "text" && message.content).length;
  const v2 = analyzeV2(sorted, me, { words: wordStats, emoji: { total: emojis.reduce((sum, item) => sum + item.total, 0), meTop: emojis.sort((a, b) => b.me - a.me)[0]?.emoji ?? "—", themTop: emojis.sort((a, b) => b.them - a.them)[0]?.emoji ?? "—", byEmoji: emojis.slice(0, 12), monthly: Object.entries(emojiMonths).map(([label, total]) => ({ label, total })) }, response, topics: topics.length ? topics : fallbackTopics, activeHour: `${String(hourCounts.indexOf(Math.max(...hourCounts))).padStart(2, "0")}:00–${String((hourCounts.indexOf(Math.max(...hourCounts)) + 2) % 24).padStart(2, "0")}:00`, warnings });
  return {
    version: "1.0.0",
    platform,
    platformLabel: platformLabels[platform],
    me: { id: me, name: names.get(me) ?? "我" },
    them: { id: them, name: names.get(them) ?? "對方" },
    generatedAt: new Date().toISOString(),
    overview: {
      total: sorted.length,
      myMessages: sorted.filter((message) => message.sender_id === me).length,
      theirMessages: sorted.filter((message) => message.sender_id === them).length,
      startDate: formatDate(start),
      endDate: formatDate(end),
      durationDays: daySpan,
      perDay: Math.round((sorted.length / daySpan) * 10) / 10,
      activeDate: countsToSorted(dayCounts)[0]?.[0] ?? "—",
      activeHour: `${String(hourCounts.indexOf(Math.max(...hourCounts))).padStart(2, "0")}:00–${String((hourCounts.indexOf(Math.max(...hourCounts)) + 2) % 24).padStart(2, "0")}:00`,
      longestStreakHours: Math.round(Math.max(...sessions.map((session) => (dateOf(session[session.length - 1]).getTime() - dateOf(session[0]).getTime()) / 3600000), 0) * 10) / 10,
    },
    initiative: { me: Math.round((initiativeScores.me / initiativeTotal) * 100), them: Math.round((initiativeScores.them / initiativeTotal) * 100), basis: ["長時間間隔後誰先重新開啟對話", "主動提出問題的比例", "主動分享較完整內容的比例"] },
    response,
    unanswered: { ...unanswered, note: "匯出紀錄通常沒有真正的已讀狀態；無法確認是否真的已讀，這裡只標示疑似長時間未回覆。" },
    engagement: { me: engagementMe, them: engagementThem, reasons: ["比較回覆前後文是否有問題或情緒訊號", "觀察短回覆是否有延續話題行為", "依雙方平常的訊息風格做相對比較"] },
    emoji: { total: emojis.reduce((sum, item) => sum + item.total, 0), meTop: emojis.sort((a, b) => b.me - a.me)[0]?.emoji ?? "—", themTop: emojis.sort((a, b) => b.them - a.them)[0]?.emoji ?? "—", byEmoji: emojis.slice(0, 12), monthly: Object.entries(emojiMonths).map(([label, total]) => ({ label, total })) },
    media: makeMedia(sorted, me),
    words: wordStats,
    time: { hours: hourCounts.map((value, hour) => ({ label: `${String(hour).padStart(2, "0")}:00`, value })), weekdays: weekdayCounts.map((value, index) => ({ label: WEEKDAYS[index], value })), months: monthly, heatmap },
    personalities: profiles,
    topics: topics.length ? topics : fallbackTopics,
    events,
    quality: { hasEnoughText: textCount >= 20, confidence: sorted.length >= 100 ? "高" : sorted.length >= 25 ? "中" : "低", note: textCount < 20 ? "文字訊息較少，部分文字與互動推測的可信度會降低。" : "統計基於成功解析的訊息；推測型結果仍不代表對方真實想法。" },
    v2,
  };
}

export function formatMinutesForReport(value: number) { return formatMinutes(value); }
export function formatDateForReport(value: string) { return formatDate(new Date(value)); }
export { PERIODS };
