import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const accessToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const auth = await authorizeAdmin(request, accessToken);

  return NextResponse.json({
    authorized: auth.authorized,
    method: auth.method,
    email: auth.email
  });
}
