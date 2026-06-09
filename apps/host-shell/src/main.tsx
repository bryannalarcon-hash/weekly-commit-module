// apps/host-shell/src/main.tsx — host entry. Uses the standard Module Federation ASYNC BOUNDARY: it
// dynamically imports ./bootstrap so the federation runtime + shared singletons (react/react-dom)
// initialize before any code that statically references the shared modules executes. Without this
// deferral a host that eagerly imports shared deps can race the MF runtime init.
import('./bootstrap').catch((err) => {
  // A failure here means the federation runtime itself could not start — make it visible.
  // eslint-disable-next-line no-console
  console.error('host bootstrap failed', err);
});
