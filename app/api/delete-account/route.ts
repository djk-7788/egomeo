import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "인증에 실패했습니다." }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[탈퇴 실패] SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.");
    return NextResponse.json(
      { error: "서버 설정 오류입니다. 관리자에게 문의해주세요." },
      { status: 500 }
    );
  }

  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[탈퇴 실패]", error.message);
    return NextResponse.json({ error: "탈퇴 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
