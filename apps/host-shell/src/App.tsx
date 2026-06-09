// apps/host-shell/src/App.tsx — placeholder host UI for the WCM dev shell.
// Renders a static landing now; a later unit (U4) lazy-loads wc/WeeklyCommitApp via Module
// Federation and injects an Auth0 token. Kept minimal so the foundation build stays green.
export function App(): JSX.Element {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">
        WCM Host Shell
      </h1>
      <p className="text-gray-600">
        The Weekly Commit remote will mount here via Module Federation.
      </p>
    </main>
  );
}

export default App;
