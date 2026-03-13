/**
 * Watch History Utility
 * Syncs watch progress to backend (linked to userId).
 * Falls back to localStorage if user is not logged in.
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const LOCAL_KEY = 'soora_watch_history';
const MAX_LOCAL = 50;

const api = axios.create({ baseURL: API_BASE, timeout: 8000 });

// ── localStorage fallback (for guests) ──────────────────────────────────────

function getLocalHistory() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalEntry(entry) {
  let history = getLocalHistory();
  const key = `${entry.id}:${entry.episodeNumber ?? 'movie'}`;
  // Upsert
  const idx = history.findIndex(
    (h) => `${h.id}:${h.episodeNumber ?? 'movie'}` === key
  );
  if (idx >= 0) {
    history[idx] = { ...history[idx], ...entry };
  } else {
    history.unshift(entry);
  }
  // Cap at MAX_LOCAL entries
  if (history.length > MAX_LOCAL) history = history.slice(0, MAX_LOCAL);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(history));
}

function getLocalInProgress() {
  return getLocalHistory().filter((h) => h.progress >= 0.05 && h.progress < 0.90);
}

function getLocalEntry(id, episodeNumber) {
  const key = `${id}:${episodeNumber ?? 'movie'}`;
  return getLocalHistory().find((h) => `${h.id}:${h.episodeNumber ?? 'movie'}` === key) || null;
}

// ── Backend API ──────────────────────────────────────────────────────────────

/**
 * Save or update a watch progress entry.
 * @param {object} entry - HistoryEntry fields
 * @param {string|null} userId - from AuthContext user.id
 */
export async function saveProgress(entry, userId) {
  if (!entry.id || !entry.type) return;

  const fullEntry = {
    ...entry,
    lastWatched: Date.now(),
  };

  if (userId) {
    try {
      await api.post('/history/save', { ...fullEntry, userId });
    } catch {
      // Silently fallback to local
      saveLocalEntry(fullEntry);
    }
  } else {
    saveLocalEntry(fullEntry);
  }
}

/**
 * Get in-progress items for "Continue Watching" section.
 * @param {string|null} userId
 * @returns {Promise<Array>}
 */
export async function getInProgress(userId) {
  if (userId) {
    try {
      const res = await api.get('/history/inprogress', { params: { userId } });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return getLocalInProgress();
    }
  }
  return getLocalInProgress();
}

/**
 * Get a specific entry to check for resume time.
 * @param {string} contentId
 * @param {number|undefined} episodeNumber
 * @param {string|null} userId
 * @returns {Promise<object|null>}
 */
export async function getEntry(contentId, episodeNumber, userId) {
  if (userId) {
    try {
      const res = await api.get('/history/entry', {
        params: { userId, id: contentId, episode: episodeNumber },
      });
      return res.data || null;
    } catch {
      return getLocalEntry(contentId, episodeNumber);
    }
  }
  return getLocalEntry(contentId, episodeNumber);
}

/**
 * Delete a specific entry.
 */
export async function deleteEntry(contentId, episodeNumber, userId) {
  if (userId) {
    try {
      await api.delete('/history/entry', {
        params: { userId, id: contentId, episode: episodeNumber },
      });
    } catch { /* ignore */ }
  }
  // Also remove from local
  let history = getLocalHistory();
  const key = `${contentId}:${episodeNumber ?? 'movie'}`;
  history = history.filter((h) => `${h.id}:${h.episodeNumber ?? 'movie'}` !== key);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(history));
}

/**
 * Get all history for display on a history page.
 */
export async function getAllHistory(userId) {
  if (userId) {
    try {
      const res = await api.get('/history', { params: { userId } });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return getLocalHistory();
    }
  }
  return getLocalHistory();
}
