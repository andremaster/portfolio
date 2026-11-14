import Link from "next/link";
import { requireOrg } from "@/lib/context";
import { signOut } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { BottomNav, ProjectSwitcher, SideNav } from "@/components/nav";
import { initials, roleLabel } from "@/lib/format";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  const name = ctx.profile?.full_name ?? ctx.user.email ?? "";
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand sub={ctx.org.name} />
        <SideNav isExternal={ctx.isExternal} />
        <div className="side-foot">
          <div className="side-user">
            <div className="avatar">{initials(name)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="ellipsis" style={{ color: "#fff" }}>{name}</div>
              <small style={{ color: "#8c90b3" }}>{ctx.role ? roleLabel[ctx.role] : "Sem projeto"}{ctx.isExternal ? " · Externo" : ""}</small>
            </div>
          </div>
          <form action={signOut}><button className="nav-link" style={{ width: "100%", background: "none", border: 0, cursor: "pointer", color: "inherit" }}><Icon name="logout" /> Sair</button></form>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Link href="/dashboard" className="mobile-only"><div className="brand-mark" style={{ width: 30, height: 30, fontSize: ".85rem" }}>A</div></Link>
          <ProjectSwitcher projects={ctx.projects} current={ctx.project?.id} />
          {ctx.isExternal && <span className="badge badge-warn">Acesso externo</span>}
          <div className="grow" />
          <Link href="/chat" className="btn btn-primary btn-sm desktop-only"><Icon name="chat" size={16} /> Perguntar</Link>
          <Link href="/settings" className="avatar mobile-only" aria-label="Perfil">{initials(name)}</Link>
        </header>
        <main className="content">{children}</main>
      </div>
      <BottomNav isExternal={ctx.isExternal} />
    </div>
  );
}
