// libs/ui/src/Toggle.test.tsx — proves the switch exposes role=switch + aria-checked, is named for AT,
// toggles its value on click, and respects the disabled state (data-testid=toggle).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('is a named switch reflecting the on state', () => {
    render(<Toggle on onChange={() => undefined} label="Private to manager" />);
    const el = screen.getByTestId('toggle');
    expect(el).toHaveAttribute('role', 'switch');
    expect(el).toHaveAttribute('aria-checked', 'true');
    expect(el).toHaveAccessibleName('Private to manager');
  });

  it('flips the value on click', async () => {
    const onChange = vi.fn();
    render(<Toggle on={false} onChange={onChange} label="x" />);
    await userEvent.click(screen.getByTestId('toggle'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire when disabled', async () => {
    const onChange = vi.fn();
    render(<Toggle on={false} onChange={onChange} label="x" disabled />);
    await userEvent.click(screen.getByTestId('toggle'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
