import "server-only";
import { issueQuerySchema } from "@/lib/validation";

export function flatParams(sp: Record<string, string | string[] | undefined>) {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export function parseIssueQuery(sp: Record<string, string | string[] | undefined>) {
  const params = flatParams(sp);
  return { params, query: issueQuerySchema.parse(params) };
}
