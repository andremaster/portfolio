export function Brand({ sub = "by Autyma" }: { sub?: string }) {
  return (
    <div className="brand">
      <div className="brand-mark">C</div>
      <div><b>Contexa</b><small>{sub}</small></div>
    </div>
  );
}
