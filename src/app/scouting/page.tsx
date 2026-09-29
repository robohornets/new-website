import type { Metadata, Viewport } from "next";
import { ScoutingApp } from "./_app/app";

export const metadata: Metadata = {
  title: "Scouting",
  description: "FRC Team 1209's scouting notebook. Anyone can add what they learn about a team.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0f0e0c" };

// Everything loads in the browser from /scouting/api, so the page works from
// the phone's saved copy when there's no signal.
export default function ScoutingPage() {
  return <ScoutingApp />;
}
