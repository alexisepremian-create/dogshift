import type { ReactNode } from "react";
import { Bone, Dog, Heart, MapPin, Calendar, Home } from "lucide-react";

import BrandLogo from "@/components/BrandLogo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden bg-white text-slate-900">
      {/* Arrière-plan avec icônes subtiles */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden text-slate-200/40">
        <Dog className="absolute -left-12 top-20 h-48 w-48 -rotate-12" strokeWidth={1} />
        <Bone className="absolute bottom-24 left-12 h-32 w-32 rotate-45" strokeWidth={1} />
        <Heart className="absolute -right-8 top-32 h-40 w-40 rotate-12" strokeWidth={1} />
        <MapPin className="absolute bottom-20 right-16 h-36 w-36 -rotate-12" strokeWidth={1} />
        <Calendar className="absolute left-[20%] top-10 h-24 w-24 -rotate-6" strokeWidth={1} />
        <Home className="absolute bottom-10 right-[25%] h-28 w-28 rotate-6" strokeWidth={1} />
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
