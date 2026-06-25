// Client-side export utilities

import { buildRotorSVG, buildInvalidSVG, svgToPngDataURL, svgToDataURL } from './render'
import { isBalanceable, findGaps } from './math'

export function downloadURL(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

export function exportCardSVG(
  n: number, K: number, activeSlots: Set<number>,
  fillColor: string, slotColors: Map<number, string>
): void {
  const svg = isBalanceable(n, K) || activeSlots.size > 0
    ? buildRotorSVG({ K, activeSlots, size: 400, fillColor, slotColors, label: String(n) })
    : buildInvalidSVG(400, String(n))
  downloadURL(svgToDataURL(svg), `centrifuge-K${K}-n${n}.svg`)
}

export async function exportCardPNG(
  n: number, K: number, activeSlots: Set<number>,
  fillColor: string, slotColors: Map<number, string>
): Promise<void> {
  const svg = isBalanceable(n, K) || activeSlots.size > 0
    ? buildRotorSVG({ K, activeSlots, size: 400, fillColor, slotColors, label: String(n) })
    : buildInvalidSVG(400, String(n))
  downloadURL(await svgToPngDataURL(svg, 4), `centrifuge-K${K}-n${n}.png`)
}

export interface PosterCard {
  n: number
  balanceable: boolean
  activeSlots: Set<number>
  fillColor: string
  slotTypeMap: Map<number, number>
}

export type PosterFormat = 'default' | 'letter-portrait' | 'letter-landscape'

const RING_R = 0.46

function buildPosterSVG(
  K: number, posterCards: PosterCard[],
  pairColor: string, triColor: string,
  format: PosterFormat,
  showGaps = false, gapThreshold = 4
): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'

  // ── Layout parameters ────────────────────────────────────────────────────
  let totalW: number, totalH: number
  let CARD: number, PAD: number, cols: number
  let cardX0: number, cardY0: number
  let titleX: number, titleY: number, titleSize: number
  let svgW: string, svgH: string

  if (format === 'default') {
    cols = 6; CARD = 180; PAD = 8
    const rows = Math.ceil(K / cols)
    totalW = cols * CARD + (cols + 1) * PAD
    totalH = rows * CARD + (rows + 1) * PAD + 72
    cardX0 = PAD; cardY0 = 68
    titleX = totalW / 2; titleY = 44; titleSize = 24
    svgW = String(totalW); svgH = String(totalH)
  } else {
    const landscape = format === 'letter-landscape'
    totalW = landscape ? 792 : 612    // points (72pt = 1in)
    totalH = landscape ? 612 : 792
    const MARGIN = 24; const TITLE_H = 38; PAD = 6
    const availW = totalW - 2 * MARGIN
    const availH = totalH - 2 * MARGIN - TITLE_H

    // Pick the column count that produces the largest cards while fitting all rows
    let bestCols = 4, bestCard = 40
    for (let c = 3; c <= 12; c++) {
      const cw = (availW - (c - 1) * PAD) / c
      const rows = Math.ceil(K / c)
      const ch = (availH - (rows - 1) * PAD) / rows
      const card = Math.min(cw, ch)
      if (card > bestCard) { bestCard = card; bestCols = c }
    }
    CARD = Math.floor(bestCard); cols = bestCols
    cardX0 = MARGIN; cardY0 = MARGIN + TITLE_H
    titleX = totalW / 2; titleY = MARGIN + TITLE_H * 0.72; titleSize = 18
    svgW = landscape ? '11in' : '8.5in'
    svgH = landscape ? '8.5in' : '11in'
  }

  // ── SVG scaffold ─────────────────────────────────────────────────────────
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`)
  svg.setAttribute('width', svgW)
  svg.setAttribute('height', svgH)
  svg.setAttribute('xmlns', ns)

  const bg = document.createElementNS(ns, 'rect')
  bg.setAttribute('width', String(totalW)); bg.setAttribute('height', String(totalH))
  bg.setAttribute('fill', 'white')
  svg.appendChild(bg)

  const title = document.createElementNS(ns, 'text')
  title.setAttribute('x', String(titleX)); title.setAttribute('y', String(titleY))
  title.setAttribute('text-anchor', 'middle')
  title.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')
  title.setAttribute('font-size', String(titleSize))
  title.setAttribute('font-weight', '700'); title.setAttribute('fill', '#1e293b')
  title.textContent = `Centrifuge Balance Chart — ${K}-Slot Rotor`
  svg.appendChild(title)

  // ── Cards ─────────────────────────────────────────────────────────────────
  const half = CARD / 2
  const R = half * RING_R
  const arcRadius = R * Math.sin(Math.PI / K)
  const fdr = Math.min(arcRadius * 0.90, half * 0.078)
  const edr = fdr * 0.38

  posterCards.forEach((card, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const x = cardX0 + col * (CARD + PAD)
    const y = cardY0 + row * (CARD + PAD)

    const rect = document.createElementNS(ns, 'rect')
    rect.setAttribute('x', String(x)); rect.setAttribute('y', String(y))
    rect.setAttribute('width', String(CARD)); rect.setAttribute('height', String(CARD))
    rect.setAttribute('rx', '4'); rect.setAttribute('fill', 'white')
    rect.setAttribute('stroke', '#e2e8f0'); rect.setAttribute('stroke-width', '1')
    svg.appendChild(rect)

    if (!card.balanceable) {
      const p = CARD * 0.20, sw = CARD * 0.05
      for (const [x1r, y1r, x2r, y2r] of [
        [p, p, CARD - p, CARD - p], [CARD - p, p, p, CARD - p]
      ] as [number, number, number, number][]) {
        const line = document.createElementNS(ns, 'line')
        line.setAttribute('x1', String(x + x1r)); line.setAttribute('y1', String(y + y1r))
        line.setAttribute('x2', String(x + x2r)); line.setAttribute('y2', String(y + y2r))
        line.setAttribute('stroke', '#d1d5db'); line.setAttribute('stroke-width', String(sw))
        line.setAttribute('stroke-linecap', 'round')
        svg.appendChild(line)
      }
    } else {
      const cx = x + half, cy = y + half
      // Empty slots
      for (let i = 0; i < K; i++) {
        if (card.activeSlots.has(i)) continue
        const a = (2 * Math.PI * i) / K - Math.PI / 2
        const c = document.createElementNS(ns, 'circle')
        c.setAttribute('cx', String(cx + R * Math.cos(a))); c.setAttribute('cy', String(cy + R * Math.sin(a)))
        c.setAttribute('r', String(edr)); c.setAttribute('fill', 'none')
        c.setAttribute('stroke', '#bfccd8'); c.setAttribute('stroke-width', String(Math.max(edr * 0.7, 0.4)))
        svg.appendChild(c)
      }
      // Filled slots
      for (let i = 0; i < K; i++) {
        if (!card.activeSlots.has(i)) continue
        const a = (2 * Math.PI * i) / K - Math.PI / 2
        const pType = card.slotTypeMap.get(i) ?? 0
        const c = document.createElementNS(ns, 'circle')
        c.setAttribute('cx', String(cx + R * Math.cos(a))); c.setAttribute('cy', String(cy + R * Math.sin(a)))
        c.setAttribute('r', String(fdr)); c.setAttribute('fill', pType === 3 ? triColor : pairColor)
        c.setAttribute('stroke', 'none')
        svg.appendChild(c)
      }
      // Gap arcs
      if (showGaps) {
        const gaps = findGaps(card.activeSlots, K).filter(g => g.length >= gapThreshold)
        if (gaps.length > 0) {
          const slotSpacing = (2 * Math.PI) / K
          const arcR = R + fdr + Math.max(CARD * 0.028, 3.0)
          const textR = arcR + CARD * 0.058
          const strokeW = Math.max(CARD * 0.005, 0.45)
          const fontSize = CARD * 0.072
          const color = '#4b5563'
          for (const gap of gaps) {
            const firstAngle = (2 * Math.PI * gap.startSlot / K) - Math.PI / 2
            const lastAngle = firstAngle + (gap.length - 1) * slotSpacing
            const angPad = (edr / arcR) * 0.4
            const arcStart = firstAngle - angPad
            const arcEnd = lastAngle + angPad
            const arcMid = (firstAngle + lastAngle) / 2
            const largeArc = (arcEnd - arcStart) > Math.PI ? 1 : 0
            const ax1 = cx + arcR * Math.cos(arcStart), ay1 = cy + arcR * Math.sin(arcStart)
            const ax2 = cx + arcR * Math.cos(arcEnd), ay2 = cy + arcR * Math.sin(arcEnd)
            const arc = document.createElementNS(ns, 'path')
            arc.setAttribute('d', `M ${ax1} ${ay1} A ${arcR} ${arcR} 0 ${largeArc} 1 ${ax2} ${ay2}`)
            arc.setAttribute('fill', 'none')
            arc.setAttribute('stroke', color)
            arc.setAttribute('stroke-width', String(strokeW))
            arc.setAttribute('stroke-linecap', 'round')
            svg.appendChild(arc)
            const txt = document.createElementNS(ns, 'text')
            txt.setAttribute('x', String(cx + textR * Math.cos(arcMid)))
            txt.setAttribute('y', String(cy + textR * Math.sin(arcMid)))
            txt.setAttribute('text-anchor', 'middle')
            txt.setAttribute('dominant-baseline', 'central')
            txt.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')
            txt.setAttribute('font-size', String(fontSize))
            txt.setAttribute('font-weight', '400')
            txt.setAttribute('fill', color)
            txt.textContent = String(gap.length)
            svg.appendChild(txt)
          }
        }
      }
    }

    // Center label
    const labelStr = String(card.n)
    const lbl = document.createElementNS(ns, 'text')
    lbl.setAttribute('x', String(x + half)); lbl.setAttribute('y', String(y + half))
    lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('dominant-baseline', 'central')
    lbl.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')
    lbl.setAttribute('font-size', String(labelStr.length > 2 ? CARD * 0.22 : CARD * 0.30))
    lbl.setAttribute('font-weight', '600')
    lbl.setAttribute('fill', card.balanceable ? '#4a5568' : '#9ca3af')
    lbl.textContent = labelStr
    svg.appendChild(lbl)
  })

  return svg
}

export async function exportFullPoster(
  K: number, cardsData: PosterCard[],
  pairColor: string, triColor: string,
  format: PosterFormat = 'default',
  showGaps = false, gapThreshold = 4
): Promise<void> {
  const svg = buildPosterSVG(K, cardsData, pairColor, triColor, format, showGaps, gapThreshold)
  let url: string
  if (format === 'default') {
    url = await svgToPngDataURL(svg, 3)
  } else {
    // Letter: clone with pixel dimensions for rasterization at 150 DPI
    const landscape = format === 'letter-landscape'
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('width', String(landscape ? 1650 : 1275))
    clone.setAttribute('height', String(landscape ? 1275 : 1650))
    url = await svgToPngDataURL(clone, 1)
  }
  const suffix = format === 'default' ? '' : `-${format}`
  downloadURL(url, `centrifuge-balance-chart-K${K}${suffix}.png`)
}

export async function exportPosterSVG(
  K: number, cardsData: PosterCard[],
  pairColor: string, triColor: string,
  format: PosterFormat = 'default',
  showGaps = false, gapThreshold = 4
): Promise<void> {
  const svg = buildPosterSVG(K, cardsData, pairColor, triColor, format, showGaps, gapThreshold)
  const suffix = format === 'default' ? '' : `-${format}`
  downloadURL(svgToDataURL(svg), `centrifuge-balance-chart-K${K}${suffix}.svg`)
}
