import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Source_Serif_4,
  Instrument_Serif,
  Noto_Sans_SC,
} from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { UndoToast } from "@/components/undo-toast";
import { KeyboardLayer } from "@/components/keyboard";
import { ProfileSync } from "@/components/profile-sync";
import { FeedSync } from "@/components/feed-sync";
import { ThemeSync } from "@/components/theme-sync";
import { GithubStars } from "@/components/github-stars";
import { UserMenu } from "@/components/user-menu";
import { FirstRunGate, DesktopAccountControls } from "@/components/first-run";

// Primary UI sans — clean, modern, pairs with Source Serif 4
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

// Mono — for kbd, tabular metadata, technical strings
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

// Reading body — long prose (intros, summaries, pull quotes)
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

// Display italic — wordmark, greeting day-name accent
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

// CJK fallback
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-noto-sc",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Peer — AI News Agent",
  description:
    "A self-hosted AI agent that reads the internet for you and only tells you what matters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      data-color-theme="system"
      className={`${geist.variable} ${geistMono.variable} ${sourceSerif.variable} ${instrumentSerif.variable} ${notoSansSC.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <Nav />
        <main className="flex-1 hermes-main-content">{children}</main>
        {/* Floating account + GitHub star — desktop only, hidden during the
            onboarding wizard. Rendered here (server) and passed as children so
            the async GithubStars stays a Server Component. */}
        <DesktopAccountControls>
          <UserMenu />
          <GithubStars />
        </DesktopAccountControls>
        <UndoToast />
        <KeyboardLayer />
        <ThemeSync />
        <ProfileSync />
        <FeedSync />
        <FirstRunGate />
      </body>
    </html>
  );
}
