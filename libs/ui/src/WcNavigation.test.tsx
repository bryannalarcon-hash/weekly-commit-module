// libs/ui/src/WcNavigation.test.tsx — proves the internal sub-nav hides manager items from non-managers,
// shows them to managers, marks the active item with aria-current="page", and fires onNavigate.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WcNavigation } from './WcNavigation';

describe('WcNavigation', () => {
  it('hides the Manager item for non-managers', () => {
    render(<WcNavigation activePath="/" isManager={false} />);
    expect(screen.queryByText('Manager')).not.toBeInTheDocument();
    expect(screen.getByText('My Week')).toBeInTheDocument();
  });

  it('shows the Manager item for managers', () => {
    render(<WcNavigation activePath="/" isManager />);
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  it('marks the active item with aria-current="page"', () => {
    render(<WcNavigation activePath="/history" isManager />);
    const active = screen.getByTestId('wc-nav-/history');
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('wc-nav-/')).not.toHaveAttribute('aria-current');
  });

  it('fires onNavigate with the item path instead of a full navigation', async () => {
    const onNavigate = vi.fn();
    render(<WcNavigation activePath="/" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByText('Strategy'));
    expect(onNavigate).toHaveBeenCalledWith('/strategy');
  });
});
