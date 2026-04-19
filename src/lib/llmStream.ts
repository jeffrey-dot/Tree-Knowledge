export interface LlmStreamEvent {
  request_id: string;
  operation: string;
  stage: "start" | "delta" | "done" | "error" | string;
  content: string | null;
  error: string | null;
}

export interface LlmGenerationPreview {
  raw: string;
  title: string | null;
  summary: string | null;
  body: string | null;
}

export interface LlmCandidatePreviewItem {
  title: string | null;
  summary: string | null;
  relationType: string | null;
  mode: string | null;
  whyThisBranch: string | null;
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

export function isLlmStreamEvent(payload: unknown): payload is LlmStreamEvent {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate.request_id === "string" &&
    typeof candidate.operation === "string" &&
    typeof candidate.stage === "string" &&
    isStringOrNull(candidate.content) &&
    isStringOrNull(candidate.error)
  );
}

export function parseLlmGenerationPreview(raw: string): LlmGenerationPreview {
  return {
    raw,
    title: extractJsonField(raw, "title"),
    summary: extractJsonField(raw, "summary"),
    body: extractJsonField(raw, "body"),
  };
}

export function parseLlmCandidatesPreview(raw: string): LlmCandidatePreviewItem[] {
  const titles = extractJsonFieldMatches(raw, "title");
  const summaries = extractJsonFieldMatches(raw, "summary");
  const relationTypes = extractJsonFieldMatches(raw, "relation_type");
  const modes = extractJsonFieldMatches(raw, "mode");
  const whyThisBranches = extractJsonFieldMatches(raw, "why_this_branch");
  const count = Math.max(
    titles.length,
    summaries.length,
    relationTypes.length,
    modes.length,
    whyThisBranches.length,
  );

  return Array.from({ length: count }, (_, index) => ({
    title: titles[index] ?? null,
    summary: summaries[index] ?? null,
    relationType: relationTypes[index] ?? null,
    mode: modes[index] ?? null,
    whyThisBranch: whyThisBranches[index] ?? null,
  })).filter((candidate) => Boolean(candidate.title || candidate.summary));
}

function extractJsonField(source: string, key: string): string | null {
  const fieldStart = findFieldValueStart(source, key);
  if (fieldStart === null) {
    return null;
  }

  const rawValue: string[] = [];
  let cursor = fieldStart;
  let isEscaped = false;

  while (cursor < source.length) {
    const current = source[cursor];

    if (!isEscaped) {
      if (current === "\"") {
        return decodeJsonStringFragment(rawValue.join(""));
      }

      if (current === "\\") {
        isEscaped = true;
        rawValue.push(current);
        cursor += 1;
        continue;
      }

      rawValue.push(current);
      cursor += 1;
      continue;
    }

    rawValue.push(current);
    isEscaped = false;
    cursor += 1;
  }

  return decodeJsonStringFragment(rawValue.join(""));
}

function extractJsonFieldMatches(source: string, key: string): string[] {
  const values: string[] = [];
  let searchStart = 0;

  while (searchStart < source.length) {
    const fieldStart = findFieldValueStart(source, key, searchStart);
    if (fieldStart === null) {
      break;
    }

    const value = readJsonStringValue(source, fieldStart);
    if (value === null) {
      break;
    }

    values.push(value.value);
    searchStart = value.nextIndex;
  }

  return values;
}

function findFieldValueStart(source: string, key: string, fromIndex = 0): number | null {
  const keyPattern = `"${key}"`;
  const keyIndex = source.indexOf(keyPattern, fromIndex);

  if (keyIndex === -1) {
    return null;
  }

  let cursor = keyIndex + keyPattern.length;

  while (cursor < source.length && /\s/.test(source[cursor])) {
    cursor += 1;
  }

  if (source[cursor] !== ":") {
    return null;
  }

  cursor += 1;

  while (cursor < source.length && /\s/.test(source[cursor])) {
    cursor += 1;
  }

  if (source[cursor] !== "\"") {
    return null;
  }

  return cursor + 1;
}

function readJsonStringValue(
  source: string,
  startIndex: number,
): { value: string; nextIndex: number } | null {
  const rawValue: string[] = [];
  let cursor = startIndex;
  let isEscaped = false;

  while (cursor < source.length) {
    const current = source[cursor];

    if (!isEscaped) {
      if (current === "\"") {
        return {
          value: decodeJsonStringFragment(rawValue.join("")),
          nextIndex: cursor + 1,
        };
      }

      if (current === "\\") {
        isEscaped = true;
        rawValue.push(current);
        cursor += 1;
        continue;
      }

      rawValue.push(current);
      cursor += 1;
      continue;
    }

    rawValue.push(current);
    isEscaped = false;
    cursor += 1;
  }

  return {
    value: decodeJsonStringFragment(rawValue.join("")),
    nextIndex: source.length,
  };
}

function decodeJsonStringFragment(fragment: string): string {
  const decoded: string[] = [];
  let cursor = 0;

  while (cursor < fragment.length) {
    const current = fragment[cursor];

    if (current !== "\\") {
      decoded.push(current);
      cursor += 1;
      continue;
    }

    const next = fragment[cursor + 1];
    if (next === undefined) {
      break;
    }

    switch (next) {
      case "\"":
      case "\\":
      case "/":
        decoded.push(next);
        cursor += 2;
        break;
      case "b":
        decoded.push("\b");
        cursor += 2;
        break;
      case "f":
        decoded.push("\f");
        cursor += 2;
        break;
      case "n":
        decoded.push("\n");
        cursor += 2;
        break;
      case "r":
        decoded.push("\r");
        cursor += 2;
        break;
      case "t":
        decoded.push("\t");
        cursor += 2;
        break;
      case "u": {
        const unicodeHex = fragment.slice(cursor + 2, cursor + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(unicodeHex)) {
          return decoded.join("");
        }

        decoded.push(String.fromCharCode(Number.parseInt(unicodeHex, 16)));
        cursor += 6;
        break;
      }
      default:
        decoded.push(next);
        cursor += 2;
        break;
    }
  }

  return decoded.join("");
}
