import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { accessConfigured, verifyAccessToken } from "./access";
import { getEnv } from "./cf";

export type AdminUser = { email: string };

/**
 * Cloudflare Access sits in front of /admin and adds a signed JWT to every
 * request it lets through. We verify that token here as well, so the admin
 * stays locked even if someone reaches the Worker another way
 * (workers.dev URL, a misconfigured Access policy).
 *
 * Without CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD the admin is closed.
 * Under `next dev` (which only ever runs on a developer's own machine; the
 * deployed Worker is always a production build) a local developer is let in.
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  if (process.env.NODE_ENV === "development") return { email: "dev@localhost" };

  const env = await getEnv();
  const email = await verifyAccessToken(env, (await headers()).get("cf-access-jwt-assertion"));
  return email ? { email } : null;
});

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in to the admin.");
  }
}

/** Call at the top of every admin Server Action and route handler. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Call first in every admin page. Next renders a page in parallel with its
 * layout, so the layout's sign-in screen alone would not stop the page from
 * running its queries and streaming the result. Throwing here does.
 */
export async function requireAdminPage(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) notFound();
  return user;
}

export async function isAccessConfigured(): Promise<boolean> {
  return accessConfigured(await getEnv());
}
