/**
 * Integrações desacopladas por adaptador. Cada adaptador lista e baixa conteúdos
 * que viram knowledge_sources. Credenciais ficam no Supabase Vault — nunca em
 * integrations.configuration.
 */
export interface IntegrationAdapter {
  type: string;
  listItems(config: Record<string, unknown>, secret: string): Promise<{ externalId: string; name: string; url?: string }[]>;
  fetchItem(config: Record<string, unknown>, secret: string, externalId: string): Promise<{ name: string; mime: string; bytes: Uint8Array }>;
}

export const INTEGRATIONS = [
  { type: "github", name: "GitHub", description: "Indexa READMEs, docs e código dos repositórios.", available: false },
  { type: "azure_devops", name: "Azure DevOps", description: "Wikis, repositórios e work items.", available: false },
  { type: "sharepoint", name: "SharePoint / OneDrive", description: "Documentos das bibliotecas da empresa.", available: false },
  { type: "fabric", name: "Microsoft Fabric", description: "Metadados de lakehouses, pipelines e modelos semânticos.", available: false },
  { type: "figma", name: "Figma", description: "Descrições de telas e fluxos de design.", available: false },
  { type: "entra_id", name: "Microsoft Entra ID", description: "Login corporativo (SSO) e sincronização de usuários.", available: false },
  { type: "postgres", name: "PostgreSQL", description: "Dicionário de dados e documentação de schemas.", available: false },
  { type: "databox360", name: "Databox360", description: "Indicadores e dashboards.", available: false },
  { type: "custom_api", name: "APIs internas", description: "Especificações OpenAPI publicadas pela equipe.", available: false },
] as const;
