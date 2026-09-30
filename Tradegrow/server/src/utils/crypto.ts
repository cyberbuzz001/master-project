import crypto from 'crypto';

export function cryptoRandomString(length: number = 16): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

export function generateUUID(): string {
  return crypto.randomUUID();
}
