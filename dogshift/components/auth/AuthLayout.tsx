import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-6 py-10">
        <div className="flex items-center justify-center">
          <Image src="/dogshift-logo.png" alt="DogShift" width={140} height={32} priority />
        </div>

        <div className="mt-10 flex flex-1 flex-col">{children}</div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
          <p>DogShift</p>
        </div>
      </div>
    </div>
  );
}
