// apps/wc-remote/src/WeeklyCommitApp.tsx — the federated entry component of the WC remote.
// Exposed to the host as './WeeklyCommitApp'; renders the weekly-commit landing surface
// with a Flowbite Card. Props are optional so the remote also runs standalone.
import { Card } from 'flowbite-react';
import { lifecycleColor } from '@wcm/ui';
import type { LifecycleState } from '@wcm/types';

export interface WeeklyCommitAppProps {
  /** Optional access-token provider injected by the host shell (absent when standalone). */
  getToken?: () => Promise<string>;
  /** Optional authenticated user info injected by the host shell. */
  user?: { name?: string };
}

export function WeeklyCommitApp({ user }: WeeklyCommitAppProps): JSX.Element {
  const state: LifecycleState = 'DRAFT';
  const greetingName = user?.name ?? 'there';

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Card>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Weekly Commit
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Welcome, {greetingName}. Draft this week&apos;s commit and link each
          item to a Supporting Outcome.
        </p>
        <span
          data-testid="lifecycle-state"
          data-color={lifecycleColor(state)}
          className="inline-flex w-fit rounded bg-gray-100 px-2 py-1 text-sm font-medium text-gray-700"
        >
          {state}
        </span>
      </Card>
    </main>
  );
}

export default WeeklyCommitApp;
