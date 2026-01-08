/**
 * Supabase Data Hooks for Track Speed
 *
 * Hooks for CRUD operations on athletes, sessions, and results.
 * All operations respect Row Level Security.
 */

import { useCallback, useState, useEffect } from 'react';
import { supabase, Athlete, Session, Result, Split, InsertTables, Database } from '../lib/supabase';

type Json = Database['public']['Tables']['sessions']['Row']['config'];

// ============================================
// Athletes Hook
// ============================================

export function useAthletes() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAthletes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('athletes')
      .select('*')
      .order('name');

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setAthletes(data || []);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAthletes();
  }, [fetchAthletes]);

  const createAthlete = useCallback(
    async (athlete: InsertTables<'athletes'>): Promise<Athlete | null> => {
      const { data, error: insertError } = await supabase
        .from('athletes')
        .insert(athlete)
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return null;
      }

      setAthletes((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    },
    []
  );

  const updateAthlete = useCallback(
    async (id: string, updates: Partial<Athlete>): Promise<boolean> => {
      const { error: updateError } = await supabase
        .from('athletes')
        .update(updates)
        .eq('id', id);

      if (updateError) {
        setError(updateError.message);
        return false;
      }

      setAthletes((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
      );
      return true;
    },
    []
  );

  const deleteAthlete = useCallback(async (id: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('athletes')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    setAthletes((prev) => prev.filter((a) => a.id !== id));
    return true;
  }, []);

  return {
    athletes,
    isLoading,
    error,
    fetchAthletes,
    createAthlete,
    updateAthlete,
    deleteAthlete,
  };
}

// ============================================
// Sessions Hook
// ============================================

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async (limit = 50) => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('sessions')
      .select('*')
      .order('date', { ascending: false })
      .limit(limit);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setSessions(data || []);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(
    async (session: InsertTables<'sessions'>): Promise<Session | null> => {
      const { data, error: insertError } = await supabase
        .from('sessions')
        .insert(session)
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return null;
      }

      setSessions((prev) => [data, ...prev]);
      return data;
    },
    []
  );

  const updateSession = useCallback(
    async (id: string, updates: Partial<Session>): Promise<boolean> => {
      const { error: updateError } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', id);

      if (updateError) {
        setError(updateError.message);
        return false;
      }

      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
      return true;
    },
    []
  );

  const deleteSession = useCallback(async (id: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    setSessions((prev) => prev.filter((s) => s.id !== id));
    return true;
  }, []);

  return {
    sessions,
    isLoading,
    error,
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
  };
}

// ============================================
// Results Hook
// ============================================

export function useResults(sessionId?: string) {
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let query = supabase
      .from('results')
      .select('*')
      .order('created_at', { ascending: false });

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error: fetchError } = await query.limit(100);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setResults(data || []);
    }

    setIsLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const createResult = useCallback(
    async (result: InsertTables<'results'>): Promise<Result | null> => {
      const { data, error: insertError } = await supabase
        .from('results')
        .insert(result)
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return null;
      }

      setResults((prev) => [data, ...prev]);
      return data;
    },
    []
  );

  const updateResult = useCallback(
    async (id: string, updates: Partial<Result>): Promise<boolean> => {
      const { error: updateError } = await supabase
        .from('results')
        .update(updates)
        .eq('id', id);

      if (updateError) {
        setError(updateError.message);
        return false;
      }

      setResults((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
      return true;
    },
    []
  );

  const deleteResult = useCallback(async (id: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('results')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    setResults((prev) => prev.filter((r) => r.id !== id));
    return true;
  }, []);

  return {
    results,
    isLoading,
    error,
    fetchResults,
    createResult,
    updateResult,
    deleteResult,
  };
}

// ============================================
// Sync Hook (sync local data to cloud)
// ============================================

export function useDataSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const syncSession = useCallback(
    async (localSession: {
      name: string;
      date: string;
      session_type: string;
      start_method: string;
      config?: object;
      results: {
        time_ms: number;
        distance_m?: number;
        velocity_ms?: number;
        source: string;
        confidence?: number;
        athlete_id?: string;
      }[];
    }): Promise<string | null> => {
      setIsSyncing(true);

      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Not authenticated');
        }

        // Create session
        const sessionInsert: InsertTables<'sessions'> = {
          user_id: user.id,
          name: localSession.name,
          date: localSession.date,
          session_type: localSession.session_type,
          start_method: localSession.start_method,
          config: localSession.config as Json,
        };

        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .insert(sessionInsert)
          .select()
          .single();

        if (sessionError) throw sessionError;

        // Create results
        if (localSession.results.length > 0) {
          const resultsToInsert = localSession.results.map((r) => ({
            session_id: session.id,
            user_id: user.id,
            time_ms: r.time_ms,
            distance_m: r.distance_m,
            velocity_ms: r.velocity_ms,
            source: r.source,
            confidence: r.confidence,
            athlete_id: r.athlete_id,
          }));

          const { error: resultsError } = await supabase
            .from('results')
            .insert(resultsToInsert);

          if (resultsError) throw resultsError;
        }

        setLastSyncTime(new Date());
        setIsSyncing(false);
        return session.id;
      } catch (err) {
        console.error('Sync error:', err);
        setIsSyncing(false);
        return null;
      }
    },
    []
  );

  return {
    isSyncing,
    lastSyncTime,
    syncSession,
  };
}
