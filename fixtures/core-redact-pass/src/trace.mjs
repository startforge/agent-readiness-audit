export function redact(value) {
  return String(value).replace(/sk-[A-Za-z0-9]+/g, "[REDACTED]");
}

export function traceRecord(event) {
  return { ...event, message: redact(event.message ?? "") };
}
