export function riskPolicy(input) {
  if (/ignore previous|prompt injection/i.test(String(input))) throw new Error("prompt injection blocked");
  return input;
}
