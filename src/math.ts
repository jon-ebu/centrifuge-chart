// Core mathematics for centrifuge balance determination

export function uniquePrimeFactors(n: number): number[] {
  const factors: number[] = []
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) {
      factors.push(i)
      while (n % i === 0) n = Math.floor(n / i)
    }
  }
  if (n > 1) factors.push(n)
  return factors
}

function canDecompose(n: number, primes: number[]): boolean {
  if (n === 0) return true
  const dp = new Array(n + 1).fill(false)
  dp[0] = true
  for (let i = 1; i <= n; i++) {
    for (const p of primes) {
      if (p <= i && dp[i - p]) { dp[i] = true; break }
    }
  }
  return dp[n]
}

// Returns decompositions sorted: fewest distinct polygon types first,
// then smallest max prime (prefers all-pairs over all-triangles).
function getDecompositions(n: number, primes: number[]): number[][] {
  const results: number[][] = []
  function bt(remaining: number, minIdx: number, current: number[]) {
    if (remaining === 0) { results.push([...current]); return }
    for (let i = minIdx; i < primes.length; i++) {
      const p = primes[i]
      if (p <= remaining) {
        current.push(p)
        bt(remaining - p, i, current)
        current.pop()
      }
    }
  }
  bt(n, 0, [])
  results.sort((a, b) => {
    const da = new Set(a).size, db = new Set(b).size
    if (da !== db) return da - db          // fewest types first
    return Math.max(...a) - Math.max(...b) // smallest max prime (2s before 3s)
  })
  return results
}

interface PlaceResult { slots: number[], types: number[] }

// Spread placement: space same-type polygons evenly around the ring.
// Returns sorted (slot, polygonSize) pairs, or null if any type can't be placed.
function placePolygonsSpread(polygons: number[], K: number): PlaceResult | null {
  const countByType = new Map<number, number>()
  for (const p of polygons) countByType.set(p, (countByType.get(p) ?? 0) + 1)
  const types = [...countByType.keys()].sort((a, b) => b - a)

  const used = new Uint8Array(K)
  const slotList: number[] = []
  const typeList: number[] = []

  for (const p of types) {
    const count = countByType.get(p)!
    const step = K / p
    const spacing = step / count

    let placed = false
    for (let offset = 0; offset < step && !placed; offset++) {
      const candidate: number[] = []
      let ok = true
      for (let i = 0; i < count && ok; i++) {
        const start = Math.round(offset + i * spacing) % step
        for (let j = 0; j < p; j++) {
          const slot = (start + j * step) % K
          if (used[slot]) { ok = false; break }
          candidate.push(slot)
        }
      }
      if (ok && candidate.length === count * p) {
        candidate.forEach(s => { used[s] = 1; slotList.push(s); typeList.push(p) })
        placed = true
      }
    }
    if (!placed) return null
  }

  const pairs = slotList.map((s, i) => [s, typeList[i]] as [number, number])
  pairs.sort((a, b) => a[0] - b[0])
  return { slots: pairs.map(p => p[0]), types: pairs.map(p => p[1]) }
}

// Backtracking placement (exhaustive fallback). Tracks polygon type per slot.
function placePolygons(polygons: number[], K: number): PlaceResult | null {
  const sorted = [...polygons].sort((a, b) => b - a)
  const used = new Uint8Array(K)
  const slotList: number[] = []
  const typeList: number[] = []
  let iters = 0
  const MAX_ITERS = 1_000

  function availableCount(p: number): number {
    const step = K / p
    let count = 0
    outer: for (let s = 0; s < step; s++) {
      for (let j = 0; j < p; j++) {
        if (used[(s + j * step) % K]) continue outer
      }
      count++
    }
    return count
  }

  function feasible(fromIdx: number): boolean {
    const need = new Map<number, number>()
    for (let i = fromIdx; i < sorted.length; i++) {
      const p = sorted[i]
      need.set(p, (need.get(p) ?? 0) + 1)
    }
    for (const [p, count] of need) {
      if (availableCount(p) < count) return false
    }
    return true
  }

  function bt(idx: number): boolean {
    if (++iters > MAX_ITERS) return false
    if (idx === sorted.length) return true
    if (!feasible(idx)) return false

    const p = sorted[idx]
    const step = K / p
    for (let start = 0; start < step; start++) {
      const slots: number[] = []
      for (let j = 0; j < p; j++) slots.push((start + j * step) % K)
      if (slots.every(s => !used[s])) {
        slots.forEach(s => { used[s] = 1; slotList.push(s); typeList.push(p) })
        if (bt(idx + 1)) return true
        slots.forEach(s => { used[s] = 0 })
        slotList.splice(slotList.length - slots.length, slots.length)
        typeList.splice(typeList.length - slots.length, slots.length)
      }
    }
    return false
  }

  if (bt(0)) {
    const pairs = slotList.map((s, i) => [s, typeList[i]] as [number, number])
    pairs.sort((a, b) => a[0] - b[0])
    return { slots: pairs.map(p => p[0]), types: pairs.map(p => p[1]) }
  }
  return null
}

export interface BalanceConfig {
  slots: number[]
  slotTypes: number[]  // parallel to slots: polygon size that placed each slot
  complement: boolean
  decomposition: number[]
}

// Find a canonical balanced configuration for n tubes in a K-slot rotor.
export function findConfig(n: number, K: number): BalanceConfig | null {
  if (n <= 0 || n > K) return null

  // Full rotor is trivially balanced
  if (n === K) {
    const slots = Array.from({ length: K }, (_, i) => i)
    // Color full ring as pairs (all blue)
    return { slots, slotTypes: new Array(K).fill(2), complement: false, decomposition: [] }
  }

  const primes = uniquePrimeFactors(K)

  function tryPlace(target: number): PlaceResult | null {
    if (!canDecompose(target, primes)) return null
    for (const decomp of getDecompositions(target, primes)) {
      const result = placePolygonsSpread(decomp, K) ?? placePolygons(decomp, K)
      if (result) return result
    }
    return null
  }

  const direct = tryPlace(n)
  if (direct) {
    return {
      slots: direct.slots,
      slotTypes: direct.types,
      complement: false,
      decomposition: getDecompositions(n, primes)[0] ?? []
    }
  }

  const compResult = tryPlace(K - n)
  if (compResult) {
    const compSet = new Set(compResult.slots)
    const slots = Array.from({ length: K }, (_, i) => i).filter(i => !compSet.has(i))
    return {
      slots,
      slotTypes: new Array(slots.length).fill(0), // complement: no polygon type
      complement: true,
      decomposition: getDecompositions(K - n, primes)[0] ?? []
    }
  }

  return null
}

// Enumerate all structurally distinct placements for a polygon list.
// Enforces start ordering for same-type polygons to avoid permutation duplicates.
function collectAllPlacements(polygons: number[], K: number, maxSolutions: number): PlaceResult[] {
  const sorted = [...polygons].sort((a, b) => b - a)
  const used = new Uint8Array(K)
  const slotBuf: number[] = []
  const typeBuf: number[] = []
  const results: PlaceResult[] = []
  let iters = 0
  const MAX_ITERS = 2_000

  function bt(idx: number, prevStart: number): void {
    if (++iters > MAX_ITERS || results.length >= maxSolutions) return
    if (idx === sorted.length) {
      const pairs = slotBuf.map((s, i) => [s, typeBuf[i]] as [number, number])
      pairs.sort((a, b) => a[0] - b[0])
      results.push({ slots: pairs.map(p => p[0]), types: pairs.map(p => p[1]) })
      return
    }
    const p = sorted[idx]
    const step = K / p
    // Enforce ascending start order for consecutive same-type polygons
    const isSameType = idx > 0 && sorted[idx] === sorted[idx - 1]
    const startFrom = isSameType ? prevStart + 1 : 0
    for (let start = startFrom; start < step; start++) {
      if (iters > MAX_ITERS || results.length >= maxSolutions) break
      const slots: number[] = []
      for (let j = 0; j < p; j++) slots.push((start + j * step) % K)
      if (slots.every(s => !used[s])) {
        slots.forEach(s => { used[s] = 1; slotBuf.push(s); typeBuf.push(p) })
        bt(idx + 1, start)
        slots.forEach(s => { used[s] = 0 })
        slotBuf.splice(slotBuf.length - slots.length, slots.length)
        typeBuf.splice(typeBuf.length - slots.length, slots.length)
      }
    }
  }
  bt(0, -1)
  return results
}

// Canonical rotation key: smallest lexicographic rotation of the sorted slot list.
function canonicalKey(slots: number[], K: number): string {
  const s = [...slots].sort((a, b) => a - b)
  let best = s.join(',')
  for (let k = 1; k < K; k++) {
    const r = s.map(x => (x + k) % K).sort((a, b) => a - b).join(',')
    if (r < best) best = r
  }
  return best
}

// All unique-up-to-rotation configurations for n tubes in a K-slot rotor.
// The default config (same as findConfig) is always first.
export function findAllConfigs(n: number, K: number, maxConfigs = 24): BalanceConfig[] {
  if (n <= 0 || n > K) return []
  if (n === K) { const c = findConfig(n, K); return c ? [c] : [] }

  const primes = uniquePrimeFactors(K)
  const seen = new Set<string>()
  const results: BalanceConfig[] = []

  function tryAdd(slots: number[], types: number[], decomp: number[], complement: boolean): void {
    if (results.length >= maxConfigs) return
    const key = canonicalKey(slots, K)
    if (!seen.has(key)) { seen.add(key); results.push({ slots, slotTypes: types, complement, decomposition: decomp }) }
  }

  // Default config first so altIndex=0 always matches the existing grid rendering
  const def = findConfig(n, K)
  if (def) tryAdd(def.slots, def.slotTypes, def.decomposition, def.complement)

  // All direct decompositions
  for (const decomp of getDecompositions(n, primes)) {
    if (results.length >= maxConfigs) break
    for (const { slots, types } of collectAllPlacements(decomp, K, (maxConfigs - results.length) * 4)) {
      tryAdd(slots, types, decomp, false)
      if (results.length >= maxConfigs) break
    }
  }

  // Complement configs (complement of K−n placements)
  if (results.length < maxConfigs) {
    for (const decomp of getDecompositions(K - n, primes)) {
      if (results.length >= maxConfigs) break
      for (const { slots: cs } of collectAllPlacements(decomp, K, (maxConfigs - results.length) * 4)) {
        if (results.length >= maxConfigs) break
        const compSet = new Set(cs)
        const slots = Array.from({ length: K }, (_, i) => i).filter(i => !compSet.has(i))
        tryAdd(slots, new Array(slots.length).fill(0), decomp, true)
      }
    }
  }

  return results
}

export interface GapInfo { length: number; midAngle: number }

// Returns ALL consecutive runs of empty slots, sorted longest-first.
// Walks from the first filled slot so wrap-around gaps appear contiguous.
export function findGaps(activeSlots: Set<number>, K: number): GapInfo[] {
  if (activeSlots.size === 0 || activeSlots.size === K) return []

  let firstFilled = -1
  for (let i = 0; i < K; i++) {
    if (activeSlots.has(i)) { firstFilled = i; break }
  }
  if (firstFilled < 0) return []

  const gaps: GapInfo[] = []
  let curLen = 0, curStart = 0

  for (let j = 0; j < K; j++) {
    const i = (firstFilled + j) % K
    if (!activeSlots.has(i)) {
      if (curLen === 0) curStart = i
      curLen++
    } else if (curLen > 0) {
      const midSlot = (curStart + curLen / 2) % K
      gaps.push({ length: curLen, midAngle: (2 * Math.PI * midSlot) / K - Math.PI / 2 })
      curLen = 0
    }
  }
  // Flush any trailing gap (wrap-around)
  if (curLen > 0) {
    const midSlot = (curStart + curLen / 2) % K
    gaps.push({ length: curLen, midAngle: (2 * Math.PI * midSlot) / K - Math.PI / 2 })
  }

  return gaps.sort((a, b) => b.length - a.length)
}

// A config exists iff findConfig returns non-null
export function isBalanceable(n: number, K: number): boolean {
  return findConfig(n, K) !== null
}

// Check if an arbitrary set of active slots is balanced (vector sum ≈ 0)
export function checkBalance(activeSlots: number[], K: number): boolean {
  if (activeSlots.length === 0) return true
  let re = 0, im = 0
  for (const s of activeSlots) {
    const theta = (2 * Math.PI * s) / K
    re += Math.cos(theta)
    im += Math.sin(theta)
  }
  return Math.sqrt(re * re + im * im) < 1e-5
}
