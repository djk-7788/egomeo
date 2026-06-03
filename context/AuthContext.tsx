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
    // 초기 세션 로드 — 실패해도 반드시 loading=false로 끝남
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          const p = await fetchProfile(u);
          setProfile(p);
        }
      } catch (err) {
        console.error("[AuthProvider] 초기 세션 처리 실패:", err);
      } finally {
        setProfileLoaded(true);
        setLoading(false);
      }
    }).catch((err) => {
      // getSession 자체가 실패한 경우
      console.error("[AuthProvider] getSession 실패:", err);
      setProfileLoaded(true);
      setLoading(false);
    });

    // 로그인/로그아웃 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          const u = session?.user ?? null;
          setUser(u);
          if (u) {
            setProfileLoaded(false);
            const p = await fetchProfile(u);
            setProfile(p);
          } else {
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

  // signOut은 profiles 조회 실패와 완전히 독립적으로 동작
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[signOut 실패]", err);
      // 실패해도 로컬 상태 초기화
      setUser(null);
      setProfile(null);
      setProfileLoaded(true);
    }
  };

  // profiles 테이블에 upsert하고 로컬 상태 즉시 반영
  const updateProfile = async (data: Partial<Profile>): Promise<{ error: string | null }> => {
    if (!user) return { error: "로그인이 필요합니다." };

    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        ...data,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("[updateProfile 실패]", error.message);
        return { error: error.message };
      }

      setProfile((prev) => ({
        nickname: null,
        avatar_url: null,
        ...prev,
        ...data,
      }));
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
