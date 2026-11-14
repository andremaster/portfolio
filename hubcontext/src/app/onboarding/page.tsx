import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { Brand } from "@/components/brand";
import { OnboardingForm } from "./form";

export const maxDuration = 60;

export default async function Onboarding() {
  const ctx = await getContext();
  if (ctx.org) redirect("/dashboard");
  return (
    <main className="auth-form" style={{ minHeight: "100dvh" }}>
      <div className="card" style={{ width: "min(480px, 100%)" }}>
        <div style={{ background: "var(--side)", borderRadius: 12, padding: "12px 8px 0", marginBottom: 18 }}><Brand /></div>
        <OnboardingForm name={ctx.profile?.full_name ?? ""} />
      </div>
    </main>
  );
}
