import { create } from 'zustand';
import { TimingResult, StartMethod, TimingState } from '../types';
import { calculateVelocity } from '../utils/velocity';

interface TimingStore {
  // State
  state: TimingState;
  startTime: number | null;
  elapsedTime: number;
  currentResult: TimingResult | null;
  results: TimingResult[];

  // Actions
  setState: (state: TimingState) => void;
  startTimer: (method: StartMethod) => void;
  stopTimer: (result: Omit<TimingResult, 'id' | 'sessionId'>) => void;
  resetTimer: () => void;
  updateElapsedTime: (time: number) => void;
  addResult: (result: TimingResult) => void;
  updateResult: (id: string, updates: Partial<TimingResult>) => void;
  deleteResult: (id: string) => void;
  clearResults: () => void;
}

export const useTimingStore = create<TimingStore>((set, get) => ({
  // Initial state
  state: 'idle',
  startTime: null,
  elapsedTime: 0,
  currentResult: null,
  results: [],

  // Actions
  setState: (state) => set({ state }),

  startTimer: (method) => {
    // Use performance.now() for relative timing in JS
    // Native modules will use monotonic clocks for actual precision
    const now = performance.now();
    set({
      state: 'running',
      startTime: now,
      elapsedTime: 0,
    });
  },

  stopTimer: (result) => {
    const { startTime, results } = get();
    if (startTime === null) return;

    const id = `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate velocity if distance is available
    const velocity_ms = result.distance_m
      ? calculateVelocity(result.distance_m, result.time_ms)
      : undefined;

    const newResult: TimingResult = {
      ...result,
      id,
      sessionId: '', // Will be set by session store
      velocity_ms,
    };

    set({
      state: 'stopped',
      currentResult: newResult,
      results: [...results, newResult],
    });
  },

  resetTimer: () => {
    set({
      state: 'idle',
      startTime: null,
      elapsedTime: 0,
      currentResult: null,
    });
  },

  updateElapsedTime: (time) => set({ elapsedTime: time }),

  addResult: (result) => {
    set((state) => ({
      results: [...state.results, result],
    }));
  },

  updateResult: (id, updates) => {
    set((state) => ({
      results: state.results.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
      currentResult:
        state.currentResult?.id === id
          ? { ...state.currentResult, ...updates }
          : state.currentResult,
    }));
  },

  deleteResult: (id) => {
    set((state) => ({
      results: state.results.filter((r) => r.id !== id),
      currentResult:
        state.currentResult?.id === id ? null : state.currentResult,
    }));
  },

  clearResults: () => set({ results: [], currentResult: null }),
}));
