// libs/ui/src/CommitItemRow.test.tsx — proves the dual-mode commit row. READ mode renders the title +
// chess badge + breadcrumb; EDIT mode renders the inline title input (item-text), the chess selector,
// the link/change-outcome control (link-outcome), the keyboard drag-grip (drag-handle), and delete
// (delete-item) — all under the composer-item container. Also proves the left rail reads green when
// linked / amber when not. Imports the component DIRECTLY and exercises the REAL sibling primitives
// (ChessBadge/ChessSelector/RcdoChip/RcdoBreadcrumb) so the composition is verified end to end.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommitItemRow } from './CommitItemRow';

const PATH = {
  rallyCry: 'Execution discipline',
  definingObjective: 'Weekly heartbeat',
  outcome: '90% completion',
  supportingOutcome: 'Roll out the Weekly Commit Module',
};

describe('CommitItemRow', () => {
  it('read mode shows the title, chess badge and breadcrumb when linked', () => {
    render(
      <CommitItemRow
        id="i1"
        text="Ship the wizard"
        tier="KING"
        outcomeTitle="Roll out the Weekly Commit Module"
        outcomePath={PATH}
      />,
    );
    const row = screen.getByTestId('composer-item');
    expect(row).toHaveAttribute('data-item-id', 'i1');
    expect(row).toHaveTextContent('Ship the wizard');
    // Read mode renders the real ChessBadge (glyph-only) tagged with the tier.
    expect(screen.getByTestId('chess-tier-badge')).toHaveAttribute('data-tier', 'KING');
    expect(screen.getByTestId('rcdo-breadcrumb')).toBeInTheDocument();
    // No composer controls in read mode.
    expect(screen.queryByTestId('item-text')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drag-handle')).not.toBeInTheDocument();
  });

  it('edit mode exposes the composer controls with their load-bearing testids', () => {
    render(<CommitItemRow id="i2" text="Draft item" tier="ROOK" editable />);
    expect(screen.getByTestId('item-text')).toHaveValue('Draft item');
    // Edit mode renders the real ChessSelector radiogroup (testid chess-tier-select).
    expect(screen.getByTestId('chess-tier-select')).toBeInTheDocument();
    expect(screen.getByTestId('link-outcome')).toBeInTheDocument();
    expect(screen.getByTestId('delete-item')).toBeInTheDocument();
    const handle = screen.getByTestId('drag-handle');
    expect(handle.tagName).toBe('BUTTON');
    expect(handle).toHaveAttribute('aria-label', expect.stringMatching(/reorder/i));
  });

  it('left rail reads green when linked and amber when not', () => {
    const { rerender } = render(
      <CommitItemRow id="i3" text="X" editable outcomeTitle="Linked SO" />,
    );
    expect(screen.getByTestId('composer-item')).toHaveStyle({
      borderLeft: '3px solid var(--signal)',
    });
    rerender(<CommitItemRow id="i3" text="X" editable outcomeTitle={null} />);
    expect(screen.getByTestId('composer-item')).toHaveStyle({
      borderLeft: '3px solid var(--amber)',
    });
  });

  it('fires the edit callbacks (text, open picker, delete)', async () => {
    const onTextChange = vi.fn();
    const onOpenPicker = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <CommitItemRow
        id="i4"
        text=""
        tier="PAWN"
        editable
        onTextChange={onTextChange}
        onOpenPicker={onOpenPicker}
        onDelete={onDelete}
      />,
    );
    await user.type(screen.getByTestId('item-text'), 'a');
    expect(onTextChange).toHaveBeenCalledWith('a');
    await user.click(screen.getByTestId('link-outcome'));
    expect(onOpenPicker).toHaveBeenCalledOnce();
    await user.click(screen.getByTestId('delete-item'));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('the link-outcome label reflects whether an outcome is already linked', () => {
    const { rerender } = render(<CommitItemRow id="i5" text="X" editable outcomeTitle={null} />);
    expect(screen.getByTestId('link-outcome')).toHaveTextContent(/link outcome/i);
    rerender(<CommitItemRow id="i5" text="X" editable outcomeTitle="Some SO" />);
    expect(screen.getByTestId('link-outcome')).toHaveTextContent(/change outcome/i);
  });

  it('fires onTierChange via the embedded ChessSelector', async () => {
    const onTierChange = vi.fn();
    const user = userEvent.setup();
    render(<CommitItemRow id="i6" text="X" tier={null} editable onTierChange={onTierChange} />);
    // Pick the first tier radio in the embedded selector.
    const radios = within(screen.getByTestId('chess-tier-select')).getAllByRole('radio');
    await user.click(radios[0]!);
    expect(onTierChange).toHaveBeenCalledOnce();
    expect(typeof onTierChange.mock.calls[0]?.[0]).toBe('string');
  });

  it('fires onClearLink from the RcdoChip clear control when linked', async () => {
    const onClearLink = vi.fn();
    const user = userEvent.setup();
    render(
      <CommitItemRow
        id="i7"
        text="X"
        editable
        outcomeTitle="Linked SO"
        onClearLink={onClearLink}
      />,
    );
    // The RcdoChip exposes a clear affordance only when linked + onClear is wired.
    await user.click(screen.getByRole('button', { name: /clear|unlink|remove/i }));
    expect(onClearLink).toHaveBeenCalledOnce();
  });

  it('renders a done-toggle in read mode and fires onToggleDone, reflecting aria-pressed', async () => {
    const onToggleDone = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <CommitItemRow id="i8" text="Wrap up" showDone done={false} onToggleDone={onToggleDone} />,
    );
    const toggle = screen.getByRole('button', { name: /toggle complete/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(onToggleDone).toHaveBeenCalledOnce();
    // When done, the toggle is pressed and renders the check glyph.
    rerender(
      <CommitItemRow id="i8" text="Wrap up" showDone done onToggleDone={onToggleDone} />,
    );
    expect(screen.getByRole('button', { name: /toggle complete/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('strikes the title when done in read mode', () => {
    render(<CommitItemRow id="i9" text="Finished item" showDone done />);
    const title = screen.getByText('Finished item');
    expect(title).toHaveStyle({ textDecoration: 'line-through' });
  });

  it('renders the carried-from lineage pill when carriedFromLabel is set', () => {
    render(<CommitItemRow id="i10" text="Rolled-over item" carriedFromLabel="W23" />);
    expect(screen.getByText(/carried from w23/i)).toBeInTheDocument();
  });

  it('spreads dragHandleProps onto the grip in edit mode', () => {
    render(
      <CommitItemRow
        id="i11"
        text="X"
        editable
        dragHandleProps={{ 'data-dnd': 'on', role: 'button' }}
      />,
    );
    expect(screen.getByTestId('drag-handle')).toHaveAttribute('data-dnd', 'on');
  });
});
