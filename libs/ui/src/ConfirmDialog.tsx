// libs/ui/src/ConfirmDialog.tsx — the Submit/Lock confirmation dialog (brief §7) and a generic confirm.
// Wraps Flowbite's Modal: explains the consequence ("locking freezes your plan for the week"), with a
// confirm + cancel. Supports a busy state and a destructive intent. Returns focus to the trigger on close.
import type { ReactNode } from 'react';
import { Button, Modal } from 'flowbite-react';
import { SpinnerIcon } from './icons';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Body explaining the consequence of confirming. */
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** True while the confirmed action is in flight (disables buttons, shows spinner). */
  busy?: boolean;
  /** Renders the confirm button as destructive. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  return (
    <Modal
      show={open}
      size="md"
      onClose={onCancel}
      dismissible={!busy}
      data-testid="confirm-dialog"
    >
      <Modal.Header>{title}</Modal.Header>
      <Modal.Body>
        <div className="text-sm text-slate-600">{children}</div>
      </Modal.Body>
      <Modal.Footer>
        <Button
          color={destructive ? 'failure' : 'blue'}
          onClick={onConfirm}
          disabled={busy}
          data-testid="confirm-accept"
        >
          {busy && <SpinnerIcon className="mr-2 h-4 w-4" aria-hidden />}
          {confirmLabel}
        </Button>
        <Button
          color="gray"
          onClick={onCancel}
          disabled={busy}
          data-testid="confirm-cancel"
        >
          {cancelLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
