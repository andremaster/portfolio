import Link from "next/link";
import { Icon, type IconName } from "./icons";

export function Empty({ icon, title, text, href, cta }: { icon: IconName; title: string; text: string; href?: string; cta?: string }) {
  return (
    <div className="card empty">
      <div className="type-icon"><Icon name={icon} /></div>
      <h3 style={{ color: "var(--text)" }}>{title}</h3>
      <p>{text}</p>
      {href && cta && <Link className="btn btn-primary" href={href}>{cta}</Link>}
    </div>
  );
}

export function NoProject() {
  return <Empty icon="folder" title="Nenhum projeto disponível" text="Crie um projeto ou peça a um administrador para incluir você." href="/projects" cta="Ver projetos" />;
}
