// Country flag as an emoji (regional indicator symbols).
// Replaces flagcdn.com images — zero external requests, in line with the
// site's no-third-party privacy promise, and no CSP img-src exception needed.

export default function Flag({
  code,
  className = "",
}: {
  code: string;
  className?: string;
}) {
  const cc = (code || "").toUpperCase().slice(0, 2);
  const emoji =
    cc.length === 2
      ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)))
      : "🌐";
  return (
    <span className={`leading-none select-none ${className}`} role="img" aria-label={`${cc} flag`}>
      {emoji}
    </span>
  );
}
