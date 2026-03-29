"use client";

import { useState } from "react";
import PageLoader from "@/components/ui/PageLoader";

export default function ProtectedOverlay() {
  const [show, setShow] = useState(true);

  if (!show) return null;

  return (
    <PageLoader
      ready={true}
      minDuration={2800}
      onDone={() => setShow(false)}
      static={false}
    />
  );
}
