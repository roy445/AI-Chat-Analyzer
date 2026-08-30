import type {
  Achievement,
  AnalysisReport,
  BalanceAnalysis,
  ChatHighlights,
  ConversationDrive,
  ConversationRhythm,
  EmotionTrendPoint,
  InsightConfidence,
  LinkAnalysis,
  NormalizedMessage,
  QualityCheck,
  SilenceAnalysis,
  StyleSimilarity,
  TopicLifecycle,
  V2Heatmap,
  WordStat,
} from "./types";

const DAYS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const POSITIVE = ["哈哈", "笑", "開心", "期待", "讚", "好棒", "喜歡", "謝謝", "太好了", "耶", "可愛", "晚安", "早安", "加油", "恭喜", "😂", "🤣", "🥰", "😍", "👍", "✨", "😊", "❤️", "❤"];
const NEGATIVE = ["生氣", "難過", "失望", "抱歉", "對不起", "煩", "討厭", "不爽", "算了", "隨便", "無言", "吵架", "不要理", "受不了", "誤會", "不懂你", "痛苦", "哭"];
const FILLERS = new Set(["嗯", "喔", "哦", "好", "哈哈", "哈", "蛤", "恩", "lol", "呵"]);
const TOPICS: Record<string, string[]> = {
  學校: ["學校", "上課", "老師", "作業", "考試", "報告", "課堂"],
  工作: ["工作", "上班", "主管", "同事", "加班", "公司", "面試"],
  遊戲: ["遊戲", "排位", "打團", "隊友", "電玩", "switch", "steam"],
  音樂: ["音樂", "歌曲", "歌", "演唱會", "樂團", "專輯"],
  出遊: ["旅行", "出遊", "景點", "車票", "飯店", "日本", "台北"],
  食物: ["吃飯", "好吃", "餐廳", "咖啡", "火鍋", "晚餐", "午餐"],
  日常: ["今天", "明天", "昨天", "回家", "睡覺", "起床", "天氣"],
  朋友: ["朋友", "同學", "聚會", "生日", "大家"],
};
const LINK_PATTERN = /https?:\/\/[^\s<>]+/i;
const LINKS_PATTERN = /https?:\/\/[^\s<>]+/gi;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

type Counts = Record<string, number>;
type PersonKey = "me" | "them";
type V2Result = AnalysisReport["v2"];

function date(message: NormalizedMessage) { return new Date(message.timestamp); }
function dateLabel(value: Date) { return `${value.getFullYear()}/${String(value.getMonth() + 1).padStart(2, "0")}/${String(value.getDate()).padStart(2, "0")}`; }
function monthLabel(value: Date) { return `${value.getFullYear()}/${String(value.getMonth() + 1).padStart(2, "0")}`; }
function round(value: number) { return Math.round(value * 10) / 10; }
function clamp(value: number, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(value))); }
function pct(part: number, total: number) { return total ? clamp((part / total) * 100) : 0; }
function personOf(message: NormalizedMessage, meId: string): PersonKey { return message.sender_id === meId ? "me" : "them"; }
function max(values: number[]) { return Math.max(1, ...values); }
function blankPerson() { return { me: 0, them: 0 }; }
function sortedMessages(messages: NormalizedMessage[]) { return [...messages].filter((message) => !message.is_system_message && !Number.isNaN(Date.parse(message.timestamp))).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)); }
function sessionsOf(messages: NormalizedMessage[]) {
  const sessions: NormalizedMessage[][] = [];
  for (const message of messages) {
    const current = sessions[sessions.length - 1];
    if (!current || date(message).getTime() - date(current[current.length - 1]).getTime() > 8 * 3600000) sessions.push([message]);
    else current.push(message);
  }
  return sessions;
}
function level(score: number): InsightConfidence["level"] { return score >= 75 ? "高" : score >= 48 ? "中" : "低"; }
function signal(message: NormalizedMessage) {
  const text = message.content.trim();
  const positive = POSITIVE.reduce((sum, word) => sum + (text.toLowerCase().includes(word.toLowerCase()) ? 1 : 0), 0) + (message.emoji.some((item) => ["😂", "🤣", "🥰", "😍", "👍", "✨", "😊", "❤", "❤️"].includes(item)) ? 1 : 0);
  const negative = NEGATIVE.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0) + (/[!?！？]{2,}/.test(text) ? 1 : 0);
  return { positive, negative };
}
function monthlyCount(messages: NormalizedMessage[]) {
  const map: Counts = {};
  messages.forEach((message) => { const key = monthLabel(date(message)); map[key] = (map[key] ?? 0) + 1; });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
}

function emotionTrend(messages: NormalizedMessage[]): V2Result["emotion"] {
  const buckets = new Map<string, { positive: number; negative: number; neutral: number; messages: number }>();
  messages.forEach((message) => {
    const key = monthLabel(date(message));
    const item = buckets.get(key) ?? { positive: 0, negative: 0, neutral: 0, messages: 0 };
    const current = signal(message);
    item.messages += 1;
    if (current.positive > current.negative) item.positive += 1;
    else if (current.negative > current.positive) item.negative += 1;
    else item.neutral += 1;
    buckets.set(key, item);
  });
  const trend: EmotionTrendPoint[] = Array.from(buckets.entries()).map(([label, item]) => ({ label, ...item, score: clamp(((item.positive - item.negative) / Math.max(1, item.messages)) * 100, -100, 100), confidence: item.messages >= 20 ? 74 : item.messages >= 8 ? 53 : 32 }));
  const total = trend.reduce((sum, item) => sum + item.messages, 0);
  const positive = trend.reduce((sum, item) => sum + item.positive, 0);
  const negative = trend.reduce((sum, item) => sum + item.negative, 0);
  const confidence = total >= 100 ? 76 : total >= 25 ? 58 : 31;
  return { trend, overall: positive > negative * 1.2 ? "正向訊號較多" : negative > positive * 1.2 ? "負向訊號較多" : "正負訊號相對接近", confidence, note: total < 25 ? "訊息較少，情緒趨勢只作為很初步的文字訊號觀察。" : "情緒標記只根據文字、Emoji 與標點的可觀察訊號，不能代表真實情緒。" };
}

function heatmap(messages: NormalizedMessage[]): V2Heatmap {
  const daily: Counts = {}; const weekday = Array.from({ length: 7 }, () => 0); const hours = Array.from({ length: 24 }, () => 0); const months: Counts = {}; const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  messages.forEach((message) => { const d = date(message); daily[dateLabel(d)] = (daily[dateLabel(d)] ?? 0) + 1; weekday[d.getDay()] += 1; hours[d.getHours()] += 1; months[monthLabel(d)] = (months[monthLabel(d)] ?? 0) + 1; grid[d.getDay()][d.getHours()] += 1; });
  return { daily: Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value })), weekdays: weekday.map((value, index) => ({ label: DAYS[index], value })), months: Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value })), hours: hours.map((value, index) => ({ label: `${String(index).padStart(2, "0")}:00`, value })), grid };
}

function drive(messages: NormalizedMessage[], meId: string): ConversationDrive {
  const sessions = sessionsOf(messages); const raw = { me: 0, them: 0 }; const components: Record<string, { me: number; them: number; description: string }> = {
    "開啟話題": { ...blankPerson(), description: "長時間間隔後由誰先傳訊息" },
    "提出問題": { ...blankPerson(), description: "問句讓對話有下一步" },
    "延續話題": { ...blankPerson(), description: "切換後仍補充內容或接住對話" },
    "重新開啟": { ...blankPerson(), description: "沉默後重新把互動帶回來" },
    "主動分享": { ...blankPerson(), description: "較完整文字、連結或媒體分享" },
  };
  sessions.forEach((session) => {
    const starter = personOf(session[0], meId); components["開啟話題"][starter] += 1; components["重新開啟"][starter] += 1; raw[starter] += 2;
    session.forEach((message, index) => {
      const who = personOf(message, meId); const previous = session[index - 1];
      if (message.message_type === "text" && /[?？]/.test(message.content)) { components["提出問題"][who] += 1; raw[who] += 1; }
      if (previous && previous.sender_id !== message.sender_id) { components["延續話題"][who] += 1; raw[who] += 1; }
      if (message.content.length >= 18 || message.message_type !== "text" || LINK_PATTERN.test(message.content)) { components["主動分享"][who] += 1; raw[who] += 1; }
    });
  });
  const total = Math.max(1, raw.me + raw.them);
  return { me: clamp((raw.me / total) * 100), them: clamp((raw.them / total) * 100), components: Object.entries(components).map(([label, value]) => ({ label, me: value.me, them: value.them, description: value.description })), basis: ["對話開啟與沉默後重新出現的發送者", "問句與延續話題的行為", "較完整文字、連結或媒體的主動分享"], confidence: messages.length >= 50 ? 78 : messages.length >= 15 ? 58 : 32 };
}

function rhythm(messages: NormalizedMessage[], meId: string): ConversationRhythm {
  let turnPairs = 0; const consecutive = blankPerson(); const longShort = { meLong: 0, themLong: 0, meShort: 0, themShort: 0 }; let interruptions = 0; let recoveries = 0; let longestRun = 0; let longestRunOwner: PersonKey = "me";
  for (let i = 0; i < messages.length; i += 1) {
    const current = messages[i]; const previous = messages[i - 1]; const who = personOf(current, meId);
    if (previous) {
      const gap = date(current).getTime() - date(previous).getTime();
      if (gap > 8 * 3600000) interruptions += 1;
      else if (gap <= 24 * 3600000 && gap > 6 * 3600000) recoveries += 1;
      if (previous.sender_id !== current.sender_id) turnPairs += 1;
    }
    const run = messages.slice(Math.max(0, i - 5), i + 1).filter((item) => item.sender_id === current.sender_id).length;
    if (run > longestRun) { longestRun = run; longestRunOwner = who; }
    if (run >= 2) consecutive[who] += 1;
    if (current.message_type === "text") { if (current.content.length >= 24) longShort[who === "me" ? "meLong" : "themLong"] += 1; if (current.content.length <= 4) longShort[who === "me" ? "meShort" : "themShort"] += 1; }
  }
  const switches = messages.length ? turnPairs / messages.length : 0;
  const dominant = switches >= .4 ? "一問一答與輪流回覆" : longestRun >= 3 ? `連續訊息較多（${longestRunOwner === "me" ? "你" : "對方"}較明顯）` : "節奏混合";
  return { turnPairs, consecutive, longShort, interruptions, recoveries, dominant, note: messages.length < 20 ? "資料較少，對話節奏尚不足以形成穩定結論。" : "節奏描述的是訊息排列方式，不是互動品質或關係親疏。" };
}

function tokens(text: string) {
  const result = new Set<string>();
  for (const run of text.toLowerCase().match(/[\u4e00-\u9fff]+/g) ?? []) for (let size = 2; size <= 3; size += 1) for (let index = 0; index <= run.length - size; index += 1) result.add(run.slice(index, index + size));
  for (const word of text.toLowerCase().match(/[a-z\d][a-z\d'-]{1,}/g) ?? []) result.add(word);
  return result;
}
function styleStats(messages: NormalizedMessage[], meId: string) {
  const result = { me: { count: 0, length: 0, emoji: 0, questions: 0, fillers: 0, words: new Set<string>() }, them: { count: 0, length: 0, emoji: 0, questions: 0, fillers: 0, words: new Set<string>() } };
  messages.filter((message) => message.message_type === "text").forEach((message) => { const who = personOf(message, meId); const item = result[who]; item.count += 1; item.length += message.content.length; item.emoji += message.emoji.length; if (/[?？]/.test(message.content)) item.questions += 1; if (FILLERS.has(message.content.trim().toLowerCase())) item.fillers += 1; tokens(message.content).forEach((word) => item.words.add(word)); });
  return result;
}
function similarity(messages: NormalizedMessage[], meId: string): StyleSimilarity {
  const stats = styleStats(messages, meId); const dimensions = [
    { label: "平均訊息長度", me: stats.me.count ? stats.me.length / stats.me.count : 0, them: stats.them.count ? stats.them.length / stats.them.count : 0, scale: 80 },
    { label: "Emoji 使用率", me: stats.me.count ? stats.me.emoji / stats.me.count : 0, them: stats.them.count ? stats.them.emoji / stats.them.count : 0, scale: 2 },
    { label: "問句比例", me: stats.me.count ? stats.me.questions / stats.me.count : 0, them: stats.them.count ? stats.them.questions / stats.them.count : 0, scale: 1 },
    { label: "語氣詞比例", me: stats.me.count ? stats.me.fillers / stats.me.count : 0, them: stats.them.count ? stats.them.fillers / stats.them.count : 0, scale: 1 },
  ].map((item) => ({ label: item.label, me: round(item.me), them: round(item.them), similarity: clamp(100 - (Math.abs(item.me - item.them) / Math.max(item.scale, item.me, item.them, .01)) * 100) }));
  const sharedWords = Array.from(stats.me.words).filter((word) => stats.them.words.has(word)).slice(0, 8);
  const overall = clamp(dimensions.reduce((sum, item) => sum + item.similarity, 0) / Math.max(1, dimensions.length));
  return { overall, dimensions, sharedWords, note: messages.length < 20 ? "文字樣本較少，風格比較僅供參考。" : "相似度比較表達習慣，不代表感情、個性或任何關係結論。", confidence: messages.length >= 60 ? 76 : messages.length >= 20 ? 56 : 30 };
}

function lifecycle(messages: NormalizedMessage[]): TopicLifecycle[] {
  return Object.entries(TOPICS).map(([name, words]) => {
    const map: Counts = {};
    messages.forEach((message) => { const lower = message.content.toLowerCase(); const hits = words.reduce((sum, word) => sum + (lower.split(word.toLowerCase()).length - 1), 0); if (hits) map[monthLabel(date(message))] = (map[monthLabel(date(message))] ?? 0) + hits; });
    const periods = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => ({ label, count }));
    const sorted = [...periods].sort((a, b) => b.count - a.count);
    return { name, total: periods.reduce((sum, item) => sum + item.count, 0), periods, first: periods[0]?.label ?? "—", last: periods[periods.length - 1]?.label ?? "—", peak: sorted[0]?.label ?? "—", activePeriods: periods.length };
  }).filter((item) => item.total > 0).sort((a, b) => b.total - a.total).slice(0, 8);
}

function silence(messages: NormalizedMessage[]): SilenceAnalysis {
  let longest = { hours: 0, start: "—", end: "—" };
  const gaps: { start: number; end: number; hours: number }[] = [];
  for (let i = 1; i < messages.length; i += 1) { const hours = (date(messages[i]).getTime() - date(messages[i - 1]).getTime()) / 3600000; if (hours > longest.hours) longest = { hours: round(hours), start: dateLabel(date(messages[i - 1])), end: dateLabel(date(messages[i])) }; if (hours >= 8) gaps.push({ start: i - 1, end: i, hours }); }
  const months = monthlyCount(messages); const drops = months.slice(1).map((item, index) => { const before = months[index].value; const change = before ? round(((item.value - before) / before) * 100) : 0; return { period: item.label, before, after: item.value, change }; }).filter((item) => item.before >= 5 && item.change <= -40).slice(-6);
  return { longest, drops, note: messages.length < 10 ? "資料較少，無法可靠判讀聊天降低或沉默模式。" : "沉默代表紀錄中沒有訊息，不代表已讀、冷淡或任何一方的意圖。", confidence: messages.length >= 80 ? 76 : messages.length >= 20 ? 54 : 28 };
}

function links(messages: NormalizedMessage[]): LinkAnalysis {
  const map: Counts = {}; messages.forEach((message) => (message.content.match(LINKS_PATTERN) ?? []).forEach((raw) => { let host = "其他網站"; try { host = new URL(raw).hostname.replace(/^www\./, ""); } catch { /* keep generic */ } const label = /youtube|youtu\.be/i.test(host) ? "YouTube" : /instagram/i.test(host) ? "Instagram" : /facebook|fb\.watch/i.test(host) ? "Facebook" : /tiktok/i.test(host) ? "TikTok" : /spotify/i.test(host) ? "Spotify" : "其他網站"; map[label] = (map[label] ?? 0) + 1; }));
  return { total: Object.values(map).reduce((sum, count) => sum + count, 0), types: Object.entries(map).sort(([, a], [, b]) => b - a).map(([label, count]) => ({ label, count })), examples: Object.entries(map).sort(([, a], [, b]) => b - a).map(([label, count]) => ({ label, count })) };
}

function balance(messages: NormalizedMessage[], meId: string, driveData: ConversationDrive, rhythmData: ConversationRhythm, response: AnalysisReport["response"]): BalanceAnalysis {
  const messageMe = messages.filter((message) => message.sender_id === meId).length;
  const messageThem = messages.length - messageMe;
  const messageScore = clamp(Math.min(messageMe, messageThem) / Math.max(1, Math.max(messageMe, messageThem)) * 100);
  const initiativeScore = 100 - Math.abs(driveData.me - driveData.them);
  const replyScore = 100 - Math.abs(pct(response.me.count, response.me.count + response.them.count) - pct(response.them.count, response.me.count + response.them.count));
  const rhythmScore = clamp(100 - Math.abs(rhythmData.consecutive.me - rhythmData.consecutive.them) / Math.max(1, rhythmData.turnPairs) * 100);
  const score = clamp((messageScore + initiativeScore + replyScore + rhythmScore) / 4);
  return { score, dimensions: [{ label: "訊息比例", score: messageScore, detail: "比較兩人的訊息數量" }, { label: "聊天帶動", score: initiativeScore, detail: "比較開啟、提問、延續與分享" }, { label: "回覆參與", score: replyScore, detail: "比較可辨識的雙向回覆" }, { label: "節奏分布", score: rhythmScore, detail: "比較連續訊息與輪流互動" }], note: messages.length < 20 ? "資料較少，平衡度只提供初步參考。" : "平衡度描述互動分布是否接近，不表示誰比較在乎。", confidence: messages.length >= 60 ? 74 : messages.length >= 20 ? 52 : 27 };
}

function achievements(messages: NormalizedMessage[], meId: string, driveData: ConversationDrive, response: AnalysisReport["response"], highlights: ChatHighlights): Achievement[] {
  const persons: Record<PersonKey, NormalizedMessage[]> = { me: messages.filter((message) => personOf(message, meId) === "me"), them: messages.filter((message) => personOf(message, meId) === "them") };
  const items: Achievement[] = [];
  (Object.keys(persons) as PersonKey[]).forEach((owner) => {
    const list = persons[owner]; const text = list.filter((message) => message.message_type === "text"); const night = list.filter((message) => date(message).getHours() >= 22 || date(message).getHours() < 5).length; const emoji = list.reduce((sum, message) => sum + message.emoji.length, 0); const average = text.length ? text.reduce((sum, message) => sum + message.content.length, 0) / text.length : 0; const responseData = owner === "me" ? response.me : response.them; const name = owner === "me" ? "你" : "對方";
    const add = (id: string, icon: string, title: string, description: string, unlocked: boolean, value: string) => items.push({ id: `${id}-${owner}`, icon, title, owner, ownerName: name, description, unlocked, value });
    add("night-owl", "🌙", "夜貓子", "在晚上 22:00 到清晨 05:00 留下不少訊息", night >= 5, `${night} 則深夜訊息`);
    add("topic-maker", "💡", "話題製造機", "在可觀察的開啟、提問與延續行為中表現較多", (owner === "me" ? driveData.me : driveData.them) >= 60 && messages.length >= 15, `${owner === "me" ? driveData.me : driveData.them}% 帶動力`);
    add("fast-reply", "⚡", "秒回王", "有足夠回覆樣本且中位數等待時間不長", responseData.count >= 3 && responseData.median > 0 && responseData.median <= 5, responseData.median ? `${Math.round(responseData.median)} 分鐘中位數` : "樣本不足");
    add("long-text", "📝", "長文之王", "平均文字訊息較完整，且有足夠文字樣本", text.length >= 3 && average >= 24, `${round(average)} 字 / 則`);
    add("emoji-master", "😂", "Emoji 大師", "在這段紀錄中使用了較多 Emoji", emoji >= 8, `${emoji} 個 Emoji`);
    add("deep-night", "🌌", "深夜聊天王", "在深夜時段持續留下互動", night >= 10, `${night} 則深夜訊息`);
  });
  const longest = Number(highlights.longestSilence.replace(/[^\d.]/g, "")) || 0;
  items.push({ id: "marathon-both", icon: "🔥", title: "聊天馬拉松", owner: "both", ownerName: "你們", description: "曾經在單一聊天片段中維持長時間互動", unlocked: longest < 24 && messages.length >= 20 && highlights.densestDay.count >= 8, value: `${highlights.densestDay.count} 則最高密度日` });
  return items;
}

function highlights(messages: NormalizedMessage[], words: WordStat[], emoji: AnalysisReport["emoji"], silenceData: SilenceAnalysis, topics: { name: string; count: number }[], activeHour: string): ChatHighlights {
  const longest = [...messages].filter((message) => message.message_type === "text").sort((a, b) => b.content.length - a.content.length)[0]; const daily: Counts = {}; messages.forEach((message) => { const key = dateLabel(date(message)); daily[key] = (daily[key] ?? 0) + 1; }); const densest = Object.entries(daily).sort(([, a], [, b]) => b - a)[0];
  return { longestMessage: { name: longest?.sender_name ?? "—", length: longest?.content.length ?? 0, date: longest ? dateLabel(date(longest)) : "—" }, densestDay: { label: densest?.[0] ?? "—", count: densest?.[1] ?? 0 }, topWord: words[0]?.word ?? "—", topEmoji: emoji.byEmoji[0]?.emoji ?? "—", activeHour, longestSilence: silenceData.longest.hours ? `${silenceData.longest.hours} 小時` : "—", topTopic: topics[0]?.name ?? "—" };
}

function quality(messages: NormalizedMessage[], warnings: string[]): QualityCheck {
  const dates = new Set(messages.map((message) => dateLabel(date(message)))); const unknownMessages = messages.filter((message) => message.message_type === "unknown").length; const sorted = sortedMessages(messages); const start = sorted[0] ? date(sorted[0]).getTime() : 0; const end = sorted.at(-1) ? date(sorted.at(-1) as NormalizedMessage).getTime() : 0; const calendarDays = start && end ? Math.max(1, Math.ceil((end - start) / 86400000) + 1) : 0; const dateCoverage = calendarDays ? clamp((dates.size / calendarDays) * 100) : 0; let dateGaps = 0; for (let i = 1; i < sorted.length; i += 1) if (date(sorted[i]).getTime() - date(sorted[i - 1]).getTime() > 7 * 86400000) dateGaps += 1;
  const allWarnings = [...warnings]; if (unknownMessages) allWarnings.push(`${unknownMessages} 則訊息類型無法辨識`); if (dateGaps) allWarnings.push(`找到 ${dateGaps} 段超過一週的日期間隔`); const completeness = messages.length < 20 || unknownMessages / Math.max(1, messages.length) > .1 ? "低" : messages.length < 80 || dateCoverage < 10 ? "中" : "高";
  return { completeness, dateCoverage, unknownMessages, dateGaps, warnings: allWarnings, note: completeness === "低" ? "資料量或格式完整度偏低，情緒、人格與事件推測會比較不可靠。" : completeness === "中" ? "資料可以進行基本分析，但日期間隔或樣本量可能影響部分推測。" : "已成功解析足夠訊息；推測型結果仍不代表任何人的真實想法。" };
}

export function analyzeV2(messages: NormalizedMessage[], meId: string, base: { words: WordStat[]; emoji: AnalysisReport["emoji"]; response: AnalysisReport["response"]; topics: { name: string; count: number }[]; activeHour: string; warnings?: string[] }): V2Result {
  const sorted = sortedMessages(messages); const driveData = drive(sorted, meId); const rhythmData = rhythm(sorted, meId); const emotion = emotionTrend(sorted); const heat = heatmap(sorted); const style = similarity(sorted, meId); const life = lifecycle(sorted); const quiet = silence(sorted); const linkData = links(sorted); const balanceData = balance(sorted, meId, driveData, rhythmData, base.response); const qualityData = quality(sorted, base.warnings ?? []); const highlightData = highlights(sorted, base.words, base.emoji, quiet, base.topics, base.activeHour); const achievementData = achievements(sorted, meId, driveData, base.response, highlightData);
  return { emotion, heatmap: heat, drive: driveData, rhythm: rhythmData, similarity: style, topicLifecycle: life, silence: quiet, links: linkData, balance: balanceData, achievements: achievementData, highlights: highlightData, quality: qualityData };
}

export function searchChat(messages: NormalizedMessage[], query: string) {
  const terms = Array.from(tokens(query)); const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return sortedMessages(messages).map((message, index) => { const content = message.content.toLowerCase(); const exact = content.includes(normalized); const overlap = terms.filter((term) => content.includes(term)).length; return { message, index: index + 1, score: (exact ? 10 : 0) + overlap, matchType: exact ? "關鍵字命中" : overlap ? "語意近似" : "" }; }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || Date.parse(a.message.timestamp) - Date.parse(b.message.timestamp)).slice(0, 20);
}

export function localQuestionAnswer(report: AnalysisReport, question: string) {
  const q = question.trim(); const lower = q.toLowerCase(); const topTopic = report.topics[0]?.name ?? "目前沒有穩定主題"; const firstFrequent = report.v2.heatmap.months.find((month) => month.value >= Math.max(3, report.overview.total * .08))?.label ?? report.v2.heatmap.months[0]?.label ?? "資料不足";
  if (/什麼時候|開始常|常聊天/.test(q)) return `從目前紀錄來看，${firstFrequent} 的訊息量已經比較明顯；這是依月份訊息數判斷，不能確認那是不是你們關係中的「開始」。`;
  if (/最常聊|話題/.test(q)) return report.topics.length ? `目前最常出現的主題是「${topTopic}」，共有約 ${report.topics[0].count} 次相關詞彙訊號。你也可以在「話題生命週期」查看它在哪些月份活躍。` : "目前文字資料不足，還無法可靠整理出常聊主題。";
  if (/誰比較常主動|誰.*主動|帶動/.test(q)) return `可觀察的聊天帶動力是：你 ${report.v2.drive.me}%、對方 ${report.v2.drive.them}%。它綜合開啟、提問、延續、重新開啟與分享，不代表誰比較在乎。`;
  if (/哪段時間|何時.*聊天|最常聊天/.test(q)) return `目前訊息最密集的時段是 ${report.overview.activeHour}；最活躍日期是 ${report.overview.activeDate}。這是時間分布統計，不等同於情緒判斷。`;
  if (/沒聊天|沉默|中斷/.test(q)) return report.v2.silence.longest.hours ? `紀錄中最長的訊息間隔約 ${report.v2.silence.longest.hours} 小時（${report.v2.silence.longest.start} 到 ${report.v2.silence.longest.end}）。沒有訊息不代表已讀或任何人的意圖。` : "目前沒有足夠的時間資料找出明顯中斷。";
  return "我可以根據目前的統計回答：常聊主題、月份與時段、主動帶動力、沉默間隔或文字搜尋。這個問題目前沒有足夠的可觀察資料，請換個更具體的問法。";
}
