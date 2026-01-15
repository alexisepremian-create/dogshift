"use client";

export type GlobalTransitionState = {
  navigating: boolean;
  hostReadyLatched: boolean;
};

let state: GlobalTransitionState = {
  navigating: false,
  hostReadyLatched: false,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

export function subscribeGlobalTransition(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGlobalTransitionSnapshot(): GlobalTransitionState {
  return state;
}

export function startGlobalNavigation() {
  if (state.navigating) return;
  state = { ...state, navigating: true };
  emitChange();
}

export function endGlobalNavigation() {
  if (!state.navigating) return;
  state = { ...state, navigating: false };
  emitChange();
}

export function latchHostReady() {
  if (state.hostReadyLatched) return;
  state = { ...state, hostReadyLatched: true };
  emitChange();
}
