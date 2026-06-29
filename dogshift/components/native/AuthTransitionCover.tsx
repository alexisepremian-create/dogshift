"use client";

import { useEffect } from "react";

import {
  AUTH_TRANSITION_BEGIN_EVENT,
  endAuthTransition,
} from "@/lib/native/authTransition";

/**
 * Failsafe controller for the native auth-transition splash (#ds-auth-splash in
 * the root layout). The splash itself is rendered server-side and shown/hidden
 * purely by CSS keyed on html[data-auth-transition] — so this component renders
 * NOTHING. Its only job is to guarantee the splash never gets stuck: if a
 * transition is active (flag set on a hard-nav reload, or a begin event from a
 * same-document nav) it arms a 6 s timer that force-ends it.
 */
const FAILSAFE_MS = 6000;

export default function AuthTransitionCover() {
  useEffect(() => {
    let timer: number | undefined;
    const arm = () => {
      if (document.documentElement.getAttribute("data-auth-transition") !== "true") return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => endAuthTransition(), FAILSAFE_MS);
    };
    // A flag already present on this load (hard-nav reload landing mid-transition).
    arm();
    // A same-document begin (client nav).
    const onBegin = () => arm();
    window.addEventListener(AUTH_TRANSITION_BEGIN_EVENT, onBegin);
    return () => {
      window.removeEventListener(AUTH_TRANSITION_BEGIN_EVENT, onBegin);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
