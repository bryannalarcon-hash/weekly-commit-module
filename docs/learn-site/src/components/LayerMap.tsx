// LayerMap.tsx — the interactive architecture diagram grouping layers by side.
// Renders a Frontend cluster, a Backend cluster (+ Postgres box), and a Cross-cutting row;
// each layer is a clickable card; the active layer (selection or flow step) is highlighted.
import type { Layer } from '../types';

interface Props {
  layers: Layer[];
  activeLayerId: string | null;
  onSelect: (layerId: string) => void;
}

interface CardProps {
  layer: Layer;
  active: boolean;
  onSelect: (id: string) => void;
}

function LayerCard({ layer, active, onSelect }: CardProps) {
  return (
    <button
      type="button"
      className={`layer-card side-${layer.side}${active ? ' is-active' : ''}`}
      aria-pressed={active}
      aria-label={`Layer ${layer.num}: ${layer.name}`}
      onClick={() => onSelect(layer.id)}
    >
      <span className="layer-card__num">{layer.num}</span>
      <span className="layer-card__icon" aria-hidden="true">
        {layer.icon}
      </span>
      <span className="layer-card__name">{layer.name}</span>
    </button>
  );
}

export function LayerMap({ layers, activeLayerId, onSelect }: Props) {
  const byOrder = (a: Layer, b: Layer) => a.order - b.order;
  const frontend = layers.filter((l) => l.side === 'frontend').sort(byOrder);
  const backend = layers.filter((l) => l.side === 'backend').sort(byOrder);
  const crosscutting = layers.filter((l) => l.side === 'crosscutting').sort(byOrder);

  const renderCards = (group: Layer[]) =>
    group.map((layer) => (
      <LayerCard
        key={layer.id}
        layer={layer}
        active={layer.id === activeLayerId}
        onSelect={onSelect}
      />
    ));

  return (
    <div className="layer-map" aria-label="Interactive layer map">
      <section className="map-cluster cluster-frontend" aria-label="Browser / Frontend">
        <h3 className="cluster-title">
          <span className="cluster-dot side-frontend" aria-hidden="true" /> Browser / Frontend
        </h3>
        <div className="cluster-cards">{renderCards(frontend)}</div>
      </section>

      <div className="map-edge" aria-hidden="true">
        <span className="map-edge__arrow">↓</span>
        <span className="map-edge__label">HTTPS · /api/* · Bearer JWT</span>
      </div>

      <section className="map-cluster cluster-backend" aria-label="Spring Boot / Backend">
        <h3 className="cluster-title">
          <span className="cluster-dot side-backend" aria-hidden="true" /> Spring Boot / Backend
        </h3>
        <div className="cluster-cards">{renderCards(backend)}</div>
        <div className="map-edge map-edge--tight" aria-hidden="true">
          <span className="map-edge__arrow">↓</span>
        </div>
        <div className="db-box" aria-label="PostgreSQL database">
          <span className="db-box__icon" aria-hidden="true">
            🗄️
          </span>
          PostgreSQL
        </div>
      </section>

      {crosscutting.length > 0 && (
        <section className="map-cluster cluster-crosscutting" aria-label="Cross-cutting concerns">
          <h3 className="cluster-title">
            <span className="cluster-dot side-crosscutting" aria-hidden="true" /> Cross-cutting
          </h3>
          <div className="cluster-cards cluster-cards--row">{renderCards(crosscutting)}</div>
        </section>
      )}
    </div>
  );
}
