import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    buildId: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  });
}
