// ─── AsyncStorage persistence layer for storyboards ───

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Storyboard } from "./types";

const STORYBOARDS_KEY = "@seedance/storyboards";
const API_KEY = "@seedance/fal_api_key";

// ─── Storyboards ───

export async function loadStoryboards(): Promise<Storyboard[]> {
  const raw = await AsyncStorage.getItem(STORYBOARDS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Storyboard[];
  } catch {
    return [];
  }
}

export async function saveStoryboards(storyboards: Storyboard[]): Promise<void> {
  await AsyncStorage.setItem(STORYBOARDS_KEY, JSON.stringify(storyboards));
}

export async function addStoryboard(sb: Storyboard): Promise<void> {
  const all = await loadStoryboards();
  all.unshift(sb);
  await saveStoryboards(all);
}

export async function updateStoryboard(updated: Storyboard): Promise<void> {
  const all = await loadStoryboards();
  const idx = all.findIndex((s) => s.id === updated.id);
  if (idx >= 0) {
    all[idx] = { ...updated, updatedAt: Date.now() };
    await saveStoryboards(all);
  }
}

export async function deleteStoryboard(id: string): Promise<void> {
  const all = await loadStoryboards();
  await saveStoryboards(all.filter((s) => s.id !== id));
}

// ─── API Key ───

export async function getApiKey(): Promise<string | null> {
  return AsyncStorage.getItem(API_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(API_KEY, key);
}

export async function clearApiKey(): Promise<void> {
  await AsyncStorage.removeItem(API_KEY);
}

// ─── Helpers ───

export function generateId(): string {
  // Simple crypto-random ID generator (no uuid dependency needed)
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  const arr = new Uint8Array(16);
  // Use Math.random as fallback (expo-crypto would be better but adds a dep)
  for (let i = 0; i < 16; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < 16; i++) {
    id += chars[arr[i] % chars.length];
  }
  return id;
}
