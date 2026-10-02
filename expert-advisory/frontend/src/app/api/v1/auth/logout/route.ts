import { NextResponse, type NextRequest } from "next/server";

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    data: { message: "Logged out successfully." },
  });

  response.cookies.delete("esc_session");
  response.cookies.delete("XSRF-TOKEN");
  return response;
}
