import { create } from 'zustand';
import { TimingResult, StartMethod, TimingState, RunConfig } from '../types';
import { calculateVelocity } from '../utils/velocity';

interface TimingStore {
  // State
  state: TimingState;
  startTime: number | null;
  elapsedTime: number;
  currentResult: TimingResult | null;
  results: TimingResult[];

  // Session tracking
  activeSessionId: string | null;
  sessionStartTime: number | null;
  currentRunConfig: RunConfig | null;

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

  // Session actions
  startSession: (config: RunConfig) => void;
  updateRunConfig: (config: RunConfig) => void;
  endSession: () => void;
  getSessionResults: () => TimingResult[];
}

export const useTimingStore = create<TimingStore>((set, get) => ({
  // Initial state
  state: 'idle',
  startTime: null,
  elapsedTime: 0,
  currentResult: null,
  results: [],

  // Session tracking
  activeSessionId: null,
  sessionStartTime: null,
  currentRunConfig: null,

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
    const { startTime, results, activeSessionId, currentRunConfig } = get();
    if (startTime === null) return;

    const id = `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate velocity if distance is available
    const distance = result.distance_m || currentRunConfig?.distance_m;
    const velocity_ms = distance
      ? calculateVelocity(distance, result.time_ms)
      : undefined;

    const newResult: TimingResult = {
      ...result,
      id,
      sessionId: activeSessionId || '',
      velocity_ms,
      distance_m: distance,
      runConfig: currentRunConfig || undefined,
      createdAt: new Date(),
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

  // Session actions
  startSession: (config: RunConfig) => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    set({
      activeSessionId: sessionId,
      sessionStartTime: Date.now(),
      currentRunConfig: config,
      results: [], // Clear previous results for new session
      currentResult: null,
    });
  },

  updateRunConfig: (config: RunConfig) => {
    set({ currentRunConfig: config });
  },

  endSession: () => {
    set({
      activeSessionId: null,
      sessionStartTime: null,
      currentRunConfig: null,
      state: 'idle',
      startTime: null,
      elapsedTime: 0,
      currentResult: null,
    });
  },

  getSessionResults: () => {
    const { results, activeSessionId } = get();
    if (!activeSessionId) return results;
    return results.filter((r) => r.sessionId === activeSessionId);
  },
}));
