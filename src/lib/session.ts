import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/db/schema";

export const SESSION_COOKIE = "cp_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  sub: string;
  role: Role;
  name: string;
  departmentId: string | null;
  /** Bumped when a password changes so old tokens can be detected. */
  ver: number;
};

/**
 * Signing key for session tokens. AUTH_SECRET is preferred; when it is not set (for example a
 * fresh Vercel + Neon deployment) the key is derived from DATABASE_URL, which is already a
 * server-only secret. Rotating either value signs everyone out.
 */
function key() {
  const secret = process.env.AUTH_SECRET || (process.env.DATABASE_URL ? `civicpulse-session:${process.env.DATABASE_URL}` : "");
  if (secret.length < 32) {
    throw new Error("Set AUTH_SECRET (at least 32 characters) or DATABASE_URL");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
