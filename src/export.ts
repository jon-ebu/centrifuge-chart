// Client-side export utilities

import { buildRotorSVG, buildInvalidSVG, svgToPngDataURL, svgToDataURL } from './render'
import { isBalanceable, findConfig } from './math'

export function downloadURL(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

export function exportCardSVG(
  n: number,
  K: number,
  activeSlots: Set<number>,
  fillColor: string,
  slotColors: Map<number, string>
): void {
  let svg
  if (!isBalanceable(n, K) && activeSlots.size === 0) {
    svg = buildInvalidSVG(400, String(n))
  } else {
    svg = buildRotorSVG({ K, activeSlots, size: 400, fillColor, slotColors, label: String(n) })
  }
  const url = svgToDataURL(svg)
  downloadURL(url, `centrifuge-K${K}-n${n}.svg`)
}

export async function exportCardPNG(
  n: number,
  K: number,
  activeSlots: Set<number>,
  fillColor: string,
  slotColors: Map<number, string>
): Promise<void> {
  let svg
  if (!isBalanceable(n, K) && activeSlots.size === 0) {
    svg = buildInvalidSVG(400, String(n))
  } else {
    svg = buildRotorSVG({ K, activeSlots, size: 400, fillColor, slotColors, label: String(n) })
  }
  const url = await svgToPngDataURL(svg, 4)
  downloadURL(url, `centrifuge-K${K}-n${n}.png`)
}

interface PosterCard {
  n: number
  balanceable: boolean
  activeSlots: Set<number>
  fillColor: string
  slotTypeMap: Map<number, number>
}

const POSTER_RING_R = 0.46   // must match render.ts RING_RADIUS_RATIO

function buildPosterSVG(K: number, cards: PosterCard[], cols: number): SVGSVGElement {
  const CARD = 180
  const PAD = 8
  const rows = Math.ceil(cards.length / cols)
  const totalW = cols * CARD + (cols + 1) * PAD
  const totalH = rows * CARD + (rows + 1) * PAD + 72

  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`)
  svg.setAttribute('width', String(totalW))
  svg.setAttribute('height', String(totalH))
  svg.setAttribute('xmlns', ns)

  const bg = document.createElementNS(ns, 'rect')
  bg.setAttribute('width', String(totalW))
  bg.setAttribute('height', String(totalH))
  bg.setAttribute('fill', 'white')
  svg.appendChild(bg)

  const title = document.createElementNS(ns, 'text')
  title.setAttribute('x', String(totalW / 2))
  title.setAttribute('y', '44')
  title.setAttribute('text-anchor', 'middle')
  title.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')
  title.setAttribute('font-size', '26')
  title.setAttribute('font-weight', '700')
  title.setAttribute('fill', '#1e293b')
  title.textContent = `Centrifuge Balance Chart — ${K}-Slot Rotor`
  svg.appendChild(title)

  const half = CARD / 2
  const R = half * POSTER_RING_R
  const arcRadius = R * Math.sin(Math.PI / K)
  const fdr = Math.min(arcRadius * 0.90, half * 0.078)
  const edr = fdr * 0.38

  cards.forEach((card, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const x = PAD + col * (CARD + PAD)
    const y = 60 + PAD + row * (CARD + PAD)

    const rect = document.createElementNS(ns, 'rect')
    rect.setAttribute('x', String(x))
    rect.setAttribute('y', String(y))
    rect.setAttribute('width', String(CARD))
    rect.setAttribute('height', String(CARD))
    rect.setAttribute('rx', '4')
    rect.setAttribute('fill', 'white')
    rect.setAttribute('stroke', '#e2e8f0')
    rect.setAttribute('stroke-width', '1')
    svg.appendChild(rect)

    if (!card.balanceable) {
      const pad = CARD * 0.20
      const sw = CARD * 0.05
      for (const [x1r, y1r, x2r, y2r] of [[pad, pad, CARD - pad, CARD - pad], [CARD - pad, pad, pad, CARD - pad]]) {
        const line = document.createElementNS(ns, 'line')
        line.setAttribute('x1', String(x + x1r))
        line.setAttribute('y1', String(y + y1r))
        line.setAttribute('x2', String(x + x2r))
        line.setAttribute('y2', String(y + y2r))
        line.setAttribute('stroke', '#d1d5db')
        line.setAttribute('stroke-width', String(sw))
        line.setAttribute('stroke-linecap', 'round')
        svg.appendChild(line)
      }
    } else {
      const cx = x + half, cy = y + half

      // Empty slots first
      for (let i = 0; i < K; i++) {
        if (card.activeSlots.has(i)) continue
        const a = (2 * Math.PI * i) / K - Math.PI / 2
        const ex = cx + R * Math.cos(a), ey = cy + R * Math.sin(a)
        const c = document.createElementNS(ns, 'circle')
        c.setAttribute('cx', String(ex))
        c.setAttribute('cy', String(ey))
        c.setAttribute('r', String(edr))
        c.setAttribute('fill', 'none')
        c.setAttribute('stroke', '#bfccd8')
        c.setAttribute('stroke-width', String(Math.max(edr * 0.7, 0.4)))
        svg.appendChild(c)
      }

      // Filled slots
      for (let i = 0; i < K; i++) {
        if (!card.activeSlots.has(i)) continue
        const a = (2 * Math.PI * i) / K - Math.PI / 2
        const ex = cx + R * Math.cos(a), ey = cy + R * Math.sin(a)
        const pType = card.slotTypeMap.get(i) ?? 0
        const color = pType === 3 ? '#e53e3e' : pType >= 2 ? '#3b82f6' : card.fillColor
        const c = document.createElementNS(ns, 'circle')
        c.setAttribute('cx', String(ex))
        c.setAttribute('cy', String(ey))
        c.setAttribute('r', String(fdr))
        c.setAttribute('fill', color)
        c.setAttribute('stroke', 'none')
        svg.appendChild(c)
      }
    }

    // Center label (number)
    const labelStr = String(card.n)
    const fontSize = labelStr.length > 2 ? CARD * 0.22 : CARD * 0.30
    const lbl = document.createElementNS(ns, 'text')
    lbl.setAttribute('x', String(x + half))
    lbl.setAttribute('y', String(y + half))
    lbl.setAttribute('text-anchor', 'middle')
    lbl.setAttribute('dominant-baseline', 'central')
    lbl.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')
    lbl.setAttribute('font-size', String(fontSize))
    lbl.setAttribute('font-weight', '600')
    lbl.setAttribute('fill', card.balanceable ? '#4a5568' : '#9ca3af')
    lbl.textContent = labelStr
    svg.appendChild(lbl)
  })

  return svg
}

export async function exportFullPoster(K: number, cols = 6): Promise<void> {
  const cards: PosterCard[] = []
  for (let n = 1; n <= K; n++) {
    const cfg = findConfig(n, K)
    const balanceable = cfg !== null
    const activeSlots = cfg ? new Set(cfg.slots) : new Set<number>()
    const fillColor = n % 2 === 0 ? '#3b82f6' : '#ef4444'
    const slotTypeMap = new Map<number, number>()
    if (cfg) cfg.slots.forEach((s, i) => slotTypeMap.set(s, cfg.slotTypes[i]))
    cards.push({ n, balanceable, activeSlots, fillColor, slotTypeMap })
  }
  const svg = buildPosterSVG(K, cards, cols)
  const url = await svgToPngDataURL(svg, 3)
  downloadURL(url, `centrifuge-balance-chart-K${K}.png`)
}

export async function exportPosterSVG(K: number, cols = 6): Promise<void> {
  const cards: PosterCard[] = []
  for (let n = 1; n <= K; n++) {
    const cfg = findConfig(n, K)
    const balanceable = cfg !== null
    const activeSlots = cfg ? new Set(cfg.slots) : new Set<number>()
    const fillColor = n % 2 === 0 ? '#3b82f6' : '#ef4444'
    const slotTypeMap = new Map<number, number>()
    if (cfg) cfg.slots.forEach((s, i) => slotTypeMap.set(s, cfg.slotTypes[i]))
    cards.push({ n, balanceable, activeSlots, fillColor, slotTypeMap })
  }
  const svg = buildPosterSVG(K, cards, cols)
  const url = svgToDataURL(svg)
  downloadURL(url, `centrifuge-balance-chart-K${K}.svg`)
}
