// Cloudflare Access sign-in check, as plain Worker code (no Next.js imports),
// so worker.ts can use it for uploads as well as the Next.js admin.

import { createRemoteJWKSet, jwtVerify } from "jose";

type AccessEnv = { CF_ACCESS_TEAM_DOMAIN?: string; CF_ACCESS_AUD?: string };

const jwksByTeam = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
// Tokens already checked by this Worker instance, until they expire. A bulk
// upload sends the same token dozens of times; checking the signature once
// is enough.
const verified = new Map<string, { email: string; exp: number }>();

function jwksFor(teamDomain: string) {
  let jwks = jwksByTeam.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksByTeam.set(teamDomain, jwks);
  }
  return jwks;
}

export function accessConfigured(env: AccessEnv): boolean {
  return Boolean(env.CF_ACCESS_TEAM_DOMAIN?.trim() && env.CF_ACCESS_AUD?.trim());
}

/** The signed-in admin's email from a Cloudflare Access token, or null. */
export async function verifyAccessToken(env: AccessEnv, token: string | null): Promise<string | null> {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const aud = env.CF_ACCESS_AUD?.trim();
  if (!teamDomain || !aud || !token) return null;

  const seen = verified.get(token);
  if (seen && seen.exp > Date.now() / 1000) return seen.email;

  try {
    const { payload } = await jwtVerify(token, jwksFor(teamDomain), {
      issuer: `https://${teamDomain}`,
      audience: aud,
    });
    const email = typeof payload.email === "string" ? payload.email : null;
    if (email && typeof payload.exp === "number") {
      if (verified.size > 200) verified.clear();
      verified.set(token, { email, exp: payload.exp });
    }
    return email;
  } catch {
    return null;
  }
}
