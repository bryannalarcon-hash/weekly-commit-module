// apps/wc-remote/src/components/RcdoPicker.tsx — the RCDO Supporting-Outcome picker (U18, brief §6.3.1).
// A modal wrapping the accessible RcdoTree: a typeahead filter narrows the tree to matching leaves (and
// their ancestor paths), the modal traps focus and returns focus to the trigger on close, and choosing a
// leaf emits the FULL SupportingOutcomeDto + breadcrumb via onSelect. Data comes from RTK Query
// (getRcdoTree); loading/empty/error states use the shared primitives. onClear clears the link.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, TextInput } from 'flowbite-react';
import { useGetRcdoTreeQuery } from '@wcm/api';
import type {
  RallyCryNode,
  SupportingOutcomeDto,
} from '@wcm/types';
import { EmptyState, ErrorState, Skeleton } from '@wcm/ui';
import { RcdoTree, type RcdoSelection } from './RcdoTree';

export interface RcdoPickerProps {
  open: boolean;
  /** Currently-linked Supporting Outcome id (for aria-selected highlight). */
  selectedId?: string | null;
  onSelect: (selection: RcdoSelection) => void;
  onClose: () => void;
}

/** Filter the tree to branches that contain a leaf whose title matches `q` (case-insensitive). */
export function filterTree(tree: RallyCryNode[], q: string): RallyCryNode[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return tree;
  const matchLeaf = (so: SupportingOutcomeDto): boolean =>
    so.title.toLowerCase().includes(needle);
  return tree
    .map((rc) => ({
      ...rc,
      definingObjectives: rc.definingObjectives
        .map((dobj) => ({
          ...dobj,
          outcomes: dobj.outcomes
            .map((o) => ({
              ...o,
              supportingOutcomes: o.supportingOutcomes.filter(matchLeaf),
            }))
            .filter((o) => o.supportingOutcomes.length > 0),
        }))
        .filter((dobj) => dobj.outcomes.length > 0),
    }))
    .filter((rc) => rc.definingObjectives.length > 0);
}

export function RcdoPicker({
  open,
  selectedId,
  onSelect,
  onClose,
}: RcdoPickerProps): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetRcdoTreeQuery(undefined, {
    skip: !open,
  });
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLElement | null>(null);

  // Capture the element that had focus when the modal opened, restore it on close.
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
    } else if (triggerRef.current) {
      triggerRef.current.focus?.();
      triggerRef.current = null;
    }
  }, [open]);

  const filtered = useMemo(
    () => filterTree(data ?? [], query),
    [data, query],
  );

  const handleSelect = (sel: RcdoSelection): void => {
    onSelect(sel);
    onClose();
  };

  return (
    <Modal show={open} size="lg" onClose={onClose} data-testid="rcdo-picker">
      <Modal.Header>
        <span id="rcdo-picker-title">Link a Supporting Outcome</span>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-3">
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search supporting outcomes…"
            aria-label="Search supporting outcomes"
            data-testid="rcdo-search"
            autoFocus
          />
          {isLoading && <Skeleton lines={6} />}
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
            <RcdoTree
              tree={filtered}
              selectedId={selectedId}
              onSelect={handleSelect}
              ariaLabelledBy="rcdo-picker-title"
            />
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
}
