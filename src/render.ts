// SVG rendering for centrifuge rotor cards

export interface GapBadge {
  length: number    // consecutive empty slot count
  midAngle: number  // angle (radians) at midpoint of gap — badge placed here on the ring
}

export interface RenderOptions {
  K: number
  activeSlots: Set<number>
  size: number
  fillColor: string             // fallback color (used when slotTypeMap has no entry)
  label?: string                // shown in center of ring
  slotTypeMap?: Map<number, number>  // slotIndex → polygon size for per-polygon coloring
  gapBadges?: GapBadge[]        // if set, draw a badge at the midpoint of each gap
  interactive?: boolean
  slotColors?: Map<number, string>   // user-overridden per-slot colors (takes precedence)
  onSlotClick?: (slotIdx: number) => void
}

// RING_RADIUS_RATIO: ring center radius / (size/2). Larger = ring fills more card.
const RING_RADIUS_RATIO = 0.46

// Filled dot radius: nearly arc-filling for good visual weight
function filledDotRadius(K: number, half: number): number {
  const R = half * RING_RADIUS_RATIO
  const arcRadius = R * Math.sin(Math.PI / K)
  return Math.min(arcRadius * 0.90, half * 0.078)
}

// Empty slot dot radius: much smaller, just a ghost marker
function emptyDotRadius(K: number, half: number): number {
  return filledDotRadius(K, half) * 0.38
}

// Color from polygon type: triangles (3-gon) = red, everything else = blue
function polyColor(polygonSize: number, fallback: string): string {
  if (polygonSize === 3) return '#e53e3e'
  if (polygonSize >= 2) return '#3b82f6'
  return fallback
}

function slotCenter(i: number, K: number, cx: number, cy: number, R: number): [number, number] {
  const a = (2 * Math.PI * i) / K - Math.PI / 2
  return [cx + R * Math.cos(a), cy + R * Math.sin(a)]
}

export function buildRotorSVG(opts: RenderOptions): SVGSVGElement {
  const { K, activeSlots, size, fillColor, label, slotTypeMap, gapBadges, interactive, slotColors, onSlotClick } = opts
  const half = size / 2
  const R = half * RING_RADIUS_RATIO
  const fdr = filledDotRadius(K, half)
  const edr = emptyDotRadius(K, half)

  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`)
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('xmlns', ns)

  const bg = document.createElementNS(ns, 'rect')
  bg.setAttribute('width', String(size))
  bg.setAttribute('height', String(size))
  bg.setAttribute('fill', 'white')
  svg.appendChild(bg)

  // Draw empty slots first (behind filled)
  for (let i = 0; i < K; i++) {
    if (activeSlots.has(i)) continue
    const [cx, cy] = slotCenter(i, K, half, half, R)
    const circle = document.createElementNS(ns, 'circle')
    circle.setAttribute('cx', String(cx))
    circle.setAttribute('cy', String(cy))
    circle.setAttribute('r', String(edr))
    circle.setAttribute('fill', 'none')
    circle.setAttribute('stroke', '#bfccd8')
    circle.setAttribute('stroke-width', String(Math.max(edr * 0.7, 0.4)))
    if (interactive && onSlotClick) {
      circle.style.cursor = 'pointer'
      circle.addEventListener('click', () => onSlotClick(i))
      circle.addEventListener('mouseenter', () => circle.setAttribute('stroke', '#93a8c0'))
      circle.addEventListener('mouseleave', () => circle.setAttribute('stroke', '#bfccd8'))
    }
    svg.appendChild(circle)
  }

  // Draw filled slots on top
  for (let i = 0; i < K; i++) {
    if (!activeSlots.has(i)) continue
    const [cx, cy] = slotCenter(i, K, half, half, R)
    const pType = slotTypeMap?.get(i) ?? 0
    const baseColor = pType > 0 ? polyColor(pType, fillColor) : fillColor
    const color = slotColors?.get(i) ?? baseColor

    const circle = document.createElementNS(ns, 'circle')
    circle.setAttribute('cx', String(cx))
    circle.setAttribute('cy', String(cy))
    circle.setAttribute('r', String(fdr))
    circle.setAttribute('fill', color)
    circle.setAttribute('stroke', 'none')
    circle.setAttribute('class', 'slot-circle')
    if (interactive && onSlotClick) {
      circle.style.cursor = 'pointer'
      circle.addEventListener('click', () => onSlotClick(i))
      circle.addEventListener('mouseenter', () => circle.setAttribute('opacity', '0.72'))
      circle.addEventListener('mouseleave', () => circle.setAttribute('opacity', '1'))
    }
    svg.appendChild(circle)
  }

  // Center label
  if (label) {
    const fontSize = label.length > 2 ? size * 0.22 : size * 0.30
    const text = document.createElementNS(ns, 'text')
    text.setAttribute('x', String(half))
    text.setAttribute('y', String(half))
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'central')
    text.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')
    text.setAttribute('font-size', String(fontSize))
    text.setAttribute('font-weight', '600')
    text.setAttribute('fill', '#4a5568')
    text.setAttribute('pointer-events', 'none')
    text.textContent = label
    svg.appendChild(text)
  }

  // Gap badges: one floating circle per qualifying gap arc
  if (gapBadges && gapBadges.length > 0) {
    const sw = String(Math.max(size * 0.009, 0.8))
    for (const gap of gapBadges) {
      const bx = half + R * Math.cos(gap.midAngle)
      const by = half + R * Math.sin(gap.midAngle)
      const numStr = String(gap.length)
      const br = size * (numStr.length > 1 ? 0.082 : 0.075)
      const bFontSize = br * 1.15

      const bgCirc = document.createElementNS(ns, 'circle')
      bgCirc.setAttribute('cx', String(bx))
      bgCirc.setAttribute('cy', String(by))
      bgCirc.setAttribute('r', String(br))
      bgCirc.setAttribute('fill', 'white')
      bgCirc.setAttribute('stroke', '#1a202c')
      bgCirc.setAttribute('stroke-width', sw)
      bgCirc.setAttribute('pointer-events', 'none')
      svg.appendChild(bgCirc)

      const txt = document.createElementNS(ns, 'text')
      txt.setAttribute('x', String(bx))
      txt.setAttribute('y', String(by))
      txt.setAttribute('text-anchor', 'middle')
      txt.setAttribute('dominant-baseline', 'central')
      txt.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')
      txt.setAttribute('font-size', String(bFontSize))
      txt.setAttribute('font-weight', '700')
      txt.setAttribute('fill', '#1a202c')
      txt.setAttribute('pointer-events', 'none')
      txt.textContent = numStr
      svg.appendChild(txt)
    }
  }

  return svg
}

// Invalid card: just the number with a light X
export function buildInvalidSVG(size: number, label?: string): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`)
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('xmlns', ns)

  const bg = document.createElementNS(ns, 'rect')
  bg.setAttribute('width', String(size))
  bg.setAttribute('height', String(size))
  bg.setAttribute('fill', 'white')
  svg.appendChild(bg)

  const half = size / 2
  const pad = size * 0.20
  const strokeW = size * 0.05

  const line1 = document.createElementNS(ns, 'line')
  line1.setAttribute('x1', String(pad))
  line1.setAttribute('y1', String(pad))
  line1.setAttribute('x2', String(size - pad))
  line1.setAttribute('y2', String(size - pad))
  line1.setAttribute('stroke', '#d1d5db')
  line1.setAttribute('stroke-width', String(strokeW))
  line1.setAttribute('stroke-linecap', 'round')
  svg.appendChild(line1)

  const line2 = document.createElementNS(ns, 'line')
  line2.setAttribute('x1', String(size - pad))
  line2.setAttribute('y1', String(pad))
  line2.setAttribute('x2', String(pad))
  line2.setAttribute('y2', String(size - pad))
  line2.setAttribute('stroke', '#d1d5db')
  line2.setAttribute('stroke-width', String(strokeW))
  line2.setAttribute('stroke-linecap', 'round')
  svg.appendChild(line2)

  if (label) {
    const fontSize = label.length > 2 ? size * 0.22 : size * 0.30
    const text = document.createElementNS(ns, 'text')
    text.setAttribute('x', String(half))
    text.setAttribute('y', String(half))
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'central')
    text.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')
    text.setAttribute('font-size', String(fontSize))
    text.setAttribute('font-weight', '600')
    text.setAttribute('fill', '#9ca3af')
    text.textContent = label
    svg.appendChild(text)
  }

  return svg
}

export function svgToDataURL(svg: SVGSVGElement): string {
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svg)
  const encoded = encodeURIComponent(svgStr)
  return `data:image/svg+xml;charset=utf-8,${encoded}`
}

export async function svgToPngDataURL(svg: SVGSVGElement, scale = 2): Promise<string> {
  const w = Number(svg.getAttribute('width') ?? 200)
  const h = Number(svg.getAttribute('height') ?? 200)
  const canvas = document.createElement('canvas')
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { ctx.drawImage(img, 0, 0, w, h); resolve(canvas.toDataURL('image/png')) }
    img.onerror = reject
    img.src = svgToDataURL(svg)
  })
}
