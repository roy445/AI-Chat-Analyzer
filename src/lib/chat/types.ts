export type Platform = "line" | "instagram" | "messenger";

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "sticker"
  | "file"
  | "system"
  | "unknown";

export type NormalizedMessage = {
  message_id: string;
  sender_id: string;
  sender_name: string;
  timestamp: string;
  content: string;
  message_type: MessageType;
  reply_to?: string;
  emoji: string[];
  media_type?: string;
  is_system_message: boolean;
};

export type ParseResult = {
  platform: Platform;
  messages: NormalizedMessage[];
  participants: { id: string; name: string }[];
  warnings: string[];
};

export type WordStat = { word: string; total: number; me: number; them: number };
export type Metric = { label: string; value: string; detail?: string };

export type ResponseStats = {
  me: { average: number; median: number; fastest: number; slowest: number; count: number };
  them: { average: number; median: number; fastest: number; slowest: number; count: number };
  byPeriod: { label: string; me: number; them: number }[];
};

export type BehaviorProfile = {
  name: string;
  score: number;
  tags: string[];
  traits: string[];
};

export type InsightEvent = {
  id: string;
  date: string;
  type: "positive" | "neutral" | "conflict" | "recovery" | "peak";
  title: string;
  description: string;
  confidence?: number;
  reasons?: string[];
};

export type DateRange = { start?: string; end?: string };
export type InsightConfidence = { score: number; level: "低" | "中" | "高"; reasons: string[] };
export type EmotionTrendPoint = { label: string; positive: number; negative: number; neutral: number; score: number; messages: number; confidence: number };
export type V2Heatmap = { daily: { label: string; value: number }[]; weekdays: { label: string; value: number }[]; months: { label: string; value: number }[]; hours: { label: string; value: number }[]; grid: number[][] };
export type ConversationDrive = { me: number; them: number; components: { label: string; me: number; them: number; description: string }[]; basis: string[]; confidence: number };
export type ConversationRhythm = { turnPairs: number; consecutive: { me: number; them: number }; longShort: { meLong: number; themLong: number; meShort: number; themShort: number }; interruptions: number; recoveries: number; dominant: string; note: string };
export type StyleSimilarity = { overall: number; dimensions: { label: string; me: number; them: number; similarity: number }[]; sharedWords: string[]; note: string; confidence: number };
export type TopicLifecycle = { name: string; total: number; periods: { label: string; count: number }[]; first: string; last: string; peak: string; activePeriods: number };
export type SilenceAnalysis = { longest: { hours: number; start: string; end: string }; drops: { period: string; before: number; after: number; change: number }[]; note: string; confidence: number };
export type LinkAnalysis = { total: number; types: { label: string; count: number }[]; examples: { label: string; count: number }[] };
export type BalanceAnalysis = { score: number; dimensions: { label: string; score: number; detail: string }[]; note: string; confidence: number };
export type Achievement = { id: string; icon: string; title: string; owner: "me" | "them" | "both"; ownerName: string; description: string; unlocked: boolean; value: string };
export type ChatHighlights = { longestMessage: { name: string; length: number; date: string }; densestDay: { label: string; count: number }; topWord: string; topEmoji: string; activeHour: string; longestSilence: string; topTopic: string };
export type QualityCheck = { completeness: "低" | "中" | "高"; dateCoverage: number; unknownMessages: number; dateGaps: number; warnings: string[]; note: string };

export type AnalysisReport = {
  version: string;
  platform: Platform;
  platformLabel: string;
  me: { id: string; name: string };
  them: { id: string; name: string };
  generatedAt: string;
  overview: {
    total: number;
    myMessages: number;
    theirMessages: number;
    startDate: string;
    endDate: string;
    durationDays: number;
    perDay: number;
    activeDate: string;
    activeHour: string;
    longestStreakHours: number;
  };
  initiative: { me: number; them: number; basis: string[] };
  response: ResponseStats;
  unanswered: { me: number; them: number; note: string };
  engagement: {
    me: { level: "低" | "中" | "高"; score: number; confidence: number };
    them: { level: "低" | "中" | "高"; score: number; confidence: number };
    reasons: string[];
  };
  emoji: {
    total: number;
    meTop: string;
    themTop: string;
    byEmoji: { emoji: string; me: number; them: number; total: number }[];
    monthly: { label: string; total: number }[];
  };
  media: {
    me: Record<"image" | "video" | "audio" | "sticker" | "file", number>;
    them: Record<"image" | "video" | "audio" | "sticker" | "file", number>;
  };
  words: WordStat[];
  time: {
    hours: { label: string; value: number }[];
    weekdays: { label: string; value: number }[];
    months: { label: string; value: number }[];
    heatmap: number[][];
  };
  personalities: { me: BehaviorProfile; them: BehaviorProfile };
  topics: { name: string; count: number }[];
  events: InsightEvent[];
  quality: { hasEnoughText: boolean; confidence: "低" | "中" | "高"; note: string };
  v2: {
    emotion: { trend: EmotionTrendPoint[]; overall: string; confidence: number; note: string };
    heatmap: V2Heatmap;
    drive: ConversationDrive;
    rhythm: ConversationRhythm;
    similarity: StyleSimilarity;
    topicLifecycle: TopicLifecycle[];
    silence: SilenceAnalysis;
    links: LinkAnalysis;
    balance: BalanceAnalysis;
    achievements: Achievement[];
    highlights: ChatHighlights;
    quality: QualityCheck;
  };
};

export type AiAnalysis = {
  summary: string;
  atmosphere: string;
  observations: string[];
  cautions: string[];
  confidence: number;
  provider: string;
  keyFindings?: string[];
  communicationStyle?: string[];
  emotionalSignals?: string[];
  strengths?: string[];
  frictionPoints?: string[];
  actionableSuggestions?: string[];
  evidence?: string[];
};

export type ShareMode = "full" | "recap" | "achievements";
export type SharedReport = {
  report: AnalysisReport;
  ai?: AiAnalysis | null;
  mode?: ShareMode;
  sections?: string[];
  anonymous?: boolean;
  shareId?: string;
};
