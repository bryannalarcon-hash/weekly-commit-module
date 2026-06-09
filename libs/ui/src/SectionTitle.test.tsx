// libs/ui/src/SectionTitle.test.tsx — proves the section header renders its title as an h2, shows the
// optional kicker eyebrow + right slot, and omits the kicker when not supplied. Imports DIRECTLY.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionTitle } from './SectionTitle';

describe('SectionTitle', () => {
  it('renders the title as an h2 heading', () => {
    render(<SectionTitle title="This week" />);
    expect(screen.getByRole('heading', { level: 2, name: 'This week' })).toBeInTheDocument();
  });

  it('renders the kicker eyebrow and the right slot when provided', () => {
    render(
      <SectionTitle
        kicker="Planning"
        title="This week"
        right={<a href="/history">View all</a>}
      />,
    );
    expect(screen.getByText('Planning')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all' })).toBeInTheDocument();
  });

  it('omits the kicker when not supplied', () => {
    render(<SectionTitle title="Just a title" />);
    expect(screen.queryByText('Planning')).not.toBeInTheDocument();
  });
});
