import { createClient } from "@supabase/supabase-js";

// 빌드 타임이 아닌 런타임에 생성 (SUPABASE_SERVICE_ROLE_KEY는 런타임 env var)
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
