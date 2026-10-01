import { NextResponse } from "next/server";
import { exchangeFyersAuthCode } from "@/lib/fyers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authCode = url.searchParams.get("auth_code");
  const s = url.searchParams.get("s");

  if (!authCode) {
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <title>Fyers Authorization - Expert Stocks</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #05070B; color: #F5F7FA; display: grid; place-items: center; height: 100vh; margin: 0; }
    .card { background: #0B111A; border: 1px solid #1C2734; padding: 2.5rem 2rem; border-radius: 1rem; max-width: 480px; text-align: center; }
    .badge { background: #3B82F620; color: #60A5FA; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase; }
    h2 { margin: 1rem 0 0.5rem; font-size: 1.25rem; font-weight: 700; color: #FFFFFF; }
    p { color: #9AA7B5; font-size: 0.875rem; line-height: 1.5; margin-bottom: 1.5rem; }
    .btn { background: #00E599; color: #000000; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 700; text-decoration: none; display: inline-block; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">OAuth Flow</span>
    <h2>Connect Fyers Live Feed</h2>
    <p>This is the callback listener endpoint. To connect your Fyers live market feed, click below to sign in with your Fyers credentials:</p>
    <a class="btn" href="/api/v1/auth/fyers/login">Authorize Fyers Account →</a>
  </div>
</body>
</html>`,
      {
        headers: { "Content-Type": "text/html" },
      }
    );
  }

  const result = await exchangeFyersAuthCode(authCode);

  if (result.success) {
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <title>Fyers Connected - Expert Stocks</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #05070B; color: #F5F7FA; display: grid; place-items: center; height: 100vh; margin: 0; }
    .card { background: #0B111A; border: 1px solid #1C2734; padding: 2rem; border-radius: 1rem; max-width: 480px; text-align: center; }
    .badge { background: #22C55E20; color: #22C55E; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; }
    a { color: #43D9FF; text-decoration: none; font-weight: bold; margin-top: 1rem; display: inline-block; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Connected</span>
    <h2>Fyers Live Market Data Activated</h2>
    <p style="color: #9AA7B5; font-size: 0.875rem;">Your 24-hour access token and rolling refresh token have been stored securely. Real-time market data is now streaming to Expert Stocks.</p>
    <a href="/">Return to Homepage →</a>
  </div>
</body>
</html>`,
      {
        headers: { "Content-Type": "text/html" },
      }
    );
  }

  return NextResponse.json(
    {
      success: false,
      message: "Failed exchanging auth code for access token.",
      detail: result.message,
    },
    { status: 500 }
  );
}
