// markdown.tsx — tiny dependency-free renderer for the `deep` fields' light markdown.
// Supports: blank-line paragraphs, `- ` bullets, ``` fenced code ```, inline `code`, and **bold**.
import { Fragment, type ReactNode } from 'react';

// Parse inline spans: **bold** and `code`. Everything else is plain text.
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on `code` or **bold**, keeping the delimiters via capture groups.
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  const parts = text.split(pattern);
  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${keyBase}-${i}`;
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      nodes.push(<code key={key} className="md-code">{part.slice(1, -1)}</code>);
    } else if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      nodes.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else {
      nodes.push(<Fragment key={key}>{part}</Fragment>);
    }
  });
  return nodes;
}

// Group consecutive non-blank lines into blocks, recognizing fenced code and bullet lists.
export function renderMarkdown(src: string): ReactNode {
  const lines = (src ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (line.trim().startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre key={`pre-${key++}`} className="md-pre">
          <code>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Blank line — skip (paragraph separator).
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Bullet list.
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="md-ul">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `li-${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraph — gather contiguous non-blank, non-special lines.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^\s*-\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p-${key++}`} className="md-p">
        {renderInline(para.join(' '), `p-${key}`)}
      </p>,
    );
  }

  return <>{blocks}</>;
}
