import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Chat Analyzer｜看看你們的聊天，究竟藏著什麼？",
  description: "在裝置本機分析 LINE、Instagram 與 Messenger 的兩人聊天紀錄。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="bg-[#f6f8fc] text-slate-900 antialiased">{children}</body>
    </html>
  );
}
