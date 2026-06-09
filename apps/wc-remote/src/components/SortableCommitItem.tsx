// apps/wc-remote/src/components/SortableCommitItem.tsx — one editable row of the EditCommit composer
// (brief §6.3). A @dnd-kit sortable row: a keyboard-accessible drag HANDLE (the DndContext in EditCommit
// wires the KeyboardSensor + sortableKeyboardCoordinates so reorder works without a mouse), inline-edit
// text, the chess-tier select, a "Link / change" RCDO button showing the linked outcome chip (or the
// unlinked warning), and delete. Emits granular callbacks; the parent (EditCommit) owns the items array.
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, TextInput } from 'flowbite-react';
import type { ChessTier, CommitItemDto } from '@wcm/types';
import { RcdoChip } from '@wcm/ui';
import { ChessTierSelect } from './ChessTierSelect';

export interface SortableCommitItemProps {
  item: CommitItemDto;
  /** 1-based display index for accessible labelling of the handle. */
  index: number;
  total: number;
  /** Title of the linked Supporting Outcome (parent resolves from the picker selection). */
  outcomeTitle?: string | null;
  onTextChange: (id: string, text: string) => void;
  onTierChange: (id: string, tier: ChessTier) => void;
  onOpenPicker: (id: string) => void;
  onClearLink: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SortableCommitItem({
  item,
  index,
  total,
  outcomeTitle,
  onTextChange,
  onTierChange,
  onOpenPicker,
  onClearLink,
  onDelete,
}: SortableCommitItemProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid="composer-item"
      data-item-id={item.id}
      className="flex items-start gap-2 rounded border border-slate-200 bg-white px-3 py-3"
    >
      {/* Keyboard-accessible reorder handle: Space/Enter picks up, arrows move, Space drops. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder “${item.text || 'new item'}”, position ${index} of ${total}`}
        data-testid="drag-handle"
        className="mt-1 cursor-grab touch-none rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden focusable="false">
          <path d="M7 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm9-12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
        </svg>
      </button>

      <div className="min-w-0 flex-1 space-y-2">
        <TextInput
          value={item.text}
          onChange={(e) => onTextChange(item.id, e.target.value)}
          placeholder="What will you commit to this week?"
          aria-label={`Commit item ${index} text`}
          data-testid="item-text"
          sizing="sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <ChessTierSelect
            id={`tier-${item.id}`}
            value={item.chessTier}
            onChange={(tier) => onTierChange(item.id, tier)}
          />
          {item.supportingOutcomeId ? (
            <RcdoChip
              title={outcomeTitle ?? 'Linked outcome'}
              onClear={() => onClearLink(item.id)}
            />
          ) : (
            <RcdoChip title={null} />
          )}
          <Button
            size="xs"
            color="light"
            onClick={() => onOpenPicker(item.id)}
            data-testid="link-outcome"
          >
            {item.supportingOutcomeId ? 'Change outcome' : 'Link outcome'}
          </Button>
        </div>
      </div>

      <Button
        size="xs"
        color="light"
        onClick={() => onDelete(item.id)}
        aria-label={`Delete item ${index}`}
        data-testid="delete-item"
        className="mt-0.5"
      >
        Delete
      </Button>
    </li>
  );
}
