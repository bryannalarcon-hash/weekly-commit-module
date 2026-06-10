// apps/wc-remote/src/screens/RcdoBrowser.test.tsx — RTL tests for the re-skinned two-pane Strategy
// browser/editor (brief §6.5), MSW-backed (real RTK Query getRcdoTree + the admin RCDO mutations).
// Proves: the threaded tree renders and selecting a node populates the right detail panel (level pill +
// "Ladders up to" chain); the typeahead search narrows to an empty state on no match; a failed tree
// query shows the error/retry primitive; the admin Edit-tree toggle (gated on the account's
// `canEditRcdo` capability — NOT canReview) flips the panel into the inline editor and "Add Rally Cry"
// creates a node the refetched tree renders; a MANAGER (canReview:true, canEditRcdo:false) is denied
// the toggle. resetMockDb keeps the mutable mock RCDO tree isolated between tests.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { handlers, makeStore, resetMockDb } from '@wcm/api';
import type { ReactNode } from 'react';
import { RcdoBrowser } from './RcdoBrowser';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => resetMockDb());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function withStore(node: ReactNode): JSX.Element {
  return <Provider store={makeStore()}>{node}</Provider>;
}

describe('RcdoBrowser (Strategy)', () => {
  it('renders the threaded tree and selecting a child shows its level + ladder in the detail panel', async () => {
    const user = userEvent.setup();
    render(withStore(<RcdoBrowser />));

    // The threaded tree mounts (role=tree, testid strategy-tree).
    const tree = await screen.findByTestId('strategy-tree');
    expect(tree).toHaveAttribute('role', 'tree');

    // The root Rally Cry renders with its level label.
    const rallyCry = await within(tree).findByText(
      /Become the system of record for total-portfolio intelligence/i,
    );
    expect(within(tree).getAllByText(/Rally Cry/i).length).toBeGreaterThan(0);

    // The detail panel starts on the prompt.
    expect(screen.getByText(/Select a Supporting Outcome/i)).toBeInTheDocument();

    // The first Defining Objective is auto-expanded; click it to populate the detail panel.
    const dobj = within(tree).getByText(/Unify public & private markets in one view/i);
    await user.click(dobj);

    const detail = screen.getByTestId('rcdo-detail');
    await waitFor(() => {
      // The detail panel shows the level pill and the "Ladders up to" ancestor chain.
      expect(detail).toHaveTextContent(/Defining Objective/i);
      expect(detail).toHaveTextContent(/Ladders up to/i);
    });
    expect(rallyCry).toBeInTheDocument();
  });

  it('filters via typeahead and shows the empty state on no match', async () => {
    const user = userEvent.setup();
    render(withStore(<RcdoBrowser />));
    await screen.findByTestId('strategy-tree');

    await user.type(screen.getByTestId('rcdo-browser-search'), 'zzzznomatch');
    await waitFor(() => {
      expect(screen.getByText(/No matching outcomes/i)).toBeInTheDocument();
    });
  });

  it('typeahead surfaces a matching node with its breadcrumb trail', async () => {
    const user = userEvent.setup();
    render(withStore(<RcdoBrowser />));
    await screen.findByTestId('strategy-tree');

    await user.type(screen.getByTestId('rcdo-browser-search'), 'Normalize public');
    await waitFor(() => {
      expect(screen.getByText(/Normalize public holdings/i)).toBeInTheDocument();
    });
    // The result carries its ancestor trail.
    expect(screen.getByText(/Single source of truth across asset classes/i)).toBeInTheDocument();
  });

  it('shows the error/retry primitive when the tree query fails', async () => {
    server.use(
      http.get('*/api/rcdo/tree', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
    );
    render(withStore(<RcdoBrowser />));
    await waitFor(() => {
      expect(screen.getByText(/Could not load the strategy tree/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId('error-retry')).toBeInTheDocument();
  });

  it('exposes the Edit-tree toggle to admins and flips the detail panel into the inline editor', async () => {
    const user = userEvent.setup();
    render(withStore(<RcdoBrowser />));
    await screen.findByTestId('strategy-tree');

    // The default account mock has canEditRcdo: true → the admin Edit-tree affordance is visible.
    const toggle = await screen.findByTestId('strategy-edit-toggle');
    expect(toggle).toHaveTextContent(/Edit tree/i);

    await user.click(toggle);
    // Editing banner + the "Add Rally Cry" affordance appear.
    expect(screen.getByTestId('strategy-edit-banner')).toBeInTheDocument();
    expect(screen.getByTestId('rcdo-add-root')).toBeInTheDocument();
    expect(toggle).toHaveTextContent(/Done editing/i);

    // Select a node → the right pane becomes the editor (title field + Delete).
    const tree = screen.getByTestId('strategy-tree');
    await user.click(within(tree).getByText(/Unify public & private markets in one view/i));
    await waitFor(() => {
      expect(screen.getByTestId('rcdo-editor')).toBeInTheDocument();
    });
    expect(screen.getByTestId('rcdo-edit-title')).toHaveValue(
      'Unify public & private markets in one view',
    );
    expect(screen.getByTestId('rcdo-delete')).toBeInTheDocument();
  });

  it('hides the Edit-tree toggle when the account cannot administer (IC: no canEditRcdo)', async () => {
    server.use(
      http.get('*/api/settings/account', () =>
        HttpResponse.json({
          id: 'm1',
          email: 'ic@solovis.com',
          displayName: 'IC User',
          timezone: 'America/Chicago',
          canReview: false,
          canEditRcdo: false,
        }),
      ),
    );
    render(withStore(<RcdoBrowser />));
    await screen.findByTestId('strategy-tree');
    expect(screen.queryByTestId('strategy-edit-toggle')).not.toBeInTheDocument();
  });

  it('denies the Edit-tree toggle to a MANAGER (canReview:true but canEditRcdo:false)', async () => {
    // Regression: a manager has canReview=true but is NOT an RCDO admin. Gating on canReview let
    // managers into edit mode where the admin mutations 403. The gate must key off canEditRcdo.
    server.use(
      http.get('*/api/settings/account', () =>
        HttpResponse.json({
          id: 'mgr',
          email: 'manager@solovis.com',
          displayName: 'Manager User',
          timezone: 'America/Chicago',
          canReview: true,
          canEditRcdo: false,
        }),
      ),
    );
    render(withStore(<RcdoBrowser />));
    await screen.findByTestId('strategy-tree');
    // No toggle → the manager cannot enter edit mode at all.
    expect(screen.queryByTestId('strategy-edit-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('strategy-edit-banner')).not.toBeInTheDocument();
  });

  it('creates a new Rally Cry through the admin mutation and the refetched tree shows it', async () => {
    const user = userEvent.setup();
    render(withStore(<RcdoBrowser />));
    await screen.findByTestId('strategy-tree');

    await user.click(await screen.findByTestId('strategy-edit-toggle'));
    await user.click(screen.getByTestId('rcdo-add-root'));

    // The createRallyCry mutation invalidates the tree tag → refetch renders the new root node.
    await waitFor(() => {
      expect(screen.getByText(/New rally cry/i)).toBeInTheDocument();
    });
  });

  it('opens the delete confirm dialog from the editor and removes the subtree on confirm', async () => {
    const user = userEvent.setup();
    render(withStore(<RcdoBrowser />));
    const tree = await screen.findByTestId('strategy-tree');

    await user.click(await screen.findByTestId('strategy-edit-toggle'));
    // Select the root Rally Cry, then delete it.
    await user.click(
      within(tree).getByText(/Become the system of record for total-portfolio intelligence/i),
    );
    await user.click(await screen.findByTestId('rcdo-delete'));

    const dialog = await screen.findByTestId('confirm-dialog');
    expect(dialog).toHaveTextContent(/Delete this node/i);
    await user.click(screen.getByTestId('confirm-accept'));

    // The deleteRallyCry mutation invalidates the tree tag → the refetched tree is empty.
    await waitFor(() => {
      expect(
        screen.queryByText(/Become the system of record for total-portfolio intelligence/i),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText(/No strategy defined yet/i)).toBeInTheDocument();
  });
});
