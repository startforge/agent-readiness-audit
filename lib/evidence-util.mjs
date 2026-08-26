export function isComment(line, language) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*") || trimmed.startsWith("<!--")) return true;
  if ((language === "js" || language === "ts" || language === "tsx") && trimmed.startsWith("/*")) return true;
  return false;
}

export function redactSnippet(snippet) {
  return snippet
    .replace(/sk-[A-Za-z0-9]+/g, "sk-[REDACTED]")
    .replace(/Bearer\s+[\w.-]+/gi, "Bearer [REDACTED]")
    .replace(/api[_-]?key["\s:=]+["']?[\w-]+/gi, "api_key=[REDACTED]")
    .replace(/(password|secret|token)["\s:=]+["']?[\w-]+/gi, "$1=[REDACTED]")
    .slice(0, 200);
}
