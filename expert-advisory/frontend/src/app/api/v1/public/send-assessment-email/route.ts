import { NextResponse } from "next/server";

// Never issue certificates from anonymous, caller-supplied scores or identities.
export function POST() {
  return NextResponse.json({ success: false, message: "Please request your verified assessment report through the client support desk." }, { status: 410 });
}
