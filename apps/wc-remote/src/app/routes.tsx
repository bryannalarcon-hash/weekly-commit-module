// apps/wc-remote/src/app/routes.tsx — the WC remote's internal route table (brief §5). Every screen is
// a LAZY route (React.lazy + Suspense, sub-second initial render, code-split per the NFR). Thin route
// wrappers bridge react-router useNavigate/useParams to the screens' callback props (onEdit/onReconcile/
// onOpenReview/…). Manager routes are wrapped in RequireManager (UX gate; real authz is server-side).
// No host chrome here — only the feature's own content + the internal sub-nav (rendered in WcShell).
import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Skeleton } from '@wcm/ui';
import { useLazyGetReportLatestCommitQuery } from '@wcm/api';
import { RequireManager } from './guards';

// Lazy screen chunks (code-split). Each resolves the named export to a default for React.lazy.
const MyWeeklyCommit = lazy(() =>
  import('../screens/MyWeeklyCommit').then((m) => ({ default: m.MyWeeklyCommit })),
);
const EditCommit = lazy(() =>
  import('../screens/EditCommit').then((m) => ({ default: m.EditCommit })),
);
const CommitHistory = lazy(() =>
  import('../screens/CommitHistory').then((m) => ({ default: m.CommitHistory })),
);
const PastCommitDetail = lazy(() =>
  import('../screens/PastCommitDetail').then((m) => ({ default: m.PastCommitDetail })),
);
const Reconciliation = lazy(() =>
  import('../screens/Reconciliation').then((m) => ({ default: m.Reconciliation })),
);
const RcdoBrowser = lazy(() =>
  import('../screens/RcdoBrowser').then((m) => ({ default: m.RcdoBrowser })),
);
const Settings = lazy(() =>
  import('../screens/Settings').then((m) => ({ default: m.Settings })),
);
const ReviewQueue = lazy(() =>
  import('../screens/manager/ReviewQueue').then((m) => ({ default: m.ReviewQueue })),
);
const ReviewDetail = lazy(() =>
  import('../screens/manager/ReviewDetail').then((m) => ({ default: m.ReviewDetail })),
);
const RollupDashboard = lazy(() =>
  import('../screens/manager/RollupDashboard').then((m) => ({ default: m.RollupDashboard })),
);

/** Suspense fallback reserving layout space (CLS-safe) while a lazy chunk loads. */
function RouteFallback(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl p-6" data-testid="route-fallback">
      <Skeleton lines={6} />
    </div>
  );
}

// --- Route wrappers: bridge router params/navigation to screen callback props -------------------

function MyWeekRoute(): JSX.Element {
  const nav = useNavigate();
  return (
    <MyWeeklyCommit
      onEdit={(id) => nav(`/edit/${id}`)}
      onReconcile={(id) => nav(`/reconcile/${id}`)}
    />
  );
}

function EditRoute(): JSX.Element {
  const { commitId = '' } = useParams();
  const nav = useNavigate();
  return (
    <EditCommit commitId={commitId} onBack={() => nav('/')} onLocked={() => nav('/')} />
  );
}

function HistoryRoute(): JSX.Element {
  const nav = useNavigate();
  return <CommitHistory onOpen={(id) => nav(`/history/${id}`)} />;
}

function PastDetailRoute(): JSX.Element {
  const { commitId = '' } = useParams();
  const nav = useNavigate();
  return (
    <PastCommitDetail
      commitId={commitId}
      onBack={() => nav('/history')}
      onReconcile={(id) => nav(`/reconcile/${id}`)}
    />
  );
}

function ReconcileRoute(): JSX.Element {
  const { commitId = '' } = useParams();
  const nav = useNavigate();
  return <Reconciliation commitId={commitId} onBackToWeek={() => nav('/')} />;
}

function ReviewQueueRoute(): JSX.Element {
  const nav = useNavigate();
  return (
    <RequireManager>
      <ReviewQueue onOpenReview={(id) => nav(`/manager/review/${id}`)} />
    </RequireManager>
  );
}

function ReviewDetailRoute(): JSX.Element {
  const { commitId = '' } = useParams();
  const nav = useNavigate();
  return (
    <RequireManager>
      <ReviewDetail commitId={commitId} onBack={() => nav('/manager')} />
    </RequireManager>
  );
}

function DashboardRoute(): JSX.Element {
  const nav = useNavigate();
  // Deferred-fix: a dashboard drill-through must open the REPORT'S REVIEW, not the queue. The row
  // gives a memberId; resolve that report's latest reviewable commit, then route to its review detail.
  // On a miss (report has no locked week) fall back to the queue so the click is never a dead end.
  const [resolveLatest] = useLazyGetReportLatestCommitQuery();
  return (
    <RequireManager>
      <RollupDashboard
        onDrillThrough={(memberId) => {
          void resolveLatest(memberId)
            .unwrap()
            .then((res) => nav(`/manager/review/${res.commitId}`))
            .catch(() => nav('/manager'));
        }}
        onOpenQueue={() => nav('/manager')}
      />
    </RequireManager>
  );
}

/** The full lazy route table. Mounted inside WcShell (which owns the sub-nav). */
export function WcRoutes(): JSX.Element {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<MyWeekRoute />} />
        <Route path="/edit/:commitId" element={<EditRoute />} />
        <Route path="/history" element={<HistoryRoute />} />
        <Route path="/history/:commitId" element={<PastDetailRoute />} />
        <Route path="/reconcile/:commitId" element={<ReconcileRoute />} />
        <Route path="/strategy" element={<RcdoBrowser />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/manager" element={<ReviewQueueRoute />} />
        <Route path="/manager/review/:commitId" element={<ReviewDetailRoute />} />
        <Route path="/manager/dashboard" element={<DashboardRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
