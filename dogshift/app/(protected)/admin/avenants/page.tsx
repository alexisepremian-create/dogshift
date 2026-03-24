import AdminContractAmendmentsClient from "@/components/admin/AdminContractAmendmentsClient";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminContractAmendmentsPage() {
  await requireAdminPageAccess("/admin/avenants");

  return (
    <AdminShell>
      <AdminContractAmendmentsClient />
    </AdminShell>
  );
}
