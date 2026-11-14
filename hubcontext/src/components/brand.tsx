export function Brand({ sub = "by Autyma" }: { sub?: string }) {
  return (
    <div className="brand">
      <div className="brand-mark">H</div>
      <div><b>HubContext</b><small>{sub}</small></div>
    </div>
  );
}
