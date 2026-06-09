// apps/wc-remote/src/components/RcdoTree.tsx — the WAI-ARIA treeview at the heart of the RCDO picker
// (U18, brief §6.3.1). Renders the 4-level strategy tree (Rally Cry → Defining Objective → Outcome →
// Supporting Outcome) as a single roving-tabindex tree: role=tree/treeitem, aria-level/expanded/
// selected/setsize/posinset. Keyboard: Up/Down move, Right/Left expand-or-descend / collapse-or-ascend,
// Enter/Space selects a LEAF (Supporting Outcome), Home/End jump, and printable keys do typeahead.
// Selecting a leaf emits the FULL SupportingOutcomeDto + its breadcrumb path. Pure/presentational —
// the parent owns data fetching and the selected value.
import { useCallback, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type {
  RallyCryNode,
  SupportingOutcomeDto,
} from '@wcm/types';
import type { RcdoPath } from '@wcm/ui';
import { ChevronDownIcon, ChevronRightIcon } from '@wcm/ui';

/** What the picker emits when a Supporting Outcome leaf is chosen. */
export interface RcdoSelection {
  outcome: SupportingOutcomeDto;
  path: RcdoPath;
}

/** A flattened, render-ready node in document order (the tree is fully expanded for keyboard nav). */
interface FlatNode {
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4;
  /** True for Supporting Outcome leaves (selectable). */
  isLeaf: boolean;
  /** The breadcrumb path to this node (root → here). */
  path: RcdoPath;
  /** The full leaf DTO (only for leaves). */
  leaf?: SupportingOutcomeDto;
  /** posinset / setsize among siblings (1-based) for aria. */
  posinset: number;
  setsize: number;
  parentId: string | null;
}

/** Flatten the 4-level tree into ordered nodes carrying aria metadata + breadcrumb path. */
function flatten(tree: RallyCryNode[]): FlatNode[] {
  const out: FlatNode[] = [];
  tree.forEach((rc, ri) => {
    const rcPath = { rallyCry: rc.title, definingObjective: '', outcome: '', supportingOutcome: '' };
    out.push({
      id: rc.id,
      title: rc.title,
      level: 1,
      isLeaf: false,
      path: { ...rcPath },
      posinset: ri + 1,
      setsize: tree.length,
      parentId: null,
    });
    rc.definingObjectives.forEach((dobj, di) => {
      const doPath = { ...rcPath, definingObjective: dobj.title };
      out.push({
        id: dobj.id,
        title: dobj.title,
        level: 2,
        isLeaf: false,
        path: { ...doPath },
        posinset: di + 1,
        setsize: rc.definingObjectives.length,
        parentId: rc.id,
      });
      dobj.outcomes.forEach((o, oi) => {
        const oPath = { ...doPath, outcome: o.title };
        out.push({
          id: o.id,
          title: o.title,
          level: 3,
          isLeaf: false,
          path: { ...oPath },
          posinset: oi + 1,
          setsize: dobj.outcomes.length,
          parentId: dobj.id,
        });
        o.supportingOutcomes.forEach((so, si) => {
          out.push({
            id: so.id,
            title: so.title,
            level: 4,
            isLeaf: true,
            path: { ...oPath, supportingOutcome: so.title },
            leaf: so,
            posinset: si + 1,
            setsize: o.supportingOutcomes.length,
            parentId: o.id,
          });
        });
      });
    });
  });
  return out;
}

export interface RcdoTreeProps {
  tree: RallyCryNode[];
  /** Currently-selected Supporting Outcome id (for aria-selected). */
  selectedId?: string | null;
  onSelect: (selection: RcdoSelection) => void;
  /** Optional id for the tree root (for aria-labelledby wiring by the parent). */
  ariaLabelledBy?: string;
}

export function RcdoTree({
  tree,
  selectedId,
  onSelect,
  ariaLabelledBy,
}: RcdoTreeProps): JSX.Element {
  const flat = useMemo(() => flatten(tree), [tree]);
  // Which non-leaf nodes are expanded. Start fully expanded so all leaves are reachable.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(flat.filter((n) => !n.isLeaf).map((n) => n.id)),
  );
  const [activeId, setActiveId] = useState<string | null>(flat[0]?.id ?? null);
  const typeahead = useRef<{ buffer: string; at: number }>({ buffer: '', at: 0 });
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  /** Visible nodes = those whose every ancestor is expanded. */
  const visible = useMemo(() => {
    const byId = new Map(flat.map((n) => [n.id, n]));
    return flat.filter((n) => {
      let p = n.parentId;
      while (p) {
        if (!expanded.has(p)) return false;
        p = byId.get(p)?.parentId ?? null;
      }
      return true;
    });
  }, [flat, expanded]);

  const focusNode = useCallback((id: string) => {
    setActiveId(id);
    // Roving tabindex: move DOM focus to the newly-active treeitem.
    requestAnimationFrame(() => itemRefs.current.get(id)?.focus());
  }, []);

  const toggle = useCallback((id: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectLeaf = useCallback(
    (node: FlatNode) => {
      if (node.isLeaf && node.leaf) onSelect({ outcome: node.leaf, path: node.path });
    },
    [onSelect],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, node: FlatNode) => {
      const idx = visible.findIndex((n) => n.id === node.id);
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const next = visible[Math.min(idx + 1, visible.length - 1)];
          if (next) focusNode(next.id);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prev = visible[Math.max(idx - 1, 0)];
          if (prev) focusNode(prev.id);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (!node.isLeaf && !expanded.has(node.id)) {
            toggle(node.id, true);
          } else {
            const next = visible[idx + 1];
            if (next && next.parentId === node.id) focusNode(next.id);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (!node.isLeaf && expanded.has(node.id)) {
            toggle(node.id, false);
          } else if (node.parentId) {
            focusNode(node.parentId);
          }
          break;
        }
        case 'Home': {
          e.preventDefault();
          const first = visible[0];
          if (first) focusNode(first.id);
          break;
        }
        case 'End': {
          e.preventDefault();
          const last = visible[visible.length - 1];
          if (last) focusNode(last.id);
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (node.isLeaf) selectLeaf(node);
          else toggle(node.id, !expanded.has(node.id));
          break;
        }
        default: {
          // Typeahead: printable single char jumps to the next matching visible node.
          if (e.key.length === 1 && /\S/.test(e.key)) {
            const now = Date.now();
            const ta = typeahead.current;
            ta.buffer = now - ta.at > 800 ? e.key : ta.buffer + e.key;
            ta.at = now;
            const q = ta.buffer.toLowerCase();
            const start = idx + (ta.buffer.length > 1 ? 0 : 1);
            const ordered = [
              ...visible.slice(start),
              ...visible.slice(0, start),
            ];
            const match = ordered.find((n) => n.title.toLowerCase().startsWith(q));
            if (match) focusNode(match.id);
          }
          break;
        }
      }
    },
    [visible, expanded, focusNode, toggle, selectLeaf],
  );

  return (
    <div
      role="tree"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabelledBy ? undefined : 'Strategy tree'}
      data-testid="rcdo-tree"
      className="max-h-80 overflow-auto rounded border border-slate-200"
    >
      {visible.map((node) => {
        const isActive = node.id === activeId;
        const isSelected = node.isLeaf && node.leaf?.id === selectedId;
        return (
          <div
            key={node.id}
            ref={(el) => {
              if (el) itemRefs.current.set(node.id, el);
              else itemRefs.current.delete(node.id);
            }}
            role="treeitem"
            aria-level={node.level}
            aria-setsize={node.setsize}
            aria-posinset={node.posinset}
            aria-expanded={node.isLeaf ? undefined : expanded.has(node.id)}
            aria-selected={node.isLeaf ? isSelected : undefined}
            tabIndex={isActive ? 0 : -1}
            data-testid={`tree-item-${node.id}`}
            data-leaf={node.isLeaf || undefined}
            onKeyDown={(e) => onKeyDown(e, node)}
            onClick={() => {
              focusNode(node.id);
              if (node.isLeaf) selectLeaf(node);
              else toggle(node.id, !expanded.has(node.id));
            }}
            style={{ paddingLeft: `${0.5 + (node.level - 1) * 1.25}rem` }}
            className={[
              'flex cursor-pointer items-center gap-1.5 py-1.5 pr-2 text-sm',
              isActive ? 'bg-accent-50' : 'hover:bg-slate-50',
              isSelected ? 'font-semibold text-primary-800' : 'text-slate-700',
            ].join(' ')}
          >
            {!node.isLeaf &&
              (expanded.has(node.id) ? (
                <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              ) : (
                <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              ))}
            <span className={node.isLeaf ? 'ml-4' : ''}>{node.title}</span>
            {isSelected && (
              <span className="ml-auto text-xs text-accent-600">Selected</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
