"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type LikesContextType = {
  likedIds: Set<string>;
  toggleLike: (productId: string) => Promise<void>;
};

const LikesContext = createContext<LikesContextType>({
  likedIds: new Set(),
  toggleLike: async () => {},
});

export function LikesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // ref로 toggleLike 클로저 내에서 최신값 참조
  const likedIdsRef = useRef<Set<string>>(new Set());
  likedIdsRef.current = likedIds;

  // 로그인 상태 변경 시 찜 목록 로드 / 초기화
  useEffect(() => {
    if (!user) {
      setLikedIds(new Set());
      return;
    }
    supabase
      .from("likes")
      .select("product_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          setLikedIds(new Set(data.map((row) => row.product_id as string)));
        }
      });
  }, [user]);

  const toggleLike = useCallback(
    async (productId: string) => {
      if (!user) return;
      const isLiked = likedIdsRef.current.has(productId);

      // 낙관적 업데이트
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.delete(productId);
        else next.add(productId);
        return next;
      });

      if (isLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        // 실패 시 롤백
        if (error) {
          setLikedIds((prev) => {
            const next = new Set(prev);
            next.add(productId);
            return next;
          });
        }
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ user_id: user.id, product_id: productId });
        // 실패 시 롤백
        if (error) {
          setLikedIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
        }
      }
    },
    [user]
  );

  return (
    <LikesContext.Provider value={{ likedIds, toggleLike }}>
      {children}
    </LikesContext.Provider>
  );
}

export const useLikes = () => useContext(LikesContext);
