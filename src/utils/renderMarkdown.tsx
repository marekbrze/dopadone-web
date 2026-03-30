import React from 'react';

// ── Simple markdown renderer ──────────────────────────────────────────────────

export function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  function inlineFormat(line: string): React.ReactNode {
    // Split on bold (**text**), italic (*text*), inline code (`text`)
    const parts: React.ReactNode[] = [];
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s<>"']+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      const token = m[0];
      if (token.startsWith('`')) {
        parts.push(<code key={key++} className="md-code">{token.slice(1, -1)}</code>);
      } else if (token.startsWith('**')) {
        parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('http')) {
        parts.push(<a key={key++} href={token} target="_blank" rel="noopener noreferrer" className="md-link">{token}</a>);
      } else {
        parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
      }
      last = m.index + token.length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    if (line.startsWith('### ')) {
      nodes.push(<h3 key={key++} className="md-h3">{inlineFormat(line.slice(4))}</h3>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      nodes.push(<h2 key={key++} className="md-h2">{inlineFormat(line.slice(3))}</h2>);
      i++; continue;
    }
    if (line.startsWith('# ')) {
      nodes.push(<h1 key={key++} className="md-h1">{inlineFormat(line.slice(2))}</h1>);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(<blockquote key={key++} className="md-blockquote">{inlineFormat(line.slice(2))}</blockquote>);
      i++; continue;
    }

    // Unordered list — collect consecutive items
    if (line.match(/^[-*] /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(<li key={key++}>{inlineFormat(lines[i].slice(2))}</li>);
        i++;
      }
      nodes.push(<ul key={key++} className="md-ul">{items}</ul>);
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(<li key={key++}>{inlineFormat(lines[i].replace(/^\d+\. /, ''))}</li>);
        i++;
      }
      nodes.push(<ol key={key++} className="md-ol">{items}</ol>);
      continue;
    }

    // Blank line — skip (paragraph spacing handled by CSS on <p>)
    if (line.trim() === '') {
      i++; continue;
    }

    // Paragraph — collect until blank line or block element
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,3} /) &&
      !lines[i].startsWith('> ') &&
      !lines[i].match(/^[-*] /) &&
      !lines[i].match(/^\d+\. /)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      const content = paraLines.map((l, idx) => (
        idx < paraLines.length - 1
          ? <>{inlineFormat(l)}<br /></>
          : inlineFormat(l)
      ));
      nodes.push(<p key={key++} className="md-p">{content}</p>);
    }
  }

  return nodes;
}
