import type { Metadata, Viewport } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: { default: "Nexo · Autyma", template: "%s · Nexo" },
  description: "A memória técnica dos seus projetos de IA. Agentes especializados com RAG, controle de acesso e fontes rastreáveis — usando a IA que a sua empresa já tem.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: "#0b0f14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
