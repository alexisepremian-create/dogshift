import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Bone, Dog, Heart, MapPin, Calendar, Home } from "lucide-react";

import BecomeSitterAccessForm from "@/components/BecomeSitterAccessForm";

export default async function BecomeSitterAccessPage() {
  const c = await cookies();
  const unlocked = c.get("ds_invite_unlocked")?.value === "1";
  if (unlocked) {
    redirect("/become-sitter/form");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      {/* Arrière-plan avec icônes aux couleurs de la marque */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Dog className="absolute right-8 top-32 h-48 w-48 rotate-12 text-[#2f4d6b]/20" strokeWidth={1.5} />
        <Bone className="absolute bottom-32 left-8 h-36 w-36 -rotate-12 text-[#7969F0]/20" strokeWidth={1.5} />
        <Heart className="absolute left-10 top-24 h-32 w-32 -rotate-12 text-[#7969F0]/[0.04]" strokeWidth={1.5} />
        <MapPin className="absolute bottom-24 right-12 h-40 w-40 rotate-12 text-[#2f4d6b]/[0.04]" strokeWidth={1.5} />
        <Calendar className="absolute left-[25%] top-20 h-20 w-20 -rotate-6 text-[#2f4d6b]/[0.04]" strokeWidth={1.5} />
        <Home className="absolute bottom-20 right-[25%] h-24 w-24 rotate-6 text-[#7969F0]/[0.04]" strokeWidth={1.5} />
      </div>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-120px)] max-w-6xl items-center justify-center px-4 py-14 sm:px-6">
        <BecomeSitterAccessForm />
      </main>
    </div>
  );
}
