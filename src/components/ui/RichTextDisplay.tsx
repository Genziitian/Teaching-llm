import React from 'react';
import { MathDisplay } from './MathDisplay';

/**
 * SyntaxHighlighter — A lightweight, regex-based code highlighter
 * providing a VS Code-like aesthetic.
 */
function highlightCode(code: string, lang: string) {
  // VS Code Dark Plus inspired palette
  const colors = {
    keyword: '#c678dd',   // Purple
    string: '#98c379',    // Green
    comment: '#5c6370',   // Grey
    function: '#61afef',  // Blue
    number: '#d19a66',    // Orange
    operator: '#56b6c2',  // Cyan
    default: '#abb2bf'    // Light grey
  };

  // Define tokens
  const tokens = [
    { type: 'comment', regex: /(\/\/.*|\/\*[\s\S]*?\*\/|#.*)/g },
    { type: 'string', regex: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g },
    { type: 'keyword', regex: /\b(def|class|if|else|elif|for|while|return|import|from|as|try|except|finally|with|pass|break|continue|in|is|not|and|or|lambda|yield|async|await|var|let|const|function|new|delete|typeof|instanceof|void|this|super|export|default|interface|namespace|enum|public|private|protected|static|readonly|abstract|async|await|package|native|synchronized|transient|volatile|strictfp|bool|char|double|float|int|long|short|void|unsigned|signed|struct|union|typedef|extern|goto|auto|register|null|true|false|undefined|None|True|False)\b/g },
    { type: 'function', regex: /\b([a-zA-Z_]\w*)(?=\s*\()/g },
    { type: 'number', regex: /\b(\d+\.?\d*|0x[0-9a-fA-F]+)\b/g },
    { type: 'operator', regex: /([+\-*/%&|^!<>]=?|=)/g }
  ];

  // Process tokens by splitting and wrapping
  let parts = [{ text: code, type: 'default' }];

  tokens.forEach(token => {
    let newParts: { text: string; type: string }[] = [];
    parts.forEach(part => {
      if (part.type !== 'default') {
        newParts.push(part);
        return;
      }

      const split = part.text.split(token.regex);
      split.forEach((text, i) => {
        if (!text) return;
        // Even indices are plain text, odd indices are matches
        if (i % 2 === 1) {
          newParts.push({ text, type: token.type });
        } else {
          newParts.push({ text, type: 'default' });
        }
      });
    });
    parts = newParts;
  });

  return parts.map((part, i) => (
    <span key={i} style={{ color: colors[part.type as keyof typeof colors] || colors.default }}>
      {part.text}
    </span>
  ));
}

/**
 * RichTextDisplay — The top-level text rendering component.
 */
export function RichTextDisplay({ text }: { text: string | undefined | null }) {
  if (!text) return null;

  // Split by code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div style={{ wordBreak: 'break-word', color: 'var(--text-primary)' }}>
      {parts.map((part, index) => {
        // CODE BLOCK RENDERING
        if (part.startsWith('```') && part.endsWith('```')) {
          const match = part.match(/^```(\w+)?\n([\s\S]*?)```$/) || part.match(/^```(\w+)?([\s\S]*?)```$/);
          
          if (match) {
            const lang = match[1] || '';
            const code = match[2] || '';
            return (
              <pre key={index} style={{
                background: '#1e1e1e', // VS Code Dark background
                color: '#abb2bf',
                padding: '20px 16px',
                borderRadius: '12px',
                overflowX: 'auto',
                fontFamily: '"Fira Code", "Cascadia Code", "Source Code Pro", Menlo, Monaco, Consolas, "Courier New", monospace',
                fontSize: '13px',
                lineHeight: '1.6',
                marginTop: '16px',
                marginBottom: '16px',
                position: 'relative',
                border: '1px solid rgba(255,255,255,0.05)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
              }}>
                {lang && (
                  <div style={{ position: 'absolute', top: 0, right: '16px', background: 'var(--primary)', color: '#fff', fontSize: '10px', padding: '4px 10px', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>
                    {lang}
                  </div>
                )}
                <code>{highlightCode(code.trim(), lang)}</code>
              </pre>
            );
          }
          return <pre key={index} style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '8px', fontFamily: 'monospace' }}><code>{part.replace(/```/g, '')}</code></pre>;
        }
        
        // MATH & PLAIN TEXT RENDERING
        return (
          <span key={index} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '15px', color: 'inherit' }}>
            <MathDisplay text={part} />
          </span>
        );
      })}
    </div>
  );
}
