import React, { useState, useEffect } from 'react';
import { Moon, RefreshCw, Home, TrendingUp, Activity, Heart, Clock, Zap, Brain, Droplet, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Types
interface SleepData {
  date: string;
  sleep: {
    id: string;
    sleep_score: number | null;
    total_sleep_duration: number;
    deep_sleep_duration: number;
    light_sleep_duration: number;
    rem_sleep_duration: number;
    awake_time: number;
    sleep_efficiency: number;
    sleep_latency: number;
    bedtime_start: string | null;
    bedtime_end: string | null;
    average_heart_rate: number | null;
    lowest_heart_rate: number | null;
    temperature_deviation: number;
    respiratory_rate: number | null;
  } | null;
  readiness: {
    id: string;
    readiness_score: number;
    temperature_deviation: number;
    activity_balance: number;
    hrv_balance: number;
    previous_day_activity: number;
    previous_night_score: number;
    recovery_index: number;
    resting_heart_rate: number;
    sleep_balance: number;
  } | null;
}

// Helper functions
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

const formatTime = (timestamp: string | null): string => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
};

const getSleepScoreColor = (score: number | null): string => {
  if (!score) return 'text-gray-500';
  if (score >= 85) return 'text-green-600';
  if (score >= 70) return 'text-blue-600';
  if (score >= 55) return 'text-yellow-600';
  return 'text-red-600';
};

const getSleepScoreEmoji = (score: number | null): string => {
  if (!score) return '😴';
  if (score >= 85) return '🏆';
  if (score >= 70) return '💪';
  if (score >= 55) return '👍';
  return '😵';
};

// Individual Sleep Day Card Component
const SleepDayCard: React.FC<{ dayData: SleepData }> = ({ dayData }) => {
  const { date, sleep, readiness } = dayData;
  
  const sleepScore = sleep?.sleep_score || null;
  const readinessScore = readiness?.readiness_score || null;
  const sleepDuration = sleep?.total_sleep_duration || 0;
  const sleepEfficiency = sleep?.sleep_efficiency || 0;
  
  const dateObj = new Date(date);
  const isToday = date === new Date().toISOString().split('T')[0];
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <Card className={`bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300 ${isToday ? 'ring-2 ring-purple-400' : ''}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-purple-700">
              {isToday ? '🌙 Today' : dayName}
            </CardTitle>
            <p className="text-sm text-gray-600">{monthDay}</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getSleepScoreColor(sleepScore)}`}>
              {getSleepScoreEmoji(sleepScore)} Sleep {sleepScore || '--'}
            </div>
            <div className={`text-lg font-semibold ${getSleepScoreColor(readinessScore)}`}>
              ⚡ Ready {readinessScore || '--'}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Sleep Duration & Efficiency */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/60 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">
              {sleepDuration > 0 ? formatDuration(sleepDuration) : '--'}
            </div>
            <div className="text-xs text-gray-600">Total Sleep</div>
          </div>
          <div className="bg-white/60 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">
              {sleepEfficiency > 0 ? `${Math.round(sleepEfficiency)}%` : '--'}
            </div>
            <div className="text-xs text-gray-600">Efficiency</div>
          </div>
        </div>

        {/* Sleep Times */}
        {sleep?.bedtime_start && sleep?.bedtime_end && (
          <div className="bg-white/60 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-700 mb-1">Sleep Time:</div>
            <div className="text-lg font-bold text-gray-800">
              {formatTime(sleep.bedtime_start)} - {formatTime(sleep.bedtime_end)}
            </div>
          </div>
        )}

        {/* Sleep Stages */}
        {sleep && (sleep.deep_sleep_duration > 0 || sleep.rem_sleep_duration > 0) && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/60 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-indigo-600">
                {formatDuration(sleep.deep_sleep_duration || 0)}
              </div>
              <div className="text-xs text-gray-600">Deep Sleep</div>
            </div>
            <div className="bg-white/60 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-purple-600">
                {formatDuration(sleep.rem_sleep_duration || 0)}
              </div>
              <div className="text-xs text-gray-600">REM Sleep</div>
            </div>
          </div>
        )}

        {/* Heart Rate */}
        {sleep?.average_heart_rate && (
          <div className="bg-white/60 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-red-600">
              Avg HR: {Math.round(sleep.average_heart_rate)} bpm
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main Sleep Jam Component
const SleepJam: React.FC = () => {
  const [sleepData, setSleepData] = useState<SleepData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // FIXED: fetchSleepData with auto-fallback to refresh when no cached data
  const fetchSleepData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Step 1: Trying cached sleep data...');
      
      // First try cached data
      const cachedResponse = await fetch('/api/oura-sleep?userId=mihir_jain&mode=cached&days=7');
      
      if (cachedResponse.ok) {
        const cachedData = await cachedResponse.json();
        if (cachedData && cachedData.length > 0) {
          console.log(`✅ Loaded ${cachedData.length} days of cached sleep data`);
          setSleepData(cachedData);
          setLoading(false);
          return;
        }
      }
      
      // Check if API recommends refresh (when no cached data)
      if (cachedResponse.status === 404) {
        const errorData = await cachedResponse.json();
        if (errorData.recommendRefresh) {
          console.log('🔄 Step 2: No cached data, auto-fetching fresh from Oura...');
          
          // Automatically fetch fresh data
          const freshResponse = await fetch('/api/oura-sleep?userId=mihir_jain&mode=refresh&days=7');
          
          if (!freshResponse.ok) {
            throw new Error(`Failed to fetch fresh sleep data: ${freshResponse.status}`);
          }
          
          const freshData = await freshResponse.json();
          console.log(`✅ Loaded ${freshData.length} days of fresh sleep data from Oura`);
          setSleepData(freshData);
          setLoading(false);
          return;
        }
      }
      
      // If we get here, something unexpected happened
      throw new Error(`Unexpected response: ${cachedResponse.status}`);
      
    } catch (error) {
      console.error('❌ Error fetching sleep data:', error);
      setError(`Unable to load sleep data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function (for refresh button)
  const refreshSleepData = async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      console.log('🔄 Manual refresh: Fetching fresh sleep data from Oura...');
      
      const response = await fetch('/api/oura-sleep?userId=mihir_jain&mode=refresh&days=7');
      
      if (!response.ok) {
        throw new Error(`Failed to refresh sleep data: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Refreshed ${data.length} days of sleep data`);
      setSleepData(data);
      
    } catch (error) {
      console.error('❌ Error refreshing sleep data:', error);
      setError(`Unable to refresh sleep data: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSleepData();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-400/10 to-blue-400/10 animate-pulse"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
              🌙 Sleep Jam
            </h1>
            <p className="text-lg text-gray-600">Loading your sleep data from Oura...</p>
          </div>
          
          {/* Loading Animation */}
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto mb-8"></div>
            <p className="text-gray-600 text-lg">Fetching sleep insights...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-400/10 to-blue-400/10 animate-pulse"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
              🌙 Sleep Jam
            </h1>
          </div>
          
          {/* Error Message */}
          <div className="text-center py-16">
            <div className="text-6xl mb-4">😴</div>
            <h2 className="text-2xl font-bold text-red-600 mb-4">Unable to Load Sleep Data</h2>
            <p className="text-gray-600 mb-8">{error}</p>
            
            <div className="space-y-4">
              <Button 
                onClick={fetchSleepData}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-8 py-3 text-lg font-medium rounded-lg"
              >
                <RefreshCw className="mr-2 h-5 w-5" />
                Try Again
              </Button>
              
              <div>
                <Button 
                  onClick={() => window.location.href = '/'}
                  variant="outline"
                  className="border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Back to Home
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-400/10 to-blue-400/10 animate-pulse"></div>
      
      {/* Floating elements */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-purple-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-blue-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-indigo-200/30 rounded-full blur-xl animate-bounce delay-500"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            🌙 Sleep Jam
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Your sleep insights from Oura Ring. Track your sleep quality, duration, and recovery.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mb-8">
          <Button 
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="border-purple-200 text-purple-600 hover:bg-purple-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <Button 
            onClick={refreshSleepData}
            disabled={refreshing}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
          >
            {refreshing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {refreshing ? 'Refreshing...' : 'Refresh Sleep Data'}
          </Button>
        </div>

        {/* Sleep Data Grid */}
        {sleepData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {sleepData.map((dayData) => (
              <SleepDayCard key={dayData.date} dayData={dayData} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">😴</div>
            <h2 className="text-2xl font-bold text-gray-600 mb-4">No Sleep Data Available</h2>
            <p className="text-gray-500 mb-8">No sleep data found for the last 7 days.</p>
            
            <Button 
              onClick={refreshSleepData}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Sleep Data
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 bg-white/50 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600 font-medium">🏃 Powered by Oura Ring</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SleepJam;
