// Country flag rendered from self-hosted SVGs (flag-icons package, bundled
// at build time — zero third-party requests, works on every OS including
// Windows where emoji flags don't render).
// CSS is imported once in app/layout.tsx: "flag-icons/css/flag-icons.min.css"

export default function Flag({
  code,
  className = "",
}: {
  code: string;
  className?: string;
}) {
  const cc = (code || "").toLowerCase().slice(0, 2);
  if (!/^[a-z]{2}$/.test(cc)) {
    return (
      <span className={`leading-none select-none ${className}`} role="img" aria-label="Global">
        🌐
      </span>
    );
  }
  return (
    <span
      className={`fi fi-${cc} rounded-sm ${className}`}
      role="img"
      aria-label={`${cc.toUpperCase()} flag`}
      style={{ backgroundSize: "cover" }}
    />
  );
}
