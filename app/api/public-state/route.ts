import { NextResponse } from "next/server";
import { fetchPublicState } from "@/lib/server-data";

export async function GET() {
  try {
    const data = await fetchPublicState();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch public state", error);
    return NextResponse.json(
      { error: "Unable to load event state." },
      { status: 500 }
    );
  }
}

