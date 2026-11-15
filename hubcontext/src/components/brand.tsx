/**
 * Marca do Nexo — "Convergência Radial": quatro barras arredondadas apontam para o centro
 * sem se tocar (várias IAs e fontes convergindo em um único projeto). Azul com brilho suave.
 */
const BARS = [
  { x: 27.5, y: 6, w: 9, h: 20 },   // cima
  { x: 27.5, y: 38, w: 9, h: 20 },  // baixo
  { x: 6, y: 27.5, w: 20, h: 9 },   // esquerda
  { x: 38, y: 27.5, w: 20, h: 9 },  // direita
];

function Bars({ id, flat }: { id: string; flat?: boolean }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f7cff" /><stop offset=".55" stopColor="#2453e6" /><stop offset="1" stopColor="#1a3bb8" />
        </linearGradient>
        <linearGradient id={`${id}-h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {BARS.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="3.6" fill={flat ? "#fff" : `url(#${id}-b)`} />
          {!flat && <rect x={b.x + .8} y={b.y + .8} width={b.w - 1.6} height={Math.min(b.h, b.w) * .55} rx="3" fill={`url(#${id}-h)`} />}
        </g>
      ))}
    </>
  );
}

/** Símbolo livre (azul com brilho). */
export function LogoSymbol({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-symbol">
      <Bars id="hcs" />
    </svg>
  );
}

/** Ícone de app: squircle azul-claro com o símbolo. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      <rect width="64" height="64" rx="16" fill="#eef3ff" />
      <g transform="translate(9.6 9.6) scale(.7)"><Bars id="hcm" /></g>
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
