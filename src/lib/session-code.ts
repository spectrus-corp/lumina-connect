// Code de session : LUM-XXXX-XXXX (sans 0/O/1/I pour éviter la confusion)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateSessionCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `LUM-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
}

export function normalizeCode(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.startsWith("LUM") && cleaned.length >= 11) {
    return `LUM-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
  }
  if (cleaned.length === 8) {
    return `LUM-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
  }
  return input.toUpperCase();
}

export function isValidCode(code: string): boolean {
  return /^LUM-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}