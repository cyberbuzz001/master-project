import crypto from 'crypto';

/**
 * Pure Node.js RFC 6238 TOTP Generator
 * Computes 6-digit TOTP code from base32 secret
 */
export function generateTOTP(secret: string): string {
  // Base32 decode
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  for (let i = 0; i < cleanSecret.length; i++) {
    const val = base32chars.indexOf(cleanSecret.charAt(i));
    if (val !== -1) {
      bits += val.toString(2).padStart(5, '0');
    }
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2);
  }

  // Time step (30 seconds)
  const epoch = Math.floor(Date.now() / 1000);
  const time = Math.floor(epoch / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(time), 0);

  // HMAC-SHA1
  const hmac = crypto.createHmac('sha1', Buffer.from(bytes));
  hmac.update(buffer);
  const hmacResult = hmac.digest();

  // Dynamic truncation
  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = (code % 1000000).toString().padStart(6, '0');
  return otp;
}
