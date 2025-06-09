// Fixed ActivityJam.tsx with Correct Refresh Logic
// Replace your existing ActivityJam component with this corrected version:

import { useState, useEffect } from "react";
import { ArrowLeft, RefreshCw, Calendar, MapPin, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import LetsJamButton from "@/components/LetsJamButton";
import { MessageCircle } from "lucide-react";

interface Activity {
  id: string;
  name: string;
  type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  caloriesBurned?: number;
}

const ActivityJam = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');

  // FIXED: Get current date range (last 30 days from TODAY)
  const getCurrentDateRange = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    return {
      startDate: thirtyDaysAgo.toISOString().split('T')[0], // YYYY-MM-DD
      endDate: today.toISOString().split('T')[0], // YYYY-MM-DD
      startDateISO: thirtyDaysAgo.toISOString(),
      endDateISO: today.toISOString()
    };
  };

  // FIXED: Fetch activities with proper date filtering and cache busting
  const fetchActivities = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
        console.log('🔄 Force refreshing activities...');
      } else {
        setLoading(true);
        console.log('📊 Loading activities...');
      }

      setError('');
      const { startDate, endDate, startDateISO, endDateISO } = getCurrentDateRange();
      
      console.log(`📅 Fetching activities from ${startDate} to ${endDate}`);
      console.log(`📅 ISO range: ${startDateISO} to ${endDateISO}`);

      // FIXED: Add cache busting and proper date parameters
      const timestamp = forceRefresh ? `&timestamp=${Date.now()}` : '';
      const url = `/api/strava?days=30&after=${Math.floor(new Date(startDateISO).getTime() / 1000)}&before=${Math.floor(new Date(endDateISO).getTime() / 1000)}&forceRefresh=${forceRefresh}${timestamp}`;
      
      console.log(`🌐 API URL: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // FIXED: Add cache control headers for refresh
          ...(forceRefresh && {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          })
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to fetch activities: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ Received ${data.length} activities from API`);

      // FIXED: Filter activities by date range on frontend as backup
      const filteredActivities = data.filter((activity: Activity) => {
        const activityDate = new Date(activity.start_date);
        const startFilter = new Date(startDateISO);
        const endFilter = new Date(endDateISO);
        
        const isInRange = activityDate >= startFilter && activityDate <= endFilter;
        if (!isInRange) {
          console.log(`🚫 Filtering out activity: ${activity.name} (${activity.start_date}) - outside range`);
        }
        return isInRange;
      });

      console.log(`📊 Final filtered activities: ${filteredActivities.length}`);

      // FIXED: Sort by date (most recent first)
      const sortedActivities = filteredActivities.sort((a: Activity, b: Activity) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

      setActivities(sortedActivities);
      setLastUpdate(new Date().toLocaleTimeString());

      // Log first few activities for debugging
      if (sortedActivities.length > 0) {
        console.log('📋 Recent activities:');
        sortedActivities.slice(0, 3).forEach((activity: Activity, index: number) => {
          console.log(`${index + 1}. ${activity.name} - ${new Date(activity.start_date).toLocaleDateString()}`);
        });
      }

    } catch (error) {
      console.error('❌ Error fetching activities:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch activities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // FIXED: Manual refresh function with proper cache clearing
  const handleRefresh = async () => {
    console.log('🔄 Manual refresh triggered');
    await fetchActivities(true); // Force refresh = true
  };

  // FIXED: Load activities on mount with current date logic
  useEffect(() => {
    console.log('🚀 ActivityJam component mounted');
    fetchActivities(false); // Initial load, don't force refresh
  }, []);

  // FIXED: Auto-refresh when window gains focus (user switches back to tab)
  useEffect(() => {
    const handleFocus = () => {
      console.log('👁️ Window focused, checking for fresh data...');
      const lastUpdateTime = localStorage.getItem('activityjam-last-update');
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      // Only auto-refresh if last update was more than 5 minutes ago
      if (!lastUpdateTime || (now - parseInt(lastUpdateTime)) > fiveMinutes) {
        console.log('⏰ Auto-refreshing due to stale data...');
        fetchActivities(false);
        localStorage.setItem('activityjam-last-update', now.toString());
      } else {
        console.log('✅ Data is fresh, skipping auto-refresh');
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Format distance
  const formatDistance = (distance: number) => {
    return (distance / 1000).toFixed(2); // Convert meters to km
  };

  // Format time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // Format pace (min/km)
  const formatPace = (distance: number, time: number) => {
    if (distance === 0) return 'N/A';
    const paceSeconds = time / (distance / 1000);
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex flex-col">
        <header className="pt-8 px-6 md:px-12">
          <div className="flex items-center justify-between mb-6">
            <Button onClick={() => navigate('/')} variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Try Again
            </Button>
          </div>
        </header>
        
        <main className="flex-grow flex items-center justify-center px-6">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <div className="text-red-500 mb-4">⚠️</div>
              <h3 className="text-lg font-semibold mb-2">Unable to Load Activities</h3>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <Button onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Retrying...' : 'Try Again'}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-red-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-orange-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-red-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => navigate('/')} variant="ghost" className="hover:bg-white/20">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <Button 
            onClick={handleRefresh}
            variant="outline"
            disabled={refreshing}
            className="hover:bg-white/20"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent">
            Activity Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your recent workouts and activities from Strava
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate} • Showing last 30 days
            </p>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-white/80 backdrop-blur-sm border border-white/20">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Calendar className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Recent Activities</h3>
            <p className="text-gray-600 mb-4">
              No activities found in the last 30 days. Try refreshing or check your Strava connection.
            </p>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Activities'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {activities.map((activity) => (
              <Card key={activity.id} className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-all duration-200">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">
                      {activity.name}
                    </CardTitle>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {activity.type}
                    </Badge>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    {new Date(activity.start_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {formatDistance(activity.distance)}
                      </div>
                      <div className="text-xs text-gray-600">km</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatTime(activity.moving_time)}
                      </div>
                      <div className="text-xs text-gray-600">duration</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pace:</span>
                      <span className="font-medium">{formatPace(activity.distance, activity.moving_time)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Elevation:</span>
                      <span className="font-medium">{activity.total_elevation_gain}m</span>
                    </div>
                    {activity.has_heartrate && activity.average_heartrate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg HR:</span>
                        <span className="font-medium">{activity.average_heartrate} bpm</span>
                      </div>
                    )}
                    {(activity.calories || activity.caloriesBurned) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Calories:</span>
                        <span className="font-medium">{activity.calories || activity.caloriesBurned}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Let's Jam Section */}
        <section className="mb-12">
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-green-50 rounded-2xl p-8 text-center border border-blue-200/30 shadow-lg">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-4">
                  <MessageCircle className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  Analyze Your Workouts
                </h3>
                <p className="text-gray-600 text-lg">
                  Ask questions about your workouts, performance trends, and exercise patterns
                </p>
              </div>
              
              <LetsJamButton size="lg" />
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Real-time data analysis
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    Personalized recommendations
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                    Privacy-first AI
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ActivityJam;
