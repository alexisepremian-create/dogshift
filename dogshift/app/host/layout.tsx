
import HostShellWithAuth from "@/components/HostShellWithAuth";
import { HostUserProvider } from "@/components/HostUserProvider";
import { getHostUserData } from "@/lib/hostUser";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hostUser = await getHostUserData();
  if (!hostUser.sitterId) {
    redirect("/account");
  }
  return (
    <HostUserProvider value={hostUser}>
      <HostShellWithAuth>{children}</HostShellWithAuth>
    </HostUserProvider>
  );
}
