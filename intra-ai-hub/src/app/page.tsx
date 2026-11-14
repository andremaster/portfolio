import Link from "next/link";
import { Brand } from "@/components/brand";

const FEATURES = [
  ["Memória técnica do projeto", "Documentos, código, APIs, diagramas e decisões técnicas indexados e pesquisáveis por IA."],
  ["Agentes especializados", "Arquiteto, Copiloto de Desenvolvimento, Onboarding e Analista de Dados — ou crie os seus."],
  ["Respostas com fontes", "Cada resposta mostra os documentos e trechos usados, com nível de relevância."],
  ["Acesso por perfil", "Administradores, colaboradores, leitores e terceiros com escopo de fontes controlado."],
  ["Isolamento por empresa", "Cada cliente em seu próprio espaço, com Row Level Security no banco."],
  ["Auditoria completa", "Convites, permissões, fontes, agentes e consultas registrados para governança."],
];

export default function Landing() {
  return (
    <div className="landing">
      <nav>
        <Brand />
        <div className="row">
          <Link className="btn btn-ghost" style={{ color: "#fff" }} href="/login">Entrar</Link>
          <Link className="btn btn-primary" href="/signup">Começar grátis</Link>
        </div>
      </nav>
      <section className="hero">
        <span className="pill">● RAG corporativo para times de IA e dados</span>
        <h1>Novos devs e parceiros produtivos no primeiro dia.</h1>
        <p>O Intra AI Hub é a memória técnica dos seus projetos de IA: explica a arquitetura, orienta a implementação e respeita quem pode ver o quê.</p>
        <div className="row row-wrap" style={{ justifyContent: "center" }}>
          <Link className="btn btn-primary" href="/signup">Criar minha conta</Link>
          <Link className="btn" href="/login" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.2)" }}>Já tenho conta</Link>
        </div>
      </section>
      <section className="features">
        {FEATURES.map(([t, d]) => (
          <div className="feature" key={t}><h3>{t}</h3><p>{d}</p></div>
        ))}
      </section>
      <footer className="small" style={{ textAlign: "center", padding: "0 16px 32px", color: "#8c90b3" }}>
        © {new Date().getFullYear()} Autyma · Dados, desenvolvimento e IA
      </footer>
    </div>
  );
}
