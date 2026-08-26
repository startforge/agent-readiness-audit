export const VERSION = "1.1.0";
export const RULE_VERSION = "1.1.0";

export const PROFILES = ["core", "rag", "workflow", "skill", "browser"];

export const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".data",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".turbo",
  ".cache",
  ".venv",
  "venv",
  "__pycache__",
  ".tox",
  "vendor",
  "out",
]);

export const SECRET_FILE_NAMES = new Set([".env", "agent.config.json"]);
export const SECRET_FILE_PATTERN = /(^|\/)\.env(\.|$)|(^|\/)id_rsa$|\.(pem|key|p12|pfx)$|credentials|secrets?\.json/i;

export const ALLOWED_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|py|json|ya?ml|yml|toml|sh|md|jsonl|docx|pdf)$/i;
export const MAX_FILE_BYTES = 512 * 1024;

export const HIGH_VALUE_DOCS = /(^|\/)(README(\.md)?|AGENTS\.md|CLAUDE\.md|SKILL\.md)$/i;
export const ADR_DOCS = /(^|\/)(docs\/|adr\/|docs\/adr\/)/i;

export const CORE_HIGH_IDS = ["R-01", "R-02", "R-03", "T-01", "O-03", "E-01", "S-01"];
export const CORE_CRITICAL_IDS = ["T-02", "T-03"];
