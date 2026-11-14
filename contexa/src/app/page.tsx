import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata = {
  title: "Contexa · A camada de contexto governada para IA nas empresas",
  description: "Organize documentos, código, MDs, APIs e decisões dos seus projetos. Agentes de IA respondem com fontes e respeitam quem pode ver o quê — inclusive terceiros.",
};

const PAINS = [
  ["Semanas de onboarding", "Cada dev novo ou fornecedor exige reuniões para reexplicar arquitetura, regras e decisões antigas."],
  ["Conhecimento espalhado", "Wikis, SharePoint, READMEs, ADRs, Figma e a cabeça de 2 ou 3 pessoas. Ninguém sabe o que está atualizado."],
  ["IA sem governança", "Times colam documentos internos em ChatGPT e Copilot sem controle de acesso, sem fonte e sem auditoria."],
  ["Terceiros no escuro ou com acesso demais", "Ou o parceiro não tem contexto, ou recebe acesso a tudo. Não existe meio-termo seguro."],
];

const STEPS = [
  ["1", "Conecte o conhecimento", "Envie PDFs, DOCX, Markdown (README, ADR, CLAUDE.md, AGENTS.md), código, especificações OpenAPI e URLs. Integrações com repositórios e SharePoint no roadmap."],
  ["2", "Organize por projeto e acesso", "Cada projeto tem sua base, seus agentes e sua equipe. Defina quem é admin, colaborador, leitor ou externo e libere fonte por fonte para terceiros."],
  ["3", "Agentes especializados", "Arquiteto, Copiloto de Desenvolvimento, Onboarding e Analista de Dados prontos para usar, ou crie os seus com prompt e escopo próprios."],
  ["4", "Respostas com fonte e auditoria", "Cada resposta mostra os documentos e trechos usados e o nível de relevância. Tudo fica registrado para governança."],
];

const AUDIENCES = [
  ["Desenvolvedores", "\"Como implemento uma nova rota seguindo o padrão?\" A resposta vem com o passo a passo e o documento de referência."],
  ["Empresas terceirizadas", "Contexto completo no primeiro dia, vendo apenas o que foi liberado no contrato."],
  ["Times de dados", "Lakehouse, pipelines, camadas Bronze/Silver/Gold e regras de negócio explicadas sob demanda."],
  ["Gestão e produto", "Entenda o que já foi construído, quais decisões foram tomadas e por quê, sem abrir um ticket."],
  ["Segurança e compliance", "Isolamento por empresa, permissões no banco de dados, trilha de auditoria e dados na sua nuvem."],
];

const SECURITY = [
  "Isolamento por empresa e por projeto com Row Level Security no banco",
  "A IA só lê os trechos que a pessoa pode ver: a permissão é aplicada dentro da busca",
  "Terceiros com escopo de fontes liberado individualmente",
  "Sem fonte, sem resposta: o agente avisa quando não encontra, em vez de inventar",
  "Proteção contra prompt injection vinda de documentos",
  "Arquivos em armazenamento privado com links temporários",
  "Auditoria de convites, permissões, fontes, agentes e consultas",
  "Compatível com Azure OpenAI no seu tenant (dados não treinam modelos)",
];

const PLANS = [
  {
    name: "Starter", price: "R$ 1.490", period: "/mês", tag: "Para validar com um time",
    items: ["Até 3 projetos", "Até 15 usuários", "5 GB de conhecimento", "4 agentes padrão + 3 personalizados", "2.000 consultas/mês", "Usuários externos com escopo", "Suporte por e-mail"],
    cta: "Começar teste grátis", href: "/signup",
  },
  {
    name: "Business", price: "R$ 4.900", period: "/mês", tag: "Mais escolhido", featured: true,
    items: ["Até 15 projetos", "Até 75 usuários", "50 GB de conhecimento", "Agentes ilimitados", "15.000 consultas/mês", "Auditoria completa e exportação", "Escolha do modelo (OpenAI ou Azure)", "Suporte prioritário"],
    cta: "Começar teste grátis", href: "/signup",
  },
  {
    name: "Enterprise", price: "Sob consulta", period: "", tag: "Para operação crítica",
    items: ["Projetos e usuários sob medida", "Implantação no seu Azure (tenant próprio)", "SSO Microsoft Entra ID*", "Integrações GitHub, Azure DevOps, SharePoint, Fabric*", "SLA e DPA/LGPD", "Gerente de sucesso dedicado"],
    cta: "Falar com a Autyma", href: "mailto:contato@autyma.com.br?subject=Contexa%20Enterprise",
  },
];

const FAQ = [
  ["Meus dados são usados para treinar a IA?", "Não. Usamos APIs corporativas da OpenAI e do Azure OpenAI, que não treinam modelos com os seus dados. No plano Enterprise, o modelo roda no seu próprio tenant Azure."],
  ["O que é RAG e por que importa?", "RAG (Retrieval-Augmented Generation) faz a IA consultar os documentos do seu projeto antes de responder. Ela responde com base no que é real e mostra de onde tirou cada informação."],
  ["Um terceiro pode ver documentos que não deveria?", "Não. O controle é feito dentro do banco de dados: se a fonte não foi liberada para aquela pessoa, ela não aparece na lista nem é usada pela IA nas respostas para ela."],
  ["Preciso reorganizar toda a documentação antes?", "Não. Comece com o que existe, como READMEs, ADRs, PDFs e páginas da wiki. O painel de saúde do conhecimento mostra o que falta e o que deu erro."],
  ["Quanto tempo leva a implantação?", "O autoatendimento fica pronto em minutos. A implantação assistida pela Autyma, com curadoria de conteúdo, agentes e permissões, leva de 2 a 4 semanas."],
];

export default function Landing() {
  return (
    <div className="landing">
      <nav className="lp-nav">
        <Brand />
        <div className="row lp-links">
          <a href="#como-funciona" className="hide-sm">Como funciona</a>
          <a href="#seguranca" className="hide-sm">Segurança</a>
          <a href="#precos" className="hide-sm">Preços</a>
          <Link className="btn btn-ghost" style={{ color: "#fff" }} href="/login">Entrar</Link>
          <Link className="btn btn-primary" href="/signup">Teste grátis</Link>
        </div>
      </nav>

      <section className="hero">
        <span className="pill">● Contexto governado para IA</span>
        <h1>A IA da sua empresa, com o contexto certo, para a pessoa certa.</h1>
        <p>O Contexa organiza documentos, código, MDs, APIs e decisões dos seus projetos e entrega esse contexto a agentes de IA, com fontes, permissões e auditoria. Times internos e terceiros ficam produtivos desde o primeiro dia, com segurança.</p>
        <div className="row row-wrap" style={{ justifyContent: "center" }}>
          <Link className="btn btn-primary" href="/signup">Testar grátis por 14 dias</Link>
          <a className="btn lp-ghost" href="#como-funciona">Ver como funciona</a>
        </div>
        <div className="lp-demo" aria-hidden>
          <div className="lp-q">Como implemento uma nova rota de API no projeto Atlas?</div>
          <div className="lp-a">
            Siga o padrão do projeto [1]: crie o schema zod em <code>src/schemas</code>, o handler em <code>src/routes</code> com testes, registre no OpenAPI e adicione o evento de auditoria. A autenticação usa token do Entra ID [2].
            <div className="lp-src"><span>[1] Padrões de desenvolvimento · 82%</span><span>[2] API de atendimento · 64%</span></div>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <h2 className="lp-title">O problema que toda empresa com IA já sente</h2>
        <div className="lp-grid-4">
          {PAINS.map(([t, d]) => <div className="feature" key={t}><h3>{t}</h3><p>{d}</p></div>)}
        </div>
      </section>

      <section className="lp-section" id="como-funciona">
        <h2 className="lp-title">Como funciona</h2>
        <div className="lp-grid-4">
          {STEPS.map(([n, t, d]) => (
            <div className="feature" key={n}><span className="lp-num">{n}</span><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2 className="lp-title">Mais do que um chat com documentos</h2>
        <div className="lp-grid-3">
          <div className="feature"><h3>Conhecimento por projeto</h3><p>Cada projeto é um espaço isolado, com categorias (arquitetura, desenvolvimento, dados, negócio) e agentes que consultam só o escopo definido.</p></div>
          <div className="feature"><h3>Saúde do conhecimento</h3><p>Veja o que foi indexado, o que falhou e quais áreas estão sem documentação antes que alguém precise delas.</p></div>
          <div className="feature"><h3>Agentes com papel claro</h3><p>Arquiteto, Copiloto, Onboarding e Analista de Dados, cada um com prompt, modelo, temperatura e escopo próprios.</p></div>
          <div className="feature"><h3>Feito para Markdown e código</h3><p>READMEs, ADRs, CLAUDE.md, AGENTS.md, OpenAPI e código-fonte entram como fontes de primeira classe, com títulos e seções preservados.</p></div>
          <div className="feature"><h3>Terceiros com escopo</h3><p>Libere fonte por fonte para cada fornecedor. Ao fim do contrato, remova o acesso com um clique, com tudo auditado.</p></div>
          <div className="feature"><h3>Desktop e celular</h3><p>Consulte os agentes de qualquer lugar, com uma interface mobile pensada para uso rápido.</p></div>
        </div>
      </section>

      <section className="lp-section">
        <h2 className="lp-title">Para cada área envolvida</h2>
        <div className="lp-grid-5">
          {AUDIENCES.map(([t, d]) => <div className="feature" key={t}><h3>{t}</h3><p>{d}</p></div>)}
        </div>
      </section>

      <section className="lp-section" id="seguranca">
        <div className="lp-split">
          <div>
            <h2 className="lp-title" style={{ textAlign: "left" }}>Segurança e governança desde a fundação</h2>
            <p className="lp-lead">A permissão não é um filtro na tela: ela é aplicada no banco de dados, inclusive na busca que alimenta a IA. Se a pessoa não pode ver, a IA não usa.</p>
          </div>
          <ul className="lp-checks">{SECURITY.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </section>

      <section className="lp-section">
        <h2 className="lp-title">No roadmap</h2>
        <div className="lp-grid-3">
          <div className="feature"><span className="pill">Em breve</span><h3>Contexto dentro da IDE (MCP)</h3><p>O mesmo contexto governado dentro do Copilot, Claude Code ou Cursor de cada dev e de cada terceiro, com as mesmas permissões.</p></div>
          <div className="feature"><span className="pill">Em breve</span><h3>Grafo de conhecimento</h3><p>Sistemas, APIs, tabelas e decisões ligados entre si, para responder “o que quebra se eu mudar isto?”.</p></div>
          <div className="feature"><span className="pill">Em breve</span><h3>Sincronização contínua</h3><p>GitHub, Azure DevOps, SharePoint e Fabric sempre atualizados, com alerta de documentação desatualizada.</p></div>
        </div>
      </section>

      <section className="lp-section" id="precos">
        <h2 className="lp-title">Planos</h2>
        <p className="lp-lead" style={{ textAlign: "center", margin: "0 auto 28px" }}>14 dias grátis em qualquer plano, sem cartão. Valores mensais por organização.</p>
        <div className="lp-plans">
          {PLANS.map((p) => (
            <div className={`lp-plan ${p.featured ? "featured" : ""}`} key={p.name}>
              <span className="pill">{p.tag}</span>
              <h3>{p.name}</h3>
              <div className="lp-price">{p.price}<small>{p.period}</small></div>
              <ul className="lp-checks">{p.items.map((i) => <li key={i}>{i}</li>)}</ul>
              <a className={`btn btn-block ${p.featured ? "btn-primary" : "lp-ghost"}`} href={p.href}>{p.cta}</a>
            </div>
          ))}
        </div>
        <div className="feature" style={{ maxWidth: 900, margin: "20px auto 0" }}>
          <h3>Implantação assistida pela Autyma: a partir de R$ 15.000 (pagamento único)</h3>
          <p>Diagnóstico das fontes, curadoria e organização do conhecimento, configuração dos agentes e das permissões, treinamento das equipes e plano de governança de IA. Em 2 a 4 semanas.</p>
        </div>
        <p className="small" style={{ textAlign: "center", color: "#8c90b3", marginTop: 14 }}>* Recursos do roadmap, entregues conforme o cronograma do contrato Enterprise.</p>
      </section>

      <section className="lp-section">
        <h2 className="lp-title">Perguntas frequentes</h2>
        <div className="lp-faq">
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
      </section>

      <section className="hero" style={{ paddingTop: 20, paddingBottom: 80 }}>
        <h2 className="lp-title">Pronto para dar contexto à IA da sua empresa?</h2>
        <div className="row row-wrap" style={{ justifyContent: "center" }}>
          <Link className="btn btn-primary" href="/signup">Criar conta grátis</Link>
          <a className="btn lp-ghost" href="mailto:contato@autyma.com.br?subject=Demonstra%C3%A7%C3%A3o%20Contexa">Agendar demonstração</a>
        </div>
      </section>

      <footer className="small" style={{ textAlign: "center", padding: "0 16px 32px", color: "#8c90b3" }}>
        © {new Date().getFullYear()} Autyma · Dados, desenvolvimento e IA
      </footer>
    </div>
  );
}
