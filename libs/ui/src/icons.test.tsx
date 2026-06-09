// libs/ui/src/icons.test.tsx — proves the design icon set renders as 24x24 / 1.6-stroke aria-hidden SVGs,
// honours size/sw overrides, renders EVERY icon in the design map (so each component function is exercised),
// resolves icons dynamically via getIcon, and that every legacy PascalCase named export still renders
// (back-compat). The full-map render is what drives this file's function coverage: each Icon.<name> is its
// own function component, so rendering all of them covers all of them.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ForwardIcon,
  Icon,
  type IconName,
  LinkIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  ReconcileIcon,
  RefreshIcon,
  SpinnerIcon,
  WarningIcon,
  XMarkIcon,
  getIcon,
} from './icons';

describe('Icon set', () => {
  it('renders a 24x24 aria-hidden SVG with the design defaults', () => {
    const { container } = render(<>{Icon.lock({})}</>);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('stroke-width', '1.6');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('honours size + stroke-width overrides', () => {
    const { container } = render(<>{Icon.check({ size: 32, sw: 2.4 })}</>);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
    expect(svg).toHaveAttribute('stroke-width', '2.4');
  });

  it('renders every icon in the design map (covers each icon component)', () => {
    const names = Object.keys(Icon) as IconName[];
    // Sanity: the set is non-trivial (guards against an accidental empty/partial map).
    expect(names.length).toBeGreaterThan(30);
    for (const name of names) {
      const Cmp = Icon[name];
      const { container } = render(<>{Cmp({ size: 16 })}</>);
      expect(container.querySelector('svg')).toBeInTheDocument();
    }
  });

  it('the spinner merges its animate-spin class with a caller className', () => {
    const { container } = render(<>{Icon.spinner({ className: 'extra' })}</>);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('animate-spin');
    expect(svg).toHaveClass('extra');
  });

  it('the spinner spins even without a caller className', () => {
    const { container } = render(<>{Icon.spinner({})}</>);
    expect(container.querySelector('svg')).toHaveClass('animate-spin');
  });

  it('getIcon resolves a known icon by string key and renders it', () => {
    const Cmp = getIcon('lock');
    expect(Cmp).toBeTypeOf('function');
    const { container } = render(<>{Cmp?.({})}</>);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('getIcon returns undefined for an unknown key', () => {
    expect(getIcon('definitely-not-an-icon')).toBeUndefined();
  });

  it('keeps every legacy PascalCase named export renderable', () => {
    const { container } = render(
      <>
        <PencilIcon />
        <LockIcon />
        <ReconcileIcon />
        <CheckCircleIcon />
        <ForwardIcon />
        <WarningIcon />
        <ChevronRightIcon />
        <ChevronDownIcon />
        <SpinnerIcon />
        <XMarkIcon />
        <LinkIcon />
        <PlusIcon />
        <RefreshIcon />
      </>,
    );
    // 13 legacy aliases, each rendering exactly one SVG.
    expect(container.querySelectorAll('svg')).toHaveLength(13);
  });
});
