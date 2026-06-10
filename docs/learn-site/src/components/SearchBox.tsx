// SearchBox.tsx — header search input + results dropdown.
// Filters layers/components/glossary client-side and links each result to its target view.
import { useEffect, useRef, useState } from 'react';
import type { Content } from '../types';
import { searchContent, GLOSSARY_RESULT_TARGET, type SearchResult } from '../lib/search';

interface Props {
  content: Content;
  /** Navigate to a layer detail; called with the layer id. */
  onGotoLayer: (layerId: string) => void;
  /** Navigate to the glossary section. */
  onGotoGlossary: () => void;
}

const KIND_LABEL: Record<SearchResult['kind'], string> = {
  layer: 'Layer',
  component: 'Component',
  glossary: 'Term',
};

export function SearchBox({ content, onGotoLayer, onGotoGlossary }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = open ? searchContent(content, query) : [];

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const choose = (r: SearchResult) => {
    if (r.targetId === GLOSSARY_RESULT_TARGET) {
      onGotoGlossary();
    } else {
      onGotoLayer(r.targetId);
    }
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="search-box" ref={wrapRef}>
      <input
        type="search"
        className="search-input"
        placeholder="Search layers, components, terms…"
        aria-label="Search the learn site"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim().length >= 2 && (
        <ul className="search-results" role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <li className="search-empty">No matches.</li>
          ) : (
            results.map((r, i) => (
              <li key={`${r.kind}-${r.targetId}-${i}`}>
                <button type="button" className="search-result" onClick={() => choose(r)}>
                  <span className={`search-kind kind-${r.kind}`}>{KIND_LABEL[r.kind]}</span>
                  <span className="search-title">{r.title}</span>
                  <span className="search-context">{r.context}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
