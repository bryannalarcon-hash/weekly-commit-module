// apps/wc-remote/src/screens/RcdoBrowser.test.tsx — RTL tests for the read-only Strategy browser
// (brief §6.5), MSW-backed (real RTK Query getRcdoTree). Proves: the 4-level tree renders, focusing
// a Supporting Outcome populates the side detail panel with its breadcrumb, the typeahead filter
// narrows to an empty state on no match, and a failed query shows the error/retry primitive.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { handlers, makeStore } from '@wcm/api';
import type { ReactNode } from 'react';
import { RcdoBrowser } from './RcdoBrowser';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function withStore(node: ReactNode): JSX.Element {
  return <Provider store={makeStore()}>{node}</Provider>;
}

describe('RcdoBrowser', () => {
  it('renders the strategy tree and shows a focused outcome breadcrumb in the detail panel', async () => {
    const user = userEvent.setup();
    render(withStore(<RcdoBrowser />));

    const tree = await screen.findByRole('tree');
    // The detail panel starts empty (prompt to select).
    expect(screen.getByText(/Select a Supporting Outcome/i)).toBeInTheDocument();

    const leaf = within(tree)
      .getAllByRole('treeitem')
      .find((el) => el.getAttribute('data-leaf') === 'true');
    expect(leaf).toBeTruthy();
    leaf!.focus();
    await user.keyboard('{Enter}');

    // Selecting a Supporting Outcome populates the detail panel (breadcrumb appears).
    await waitFor(() => {
      expect(screen.getByTestId('rcdo-detail')).toHaveTextContent(/Rally Cry|›|owner/i);
    });
  });

  it('filters via typeahead and shows the empty state on no match', async () => {
    const user = userEvent.setup();
    render(withStore(<RcdoBrowser />));
    await screen.findByRole('tree');

    await user.type(screen.getByTestId('rcdo-browser-search'), 'zzzznomatch');
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    expect(screen.getByText(/No matching outcomes/i)).toBeInTheDocument();
  });

  it('shows the error/retry primitive when the tree query fails', async () => {
    server.use(
      http.get('*/api/rcdo/tree', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
    );
    render(withStore(<RcdoBrowser />));
    await waitFor(() => {
      expect(screen.getByText(/Could not load the strategy tree/i)).toBeInTheDocument();
    });
  });
});
