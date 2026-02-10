/**
 * React hooks for queue management
 */

import { useState, useEffect, useCallback } from 'react';
import { api, QueueEntry, PaginatedResponse, ProcessingStats } from '../api/client';

export interface UseQueueOptions {
  page?: number;
  pageSize?: number;
  minConfidence?: number;
  maxConfidence?: number;
  queueType?: string;
}

export function useQueue(options: UseQueueOptions = {}) {
  const [data, setData] = useState<PaginatedResponse<QueueEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.getPendingQueue(options);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch queue');
    } finally {
      setLoading(false);
    }
  }, [options.page, options.pageSize, options.minConfidence, options.maxConfidence, options.queueType]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const refresh = useCallback(() => {
    fetchQueue();
  }, [fetchQueue]);

  return { data, loading, error, refresh };
}

export function useStats() {
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.getStats();
      setStats(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const refresh = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh };
}

export function useApproval() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = useCallback(async (
    id: number,
    reviewerId: number,
    modifications?: Record<string, unknown>
  ) => {
    setLoading(true);
    setError(null);

    try {
      await api.approveEntry(id, reviewerId, modifications);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reject = useCallback(async (id: number, reviewerId: number, reason?: string) => {
    setLoading(true);
    setError(null);

    try {
      await api.rejectEntry(id, reviewerId, reason);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const bulkApprove = useCallback(async (
    reviewerId: number,
    minConfidence: number = 0.95,
    limit: number = 100
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.bulkApprove(reviewerId, minConfidence, limit);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk approve');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { approve, reject, bulkApprove, loading, error };
}
