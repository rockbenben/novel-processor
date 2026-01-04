import React from "react";
import "./globals.css";
import { Navigation } from "./ui/navigation";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import ThemesProvider from "./ThemesProvider";
import type { Metadata } from "next";
//autocorrect:false
export const metadata: Metadata = {
  title: "ToolsByAI | 免费开源的 AI 翻译与数据处理工具集",
  description: "寻找高效开发工具？ToolsByAI 汇集字幕翻译、i18n 处理等 20+ 款免费开源应用。接入 DeepSeek 等主流模型，支持批量处理且数据隐私安全，立即开启 AI 提效之旅！",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hans">
      <body>
        <AntdRegistry>
          <ThemesProvider>
            <Navigation />
            <main style={{ maxWidth: 1280, width: "100%", marginTop: 8, marginInline: "auto", paddingInline: "clamp(16px, 4vw, 24px)", paddingBlock: 16 }}>{children}</main>
          </ThemesProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
