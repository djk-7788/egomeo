"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/";

    // Supabase SDK가 URL의 code 파라미터를 자동으로 감지해 PKCE 교환 처리
    // getSession() 이후 세션이 있으면 즉시 리다이렉트
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace(next);
      }
    });

    // 교환이 아직 처리 중이면 SIGNED_IN 이벤트로 캐치
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        router.replace(next);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-gray-400 text-sm">로그인 처리 중...</p>
    </div>
  );
}
