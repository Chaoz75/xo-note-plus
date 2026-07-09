/* ═══════════════════════════════════════════════════════
   XO NOTE+ — Lightweight Markdown Parser + HTML Converter
   No dependencies — handles common MD syntax both ways
   ═══════════════════════════════════════════════════════ */

const MarkdownParser = {
  // ── Markdown → HTML ──
  parse(text) {
    if (!text) return '';
    let html = this.escapeHtml(text);

    // ── Phase 1: Extract code blocks and inline code to protect from other transforms ──
    const codeBlocks = [];
    const inlineCodes = [];

    // Code blocks (``` ... ```) — supports optional {size:14px} metadata in fence
    html = html.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, langMeta, code) => {
      const placeholder = `\x00CODEBLOCK${codeBlocks.length}\x00`;
      codeBlocks.push(`<pre><code class="language-${langMeta.trim()}">${code.trim()}</code></pre>`);
      return placeholder;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, (_, code) => {
      const placeholder = `\x00INLINECODE${inlineCodes.length}\x00`;
      inlineCodes.push(`<code>${code}</code>`);
      return placeholder;
    });

    // ── Phase 2: Apply all markdown transforms (code content is safely placeholdered) ──

    // Headers
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Horizontal rule
    html = html.replace(/^---+$/gm, '<hr>');
    html = html.replace(/^\*\*\*+$/gm, '<hr>');

    // Blockquotes
    html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    // Bold + Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Checklists
    html = html.replace(/^- \[x\]\s+(.+)$/gm, '<li class="checklist"><input type="checkbox" checked> $1</li>');
    html = html.replace(/^- \[ \]\s+(.+)$/gm, '<li class="checklist"><input type="checkbox"> $1</li>');

    // Unordered lists
    html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');

    // Ordered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Wrap consecutive <li> in <ul>
    html = html.replace(/((?:<li[\s>][\s\S]*?<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Tables
    html = this.parseTables(html);

    // Paragraphs — wrap loose text lines
    html = html.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return line;
      // Don't wrap code block placeholders in <p>
      if (/\x00CODEBLOCK\d+\x00/.test(trimmed)) return line;
      return `<p>${trimmed}</p>`;
    }).join('\n');

    // Clean up double newlines
    html = html.replace(/\n{3,}/g, '\n\n');

    // ── Phase 3: Restore code blocks and inline code from placeholders ──
    for (let i = 0; i < codeBlocks.length; i++) {
      html = html.replace(`\x00CODEBLOCK${i}\x00`, codeBlocks[i]);
    }
    for (let i = 0; i < inlineCodes.length; i++) {
      html = html.replace(`\x00INLINECODE${i}\x00`, inlineCodes[i]);
    }

    return html;
  },

  parseTables(html) {
    const lines = html.split('\n');
    let result = [];
    let inTable = false;
    let tableRows = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (line.replace(/[|\s-:]/g, '') === '') {
          continue;
        }
        tableRows.push(line);
        inTable = true;
      } else {
        if (inTable && tableRows.length > 0) {
          result.push(this.buildTable(tableRows));
          tableRows = [];
          inTable = false;
        }
        result.push(lines[i]);
      }
    }
    if (tableRows.length > 0) {
      result.push(this.buildTable(tableRows));
    }
    return result.join('\n');
  },

  buildTable(rows) {
    let html = '<table>';
    rows.forEach((row, i) => {
      const cells = row.split('|').filter(c => c.trim() !== '');
      const tag = i === 0 ? 'th' : 'td';
      html += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
    });
    return html + '</table>';
  },

  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  // ── HTML → Markdown ──
  htmlToMarkdown(html) {
    if (!html || !html.trim()) return '';

    // Create a temporary DOM element to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    return this._nodeToMarkdown(temp).trim();
  },

  _nodeToMarkdown(node) {
    let md = '';

    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        md += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();

        switch (tag) {
          case 'h1':
            md += '# ' + this._inlineContent(child) + '\n\n';
            break;
          case 'h2':
            md += '## ' + this._inlineContent(child) + '\n\n';
            break;
          case 'h3':
            md += '### ' + this._inlineContent(child) + '\n\n';
            break;
          case 'h4':
            md += '#### ' + this._inlineContent(child) + '\n\n';
            break;
          case 'h5':
            md += '##### ' + this._inlineContent(child) + '\n\n';
            break;
          case 'h6':
            md += '###### ' + this._inlineContent(child) + '\n\n';
            break;
          case 'p':
            md += this._inlineContent(child) + '\n\n';
            break;
          case 'br':
            md += '\n';
            break;
          case 'strong':
          case 'b':
            md += '**' + this._inlineContent(child) + '**';
            break;
          case 'em':
          case 'i':
            md += '*' + this._inlineContent(child) + '*';
            break;
          case 'del':
          case 's':
            md += '~~' + this._inlineContent(child) + '~~';
            break;
          case 'mark':
            md += '==' + this._inlineContent(child) + '==';
            break;
          case 'u':
            md += '<u>' + this._inlineContent(child) + '</u>';
            break;
          case 'code':
            if (child.parentElement && child.parentElement.tagName.toLowerCase() === 'pre') {
              // Handled by pre
            } else {
              md += '`' + child.textContent + '`';
            }
            break;
          case 'pre': {
            // Extract language from code element class
            const codeEls = child.querySelectorAll('code');
            let lang = '';
            if (codeEls.length > 0) {
              lang = codeEls[0].className ? codeEls[0].className.replace('language-', '') : '';
            }
            // Custom extraction — NOT innerText (includes ::before counters, adds extra \n)
            const code = this._extractPreText(child);
            md += '```' + lang + '\n' + code + '\n```\n\n';
            break;
          }
          case 'blockquote':
            md += '> ' + this._inlineContent(child).replace(/\n/g, '\n> ') + '\n\n';
            break;
          case 'ul':
          case 'ol': {
            let idx = 1;
            for (const li of child.children) {
              if (li.tagName.toLowerCase() === 'li') {
                const checkbox = li.querySelector('input[type="checkbox"]');
                if (checkbox) {
                  const checked = checkbox.checked ? 'x' : ' ';
                  const text = li.textContent.trim();
                  md += `- [${checked}] ${text}\n`;
                } else if (tag === 'ol') {
                  md += `${idx}. ${this._inlineContent(li)}\n`;
                  idx++;
                } else {
                  md += `- ${this._inlineContent(li)}\n`;
                }
              }
            }
            md += '\n';
            break;
          }
          case 'li': {
            // Handle orphaned <li> not inside a <ul>/<ol> (e.g. from insertHTML)
            const parentTag = child.parentElement ? child.parentElement.tagName.toLowerCase() : '';
            if (parentTag !== 'ul' && parentTag !== 'ol') {
              const checkbox = child.querySelector('input[type="checkbox"]');
              if (checkbox) {
                const checked = checkbox.checked ? 'x' : ' ';
                // Get text content after the checkbox
                let liText = '';
                for (const cn of child.childNodes) {
                  if (cn.nodeType === Node.TEXT_NODE) liText += cn.textContent;
                  else if (cn.nodeType === Node.ELEMENT_NODE && cn.tagName.toLowerCase() !== 'input') liText += cn.textContent;
                }
                md += `- [${checked}] ${liText.trim()}\n`;
              } else {
                md += `- ${this._inlineContent(child)}\n`;
              }
            }
            // Otherwise handled by ul/ol parent
            break;
          }
          case 'a': {
            const href = child.getAttribute('href') || '';
            md += `[${this._inlineContent(child)}](${href})`;
            break;
          }
          case 'img': {
            const src = child.getAttribute('src') || '';
            const alt = child.getAttribute('alt') || '';
            md += `![${alt}](${src})`;
            break;
          }
          case 'hr':
            md += '---\n\n';
            break;
          case 'table': {
            const rows = child.querySelectorAll('tr');
            rows.forEach((row, ri) => {
              const cells = row.querySelectorAll('th, td');
              const rowText = Array.from(cells).map(c => c.textContent.trim());
              md += '| ' + rowText.join(' | ') + ' |\n';
              if (ri === 0) {
                md += '| ' + rowText.map(() => '---').join(' | ') + ' |\n';
              }
            });
            md += '\n';
            break;
          }
          case 'div':
            // Handle code-block-wrapper divs — extract the pre inside
            if (child.classList.contains('table-wrapper')) {
              // Extract the table inside the wrapper
              const tbl = child.querySelector('table');
              if (tbl) {
                const rows = tbl.querySelectorAll('tr');
                rows.forEach((row, ri) => {
                  const cells = row.querySelectorAll('th, td');
                  const rowText = Array.from(cells).map(c => c.textContent.trim());
                  md += '| ' + rowText.join(' | ') + ' |\n';
                  if (ri === 0) {
                    md += '| ' + rowText.map(() => '---').join(' | ') + ' |\n';
                  }
                });
                md += '\n';
              }
            } else if (child.classList.contains('code-block-wrapper')) {
              const pre = child.querySelector('pre');
              if (pre) {
                let lang = '';
                // Try to get label from header first
                const labelEl = child.querySelector('.code-block-label');
                if (labelEl) {
                  const labelText = labelEl.textContent.trim().toLowerCase();
                  if (labelText && labelText !== 'code') lang = labelText;
                }
                // Fallback to code element class
                if (!lang) {
                  const codeEls = pre.querySelectorAll('code');
                  if (codeEls.length > 0) {
                    const cls = codeEls[0].className || '';
                    lang = cls.replace('language-', '').trim();
                  }
                }
                // Encode label size in the fence so it persists across app restarts
                const headerEl = child.querySelector('.code-block-header');
                const lblEl = child.querySelector('.code-block-label');
                const labelSize = (lblEl && lblEl.style.fontSize) ? lblEl.style.fontSize : '';
                const sizeSuffix = labelSize ? ' {size:' + labelSize + '}' : '';
                const code = this._extractPreText(pre);
                md += '```' + lang + sizeSuffix + '\n' + code + '\n```\n\n';
              }
            } else {
              // Treat divs as block-level containers (often from contenteditable)
              md += this._nodeToMarkdown(child);
              if (!md.endsWith('\n')) md += '\n';
            }
            break;
          default:
            // For unknown tags, just get content
            md += this._nodeToMarkdown(child);
            break;
        }
      }
    }

    return md;
  },

  _inlineContent(node) {
    let text = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        switch (tag) {
          case 'strong': case 'b': text += '**' + this._inlineContent(child) + '**'; break;
          case 'em': case 'i': text += '*' + this._inlineContent(child) + '*'; break;
          case 'del': case 's': text += '~~' + this._inlineContent(child) + '~~'; break;
          case 'mark': text += '==' + this._inlineContent(child) + '=='; break;
          case 'u': text += '<u>' + this._inlineContent(child) + '</u>'; break;
          case 'code': text += '`' + child.textContent + '`'; break;
          case 'a': text += `[${this._inlineContent(child)}](${child.getAttribute('href') || ''})`; break;
          case 'img': text += `![${child.getAttribute('alt') || ''}](${child.getAttribute('src') || ''})`; break;
          case 'br': text += '\n'; break;
          default: text += this._inlineContent(child); break;
        }
      }
    }
    return text;
  },

  // Extract tags from frontmatter or inline #tags
  extractTags(text) {
    const tags = new Set();
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const tagLine = fmMatch[1].match(/tags:\s*\[([^\]]+)\]/);
      if (tagLine) {
        tagLine[1].split(',').forEach(t => tags.add(t.trim().replace(/['"]/g, '')));
      }
    }
    const inlineTags = text.match(/#[a-zA-Z][\w-]*/g);
    if (inlineTags) {
      inlineTags.forEach(t => tags.add(t.slice(1)));
    }
    return [...tags];
  },

  // Extract [[wiki-style]] backlinks
  extractLinks(text) {
    const links = [];
    const matches = text.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const m of matches) {
      links.push(m[1]);
    }
    return links;
  },

  // Word & char count
  wordCount(text) {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  },

  charCount(text) {
    return text.length;
  },

  // Robust code text extraction from <pre> — handles all contenteditable DOM states
  // Walks direct children, treats each element as a line, handles text nodes from paste/edit
  _extractPreText(pre) {
    const children = pre.childNodes;
    if (children.length === 0) return '';
    // Single code element with newlines inside (fresh from parse)
    const codeEls = Array.from(pre.querySelectorAll(':scope > code'));
    if (codeEls.length === 1 && children.length === 1) {
      return codeEls[0].textContent;
    }
    // Multiple children: walk DOM, each direct child = one line
    const parts = [];
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent;
        if (!t.trim() && !t.includes('\n')) continue;
        t.split('\n').forEach(line => parts.push(line));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName === 'BR') {
          parts.push('');
        } else {
          parts.push(child.textContent);
        }
      }
    }
    return parts.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  }
};
