import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const response = await fetch("http://localhost:8080/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
      cache: "no-store",
    });

    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return NextResponse.json(
      { error: "Cannot connect to the DJ service. Start the backend with npm run dev:server." },
      { status: 503 }
    );
  }
}