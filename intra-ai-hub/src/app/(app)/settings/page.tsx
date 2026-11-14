import { requireOrg } from "@/lib/context";
import { roleLabel } from "@/lib/format";
import { signOut } from "@/app/actions/auth";
import { ProfileForm } from "./form";

export const metadata = { title: "Meu perfil" };

export default async function Settings() {
  const ctx = await requireOrg();
  return (
    <>
      <div className="page-head"><div><h1>Meu perfil</h1><p className="muted">{ctx.user.email}</p></div></div>
      <section className="card" style={{ maxWidth: 560 }}>
        <ProfileForm name={ctx.profile?.full_name ?? ""} />
      </section>
      <section className="card small" style={{ maxWidth: 560, display: "grid", gap: 6 }}>
        <div><b>Organização:</b> {ctx.org.name} ({roleLabel[ctx.org.role]})</div>
        <div><b>Plano:</b> {ctx.org.plan}</div>
        {ctx.project && <div><b>Projeto ativo:</b> {ctx.project.name} — {ctx.role ? roleLabel[ctx.role] : ""}{ctx.isExternal ? " (externo)" : ""}</div>}
      </section>
      <form action={signOut} className="mobile-only"><button className="btn btn-block btn-danger">Sair</button></form>
    </>
  );
}
