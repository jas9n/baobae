import { NextResponse } from "next/server";
import {
  createAdminCookieValue,
  isValidAdminPassword,
} from "@/lib/admin-auth";
import { ADMIN_COOKIE_NAME } from "@/lib/constants";

interface AuthBody {
  password?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AuthBody;

    if (!body.password || !isValidAdminPassword(body.password)) {
      return NextResponse.json(
        { error: "The admin password is incorrect." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE_NAME, createAdminCookieValue(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12
    });

    return response;
  } catch (error) {
    console.error("Admin password login failed", error);
    return NextResponse.json(
      { error: "Unable to log in right now." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
