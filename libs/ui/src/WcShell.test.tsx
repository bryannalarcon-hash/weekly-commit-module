// libs/ui/src/WcShell.test.tsx — proves the internal sub-nav hides Manager from non-managers, shows it
// (with the unreviewed badge) to managers, marks the active tab with aria-current, opens the manager
// second sub-row (Review Queue · Team Dashboard) only when Manager is active, fires the navigate
// callbacks, and wraps content in the .page transition. Imports the component DIRECTLY.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WcShell } from './WcShell';

describe('WcShell', () => {
  it('hides the Manager tab for non-managers and shows the core tabs', () => {
    render(<WcShell active="myweek" isManager={false} />);
    expect(screen.queryByTestId('wc-nav-manager')).not.toBeInTheDocument();
    expect(screen.getByTestId('wc-nav-myweek')).toBeInTheDocument();
    expect(screen.getByTestId('wc-nav-history')).toBeInTheDocument();
    expect(screen.getByTestId('wc-nav-strategy')).toBeInTheDocument();
    expect(screen.getByTestId('wc-nav-settings')).toBeInTheDocument();
  });

  it('shows the Manager tab with the unreviewed badge for managers', () => {
    render(<WcShell active="myweek" isManager unreviewedCount={3} />);
    expect(screen.getByTestId('wc-nav-manager')).toBeInTheDocument();
    expect(screen.getByTestId('manager-unreviewed-badge')).toHaveTextContent('3');
  });

  it('omits the unreviewed badge when the count is zero', () => {
    render(<WcShell active="myweek" isManager unreviewedCount={0} />);
    expect(screen.queryByTestId('manager-unreviewed-badge')).not.toBeInTheDocument();
  });

  it('marks the active tab with aria-current and leaves others unset', () => {
    render(<WcShell active="history" isManager />);
    expect(screen.getByTestId('wc-nav-history')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('wc-nav-myweek')).not.toHaveAttribute('aria-current');
  });

  it('opens the manager sub-row only when Manager is the active group', () => {
    const { rerender } = render(<WcShell active="myweek" isManager />);
    expect(screen.queryByTestId('wc-manager-subnav')).not.toBeInTheDocument();
    rerender(<WcShell active="manager" isManager managerSub="mgr-dashboard" />);
    expect(screen.getByTestId('wc-manager-subnav')).toBeInTheDocument();
    expect(screen.getByTestId('wc-nav-mgr-queue')).toHaveTextContent('Review Queue');
    expect(screen.getByTestId('wc-nav-mgr-dashboard')).toHaveAttribute('aria-current', 'true');
  });

  it('fires onNavigate and onNavigateManagerSub', async () => {
    const onNavigate = vi.fn();
    const onNavigateManagerSub = vi.fn();
    const user = userEvent.setup();
    render(
      <WcShell
        active="manager"
        isManager
        onNavigate={onNavigate}
        onNavigateManagerSub={onNavigateManagerSub}
      />,
    );
    await user.click(screen.getByTestId('wc-nav-strategy'));
    expect(onNavigate).toHaveBeenCalledWith('strategy');
    await user.click(screen.getByTestId('wc-nav-mgr-dashboard'));
    expect(onNavigateManagerSub).toHaveBeenCalledWith('mgr-dashboard');
  });

  it('renders children inside the page-transition content region', () => {
    const { container } = render(
      <WcShell active="myweek">
        <p>Page body</p>
      </WcShell>,
    );
    expect(screen.getByText('Page body')).toBeInTheDocument();
    expect(container.querySelector('.wc-content .page')).toBeInTheDocument();
  });
});
