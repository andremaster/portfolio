import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-art">
        <Brand />
        <div style={{ display: "grid", gap: 14 }}>
          <h2>A memória técnica dos seus projetos de IA.</h2>
          <p style={{ color: "#b9bcdc", maxWidth: 420 }}>Arquitetura, decisões, padrões e APIs — respondidos por agentes que citam as fontes e respeitam as permissões de cada pessoa.</p>
        </div>
        <small style={{ color: "#8c90b3" }}>Autyma · Dados, desenvolvimento e IA</small>
      </aside>
      <main className="auth-form">{children}</main>
    </div>
  );
}
