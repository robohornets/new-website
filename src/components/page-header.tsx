import type { ReactNode } from "react";

export function PageHeader({ label, title, intro, children }: { label: string; title: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 pt-12 pb-12 md:px-8 md:pt-20 md:pb-16 xl:px-16">
        <span className="eyebrow eyebrow-bar text-bone">{label}</span>
        <h1 className="font-display text-[64px] leading-[0.9] font-black uppercase md:text-[112px]">{title}</h1>
        {intro && <div className="max-w-2xl text-[17px] leading-relaxed text-sand md:text-lg">{intro}</div>}
        {children}
      </div>
    </section>
  );
}

const WIDTHS = { wide: "max-w-[1440px]", article: "max-w-[1200px]", narrow: "max-w-[960px]", text: "max-w-[760px]" };

export function Container({
  children,
  className = "",
  size = "wide",
}: {
  children: ReactNode;
  className?: string;
  size?: keyof typeof WIDTHS;
}) {
  return <div className={`mx-auto px-4 md:px-8 ${size === "wide" ? "xl:px-16" : ""} ${WIDTHS[size]} ${className}`}>{children}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-md border-[1.5px] border-dashed border-edge p-10 text-center text-dust">{children}</p>;
}
