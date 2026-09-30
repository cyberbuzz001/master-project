import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { sendTelegramAlert } from './telegramAlert';

// Reference to live FyersAdapter instance — set via setFyersAdapterRef()
let fyersAdapterRef: any = null;

export function setFyersAdapterRef(adapter: any): void {
  fyersAdapterRef = adapter;
}

export function getFyersAdapterRef(): any {
  return fyersAdapterRef;
}

/**
 * Generates the Fyers v3 OAuth Authorization URL
 */
export function generateFyersAuthUrl(appId: string, redirectUri: string, state: string = 'tradegrow_state'): string {
  const cleanAppId = appId || process.env.FYERS_APP_ID || '';
  const cleanRedirectUri = redirectUri || process.env.FYERS_REDIRECT_URI || 'http://localhost:5000/api/v1/auth/fyers/callback';
  return `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${encodeURIComponent(cleanAppId)}&redirect_uri=${encodeURIComponent(cleanRedirectUri)}&response_type=code&state=${encodeURIComponent(state)}`;
}

/**
 * Pure Node.js RFC 6238 TOTP generator
 */
export function generateTOTP(base32Secret: string): string {
  if (!base32Secret) return '';
  const cleanSecret = base32Secret.toUpperCase().replace(/[\s=]/g, '');
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (let i = 0; i < cleanSecret.length; i++) {
    const val = base32Chars.indexOf(cleanSecret[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  const key = Buffer.from(bytes);

  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (binary % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * Automates Fyers OAuth Login using TOTP & PIN to fetch access token
 */
export async function autoGenerateFyersToken(fyId?: string): Promise<{ success: boolean; accessToken?: string; message: string }> {
  const appId = process.env.FYERS_APP_ID || '';
  const appSecret = process.env.FYERS_SECRET_KEY || '';
  const totpSecret = process.env.FYERS_TOTP_SECRET || '';
  const pin = process.env.FYERS_PIN || '';
  const redirectUri = process.env.FYERS_REDIRECT_URI || 'http://localhost:5000/api/v1/auth/fyers/callback';
  const targetFyId = fyId || process.env.FYERS_CLIENT_ID || appId.split('-')[0];

  if (!appId || !appSecret || !totpSecret || !pin) {
    return { success: false, message: 'Missing FYERS_APP_ID, FYERS_SECRET_KEY, FYERS_TOTP_SECRET or FYERS_PIN in environment.' };
  }

  try {
    const totp = generateTOTP(totpSecret);
    console.log(`[FyersAutoLogin] Generated TOTP: ${totp} for Client: ${targetFyId}`);

    // Step 1: send_login_otp
    const sendOtpRes = await fetch('https://api-t2.fyers.in/vagator/v2/send_login_otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fy_id: targetFyId, app_id: '2' })
    });
    const otpData: any = await sendOtpRes.json();

    if (!otpData.request_key) {
      return { success: false, message: `send_login_otp failed: ${otpData.message || JSON.stringify(otpData)}` };
    }

    // Step 2: verify_otp
    const verifyOtpRes = await fetch('https://api-t2.fyers.in/vagator/v2/verify_otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_key: otpData.request_key, otp: totp })
    });
    const verifyOtpData: any = await verifyOtpRes.json();

    if (!verifyOtpData.request_key) {
      return { success: false, message: `verify_otp failed: ${verifyOtpData.message || JSON.stringify(verifyOtpData)}` };
    }

    // Step 3: verify_pin
    const verifyPinRes = await fetch('https://api-t2.fyers.in/vagator/v2/verify_pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_key: verifyOtpData.request_key,
        identity_type: 'pin',
        identifier: pin
      })
    });
    const verifyPinData: any = await verifyPinRes.json();

    const bearerToken = verifyPinData?.data?.token;
    if (!bearerToken) {
      return { success: false, message: `verify_pin failed: ${verifyPinData.message || JSON.stringify(verifyPinData)}` };
    }

    // Step 4: Request auth_code via /token endpoint
    const tokenPayload = {
      fyers_id: targetFyId,
      app_id: appId.split('-')[0],
      redirect_uri: redirectUri,
      appType: appId.includes('-100') ? '100' : '200',
      code_challenge: '',
      state: 'tradegrow_state',
      scope: '',
      nonce: '',
      response_type: 'code',
      create_cookie: true
    };

    const tokenRes = await fetch('https://api-t1.fyers.in/api/v3/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`
      },
      body: JSON.stringify(tokenPayload)
    });
    const tokenData: any = await tokenRes.json();

    const urlStr = tokenData.Url || tokenData.url || '';
    let authCode = tokenData.auth_code;
    if (!authCode && urlStr.includes('auth_code=')) {
      authCode = urlStr.split('auth_code=')[1].split('&')[0];
    }

    if (!authCode) {
      return { success: false, message: `Failed extracting auth_code: ${tokenData.message || JSON.stringify(tokenData)}` };
    }

    // Step 5: Exchange auth_code for access_token
    return await exchangeAuthCodeForToken(authCode, appId, appSecret);
  } catch (err: any) {
    return { success: false, message: `Fyers auto-login error: ${err.message}` };
  }
}

/**
 * Generates the SHA-256 AppIdHash required by Fyers API v3
 * Format: SHA256(app_id + ":" + app_secret)
 */
export function generateAppIdHash(appId: string, appSecret: string): string {
  return crypto.createHash('sha256').update(`${appId}:${appSecret}`).digest('hex');
}

/**
 * Exchanges an authorization auth_code for a 24-hour Access Token via Fyers API v3
 */
export async function exchangeAuthCodeForToken(
  authCode: string,
  appId?: string,
  appSecret?: string
): Promise<{ success: boolean; accessToken?: string; message: string }> {
  const targetAppId = appId || process.env.FYERS_APP_ID || '';
  const targetAppSecret = appSecret || process.env.FYERS_SECRET_KEY || '';

  if (!targetAppId || !targetAppSecret) {
    return { success: false, message: 'FYERS_APP_ID or FYERS_SECRET_KEY is missing in configuration.' };
  }

  const appIdHash = generateAppIdHash(targetAppId, targetAppSecret);

  try {
    const response = await fetch('https://api-t1.fyers.in/api/v3/validate-authcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        appIdHash,
        code: authCode
      })
    });

    const data = await response.json();

    if (data.s === 'ok' && data.access_token) {
      // Hot swap the new token in memory and save to .env
      await updateFyersToken(data.access_token);
      return { success: true, accessToken: data.access_token, message: 'Fyers token generated and updated successfully!' };
    }

    return {
      success: false,
      message: data.message || `Fyers auth validation failed (code ${data.code || response.status})`
    };
  } catch (err: any) {
    return { success: false, message: `Fyers auth validation error: ${err.message}` };
  }
}

/**
 * Hot-swaps the Fyers access token in both:
 *  a) The live FyersAdapter instance (in-memory, immediate effect)
 *  b) The root .env file (persists across server restarts)
 */
export async function updateFyersToken(newToken: string): Promise<{ success: boolean; message: string }> {
  if (!newToken || typeof newToken !== 'string' || newToken.trim().length < 10) {
    return { success: false, message: 'Invalid token format provided.' };
  }

  const cleanToken = newToken.trim();

  // 1. Update the live FyersAdapter instance if running
  if (fyersAdapterRef) {
    try {
      await fyersAdapterRef.setAccessToken(cleanToken);
      console.log('[FyersTokenRefresh] ✅ Token hot-swapped in FyersAdapter. Reconnecting WebSocket...');
    } catch (err) {
      console.error('[FyersTokenRefresh] Failed to update adapter:', err);
    }
  } else {
    console.warn('[FyersTokenRefresh] FyersAdapter reference not set. Token not updated in adapter.');
  }

  // 2. Persist in current process.env
  process.env.FYERS_ACCESS_TOKEN = cleanToken;

  // 3. Write to .env file
  try {
    const envPath = path.resolve(__dirname, '../../../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('FYERS_ACCESS_TOKEN=')) {
        envContent = envContent.replace(/^FYERS_ACCESS_TOKEN=.*$/m, `FYERS_ACCESS_TOKEN=${cleanToken}`);
      } else {
        envContent += `\nFYERS_ACCESS_TOKEN=${cleanToken}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('[FyersTokenRefresh] ✅ Token written to .env file successfully.');
    }
  } catch (err) {
    console.error('[FyersTokenRefresh] Warning: Could not write token to .env file:', err);
  }

  const successMsg = `✅ Fyers token updated successfully!`;
  console.log(`[FyersTokenRefresh] ${successMsg}`);

  // Send Telegram notification
  sendTelegramAlert(
    `🔑 <b>Trade Grow — Fyers Token Updated</b>\n\n` +
    `Live market data streaming from Fyers API v3 is active.`
  ).catch(() => {});

  return { success: true, message: successMsg };
}
