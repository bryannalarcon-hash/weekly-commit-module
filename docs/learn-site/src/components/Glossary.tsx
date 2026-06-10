// Glossary.tsx — definition list of glossary terms and their plain-English meanings.
// A simple, scannable reference section linked from search and the nav.
import type { GlossaryEntry } from '../types';

interface Props {
  entries: GlossaryEntry[];
}

export function Glossary({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="empty-note">No glossary terms are defined yet.</p>;
  }
  return (
    <dl className="glossary">
      {entries.map((e) => (
        <div className="glossary__row" key={e.term} id={`term-${slug(e.term)}`}>
          <dt className="glossary__term">{e.term}</dt>
          <dd className="glossary__def">{e.plain}</dd>
        </div>
      ))}
    </dl>
  );
}

function slug(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
