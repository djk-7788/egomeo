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

async function fetchProfile(user: User): Promise<Profile> {
  const { data } = await supabase
    .from("profiles")
    .select("nickname, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  // profiles 테이블 값 우선, 없으면 OAuth 메타데이터 폴백
  const meta = user.user_metadata ?? {};
  return {
    nickname: data?.nickname ?? meta.name ?? meta.full_name ?? null,
    avatar_url: data?.avatar_url ?? meta.avatar_url ?? meta.picture ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // 초기 세션 로드
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const p = await fetchProfile(u);
        setProfile(p);
      }
      setProfileLoaded(true);
      setLoading(false);
    });

    // 로그인/로그아웃 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          setProfileLoaded(false);
          const p = await fetchProfile(u);
          setProfile(p);
          setProfileLoaded(true);
        } else {
          setProfile(null);
          setProfileLoaded(true);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // profiles 테이블에 upsert하고 로컬 상태 즉시 반영
  const updateProfile = async (data: Partial<Profile>): Promise<{ error: string | null }> => {
    if (!user) return { error: "로그인이 필요합니다." };

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
