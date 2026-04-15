import { redirect } from "next/navigation";

import { requireAdminPageAccess } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminSitterApplicationsPage() {
  await requireAdminPageAccess("/admin/sitter-applications");
  redirect("/admin/sitters/applications");
}
