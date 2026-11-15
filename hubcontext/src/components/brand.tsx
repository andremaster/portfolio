/** Marca do HubContext: hexágono (o hub) com um "H" feito de nós conectados (o contexto). */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      <defs>
        <linearGradient id="hc-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b7bff" /><stop offset=".55" stopColor="#5b8cff" /><stop offset="1" stopColor="#22e1c3" />
        </linearGradient>
        <radialGradient id="hc-c" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#22e1c3" /></radialGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#0a0c1a" />
      <path d="M32 7.5 53.2 19.75v24.5L32 56.5 10.8 44.25v-24.5Z" fill="none" stroke="url(#hc-g)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M23 21v22M41 21v22M23 32h18" stroke="url(#hc-g)" strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="23" cy="21" r="3" fill="#8b7bff" /><circle cx="41" cy="21" r="3" fill="#5b8cff" />
      <circle cx="23" cy="43" r="3" fill="#5b8cff" /><circle cx="41" cy="43" r="3" fill="#22e1c3" />
      <circle cx="32" cy="32" r="4.6" fill="url(#hc-c)" className="logo-core" />
    </svg>
  );
}

export function Brand({ sub = "by Autyma" }: { sub?: string }) {
  return (
    <div className="brand">
      <LogoMark />
      <div><b>Hub<span className="grad-text">Context</span></b><small>{sub}</small></div>
    </div>
  );
}
