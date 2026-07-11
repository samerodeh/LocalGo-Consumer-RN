import * as Crypto from 'expo-crypto';

/**
 * Local password hashing. The SwiftUI app uses PBKDF2-HMAC-SHA256 (100k iterations)
 * via CryptoKit; expo-crypto exposes SHA-256 digests but not PBKDF2, so this uses a
 * salted, iterated SHA-256 chain — same shape (salt + slow hash), suitable for the
 * on-device demo store. Swap for a real KDF (e.g. a native PBKDF2/argon2 module) if
 * this ever talks to a shared backend.
 */
const ITERATIONS = 15000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSalt(): string {
  return toHex(Crypto.getRandomBytes(16));
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  let digest = `${salt}:${password}`;
  for (let i = 0; i < ITERATIONS; i++) {
    digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      digest,
    );
  }
  return digest;
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const actual = await hashPassword(password, salt);
  return actual === expectedHash;
}
