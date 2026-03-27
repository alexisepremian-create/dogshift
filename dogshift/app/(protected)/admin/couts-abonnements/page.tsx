import AdminServiceCostsClient from "@/components/admin/AdminServiceCostsClient";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminServiceCostsPage() {
  await requireAdminPageAccess("/admin/couts-abonnements");

  return (
    <AdminShell>
      <AdminServiceCostsClient />
    </AdminShell>
  );
}

