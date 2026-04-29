import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/constants";
import {
  getAdminCookieSecret,
  getAdminEmails,
  getAdminPassword
} from "@/lib/env";
import { createPublicSupabaseServerClient } from "@/lib/supabase-server";

function makeSignature(value: string) {
  return createHmac("sha256", getAdminCookieSecret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function createAdminCookieValue() {
  return makeSignature(getAdminPassword());
}

export function isValidAdminPassword(password: string) {
  return safeEqual(password, getAdminPassword());
}

async function isAllowlistedGoogleAdmin(accessToken: string | null) {
  if (!accessToken) {
    return { authorized: false, email: null as string | null };
  }

  const supabase = createPublicSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser(accessToken);

  const email = user?.email?.toLowerCase() ?? null;

  if (!email) {
    return { authorized: false, email: null };
  }

  return {
    authorized: getAdminEmails().includes(email),
    email
  };
}

export async function authorizeAdmin(request: Request, accessToken?: string | null) {
  const requestCookies = request.headers.get("cookie") ?? "";
  const cookieMatch = requestCookies.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );
  const cookieValue = cookieMatch?.[1];

  if (cookieValue && safeEqual(cookieValue, createAdminCookieValue())) {
    return {
      authorized: true,
      method: "password" as const,
      email: null as string | null
    };
  }

  const bearerToken =
    accessToken ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  const googleAdmin = await isAllowlistedGoogleAdmin(bearerToken);

  if (googleAdmin.authorized) {
    return {
      authorized: true,
      method: "google" as const,
      email: googleAdmin.email
    };
  }

  return {
    authorized: false,
    method: null,
    email: null as string | null
  };
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized admin request." },
    { status: 401 }
  );
}
