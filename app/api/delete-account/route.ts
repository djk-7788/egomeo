import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[탈퇴 실패] SUPABASE_SERVICE_ROLE_KEY 미설정");
    return NextResponse.json({ error: "서버 설정 오류입니다." }, { status: 500 });
  }

  // 브라우저 클라이언트 대신 서비스 롤 클라이언트로 JWT 검증
  // (서버 환경에서 브라우저 전용 supabase 클라이언트는 getUser가 실패할 수 있음)
  const admin = getSupabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    console.error("[탈퇴 인증 실패]", authError?.message);
    return NextResponse.json({ error: "인증에 실패했습니다." }, { status: 401 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("[탈퇴 실패]", deleteError.message);
    return NextResponse.json({ error: "탈퇴 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
