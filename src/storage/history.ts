import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SessionResult } from '../session/types';

const KEY = 'history:v1';
const MAX_RECORDS = 500;

/** Session history lives only on this device. Nothing is uploaded. */
export async function loadHistory(): Promise<SessionResult[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionResult[]) : [];
  } catch {
    return [];
  }
}

export async function saveResult(result: SessionResult): Promise<void> {
  const all = await loadHistory();
  const next = [result, ...all.filter((r) => r.id !== result.id)].slice(0, MAX_RECORDS);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function getResult(id: string): Promise<SessionResult | undefined> {
  return (await loadHistory()).find((r) => r.id === id);
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

/** Consecutive days (ending today or yesterday) with at least one session. */
export function streakDays(history: SessionResult[], now = Date.now()): number {
  const days = new Set(history.map((r) => dayKey(r.startedAt)));
  let streak = 0;
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
