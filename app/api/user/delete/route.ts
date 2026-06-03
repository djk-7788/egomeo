import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[회원 탈퇴 실패]", error);
    return NextResponse.json({ error: "탈퇴 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
