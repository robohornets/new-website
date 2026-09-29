import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  // next/font has no metrics for this family, so name the fallback ourselves.
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "sans-serif"],
});

const sans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://btwrobotics.com"),
  title: {
    default: "RoboHornets · FRC Team 1209",
    template: "%s · RoboHornets 1209",
  },
  description:
    "Team 1209, the RoboHornets, is the FIRST Robotics Competition team from Booker T. Washington High School in Tulsa, Oklahoma.",
  openGraph: {
    siteName: "RoboHornets · FRC Team 1209",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0e0c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
