import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { requirePageUser, userPermissions } from "@/server/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { PasswordForm, ProfileForm } from "@/components/profile-forms";

export const metadata: Metadata = { title: "Profile settings" };

export default async function ProfilePage() {
  const user = await requirePageUser();
  const dept = user.departmentId ? await db.query.departments.findFirst({ where: eq(departments.id, user.departmentId) }) : null;
  const perms = userPermissions(user);
  return (
    <>
      <PageHeader title="Profile settings" description="Manage your personal details and password." />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <ProfileForm user={user} />
          <PasswordForm />
        </div>
        <Card className="self-start">
          <CardHeader title="Account" />
          <dl className="space-y-3 p-5 text-sm">
            <div><dt className="text-xs text-muted">Role</dt><dd className="font-medium">{ROLE_LABELS[user.role]}</dd></div>
            {dept && <div><dt className="text-xs text-muted">Department</dt><dd className="font-medium">{dept.name}</dd></div>}
            {user.jobTitle && <div><dt className="text-xs text-muted">Job title</dt><dd className="font-medium">{user.jobTitle}</dd></div>}
            <div>
              <dt className="mb-1 text-xs text-muted">Permissions</dt>
              <dd>
                <ul className="space-y-1">
                  {perms.map((p) => (
                    <li key={p} className="text-xs">✓ {PERMISSIONS[p]}</li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
