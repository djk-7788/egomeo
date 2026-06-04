"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, { error: "" });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-sm">
        <h1 className="text-2xl font-black text-[#111111] mb-1">관리자</h1>
        <p className="text-sm text-gray-400 mb-8">이게머고? 어드민</p>

        <form action={formAction} className="flex flex-col gap-4">
          <input
            type="password"
            name="password"
            placeholder="비밀번호"
            required
            className="border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#F5A623] transition-colors"
          />
          {state.error && (
            <p className="text-sm text-red-500">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="bg-[#F5A623] text-white font-bold py-3 rounded-lg hover:bg-[#d8921f] transition-colors disabled:opacity-50"
          >
            {pending ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}