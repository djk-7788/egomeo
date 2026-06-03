"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useLikes } from "@/context/LikesContext";
import ProductCard from "@/components/ProductCard";
import type { GridProduct } from "@/components/InfiniteProductGrid";

type LikeRow = {
  product_id: string;
  products: GridProduct | null;
};

export default function MyPage() {
  const { user, loading, signOut } = useAuth();
  const { likedIds } = useLikes();
  const router = useRouter();

  // 찜 상품
  const [likedProducts, setLikedProducts] = useState<GridProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // 닉네임
  const [nickname, setNickname] = useState("");
  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState("");
  const [savingNick, setSavingNick] = useState(false);
  const [nickError, setNickError] = useState("");

  // 아바타
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 회원 탈퇴
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // 비로그인 → 메인으로 리다이렉트
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  // 사용자 메타데이터 동기화
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata ?? {};
    const name = meta.name || meta.full_name || "";
    setNickname(name);
    setNickInput(name);
    setAvatarUrl(meta.avatar_url || null);
  }, [user]);

  // 찜한 상품 로드
  useEffect(() => {
    if (!user) return;
    supabase
      .from("likes")
      .select(
        "product_id, products(id, title, category, image_url, image_urls, video_url, affiliate_link, button_text)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          const rows = data as unknown as LikeRow[];
          const products = rows
            .map((r) => r.products)
            .filter((p): p is GridProduct => p !== null);
          setLikedProducts(products);
        }
        setLoadingProducts(false);
      });
  }, [user]);

  // likedIds가 바뀌면 찜 해제된 상품 즉시 제거
  const visibleProducts = likedProducts.filter((p) => likedIds.has(p.id));

  // 닉네임 저장
  const saveNickname = async () => {
    if (!user) return;
    const trimmed = nickInput.trim().slice(0, 20);
    setSavingNick(true);
    setNickError("");
    const { error } = await supabase.auth.updateUser({
      data: { name: trimmed, full_name: trimmed },
    });
    if (error) {
      setNickError("저장에 실패했습니다. 다시 시도해주세요.");
    } else {
      setNickname(trimmed);
      setEditingNick(false);
    }
    setSavingNick(false);
  };

  // 아바타 업로드 — label의 onChange로 호출됨
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("jpg, png, webp 파일만 업로드 가능합니다.");
      e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("파일 크기는 2MB 이하만 가능합니다.");
      e.target.value = "";
      return;
    }

    setUploadingAvatar(true);
    try {
      // 현재 세션 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAvatarError("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/user/upload-avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        setAvatarError(json.error || "이미지 업로드에 실패했습니다.");
        return;
      }

      // Supabase auth 메타데이터에 avatar_url 저장
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: json.url },
      });

      if (updateError) {
        setAvatarError("프로필 저장에 실패했습니다: " + updateError.message);
        return;
      }

      // 즉시 UI 반영
      setAvatarUrl(json.url);
    } catch (err) {
      setAvatarError("업로드 중 오류가 발생했습니다.");
      console.error("[Avatar upload error]", err);
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  // 로그아웃
  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  // 회원 탈퇴
  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setDeleteError("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
        return;
      }

      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const json = await res.json().catch(() => ({ error: "서버 오류가 발생했습니다." }));

      if (!res.ok) {
        setDeleteError(json.error || "탈퇴 처리에 실패했습니다.");
        return;
      }

      await signOut();
      router.replace("/");
    } catch {
      setDeleteError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !user) return null;

  const displayName = nickname || user.email?.split("@")[0] || "사용자";
  const initial = displayName.trim()[0].toUpperCase();

  return (
    <div className="max-w-screen-xl mx-auto">
      {/* 프로필 섹션 */}
      <div className="max-w-md mx-auto mb-14">
        <h1 className="text-2xl font-black text-[#111111] mb-6">마이페이지</h1>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          {/* 아바타 — label로 file input 직접 트리거 (button + ref.click() 방식 대신) */}
          <div className="flex flex-col items-center gap-2 mb-6">
            <label
              className={`relative w-20 h-20 rounded-full cursor-pointer block ${uploadingAvatar ? "opacity-60 pointer-events-none" : ""}`}
              title="프로필 사진 변경"
            >
              {/* 아바타 이미지 또는 이니셜 */}
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[#F5A623] flex items-center justify-center text-white text-2xl font-bold">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="프로필" className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
              </div>
              {/* 편집 아이콘 뱃지 */}
              <span className="absolute bottom-0 right-0 w-6 h-6 bg-white border-2 border-gray-100 rounded-full flex items-center justify-center text-gray-500 text-xs shadow-sm">
                ✎
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </label>

            {uploadingAvatar && (
              <p className="text-xs text-gray-400">업로드 중...</p>
            )}
            {avatarError && (
              <p className="text-xs text-red-500 text-center">{avatarError}</p>
            )}
            <p className="text-xs text-gray-400">사진 클릭하여 변경</p>
          </div>

          {/* 닉네임 */}
          <div className="mb-4">
            <label className="text-xs text-gray-400 font-medium block mb-1.5">닉네임</label>
            {editingNick ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nickInput}
                    maxLength={20}
                    onChange={(e) => setNickInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveNickname();
                      if (e.key === "Escape") {
                        setNickInput(nickname);
                        setEditingNick(false);
                        setNickError("");
                      }
                    }}
                    autoFocus
                    className="flex-1 border border-[#F5A623] rounded-lg px-3 py-2 text-sm outline-none"
                  />
                  <button
                    onClick={saveNickname}
                    disabled={savingNick}
                    className="text-xs font-bold text-white bg-[#F5A623] px-3 py-2 rounded-lg hover:bg-[#d8921f] transition-colors disabled:opacity-50 shrink-0"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => { setNickInput(nickname); setEditingNick(false); setNickError(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 transition-colors shrink-0"
                  >
                    취소
                  </button>
                </div>
                {nickError && <p className="text-xs text-red-500">{nickError}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-sm text-[#111111]">
                  {nickname || (
                    <span className="text-gray-400 italic">닉네임 없음</span>
                  )}
                </span>
                <button
                  onClick={() => setEditingNick(true)}
                  className="text-xs text-gray-400 hover:text-[#F5A623] transition-colors ml-3 shrink-0"
                >
                  수정
                </button>
              </div>
            )}
          </div>

          {/* 이메일 */}
          {user.email && (
            <div className="mb-6">
              <label className="text-xs text-gray-400 font-medium block mb-1.5">이메일</label>
              <div className="border border-gray-100 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-500">{user.email}</span>
              </div>
            </div>
          )}

          {/* 로그아웃 / 탈퇴 */}
          <div className="flex flex-col gap-2 pt-4 border-t border-gray-100">
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 text-sm font-bold text-white bg-[#111111] rounded-xl hover:bg-gray-800 transition-colors"
            >
              로그아웃
            </button>
            <button
              onClick={() => { setDeleteConfirm(true); setDeleteError(""); }}
              className="w-full py-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              회원 탈퇴
            </button>
          </div>
        </div>
      </div>

      {/* 찜한 상품 */}
      <div>
        <h2 className="text-lg font-black text-[#111111] mb-4">
          찜한 상품{" "}
          {!loadingProducts && (
            <span className="text-[#F5A623]">{visibleProducts.length}</span>
          )}
        </h2>

        {loadingProducts ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-[3px] border-[#F5A623] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visibleProducts.length === 0 ? (
          <p className="text-center text-gray-400 py-16 text-sm">찜한 상품이 없어요.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {visibleProducts.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                category={p.category}
                imageUrl={p.image_url}
                imageUrls={p.image_urls}
                videoUrl={p.video_url}
                title={p.title}
                link={p.affiliate_link}
                buttonText={p.button_text}
              />
            ))}
          </div>
        )}
      </div>

      {/* 회원 탈퇴 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl w-80 p-6">
            <h3 className="font-bold text-[#111111] text-center mb-2">정말 탈퇴하시겠습니까?</h3>
            <p className="text-xs text-gray-400 text-center mb-4">
              찜한 상품 목록이 모두 삭제되며 복구할 수 없습니다.
            </p>
            {deleteError && (
              <p className="text-xs text-red-500 text-center mb-4 bg-red-50 rounded-lg px-3 py-2">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteConfirm(false); setDeleteError(""); }}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? "처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
