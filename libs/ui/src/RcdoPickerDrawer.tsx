// libs/ui/src/RcdoPickerDrawer.tsx — the RCDO Supporting-Outcome picker (design rcdo-picker.jsx, U18,
// brief §6.3.1) re-skinned as a RIGHT-aligned 460px drawer. Two modes over the 4-level strategy tree
// (Rally Cry → Defining Objective → Outcome → Supporting Outcome): (1) a typeahead SEARCH across every
// Supporting Outcome (matches title + ancestor trail), and (2) a keyboard-navigable DRILL-IN tree
// (↑↓ move active · ↵ enter/descend or select a leaf · ← back a level) with level-colored rails and a
// breadcrumb. At the root it surfaces a "Suggested for you" shortlist of leaves. Selecting a leaf emits
// the FULL SupportingOutcomeDto + its breadcrumb path; "Clear link" emits null. Pure/presentational —
// the parent owns data fetching (RTK Query getRcdoTree) and the selected value.
//
// Preserves the load-bearing Cypress testids: rcdo-picker (the dialog), rcdo-tree (the option list), and
// tree-item-<id> on every option. Supporting-Outcome leaves carry aria-level={4} so the lifecycle E2E
// `[data-testid^="tree-item-"][aria-level="4"]` selector still resolves the first selectable leaf. The
// drawer is mounted in the Scrim primitive (sibling ./Scrim) which provides the right-aligned overlay +
// Escape-to-close.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { RallyCryNode, SupportingOutcomeDto } from '@wcm/types';
import type { RcdoPath } from './RcdoBreadcrumb';
import { Scrim } from './Scrim';
import { Icon } from './icons';
import { RCDO_LEVEL } from './tokens';

/** What the picker emits when a Supporting Outcome leaf is chosen (matches RcdoTree's RcdoSelection). */
export interface RcdoSelection {
  outcome: SupportingOutcomeDto;
  path: RcdoPath;
}

/** A renderable tree node at any of the 4 levels (drill nodes + leaves), with aria metadata + breadcrumb. */
interface DrillNode {
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4;
  /** Child nodes (empty for level-4 leaves). */
  children: DrillNode[];
  /** Full leaf DTO + breadcrumb path (only on leaves). */
  leaf?: SupportingOutcomeDto;
  path: RcdoPath;
}

/** Level number → the level's display label. */
const LEVEL_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: RCDO_LEVEL.RALLY_CRY.label,
  2: RCDO_LEVEL.DEFINING_OBJECTIVE.label,
  3: RCDO_LEVEL.OUTCOME.label,
  4: RCDO_LEVEL.SUPPORTING_OUTCOME.label,
};
/** Level number → the level's rail color (CSS-var reference). */
const LEVEL_TINT: Record<1 | 2 | 3 | 4, string> = {
  1: RCDO_LEVEL.RALLY_CRY.color,
  2: RCDO_LEVEL.DEFINING_OBJECTIVE.color,
  3: RCDO_LEVEL.OUTCOME.color,
  4: RCDO_LEVEL.SUPPORTING_OUTCOME.color,
};

/** Build the drill tree (carrying breadcrumb paths) from the contract RallyCryNode[] shape. */
function buildTree(tree: RallyCryNode[]): DrillNode[] {
  return tree.map((rc) => {
    const rcPath: RcdoPath = {
      rallyCry: rc.title,
      definingObjective: '',
      outcome: '',
      supportingOutcome: '',
    };
    return {
      id: rc.id,
      title: rc.title,
      level: 1,
      path: rcPath,
      children: rc.definingObjectives.map((dobj) => {
        const doPath: RcdoPath = { ...rcPath, definingObjective: dobj.title };
        return {
          id: dobj.id,
          title: dobj.title,
          level: 2 as const,
          path: doPath,
          children: dobj.outcomes.map((o) => {
            const oPath: RcdoPath = { ...doPath, outcome: o.title };
            return {
              id: o.id,
              title: o.title,
              level: 3 as const,
              path: oPath,
              children: o.supportingOutcomes.map((so) => ({
                id: so.id,
                title: so.title,
                level: 4 as const,
                path: { ...oPath, supportingOutcome: so.title },
                leaf: so,
                children: [],
              })),
            };
          }),
        };
      }),
    };
  });
}

/** Flatten to all leaves (for search + suggested shortlist). */
function allLeaves(tree: DrillNode[]): DrillNode[] {
  const out: DrillNode[] = [];
  const walk = (nodes: DrillNode[]): void => {
    for (const n of nodes) {
      if (n.level === 4) out.push(n);
      else walk(n.children);
    }
  };
  walk(tree);
  return out;
}

export interface RcdoPickerDrawerProps {
  /** The 4-level strategy tree (from RTK Query getRcdoTree). */
  tree: RallyCryNode[];
  /** Currently-linked Supporting Outcome id (highlight + enables "Clear link"). */
  selectedId?: string | null;
  /** Suggested Supporting Outcome ids surfaced at the root ("Suggested for you"). */
  suggestedIds?: string[];
  /** Fired with the full selection when a leaf is chosen. */
  onSelect: (selection: RcdoSelection) => void;
  /** Fired when the user clears the existing link (only shown when selectedId is set). */
  onClear?: () => void;
  /** Close the drawer (Escape / scrim click / X / after a pick). */
  onClose: () => void;
}

export function RcdoPickerDrawer({
  tree,
  selectedId,
  suggestedIds = [],
  onSelect,
  onClear,
  onClose,
}: RcdoPickerDrawerProps): JSX.Element {
  const roots = useMemo(() => buildTree(tree), [tree]);
  const leaves = useMemo(() => allLeaves(roots), [roots]);
  const [query, setQuery] = useState('');
  const [path, setPath] = useState<DrillNode[]>([]); // ancestor chain drilled into
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const searching = query.trim().length > 0;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return leaves.filter((l) => {
      const trail = [l.path.rallyCry, l.path.definingObjective, l.path.outcome]
        .join(' ')
        .toLowerCase();
      return l.title.toLowerCase().includes(q) || trail.includes(q);
    });
  }, [query, leaves]);

  const suggested = useMemo(
    () =>
      suggestedIds
        .map((id) => leaves.find((l) => l.id === id))
        .filter((n): n is DrillNode => Boolean(n)),
    [suggestedIds, leaves],
  );

  // The level currently shown in drill mode: children of the deepest drilled node, or the roots.
  const level = path.length ? (path[path.length - 1]?.children ?? []) : roots;
  const visible = searching ? results : level;

  useEffect(() => {
    setActive(0);
  }, [query, path.length]);

  const select = (node: DrillNode): void => {
    if (node.leaf) {
      onSelect({ outcome: node.leaf, path: node.path });
      onClose();
    }
  };

  /** Enter a node: descend if it has children, otherwise select the leaf. */
  const enter = (node: DrillNode): void => {
    if (node.level !== 4 && node.children.length) setPath((p) => [...p, node]);
    else select(node);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, visible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = visible[active];
      if (it) (searching ? select : enter)(it);
    } else if (
      (e.key === 'ArrowLeft' || (e.key === 'Backspace' && !query)) &&
      !searching &&
      path.length
    ) {
      e.preventDefault();
      setPath((p) => p.slice(0, -1));
    }
  };

  return (
    <Scrim onClose={onClose} align="right">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Link a Supporting Outcome"
        data-testid="rcdo-picker"
        onKeyDown={onKey}
        style={{
          width: 460,
          maxWidth: '100vw',
          height: '100vh',
          background: 'var(--surface-1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-pop)',
          animation: 'riseIn .22s ease both',
        }}
      >
        {/* header + search */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)' }}>
          <div className="between">
            <div>
              <div className="kicker">Link to strategy</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3 }}>Choose an outcome</div>
            </div>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon.x size={18} />
            </button>
          </div>
          <div style={{ position: 'relative', marginTop: 14 }}>
            <span
              style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ink-faint)',
              }}
            >
              <Icon.search size={16} />
            </span>
            <input
              ref={inputRef}
              className="input"
              type="search"
              data-testid="rcdo-search"
              style={{ paddingLeft: 36 }}
              placeholder="Search outcomes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search supporting outcomes"
            />
          </div>
        </div>

        {/* breadcrumb / back (drill mode only) */}
        {!searching && (
          <div
            className="flex items-center"
            style={{
              padding: '10px 20px',
              borderBottom: '1px solid var(--line-soft)',
              gap: 8,
              minHeight: 42,
              background: 'var(--surface-2)',
            }}
          >
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              data-testid="rcdo-back"
              disabled={!path.length}
              onClick={() => setPath((p) => p.slice(0, -1))}
              style={{ opacity: path.length ? 1 : 0.4 }}
              aria-label="Up one level"
            >
              <Icon.chevL size={15} />
            </button>
            <div
              className="mono flex flex-wrap items-center"
              style={{ gap: 6, fontSize: 10, letterSpacing: '0.04em', color: 'var(--ink-low)' }}
            >
              <button
                type="button"
                className="btn btn-quiet"
                style={{ padding: '2px 4px', fontSize: 10 }}
                onClick={() => setPath([])}
              >
                STRATEGY
              </button>
              {path.map((n, i) => (
                <span key={n.id} className="inline-flex items-center" style={{ gap: 6 }}>
                  <Icon.chevR size={11} style={{ opacity: 0.5 }} />
                  <button
                    type="button"
                    className="btn btn-quiet"
                    style={{ padding: '2px 4px', fontSize: 10, maxWidth: 140 }}
                    onClick={() => setPath((p) => p.slice(0, i + 1))}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {n.title}
                    </span>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 16px' }}>
          {searching ? (
            results.length === 0 ? (
              <div
                style={{ textAlign: 'center', padding: '44px 20px', color: 'var(--ink-low)' }}
                data-testid="rcdo-empty"
              >
                <Icon.search size={26} style={{ opacity: 0.5 }} />
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12, color: 'var(--ink)' }}>
                  No outcomes match “{query}”
                </div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>
                  Try a broader term, or browse the tree.
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 14 }}
                  onClick={() => setQuery('')}
                >
                  Browse strategy tree
                </button>
              </div>
            ) : (
              <div role="listbox" aria-label="Search results" data-testid="rcdo-tree">
                <div className="kicker" style={{ padding: '10px 10px 8px' }}>
                  {results.length} supporting outcome{results.length !== 1 ? 's' : ''}
                </div>
                {results.map((r, i) => (
                  <TreeOption
                    key={r.id}
                    node={r}
                    active={i === active}
                    selected={r.id === selectedId}
                    onActivate={() => select(r)}
                    onHover={() => setActive(i)}
                  />
                ))}
              </div>
            )
          ) : (
            <div role="listbox" aria-label="Strategy level" data-testid="rcdo-tree">
              {!path.length && suggested.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div
                    className="kicker inline-flex items-center"
                    style={{ padding: '10px 10px 8px', gap: 6 }}
                  >
                    <Icon.sparkle size={12} style={{ color: 'var(--signal)' }} /> Suggested for you
                  </div>
                  {suggested.map((n) => (
                    <TreeOption
                      key={`sug-${n.id}`}
                      node={n}
                      selected={n.id === selectedId}
                      onActivate={() => select(n)}
                    />
                  ))}
                  <div className="kicker" style={{ padding: '14px 10px 8px' }}>
                    Browse all strategy
                  </div>
                </div>
              )}
              {level.map((n, i) => (
                <TreeOption
                  key={n.id}
                  node={n}
                  active={i === active}
                  selected={n.id === selectedId}
                  onActivate={() => enter(n)}
                  onHover={() => setActive(i)}
                />
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div
          className="between"
          style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--line)',
            background: 'var(--surface-2)',
          }}
        >
          <span
            className="mono"
            style={{ fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--ink-faint)' }}
          >
            ↑↓ navigate · ↵ select · ← back
          </span>
          {selectedId && onClear && (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              data-testid="rcdo-clear"
              style={{ color: 'var(--red)' }}
              onClick={() => {
                onClear();
                onClose();
              }}
            >
              Clear link
            </button>
          )}
        </div>
      </div>
    </Scrim>
  );
}

interface TreeOptionProps {
  node: DrillNode;
  active?: boolean;
  selected?: boolean;
  onActivate: () => void;
  onHover?: () => void;
}

/** One option in the picker (a drill node OR a leaf). Carries the tree-item-<id> testid + aria-level. */
function TreeOption({ node, active, selected, onActivate, onHover }: TreeOptionProps): JSX.Element {
  const isLeaf = node.level === 4;
  const tint = LEVEL_TINT[node.level];
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-level={node.level}
      data-testid={`tree-item-${node.id}`}
      data-leaf={isLeaf || undefined}
      onMouseEnter={onHover}
      onClick={onActivate}
      className="flex items-center"
      style={{
        width: '100%',
        textAlign: 'left',
        gap: 11,
        padding: '11px 10px',
        borderRadius: 'var(--r-sm)',
        border: '1px solid',
        borderColor: active ? 'var(--line-bright)' : 'transparent',
        background: active ? 'var(--surface-2)' : selected ? 'var(--signal-dim)' : 'transparent',
        cursor: 'pointer',
      }}
    >
      <span
        style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: tint, flex: 'none' }}
        aria-hidden
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: tint,
            fontWeight: 600,
          }}
        >
          {LEVEL_LABEL[node.level]}
        </span>
        <span
          style={{ display: 'block', fontSize: 13.5, fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}
        >
          {node.title}
        </span>
      </span>
      {selected && <Icon.check size={16} style={{ color: 'var(--signal)', flex: 'none' }} />}
      {isLeaf ? (
        <span
          className="btn btn-primary btn-sm"
          style={{ pointerEvents: 'none', padding: '4px 9px' }}
          aria-hidden
        >
          Select
        </span>
      ) : (
        <Icon.chevR size={16} style={{ color: 'var(--ink-faint)', flex: 'none' }} />
      )}
    </button>
  );
}
