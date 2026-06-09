// apps/wc-remote/src/screens/EditCommit.tsx — the core weekly authoring screen (brief §6.3, U19).
// Item composer: add / delete / inline-edit / KEYBOARD-ACCESSIBLE reorder (@dnd-kit DndContext with the
// KeyboardSensor + sortableKeyboardCoordinates), a required RCDO Supporting-Outcome picker per item, the
// chess-tier select, a thin Pulse, and a Submit/Lock guarded until EVERY item is linked (mirrors the
// server DRAFT→LOCKED guard) with a validation summary + a lock confirm dialog. Autosaves via updateCommit
// (RTK Query) with an AutosaveIndicator. The debounce timer is cleared on unmount (no stray PUT/setState
// on a dead node), and Submit/Lock FLUSHES any pending autosave first so the lock never freezes a
// pre-edit plan. Locked commits redirect to the read-only My-Week view.
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button, Card } from 'flowbite-react';
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
  ConfirmDialog,
  ErrorState,
  LifecycleBadge,
  Skeleton,
  type AutosaveStatus,
} from '@wcm/ui';
import { SortableCommitItem } from '../components/SortableCommitItem';
import { ValidationSummary } from '../components/ValidationSummary';
import { PulseInput } from '../components/PulseInput';
import { RcdoPicker } from '../components/RcdoPicker';
import type { RcdoSelection } from '../components/RcdoTree';
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
  /** Called after a successful lock so the parent can route to the read-only view. */
  onLocked?: (commit: CommitDto) => void;
}

export function EditCommit({ commitId, onLocked }: EditCommitProps): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetCommitQuery(commitId);
  const { data: pulse } = useGetPulseQuery(commitId);
  // The RCDO tree gives us the title for every Supporting Outcome, so a previously-linked item shows
  // its real outcome name on load — not the generic "Linked outcome" (deferred fix). Picker selections
  // this session still win via the local `titles` map below.
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

  // Mirror the server guard: blockers = empty-text items + unlinked items.
  const blockers = useMemo<string[]>(() => {
    const out: string[] = [];
    const unlinked = items.filter((i) => !i.supportingOutcomeId).length;
    const blank = items.filter((i) => !i.text.trim()).length;
    if (items.length === 0) out.push('Add at least one commit item.');
    if (unlinked > 0)
      out.push(
        unlinked === 1
          ? '1 item needs a Supporting Outcome.'
          : `${unlinked} items need a Supporting Outcome.`,
      );
    if (blank > 0)
      out.push(blank === 1 ? '1 item has no text.' : `${blank} items have no text.`);
    return out;
  }, [items]);

  const canSubmit = blockers.length === 0;

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
      <div className="mx-auto max-w-3xl p-6" data-testid="edit-commit">
        <Skeleton lines={8} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl p-6" data-testid="edit-commit">
        <ErrorState
          title="Could not load this week"
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-6" data-testid="edit-commit">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary-900">
            {formatWeekRange(data.weekStart)}
          </h1>
          <p className="text-sm text-slate-500">
            Draft this week&apos;s commit. Link each item to a Supporting Outcome before you lock.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutosaveIndicator status={autosave} />
          <LifecycleBadge state={data.lifecycleState} />
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2" data-testid="composer-list">
            {items.map((item, idx) => (
              <SortableCommitItem
                key={item.id}
                item={item}
                index={idx + 1}
                total={items.length}
                outcomeTitle={
                  item.supportingOutcomeId
                    ? (titles[item.supportingOutcomeId] ??
                      outcomeTitles[item.supportingOutcomeId] ??
                      null)
                    : null
                }
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

      <Button color="light" onClick={addItem} data-testid="add-item">
        + Add a commit item
      </Button>

      <PulseInput
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

      <ValidationSummary blockers={blockers} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Locking freezes your plan for the week so you can reconcile it later.
          </p>
          <Button
            color="blue"
            disabled={!canSubmit}
            onClick={() => setConfirmOpen(true)}
            data-testid="submit-lock"
          >
            Submit &amp; lock
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Lock this week?"
        confirmLabel="Lock my week"
        busy={submitState.isLoading}
        onConfirm={doLock}
        onCancel={() => setConfirmOpen(false)}
      >
        Locking freezes your plan (item text, links, and priority) for the week. You will be able
        to reconcile what actually happened, but not change the plan. This action also schedules
        an Outlook event if you have that enabled.
      </ConfirmDialog>

      <RcdoPicker
        open={pickerFor !== null}
        selectedId={
          pickerFor ? (items.find((i) => i.id === pickerFor)?.supportingOutcomeId ?? null) : null
        }
        onSelect={onPicked}
        onClose={() => setPickerFor(null)}
      />
    </section>
  );
}
