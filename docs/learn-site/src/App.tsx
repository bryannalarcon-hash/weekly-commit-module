// App.tsx — root component for the WCM learn-site.
// Owns global state (view router, header register, theme, map highlight) and composes the
// header, side nav, layer map, layer detail, flow stepper, glossary, and overview views.
import { useEffect, useMemo, useState } from 'react';
import content from '../content.json';
import type { Content, Layer, Register } from './types';
import {
  loadRegister,
  saveRegister,
  loadTheme,
  saveTheme,
  type Theme,
} from './lib/storage';
import { SideNav, type View } from './components/SideNav';
import { SearchBox } from './components/SearchBox';
import { RegisterToggle } from './components/RegisterToggle';
import { LayerMap } from './components/LayerMap';
import { LayerDetail } from './components/LayerDetail';
import { FlowStepper } from './components/FlowStepper';
import { Glossary } from './components/Glossary';

const data = content as Content;

export default function App() {
  const [view, setView] = useState<View>({ kind: 'overview' });
  const [register, setRegister] = useState<Register>(loadRegister);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  // The layer highlighted on the map when the flow stepper drives the view.
  const [flowLayerId, setFlowLayerId] = useState<string | null>(null);

  // Apply + persist the theme on the document root.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveRegister(register);
  }, [register]);

  const layerNameById = useMemo(() => {
    const m = new Map<string, string>();
    data.layers.forEach((l) => m.set(l.id, l.name));
    return m;
  }, []);

  const selectedLayer: Layer | null =
    view.kind === 'layer' ? data.layers.find((l) => l.id === view.id) ?? null : null;

  // On the layer view, the map highlights the selected layer.
  // On the flow view, it highlights the active step's layer.
  const activeLayerId =
    view.kind === 'layer'
      ? view.id
      : view.kind === 'flow'
        ? flowLayerId
        : null;

  const gotoLayer = (id: string) => setView({ kind: 'layer', id });
  const gotoGlossary = () => setView({ kind: 'glossary' });

  // Selecting on the map navigates to that layer's detail view.
  const onMapSelect = (id: string) => {
    if (view.kind === 'flow') {
      // Keep the user in the flow but jump the linked detail too.
      setView({ kind: 'layer', id });
    } else {
      gotoLayer(id);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            ◆
          </span>
          <div className="brand__text">
            <strong>{data.project.name}</strong>
            <span className="brand__tag">Learn</span>
          </div>
        </div>

        <SearchBox content={data} onGotoLayer={gotoLayer} onGotoGlossary={gotoGlossary} />

        <div className="header-controls">
          <RegisterToggle
            value={register}
            onChange={setRegister}
            label="Default reading depth"
          />
          <button
            type="button"
            className="icon-btn"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          <SideNav layers={data.layers} view={view} onNavigate={setView} />
        </aside>

        <main className="app-main" tabIndex={-1}>
          {view.kind === 'overview' && (
            <OverviewView register={register} activeLayerId={activeLayerId} onSelect={onMapSelect} />
          )}

          {view.kind === 'layer' && selectedLayer && (
            <div className="view-split">
              <div className="view-split__map">
                <LayerMap
                  layers={data.layers}
                  activeLayerId={activeLayerId}
                  onSelect={onMapSelect}
                />
              </div>
              <LayerDetail
                key={selectedLayer.id}
                layer={selectedLayer}
                defaultRegister={register}
                layerNameById={layerNameById}
                onJumpToLayer={gotoLayer}
              />
            </div>
          )}

          {view.kind === 'flow' && (
            <section className="section">
              <h1 className="section-title">Follow a request</h1>
              <p className="section-lede">
                Walk a single “lock your week” request through the stack. Each step highlights its
                layer on the map.
              </p>
              <div className="view-split">
                <div className="view-split__map">
                  <LayerMap
                    layers={data.layers}
                    activeLayerId={activeLayerId}
                    onSelect={onMapSelect}
                  />
                </div>
                <FlowStepper
                  steps={data.flow}
                  defaultRegister={register}
                  layerNameById={layerNameById}
                  onActiveLayer={setFlowLayerId}
                />
              </div>
            </section>
          )}

          {view.kind === 'glossary' && (
            <section className="section">
              <h1 className="section-title">Glossary</h1>
              <p className="section-lede">Plain-English definitions for the project's key terms.</p>
              <Glossary entries={data.glossary} />
            </section>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <span>{data.project.name}</span>
        <span className="footer-sep">·</span>
        <span>An interactive explainer of the system's {data.layers.length} layers.</span>
      </footer>
    </div>
  );
}

function OverviewView({
  register,
  activeLayerId,
  onSelect,
}: {
  register: Register;
  activeLayerId: string | null;
  onSelect: (id: string) => void;
}) {
  // The overview's summary follows the header register directly.
  const summary = register === 'plain' ? data.project.summary_plain : data.project.summary_deep;
  return (
    <section className="section overview">
      <h1 className="overview-title">{data.project.name}</h1>
      <p className="overview-tagline">{data.project.tagline}</p>
      <p className="overview-summary measure">{summary}</p>

      <ul className="stack-chips" aria-label="Technology stack">
        {data.project.stack.map((tech) => (
          <li key={tech} className="chip chip--static">
            {tech}
          </li>
        ))}
      </ul>

      <h2 className="overview-subhead">The layer map</h2>
      <p className="section-lede measure">
        Click any layer to open its detail. Arrows show how a request travels from the browser,
        through <code>/api</code>, into the backend and database.
      </p>
      <LayerMap layers={data.layers} activeLayerId={activeLayerId} onSelect={onSelect} />
    </section>
  );
}
