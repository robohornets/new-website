import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="font-mono text-[15px] tracking-[0.15em] text-dust">WHAT TIME IS IT?</p>
      <p className="font-display text-[120px] leading-[0.82] font-black text-hornet md:text-[200px]">12:09!</p>
      <h1 className="font-display text-3xl font-extrabold uppercase md:text-4xl">But this page doesn&apos;t exist.</h1>
      <p className="max-w-md text-sand">It may have moved when we rebuilt the site. Try the homepage or the season archive.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/" className="flex h-13 items-center justify-center rounded-md bg-hornet px-6 font-bold text-ink hover:bg-amber">
          Back to home
        </Link>
        <Link href="/seasons" className="flex h-13 items-center justify-center rounded-md border-[1.5px] border-edge px-6 font-semibold hover:border-bone">
          Seasons
        </Link>
      </div>
    </main>
  );
}
