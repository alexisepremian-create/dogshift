import type { ReactNode } from "react";

export default function AgentsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative" style={{ minHeight: "calc(100vh - 0px)" }}>
      {children}
    </div>
  );
}