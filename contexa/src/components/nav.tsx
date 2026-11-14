"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon, type IconName } from "./icons";
import { selectProject } from "@/app/actions/projects";

const NAV: { href: string; label: string; short: string; icon: IconName; mobile?: boolean; internal?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", short: "Início", icon: "dashboard", mobile: true },
  { href: "/knowledge", label: "Base de conhecimento", short: "Base", icon: "book", mobile: true },
  { href: "/chat", label: "Chat com agentes", short: "Chat", icon: "chat", mobile: true },
  { href: "/agents", label: "Agentes", short: "Agentes", icon: "bot", mobile: true },
  { href: "/team", label: "Equipe e acessos", short: "Equipe", icon: "users", mobile: true, internal: true },
  { href: "/projects", label: "Projetos", short: "Projetos", icon: "folder" },
  { href: "/integrations", label: "Integrações", short: "Integrações", icon: "plug", internal: true },
  { href: "/settings", label: "Meu perfil", short: "Perfil", icon: "settings" },
];

export function SideNav({ isExternal }: { isExternal: boolean }) {
  const path = usePathname();
  return (
    <nav style={{ display: "grid", gap: 2 }}>
      {NAV.filter((n) => !(isExternal && n.internal)).map((n) => (
        <Link key={n.href} href={n.href} className={`nav-link ${path.startsWith(n.href) ? "active" : ""}`}>
          <Icon name={n.icon} /> {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ isExternal }: { isExternal: boolean }) {
  const path = usePathname();
  const items = NAV.filter((n) => n.mobile && !(isExternal && n.internal));
  if (isExternal) items.push(NAV.find((n) => n.href === "/settings")!);
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {items.map((n) => (
        <Link key={n.href} href={n.href} className={path.startsWith(n.href) ? "active" : ""}>
          <Icon name={n.icon} size={22} /> {n.short}
        </Link>
      ))}
    </nav>
  );
}

export function ProjectSwitcher({ projects, current }: { projects: { id: string; name: string }[]; current?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (projects.length === 0) return <Link href="/projects" className="btn btn-sm">Criar projeto</Link>;
  return (
    <label className="project-switch">
      <span className="sr-only">Projeto ativo</span>
      <select value={current} disabled={pending} onChange={(e) => start(async () => { await selectProject(e.target.value); router.refresh(); })}>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  );
}
