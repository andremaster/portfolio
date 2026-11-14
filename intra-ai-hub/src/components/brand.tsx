export function Brand({ sub = "by Autyma" }: { sub?: string }) {
  return (
    <div className="brand">
      <div className="brand-mark">A</div>
      <div><b>Intra AI Hub</b><small>{sub}</small></div>
    </div>
  );
}
