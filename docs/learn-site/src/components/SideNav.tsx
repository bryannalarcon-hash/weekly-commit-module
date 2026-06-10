// SideNav.tsx — left/top navigation listing Overview, each layer, Flow, and Glossary.
// Drives the single-view router in App via the `view` value; highlights the active entry.
import type { Layer } from '../types';

export type View =
  | { kind: 'overview' }
  | { kind: 'layer'; id: string }
  | { kind: 'flow' }
  | { kind: 'glossary' };

interface Props {
  layers: Layer[];
  view: View;
  onNavigate: (view: View) => void;
}

function isActive(view: View, target: View): boolean {
  if (view.kind !== target.kind) return false;
  if (view.kind === 'layer' && target.kind === 'layer') return view.id === target.id;
  return true;
}

export function SideNav({ layers, view, onNavigate }: Props) {
  const ordered = [...layers].sort((a, b) => a.order - b.order);

  const item = (target: View, label: string, badge?: string, side?: string) => (
    <li>
      <button
        type="button"
        className={`nav-item${isActive(view, target) ? ' is-active' : ''}`}
        aria-current={isActive(view, target) ? 'page' : undefined}
        onClick={() => onNavigate(target)}
      >
        {badge && <span className={`nav-badge${side ? ` side-${side}` : ''}`}>{badge}</span>}
        <span className="nav-label">{label}</span>
      </button>
    </li>
  );

  return (
    <nav className="side-nav" aria-label="Sections">
      <ul className="nav-list">
        {item({ kind: 'overview' }, 'Overview')}
        <li className="nav-group-label" aria-hidden="true">
          Layers
        </li>
        {ordered.map((l) =>
          item({ kind: 'layer', id: l.id }, l.name, l.num, l.side),
        )}
        <li className="nav-group-label" aria-hidden="true">
          More
        </li>
        {item({ kind: 'flow' }, 'Follow a request')}
        {item({ kind: 'glossary' }, 'Glossary')}
      </ul>
    </nav>
  );
}
