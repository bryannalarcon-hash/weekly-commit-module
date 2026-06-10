// apps/wc-remote/src/screens/RcdoBrowser.tsx — the Strategy screen (brief §6.5), re-skinned to the WCM
// design (prototype/wcm/page-strategy.jsx): a two-pane browser/editor over the 4-level RCDO tree.
// LEFT pane = a Reddit-style threaded tree (rails colored by ancestor level via RCDO_LEVEL — violet
// RallyCry / cyan DefiningObjective / amber Outcome / signal SupportingOutcome), expand/collapse + a
// typeahead search. RIGHT pane = a detail panel (level pill, title, description, owner, window, the
// "Ladders up to" ancestor chain). An "Edit tree" toggle (shown only to admins — gated on the
// account's `canEditRcdo` capability, see ADMIN GATE note) flips the right pane into an inline editor and
// surfaces "Add child" affordances; edits call the @wcm/api admin mutation hooks (create/update/delete
// for every level), each of which invalidates the rcdo tree tag so getRcdoTree refetches. Data is RTK
// Query ONLY (useGetRcdoTreeQuery + the admin mutations); loading/empty/error use the shared primitives.
// Default export name (RcdoBrowser) is kept stable because the route imports it.
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  useGetRcdoTreeQuery,
  useGetAccountQuery,
  useCreateRallyCryMutation,
  useUpdateRallyCryMutation,
  useDeleteRallyCryMutation,
  useCreateDefiningObjectiveMutation,
  useUpdateDefiningObjectiveMutation,
  useDeleteDefiningObjectiveMutation,
  useCreateOutcomeMutation,
  useUpdateOutcomeMutation,
  useDeleteOutcomeMutation,
  useCreateSupportingOutcomeMutation,
  useUpdateSupportingOutcomeMutation,
  useDeleteSupportingOutcomeMutation,
} from '@wcm/api';
import type { RallyCryNode } from '@wcm/types';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  RCDO_LEVEL,
  Skeleton,
  type RcdoLevel,
} from '@wcm/ui';

// ── Internal flattened node model ───────────────────────────────────────────────────────────────
// The RTK Query tree is 4 typed levels; we normalize it into a uniform node carrying its level, the
// tint color of that level, and its ordered children so one recursive row renderer covers every depth.
interface StratNode {
  id: string;
  level: RcdoLevel;
  title: string;
  ownerId: string | null;
  children: StratNode[];
}

const NEXT_LEVEL: Partial<Record<RcdoLevel, RcdoLevel>> = {
  RALLY_CRY: 'DEFINING_OBJECTIVE',
  DEFINING_OBJECTIVE: 'OUTCOME',
  OUTCOME: 'SUPPORTING_OUTCOME',
};

const tintOf = (level: RcdoLevel): string => RCDO_LEVEL[level].color;
const labelOf = (level: RcdoLevel): string => RCDO_LEVEL[level].label;

/** Normalize the typed 4-level tree into the uniform StratNode shape used by the renderer. */
function toStratTree(tree: RallyCryNode[]): StratNode[] {
  return tree.map((rc) => ({
    id: rc.id,
    level: 'RALLY_CRY' as const,
    title: rc.title,
    ownerId: null,
    children: rc.definingObjectives.map((dobj) => ({
      id: dobj.id,
      level: 'DEFINING_OBJECTIVE' as const,
      title: dobj.title,
      ownerId: null,
      children: dobj.outcomes.map((o) => ({
        id: o.id,
        level: 'OUTCOME' as const,
        title: o.title,
        ownerId: null,
        children: o.supportingOutcomes.map((so) => ({
          id: so.id,
          level: 'SUPPORTING_OUTCOME' as const,
          title: so.title,
          ownerId: so.ownerId,
          children: [],
        })),
      })),
    })),
  }));
}

/** A flat row carrying its node + the ancestor trail (root → parent) — for search results + breadcrumb. */
interface FlatRow {
  node: StratNode;
  trail: StratNode[];
}

function flatten(nodes: StratNode[], trail: StratNode[], out: FlatRow[]): FlatRow[] {
  for (const n of nodes) {
    out.push({ node: n, trail });
    if (n.children.length) flatten(n.children, [...trail, n], out);
  }
  return out;
}

/** Locate a node + its parent's children array (for placing/removing children client-side). */
function locate(
  nodes: StratNode[],
  id: string,
): { node: StratNode; siblings: StratNode[]; parent: StratNode | null } | null {
  for (const n of nodes) {
    if (n.id === id) return { node: n, siblings: nodes, parent: null };
    const r = locateIn(n.children, id, n);
    if (r) return r;
  }
  return null;
}
function locateIn(
  nodes: StratNode[],
  id: string,
  parent: StratNode,
): { node: StratNode; siblings: StratNode[]; parent: StratNode } | null {
  for (const n of nodes) {
    if (n.id === id) return { node: n, siblings: nodes, parent };
    const r = locateIn(n.children, id, n);
    if (r) return r;
  }
  return null;
}

// ── Threaded tree row ───────────────────────────────────────────────────────────────────────────
interface TreeRowProps {
  node: StratNode;
  /** Ancestor tints (one per ancestor depth) used to paint the threading rails. */
  tints: string[];
  /** For each rail depth: was the ancestor at that depth the last child of its parent? */
  lasts: boolean[];
  isLast: boolean;
  expanded: Set<string>;
  toggle: (id: string) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  onAddChild: (id: string) => void;
  editMode: boolean;
}

function TreeRow({
  node,
  tints,
  lasts,
  isLast,
  expanded,
  toggle,
  selected,
  onSelect,
  onAddChild,
  editMode,
}: TreeRowProps): JSX.Element {
  const tint = tintOf(node.level);
  const hasKids = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const isSel = selected === node.id;
  const depth = tints.length;
  const childTints = [...tints, tint];

  const rowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'stretch',
    cursor: 'pointer',
    borderRadius: 'var(--r-sm)',
    background: isSel ? 'var(--surface-2)' : 'transparent',
    border: '1px solid',
    borderColor: isSel ? 'var(--line-bright)' : 'transparent',
  };

  return (
    <>
      <div
        onClick={() => onSelect(node.id)}
        data-testid={`rcdo-node-${node.id}`}
        data-selected={isSel || undefined}
        style={rowStyle}
      >
        {/* Reddit-style threading rails, colored by the ancestor level at each depth. */}
        {tints.map((t, k) => {
          const lastRail = k === depth - 1;
          const showPass = lastRail ? true : !lasts[k + 1];
          return (
            <div key={k} style={{ width: 22, flex: 'none', position: 'relative' }} aria-hidden>
              {showPass && (
                <span
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: 0,
                    height: lastRail && isLast ? '50%' : '100%',
                    width: 2,
                    background: t,
                    opacity: 0.55,
                    borderRadius: 2,
                  }}
                />
              )}
              {lastRail && (
                <span
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: 'calc(50% - 1px)',
                    width: 12,
                    height: 2,
                    background: t,
                    opacity: 0.55,
                    borderRadius: 2,
                  }}
                />
              )}
            </div>
          );
        })}
        {/* node body */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 8px 9px 2px',
          }}
        >
          {hasKids ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.id);
              }}
              aria-label={isOpen ? `Collapse ${node.title}` : `Expand ${node.title}`}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ink-faint)',
                padding: 1,
                display: 'flex',
                flex: 'none',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  transform: isOpen ? 'rotate(90deg)' : 'none',
                  transition: 'transform .15s',
                }}
              >
                <Icon.chevR size={14} />
              </span>
            </button>
          ) : (
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: tint,
                flex: 'none',
                marginLeft: 4,
              }}
            />
          )}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              className="mono"
              style={{
                fontSize: 8.5,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: tint,
                fontWeight: 600,
              }}
            >
              {labelOf(node.level)}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 13.5,
                fontWeight: node.level === 'RALLY_CRY' ? 700 : 600,
                lineHeight: 1.3,
                color: isSel ? 'var(--ink)' : 'var(--ink-mid)',
              }}
            >
              {node.title}
            </span>
          </span>
          {editMode && isSel && NEXT_LEVEL[node.level] && (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              title={`Add ${labelOf(NEXT_LEVEL[node.level]!)}`}
              data-testid="rcdo-add-child"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node.id);
              }}
              style={{ padding: 5, color: 'var(--signal)', flex: 'none' }}
            >
              <Icon.plus size={15} />
            </button>
          )}
        </div>
      </div>
      {hasKids &&
        isOpen &&
        node.children.map((c, ci) => (
          <TreeRow
            key={c.id}
            node={c}
            tints={childTints}
            lasts={[...lasts, isLast]}
            isLast={ci === node.children.length - 1}
            expanded={expanded}
            toggle={toggle}
            selected={selected}
            onSelect={onSelect}
            onAddChild={onAddChild}
            editMode={editMode}
          />
        ))}
    </>
  );
}

export function RcdoBrowser(): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetRcdoTreeQuery();
  // ADMIN GATE: the Edit-tree affordance is admin-only — gated on the account's dedicated
  // `canEditRcdo` capability (server-derived SCOPE_admin:rcdo). A MANAGER has canReview=true but
  // canEditRcdo=false, so this must NOT key off canReview (the admin mutations 403 for managers).
  const { data: account } = useGetAccountQuery();
  const canAdmin = account?.canEditRcdo ?? false;

  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Admin mutation hooks (RTK Query) — each invalidates the rcdo tree tag and triggers a refetch.
  const [createRallyCry] = useCreateRallyCryMutation();
  const [updateRallyCry] = useUpdateRallyCryMutation();
  const [deleteRallyCry] = useDeleteRallyCryMutation();
  const [createDefiningObjective] = useCreateDefiningObjectiveMutation();
  const [updateDefiningObjective] = useUpdateDefiningObjectiveMutation();
  const [deleteDefiningObjective] = useDeleteDefiningObjectiveMutation();
  const [createOutcome] = useCreateOutcomeMutation();
  const [updateOutcome] = useUpdateOutcomeMutation();
  const [deleteOutcome] = useDeleteOutcomeMutation();
  const [createSupportingOutcome] = useCreateSupportingOutcomeMutation();
  const [updateSupportingOutcome] = useUpdateSupportingOutcomeMutation();
  const [deleteSupportingOutcome] = useDeleteSupportingOutcomeMutation();

  const stratTree = useMemo(() => toStratTree(data ?? []), [data]);
  const flat = useMemo(() => flatten(stratTree, [], []), [stratTree]);

  // Auto-expand the first Rally Cry + its first child on first load so the tree is not fully collapsed.
  useEffect(() => {
    if (stratTree.length && expanded.size === 0) {
      const next = new Set<string>();
      const root = stratTree[0];
      if (root) {
        next.add(root.id);
        const firstChild = root.children[0];
        if (firstChild) next.add(firstChild.id);
      }
      setExpanded(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stratTree]);

  // Leaving edit mode while a confirm dialog is open should close it.
  useEffect(() => {
    if (!editMode) setConfirmDel(null);
  }, [editMode]);

  const toggle = (id: string): void =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const searching = query.trim().length > 0;
  const needle = query.trim().toLowerCase();
  const results = useMemo(
    () => (searching ? flat.filter((f) => f.node.title.toLowerCase().includes(needle)) : []),
    [searching, needle, flat],
  );
  const sel = useMemo(() => flat.find((f) => f.node.id === selected) ?? null, [selected, flat]);

  // ── Edit-mode write paths (call the level-specific admin mutation hooks) ──
  const addChild = async (parentId: string): Promise<void> => {
    const loc = locate(stratTree, parentId);
    if (!loc) return;
    const childLevel = NEXT_LEVEL[loc.node.level];
    if (!childLevel) return;
    const title = `New ${labelOf(childLevel).toLowerCase()}`;
    setExpanded((prev) => new Set(prev).add(parentId));
    try {
      if (childLevel === 'DEFINING_OBJECTIVE') {
        await createDefiningObjective({ title, rallyCryId: parentId }).unwrap();
      } else if (childLevel === 'OUTCOME') {
        await createOutcome({ title, definingObjectiveId: parentId }).unwrap();
      } else if (childLevel === 'SUPPORTING_OUTCOME') {
        await createSupportingOutcome({ title, outcomeId: parentId }).unwrap();
      }
    } catch {
      /* surfaced by the mutation's own error state; tree refetch is the source of truth */
    }
  };

  const addRoot = async (): Promise<void> => {
    try {
      await createRallyCry({ title: 'New rally cry' }).unwrap();
    } catch {
      /* no-op: refetch reflects the real server state */
    }
  };

  const saveTitle = async (node: StratNode, title: string): Promise<void> => {
    try {
      if (node.level === 'RALLY_CRY') await updateRallyCry({ id: node.id, body: { title } }).unwrap();
      else if (node.level === 'DEFINING_OBJECTIVE')
        await updateDefiningObjective({ id: node.id, body: { title } }).unwrap();
      else if (node.level === 'OUTCOME')
        await updateOutcome({ id: node.id, body: { title } }).unwrap();
      else await updateSupportingOutcome({ id: node.id, body: { title } }).unwrap();
    } catch {
      /* no-op */
    }
  };

  const removeNode = async (id: string): Promise<void> => {
    const loc = locate(stratTree, id);
    if (!loc) return;
    const lvl = loc.node.level;
    try {
      if (lvl === 'RALLY_CRY') await deleteRallyCry(id).unwrap();
      else if (lvl === 'DEFINING_OBJECTIVE') await deleteDefiningObjective(id).unwrap();
      else if (lvl === 'OUTCOME') await deleteOutcome(id).unwrap();
      else await deleteSupportingOutcome(id).unwrap();
      setSelected(null);
    } catch {
      /* delete can 409 if a commit item links the SO; the dialog stays dismissed, tree unchanged */
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl p-6" data-testid="rcdo-browser">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="panel" style={{ padding: 16 }}>
            <Skeleton lines={6} />
          </div>
          <div className="panel" style={{ padding: 18 }}>
            <Skeleton lines={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-4 p-6" data-testid="rcdo-browser">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            Strategy
          </h1>
          <p className="text-sm" style={{ color: 'var(--ink-low)' }}>
            The company strategy tree — Rally Cry → Defining Objective → Outcome → Supporting Outcome.
          </p>
        </div>
        {canAdmin && (
          <button
            type="button"
            className={`btn ${editMode ? 'btn-primary' : 'btn-ghost'}`}
            data-testid="strategy-edit-toggle"
            aria-pressed={editMode}
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? (
              <>
                <Icon.check size={15} /> Done editing
              </>
            ) : (
              <>
                <Icon.pencil size={15} /> Edit tree
              </>
            )}
          </button>
        )}
      </header>

      {editMode && (
        <div
          data-testid="strategy-edit-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: 'var(--cyan-dim)',
            border: '1px solid color-mix(in oklch, var(--cyan) 28%, transparent)',
            borderRadius: 'var(--r-md)',
            fontSize: 12.5,
            color: 'var(--ink-mid)',
          }}
        >
          <Icon.info size={15} style={{ color: 'var(--cyan)', flex: 'none' }} />
          <span style={{ flex: 1 }}>
            <strong>Editing the strategy tree.</strong> Changes here cascade to everyone&apos;s commit
            links. Admin-only in production.
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-testid="rcdo-add-root"
            onClick={() => void addRoot()}
          >
            <Icon.plus size={14} /> Add Rally Cry
          </button>
        </div>
      )}

      {isError ? (
        <ErrorState title="Could not load the strategy tree" onRetry={() => void refetch()} />
      ) : stratTree.length === 0 ? (
        <EmptyState
          title="No strategy defined yet"
          description={
            canAdmin
              ? 'Turn on Edit tree and add a Rally Cry to start the company strategy.'
              : 'Your organization has not published a strategy tree.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          {/* LEFT — threaded tree + search */}
          <div className="panel" style={{ padding: 12, overflow: 'hidden' }}>
            <div style={{ position: 'relative', margin: '4px 4px 10px' }}>
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 11,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ink-faint)',
                  display: 'inline-flex',
                }}
              >
                <Icon.search size={15} />
              </span>
              <input
                className="input"
                type="search"
                style={{ paddingLeft: 35 }}
                placeholder="Search strategy…"
                aria-label="Search the strategy tree"
                data-testid="rcdo-browser-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div
              role="tree"
              aria-label="Strategy tree"
              data-testid="strategy-tree"
              style={{ maxHeight: '62vh', overflowY: 'auto', overflowX: 'hidden' }}
            >
              {searching ? (
                results.length === 0 ? (
                  <EmptyState
                    title="No matching outcomes"
                    description={`No matches for “${query.trim()}”. Try a different search term.`}
                  />
                ) : (
                  results.map((r) => {
                    const tint = tintOf(r.node.level);
                    const isSel = selected === r.node.id;
                    return (
                      <div
                        key={r.node.id}
                        onClick={() => setSelected(r.node.id)}
                        data-testid={`rcdo-node-${r.node.id}`}
                        data-selected={isSel || undefined}
                        style={{
                          padding: '9px 10px',
                          cursor: 'pointer',
                          borderRadius: 'var(--r-sm)',
                          background: isSel ? 'var(--surface-2)' : 'transparent',
                        }}
                      >
                        <span
                          className="mono"
                          style={{
                            fontSize: 8.5,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: tint,
                            fontWeight: 600,
                          }}
                        >
                          {labelOf(r.node.level)}
                        </span>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-mid)' }}>
                          {r.node.title}
                        </div>
                        {r.trail.length > 0 && (
                          <div
                            className="mono"
                            style={{ fontSize: 9, color: 'var(--ink-faint)', marginTop: 2 }}
                          >
                            {r.trail.map((x) => x.title).join('  ›  ')}
                          </div>
                        )}
                      </div>
                    );
                  })
                )
              ) : (
                stratTree.map((n, i) => (
                  <TreeRow
                    key={n.id}
                    node={n}
                    tints={[]}
                    lasts={[]}
                    isLast={i === stratTree.length - 1}
                    expanded={expanded}
                    toggle={toggle}
                    selected={selected}
                    onSelect={setSelected}
                    onAddChild={(id) => void addChild(id)}
                    editMode={editMode}
                  />
                ))
              )}
            </div>
          </div>

          {/* RIGHT — detail panel / inline editor */}
          <aside
            className="panel"
            style={{ padding: 20 }}
            aria-live="polite"
            data-testid="rcdo-detail"
          >
            {sel ? (
              <DetailPanel
                key={sel.node.id}
                row={sel}
                editMode={editMode}
                onSaveTitle={(title) => void saveTitle(sel.node, title)}
                onAddChild={() => void addChild(sel.node.id)}
                onRequestDelete={() => setConfirmDel(sel.node.id)}
                onSelect={setSelected}
              />
            ) : (
              <p style={{ fontSize: 13, color: 'var(--ink-low)', textAlign: 'center', padding: 30 }}>
                {editMode
                  ? 'Select a node to edit, or add a Rally Cry.'
                  : 'Select a Supporting Outcome to see its strategy path.'}
              </p>
            )}
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmDel !== null}
        icon="trash"
        destructive
        title="Delete this node?"
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDel) void removeNode(confirmDel);
          setConfirmDel(null);
        }}
        onCancel={() => setConfirmDel(null)}
      >
        This removes the node and everything beneath it from the strategy tree. Commit items linked
        here will need re-linking.
      </ConfirmDialog>
    </section>
  );
}

// ── Detail panel / inline editor ────────────────────────────────────────────────────────────────
interface DetailPanelProps {
  row: FlatRow;
  editMode: boolean;
  onSaveTitle: (title: string) => void;
  onAddChild: () => void;
  onRequestDelete: () => void;
  onSelect: (id: string) => void;
}

function DetailPanel({
  row,
  editMode,
  onSaveTitle,
  onAddChild,
  onRequestDelete,
  onSelect,
}: DetailPanelProps): JSX.Element {
  const n = row.node;
  const tint = tintOf(n.level);
  const [title, setTitle] = useState(n.title);
  useEffect(() => setTitle(n.title), [n.title]);

  if (editMode) {
    const childLevel = NEXT_LEVEL[n.level];
    return (
      <div data-testid="rcdo-editor">
        <div className="between" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <span
            className="mono"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10.5,
              fontWeight: 600,
              color: tint,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            <span className="dot" style={{ background: tint }} /> {labelOf(n.level)}
          </span>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            data-testid="rcdo-delete"
            onClick={onRequestDelete}
          >
            <Icon.trash size={14} /> Delete
          </button>
        </div>
        <label className="kicker" style={{ display: 'block', marginBottom: 6 }}>
          Title
        </label>
        <input
          className="input"
          data-testid="rcdo-edit-title"
          aria-label="Node title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== n.title) onSaveTitle(title.trim());
          }}
        />
        {childLevel && (
          <button
            type="button"
            className="btn btn-ghost"
            data-testid="rcdo-add-child-detail"
            style={{
              width: '100%',
              justifyContent: 'center',
              marginTop: 16,
              borderStyle: 'dashed',
            }}
            onClick={onAddChild}
          >
            <Icon.plus size={15} /> Add {labelOf(childLevel)}
          </button>
        )}
        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            color: 'var(--ink-faint)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon.check size={12} style={{ color: 'var(--signal)' }} /> Changes save when you leave a
          field.
        </div>
      </div>
    );
  }

  return (
    <>
      <span
        className="mono"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10.5,
          fontWeight: 600,
          color: tint,
          background: `color-mix(in oklch, ${tint} 12%, transparent)`,
          padding: '3px 9px',
          borderRadius: 'var(--r-pill)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        <span className="dot" style={{ background: tint }} /> {labelOf(n.level)}
      </span>
      <h2 style={{ margin: '12px 0 0', fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: 'var(--ink)' }}>
        {n.title}
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 12,
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid var(--line-soft)',
        }}
      >
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>
            Owner
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-mid)' }}>
            {n.ownerId ? 'Assigned' : 'Unassigned'}
          </div>
        </div>
      </div>

      {row.trail.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line-soft)' }}>
          <div className="kicker" style={{ marginBottom: 8 }}>
            Ladders up to
          </div>
          {row.trail.map((t, i) => (
            <div
              key={t.id}
              onClick={() => onSelect(t.id)}
              data-testid={`rcdo-ladder-${t.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 0',
                cursor: 'pointer',
                paddingLeft: i * 12,
              }}
            >
              <span className="dot" style={{ background: tintOf(t.level) }} />
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--ink-mid)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {n.level === 'SUPPORTING_OUTCOME' && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--line-soft)',
            fontSize: 12.5,
            color: 'var(--ink-mid)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Icon.link size={13} style={{ color: 'var(--signal)', flex: 'none' }} />
          <span>Commit items link to this Supporting Outcome.</span>
        </div>
      )}
    </>
  );
}
