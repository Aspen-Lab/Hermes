import type { Metadata } from "next";
import {
  Inter,
  Newsreader,
  Noto_Sans_SC,
  Roboto_Mono,
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
import { StoreHydrator } from "@/components/store-hydrator";
import { LocalProfileSync } from "@/components/local-profile-sync";

// Primary UI sans — Delphi-style interface text
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Mono — for kbd, tabular metadata, technical strings
const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

// Serif — display headlines AND long prose. Variable font with an optical
// size axis, closest open face to Delphi's Martina Plantijn; light (300)
// at display sizes, 400 for reading.
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
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
      data-mode="system"
      data-accent="ember"
      // The boot script below rewrites data-mode/data-accent before
      // hydration; suppress the expected server/client attribute mismatch.
      suppressHydrationWarning
      className={`${inter.variable} ${robotoMono.variable} ${newsreader.variable} ${notoSansSC.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        {/* Pre-paint theme boot: apply the persisted mode+accent before first
            paint so dark palettes never flash ivory. Reads the zustand-persist
            snapshot (store/profile.ts, name: "peer-profile"); legacy
            single-name themes map like lib/theme.ts LEGACY. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var L={system:"system:ember",cream:"light:ember",white:"light:indigo",pink:"light:rose",blue:"light:indigo",sage:"light:sage",lavender:"light:violet",black:"dark:ember",slate:"dark:indigo",plum:"dark:violet"};var t=JSON.parse(localStorage.getItem("peer-profile")).state.profile.colorTheme;t=L[t]||t;var p=String(t).split(":");if(["system","light","dark"].indexOf(p[0])>=0&&["ember","rose","marigold","sage","indigo","violet"].indexOf(p[1])>=0){var r=document.documentElement;r.setAttribute("data-mode",p[0]);r.setAttribute("data-accent",p[1])}}catch(e){}})()`,
          }}
        />
        <Nav />
        <main className="flex-1 peer-main-content">{children}</main>
        {/* Floating account + GitHub star — desktop only, hidden during the
            onboarding wizard. Rendered here (server) and passed as children so
            the async GithubStars stays a Server Component. */}
        <DesktopAccountControls>
          <UserMenu />
          <GithubStars />
        </DesktopAccountControls>
        <UndoToast />
        <KeyboardLayer />
        <StoreHydrator />
        <ThemeSync />
        <ProfileSync />
        <LocalProfileSync />
        <FeedSync />
        <FirstRunGate />
      </body>
    </html>
  );
}
