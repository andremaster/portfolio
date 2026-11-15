import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getInvite } from "@/app/actions/invites";
import { Brand } from "@/components/brand";
import { functionLabel, FUNCTIONS, type MemberFunction } from "@/lib/functions";
import { billingLabel } from "@/services/ai/billing";
import { roleLabel } from "@/lib/format";
import { AcceptForm } from "./form";

export const metadata = { title: "Convite" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const inv = await getInvite(code);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle() : { data: null };
  const next = `/convite/${code}`;
  const areas = (inv?.allowed_functions?.length ? inv.allowed_functions : FUNCTIONS) as MemberFunction[];

  return (
    <div className="auth-wrap">
      <aside className="auth-art">
        <Brand />
        <div style={{ display: "grid", gap: 14 }}>
          <span className="eyebrow">Convite para projeto</span>
          <h2>{inv ? inv.project.name : "Convite"}</h2>
          {inv && <p>Você foi convidado por <b style={{ color: "#fff" }}>{inv.project.organization.name}</b> para participar deste projeto no Nexo.</p>}
        </div>
        <small style={{ color: "var(--muted)" }}>Nexo · Autyma</small>
      </aside>
      <main className="auth-form">
        <div className="card" style={{ width: "min(460px, 100%)" }}>
          {!inv || inv.expired ? (
            <div className="form">
              <h1>Convite indisponível</h1>
              <p className="muted">Este link expirou, atingiu o limite de usos ou foi desativado. Peça um novo link ao dono do projeto.</p>
            </div>
          ) : !user ? (
            <div className="form">
              <div><h1>Entrar no projeto</h1><p className="muted">Crie sua conta ou entre para aceitar o convite de <b>{inv.project.organization.name}</b>.</p></div>
              <InviteFacts inv={inv} />
              <Link className="btn btn-primary btn-block" href={`/signup?next=${encodeURIComponent(next)}`}>Criar conta</Link>
              <Link className="btn btn-block" href={`/login?next=${encodeURIComponent(next)}`}>Já tenho conta · Entrar</Link>
            </div>
          ) : (
            <div className="form">
              <div><h1>Quase lá</h1><p className="muted">Conte quem você é neste projeto. Você entra como <b>{profile?.email ?? user.email}</b>.</p></div>
              <InviteFacts inv={inv} />
              <AcceptForm code={code} name={profile?.full_name ?? ""} areas={areas.map((a) => [a, functionLabel[a]])} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function InviteFacts({ inv }: { inv: NonNullable<Awaited<ReturnType<typeof getInvite>>> }) {
  return (
    <div className="subcard small" style={{ gap: 6 }}>
      <div><b>Permissão:</b> {roleLabel[inv.role]}{inv.is_external ? " · terceiro (vê só as fontes liberadas)" : ""}</div>
      <div><b>IA:</b> {billingLabel[inv.billingMode]}{inv.billingMode === "member" ? " — você vai conectar a sua IA depois de entrar." : ""}</div>
      {inv.requires_approval && <div><b>Aprovação:</b> o dono do projeto confirma a sua entrada.</div>}
    </div>
  );
}
