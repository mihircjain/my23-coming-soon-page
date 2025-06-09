import { useState, useEffect } from "react";
import { ArrowLeft, RefreshCw, Calendar, Clock, Zap, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

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

  // FIXED: Fetch activities with better error handling and faster response
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
      
      // FIXED: Simpler API call with proper cache control
      const params = new URLSearchParams({
        days: '30',
        userId: 'mihir_jain'
      });
      
      if (forceRefresh) {
        params.set('refresh', 'true');
        params.set('timestamp', Date.now().toString());
      }
      
      const url = `/api/strava?${params.toString()}`;
      console.log(`🌐 API URL: ${url}`);

      const startTime = Date.now();
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(forceRefresh && {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          })
        }
      });

      const loadTime = Date.now() - startTime;
      console.log(`⏱️ API response time: ${loadTime}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to fetch activities: ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ Received ${data.length} activities from API`);

      // FIXED: Process activities with correct distance handling
      const processedActivities = data.map((activity: any) => ({
        id: activity.id?.toString() || Math.random().toString(),
        name: activity.name || 'Unnamed Activity',
        type: activity.type || 'Activity',
        start_date: activity.start_date,
        // FIXED: Handle distance properly (Strava API returns in meters, convert to km)
        distance: typeof activity.distance === 'number' 
          ? activity.distance  // If already in km from our API
          : (activity.distance || 0) / 1000, // If in meters, convert to km
        moving_time: activity.moving_time || activity.duration * 60 || 0,
        total_elevation_gain: activity.total_elevation_gain || activity.elevation_gain || 0,
        average_speed: activity.average_speed || 0,
        max_speed: activity.max_speed || 0,
        has_heartrate: activity.has_heartrate || false,
        average_heartrate: activity.average_heartrate || activity.heart_rate,
        max_heartrate: activity.max_heartrate,
        calories: activity.calories || activity.caloriesBurned || 0,
        caloriesBurned: activity.caloriesBurned || activity.calories || 0
      }));

      // Sort by date (most recent first)
      const sortedActivities = processedActivities.sort((a: Activity, b: Activity) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

      setActivities(sortedActivities);
      setLastUpdate(new Date().toLocaleTimeString());

      // Debug log
      if (sortedActivities.length > 0) {
        console.log('📋 Sample processed activities:');
        sortedActivities.slice(0, 2).forEach((activity: Activity, index: number) => {
          console.log(`${index + 1}. ${activity.name} - ${activity.distance}km - ${new Date(activity.start_date).toLocaleDateString()}`);
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

  // Manual refresh
  const handleRefresh = async () => {
    console.log('🔄 Manual refresh triggered');
    await fetchActivities(true);
  };

  // Load on mount
  useEffect(() => {
    fetchActivities(false);
  }, []);

  // FIXED: Format distance properly
  const formatDistance = (distance: number) => {
    if (distance === 0) return '0.00';
    if (distance < 0.1) return distance.toFixed(3); // Show 3 decimals for very small distances
    return distance.toFixed(2); // Normal 2 decimal places
  };

  // Format time
  const formatTime = (seconds: number) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // FIXED: Format pace properly
  const formatPace = (distance: number, time: number) => {
    if (distance === 0 || time === 0) return 'N/A';
    const paceSeconds = time / distance; // seconds per km
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        <span className="font-medium flex items-center">
                          <Heart className="h-3 w-3 mr-1 text-red-500" />
                          {activity.average_heartrate} bpm
                        </span>
                      </div>
                    )}
                    {(activity.calories || activity.caloriesBurned) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Calories:</span>
                        <span className="font-medium flex items-center">
                          <Zap className="h-3 w-3 mr-1 text-yellow-500" />
                          {activity.calories || activity.caloriesBurned}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ActivityJam;
