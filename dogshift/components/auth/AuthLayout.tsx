import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto w-full max-w-[480px] px-6 pt-4 pb-10">
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
            <Image
              src="/dogshift-logo.png"
              alt="DogShift"
              width={64}
              height={64}
              priority
              className="h-9 w-auto"
            />
          </div>

          <div className="mt-2 w-full">{children}</div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          <p>DogShift</p>
        </div>
      </div>
    </div>
  );
}
