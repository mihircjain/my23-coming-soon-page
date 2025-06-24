// React hook for Strava data via MCP client
// Provides loading states, error handling, and data caching

import { useState, useEffect, useCallback, useRef } from 'react';
import mcpClient, { 
  StravaActivity, 
  StravaActivityDetails, 
  StravaActivityStreams,
  StravaAthleteProfile,
  StravaAthleteStats,
  StravaAthleteZones,
  setMcpAccessToken 
} from '@/lib/mcpClient';

export interface UseStravaOptions {
  autoFetch?: boolean;
  cacheTimeout?: number; // milliseconds
  accessToken?: string;
}

export interface UseStravaState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
}

// Cache for data to avoid unnecessary API calls
const dataCache = new Map<string, { data: any; timestamp: number }>();

const useStravaData = <T = any>(
  key: string,
  fetchFn: () => Promise<T>,
  options: UseStravaOptions = {}
) => {
  const { autoFetch = false, cacheTimeout = 5 * 60 * 1000, accessToken } = options;
  
  const [state, setState] = useState<UseStravaState<T>>({
    data: null,
    loading: false,
    error: null,
    lastFetched: null,
  });

  const fetchRef = useRef<AbortController | null>(null);

  // Set access token if provided
  useEffect(() => {
    if (accessToken) {
      setMcpAccessToken(accessToken);
    }
  }, [accessToken]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh) {
      const cached = dataCache.get(key);
      if (cached && (Date.now() - cached.timestamp) < cacheTimeout) {
        setState(prev => ({
          ...prev,
          data: cached.data,
          error: null,
          lastFetched: new Date(cached.timestamp),
        }));
        return cached.data;
      }
    }

    // Cancel previous request if still running
    if (fetchRef.current) {
      fetchRef.current.abort();
    }

    fetchRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await fetchFn();
      
      // Cache the data
      dataCache.set(key, { data, timestamp: Date.now() });
      
      setState({
        data,
        loading: false,
        error: null,
        lastFetched: new Date(),
      });

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));

      throw error;
    } finally {
      fetchRef.current = null;
    }
  }, [key, fetchFn, cacheTimeout]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  const clearCache = useCallback(() => {
    dataCache.delete(key);
  }, [key]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }

    // Cleanup on unmount
    return () => {
      if (fetchRef.current) {
        fetchRef.current.abort();
      }
    };
  }, [autoFetch, fetchData]);

  return {
    ...state,
    refetch,
    clearCache,
    isCached: dataCache.has(key),
  };
};

// Specific hooks for different Strava data types

export const useRecentActivities = (perPage = 30, options: UseStravaOptions = {}) => {
  const fetchFn = useCallback(() => mcpClient.getRecentActivities(perPage), [perPage]);
  return useStravaData<StravaActivity[]>(`recent-activities-${perPage}`, fetchFn, options);
};

export const useActivityDetails = (activityId: string | number | null, options: UseStravaOptions = {}) => {
  const fetchFn = useCallback(() => {
    if (!activityId) throw new Error('Activity ID is required');
    return mcpClient.getActivityDetails(activityId);
  }, [activityId]);

  return useStravaData<StravaActivityDetails>(
    activityId ? `activity-details-${activityId}` : 'no-activity',
    fetchFn,
    { ...options, autoFetch: options.autoFetch && !!activityId }
  );
};

export const useActivityStreams = (
  activityId: string | number | null,
  types: string[] = ['time', 'distance', 'heartrate', 'velocity_smooth'],
  resolution?: 'low' | 'medium' | 'high',
  options: UseStravaOptions = {}
) => {
  const fetchFn = useCallback(() => {
    if (!activityId) throw new Error('Activity ID is required');
    return mcpClient.getActivityStreams(activityId, types, resolution);
  }, [activityId, types, resolution]);

  const cacheKey = activityId 
    ? `activity-streams-${activityId}-${types.join(',')}-${resolution || 'default'}`
    : 'no-activity-streams';

  return useStravaData<StravaActivityStreams>(
    cacheKey,
    fetchFn,
    { ...options, autoFetch: options.autoFetch && !!activityId }
  );
};

export const useActivityLaps = (activityId: string | number | null, options: UseStravaOptions = {}) => {
  const fetchFn = useCallback(() => {
    if (!activityId) throw new Error('Activity ID is required');
    return mcpClient.getActivityLaps(activityId);
  }, [activityId]);

  return useStravaData<any[]>(
    activityId ? `activity-laps-${activityId}` : 'no-activity-laps',
    fetchFn,
    { ...options, autoFetch: options.autoFetch && !!activityId }
  );
};

export const useAthleteProfile = (options: UseStravaOptions = {}) => {
  const fetchFn = useCallback(() => mcpClient.getAthleteProfile(), []);
  return useStravaData<StravaAthleteProfile>('athlete-profile', fetchFn, options);
};

export const useAthleteStats = (options: UseStravaOptions = {}) => {
  const fetchFn = useCallback(() => mcpClient.getAthleteStats(), []);
  return useStravaData<StravaAthleteStats>('athlete-stats', fetchFn, options);
};

export const useAthleteZones = (options: UseStravaOptions = {}) => {
  const fetchFn = useCallback(() => mcpClient.getAthleteZones(), []);
  return useStravaData<StravaAthleteZones>('athlete-zones', fetchFn, options);
};

// Utility hook for multiple activities with details
export const useActivitiesWithDetails = (
  activityIds: (string | number)[],
  options: UseStravaOptions = {}
) => {
  const [activities, setActivities] = useState<Record<string, StravaActivityDetails>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    if (activityIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const promises = activityIds.map(id => mcpClient.getActivityDetails(id));
      const results = await Promise.allSettled(promises);
      
      const activitiesMap: Record<string, StravaActivityDetails> = {};
      
      results.forEach((result, index) => {
        const id = activityIds[index].toString();
        if (result.status === 'fulfilled') {
          activitiesMap[id] = result.value;
        } else {
          console.error(`Failed to fetch activity ${id}:`, result.reason);
        }
      });

      setActivities(activitiesMap);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch activities';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [activityIds]);

  useEffect(() => {
    if (options.autoFetch && activityIds.length > 0) {
      fetchActivities();
    }
  }, [options.autoFetch, fetchActivities]);

  return {
    activities,
    loading,
    error,
    refetch: fetchActivities,
  };
};

// Utility hook for combined athlete data
export const useAthleteData = (options: UseStravaOptions = {}) => {
  const profile = useAthleteProfile(options);
  const stats = useAthleteStats(options);
  const zones = useAthleteZones(options);

  return {
    profile: profile.data,
    stats: stats.data,
    zones: zones.data,
    loading: profile.loading || stats.loading || zones.loading,
    error: profile.error || stats.error || zones.error,
    refetch: () => {
      profile.refetch();
      stats.refetch();
      zones.refetch();
    },
  };
};

// Export cache utilities
export const clearAllStravaCache = () => {
  dataCache.clear();
};

export const clearStravaCacheByPattern = (pattern: string) => {
  const keysToDelete = Array.from(dataCache.keys()).filter(key => key.includes(pattern));
  keysToDelete.forEach(key => dataCache.delete(key));
};

// Export default hook for general use
export default useStravaData; 
