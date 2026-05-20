import { cookies } from "next/headers";
import LoginForm from "./LoginForm";
import AdminPanel from "./AdminPanel";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAuth = cookieStore.get("admin_auth")?.value === "true";

  if (!isAuth) {
    return <LoginForm />;
  }

  return <AdminPanel />;
}
