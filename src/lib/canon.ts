// Canonical JSON and sha256, byte-compatible with the hashing the Pactmark
// contract and the independent Python verifier use:
//   json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeys(record[key])])
    );
  }
  return value;
}

function ensureAscii(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    if (code > 127) {
      if (code > 0xffff) {
        const high = 0xd800 + ((code - 0x10000) >> 10);
        const low = 0xdc00 + ((code - 0x10000) & 0x3ff);
        out += "\\u" + high.toString(16).padStart(4, "0");
        out += "\\u" + low.toString(16).padStart(4, "0");
      } else {
        out += "\\u" + code.toString(16).padStart(4, "0");
      }
    } else {
      out += ch;
    }
  }
  return out;
}

export function canon(value: unknown): string {
  return ensureAscii(JSON.stringify(sortKeys(value)));
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
