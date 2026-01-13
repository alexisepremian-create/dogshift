"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import DogShiftBot from "@/components/DogShiftBot";
import PageTopOffset from "@/components/PageTopOffset";
import SiteHeader from "@/components/SiteHeader";

function isAuthPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/") || pathname === "/signup" || pathname.startsWith("/signup/");
}

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  const isAccess = pathname === "/access";
  const isAuth = isAuthPath(pathname);

  if (isAccess || isAuth) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteHeader />
      <PageTopOffset>{children}</PageTopOffset>
      <DogShiftBot />
      <footer className="border-t border-slate-200/70 bg-white">
        <div className="flex w-full flex-col gap-3 px-4 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-start sm:px-6">
          <div className="flex items-start gap-4">
            <Link href="/" aria-label="DogShift" className="inline-flex items-center">
              <Image
                src="/dogshift-logo.png"
                alt="DogShift"
                width={240}
                height={56}
                className="h-[52px] w-auto"
                priority={false}
              />
            </Link>
            <div className="flex flex-col items-start gap-1 pt-1">
              <Link href="/cgu" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                CGU
              </Link>
              <p className="font-medium text-slate-700">© {new Date().getFullYear()} DogShift</p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
