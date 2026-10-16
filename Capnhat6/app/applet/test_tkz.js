// Test script for convertTkzTabToHtml
function convertTkzTabToHtml(rawCode) {
  try {
    let clean = rawCode
      .replace(/\\begin\{tikzpicture\}(?:\[.*?\])?/g, '')
      .replace(/\\end\{tikzpicture\}/g, '')
      .trim();

    // 1. Parse \tkzTabInit
    const initMatch = clean.match(/\\tkzTabInit(?:\s*\[(.*?)\])?\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/);
    if (!initMatch) return null;

    const rowDefsRaw = initMatch[2].trim();
    const colValuesRaw = initMatch[3].trim();

    // Parse Row Headers
    const rowHeaders = rowDefsRaw.split(',').map(r => {
      const parts = r.split('/');
      let label = (parts[0] || '').trim();
      if (!label.startsWith('$') && !label.endsWith('$')) {
        label = `$${label}$`;
      }
      const height = parseFloat(parts[1]) || 1;
      return { label, height };
    });

    // Parse Column Values (x points)
    const colPoints = colValuesRaw.split(',').map(c => {
      let val = c.trim();
      if (!val.startsWith('$') && !val.endsWith('$')) {
        val = `$${val}$`;
      }
      return val;
    });

    const N = colPoints.length;
    if (N < 2) return null;

    // 2. Parse \tkzTabLine (optional)
    let signItems = [];
    const lineMatch = clean.match(/\\tkzTabLine\s*\{([\s\S]*?)\}/);
    if (lineMatch) {
      const rawLine = lineMatch[1].trim();
      let rawArr = rawLine.split(',').map(s => s.trim());
      if (rawArr.length > 0 && rawArr[0] === '') rawArr.shift();
      if (rawArr.length > 0 && rawArr[rawArr.length - 1] === '') rawArr.pop();
      signItems = rawArr;
    }

    // 3. Parse \tkzTabVar (optional)
    let varPoints = [];
    const varMatch = clean.match(/\\tkzTabVar\s*\{([\s\S]*?)\}/);
    if (varMatch) {
      const rawVar = varMatch[1].trim();
      const entries = rawVar.split(',').map(s => s.trim()).filter(Boolean);
      varPoints = entries.map(entry => {
        const slashIdx = entry.indexOf('/');
        if (slashIdx === -1) {
          return { type: '-', val: entry.trim() };
        }
        const type = entry.substring(0, slashIdx).trim();
        let val = entry.substring(slashIdx + 1).trim();
        return { type, val };
      });
    }

    const tableId = 'tkz_' + Math.random().toString(36).substr(2, 7);
    const colSpan = (N * 2) - 1;
    const minWidth = Math.max(340, N * 85);

    let html = `
      <div class="tkz-tab-wrapper overflow-x-auto my-3 max-w-full text-center">
        <div class="inline-block border-2 border-slate-700 bg-white shadow-md rounded-lg overflow-hidden text-xs sm:text-sm">
          <table class="border-collapse tkz-tab-table mx-auto select-none" style="min-width: ${minWidth}px;">
            <tbody>
              <!-- Row 1: x values -->
              <tr class="border-b border-slate-700">
                <th class="border-r border-slate-700 px-3 py-2 bg-slate-100 font-serif font-bold text-slate-800 text-center" style="width: 75px;">
                  <span class="whitespace-nowrap inline-block tkz-tab-val">${rowHeaders[0]?.label || '$x$'}</span>
                </th>
    `;

    for (let i = 0; i < N; i++) {
      html += `
        <td class="px-2 py-2 text-center" style="min-width: 40px;">
          <span class="whitespace-nowrap inline-block font-semibold text-slate-800 tkz-tab-val">${colPoints[i]}</span>
        </td>
      `;
      if (i < N - 1) {
        html += `<td class="px-2 py-2 text-center" style="min-width: 50px;"></td>`;
      }
    }

    html += `</tr>`;

    // Row 2: Signs (y') if present
    if (rowHeaders.length > 1 && (signItems.length > 0 || rowHeaders[1].label.includes("'"))) {
      html += `
        <tr class="border-b border-slate-700 bg-slate-50/50">
          <th class="border-r border-slate-700 px-3 py-2 bg-slate-100 font-serif font-bold text-slate-800 text-center">
            <span class="whitespace-nowrap inline-block tkz-tab-val">${rowHeaders[1]?.label || "$y'$"}</span>
          </th>
      `;

      let signIdx = 0;
      for (let i = 0; i < colSpan; i++) {
        let content = '';
        if (signIdx < signItems.length) {
          let item = signItems[signIdx];
          if (i % 2 === 1) {
            // Interval
            if (item === '+' || item === '-') {
              content = `<span class="whitespace-nowrap inline-block font-bold text-base text-slate-700 tkz-tab-val">$${item}$</span>`;
              signIdx++;
            }
          } else {
            // Point
            if (i > 0 && i < colSpan - 1) {
              if (item === '0' || item === '$0$') {
                content = `<span class="whitespace-nowrap inline-block font-bold text-slate-800 tkz-tab-val">$0$</span>`;
                signIdx++;
              } else if (item === '||' || item === 'd') {
                content = `<span class="whitespace-nowrap inline-block font-bold text-slate-500 tkz-tab-val">||</span>`;
                signIdx++;
              }
            }
          }
        }
        html += `<td class="px-1 py-1.5 text-center">${content}</td>`;
      }
      html += `</tr>`;
    }

    // Row 3: Variations (y) if present
    if (varPoints.length > 0) {
      const varHeader = rowHeaders[2]?.label || rowHeaders[1]?.label || '$y$';
      const containerHeight = 130;
      const totalWidthPx = minWidth - 75;

      let svgLines = '';
      let valueNodes = '';

      const nodeCoords = [];
      for (let i = 0; i < N; i++) {
        const vp = varPoints[i] || { type: '-', val: '' };
        const xPct = (10 + (i * 80 / (N - 1))).toFixed(1);
        const xPx = Math.round((parseFloat(xPct) / 100) * totalWidthPx);
        let yPx = 105; // bottom default
        let isDouble = vp.type.includes('D');

        if (vp.type.startsWith('+')) {
          yPx = 22; // top
        } else if (vp.type.startsWith('R')) {
          yPx = 65; // middle
        }

        nodeCoords.push({ xPx, yPx, xPct, type: vp.type, val: vp.val, isDouble });

        let displayVal = vp.val;
        if (!displayVal.startsWith('$') && !displayVal.endsWith('$')) {
          displayVal = `$${displayVal}$`;
        }

        if (isDouble && displayVal.includes('/')) {
          const parts = displayVal.split('/');
          valueNodes += `
            <div class="absolute -translate-y-1/2 whitespace-nowrap tkz-nowrap" style="left: calc(${xPct}% - 14px); top: 24px; transform: translate(-100%, -50%);">
              <span class="whitespace-nowrap inline-block text-slate-800 font-semibold tkz-tab-val">${parts[0]}</span>
            </div>
            <div class="absolute -translate-y-1/2 whitespace-nowrap tkz-nowrap" style="left: calc(${xPct}% + 14px); top: 105px; transform: translate(0, -50%);">
              <span class="whitespace-nowrap inline-block text-slate-800 font-semibold tkz-tab-val">${parts[1]}</span>
            </div>
          `;
        } else {
          valueNodes += `
            <div class="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap tkz-nowrap" style="left: ${xPct}%; top: ${yPx}px;">
              <span class="whitespace-nowrap inline-block text-slate-800 font-semibold tkz-tab-val">${displayVal}</span>
            </div>
          `;
        }
      }

      // Generate SVG arrows between points
      for (let i = 0; i < nodeCoords.length - 1; i++) {
        const from = nodeCoords[i];
        const to = nodeCoords[i + 1];

        if (from.isDouble && to.isDouble) continue;

        let startX = from.xPx + 16;
        let startY = from.yPx;
        let endX = to.xPx - 16;
        let endY = to.yPx;

        if (from.yPx < to.yPx) {
          // Going down
          startY += 10;
          endY -= 10;
        } else if (from.yPx > to.yPx) {
          // Going up
          startY -= 10;
          endY += 10;
        }

        svgLines += `
          <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="#2563eb" stroke-width="1.8" marker-end="url(#tkz-arr-${tableId})" />
        `;
      }

      // Add double lines if any
      nodeCoords.forEach(nc => {
        if (nc.isDouble) {
          svgLines += `
            <line x1="${nc.xPx - 3}" y1="0" x2="${nc.xPx - 3}" y2="${containerHeight}" stroke="#475569" stroke-width="1.5" />
            <line x1="${nc.xPx + 3}" y1="0" x2="${nc.xPx + 3}" y2="${containerHeight}" stroke="#475569" stroke-width="1.5" />
          `;
        }
      });

      html += `
        <tr>
          <th class="border-r border-slate-700 px-3 py-2 bg-slate-100 font-serif font-bold text-slate-800 text-center" style="height: ${containerHeight}px;">
            <span class="whitespace-nowrap inline-block tkz-tab-val">${varHeader}</span>
          </th>
          <td colspan="${colSpan}" class="p-0 relative" style="height: ${containerHeight}px;">
            <div class="relative w-full h-full overflow-hidden" style="min-height: ${containerHeight}px;">
              <svg class="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 ${totalWidthPx} ${containerHeight}">
                <defs>
                  <marker id="tkz-arr-${tableId}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
                  </marker>
                </defs>
                ${svgLines}
              </svg>
              ${valueNodes}
            </div>
          </td>
        </tr>
      `;
    }

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    return html;
  } catch (err) {
    console.error('Error in convertTkzTabToHtml:', err);
    return null;
  }
}

// Test with sample
const latex = `
\\begin{tikzpicture}
\\tkzTabInit[lgt=1.5,espcl=2.5]{$x$/1,$y'$/1,$y$/2}{$-\\infty$,$-2$,$0$,$+\\infty$}
\\tkzTabLine{,+,$0$,-,$0$,+,}
\\tkzTabVar{-/$-\\infty$,+/$2$,-/$-2$,+/$+\\infty$}
\\end{tikzpicture}
`;

const res = convertTkzTabToHtml(latex);
console.log('Result length:', res ? res.length : 0);
console.log('Contains table:', res.includes('<table'));
console.log('Contains SVG line:', res.includes('<line'));
console.log('Contains whitespace-nowrap:', res.includes('whitespace-nowrap'));
