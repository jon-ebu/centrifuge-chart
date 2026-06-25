import './style.css'
import { uniquePrimeFactors, findConfig, findAllConfigs, findGaps, BalanceConfig } from './math'
import { buildRotorSVG, buildInvalidSVG } from './render'
import { exportFullPoster, exportPosterSVG, buildPosterSVG, PosterCard, PosterFormat } from './export'

// ─── State ──────────────────────────────────────────────────────────────────

interface CardState {
  n: number
  balanceable: boolean
  activeSlots: Set<number>
  slotTypeMap: Map<number, number>
  alternatives: BalanceConfig[]
  altIndex: number
}

let K = 24
let cards: CardState[] = []
let pairColor = '#3b82f6'
let triangleColor = '#e53e3e'
let cardScale = 1.0
let showGapBadge = false
let gapThreshold = 4
let exportFormat: PosterFormat = 'default'

// ─── Cards ───────────────────────────────────────────────────────────────────

function buildCards(k: number): CardState[] {
  const result: CardState[] = []
  for (let n = 1; n <= k; n++) {
    const cfg = findConfig(n, k)
    const balanceable = cfg !== null
    const alternatives = balanceable ? findAllConfigs(n, k) : []
    const activeSlots = cfg ? new Set(cfg.slots) : new Set<number>()
    const slotTypeMap = new Map<number, number>()
    if (cfg) cfg.slots.forEach((s, i) => slotTypeMap.set(s, cfg.slotTypes[i]))
    result.push({ n, balanceable, activeSlots, slotTypeMap, alternatives, altIndex: 0 })
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

function slotColorMap(slotTypeMap: Map<number, number>): Map<number, string> {
  const m = new Map<number, string>()
  for (const [slot, pType] of slotTypeMap) {
    m.set(slot, pType === 3 ? triangleColor : pairColor)
  }
  return m
}

function cardSVG(card: CardState, cardSize: number): SVGSVGElement {
  const gapBadges = showGapBadge && card.balanceable
    ? findGaps(card.activeSlots, K).filter(g => g.length >= gapThreshold)
    : undefined
  return card.balanceable
    ? buildRotorSVG({
        K, activeSlots: card.activeSlots, size: cardSize,
        fillColor: pairColor,
        slotColors: slotColorMap(card.slotTypeMap),
        gapBadges, label: String(card.n),
      })
    : buildInvalidSVG(cardSize, String(card.n))
}

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
    wrapper.className = card.balanceable ? 'card relative' : 'card-invalid relative'
    wrapper.style.width = `${cardSize}px`
    wrapper.style.height = `${cardSize}px`
    wrapper.title = card.balanceable ? `n = ${card.n}` : `n = ${card.n} — cannot be balanced`

    const svgEl = cardSVG(card, cardSize)
    svgEl.style.display = 'block'
    wrapper.appendChild(svgEl)

    if (card.balanceable && card.alternatives.length > 1) {
      const bar = document.createElement('div')
      bar.className = 'absolute bottom-0.5 inset-x-0 flex items-center justify-center gap-0.5 pointer-events-none'

      const makeBtn = (label: string, title: string, onClick: () => void) => {
        const btn = document.createElement('button')
        btn.className = 'pointer-events-auto text-gray-500 hover:text-gray-700 w-7 h-7 flex items-center justify-center rounded text-base leading-none transition-colors hover:bg-gray-100'
        btn.textContent = label
        btn.title = title
        btn.addEventListener('click', (e) => { e.stopPropagation(); onClick() })
        return btn
      }

      const counter = document.createElement('span')
      counter.className = 'alt-counter text-xs text-gray-500 font-mono w-9 text-center pointer-events-none'
      counter.textContent = `${card.altIndex + 1}/${card.alternatives.length}`

      bar.appendChild(makeBtn('‹', 'Previous arrangement', () => {
        card.altIndex = (card.altIndex - 1 + card.alternatives.length) % card.alternatives.length
        const cfg = card.alternatives[card.altIndex]
        card.activeSlots = new Set(cfg.slots)
        card.slotTypeMap = new Map()
        cfg.slots.forEach((s, i) => card.slotTypeMap.set(s, cfg.slotTypes[i]))
        refreshCard(card.n)
      }))
      bar.appendChild(counter)
      bar.appendChild(makeBtn('›', 'Next arrangement', () => {
        card.altIndex = (card.altIndex + 1) % card.alternatives.length
        const cfg = card.alternatives[card.altIndex]
        card.activeSlots = new Set(cfg.slots)
        card.slotTypeMap = new Map()
        cfg.slots.forEach((s, i) => card.slotTypeMap.set(s, cfg.slotTypes[i]))
        refreshCard(card.n)
      }))
      wrapper.appendChild(bar)
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
    if (isNaN(val) || val < 6 || val > 48) { kInput.value = String(K); return }
    K = val
    cards = buildCards(K)
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
      renderGrid()
      updateInfoBar()
      document.querySelectorAll('[data-k]').forEach(b => b.classList.remove('bg-blue-600', 'text-white'))
      btn.classList.add('bg-blue-600', 'text-white')
    })
  })

  // Global color pickers
  const pairInput = document.getElementById('pair-color') as HTMLInputElement
  const triInput = document.getElementById('triangle-color') as HTMLInputElement
  pairInput.addEventListener('input', () => { pairColor = pairInput.value; renderGrid() })
  triInput.addEventListener('input', () => { triangleColor = triInput.value; renderGrid() })

  // Poster cards snapshot
  function currentPosterCards(): PosterCard[] {
    return cards.map(c => ({
      n: c.n,
      balanceable: c.balanceable,
      activeSlots: c.activeSlots,
      fillColor: pairColor,
      slotTypeMap: c.slotTypeMap,
    }))
  }

  // Export modal
  function renderExportPreview(): void {
    const preview = document.getElementById('export-preview')!
    preview.innerHTML = ''
    const svg = buildPosterSVG(K, currentPosterCards(), pairColor, triangleColor, exportFormat, showGapBadge, gapThreshold)
    svg.setAttribute('width', '100%')
    svg.removeAttribute('height')
    svg.style.display = 'block'
    preview.appendChild(svg)
  }

  function openExportModal(): void {
    document.getElementById('export-modal')!.classList.remove('hidden')
    document.getElementById('export-modal-backdrop')!.classList.remove('hidden')
    renderExportPreview()
  }

  function closeExportModal(): void {
    document.getElementById('export-modal')!.classList.add('hidden')
    document.getElementById('export-modal-backdrop')!.classList.add('hidden')
  }

  document.getElementById('export-btn')!.addEventListener('click', openExportModal)
  document.getElementById('export-modal-close')!.addEventListener('click', closeExportModal)
  document.getElementById('export-modal-cancel')!.addEventListener('click', closeExportModal)
  document.getElementById('export-modal-backdrop')!.addEventListener('click', closeExportModal)

  const formatSelect = document.getElementById('export-format') as HTMLSelectElement
  formatSelect.addEventListener('change', () => {
    exportFormat = formatSelect.value as PosterFormat
    renderExportPreview()
  })

  document.getElementById('export-poster-png')!.addEventListener('click', () => {
    exportFullPoster(K, currentPosterCards(), pairColor, triangleColor, exportFormat, showGapBadge, gapThreshold)
  })
  document.getElementById('export-poster-svg')!.addEventListener('click', () => {
    exportPosterSVG(K, currentPosterCards(), pairColor, triangleColor, exportFormat, showGapBadge, gapThreshold)
  })

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

  // Gap badge toggle + threshold
  const gapToggle = document.getElementById('gap-toggle') as HTMLInputElement
  const gapControls = document.getElementById('gap-controls')!
  const gapSlider = document.getElementById('gap-slider') as HTMLInputElement

  gapToggle.addEventListener('change', () => {
    showGapBadge = gapToggle.checked
    gapControls.classList.toggle('hidden', !showGapBadge)
    renderGrid()
  })
  gapSlider.value = String(gapThreshold)
  gapSlider.addEventListener('input', () => {
    const val = parseInt(gapSlider.value, 10)
    if (!isNaN(val) && val >= 1 && val <= 20) {
      gapThreshold = val
      renderGrid()
    }
  })
}

document.addEventListener('DOMContentLoaded', initApp)
