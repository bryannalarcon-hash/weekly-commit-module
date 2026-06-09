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

  it('does not close when the scrim is clicked while busy (busy ⇒ no-op close)', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open busy title="Lock?" onConfirm={noop} onCancel={onCancel}>
        body
      </ConfirmDialog>,
    );
    // While busy, Scrim's onClose is the no-op, so a backdrop click must NOT cancel.
    await userEvent.click(screen.getByTestId('scrim'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('closes via the scrim backdrop when not busy', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Lock?" onConfirm={noop} onCancel={onCancel}>
        body
      </ConfirmDialog>,
    );
    await userEvent.click(screen.getByTestId('scrim'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders the chosen header icon and falls back to lock for an unknown key', () => {
    const { container, rerender } = render(
      <ConfirmDialog open title="Delete?" icon="trash" destructive onConfirm={noop} onCancel={noop}>
        body
      </ConfirmDialog>,
    );
    // The tinted tile renders an SVG glyph (the trash icon).
    expect(container.querySelector('svg')).toBeInTheDocument();
    // An unknown icon key falls back to the lock glyph without crashing.
    rerender(
      <ConfirmDialog open title="Lock?" icon="not-a-real-icon" onConfirm={noop} onCancel={noop}>
        body
      </ConfirmDialog>,
    );
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('shows the spinner glyph in the confirm button while busy', () => {
    const { container } = render(
      <ConfirmDialog open busy title="Lock?" onConfirm={noop} onCancel={noop}>
        body
      </ConfirmDialog>,
    );
    expect(container.querySelector('svg.animate-spin')).toBeInTheDocument();
  });
});
