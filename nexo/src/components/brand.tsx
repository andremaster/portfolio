/**
 * Marca do Nexo — "Convergência Radial": quatro barras arredondadas apontam para o centro
 * sem se tocar (várias IAs e fontes convergindo em um único projeto). Geometria do SVG oficial
 * (nexo-logo.svg), acabamento cromado sobre grafite.
 */
const BARS = [
  { x: 28.305, y: 6, w: 7.39, h: 21.05 },     // cima
  { x: 28.305, y: 36.95, w: 7.39, h: 21.05 }, // baixo
  { x: 6, y: 28.305, w: 21.05, h: 7.39 },     // esquerda
  { x: 36.95, y: 28.305, w: 21.05, h: 7.39 }, // direita
];

/** Logo oficial (nexo-logo.svg): barras lisas em azul #1D4ED8. */
const BLUE = "#1D4ED8";
function Bars({ id: _id }: { id: string }) {
  return (
    <>
      {BARS.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="2.956" fill={BLUE} />)}
    </>
  );
}

/** Símbolo livre (azul). */
export function LogoSymbol({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-symbol">
      <Bars id={`nx${size}`} />
    </svg>
  );
}

/** Ícone de app: squircle branco com o símbolo azul (como a arte oficial). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      <rect width="64" height="64" rx="16" fill="#ffffff" />
      <g transform="translate(9.6 9.6) scale(.7)"><Bars id={`nxm${size}`} /></g>
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
