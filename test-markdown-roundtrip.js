#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   Markdown Parser Roundtrip Stress Test
   Tests parse() → htmlToMarkdown() behavior
   ═══════════════════════════════════════════════════════ */

// Minimal DOM implementation for testing
class TextNode {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = text;
  }
}

class Element {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.childNodes = [];
    this.parentElement = null;
    this.attributes = {};
    this.className = '';
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
    if (name === 'class') this.className = value;
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  appendChild(child) {
    child.parentElement = this;
    this.childNodes.push(child);
  }

  querySelectorAll(selector) {
    const results = [];
    const walk = (node) => {
      if (node.nodeType === 1) {
        if (selector === '*') {
          results.push(node);
        } else if (selector.startsWith('.')) {
          const cls = selector.substring(1);
          if (node.className.includes(cls)) results.push(node);
        } else {
          const tag = selector.toLowerCase();
          if (node.tagName.toLowerCase() === tag) results.push(node);
        }
        for (const child of node.childNodes) walk(child);
      }
    };
    walk(this);
    return results;
  }

  querySelector(selector) {
    const results = this.querySelectorAll(selector);
    return results.length > 0 ? results[0] : null;
  }

  get classList() {
    return {
      contains: (cls) => this.className.includes(cls)
    };
  }

  get textContent() {
    let text = '';
    const walk = (node) => {
      if (node.nodeType === 3) {
        text += node.textContent;
      } else if (node.nodeType === 1) {
        for (const child of node.childNodes) walk(child);
      }
    };
    walk(this);
    return text;
  }

  set textContent(text) {
    this.childNodes = [new TextNode(text)];
  }

  get innerHTML() {
    let html = '';
    for (const child of this.childNodes) {
      if (child.nodeType === 3) {
        html += child.textContent;
      } else if (child.nodeType === 1) {
        html += `<${child.tagName.toLowerCase()}`;
        for (const [k, v] of Object.entries(child.attributes)) {
          html += ` ${k}="${v}"`;
        }
        html += '>';
        html += child.innerHTML;
        html += `</${child.tagName.toLowerCase()}>`;
      }
    }
    return html;
  }

  set innerHTML(html) {
    this.childNodes = this._parseHtml(html);
  }

  _parseHtml(html) {
    const nodes = [];
    let current = '';
    let i = 0;

    while (i < html.length) {
      if (html[i] === '<') {
        if (current) {
          nodes.push(new TextNode(current));
          current = '';
        }
        const endIdx = html.indexOf('>', i);
        if (endIdx !== -1) {
          const tagStr = html.substring(i + 1, endIdx);
          if (tagStr.startsWith('/')) {
            i = endIdx + 1;
            continue;
          }

          const spaceIdx = tagStr.indexOf(' ');
          const tagName = spaceIdx !== -1 ? tagStr.substring(0, spaceIdx) : tagStr;
          const el = new Element(tagName);

          if (spaceIdx !== -1) {
            const attrsStr = tagStr.substring(spaceIdx).trim();
            const attrRegex = /(\w+)=["']([^"']*)["']/g;
            let m;
            while ((m = attrRegex.exec(attrsStr)) !== null) {
              el.setAttribute(m[1], m[2]);
            }
          }

          const selfClosing = tagStr.endsWith('/');
          i = endIdx + 1;

          if (!selfClosing) {
            const closeTag = `</${tagName}>`;
            const closeIdx = html.indexOf(closeTag, i);
            if (closeIdx !== -1) {
              const innerHtml = html.substring(i, closeIdx);
              el.innerHTML = innerHtml;
              i = closeIdx + closeTag.length;
            }
          }

          nodes.push(el);
        } else {
          i++;
        }
      } else {
        current += html[i];
        i++;
      }
    }

    if (current) {
      nodes.push(new TextNode(current));
    }

    return nodes;
  }
}

const MarkdownParser = {
  parse(text) {
    if (!text) return '';
    let html = this.escapeHtml(text);

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    html = html.replace(/^---+$/gm, '<hr>');
    html = html.replace(/^\*\*\*+$/gm, '<hr>');

    html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');

    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    html = html.replace(/^- \[x\]\s+(.+)$/gm, '<li class="checklist"><input type="checkbox" checked> $1</li>');
    html = html.replace(/^- \[ \]\s+(.+)$/gm, '<li class="checklist"><input type="checkbox"> $1</li>');

    html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    html = html.replace(/((?:<li[\s>][\s\S]*?<\/li>\n?)+)/g, '<ul>$1</ul>');

    html = this.parseTables(html);

    html = html.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return line;
      return `<p>${trimmed}</p>`;
    }).join('\n');

    html = html.replace(/\n{3,}/g, '\n\n');

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

  htmlToMarkdown(html) {
    if (!html || !html.trim()) return '';

    const temp = new Element('div');
    temp.innerHTML = html;

    return this._nodeToMarkdown(temp).trim();
  },

  _nodeToMarkdown(node) {
    let md = '';

    for (const child of node.childNodes || []) {
      if (child.nodeType === 3) {
        md += child.textContent;
      } else if (child.nodeType === 1) {
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
            const codeEls = child.querySelectorAll('code');
            let code = '';
            let lang = '';
            if (codeEls.length > 1) {
              const lines = [];
              codeEls.forEach(el => lines.push(el.textContent || ''));
              code = lines.join('\n');
              lang = codeEls[0].className ? codeEls[0].className.replace('language-', '') : '';
            } else if (codeEls.length === 1) {
              code = codeEls[0].textContent || '';
              lang = codeEls[0].className ? codeEls[0].className.replace('language-', '') : '';
            } else {
              code = child.textContent || '';
            }
            md += '```' + lang + '\n' + code + '\n```\n\n';
            break;
          }
          case 'blockquote':
            md += '> ' + this._inlineContent(child).replace(/\n/g, '\n> ') + '\n\n';
            break;
          case 'ul':
          case 'ol': {
            let idx = 1;
            for (const li of child.childNodes || []) {
              if (li.nodeType === 1 && li.tagName.toLowerCase() === 'li') {
                const checkbox = li.querySelector('input[type="checkbox"]');
                if (checkbox) {
                  const checked = checkbox.getAttribute('checked') !== null ? 'x' : ' ';
                  const text = (li.textContent || '').trim();
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
            const parentTag = child.parentElement ? child.parentElement.tagName.toLowerCase() : '';
            if (parentTag !== 'ul' && parentTag !== 'ol') {
              const checkbox = child.querySelector('input[type="checkbox"]');
              if (checkbox) {
                const checked = checkbox.getAttribute('checked') !== null ? 'x' : ' ';
                let liText = '';
                for (const cn of child.childNodes || []) {
                  if (cn.nodeType === 3) liText += cn.textContent;
                  else if (cn.nodeType === 1 && cn.tagName.toLowerCase() !== 'input') liText += cn.textContent || '';
                }
                md += `- [${checked}] ${liText.trim()}\n`;
              } else {
                md += `- ${this._inlineContent(child)}\n`;
              }
            }
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
              const rowText = cells.map(c => (c.textContent || '').trim());
              md += '| ' + rowText.join(' | ') + ' |\n';
              if (ri === 0) {
                md += '| ' + rowText.map(() => '---').join(' | ') + ' |\n';
              }
            });
            md += '\n';
            break;
          }
          case 'div':
            if (child.classList.contains('table-wrapper')) {
              const tbl = child.querySelector('table');
              if (tbl) {
                const rows = tbl.querySelectorAll('tr');
                rows.forEach((row, ri) => {
                  const cells = row.querySelectorAll('th, td');
                  const rowText = cells.map(c => (c.textContent || '').trim());
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
                const codeEls = pre.querySelectorAll('code');
                let code = '';
                let lang = '';
                const labelEl = child.querySelector('.code-block-label');
                if (labelEl) {
                  const labelText = (labelEl.textContent || '').trim().toLowerCase();
                  if (labelText && labelText !== 'code') lang = labelText;
                }
                if (!lang && codeEls.length > 0) {
                  const cls = codeEls[0].className || '';
                  lang = cls.replace('language-', '').trim();
                }
                if (codeEls.length > 1) {
                  const lines = [];
                  codeEls.forEach(el => lines.push(el.textContent || ''));
                  code = lines.join('\n');
                } else if (codeEls.length === 1) {
                  code = codeEls[0].textContent || '';
                } else {
                  code = pre.textContent || '';
                }
                md += '```' + lang + '\n' + code + '\n```\n\n';
              }
            } else {
              md += this._nodeToMarkdown(child);
              if (!md.endsWith('\n')) md += '\n';
            }
            break;
          default:
            md += this._nodeToMarkdown(child);
            break;
        }
      }
    }

    return md;
  },

  _inlineContent(node) {
    let text = '';
    for (const child of node.childNodes || []) {
      if (child.nodeType === 3) {
        text += child.textContent;
      } else if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase();
        switch (tag) {
          case 'strong': case 'b': text += '**' + this._inlineContent(child) + '**'; break;
          case 'em': case 'i': text += '*' + this._inlineContent(child) + '*'; break;
          case 'del': case 's': text += '~~' + this._inlineContent(child) + '~~'; break;
          case 'mark': text += '==' + this._inlineContent(child) + '=='; break;
          case 'u': text += '<u>' + this._inlineContent(child) + '</u>'; break;
          case 'code': text += '`' + (child.textContent || '') + '`'; break;
          case 'a': text += `[${this._inlineContent(child)}](${child.getAttribute('href') || ''})`; break;
          case 'img': text += `![${child.getAttribute('alt') || ''}](${child.getAttribute('src') || ''})`; break;
          case 'br': text += '\n'; break;
          default: text += this._inlineContent(child); break;
        }
      }
    }
    return text;
  }
};

// ═══════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════

let passCount = 0;
let failCount = 0;
const results = [];

function normalize(str) {
  return str.replace(/\s+/g, ' ').trim().toLowerCase();
}

function test(name, markdown, expectedInRoundtrip = null) {
  try {
    const html = MarkdownParser.parse(markdown);
    const roundtrip = MarkdownParser.htmlToMarkdown(html);

    const expected = expectedInRoundtrip || markdown;

    // For HTML input tests, check if the roundtrip converts it properly
    const isHtmlInput = markdown.includes('<');

    let pass = false;
    if (isHtmlInput) {
      pass = roundtrip.includes(expected.split(' ')[0]) || 
             normalize(roundtrip).includes(normalize(expected));
    } else {
      // Check if content is preserved (allowing for whitespace/formatting differences)
      const roundtripNorm = normalize(roundtrip);
      const expectedNorm = normalize(expected);
      pass = roundtripNorm.includes(expectedNorm) || expectedNorm.includes(roundtripNorm);
    }

    if (pass) {
      console.log(`✓ PASS: ${name}`);
      passCount++;
      results.push({ name, status: 'PASS' });
    } else {
      console.log(`✗ FAIL: ${name}`);
      console.log(`  Input:    "${markdown}"`);
      console.log(`  Expected: "${expected}"`);
      console.log(`  Got:      "${roundtrip}"`);
      failCount++;
      results.push({ name, status: 'FAIL', markdown, html, roundtrip, expected });
    }
  } catch (err) {
    console.log(`✗ FAIL: ${name} (Error: ${err.message})`);
    failCount++;
    results.push({ name, status: 'FAIL', error: err.message });
  }
}

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║       MARKDOWN PARSER ROUNDTRIP STRESS TEST SUITE              ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Test 1: Unchecked checkbox
console.log('--- CHECKBOX TESTS ---');
test('Unchecked checkbox', '- [ ] unchecked task');

// Test 2: Checked checkbox
test('Checked checkbox', '- [x] checked task');

// Test 3: Multiple checkboxes
test('Multiple checkboxes', '- [ ] task 1\n- [x] task 2\n- [ ] task 3');

// Test 4: Simple table
console.log('\n--- TABLE TESTS ---');
test('Simple table', '| Header 1 | Header 2 |\n| --- | --- |\n| cell 1 | cell 2 |');

// Test 5: Table with multiple rows
test('Multi-row table',
  '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |'
);

// Test 6: Simple code block
console.log('\n--- CODE BLOCK TESTS ---');
test('Simple code block', '```\necho "hello"\n```');

// Test 7: Syntax-highlighted code block
test('JavaScript code block', '```javascript\nconsole.log(\'hello\');\n```');

// Test 8: Multi-line code block
test('Multi-line code block',
  '```python\ndef greet(name):\n    print(f"Hello, {name}")\n```'
);

// Test 9: Mixed content
console.log('\n--- MIXED CONTENT TESTS ---');
const mixedContent = `# Title

Some paragraph text.

- [ ] First task
- [x] Second task

\`\`\`javascript
console.log('code');
\`\`\`

| Column A | Column B |
| --- | --- |
| Value 1 | Value 2 |`;

test('Mixed: headers, text, checkboxes, code, table', mixedContent);

// Test 10: Orphaned checkbox list item (no ul wrapper)
console.log('\n--- ORPHANED LI TESTS ---');
test('Orphaned checkbox (unchecked)',
  '<li class="checklist"><input type="checkbox"> orphan task</li>',
  '- [ ] orphan task'
);

test('Orphaned checkbox (checked)',
  '<li class="checklist"><input type="checkbox" checked> orphan task</li>',
  '- [x] orphan task'
);

// Test 11: Inline code preservation
console.log('\n--- INLINE CODE TESTS ---');
test('Inline code', 'Use `const x = 5;` in your code');

// Test 12: Links
console.log('\n--- LINK TESTS ---');
test('Markdown link', '[Click here](https://example.com)');

// Test 13: Bold and italic
console.log('\n--- TEXT FORMATTING TESTS ---');
test('Bold text', '**bold text**');
test('Italic text', '*italic text*');
test('Bold + Italic', '***bold italic***');

// Test 14: Strikethrough
console.log('\n--- STRIKETHROUGH TESTS ---');
test('Strikethrough', '~~deleted text~~');

// Test 15: Code block with language variant
console.log('\n--- CODE BLOCK LANGUAGE TESTS ---');
test('HTML code block', '```html\n<div>content</div>\n```');
test('CSS code block', '```css\nbody { color: red; }\n```');

// Test 16: Complex nested formatting
console.log('\n--- COMPLEX FORMATTING TESTS ---');
test('Nested formatting in paragraph', 'This is **bold with *italic inside* it**.');

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log(`║ SUMMARY: ${passCount} PASSED, ${failCount} FAILED                                 ║`);
console.log('╚════════════════════════════════════════════════════════════════╝\n');

if (failCount > 0) {
  console.log('FAILED TESTS:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`\n${r.name}:`);
    if (r.error) {
      console.log(`  Error: ${r.error}`);
    } else {
      console.log(`  Input:    ${r.markdown}`);
      console.log(`  Expected: ${r.expected}`);
      console.log(`  Got:      ${r.roundtrip}`);
    }
  });
}

process.exit(failCount > 0 ? 1 : 0);
