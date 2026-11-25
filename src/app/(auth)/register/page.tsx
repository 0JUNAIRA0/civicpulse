import type { Metadata } from "next";
import { getSettings } from "@/server/services/settings";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const s = await getSettings();
  if (!s.allowCitizenRegistration) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Registration is closed</h1>
        <p className="mt-2 text-muted">New citizen sign-ups are temporarily disabled. Contact {s.supportEmail}.</p>
      </div>
    );
  }
  return <RegisterForm city={s.cityName} />;
}
