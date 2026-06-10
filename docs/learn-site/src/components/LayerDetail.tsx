// LayerDetail.tsx — detail panel for the selected layer.
// Shows a per-panel Plain⇄Deep toggle, the components table, clickable depends_on/used_by
// chips (jump to that layer), and the `connects` sentence.
import { useState } from 'react';
import type { Layer, Register } from '../types';
import { renderMarkdown } from '../lib/markdown';
import { RegisterToggle } from './RegisterToggle';

interface Props {
  layer: Layer;
  /** Header default; the panel starts here but can be overridden locally. */
  defaultRegister: Register;
  layerNameById: Map<string, string>;
  onJumpToLayer: (layerId: string) => void;
}

function RelChips({
  ids,
  layerNameById,
  onJump,
}: {
  ids: string[];
  layerNameById: Map<string, string>;
  onJump: (id: string) => void;
}) {
  if (ids.length === 0) return <span className="rel-empty">—</span>;
  return (
    <span className="chip-row">
      {ids.map((id) => (
        <button key={id} type="button" className="chip chip--link" onClick={() => onJump(id)}>
          {layerNameById.get(id) ?? id}
        </button>
      ))}
    </span>
  );
}

export function LayerDetail({ layer, defaultRegister, layerNameById, onJumpToLayer }: Props) {
  const [register, setRegister] = useState<Register>(defaultRegister);

  return (
    <article className="layer-detail" aria-labelledby={`layer-${layer.id}-title`}>
      <header className="layer-detail__head">
        <div className="layer-detail__title-wrap">
          <span className={`layer-badge side-${layer.side}`}>
            <span aria-hidden="true">{layer.icon}</span> {layer.num}
          </span>
          <h2 id={`layer-${layer.id}-title`}>{layer.name}</h2>
        </div>
        <RegisterToggle
          value={register}
          onChange={setRegister}
          label={`Reading depth for ${layer.name}`}
          size="sm"
        />
      </header>

      <div className="prose">
        {register === 'plain' ? <p className="md-p">{layer.plain}</p> : renderMarkdown(layer.deep)}
      </div>

      {layer.components.length > 0 && (
        <section className="layer-detail__components" aria-label="Components">
          <h3>Components</h3>
          <table className="components-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">What it does</th>
                <th scope="col">Reference</th>
              </tr>
            </thead>
            <tbody>
              {layer.components.map((c) => (
                <tr key={c.name}>
                  <td className="comp-name">{c.name}</td>
                  <td>{c.what}</td>
                  <td>
                    <code className="comp-ref">{c.ref}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="layer-detail__rels" aria-label="Relationships">
        <dl className="rel-grid">
          <dt>Depends on</dt>
          <dd>
            <RelChips ids={layer.depends_on} layerNameById={layerNameById} onJump={onJumpToLayer} />
          </dd>
          <dt>Used by</dt>
          <dd>
            <RelChips ids={layer.used_by} layerNameById={layerNameById} onJump={onJumpToLayer} />
          </dd>
        </dl>
        <p className="layer-connects">{layer.connects}</p>
      </section>
    </article>
  );
}
