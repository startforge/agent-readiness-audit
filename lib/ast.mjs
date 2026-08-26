const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "function", "return", "typeof", "new", "await", "void", "yield", "with", "do"]);

export function offsetToLine(text, offset) {
  let line = 1;
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text[index] === "\n") line += 1;
  }
  return line;
}

export function stripJsComments(text) {
  let out = "";
  let index = 0;
  const length = text.length;
  while (index < length) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "/" && next === "/") {
      out += "  ";
      index += 2;
      while (index < length && text[index] !== "\n") {
        out += " ";
        index += 1;
      }
      continue;
    }
    if (char === "/" && next === "*") {
      out += "  ";
      index += 2;
      while (index < length && !(text[index] === "*" && text[index + 1] === "/")) {
        out += text[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      if (index < length) {
        out += "  ";
        index += 2;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      const quote = char;
      out += char;
      index += 1;
      while (index < length && text[index] !== quote) {
        if (text[index] === "\\") {
          out += text[index] + (text[index + 1] ?? "");
          index += 2;
          continue;
        }
        out += text[index];
        index += 1;
      }
      if (index < length) {
        out += text[index];
        index += 1;
      }
      continue;
    }
    if (char === "`") {
      out += char;
      index += 1;
      while (index < length && text[index] !== "`") {
        if (text[index] === "\\") {
          out += text[index] + (text[index + 1] ?? "");
          index += 2;
          continue;
        }
        out += text[index];
        index += 1;
      }
      if (index < length) {
        out += text[index];
        index += 1;
      }
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

function skipBalanced(text, start, open, close) {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === open) depth += 1;
    else if (text[index] === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function skipWs(text, index) {
  while (index < text.length && /\s/.test(text[index])) index += 1;
  return index;
}

export function extractCalls(body) {
  const calls = [];
  const pattern = /\b((?:[A-Za-z_$][\w$]*\s*\.\s*)*[A-Za-z_$][\w$]*)\s*\(/g;
  let match;
  while ((match = pattern.exec(body))) {
    const callee = match[1].replace(/\s+/g, "");
    const name = callee.split(".").pop();
    if (KEYWORDS.has(name)) continue;
    calls.push({ name, callee, index: match.index });
  }
  return calls;
}

function pushFunction(functions, { name, start, end, src, original, exported }) {
  const body = src.slice(start, end);
  functions.push({
    name,
    start,
    end,
    startLine: offsetToLine(original, start),
    body,
    calls: extractCalls(body),
    exported: Boolean(exported),
  });
}

function collectJsFunctions(src, original) {
  const functions = [];
  const functionHead = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = functionHead.exec(src))) {
    let cursor = skipWs(src, match.index + match[0].length);
    if (src[cursor] === "<") {
      const genericEnd = skipBalanced(src, cursor, "<", ">");
      if (genericEnd < 0) continue;
      cursor = skipWs(src, genericEnd + 1);
    }
    if (src[cursor] !== "(") continue;
    const argsEnd = skipBalanced(src, cursor, "(", ")");
    if (argsEnd < 0) continue;
    cursor = skipWs(src, argsEnd + 1);
    if (src[cursor] === ":") {
      cursor = skipWs(src, cursor + 1);
      while (cursor < src.length && src[cursor] !== "{") cursor += 1;
    }
    if (src[cursor] !== "{") continue;
    const end = skipBalanced(src, cursor, "{", "}");
    if (end < 0) continue;
    pushFunction(functions, {
      name: match[1],
      start: match.index,
      end: end + 1,
      src,
      original,
      exported: /export\s/.test(match[0]),
    });
  }

  const arrowHead =
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g;
  while ((match = arrowHead.exec(src))) {
    const brace = match.index + match[0].length - 1;
    const end = skipBalanced(src, brace, "{", "}");
    if (end < 0) continue;
    pushFunction(functions, {
      name: match[1],
      start: match.index,
      end: end + 1,
      src,
      original,
      exported: /export\s/.test(match[0]),
    });
  }

  return functions;
}

function stripPyComments(text) {
  return text
    .split(/\n/)
    .map((line) => {
      const hash = line.indexOf("#");
      if (hash < 0) return line;
      let inString = false;
      let quote = "";
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (!inString && (char === "'" || char === '"')) {
          inString = true;
          quote = char;
        } else if (inString && char === quote && line[index - 1] !== "\\") {
          inString = false;
        } else if (!inString && char === "#") {
          return line.slice(0, index).padEnd(line.length, " ");
        }
      }
      return line;
    })
    .join("\n");
}

function extractPyCalls(body) {
  const calls = [];
  const pattern = /\b([A-Za-z_][\w]*)\s*\(/g;
  let match;
  while ((match = pattern.exec(body))) {
    if (["if", "for", "while", "with", "lambda", "def", "class", "elif", "return", "not", "and", "or"].includes(match[1])) continue;
    calls.push({ name: match[1], callee: match[1], index: match.index });
  }
  return calls;
}

function collectPyFunctions(text) {
  const src = stripPyComments(text);
  const lines = src.split(/\n/);
  const functions = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^( *)(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/.exec(lines[index]);
    if (!match) continue;
    const indent = match[1].length;
    let end = index + 1;
    while (end < lines.length) {
      if (lines[end].trim() === "") {
        end += 1;
        continue;
      }
      const lead = /^( *)/.exec(lines[end])[1].length;
      if (lead <= indent) break;
      end += 1;
    }
    const body = lines.slice(index, end).join("\n");
    functions.push({
      name: match[2],
      startLine: index + 1,
      body,
      calls: extractPyCalls(body),
      exported: true,
    });
    index = end - 1;
  }
  return functions;
}

export function parseModule(file) {
  if (file.language === "py") {
    return { language: "py", functions: collectPyFunctions(file.text), file: file.relative };
  }
  if (["js", "ts", "tsx"].includes(file.language)) {
    const src = stripJsComments(file.text);
    return { language: file.language, functions: collectJsFunctions(src, file.text), file: file.relative };
  }
  return { language: file.language, functions: [], file: file.relative };
}
