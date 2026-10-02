import { NextResponse } from "next/server";

export async function GET() {
  const token = "demo-xsrf-token-" + Math.random().toString(36).substring(2);
  const response = new NextResponse(null, { status: 204 });
  
  response.cookies.set("XSRF-TOKEN", token, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false, // Must be readable by JavaScript as per Sanctum convention
  });

  return response;
}
