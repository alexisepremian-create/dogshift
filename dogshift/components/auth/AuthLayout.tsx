import type { ReactNode } from "react";
import { Bone, Dog, Heart, MapPin, Calendar, Home } from "lucide-react";

import BrandLogo from "@/components/BrandLogo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden bg-white text-slate-900">
      {/* Arrière-plan avec icônes aux couleurs de la marque */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Icônes principales bien visibles */}
        <Dog className="absolute -right-12 top-24 h-48 w-48 rotate-12 text-[#2f4d6b]/20 fill-[#2f4d6b]/5" strokeWidth={1.5} />
        <Bone className="absolute bottom-24 -left-12 h-36 w-36 -rotate-12 text-[#7969F0]/25 fill-[#7969F0]/5" strokeWidth={1.5} />
        
        {/* Icônes secondaires très transparentes */}
        <Heart className="absolute -left-8 top-16 h-32 w-32 -rotate-12 text-[#7969F0]/[0.04]" strokeWidth={1.5} />
        <MapPin className="absolute bottom-16 right-16 h-40 w-40 rotate-12 text-[#2f4d6b]/[0.04]" strokeWidth={1.5} />
        <Calendar className="absolute left-[25%] top-12 h-20 w-20 -rotate-6 text-[#2f4d6b]/[0.04]" strokeWidth={1.5} />
        <Home className="absolute bottom-12 right-[25%] h-24 w-24 rotate-6 text-[#7969F0]/[0.04]" strokeWidth={1.5} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[480px] px-6 py-10">
        <div className="flex flex-col items-center">
          <BrandLogo href="/" priority />

          <div className="mt-2 w-full">{children}</div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          <p>DogShift</p>
        </div>
      </div>
    </div>
  );
}
