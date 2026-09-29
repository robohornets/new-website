import type { Metadata } from "next";
import Link from "next/link";
import { getAdminUser, isAccessConfigured } from "@/lib/auth";
import { first } from "@/lib/db";
import { AdminSidebar } from "./_components/sidebar";
import { ConfirmProvider } from "./_components/modal";
import { UnsavedChangesProvider } from "./_components/unsaved";
import { HelpButton, HelpProvider } from "./_help/help-panel";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · 1209 Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getAdminUser();
  if (!user) return <AccessRequired configured={await isAccessConfigured()} />;

  const counts = await first<{ messages: number; join_requests: number }>(
    `SELECT (SELECT COUNT(*) FROM messages WHERE read_at IS NULL AND archived = 0) AS messages,
            (SELECT COUNT(*) FROM join_requests WHERE status = 'pending') AS join_requests`,
  );

  return (
    <HelpProvider>
      <ConfirmProvider>
        <UnsavedChangesProvider>
          <div className="flex min-h-dvh flex-col lg:flex-row">
            <AdminSidebar email={user.email} badges={{ messages: counts?.messages ?? 0, join: counts?.join_requests ?? 0 }} />
            {/* Bottom padding leaves room for the unsaved-changes bar. */}
            <main className="flex min-w-0 grow flex-col gap-6 px-4 pt-5 pb-28 md:px-8 md:pt-6 xl:px-10">
              <div className="flex justify-end">
                <HelpButton />
              </div>
              {children}
            </main>
          </div>
        </UnsavedChangesProvider>
      </ConfirmProvider>
    </HelpProvider>
  );
}

function AccessRequired({ configured }: { configured: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <span className="eyebrow eyebrow-bar text-bone">1209 Admin</span>
      <h1 className="font-display text-5xl font-black uppercase">Sign in required</h1>
      {configured ? (
        <p className="max-w-md text-sand">
          The admin is protected by Cloudflare Access. Open{" "}
          <span className="font-mono text-bone">btwrobotics.com/admin</span> and sign in with an approved team email.
        </p>
      ) : (
        <p className="max-w-md text-sand">
          Cloudflare Access isn&apos;t set up yet, so the admin is locked. Add <span className="font-mono text-bone">CF_ACCESS_TEAM_DOMAIN</span>{" "}
          and <span className="font-mono text-bone">CF_ACCESS_AUD</span> to the Worker (see the README).
        </p>
      )}
      <Link href="/" className="font-semibold text-hornet hover:text-hornet-hover">
        Back to the site
      </Link>
    </main>
  );
}
