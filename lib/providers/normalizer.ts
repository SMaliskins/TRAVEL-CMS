import type { MealPlanType, ProviderName } from './types';

const RATEHAWK_MEAL_MAP: Record<string, MealPlanType> = {
  nomeal: 'room_only',
  'room-only': 'room_only',
  breakfast: 'breakfast',
  'continental-breakfast': 'breakfast',
  'english-breakfast': 'breakfast',
  'american-breakfast': 'breakfast',
  'buffet-breakfast': 'breakfast',
  'half-board': 'half_board',
  'half-board-plus': 'half_board',
  dinner: 'half_board',
  'full-board': 'full_board',
  'full-board-plus': 'full_board',
  'all-inclusive': 'all_inclusive',
  'ultra-all-inclusive': 'all_inclusive',
  'soft-all-inclusive': 'all_inclusive',
};

const GOGLOBAL_MEAL_MAP: Record<string, MealPlanType> = {
  RO: 'room_only',
  OB: 'room_only',
  SC: 'room_only',
  BB: 'breakfast',
  BB2: 'breakfast',
  CBF: 'breakfast',
  ABF: 'breakfast',
  HB: 'half_board',
  'HB+': 'half_board',
  HB2: 'half_board',
  FB: 'full_board',
  'FB+': 'full_board',
  FB2: 'full_board',
  AI: 'all_inclusive',
  AIS: 'all_inclusive',
  'ULTRA ALL INCLUSIVE': 'all_inclusive',
  UAI: 'all_inclusive',
  SAI: 'all_inclusive',
};

const BOOKING_MEAL_MAP: Record<string, MealPlanType> = {
  no_meal: 'room_only',
  breakfast: 'breakfast',
  half_board: 'half_board',
  full_board: 'full_board',
  all_inclusive: 'all_inclusive',
};

const PROVIDER_MEAL_MAPS: Record<ProviderName, Record<string, MealPlanType>> = {
  ratehawk: RATEHAWK_MEAL_MAP,
  goglobal: GOGLOBAL_MEAL_MAP,
  booking: BOOKING_MEAL_MAP,
};

export function normalizeMealPlan(provider: ProviderName, raw: string): MealPlanType {
  if (!raw) return 'room_only';

  const map = PROVIDER_MEAL_MAPS[provider];
  const direct = map[raw];
  if (direct) return direct;

  const normalized = raw.toLowerCase().trim().replace(/[\s_]+/g, '-');
  const byNormalized = map[normalized];
  if (byNormalized) return byNormalized;

  if (normalized.includes('all-inclusive') || normalized.includes('all_inclusive')) {
    return 'all_inclusive';
  }
  if (normalized.includes('full-board') || normalized.includes('full_board')) {
    return 'full_board';
  }
  if (normalized.includes('half-board') || normalized.includes('half_board')) {
    return 'half_board';
  }
  if (normalized.includes('breakfast')) {
    return 'breakfast';
  }
  if (normalized.includes('room-only') || normalized.includes('no-meal') || normalized === 'ro') {
    return 'room_only';
  }

  return 'other';
}

const ROOM_TYPE_PATTERNS: [RegExp, string][] = [
  [/\bsuite\b/i, 'suite'],
  [/\bjunior\s*suite\b/i, 'junior_suite'],
  [/\bstudio\b/i, 'studio'],
  [/\bapartment\b/i, 'apartment'],
  [/\bvilla\b/i, 'villa'],
  [/\bbungalow\b/i, 'bungalow'],
  [/\bpenthouse\b/i, 'penthouse'],
  [/\bfamily\b/i, 'family'],
  [/\bdeluxe\b/i, 'deluxe'],
  [/\bsuperior\b/i, 'superior'],
  [/\bexecutive\b/i, 'executive'],
  [/\bpremium\b/i, 'premium'],
  [/\beconomy\b/i, 'economy'],
  [/\bstandard\b/i, 'standard'],
  [/\bsingle\b/i, 'single'],
  [/\bdouble\b/i, 'double'],
  [/\btwin\b/i, 'twin'],
  [/\btriple\b/i, 'triple'],
  [/\bquad\b/i, 'quad'],
];

export function normalizeRoomType(raw: string): string {
  if (!raw) return 'standard';

  for (const [pattern, type] of ROOM_TYPE_PATTERNS) {
    if (pattern.test(raw)) return type;
  }

  return 'standard';
}
