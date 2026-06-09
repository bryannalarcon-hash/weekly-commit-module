// apps/wc-remote/src/screens/EditCommit.tsx — the core weekly authoring screen (brief §6.3, U19),
// re-skinned to the WCM c-design (prototype/wcm/page-edit.jsx + screenshots/02-edit-commit). Header
// (back to My Week, "Edit your weekly commit", AutosaveIndicator, "Submit & lock" disabled until EVERY
// item is linked AND there is >=1 item), the amber ValidationSummary, a violet carry-forward block
// (Mark done / Keep / Drop, all via the existing updateCommit flow — Keep is a no-op, Mark done/Drop
// remove the carried item from this week's plan), the EDIT-mode CommitItemRow composer list with a
// @dnd-kit drag grip (the KEYBOARD-ACCESSIBLE reorder is preserved via KeyboardSensor +
// sortableKeyboardCoordinates wired into the row's dragHandleProps), inline title, ChessSelector, an
// RcdoChip that opens the @wcm/ui RcdoPickerDrawer, a dashed "+ Add commit item" button, and the thin
// Pulse. The drawer is populated from useGetRcdoTreeQuery and emits the full SupportingOutcome on select;
// onSelect sets the item's supportingOutcomeId through the existing debounced autosave (updateCommit).
//
// Data layer UNCHANGED (RTK Query only). Autosave is debounced (400ms) via updateCommit; the timer is
// cleared on unmount (no stray PUT/setState on a dead node) and Submit/Lock FLUSHES any pending autosave
// FIRST so the lock never freezes a pre-edit plan. Preserves every load-bearing testid: edit-commit,
// add-item, add-first-item, composer-list, composer-item, item-text, link-outcome, delete-item,
// drag-handle, chess-tier-select, submit-lock, validation-summary, confirm-accept, rcdo-picker, rcdo-tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ChessTier, CommitDto, CommitItemDto } from '@wcm/types';
import {
  useGetCommitQuery,
  useGetPulseQuery,
  useGetRcdoTreeQuery,
  usePutPulseMutation,
  useSubmitCommitMutation,
  useUpdateCommitMutation,
} from '@wcm/api';
import {
  AutosaveIndicator,
  CarriedForwardCard,
  ChessSelector,
  ConfirmDialog,
  ErrorState,
  Icon,
  Pulse,
  RcdoChip,
  RcdoPickerDrawer,
  SectionTitle,
  Skeleton,
  ValidationSummary,
  type AutosaveStatus,
  type RcdoSelection,
} from '@wcm/ui';
import { formatWeekRange } from '../lib/week';

/** A draft id generator for not-yet-persisted items (replaced by the server id on save). */
let draftSeq = 0;
function newDraftItem(): CommitItemDto {
  draftSeq += 1;
  return {
    id: `draft-${draftSeq}-${Math.random().toString(16).slice(2, 8)}`,
    text: '',
    status: 'OPEN',
    supportingOutcomeId: null,
    chessTier: null,
    carriedFromItemId: null,
  };
}

export interface EditCommitProps {
  commitId: string;
  /** Called when the user backs out to the read-only My-Week view (header back link). */
  onBack?: () => void;
  /** Called after a successful lock so the parent can route to the read-only view. */
  onLocked?: (commit: CommitDto) => void;
}

/** One sortable composer row — the edit-mode CommitItemRow rendered as a @dnd-kit sortable <li> so the
 *  sortable node IS the measured/reorderable element. Mirrors @wcm/ui CommitItemRow's edit layout (the
 *  shared component can't forward the ref dnd-kit needs, so the row is composed here from the same atoms):
 *  a keyboard-accessible drag grip (drag-handle), an inline title input (item-text), the ChessSelector
 *  (chess-tier-select), an RcdoChip + "Link/Change outcome" trigger (link-outcome) that opens the picker
 *  drawer, and delete (delete-item). The left rail reads green when linked / amber when not. */
interface SortableComposerRowProps {
  item: CommitItemDto;
  outcomeTitle: string | null;
  onTextChange: (id: string, text: string) => void;
  onTierChange: (id: string, tier: ChessTier) => void;
  onOpenPicker: (id: string) => void;
  onClearLink: (id: string) => void;
  onDelete: (id: string) => void;
}

function SortableComposerRow({
  item,
  outcomeTitle,
  onTextChange,
  onTierChange,
  onOpenPicker,
  onClearLink,
  onDelete,
}: SortableComposerRowProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const linked = Boolean(item.supportingOutcomeId);
  return (
    <li
      ref={setNodeRef}
      data-testid="composer-item"
      data-item-id={item.id}
      className="panel flex"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        gap: 12,
        padding: '13px 15px',
        borderLeft: `3px solid ${linked ? 'var(--signal)' : 'var(--amber)'}`,
        alignItems: 'flex-start',
        listStyle: 'none',
      }}
    >
      {/* Keyboard-accessible reorder grip: Space/Enter picks up, arrows move, Space drops. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        data-testid="drag-handle"
        aria-label={`Reorder “${item.text || 'new item'}”`}
        className="grip touch-none"
        style={{
          color: 'var(--ink-faint)',
          background: 'none',
          border: 'none',
          cursor: 'grab',
          padding: '3px 0',
          marginTop: 2,
        }}
      >
        <Icon.grip size={16} />
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          className="input"
          data-testid="item-text"
          value={item.text}
          onChange={(e) => onTextChange(item.id, e.target.value)}
          placeholder="What will you commit to this week?"
          aria-label="Commit item text"
          style={{
            fontWeight: 600,
            fontSize: 14.5,
            border: '1px solid transparent',
            background: 'transparent',
            padding: '2px 4px',
            marginLeft: -4,
          }}
        />
        <div className="flex flex-wrap items-center" style={{ marginTop: 9, gap: 10 }}>
          <ChessSelector value={item.chessTier} onChange={(t) => onTierChange(item.id, t)} />
          <RcdoChip
            title={outcomeTitle}
            onClick={() => onOpenPicker(item.id)}
            onClear={linked ? () => onClearLink(item.id) : undefined}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-testid="link-outcome"
            onClick={() => onOpenPicker(item.id)}
          >
            {linked ? 'Change outcome' : 'Link outcome'}
          </button>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-quiet btn-sm"
        data-testid="delete-item"
        aria-label="Delete item"
        onClick={() => onDelete(item.id)}
        style={{ color: 'var(--ink-faint)', padding: 7, flex: 'none' }}
      >
        <Icon.trash size={16} />
      </button>
    </li>
  );
}

export function EditCommit({ commitId, onBack, onLocked }: EditCommitProps): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetCommitQuery(commitId);
  const { data: pulse } = useGetPulseQuery(commitId);
  // The RCDO tree gives us the title for every Supporting Outcome (so a previously-linked item shows
  // its real outcome name on load, not a generic placeholder) AND populates the picker drawer's tree.
  const { data: rcdoTree } = useGetRcdoTreeQuery();
  const [updateCommit] = useUpdateCommitMutation();
  const [submitCommit, submitState] = useSubmitCommitMutation();
  const [putPulse] = usePutPulseMutation();

  const [items, setItems] = useState<CommitItemDto[]>([]);
  // Titles for outcomes linked this session (picker selections), so the chip shows a name not an id.
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [autosave, setAutosave] = useState<AutosaveStatus>('idle');
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The most recent items handed to scheduleSave but not yet PUT — what a flush must persist.
  const pendingItems = useRef<CommitItemDto[] | null>(null);
  const hydrated = useRef(false);

  // Hydrate the local editing copy from the server once.
  useEffect(() => {
    if (data && !hydrated.current) {
      setItems(data.items);
      hydrated.current = true;
    }
  }, [data]);

  // Clear the pending debounce timer on unmount so it never fires updateCommit()/setState() against
  // an unmounted screen — the COMMON path (doLock → onLocked → nav, or any sub-nav within 400ms).
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // The one PUT path, shared by the debounce and the flush-before-lock. Returns the unwrapped promise
  // so a caller (doLock) can await the in-flight save before it locks.
  const runSave = useCallback(
    (next: CommitItemDto[]) => {
      pendingItems.current = null;
      setAutosave('saving');
      return updateCommit({
        id: commitId,
        body: {
          items: next.map((i) => ({
            text: i.text,
            supportingOutcomeId: i.supportingOutcomeId,
            chessTier: i.chessTier,
          })),
        },
      })
        .unwrap()
        .then(() => setAutosave('saved'))
        .catch(() => setAutosave('error'));
    },
    [commitId, updateCommit],
  );

  // Debounced autosave: remember the latest items, persist after 400ms idle.
  const scheduleSave = useCallback(
    (next: CommitItemDto[]) => {
      setAutosave('saving');
      pendingItems.current = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void runSave(next);
      }, 400);
    },
    [runSave],
  );

  // Cancel any pending debounce and persist its items NOW, awaiting the PUT. No-op when nothing is
  // pending. Used to flush before a lock so the POST /submit never races a stale plan onto the server.
  const flushSave = useCallback(async (): Promise<void> => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const next = pendingItems.current;
    if (next) await runSave(next);
  }, [runSave]);

  const mutate = useCallback(
    (next: CommitItemDto[]) => {
      setItems(next);
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const addItem = (): void => mutate([...items, newDraftItem()]);
  const deleteItem = (id: string): void => mutate(items.filter((i) => i.id !== id));
  const setText = (id: string, text: string): void =>
    mutate(items.map((i) => (i.id === id ? { ...i, text } : i)));
  const setTier = (id: string, chessTier: ChessTier): void =>
    mutate(items.map((i) => (i.id === id ? { ...i, chessTier } : i)));
  const clearLink = (id: string): void =>
    mutate(items.map((i) => (i.id === id ? { ...i, supportingOutcomeId: null } : i)));

  const onPicked = (sel: RcdoSelection): void => {
    if (!pickerFor) return;
    setTitles((t) => ({ ...t, [sel.outcome.id]: sel.outcome.title }));
    mutate(
      items.map((i) =>
        i.id === pickerFor ? { ...i, supportingOutcomeId: sel.outcome.id } : i,
      ),
    );
    setPickerFor(null);
  };

  const onDragEnd = (e: DragEndEvent): void => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    mutate(arrayMove(items, from, to));
  };

  // Split carried-forward items (lineage from a prior week) from this week's fresh composer items.
  const carried = useMemo(() => items.filter((i) => i.carriedFromItemId), [items]);
  const editable = useMemo(() => items.filter((i) => !i.carriedFromItemId), [items]);

  // Mirror the server guard: blockers = empty-text items + unlinked items (across ALL items).
  const unlinked = useMemo(() => items.filter((i) => !i.supportingOutcomeId).length, [items]);
  const blank = useMemo(() => items.filter((i) => !i.text.trim()).length, [items]);
  const canSubmit = items.length > 0 && unlinked === 0 && blank === 0;

  // Flatten the RCDO tree to a SupportingOutcome id → title map, so a linked item loaded from the
  // server resolves its real outcome name even when it wasn't picked this session.
  const outcomeTitles = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const rally of rcdoTree ?? []) {
      for (const dobj of rally.definingObjectives) {
        for (const outcome of dobj.outcomes) {
          for (const so of outcome.supportingOutcomes) {
            map[so.id] = so.title;
          }
        }
      }
    }
    return map;
  }, [rcdoTree]);

  const titleFor = (item: CommitItemDto): string | null =>
    item.supportingOutcomeId
      ? (titles[item.supportingOutcomeId] ?? outcomeTitles[item.supportingOutcomeId] ?? null)
      : null;

  const selectedIdForPicker = pickerFor
    ? (items.find((i) => i.id === pickerFor)?.supportingOutcomeId ?? null)
    : null;

  const doLock = (): void => {
    // Flush any pending/in-flight autosave FIRST so the lock freezes the just-edited plan, not a
    // stale one, and the late PUT cannot 409 against a now-LOCKED commit.
    void flushSave()
      .then(() => submitCommit(commitId).unwrap())
      .then((locked) => {
        setConfirmOpen(false);
        onLocked?.(locked);
      })
      .catch(() => setConfirmOpen(false));
  };

  if (isLoading) {
    return (
      <div className="page" data-testid="edit-commit">
        <div className="panel" style={{ padding: 20, marginBottom: 16 }}>
          <Skeleton lines={2} />
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <Skeleton lines={3} />
          <Skeleton lines={3} />
        </div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="page" data-testid="edit-commit">
        <ErrorState title="Could not load this week" onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="page" data-testid="edit-commit">
      {/* header */}
      <div className="ptitle">
        <div>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => onBack?.()}
            style={{ marginLeft: -8, marginBottom: 6, color: 'var(--ink-low)' }}
          >
            <Icon.chevL size={15} /> My Week
          </button>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Edit your weekly commit
          </h1>
          <div className="sub" style={{ marginTop: 4, color: 'var(--ink-low)', fontSize: 13.5 }}>
            {formatWeekRange(data.weekStart)} · add your priorities and link each to strategy.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <AutosaveIndicator status={autosave} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={() => setConfirmOpen(true)}
            data-testid="submit-lock"
            title={!canSubmit ? 'Link every item first' : 'Lock your plan'}
          >
            <Icon.lock size={15} /> Submit &amp; lock
          </button>
        </div>
      </div>

      {/* validation blocker (only meaningful once there's at least one item) */}
      {items.length > 0 && unlinked > 0 && (
        <div style={{ marginBottom: 16 }}>
          <ValidationSummary count={unlinked} />
        </div>
      )}

      {/* carry-forward block */}
      {carried.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionTitle kicker="From last week" title="Carry forward" />
          <div className="stack" style={{ gap: 10 }}>
            {carried.map((i) => (
              <CarriedForwardCard
                key={i.id}
                text={i.text}
                chessTier={i.chessTier}
                actions={
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => deleteItem(i.id)}
                    >
                      <Icon.check size={14} /> Mark done
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      title="Keep it on this week"
                    >
                      <Icon.carry size={14} /> Keep
                    </button>
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => deleteItem(i.id)}
                      style={{ color: 'var(--ink-faint)' }}
                    >
                      <Icon.x size={14} /> Drop
                    </button>
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* composer */}
      <SectionTitle
        title="This week's commit items"
        right={
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-low)' }}>
            {editable.length} item{editable.length !== 1 ? 's' : ''}
          </span>
        }
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={editable.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="stack" style={{ gap: 10 }} data-testid="composer-list">
            {editable.map((item) => (
              <SortableComposerRow
                key={item.id}
                item={item}
                outcomeTitle={titleFor(item)}
                onTextChange={setText}
                onTierChange={setTier}
                onOpenPicker={setPickerFor}
                onClearLink={clearLink}
                onDelete={deleteItem}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        className="btn btn-ghost"
        data-testid="add-item"
        onClick={addItem}
        style={{
          marginTop: 12,
          width: '100%',
          justifyContent: 'center',
          borderStyle: 'dashed',
          padding: '12px',
        }}
      >
        <Icon.plus size={16} /> Add commit item
      </button>

      {editable.length === 0 && (
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          data-testid="add-first-item"
          onClick={addItem}
          style={{
            marginTop: 8,
            width: '100%',
            justifyContent: 'center',
            color: 'var(--ink-low)',
            fontSize: 13,
          }}
        >
          Add your first priority for the week.
        </button>
      )}

      {/* pulse */}
      <div className="panel" style={{ padding: 18, marginTop: 24 }}>
        <div className="between" style={{ marginBottom: 12 }}>
          <SectionTitle title="Weekly pulse" className="mb-0" />
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
            OPTIONAL
          </span>
        </div>
        <Pulse
          value={pulse ?? { rating: null, comment: null, privateToManager: false }}
          onChange={(next) =>
            void putPulse({
              commitId,
              body: {
                rating: next.rating ?? 1,
                comment: next.comment,
                privateToManager: next.privateToManager,
              },
            })
          }
        />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        icon="lock"
        title="Lock this week?"
        confirmLabel="Submit & lock"
        busy={submitState.isLoading}
        onConfirm={doLock}
        onCancel={() => setConfirmOpen(false)}
      >
        Locking freezes your plan for the week — no more edits until reconciliation. Your manager is
        notified and a calendar event is created if Outlook is connected.
      </ConfirmDialog>

      {pickerFor !== null && (
        <RcdoPickerDrawer
          tree={rcdoTree ?? []}
          selectedId={selectedIdForPicker}
          onSelect={onPicked}
          onClear={() => {
            clearLink(pickerFor);
            setPickerFor(null);
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}
