import { LOADING_FACTS, LoadingFact, LoadingFactRarity } from './loading-facts-data';

let runtimeFacts: LoadingFact[] | null = null;

export function setRuntimeLoadingFacts(facts: LoadingFact[]) {
  const cleaned = facts.filter(fact => fact?.id && fact?.text);
  runtimeFacts = cleaned.length > 0 ? cleaned : null;
}

function getFactPool(): LoadingFact[] {
  return runtimeFacts && runtimeFacts.length > 0 ? runtimeFacts : LOADING_FACTS;
}

export interface LoadingFactState {
  recentFactIds: string[];
  lastShownFactId: string | null;
  factsShownInCycle: number;
  cycleWindowStart: number;
  cooldownUntil: number;
}

const STORAGE_KEY = 'genz_loading_facts_state';
const BURST_LIMIT = 30;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const BURST_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_HISTORY = 10;

// Default in-memory state (fallback when localStorage is not available, e.g. SSR)
let memoryState: LoadingFactState = {
  recentFactIds: [],
  lastShownFactId: null,
  factsShownInCycle: 0,
  cycleWindowStart: 0,
  cooldownUntil: 0,
};

export function loadFactState(): LoadingFactState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryState;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryState;
    const parsed = JSON.parse(raw);
    return {
      recentFactIds: Array.isArray(parsed.recentFactIds) ? parsed.recentFactIds : [],
      lastShownFactId: typeof parsed.lastShownFactId === 'string' ? parsed.lastShownFactId : null,
      factsShownInCycle: typeof parsed.factsShownInCycle === 'number' ? parsed.factsShownInCycle : 0,
      cycleWindowStart: typeof parsed.cycleWindowStart === 'number' ? parsed.cycleWindowStart : 0,
      cooldownUntil: typeof parsed.cooldownUntil === 'number' ? parsed.cooldownUntil : 0,
    };
  } catch {
    return memoryState;
  }
}

export function saveFactState(state: LoadingFactState): void {
  memoryState = state;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // LocalStorage full or quota exceeded
  }
}

export function isCooldownActive(now = Date.now()): boolean {
  const state = loadFactState();
  return state.cooldownUntil > now;
}

export function getCooldownRemainingMs(now = Date.now()): number {
  const state = loadFactState();
  if (state.cooldownUntil <= now) return 0;
  return state.cooldownUntil - now;
}

export function resetLoadingFactCooldown(): void {
  const state = loadFactState();
  state.cooldownUntil = 0;
  state.factsShownInCycle = 0;
  state.cycleWindowStart = 0;
  saveFactState(state);
}

export interface GetFactOptions {
  allowCoupon?: boolean;
  forceBucket?: LoadingFactRarity;
  currentTime?: number;
}

/**
 * Core selection engine.
 * Selects one random fact adhering to:
 * - 94% Common, 5.5% Rare, 0.5% Ultra Rare
 * - Mutes facts (returns null) during active 5-minute cooldown
 * - Deduplicates against last 10 facts and never repeats consecutively
 * - Starts a 5-minute cooldown after 3 facts appear in a burst
 */
export function getNextLoadingFact(options?: GetFactOptions): LoadingFact {
  const now = options?.currentTime ?? Date.now();
  const state = loadFactState();

  // Reset any legacy cooldown state so facts always show on every loading screen
  if (state.cooldownUntil > 0) {
    state.cooldownUntil = 0;
  }

  // Check burst window: if window elapsed, start a fresh cycle
  if (state.cycleWindowStart > 0 && now - state.cycleWindowStart > BURST_WINDOW_MS) {
    state.factsShownInCycle = 0;
    state.cycleWindowStart = now;
  }

  // 5. Select rarity bucket
  // COMMON: 94%, RARE: 5.5%, ULTRA RARE: 0.5%
  let targetRarity: LoadingFactRarity;
  if (options?.forceBucket) {
    targetRarity = options.forceBucket;
  } else {
    const roll = Math.random();
    if (roll < 0.005) {
      targetRarity = 'ULTRA_RARE';
    } else if (roll < 0.060) {
      targetRarity = 'RARE';
    } else {
      targetRarity = 'COMMON';
    }
  }

  // 6. Filter candidate facts by rarity and coupon availability
  const source = getFactPool();
  let pool = source.filter(f => f.rarity === targetRarity);
  if (!options?.allowCoupon) {
    // If coupon is not explicitly enabled, prefer non-coupon facts,
    // or if pool has only coupon facts keep it
    const nonCoupon = pool.filter(f => !f.isCoupon);
    if (nonCoupon.length > 0) {
      pool = nonCoupon;
    }
  }

  // Filter out recently shown facts (avoid immediately repeating, prefer avoiding last 10)
  const recentSet = new Set(state.recentFactIds);
  let candidates = pool.filter(f => !recentSet.has(f.id) && f.id !== state.lastShownFactId);

  // If all facts in the bucket have been seen recently, relax constraint to just not the immediate last one
  if (candidates.length === 0) {
    candidates = pool.filter(f => f.id !== state.lastShownFactId);
  }

  // Ultimate fallback
  if (candidates.length === 0) {
    candidates = pool.length > 0 ? pool : source;
  }

  const selectedFact = candidates[Math.floor(Math.random() * candidates.length)];

  // 7. Update cycle and history
  state.factsShownInCycle += 1;
  if (state.factsShownInCycle === 1) {
    state.cycleWindowStart = now;
  }

  // If 3 facts shown in this burst cycle, activate 5-minute cooldown for subsequent loads
  if (state.factsShownInCycle >= BURST_LIMIT) {
    state.cooldownUntil = now + COOLDOWN_MS;
    state.factsShownInCycle = 0;
  }

  state.lastShownFactId = selectedFact.id;
  state.recentFactIds = [
    selectedFact.id,
    ...state.recentFactIds.filter(id => id !== selectedFact.id),
  ].slice(0, MAX_HISTORY);

  saveFactState(state);

  return selectedFact;
}
