import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-6 py-5">
        <div className="flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
            <Image
              src="/dogshift-logo.png"
              alt="DogShift"
              width={64}
              height={64}
              priority
              className="h-10 w-auto"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center pt-4 pb-7 sm:-translate-y-6">{children}</div>

        <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          <p>DogShift</p>
        </div>
      </div>
    </div>
  );
}
