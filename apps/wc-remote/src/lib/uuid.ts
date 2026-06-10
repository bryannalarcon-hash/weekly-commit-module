// apps/wc-remote/src/lib/uuid.ts — safeRandomUUID(): RFC4122 v4 ids that survive non-secure contexts.
// crypto.randomUUID exists only in secure contexts (https/localhost); the live demo serves over plain
// http://<ip>/, so fall back to deriving v4 from crypto.getRandomValues (available everywhere) with
// the version (0100) and variant (10xx) bits set per the spec.

/** A v4 UUID via crypto.randomUUID when present, else built from crypto.getRandomValues. */
export function safeRandomUUID(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();

  const bytes = c.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10xx (RFC4122)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
