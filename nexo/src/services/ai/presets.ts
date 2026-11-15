/** Provedores compatíveis com a API da OpenAI. Seguro para o navegador (sem segredos). */
export type ProviderId = "gemini" | "openai" | "anthropic" | "deepseek" | "moonshot" | "groq" | "openrouter" | "custom";

export type Preset = {
  id: ProviderId;
  name: string;
  baseURL: string;
  chatModel: string;
  embedModel: string | null; // null = não oferece embeddings
  keyUrl: string | null;
  note: string;
};

export const PRESETS: Preset[] = [
  { id: "gemini", name: "Google Gemini", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    chatModel: "gemini-flash-latest", embedModel: "gemini-embedding-001", keyUrl: "https://aistudio.google.com/apikey",
    note: "Tem plano gratuito (com limites). Chat e embeddings com a mesma chave." },
  { id: "openai", name: "OpenAI (ChatGPT)", baseURL: "https://api.openai.com/v1",
    chatModel: "gpt-4o-mini", embedModel: "text-embedding-3-small", keyUrl: "https://platform.openai.com/api-keys",
    note: "Chat e embeddings com a mesma chave." },
  { id: "anthropic", name: "Anthropic (Claude)", baseURL: "https://api.anthropic.com/v1/",
    chatModel: "claude-haiku-5-5", embedModel: null, keyUrl: "https://console.anthropic.com/settings/keys",
    note: "Só chat. Para a busca nos documentos, conecte Gemini ou OpenAI em “Embeddings”." },
  { id: "deepseek", name: "DeepSeek", baseURL: "https://api.deepseek.com",
    chatModel: "deepseek-chat", embedModel: null, keyUrl: "https://platform.deepseek.com/api_keys",
    note: "Só chat, muito barato. Use Gemini ou OpenAI para embeddings." },
  { id: "moonshot", name: "Moonshot (Kimi)", baseURL: "https://api.moonshot.ai/v1",
    chatModel: "kimi-k3.1-pro", embedModel: null, keyUrl: "https://platform.moonshot.ai/console/api-keys",
    note: "Só chat. Use Gemini ou OpenAI para embeddings." },
  { id: "groq", name: "Groq", baseURL: "https://api.groq.com/openai/v1",
    chatModel: "llama-3.3-70b-versatile", embedModel: null, keyUrl: "https://console.groq.com/keys",
    note: "Só chat, muito rápido, tem plano gratuito." },
  { id: "openrouter", name: "OpenRouter", baseURL: "https://openrouter.ai/api/v1",
    chatModel: "openai/gpt-4o-mini", embedModel: "openai/text-embedding-3-small", keyUrl: "https://openrouter.ai/keys",
    note: "Uma chave para centenas de modelos." },
  { id: "custom", name: "Outro (compatível com OpenAI)", baseURL: "",
    chatModel: "", embedModel: "", keyUrl: null,
    note: "Ollama, LM Studio, Azure, vLLM… informe o endereço /v1 e o modelo." },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1];

export const EMBEDDING_DIMENSIONS = 1536;
