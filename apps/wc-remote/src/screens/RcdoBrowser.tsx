// apps/wc-remote/src/screens/RcdoBrowser.tsx — the Strategy screen (brief §6.5): read-only exploration
// of the 4-level RCDO tree for context. Reuses the accessible RcdoTree (keyboard + ARIA) with a
// typeahead filter and a side detail panel showing the focused Supporting Outcome's breadcrumb. Data
// via RTK Query (getRcdoTree); loading/empty/error use the shared primitives. No mutation here.
import { useMemo, useState } from 'react';
import { TextInput } from 'flowbite-react';
import { useGetRcdoTreeQuery } from '@wcm/api';
import { EmptyState, ErrorState, RcdoBreadcrumb, Skeleton } from '@wcm/ui';
import { RcdoTree, type RcdoSelection } from '../components/RcdoTree';
import { filterTree } from '../components/RcdoPicker';

export function RcdoBrowser(): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetRcdoTreeQuery();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState<RcdoSelection | null>(null);

  const filtered = useMemo(() => filterTree(data ?? [], query), [data, query]);

  return (
    <section className="mx-auto max-w-4xl p-6" data-testid="rcdo-browser">
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-primary-900">Strategy</h1>
        <p className="text-sm text-slate-500">
          Explore the company strategy: Rally Cry › Defining Objective › Outcome › Supporting Outcome.
        </p>
      </header>

      <TextInput
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search supporting outcomes…"
        aria-label="Search the strategy tree"
        data-testid="rcdo-browser-search"
        className="mb-3"
      />

      {isLoading && <Skeleton lines={8} />}
      {isError && (
        <ErrorState
          title="Could not load the strategy tree"
          onRetry={() => void refetch()}
        />
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          title={query ? 'No matching outcomes' : 'No strategy defined yet'}
          description={
            query
              ? 'Try a different search term.'
              : 'Your organization has not published a strategy tree.'
          }
        />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <RcdoTree tree={filtered} onSelect={setFocused} />
          </div>
          <aside
            className="rounded border border-slate-200 bg-slate-50 p-4"
            aria-live="polite"
            data-testid="rcdo-detail"
          >
            {focused ? (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-800">
                  {focused.outcome.title}
                </h2>
                <RcdoBreadcrumb path={focused.path} />
                <p className="text-xs text-slate-500">
                  {focused.outcome.ownerId
                    ? 'Has an assigned owner.'
                    : 'No owner assigned.'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Select a Supporting Outcome to see its strategy path.
              </p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
