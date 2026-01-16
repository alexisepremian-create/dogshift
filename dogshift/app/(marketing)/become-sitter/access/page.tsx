import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import BecomeSitterAccessForm from "@/components/BecomeSitterAccessForm";

export default async function BecomeSitterAccessPage() {
  const c = await cookies();
  const unlocked = c.get("dogsitter_invite")?.value === "ok";
  if (unlocked) {
    redirect("/become-sitter/form");
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto flex min-h-[calc(100vh-120px)] max-w-6xl items-center justify-center px-4 py-14 sm:px-6">
        <BecomeSitterAccessForm />
      </main>
    </div>
  );
}
