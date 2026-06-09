// libs/ui/src/ConfirmDialog.test.tsx — verifies the confirm dialog only renders when open, wires the
// confirm/cancel callbacks, and disables actions while busy.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

const noop = (): void => undefined;

describe('ConfirmDialog', () => {
  it('does not render content when closed', () => {
    render(
      <ConfirmDialog open={false} title="Lock this week?" onConfirm={noop} onCancel={noop}>
        Locking freezes your plan for the week.
      </ConfirmDialog>,
    );
    expect(screen.queryByText(/locking freezes/i)).not.toBeInTheDocument();
  });

  it('shows the consequence text and fires confirm/cancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Lock this week?"
        confirmLabel="Lock week"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        Locking freezes your plan for the week.
      </ConfirmDialog>,
    );
    expect(screen.getByText(/locking freezes your plan/i)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('confirm-accept'));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByTestId('confirm-cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables both buttons while busy', () => {
    render(
      <ConfirmDialog open busy title="Lock?" onConfirm={noop} onCancel={noop}>
        body
      </ConfirmDialog>,
    );
    expect(screen.getByTestId('confirm-accept')).toBeDisabled();
    expect(screen.getByTestId('confirm-cancel')).toBeDisabled();
  });
});
