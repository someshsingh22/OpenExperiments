/**
 * Serialize an object for safe embedding inside a
 * `<script type="application/ld+json">` element.
 *
 * `JSON.stringify` alone does NOT escape `<`, `>`, `&`, or the U+2028/U+2029
 * line/paragraph separators. Without escaping, user-controlled string fields
 * (e.g. a hypothesis statement containing `</script>`) can break out of the
 * script element and execute arbitrary JavaScript (stored XSS). We escape
 * those characters using their Unicode escape sequences, which remain valid
 * inside a JSON string and render identically once parsed.
 */
export function serializeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
