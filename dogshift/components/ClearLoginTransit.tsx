"use client";

import { useEffect } from "react";

export default function ClearLoginTransit() {
  useEffect(() => {
    try { sessionStorage.removeItem("ds_login_transit"); } catch {}
  }, []);
  return null;
}
