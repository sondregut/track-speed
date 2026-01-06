import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, Athlete, StartMethod, SessionType } from '../types';

interface SessionStore {
  // State
  currentSession: Session | null;
  sessions: Session[];
  athletes: Athlete[];
  selectedAthleteId: string | null;

  // Session Actions
  createSession: (config?: Partial<Session>) => Session;
  updateSession: (id: string, updates: Partial<Session>) => void;
  endSession: (id: string) => void;
  deleteSession: (id: string) => void;
  setCurrentSession: (session: Session | null) => void;

  // Athlete Actions
  addAthlete: (athlete: Omit<Athlete, 'id'>) => Athlete;
  updateAthlete: (id: string, updates: Partial<Athlete>) => void;
  deleteAthlete: (id: string) => void;
  selectAthlete: (id: string | null) => void;
}

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentSession: null,
      sessions: [],
      athletes: [],
      selectedAthleteId: null,

      // Session Actions
      createSession: (config = {}) => {
        const newSession: Session = {
          id: generateId(),
          name: config.name || `Session ${new Date().toLocaleDateString()}`,
          date: new Date().toISOString(),
          location: config.location,
          sessionType: config.sessionType || 'flying',
          distance: config.distance || 10,
          startMethod: config.startMethod || 'ready_set_go',
          results: [],
          ...config,
        };

        set((state) => ({
          sessions: [...state.sessions, newSession],
          currentSession: newSession,
        }));

        return newSession;
      },

      updateSession: (id, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
          currentSession:
            state.currentSession?.id === id
              ? { ...state.currentSession, ...updates }
              : state.currentSession,
        }));
      },

      endSession: (id) => {
        set((state) => ({
          currentSession:
            state.currentSession?.id === id ? null : state.currentSession,
        }));
      },

      deleteSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          currentSession:
            state.currentSession?.id === id ? null : state.currentSession,
        }));
      },

      setCurrentSession: (session) => set({ currentSession: session }),

      // Athlete Actions
      addAthlete: (athleteData) => {
        const newAthlete: Athlete = {
          ...athleteData,
          id: generateId(),
        };

        set((state) => ({
          athletes: [...state.athletes, newAthlete],
        }));

        return newAthlete;
      },

      updateAthlete: (id, updates) => {
        set((state) => ({
          athletes: state.athletes.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        }));
      },

      deleteAthlete: (id) => {
        set((state) => ({
          athletes: state.athletes.filter((a) => a.id !== id),
          selectedAthleteId:
            state.selectedAthleteId === id ? null : state.selectedAthleteId,
        }));
      },

      selectAthlete: (id) => set({ selectedAthleteId: id }),
    }),
    {
      name: 'track-speed-sessions',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        athletes: state.athletes,
      }),
    }
  )
);
