"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import LoginModal from "@/components/LoginModal";

export type Profile = {
  nickname: string | null;
  avatar_url: string | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  profileLoaded: boolean;
  openLoginModal: () => void;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  profile: null,
  profileLoaded: false,
  openLoginModal: () => {},
  signOut: async () => {},
  updateProfile: async () => ({ error: null }),
});

// profiles 조회 실패 시 항상 OAuth 폴백 반환 — 절대 throw하지 않음
async function fetchProfile(user: User): Promise<Profile> {
  const meta = user.user_metadata ?? {};
  const oauthFallback: Profile = {
    nickname: meta.name ?? meta.full_name ?? null,
    avatar_url: meta.avatar_url ?? meta.picture ?? null,
  };

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("nickname, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("[fetchProfile] profiles 조회 실패, OAuth 폴백 사용:", error.message);
      return oauthFallback;
    }

    return {
      nickname: data?.nickname ?? oauthFallback.nickname,
      avatar_url: data?.avatar_url ?? oauthFallback.avatar_url,
    };
  } catch (err) {
    console.warn("[fetchProfile] 예외 발생, OAuth 폴백 사용:", err);
    return oauthFallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // getSession()을 별도로 호출하지 않음.
    // onAuthStateChange가 구독 직후 INITIAL_SESSION 이벤트를 발생시켜
    // 현재 세션 상태를 전달해 주므로, 두 경로를 함께 쓰면 경쟁 조건이 생김.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          const u = session?.user ?? null;

          // SIGNED_OUT이 아닌데 session이 null이면 일시적 세션 불안정 → 무시
          // user/profile을 null로 바꾸지 않아 아이콘 깜빡임 방지
          if (!u && event !== "SIGNED_OUT") return;

          setUser(u);

          if (u) {
            // TOKEN_REFRESHED: 토큰만 바뀐 것, 프로필 변경 없음 → 재조회 스킵
            if (event === "TOKEN_REFRESHED") {
              return; // finally는 항상 실행됨
            }
            // SIGNED_IN, INITIAL_SESSION 등 실제 인증 이벤트에서만 profiles 조회
            setProfileLoaded(false);
            const p = await fetchProfile(u);
            setProfile(p);
          } else {
            // SIGNED_OUT: 상태 초기화
            setProfile(null);
          }
        } catch (err) {
          console.error("[AuthProvider] onAuthStateChange 처리 실패:", err);
        } finally {
          setProfileLoaded(true);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // 로컬 상태를 onAuthStateChange 없이 즉시 초기화
    // → 로그아웃 버튼 클릭 즉시 화면 반응, profileLoaded 갇힘 방지
    setUser(null);
    setProfile(null);
    setProfileLoaded(true);
    setLoading(false);

    // 서버 세션 취소는 백그라운드 처리 (실패해도 로컬 상태는 이미 초기화됨)
    supabase.auth.signOut().catch((err) => {
      console.error("[signOut 서버 오류]", err);
    });
  };

  // 낙관적 업데이트: 로컬 상태를 먼저 반영하고, 그 다음 DB upsert
  // DB 성공/실패 무관하게 로컬 상태는 항상 업데이트됨
  const updateProfile = async (data: Partial<Profile>): Promise<{ error: string | null }> => {
    if (!user) return { error: "로그인이 필요합니다." };

    // 1) 로컬 상태 즉시 반영 (낙관적 업데이트)
    setProfile((prev) => ({
      nickname: prev?.nickname ?? null,
      avatar_url: prev?.avatar_url ?? null,
      ...data,
    }));

    // 2) DB upsert (실패해도 로컬 상태는 유지)
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        ...data,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("[updateProfile DB 실패]", error.message);
        return { error: error.message };
      }

      return { error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      console.error("[updateProfile 예외]", msg);
      return { error: msg };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profile,
        profileLoaded,
        openLoginModal: () => setModalOpen(true),
        signOut,
        updateProfile,
      }}
    >
      {children}
      {modalOpen && <LoginModal onClose={() => setModalOpen(false)} />}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
