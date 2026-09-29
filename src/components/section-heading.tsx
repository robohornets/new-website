import type { ReactNode } from "react";

export function SectionHeading({
  index,
  label,
  title,
  aside,
  as: Tag = "h2",
}: {
  index?: string;
  label: string;
  title: ReactNode;
  aside?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="flex max-w-3xl flex-col gap-4">
        <span className="eyebrow eyebrow-bar text-bone">
          {index ? `${index} / ` : ""}
          {label}
        </span>
        <Tag className="font-display text-5xl leading-[0.95] font-extrabold uppercase md:text-7xl">{title}</Tag>
      </div>
      {aside}
    </div>
  );
}
