const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function isSafeReturnTo(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\") &&
    !CONTROL_CHARS.test(value)
  );
}

export function decodeSafeReturnTo(value: string | null): string | null {
  if (!value) return null;

  try {
    const decoded = decodeURIComponent(value);
    return isSafeReturnTo(decoded) ? decoded : null;
  } catch {
    return null;
  }
}
