import { redirect } from "next/navigation";
import { requirePageUser } from "@/server/auth";
import { ROLE_HOME } from "@/lib/constants";

export default async function DashboardRedirect() {
  const user = await requirePageUser();
  redirect(ROLE_HOME[user.role]);
}
