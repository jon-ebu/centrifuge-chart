import './style.css'
import { uniquePrimeFactors, findConfig, findAllConfigs, checkBalance, findGaps, BalanceConfig } from './math'
import { buildRotorSVG, buildInvalidSVG } from './render'
import {
  exportCardSVG, exportCardPNG,
  exportFullPoster, exportPosterSVG,
  PosterCard
} from './export'

// ─── State ──────────────────────────────────────────────────────────────────

interface CardState {
  n: number
  balanceable: boolean
  activeSlots: Set<number>
  fillColor: string
  slotColors: Map<number, string>
  slotTypeMap: Map<number, number>  // slotIndex → polygon size for per-polygon coloring
  customized: boolean
  alternatives: BalanceConfig[]     // all unique-up-to-rotation configs for this n
  altIndex: number                  // which alternative is currently displayed
}

let K = 30
let cards: CardState[] = []
let selectedN: number | null = null
let editorActiveSlots: Set<number> = new Set()
let editorSlotColors: Map<number, string> = new Map()
let editorFillColor = '#3b82f6'
let cardScale = 1.0        // user-adjustable card size multiplier
let showGapBadge = false   // toggle: show longest-gap count on each card
let gapThreshold = 4       // minimum gap length to show the badge
let uniformColor = false   // toggle: all filled slots same color (blue) instead of per-polygon

// ─── Math helpers ────────────────────────────────────────────────────────────

function defaultColor(n: number): string {
  return n % 2 === 0 ? '#3b82f6' : '#ef4444'
}

function buildCards(k: number): CardState[] {
  const result: CardState[] = []
  for (let n = 1; n <= k; n++) {
    const cfg = findConfig(n, k)
    const balanceable = cfg !== null
    const alternatives = balanceable ? findAllConfigs(n, k) : []
    const activeSlots = cfg ? new Set(cfg.slots) : new Set<number>()
    const fillColor = defaultColor(n)
    const slotTypeMap = new Map<number, number>()
    if (cfg) cfg.slots.forEach((s, i) => slotTypeMap.set(s, cfg.slotTypes[i]))
    result.push({ n, balanceable, activeSlots, fillColor, slotColors: new Map(), slotTypeMap, customized: false, alternatives, altIndex: 0 })
  }
  return result
}

// ─── Grid rendering ──────────────────────────────────────────────────────────

function baseCardSize(k: number): number {
  if (k <= 12) return 172
  if (k <= 16) return 164
  if (k <= 24) return 156
  if (k <= 32) return 148
  return 136
}

function cardSVG(card: CardState, cardSize: number): SVGSVGElement {
  const slotTypeMap = (card.customized || uniformColor) ? undefined : card.slotTypeMap
  const fillColor = uniformColor ? '#3b82f6' : card.fillColor
  const gapBadges = showGapBadge && card.balanceable
    ? findGaps(card.activeSlots, K).filter(g => g.length >= gapThreshold)
    : undefined
  return card.balanceable
    ? buildRotorSVG({ K, activeSlots: card.activeSlots, size: cardSize, fillColor, slotColors: card.slotColors, slotTypeMap, gapBadges, label: String(card.n) })
    : buildInvalidSVG(cardSize, String(card.n))
}

// Refresh a single card's SVG + alt counter without rebuilding the whole grid.
function refreshCard(n: number): void {
  const card = cards.find(c => c.n === n)!
  const wrapper = document.getElementById(`card-${n}`)
  if (!wrapper) return
  const cardSize = Math.round(baseCardSize(K) * cardScale)
  const newSvg = cardSVG(card, cardSize)
  newSvg.style.display = 'block'
  const oldSvg = wrapper.querySelector('svg')
  if (oldSvg) wrapper.replaceChild(newSvg, oldSvg)
  const counter = wrapper.querySelector('.alt-counter') as HTMLElement | null
  if (counter && card.alternatives.length > 1) {
    counter.textContent = `${card.altIndex + 1}/${card.alternatives.length}`
  }
}

function renderGrid(): void {
  const container = document.getElementById('grid')!
  container.innerHTML = ''

  const cardSize = Math.round(baseCardSize(K) * cardScale)

  cards.forEach(card => {
    const wrapper = document.createElement('div')
    wrapper.id = `card-${card.n}`
    wrapper.className = card.balanceable ? 'card group relative' : 'card-invalid relative'
    wrapper.style.width = `${cardSize}px`
    wrapper.style.height = `${cardSize}px`
    wrapper.title = card.balanceable ? `n = ${card.n} — click to edit` : `n = ${card.n} — cannot be balanced`

    const svgEl = cardSVG(card, cardSize)
    svgEl.style.display = 'block'
    wrapper.appendChild(svgEl)

    // Customized indicator dot
    if (card.customized) {
      const dot = document.createElement('div')
      dot.className = 'absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400'
      dot.title = 'Manually edited'
      wrapper.appendChild(dot)
    }

    // Alt navigation: prev/next arrows + counter (only when multiple alts exist)
    if (card.balanceable && card.alternatives.length > 1) {
      const bar = document.createElement('div')
      bar.className = 'absolute bottom-0.5 inset-x-0 flex items-center justify-center gap-0.5 pointer-events-none'

      const makeBtn = (label: string, title: string, onClick: () => void) => {
        const btn = document.createElement('button')
        btn.className = 'pointer-events-auto text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center rounded text-sm leading-none transition-colors hover:bg-gray-100'
        btn.textContent = label
        btn.title = title
        btn.addEventListener('click', (e) => { e.stopPropagation(); onClick() })
        return btn
      }

      const counter = document.createElement('span')
      counter.className = 'alt-counter text-xs text-gray-400 font-mono w-8 text-center pointer-events-none'
      counter.textContent = `${card.altIndex + 1}/${card.alternatives.length}`

      bar.appendChild(makeBtn('‹', 'Previous arrangement', () => {
        card.altIndex = (card.altIndex - 1 + card.alternatives.length) % card.alternatives.length
        const cfg = card.alternatives[card.altIndex]
        card.activeSlots = new Set(cfg.slots)
        card.slotTypeMap = new Map()
        cfg.slots.forEach((s, i) => card.slotTypeMap.set(s, cfg.slotTypes[i]))
        card.customized = false
        refreshCard(card.n)
      }))
      bar.appendChild(counter)
      bar.appendChild(makeBtn('›', 'Next arrangement', () => {
        card.altIndex = (card.altIndex + 1) % card.alternatives.length
        const cfg = card.alternatives[card.altIndex]
        card.activeSlots = new Set(cfg.slots)
        card.slotTypeMap = new Map()
        cfg.slots.forEach((s, i) => card.slotTypeMap.set(s, cfg.slotTypes[i]))
        card.customized = false
        refreshCard(card.n)
      }))
      wrapper.appendChild(bar)
    }

    if (card.balanceable) {
      wrapper.style.cursor = 'pointer'
      wrapper.addEventListener('click', () => openEditor(card.n))
    }

    container.appendChild(wrapper)
  })
}

// ─── Info bar ────────────────────────────────────────────────────────────────

function updateInfoBar(): void {
  const primes = uniquePrimeFactors(K)
  document.getElementById('info-primes')!.textContent = primes.join(', ')
  const balanceable = cards.filter(c => c.balanceable).length
  document.getElementById('info-balanced')!.textContent = `${balanceable} / ${K}`
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function openEditor(n: number): void {
  selectedN = n
  const card = cards.find(c => c.n === n)!
  editorActiveSlots = new Set(card.activeSlots)
  editorSlotColors = new Map(card.slotColors)
  editorFillColor = card.fillColor

  const panel = document.getElementById('editor-panel')!
  panel.classList.remove('hidden')
  panel.classList.add('flex')

  document.getElementById('editor-title')!.textContent = `Configuration n = ${n}`
  document.getElementById('editor-fill-color')!.setAttribute('value', editorFillColor);
  (document.getElementById('editor-fill-color') as HTMLInputElement).value = editorFillColor

  renderEditor()
  updateEditorStatus()
  highlightSelectedCard(n)
}

function closeEditor(): void {
  selectedN = null
  document.getElementById('editor-panel')!.classList.add('hidden')
  document.getElementById('editor-panel')!.classList.remove('flex')
  clearCardHighlight()
}

function highlightSelectedCard(n: number): void {
  clearCardHighlight()
  document.getElementById(`card-${n}`)?.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2')
}

function clearCardHighlight(): void {
  document.querySelectorAll('#grid > div').forEach(el => {
    el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2')
  })
}

function renderEditor(): void {
  const container = document.getElementById('editor-svg-container')!
  container.innerHTML = ''

  const svgEl = buildRotorSVG({
    K,
    activeSlots: editorActiveSlots,
    size: 300,
    fillColor: editorFillColor,
    slotColors: editorSlotColors,
    interactive: true,
    onSlotClick: (slotIdx) => {
      if (editorActiveSlots.has(slotIdx)) {
        editorActiveSlots.delete(slotIdx)
        editorSlotColors.delete(slotIdx)
      } else {
        editorActiveSlots.add(slotIdx)
      }
      renderEditor()
      updateEditorStatus()
    }
  })

  svgEl.style.display = 'block'
  svgEl.style.margin = '0 auto'
  container.appendChild(svgEl)
}

function updateEditorStatus(): void {
  const count = editorActiveSlots.size
  const balanced = checkBalance(Array.from(editorActiveSlots), K)

  const countEl = document.getElementById('editor-count')!
  const statusEl = document.getElementById('editor-status')!
  const statusBadge = document.getElementById('editor-status-badge')!

  countEl.textContent = `${count} tube${count !== 1 ? 's' : ''} selected`

  if (count === 0) {
    statusBadge.className = 'badge-unbalanced'
    statusEl.textContent = 'Empty'
  } else if (balanced) {
    statusBadge.className = 'badge-balanced'
    statusEl.textContent = 'Balanced ✓'
  } else {
    statusBadge.className = 'badge-unbalanced'
    statusEl.textContent = 'Unbalanced ✗'
  }
}

function saveEditorChanges(): void {
  if (selectedN === null) return
  const card = cards.find(c => c.n === selectedN)!
  card.activeSlots = new Set(editorActiveSlots)
  card.slotColors = new Map(editorSlotColors)
  card.fillColor = editorFillColor
  card.customized = true

  renderGrid()
  closeEditor()
}

function resetCard(): void {
  if (selectedN === null) return
  const n = selectedN
  const card = cards.find(c => c.n === n)!
  const cfg = findConfig(n, K)
  if (cfg) {
    card.activeSlots = new Set(cfg.slots)
    editorActiveSlots = new Set(cfg.slots)
    card.slotTypeMap = new Map()
    cfg.slots.forEach((s, i) => card.slotTypeMap.set(s, cfg.slotTypes[i]))
  }
  card.altIndex = 0
  card.fillColor = defaultColor(n)
  editorFillColor = defaultColor(n);
  (document.getElementById('editor-fill-color') as HTMLInputElement).value = editorFillColor
  card.slotColors = new Map()
  editorSlotColors = new Map()
  card.customized = false
  renderEditor()
  updateEditorStatus()
}

// ─── Initialization ──────────────────────────────────────────────────────────

function initApp(): void {
  cards = buildCards(K)
  renderGrid()
  updateInfoBar()

  // K input
  const kInput = document.getElementById('k-input') as HTMLInputElement
  kInput.value = String(K)
  kInput.addEventListener('change', () => {
    const val = parseInt(kInput.value, 10)
    if (isNaN(val) || val < 6 || val > 48) {
      kInput.value = String(K)
      return
    }
    K = val
    cards = buildCards(K)
    closeEditor()
    renderGrid()
    updateInfoBar()
  })

  // K quick-select buttons
  document.querySelectorAll('[data-k]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt((btn as HTMLElement).dataset.k ?? '30', 10)
      K = val
      kInput.value = String(K)
      cards = buildCards(K)
      closeEditor()
      renderGrid()
      updateInfoBar()
      document.querySelectorAll('[data-k]').forEach(b => b.classList.remove('bg-blue-600', 'text-white'))
      btn.classList.add('bg-blue-600', 'text-white')
    })
  })

  // Editor close
  document.getElementById('editor-close')!.addEventListener('click', closeEditor)

  // Editor save
  document.getElementById('editor-save')!.addEventListener('click', saveEditorChanges)

  // Editor reset
  document.getElementById('editor-reset')!.addEventListener('click', resetCard)

  // Editor fill color
  const colorInput = document.getElementById('editor-fill-color') as HTMLInputElement
  colorInput.addEventListener('input', () => {
    editorFillColor = colorInput.value
    renderEditor()
    updateEditorStatus()
  })

  // Editor export buttons
  document.getElementById('editor-export-svg')!.addEventListener('click', () => {
    if (selectedN === null) return
    exportCardSVG(selectedN, K, editorActiveSlots, editorFillColor, editorSlotColors)
  })
  document.getElementById('editor-export-png')!.addEventListener('click', () => {
    if (selectedN === null) return
    exportCardPNG(selectedN, K, editorActiveSlots, editorFillColor, editorSlotColors)
  })

  // Poster export — snapshot current card states (respects alt navigation + uniform color)
  function currentPosterCards(): PosterCard[] {
    return cards.map(c => ({
      n: c.n,
      balanceable: c.balanceable,
      activeSlots: c.activeSlots,
      fillColor: uniformColor ? '#3b82f6' : c.fillColor,
      slotTypeMap: (c.customized || uniformColor) ? new Map() : c.slotTypeMap,
    }))
  }

  document.getElementById('export-poster-png')!.addEventListener('click', () => {
    exportFullPoster(K, currentPosterCards())
  })
  document.getElementById('export-poster-svg')!.addEventListener('click', () => {
    exportPosterSVG(K, currentPosterCards())
  })

  // Close editor on backdrop click
  document.getElementById('editor-backdrop')!.addEventListener('click', closeEditor)

  // Info modal
  function openInfo() {
    document.getElementById('info-modal')!.classList.remove('hidden')
    document.getElementById('info-backdrop')!.classList.remove('hidden')
  }
  function closeInfo() {
    document.getElementById('info-modal')!.classList.add('hidden')
    document.getElementById('info-backdrop')!.classList.add('hidden')
  }
  document.getElementById('info-btn')!.addEventListener('click', openInfo)
  document.getElementById('info-close')!.addEventListener('click', closeInfo)
  document.getElementById('info-close-2')!.addEventListener('click', closeInfo)
  document.getElementById('info-backdrop')!.addEventListener('click', closeInfo)

  // Card size slider
  const sizeSlider = document.getElementById('size-slider') as HTMLInputElement
  const sizeLabel = document.getElementById('size-label')!
  sizeSlider.value = String(cardScale)
  sizeSlider.addEventListener('input', () => {
    cardScale = parseFloat(sizeSlider.value)
    sizeLabel.textContent = `${Math.round(cardScale * 100)}%`
    renderGrid()
  })

  // Uniform color toggle
  const colorToggle = document.getElementById('uniform-color-toggle') as HTMLInputElement
  colorToggle.addEventListener('change', () => {
    uniformColor = colorToggle.checked
    renderGrid()
  })

  // Gap badge toggle + threshold
  const gapToggle = document.getElementById('gap-toggle') as HTMLInputElement
  const gapControls = document.getElementById('gap-controls')!
  const gapSlider = document.getElementById('gap-slider') as HTMLInputElement
  const gapLabel = document.getElementById('gap-label')!

  gapToggle.addEventListener('change', () => {
    showGapBadge = gapToggle.checked
    gapControls.classList.toggle('hidden', !showGapBadge)
    renderGrid()
  })
  gapSlider.value = String(gapThreshold)
  gapSlider.addEventListener('input', () => {
    gapThreshold = parseInt(gapSlider.value, 10)
    gapLabel.textContent = String(gapThreshold)
    renderGrid()
  })
}

document.addEventListener('DOMContentLoaded', initApp)
