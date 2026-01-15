import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import BecomeSitterAccessForm from "@/components/BecomeSitterAccessForm";
import BecomeSitterPage from "@/app/become-sitter/page";

export default async function BecomeSitterAccessPage() {
  const c = await cookies();
  const unlocked = c.get("dogsitter_invite")?.value === "ok";
  if (unlocked) {
    redirect("/become-sitter/form");
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <BecomeSitterAccessForm isUnlocked={false}>
        <BecomeSitterPage />
      </BecomeSitterAccessForm>
    </div>
  );
}
