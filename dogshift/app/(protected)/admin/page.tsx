import { redirect } from "next/navigation";
import { getAdminAccessState } from "@/lib/adminAuth";

export default async function AdminIndexPage() {
  const state = await getAdminAccessState();
  redirect(state.isAdmin ? "/admin/dashboard" : "/admin/login");
}
