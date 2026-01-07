"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HostProfilePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/host/profile/edit");
  }, [router]);

  return null;
}
