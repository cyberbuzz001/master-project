import crypto from "crypto";
import fs from "fs";
import path from "path";

export interface FyersQuoteItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
  high?: string;
  low?: string;
  volume?: string;
}

const TOKENS_CACHE_PATH =
  process.env.VERCEL || process.env.NODE_ENV === "production"
    ? path.join("/tmp", ".fyers-tokens.json")
    : path.join(process.cwd(), ".fyers-tokens.json");

export function getFyersConfig() {
  return {
    appId: process.env.FYERS_APP_ID || "LKT0BVGMSL-100",
    secretKey: process.env.FYERS_SECRET_KEY || "Z90C8HPDMW",
    clientId: process.env.FYERS_CLIENT_ID || "FAK51333",
    pin: process.env.FYERS_PIN || "9691",
    totpSecret: process.env.FYERS_TOTP_SECRET || "XLDTSOBQPWMJLRBL6ZKYIDXCLVPS3NUO",
    redirectUri: process.env.FYERS_REDIRECT_URI || "https://expertstocks.in/api/v1/auth/fyers/callback",
  };
}

export function getAppIdHash(appId: string, secretKey: string): string {
  return crypto.createHash("sha256").update(`${appId}:${secretKey}`).digest("hex");
}

export interface FyersTokenStore {
  accessToken: string;
  refreshToken?: string;
  updatedAt: number;
}

export function readStoredTokens(): FyersTokenStore | null {
  try {
    if ((globalThis as any).__fyersTokens) {
      return (globalThis as any).__fyersTokens;
    }
    if (fs.existsSync(TOKENS_CACHE_PATH)) {
      const content = fs.readFileSync(TOKENS_CACHE_PATH, "utf-8");
      const parsed = JSON.parse(content);
      (globalThis as any).__fyersTokens = parsed;
      return parsed;
    }
  } catch (_) {}
  return null;
}

export function saveStoredTokens(data: FyersTokenStore): void {
  try {
    (globalThis as any).__fyersTokens = data;
    fs.writeFileSync(TOKENS_CACHE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[Fyers] Failed saving tokens to disk (in-memory preserved):", e);
  }
}

export function generateTOTP(base32Secret: string): string {
  if (!base32Secret) return "";
  const cleanSecret = base32Secret.toUpperCase().replace(/[\s=]/g, "");
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (let i = 0; i < cleanSecret.length; i++) {
    const val = base32Chars.indexOf(cleanSecret[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
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

  const hmac = crypto.createHmac("sha1", key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 1000000).toString().padStart(6, "0");
}

/**
 * Headless TOTP login flow for automated server-side token generation
 */
export async function autoLoginFyers(): Promise<{ success: boolean; message?: string; accessToken?: string }> {
  const config = getFyersConfig();
  const [appIdOnly, appType] = config.appId.split("-");
  const encodeItem = (str: string) => Buffer.from(str).toString("base64");

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  };

  try {
    const otpRes = await fetch("https://api-t2.fyers.in/vagator/v2/send_login_otp_v2", {
      method: "POST",
      headers,
      body: JSON.stringify({
        fy_id: encodeItem(config.clientId),
        app_id: "2",
      }),
    });
    const otpData = await otpRes.json();

    if (!otpData.request_key) {
      return {
        success: false,
        message: otpData.message || "Failed at send_login_otp_v2",
      };
    }

    const totp = generateTOTP(config.totpSecret);
    const verifyOtpRes = await fetch("https://api-t2.fyers.in/vagator/v2/verify_otp", {
      method: "POST",
      headers,
      body: JSON.stringify({
        otp: totp,
        request_key: otpData.request_key,
      }),
    });
    const verifyOtpData = await verifyOtpRes.json();

    if (!verifyOtpData.request_key) {
      return {
        success: false,
        message: verifyOtpData.message || "Failed at verify_otp",
      };
    }

    const verifyPinRes = await fetch("https://api-t2.fyers.in/vagator/v2/verify_pin_v2", {
      method: "POST",
      headers,
      body: JSON.stringify({
        identifier: encodeItem(config.pin),
        identity_type: "pin",
        request_key: verifyOtpData.request_key,
      }),
    });
    const verifyPinData = await verifyPinRes.json();

    const bearerToken = verifyPinData?.data?.access_token || verifyPinData?.data?.token;
    if (!bearerToken) {
      return {
        success: false,
        message: verifyPinData.message || "Failed at verify_pin_v2",
      };
    }

    const tokenRes = await fetch("https://api-t1.fyers.in/api/v3/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        fyers_id: config.clientId,
        app_id: appIdOnly,
        redirect_uri: config.redirectUri,
        appType: appType || "100",
        code_challenge: "",
        state: "expertstocks_state",
        scope: "",
        nonce: "",
        response_type: "code",
        create_cookie: true,
      }),
    });
    const tokenData = await tokenRes.json();

    let authCode = tokenData.auth_code;
    const redirectUrl = tokenData.Url || tokenData.url || "";
    if (!authCode && redirectUrl.includes("auth_code=")) {
      authCode = redirectUrl.split("auth_code=")[1].split("&")[0];
    }

    if (!authCode) {
      return {
        success: false,
        message: "Failed extracting auth_code from token endpoint",
      };
    }

    return await exchangeFyersAuthCode(authCode);
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Exchange auth_code received from Fyers OAuth redirect for Access Token & Refresh Token
 */
export async function exchangeFyersAuthCode(code: string): Promise<{ success: boolean; accessToken?: string; message?: string }> {
  const config = getFyersConfig();
  const appIdHash = getAppIdHash(config.appId, config.secretKey);

  try {
    const res = await fetch("https://api-t1.fyers.in/api/v3/validate-authcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        appIdHash: appIdHash,
        code: code,
      }),
    });

    const data = await res.json();
    if (data.s === "ok" && data.access_token) {
      saveStoredTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        updatedAt: Date.now(),
      });
      return { success: true, accessToken: data.access_token };
    }
    return { success: false, message: data.message || JSON.stringify(data) };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Automatically refresh access token using the stored refresh_token and PIN
 */
export async function refreshFyersAccessToken(): Promise<string | null> {
  const config = getFyersConfig();
  const tokens = readStoredTokens();
  if (!tokens?.refreshToken) return null;

  const appIdHash = getAppIdHash(config.appId, config.secretKey);

  try {
    const res = await fetch("https://api-t1.fyers.in/api/v3/validate-refresh-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        appIdHash: appIdHash,
        refresh_token: tokens.refreshToken,
        pin: config.pin,
      }),
    });

    const data = await res.json();
    if (data.s === "ok" && data.access_token) {
      saveStoredTokens({
        accessToken: data.access_token,
        refreshToken: tokens.refreshToken,
        updatedAt: Date.now(),
      });
      return data.access_token;
    }
  } catch (e) {
    console.error("[Fyers] Error refreshing access token:", e);
  }
  return null;
}

/**
 * Fetch live market quotes for key Indian market indices from Fyers API V3
 */
export async function getLiveMarketQuotes(): Promise<FyersQuoteItem[]> {
  const config = getFyersConfig();
  let tokens = readStoredTokens();
  let token = tokens?.accessToken;

  // Fallback realistic index reference data if off-market or token not yet authorized
  const fallbackQuotes: FyersQuoteItem[] = [
    { symbol: "NIFTY 50", name: "NSE Benchmark", price: "25,418.50", change: "+0.64%", isPositive: true },
    { symbol: "SENSEX", name: "BSE Benchmark", price: "83,184.80", change: "+0.58%", isPositive: true },
    { symbol: "BANK NIFTY", name: "Banking Sector", price: "53,890.15", change: "+0.72%", isPositive: true },
    { symbol: "INDIA VIX", name: "Volatility Index", price: "12.42", change: "-3.25%", isPositive: false },
    { symbol: "NIFTY IT", name: "Technology Sector", price: "42,310.20", change: "+0.88%", isPositive: true },
    { symbol: "NIFTY AUTO", name: "Automobile Sector", price: "26,140.90", change: "+1.16%", isPositive: true },
    { symbol: "GOLD (MCX)", name: "Commodity", price: "₹75,420", change: "+0.35%", isPositive: true },
    { symbol: "CRUDE OIL", name: "MCX Futures", price: "₹6,180", change: "-0.45%", isPositive: false },
  ];

  if (!token) {
    // Try refreshing via refresh_token first
    token = (await refreshFyersAccessToken()) || "";
    // If still no token, attempt automated TOTP login
    if (!token) {
      const autoRes = await autoLoginFyers();
      if (autoRes.success && autoRes.accessToken) {
        token = autoRes.accessToken;
      }
    }
  }

  if (!token) {
    return fallbackQuotes;
  }

  try {
    const symbols = "NSE:NIFTY50-INDEX,BSE:SENSEX-INDEX,NSE:NIFTYBANK-INDEX,NSE:INDIAVIX-INDEX,NSE:NIFTYIT-INDEX,NSE:NIFTYAUTO-INDEX";
    const res = await fetch(`https://api-t1.fyers.in/data/quotes?symbols=${symbols}`, {
      headers: {
        Authorization: `${config.appId}:${token}`,
      },
      next: { revalidate: 15 },
    });

    if (res.status === 401) {
      // Token might be expired, try refreshing
      const freshToken = await refreshFyersAccessToken();
      if (freshToken) {
        return await getLiveMarketQuotes();
      }
      return fallbackQuotes;
    }

    const data = await res.json();
    if (data.s === "ok" && Array.isArray(data.d)) {
      return data.d.map((item: any) => {
        const v = item.v || {};
        const ltp = v.lp ?? 0;
        const change = v.ch ?? 0;
        const changePercent = v.chp ?? 0;
        const isPos = change >= 0;

        let cleanSymbol = item.n || "";
        if (cleanSymbol.includes("NIFTY50")) cleanSymbol = "NIFTY 50";
        else if (cleanSymbol.includes("SENSEX")) cleanSymbol = "SENSEX";
        else if (cleanSymbol.includes("NIFTYBANK")) cleanSymbol = "BANK NIFTY";
        else if (cleanSymbol.includes("INDIAVIX")) cleanSymbol = "INDIA VIX";
        else if (cleanSymbol.includes("NIFTYIT")) cleanSymbol = "NIFTY IT";
        else if (cleanSymbol.includes("NIFTYAUTO")) cleanSymbol = "NIFTY AUTO";

        return {
          symbol: cleanSymbol,
          name: cleanSymbol,
          price: ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          change: `${isPos ? "+" : ""}${changePercent.toFixed(2)}%`,
          isPositive: isPos,
          high: v.high_price?.toLocaleString("en-IN"),
          low: v.low_price?.toLocaleString("en-IN"),
          volume: v.volume?.toLocaleString("en-IN"),
        };
      });
    }
  } catch (err) {
    console.error("[Fyers] Error fetching quotes:", err);
  }

  return fallbackQuotes;
}
