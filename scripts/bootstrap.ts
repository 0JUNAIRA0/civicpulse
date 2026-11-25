/**
 * Production bootstrap. Safe to run on every deploy:
 * - creates the Dhaka areas, departments and platform settings if they are missing
 * - creates one account per role (used as the published demo credentials)
 * It never deletes anything and never creates sample issues; all issue data comes from real use.
 *
 * Run: npm run db:bootstrap
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import * as s from "../src/db/schema";
import { AREAS, DEFAULT_PLATFORM_SETTINGS, DEPARTMENTS } from "../src/db/reference-data";

const ACCOUNTS = [
  { email: "admin@civicpulse.gov", name: "Platform Administrator", role: "ADMIN", password: "Admin@123", jobTitle: "System Administrator", dept: null },
  { email: "manager.roads@civicpulse.gov", name: "Roads Department Manager", role: "DEPT_MANAGER", password: "Manager@123", jobTitle: "Head of Roads & Highways", dept: "RHD" },
  { email: "staff@civicpulse.gov", name: "Roads Field Technician", role: "STAFF", password: "Staff@123", jobTitle: "Field Technician", dept: "RHD" },
  { email: "citizen@civicpulse.app", name: "Demo Citizen", role: "CITIZEN", password: "Citizen@123", jobTitle: null, dept: null },
] as const;

async function main() {
  const [{ n: areaCount }] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM areas`)).rows;
  if (areaCount === 0) {
    await db.insert(s.areas).values(AREAS.map(([name, zone, , latitude, longitude]) => ({ name, zone, latitude, longitude })));
    console.log(`areas: added ${AREAS.length}`);
  }

  for (const d of DEPARTMENTS) {
    await db
      .insert(s.departments)
      .values({ name: d.name, code: d.code, description: d.description, categories: d.categories, email: `${d.slug}@civicpulse.gov` })
      .onConflictDoNothing();
  }
  const depts = await db.select({ id: s.departments.id, code: s.departments.code, managerId: s.departments.managerId }).from(s.departments);
  const deptId = (code: string | null) => (code ? (depts.find((d) => d.code === code)?.id ?? null) : null);

  for (const a of ACCOUNTS) {
    const existing = await db.query.users.findFirst({ where: eq(s.users.email, a.email) });
    if (existing) continue;
    const [u] = await db
      .insert(s.users)
      .values({ email: a.email, name: a.name, role: a.role, passwordHash: bcrypt.hashSync(a.password, 10), jobTitle: a.jobTitle, departmentId: deptId(a.dept) })
      .returning();
    if (a.role === "DEPT_MANAGER" && a.dept) {
      const d = depts.find((x) => x.code === a.dept);
      if (d && !d.managerId) await db.update(s.departments).set({ managerId: u.id }).where(eq(s.departments.id, d.id));
    }
    console.log(`account: created ${a.email}`);
  }

  await db.insert(s.systemSettings).values({ key: "platform", value: DEFAULT_PLATFORM_SETTINGS }).onConflictDoNothing();
  console.log("bootstrap complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
