import type { SVGProps } from "react";
import type { SocialPlatform } from "@/lib/types";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ArrowRight = (p: IconProps) => (
  <Svg strokeWidth={2.5} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const Plus = (p: IconProps) => (
  <Svg strokeWidth={2.5} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const Menu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const Close = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const Mail = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </Svg>
);

export const MapPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </Svg>
);

export const External = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </Svg>
);

export const Hex = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" />
  </Svg>
);

export const Trash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Svg>
);

export const Upload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
  </Svg>
);

export const SOCIAL_LABEL: Record<SocialPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X (Twitter)",
  github: "GitHub",
  facebook: "Facebook",
  threads: "Threads",
};

export function SocialIcon({ platform, ...p }: IconProps & { platform: SocialPlatform }) {
  switch (platform) {
    case "youtube":
      return (
        <Svg {...p}>
          <rect x="2" y="5" width="20" height="14" rx="4" />
          <path d="M10 9l5 3-5 3z" />
        </Svg>
      );
    case "instagram":
      return (
        <Svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.5" />
        </Svg>
      );
    case "tiktok":
      return (
        <Svg {...p}>
          <path d="M14 3v11a4 4 0 1 1-4-4" />
          <path d="M14 3c0 3 2 5 5 5" />
        </Svg>
      );
    case "x":
      return (
        <Svg {...p}>
          <path d="M4 4l16 16M20 4L4 20" />
        </Svg>
      );
    case "github":
      return (
        <Svg {...p}>
          <path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.5 11.5 0 0 0-6.2 0C6.6 2.8 5.6 3.1 5.6 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.2 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
        </Svg>
      );
    case "facebook":
      return (
        <Svg {...p}>
          <path d="M15 3h-3a4 4 0 0 0-4 4v3H5v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </Svg>
      );
    case "threads":
      return (
        <Svg {...p}>
          <path d="M16.5 11.5c-.5-3-2.5-4.5-5-4.5-3 0-5 2.2-5 5.5S8.5 18 12 18c3.5 0 6-2 6-5 0-2.5-2-3.5-4.5-3.5S9.5 10.8 9.5 12.3c0 1.4 1.2 2.2 2.6 2.2 2.4 0 3.4-2 3.4-5.5" />
        </Svg>
      );
  }
}
