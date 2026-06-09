// libs/ui/src/RcdoPickerDrawer.test.tsx — proves the RCDO drawer's load-bearing contract: the dialog
// (rcdo-picker) + option list (rcdo-tree) render; the root surfaces Suggested-for-you LEAVES as
// tree-item-<id> with aria-level=4 (the lifecycle E2E clicks the first such leaf); drilling Rally Cry →
// Defining Objective → Outcome reveals deeper leaves; selecting a leaf emits the full SupportingOutcomeDto
// + breadcrumb and closes; typeahead filters; ↑↓/↵ keyboard nav works; and Clear link fires. Imports the
// component DIRECTLY and exercises the REAL Scrim primitive (right-aligned drawer overlay).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RallyCryNode } from '@wcm/types';
import { RcdoPickerDrawer } from './RcdoPickerDrawer';

const TREE: RallyCryNode[] = [
  {
    id: 'rc1',
    title: 'Become the system of record',
    definingObjectives: [
      {
        id: 'do1',
        title: 'Win the enterprise segment',
        outcomes: [
          {
            id: 'o1',
            title: 'Cut onboarding to 6 weeks',
            supportingOutcomes: [
              { id: 'so1', outcomeId: 'o1', title: 'Ship the data-mapping wizard', ownerId: null },
              { id: 'so2', outcomeId: 'o1', title: 'Automate feed reconciliation', ownerId: null },
            ],
          },
        ],
      },
    ],
  },
];

describe('RcdoPickerDrawer', () => {
  it('renders the dialog + tree and surfaces suggested level-4 leaves at the root', () => {
    render(
      <RcdoPickerDrawer tree={TREE} suggestedIds={['so1']} onSelect={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByTestId('rcdo-picker')).toBeInTheDocument();
    expect(screen.getByTestId('rcdo-tree')).toBeInTheDocument();
    // The lifecycle E2E selects [data-testid^="tree-item-"][aria-level="4"]: a suggested leaf qualifies.
    const leaf = screen.getByTestId('tree-item-so1');
    expect(leaf).toHaveAttribute('aria-level', '4');
  });

  it('clicking a level-4 leaf emits the full selection + breadcrumb and closes', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <RcdoPickerDrawer tree={TREE} suggestedIds={['so1']} onSelect={onSelect} onClose={onClose} />,
    );
    await user.click(screen.getByTestId('tree-item-so1'));
    expect(onSelect).toHaveBeenCalledWith({
      outcome: { id: 'so1', outcomeId: 'o1', title: 'Ship the data-mapping wizard', ownerId: null },
      path: {
        rallyCry: 'Become the system of record',
        definingObjective: 'Win the enterprise segment',
        outcome: 'Cut onboarding to 6 weeks',
        supportingOutcome: 'Ship the data-mapping wizard',
      },
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('drills from Rally Cry down to the Outcome to reveal its leaves', async () => {
    const user = userEvent.setup();
    render(<RcdoPickerDrawer tree={TREE} onSelect={vi.fn()} onClose={vi.fn()} />);
    const tree = screen.getByTestId('rcdo-tree');
    // Root shows the Rally Cry (level 1); no level-4 leaf yet (no suggestions passed).
    expect(within(tree).getByTestId('tree-item-rc1')).toHaveAttribute('aria-level', '1');
    await user.click(screen.getByTestId('tree-item-rc1')); // → Defining Objectives
    await user.click(screen.getByTestId('tree-item-do1')); // → Outcomes
    await user.click(screen.getByTestId('tree-item-o1')); // → Supporting Outcomes
    const leaf = screen.getByTestId('tree-item-so2');
    expect(leaf).toHaveAttribute('aria-level', '4');
  });

  it('typeahead filters to matching supporting outcomes', async () => {
    const user = userEvent.setup();
    render(<RcdoPickerDrawer tree={TREE} onSelect={vi.fn()} onClose={vi.fn()} />);
    await user.type(screen.getByTestId('rcdo-search'), 'reconciliation');
    expect(screen.getByTestId('tree-item-so2')).toBeInTheDocument();
    expect(screen.queryByTestId('tree-item-so1')).not.toBeInTheDocument();
  });

  it('shows an empty state when the search matches nothing', async () => {
    const user = userEvent.setup();
    render(<RcdoPickerDrawer tree={TREE} onSelect={vi.fn()} onClose={vi.fn()} />);
    await user.type(screen.getByTestId('rcdo-search'), 'zzzznomatch');
    expect(screen.getByTestId('rcdo-empty')).toHaveTextContent(/no outcomes match/i);
  });

  it('keyboard: ArrowDown moves active, Enter selects the active leaf', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <RcdoPickerDrawer
        tree={TREE}
        suggestedIds={['so1', 'so2']}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );
    // Search "wizard" → exactly one leaf (so1); the search input keeps focus so keydowns bubble to the
    // dialog's onKeyDown handler. Enter selects the active (first) result.
    const search = screen.getByTestId('rcdo-search');
    await user.type(search, 'wizard');
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0]?.[0]?.outcome.id).toBe('so1');
  });

  it('renders Clear link only when an outcome is already linked and fires onClear', async () => {
    const onClear = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <RcdoPickerDrawer tree={TREE} onSelect={vi.fn()} onClose={onClose} />,
    );
    expect(screen.queryByTestId('rcdo-clear')).not.toBeInTheDocument();
    rerender(
      <RcdoPickerDrawer
        tree={TREE}
        selectedId="so1"
        onClear={onClear}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByTestId('rcdo-clear'));
    expect(onClear).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keyboard: ArrowDown then ArrowUp move the active option back to the first', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <RcdoPickerDrawer
        tree={TREE}
        suggestedIds={['so1', 'so2']}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );
    // Two results in search keeps focus on the input so keydowns bubble to the dialog handler.
    const search = screen.getByTestId('rcdo-search');
    await user.type(search, 'the'); // matches both leaves' trail/title
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    // ArrowDown→1, ArrowUp→0 ⇒ Enter selects the first result (so1).
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0]?.[0]?.outcome.id).toBe('so1');
  });

  it('keyboard: Enter descends a drill node and ArrowLeft walks back up a level', async () => {
    const user = userEvent.setup();
    render(<RcdoPickerDrawer tree={TREE} onSelect={vi.fn()} onClose={vi.fn()} />);
    // Root shows the Rally Cry only; Enter on the active (first) option descends into it.
    await user.keyboard('{Enter}'); // rc1 → Defining Objectives
    expect(screen.getByTestId('tree-item-do1')).toBeInTheDocument();
    await user.keyboard('{Enter}'); // do1 → Outcomes
    expect(screen.getByTestId('tree-item-o1')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}'); // back to Defining Objectives
    expect(screen.getByTestId('tree-item-do1')).toBeInTheDocument();
    expect(screen.queryByTestId('tree-item-o1')).not.toBeInTheDocument();
  });

  it('the back button walks up a level and is disabled at the root', async () => {
    const user = userEvent.setup();
    render(<RcdoPickerDrawer tree={TREE} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('rcdo-back')).toBeDisabled();
    await user.click(screen.getByTestId('tree-item-rc1')); // descend
    const back = screen.getByTestId('rcdo-back');
    expect(back).not.toBeDisabled();
    await user.click(back); // back to root
    expect(screen.getByTestId('tree-item-rc1')).toBeInTheDocument();
    expect(screen.getByTestId('rcdo-back')).toBeDisabled();
  });

  it('the STRATEGY breadcrumb crumb resets the drill path to the root', async () => {
    const user = userEvent.setup();
    render(<RcdoPickerDrawer tree={TREE} onSelect={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByTestId('tree-item-rc1')); // → Defining Objectives
    await user.click(screen.getByTestId('tree-item-do1')); // → Outcomes
    await user.click(screen.getByRole('button', { name: 'STRATEGY' }));
    expect(screen.getByTestId('tree-item-rc1')).toBeInTheDocument();
  });

  it('clicking a breadcrumb segment jumps back to that level', async () => {
    const user = userEvent.setup();
    render(<RcdoPickerDrawer tree={TREE} onSelect={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByTestId('tree-item-rc1')); // → Defining Objectives (crumb: rally cry)
    await user.click(screen.getByTestId('tree-item-do1')); // → Outcomes (crumb: + defining objective)
    // Click the first breadcrumb segment (the Rally Cry title) → back to its Defining Objectives.
    await user.click(screen.getByRole('button', { name: TREE[0]!.title }));
    expect(screen.getByTestId('tree-item-do1')).toBeInTheDocument();
    expect(screen.queryByTestId('tree-item-o1')).not.toBeInTheDocument();
  });

  it('hovering an option makes it the active option for Enter', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <RcdoPickerDrawer
        tree={TREE}
        suggestedIds={['so1', 'so2']}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );
    await user.type(screen.getByTestId('rcdo-search'), 'the'); // both leaves
    await user.hover(screen.getByTestId('tree-item-so2')); // make so2 active via onHover
    await user.keyboard('{Enter}');
    expect(onSelect.mock.calls[0]?.[0]?.outcome.id).toBe('so2');
  });

  it('the empty-state "Browse strategy tree" link clears the query and returns to drill mode', async () => {
    const user = userEvent.setup();
    render(<RcdoPickerDrawer tree={TREE} onSelect={vi.fn()} onClose={vi.fn()} />);
    await user.type(screen.getByTestId('rcdo-search'), 'zzzznomatch');
    expect(screen.getByTestId('rcdo-empty')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /browse strategy tree/i }));
    expect(screen.queryByTestId('rcdo-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('tree-item-rc1')).toBeInTheDocument();
  });

  it('the header X button and Escape both close the drawer', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RcdoPickerDrawer tree={TREE} onSelect={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}'); // Scrim's Esc-to-close
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
