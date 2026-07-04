export function generateId(): string {
  // crypto.randomUUID() only exists in a secure context (HTTPS or localhost).
  // On a plain-HTTP LAN address — e.g. a phone hitting http://192.168.x.x:5173 —
  // it's undefined and throws, which silently breaks "save". Fall back when absent.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
