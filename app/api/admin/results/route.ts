import { NextResponse } from "next/server";
import { authorizeAdmin, unauthorizedResponse } from "@/lib/admin-auth";
import { fetchAdminResults } from "@/lib/server-data";

export async function GET(request: Request) {
  const accessToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const auth = await authorizeAdmin(request, accessToken);

  if (!auth.authorized) {
    return unauthorizedResponse();
  }

  try {
    const data = await fetchAdminResults();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin results lookup failed", error);
    return NextResponse.json(
      { error: "Unable to load admin results." },
      { status: 500 }
    );
  }
}

