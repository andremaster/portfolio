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

/** Barras com metal escovado: faixas claras e escuras alternadas, borda fina para definição. */
function Bars({ id }: { id: string }) {
  return (
    <>
      <defs>
        {/* cilindro metálico: atravessa o lado curto de cada barra */}
        <linearGradient id={`${id}-v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9aa5b0" /><stop offset=".28" stopColor="#ffffff" /><stop offset=".5" stopColor="#c9d1d8" />
          <stop offset=".78" stopColor="#5f6973" /><stop offset="1" stopColor="#b7c0c9" />
        </linearGradient>
        <linearGradient id={`${id}-h`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa5b0" /><stop offset=".28" stopColor="#ffffff" /><stop offset=".5" stopColor="#c9d1d8" />
          <stop offset=".78" stopColor="#5f6973" /><stop offset="1" stopColor="#b7c0c9" />
        </linearGradient>
      </defs>
      {BARS.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="2.956"
          fill={`url(#${id}-${b.h > b.w ? "h" : "v"})`} stroke="rgba(0,0,0,.35)" strokeWidth=".5" />
      ))}
    </>
  );
}

/** Símbolo livre (cromado). */
export function LogoSymbol({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-symbol">
      <Bars id={`nx${size}`} />
    </svg>
  );
}

/** Ícone de app: squircle grafite com o símbolo cromado. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      <rect width="64" height="64" rx="16" fill="#141a21" stroke="rgba(255,255,255,.12)" />
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
