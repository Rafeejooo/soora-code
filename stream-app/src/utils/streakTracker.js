/**
 * Streak Tracker & Achievement System
 * Tracks daily watch streaks and badge unlocks.
 * Pure localStorage — no backend required.
 */

const STORAGE_KEY = 'soora_streak';

const BADGE_DEFS = [
  { id: 'first_watch',  icon: '🎬', label: 'Penonton Perdana',  check: (s) => s.totalEpisodesWatched >= 1 },
  { id: 'streak_3',     icon: '🔥', label: '3 Hari Berturut',   check: (s) => s.longestStreak >= 3 },
  { id: 'streak_7',     icon: '💎', label: 'Seminggu Penuh',    check: (s) => s.longestStreak >= 7 },
  { id: 'streak_30',    icon: '👑', label: 'Satu Bulan!',       check: (s) => s.longestStreak >= 30 },
  { id: 'night_owl',    icon: '🌙', label: 'Night Owl',         check: (s) => s.nightOwlCount >= 1 },
  { id: 'binge_5',      icon: '⚡', label: 'Maraton 5 Episode', check: (s) => s.maxEpsInDay >= 5 },
  { id: 'otaku',        icon: '📚', label: 'Otaku Sejati',      check: (s) => s.totalEpisodesWatched >= 50 },
  { id: 'cinephile',    icon: '🎭', label: 'Sinefil',           check: (s) => s.totalMoviesWatched >= 20 },
];

function getToday() {
  return new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
}

function getDefaultStats() {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastWatchDate: null,
    totalEpisodesWatched: 0,
    totalMoviesWatched: 0,
    totalMangaRead: 0,
    todayEps: 0,
    lastTodayDate: null,
    maxEpsInDay: 0,
    nightOwlCount: 0,
    badges: [],
  };
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultStats();
    return { ...getDefaultStats(), ...JSON.parse(raw) };
  } catch {
    return getDefaultStats();
  }
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

/**
 * Record a watch session. Call after user watches > 5 minutes.
 * @param {'anime'|'movie'|'manga'} type
 * @returns {string[]} Newly unlocked badge IDs
 */
export function recordWatch(type = 'anime') {
  const stats = loadStats();
  const today = getToday();
  const hour = new Date().getHours();

  // Update streak
  if (stats.lastWatchDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (stats.lastWatchDate === yesterdayStr) {
      stats.currentStreak += 1;
    } else if (stats.lastWatchDate === null) {
      stats.currentStreak = 1;
    } else {
      stats.currentStreak = 1; // reset
    }
    stats.lastWatchDate = today;
    stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
  }

  // Update counters
  if (type === 'anime') {
    stats.totalEpisodesWatched += 1;

    // Track eps per day for binge badge
    if (stats.lastTodayDate === today) {
      stats.todayEps += 1;
    } else {
      stats.todayEps = 1;
      stats.lastTodayDate = today;
    }
    stats.maxEpsInDay = Math.max(stats.maxEpsInDay, stats.todayEps);
  } else if (type === 'movie') {
    stats.totalMoviesWatched += 1;
  } else if (type === 'manga') {
    stats.totalMangaRead += 1;
  }

  // Night owl tracking
  if (hour >= 23 || hour < 4) {
    stats.nightOwlCount = (stats.nightOwlCount || 0) + 1;
  }

  // Check for new badges
  const prevBadges = new Set(stats.badges);
  const newBadges = [];
  for (const badge of BADGE_DEFS) {
    if (!prevBadges.has(badge.id) && badge.check(stats)) {
      stats.badges.push(badge.id);
      newBadges.push(badge.id);
    }
  }

  saveStats(stats);

  // Dispatch event for each new badge
  for (const badgeId of newBadges) {
    const badge = BADGE_DEFS.find((b) => b.id === badgeId);
    window.dispatchEvent(new CustomEvent('badge-unlocked', { detail: badge }));
  }

  return newBadges;
}

/**
 * Get current streak data.
 */
export function getStreak() {
  const stats = loadStats();
  // Check if streak is still active (watched yesterday or today)
  const today = getToday();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const isActive =
    stats.lastWatchDate === today || stats.lastWatchDate === yesterdayStr;

  return {
    currentStreak: isActive ? stats.currentStreak : 0,
    longestStreak: stats.longestStreak,
    lastWatchDate: stats.lastWatchDate,
    isActive,
  };
}

/**
 * Get all stats.
 */
export function getStats() {
  return loadStats();
}

/**
 * Get all badge definitions with unlock status.
 */
export function getBadges() {
  const stats = loadStats();
  return BADGE_DEFS.map((b) => ({
    ...b,
    unlocked: stats.badges.includes(b.id),
  }));
}
