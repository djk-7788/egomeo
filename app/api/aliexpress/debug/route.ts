import { NextResponse } from "next/server";

export async function GET() {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;

  return NextResponse.json({
    APP_KEY_set: !!appKey,
    APP_KEY_length: appKey?.length ?? 0,
    APP_KEY_preview: appKey ? appKey.slice(0, 4) + "****" : "(없음)",
    APP_SECRET_set: !!appSecret,
    APP_SECRET_length: appSecret?.length ?? 0,
    NODE_ENV: process.env.NODE_ENV,
  });
}
