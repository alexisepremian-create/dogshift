"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    onChange();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  return reduced;
}

export default function HostRouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState<React.ReactNode>(children);
  const [prev, setPrev] = useState<React.ReactNode | null>(null);
  const [leaveActive, setLeaveActive] = useState(false);
  const [enterActive, setEnterActive] = useState(false);

  const lastPathname = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (lastPathname.current === null) {
      lastPathname.current = pathname;
      setCurrent(children);
      return;
    }

    if (lastPathname.current === pathname) {
      setCurrent(children);
      return;
    }

    if (prefersReducedMotion) {
      lastPathname.current = pathname;
      setPrev(null);
      setLeaveActive(false);
      setEnterActive(false);
      setCurrent(children);
      return;
    }

    lastPathname.current = pathname;
    setPrev(current);
    setCurrent(children);

    setLeaveActive(false);
    setEnterActive(false);

    const raf = window.requestAnimationFrame(() => {
      setLeaveActive(true);
      setEnterActive(true);
    });

    const t = window.setTimeout(() => {
      setPrev(null);
      setLeaveActive(false);
      setEnterActive(false);
    }, 220);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, children, prefersReducedMotion]);

  const classPrev = useMemo(() => {
    if (!prev) return "ds-host-layer ds-host-prev";
    return "ds-host-layer ds-host-prev" + (leaveActive ? " is-leaving" : "");
  }, [prev, leaveActive]);

  const classCurrent = useMemo(() => {
    if (!mounted || prefersReducedMotion) return "ds-host-layer ds-host-current";
    if (!prev) return "ds-host-layer ds-host-current";
    return "ds-host-layer ds-host-current" + (enterActive ? " is-entering" : " is-pre-enter");
  }, [mounted, prefersReducedMotion, prev, enterActive]);

  return (
    <div className="ds-host-transition-wrap">
      {prev ? <div className={classPrev}>{prev}</div> : null}
      <div className={classCurrent}>{current}</div>
    </div>
  );
}
