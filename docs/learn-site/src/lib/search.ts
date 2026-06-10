// search.ts — client-side search over layers, components, and glossary terms.
// Returns lightweight result rows that the header search panel links into the right view.
import type { Content } from '../types';

export type SearchResultKind = 'layer' | 'component' | 'glossary';

export interface SearchResult {
  kind: SearchResultKind;
  /** Layer id to navigate to (glossary results point at the Glossary section). */
  targetId: string;
  title: string;
  context: string;
}

const GLOSSARY_TARGET = '__glossary__';

export function searchContent(content: Content, rawQuery: string): SearchResult[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];

  const results: SearchResult[] = [];

  for (const layer of content.layers) {
    const inName = layer.name.toLowerCase().includes(q);
    const inPlain = layer.plain.toLowerCase().includes(q);
    if (inName || inPlain) {
      results.push({
        kind: 'layer',
        targetId: layer.id,
        title: `${layer.num} · ${layer.name}`,
        context: inName ? layer.plain : excerpt(layer.plain, q),
      });
    }
    for (const comp of layer.components) {
      if (comp.name.toLowerCase().includes(q) || comp.what.toLowerCase().includes(q)) {
        results.push({
          kind: 'component',
          targetId: layer.id,
          title: comp.name,
          context: `${comp.what} — in ${layer.name}`,
        });
      }
    }
  }

  for (const entry of content.glossary) {
    if (entry.term.toLowerCase().includes(q) || entry.plain.toLowerCase().includes(q)) {
      results.push({
        kind: 'glossary',
        targetId: GLOSSARY_TARGET,
        title: entry.term,
        context: entry.plain,
      });
    }
  }

  return results.slice(0, 20);
}

export const GLOSSARY_RESULT_TARGET = GLOSSARY_TARGET;

// Pull a short window of text around the first match so results show why they matched.
function excerpt(text: string, q: string): string {
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return text.slice(0, 100);
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + q.length + 50);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}
