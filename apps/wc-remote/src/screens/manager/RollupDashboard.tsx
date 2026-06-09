// apps/wc-remote/src/screens/manager/RollupDashboard.tsx — the manager team roll-up (brief §6.9, U21).
// The PER-REPORT TABLE is the primary surface (name · submitted · completion% · alignment% · carry-over
// · items), with a sticky header, tabular numerals, sort, and PAGINATION (Pageable up to 2000 rows).
// Supporting metric widgets (team completion%, alignment%, carry-over rate) sit ABOVE the table as
// restrained context — deliberately not equal-weight hero cards. Drill-through opens a report's review.
// Loading shows skeleton widgets + table; empty/error via shared primitives. Data via RTK Query.
import { useMemo, useState } from 'react';
import { Button, Table } from 'flowbite-react';
import type { RollupRow } from '@wcm/types';
import { useGetRollupQuery } from '@wcm/api';
import { EmptyState, ErrorState, Skeleton } from '@wcm/ui';
import { MetricWidget } from '../../components/MetricWidget';

type SortKey = 'memberName' | 'completionPct' | 'rcdoAlignmentPct' | 'carryOverRate';

export interface RollupDashboardProps {
  /** Drill through to a report's review (parent resolves the report's current commit). */
  onDrillThrough?: (memberId: string) => void;
}

const PAGE_SIZE = 50;

export function RollupDashboard({ onDrillThrough }: RollupDashboardProps): JSX.Element {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortKey>('memberName');
  const { data, isLoading, isError, refetch, isFetching } = useGetRollupQuery({
    page,
    size: PAGE_SIZE,
  });

  const rows = useMemo<RollupRow[]>(() => {
    const content = data?.content ?? [];
    const copy = [...content];
    copy.sort((a, b) =>
      sort === 'memberName'
        ? a.memberName.localeCompare(b.memberName)
        : b[sort] - a[sort],
    );
    return copy;
  }, [data, sort]);

  // Team-level aggregates for the supporting widgets (averaged over the visible page).
  const widgets = useMemo(() => {
    const content = data?.content ?? [];
    if (content.length === 0) {
      return { completion: '—', alignment: '—', carryOver: '—', unreviewed: '0' };
    }
    const avg = (sel: (r: RollupRow) => number): string =>
      `${Math.round(content.reduce((s, r) => s + sel(r), 0) / content.length)}%`;
    return {
      completion: avg((r) => r.completionPct),
      alignment: avg((r) => r.rcdoAlignmentPct),
      carryOver: avg((r) => r.carryOverRate),
      unreviewed: String(data?.totalElements ?? content.length),
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6" data-testid="rollup-dashboard">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} lines={2} />
          ))}
        </div>
        <Skeleton lines={8} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl p-6" data-testid="rollup-dashboard">
        <ErrorState title="Could not load the team dashboard" onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4 p-6" data-testid="rollup-dashboard">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-primary-900">Team dashboard</h1>
        <p className="text-sm text-slate-500">
          Strategic alignment and execution across your reports.
        </p>
      </header>

      {/* Supporting metric widgets — restrained context above the primary table. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="metric-row">
        <MetricWidget label="Avg completion" value={widgets.completion} />
        <MetricWidget label="Strategic alignment" value={widgets.alignment} sublabel="Items linked to strategy" />
        <MetricWidget label="Carry-over rate" value={widgets.carryOver} />
        <MetricWidget label="Reports" value={widgets.unreviewed} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No team data" description="Once your reports lock weeks, their roll-up appears here." />
      ) : (
        <>
          <div className="overflow-x-auto rounded border border-slate-200">
            <Table hoverable data-testid="rollup-table">
              <Table.Head className="sticky top-0">
                <SortHeader label="Report" k="memberName" sort={sort} setSort={setSort} />
                <SortHeader label="Completion %" k="completionPct" sort={sort} setSort={setSort} numeric />
                <SortHeader label="Alignment %" k="rcdoAlignmentPct" sort={sort} setSort={setSort} numeric />
                <SortHeader label="Carry-over %" k="carryOverRate" sort={sort} setSort={setSort} numeric />
                <Table.HeadCell className="text-right">Items</Table.HeadCell>
                <Table.HeadCell><span className="sr-only">Open</span></Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {rows.map((r) => (
                  <Table.Row key={r.memberId} data-testid="rollup-row" data-member-id={r.memberId} className="bg-white">
                    <Table.Cell className="font-medium text-primary-900">{r.memberName}</Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{r.completionPct}%</Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{r.rcdoAlignmentPct}%</Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{r.carryOverRate}%</Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{r.itemCount}</Table.Cell>
                    <Table.Cell className="text-right">
                      <button
                        type="button"
                        onClick={() => onDrillThrough?.(r.memberId)}
                        data-testid="rollup-drill"
                        className="text-sm text-accent-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                      >
                        Open
                      </button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>

          {/* Pagination controls (Pageable). */}
          <div className="flex items-center justify-between text-sm text-slate-600" data-testid="pagination">
            <span className="tabular-nums">
              Page {data.number + 1} of {Math.max(1, data.totalPages)} · {data.totalElements} reports
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                color="light"
                disabled={page <= 0 || isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                data-testid="page-prev"
              >
                Previous
              </Button>
              <Button
                size="xs"
                color="light"
                disabled={page >= data.totalPages - 1 || isFetching}
                onClick={() => setPage((p) => p + 1)}
                data-testid="page-next"
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

interface SortHeaderProps {
  label: string;
  k: SortKey;
  sort: SortKey;
  setSort: (k: SortKey) => void;
  numeric?: boolean;
}

/** A clickable, accessible column header that drives client-side sort of the visible page. */
function SortHeader({ label, k, sort, setSort, numeric }: SortHeaderProps): JSX.Element {
  const active = sort === k;
  return (
    <Table.HeadCell className={numeric ? 'text-right' : undefined}>
      <button
        type="button"
        onClick={() => setSort(k)}
        aria-pressed={active}
        data-testid={`sort-${k}`}
        className="inline-flex items-center gap-1 hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      >
        {label}
        {active && <span aria-hidden>▾</span>}
      </button>
    </Table.HeadCell>
  );
}
