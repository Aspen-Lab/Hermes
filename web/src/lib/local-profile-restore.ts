// Tiny external store so <FirstRunGate/> can wait for <LocalProfileSync/>'s
// disk-restore attempt before deciding to redirect to /welcome — otherwise
// the redirect (gated only on localStorage hydration) can fire before the
// async disk read resolves, bouncing a returning user to onboarding for a
// frame. Outside development this is permanently "ready" since
// LocalProfileSync never attempts a restore at all.

type Listener = () => void;

let ready = process.env.NODE_ENV !== "development";
const listeners = new Set<Listener>();

export function markLocalProfileRestoreReady() {
  if (ready) return;
  ready = true;
  listeners.forEach((l) => l());
}

export function subscribeLocalProfileRestore(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isLocalProfileRestoreReady() {
  return ready;
}
