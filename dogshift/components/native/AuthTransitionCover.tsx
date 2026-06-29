"use client";
/* eslint-disable react-hooks/set-state-in-effect -- intentionally read the
   sessionStorage flag on mount (covers hard-nav reloads landing mid-transition);
   doing it in an effect rather than a useState initializer avoids an SSR/client
   hydration mismatch. */

import { useEffect, useState } from "react";

import NativeBrandedLoader from "@/components/native/NativeBrandedLoader";
import {
  authTransitionActive,
  AUTH_TRANSITION_BEGIN_EVENT,
  AUTH_TRANSITION_END_EVENT,
  endAuthTransition,
} from "@/lib/native/authTransition";

/**
 * Global, native-only branded cover (purple + paw) that masks the logout and
 * login transitions. Mounted once in the root layout; persists across client
 * navigations and re-mounts (reading the sessionStorage flag) across the hard
 * `window.location.replace` reloads both flows perform — so the user sees one
 * continuous brand screen instead of the old skeleton → cold-splash → skeleton
 * cascade. Always clears on the end signal or a 6 s failsafe.
 */
const FAILSAFE_MS = 6000;
const FADE_MS = 420; // a touch longer than NativeBrandedLoader's 380ms opacity fade

export default function AuthTransitionCover() {
  const [active, setActive] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Show on: (a) a flag already present on this load (hard-nav reload landing
  // mid-transition), or (b) a begin event from a same-document client nav.
  useEffect(() => {
    const native = document.documentElement.getAttribute("data-native") === "true";
    if (native && authTransitionActive()) setActive(true);

    const onBegin = () => {
      if (document.documentElement.getAttribute("data-native") !== "true") return;
      setFadeOut(false);
      setActive(true);
    };
    window.addEventListener(AUTH_TRANSITION_BEGIN_EVENT, onBegin);
    return () => window.removeEventListener(AUTH_TRANSITION_BEGIN_EVENT, onBegin);
  }, []);

  // While active: wait for the end signal (destination ready) or the failsafe,
  // then fade out and unmount.
  useEffect(() => {
    if (!active) return;
    let fadeTimer: number | undefined;
    const finish = () => {
      setFadeOut(true);
      fadeTimer = window.setTimeout(() => {
        setActive(false);
        setFadeOut(false);
      }, FADE_MS);
    };
    const onEnd = () => finish();
    window.addEventListener(AUTH_TRANSITION_END_EVENT, onEnd);
    const failsafe = window.setTimeout(() => {
      endAuthTransition();
      finish();
    }, FAILSAFE_MS);
    return () => {
      window.removeEventListener(AUTH_TRANSITION_END_EVENT, onEnd);
      window.clearTimeout(failsafe);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, [active]);

  if (!active) return null;
  return <NativeBrandedLoader fadeOut={fadeOut} />;
}
