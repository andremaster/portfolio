/**
 * Marca do Nexo — "Convergência Radial": quatro barras arredondadas apontam para o centro
 * sem se tocar (várias IAs e fontes convergindo em um único projeto).
 * - Fundo escuro (o site): cinza chumbo com o mesmo degradê metálico das letras do título.
 * - Fundo claro: azul-marinho #111827 liso (arquivo public/nexo-logo.svg).
 */
const BARS = [
  { x: 27.4, y: 6, w: 9.2, h: 20.45, dir: "up" },       // cima
  { x: 27.4, y: 37.55, w: 9.2, h: 20.45, dir: "down" }, // baixo
  { x: 6, y: 27.4, w: 20.45, h: 9.2, dir: "left" },     // esquerda
  { x: 37.55, y: 27.4, w: 20.45, h: 9.2, dir: "right" },// direita
];

export const LOGO_INK = "#111827";

function Bars({ id, tone }: { id: string; tone: "chumbo" | "ink" }) {
  return (
    <>
      {tone === "chumbo" && (
        <defs>
          {/* mesmo degradê do texto .grad-text (claro no alto → chumbo no meio → claro embaixo) */}
          <linearGradient id={`${id}-c`} x1="0" y1="6" x2="0" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f4f6f8" /><stop offset=".38" stopColor="#c3cbd3" />
            <stop offset=".62" stopColor="#6e7984" /><stop offset="1" stopColor="#d9dfe5" />
          </linearGradient>
        </defs>
      )}
      {BARS.map((b, i) => (
        <rect key={i} className={`nx-bar nx-${b.dir}`} x={b.x} y={b.y} width={b.w} height={b.h} rx="2.95"
          fill={tone === "chumbo" ? `url(#${id}-c)` : LOGO_INK} />
      ))}
    </>
  );
}

/** Símbolo livre. Padrão: cinza chumbo metálico (fundos escuros). */
export function LogoSymbol({ size = 30, tone = "chumbo", animated = false }: { size?: number; tone?: "chumbo" | "ink"; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={`logo-symbol${animated ? " logo-anim" : ""}`}>
      <Bars id={`nx-${tone}-${size}`} tone={tone} />
    </svg>
  );
}

/** Ícone de app: quadrado branco com o símbolo azul-marinho (como a arte oficial). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      <rect width="64" height="64" rx="16" fill="#ffffff" />
      <g transform="translate(6.4 6.4) scale(.8)"><Bars id={`nxm${size}`} tone="ink" /></g>
    </svg>
  );
}

export function Brand({ sub = "by Autyma" }: { sub?: string }) {
  return (
    <div className="brand">
      <LogoSymbol size={30} />
      <div><b>Nexo</b><small>{sub}</small></div>
    </div>
  );
}
