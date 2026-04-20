import type { Metadata } from "next";
import { JetBrains_Mono, Source_Serif_4, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb-mono",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-noto-sc",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hermes — AI News Agent",
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
      className={`${jetbrains.variable} ${sourceSerif.variable} ${notoSansSC.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <Nav />
        <main className="flex-1 pt-14 lg:pt-0 lg:pl-52">{children}</main>
      </body>
    </html>
  );
}
