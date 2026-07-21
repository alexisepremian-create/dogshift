import assert from "node:assert/strict";
import { test, mock, beforeEach, afterEach } from "node:test";

import {
  createVisibilityInterval,
  type VisibilityDocument,
} from "../../lib/polling/visibilityInterval.ts";

// Minimal fake document with a controllable `hidden` flag + one visibilitychange listener.
function makeDoc(initialHidden = false) {
  let handler: (() => void) | null = null;
  const doc: VisibilityDocument = {
    hidden: initialHidden,
    addEventListener: (_type, h) => {
      handler = h;
    },
    removeEventListener: (_type, h) => {
      if (handler === h) handler = null;
    },
  };
  return {
    doc,
    setHidden(hidden: boolean) {
      doc.hidden = hidden;
      handler?.();
    },
    hasListener: () => handler !== null,
  };
}

beforeEach(() => {
  mock.timers.enable({ apis: ["setInterval"] });
});

afterEach(() => {
  mock.timers.reset();
});

test("ticks while visible", () => {
  const { doc } = makeDoc(false);
  const cb = mock.fn();
  createVisibilityInterval(doc, cb, 1000);

  mock.timers.tick(3000);
  assert.equal(cb.mock.callCount(), 3);
});

test("does not tick while hidden, then resumes when visible again", () => {
  const env = makeDoc(false);
  const cb = mock.fn();
  createVisibilityInterval(env.doc, cb, 1000);

  mock.timers.tick(2000); // 2 ticks visible
  assert.equal(cb.mock.callCount(), 2);

  env.setHidden(true); // pause — interval cleared
  mock.timers.tick(5000); // no ticks while hidden
  assert.equal(cb.mock.callCount(), 2);

  env.setHidden(false); // resume: fires once immediately (fireOnVisible) then interval
  assert.equal(cb.mock.callCount(), 3);
  mock.timers.tick(2000);
  assert.equal(cb.mock.callCount(), 5);
});

test("starts paused when the tab is already hidden on mount", () => {
  const env = makeDoc(true);
  const cb = mock.fn();
  createVisibilityInterval(env.doc, cb, 1000);

  mock.timers.tick(5000);
  assert.equal(cb.mock.callCount(), 0);

  env.setHidden(false);
  assert.equal(cb.mock.callCount(), 1); // immediate fire on becoming visible
});

test("fireOnVisible:false does not fire immediately on resume", () => {
  const env = makeDoc(false);
  const cb = mock.fn();
  createVisibilityInterval(env.doc, cb, 1000, { fireOnVisible: false });

  env.setHidden(true);
  env.setHidden(false);
  assert.equal(cb.mock.callCount(), 0); // no immediate fire

  mock.timers.tick(1000);
  assert.equal(cb.mock.callCount(), 1);
});

test("cleanup removes the listener and stops ticking", () => {
  const env = makeDoc(false);
  const cb = mock.fn();
  const cleanup = createVisibilityInterval(env.doc, cb, 1000);

  mock.timers.tick(1000);
  assert.equal(cb.mock.callCount(), 1);

  cleanup();
  assert.equal(env.hasListener(), false);

  mock.timers.tick(5000);
  assert.equal(cb.mock.callCount(), 1); // no further ticks after cleanup
});
