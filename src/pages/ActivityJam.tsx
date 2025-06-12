// Simple ActivityJam.tsx - Tagging inside individual run widgets, stores in Firestore

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, Calendar, Clock, Zap, Heart, Activity, BarChart3, Tag, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';

const userId = "mihir_jain";

interface ActivityData {
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
  calories: number;
  is_run_activity: boolean;
  runType?: string;
  taggedAt?: string;
  userOverride?: boolean;
}

// Run classification algorithm for suggestions
const classifyRun = (activity: ActivityData) => {
  if (!activity.distance || !activity.moving_time) {
    return { type: 'easy', confidence: 0.3, reason: 'Insufficient data' };
  }
  
  const pace = (activity.moving_time / 60) / activity.distance; // min/km
  const hr = activity.average_heartrate || 0;
  const distance = activity.distance;
  
  if (distance >= 15) {
    return { type: 'long', confidence: 0.9, reason: `${distance.toFixed(1)}km indicates long run` };
  }
  
  if (pace < 4.5 || hr > 175) {
    return { type: 'interval', confidence: 0.8, reason: `Fast pace (${pace.toFixed(2)} min/km) or high HR` };
  }
  
  if (pace >= 4.3 && pace <= 5.5 && hr >= 160 && hr <= 180) {
    return { type: 'tempo', confidence: 0.75, reason: `Moderate-hard effort (${pace.toFixed(2)} min/km, ${hr} bpm)` };
  }
  
  if (pace > 6.5 || hr < 140) {
    return { type: 'recovery', confidence: 0.7, reason: `Very easy effort (${pace.toFixed(2)} min/km)` };
  }
  
  return { type: 'easy', confidence: 0.6, reason: `Moderate effort (${pace.toFixed(2)} min/km)` };
};

// Run tagging component for individual activity cards
const RunTaggingWidget: React.FC<{
  activity: ActivityData,
  onTagRun: (activityId: string, runType: string) => void,
  isTagging: boolean
}> = ({ activity, onTagRun, isTagging }) => {
  const [showTagging, setShowTagging] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  
  const runTypes = [
    { value: 'easy', label: 'Easy', color: 'bg-green-100 text-green-800', icon: '🟢' },
    { value: 'tempo', label: 'Tempo', color: 'bg-orange-100 text-orange-800', icon: '🟠' },
    { value: 'interval', label: 'Intervals', color: 'bg-red-100 text-red-800', icon: '🔴' },
    { value: 'long', label: 'Long', color: 'bg-blue-100 text-blue-800', icon: '🔵' },
    { value: 'recovery', label: 'Recovery', color: 'bg-gray-100 text-gray-800', icon: '⚪' },
    { value: 'race', label: 'Race', color: 'bg-purple-100 text-purple-800', icon: '🟣' }
  ];
  
  const suggestion = classifyRun(activity);
  const suggestedType = runTypes.find(t => t.value === suggestion.type);
  
  const handleTag = async (runType: string) => {
    setSelectedType(runType);
    try {
      await onTagRun(activity.id, runType);
      setShowTagging(false);
    } catch (error) {
      console.error('Failed to tag run:', error);
    }
  };
  
  if (activity.runType) {
    // Already tagged - show the tag
    const taggedType = runTypes.find(t => t.value === activity.runType);
    return (
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-3 w-3 text-green-600" />
            <span className="text-xs text-gray-600">Run Type:</span>
            <Badge variant="outline" className={`text-xs ${taggedType?.color} border-0`}>
              {taggedType?.icon} {taggedType?.label}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-gray-500 hover:text-gray-700"
            onClick={() => setShowTagging(true)}
          >
            Change
          </Button>
        </div>
        
        {showTagging && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
            <div className="text-xs text-gray-600 mb-2">
              <span className="font-medium">AI suggests:</span> {suggestion.reason}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {runTypes.map((type) => (
                <Button
                  key={type.value}
                  size="sm"
                  variant={suggestion.type === type.value ? "default" : "outline"}
                  className={`text-xs h-auto p-2 ${
                    suggestion.type === type.value ? 'ring-1 ring-orange-300' : ''
                  }`}
                  onClick={() => handleTag(type.value)}
                  disabled={isTagging && selectedType === type.value}
                >
                  <div className="text-center">
                    <div className="text-sm">{type.icon}</div>
                    <div className="font-medium">{type.label}</div>
                  </div>
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="w-full mt-2 text-xs"
              onClick={() => setShowTagging(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  }
  
  // Not tagged yet - show tagging interface
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {!showTagging ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-3 w-3 text-orange-600" />
            <span className="text-xs text-gray-600">Tag this run:</span>
            <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
              {suggestedType?.icon} AI: {suggestedType?.label}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={() => setShowTagging(true)}
          >
            Tag Run
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">
            <span className="font-medium">AI suggests:</span> {suggestion.reason}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {runTypes.map((type) => (
              <Button
                key={type.value}
                size="sm"
                variant={suggestion.type === type.value ? "default" : "outline"}
                className={`text-xs h-auto p-2 ${
                  suggestion.type === type.value ? 'ring-1 ring-orange-300' : ''
                }`}
                onClick={() => handleTag(type.value)}
                disabled={isTagging && selectedType === type.value}
              >
                <div className="text-center">
                  <div className="text-sm">{type.icon}</div>
                  <div className="font-medium">{type.label}</div>
                  {isTagging && selectedType === type.value && (
                    <div className="text-xs text-blue-600 mt-1">Saving...</div>
                  )}
                </div>
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs"
            onClick={() => setShowTagging(false)}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};

const ActivityJam = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isTagging, setIsTagging] = useState(false);

  const isRunActivity = (activityType: string): boolean => {
    const runTypes = ['run', 'virtualrun', 'treadmill', 'trail'];
    return runTypes.some(type => 
      activityType.toLowerCase().includes(type.toLowerCase())
    );
  };

  // Handle run tagging with Firestore storage
  const handleTagRun = async (activityId: string, runType: string) => {
    setIsTagging(true);
    try {
      console.log(`🏷️ Tagging run ${activityId} as ${runType} and storing in Firestore`);
      
      // Update Firestore directly
      const stravaDataRef = collection(db, "strava_data");
      const activityQuery = query(
        stravaDataRef,
        where("userId", "==", userId),
        where("id", "==", parseInt(activityId))
      );
      
      const querySnapshot = await getDocs(activityQuery);
      
      if (!querySnapshot.empty) {
        const activityDoc = querySnapshot.docs[0];
        await updateDoc(activityDoc.ref, {
          runType: runType,
          taggedAt: new Date().toISOString(),
          userOverride: true
        });
        
        console.log('✅ Run tagged successfully in Firestore');
        
        // Update local state
        setActivities(prev => 
          prev.map(activity => 
            activity.id === activityId 
              ? { ...activity, runType, taggedAt: new Date().toISOString(), userOverride: true }
              : activity
          )
        );
      } else {
        throw new Error('Activity not found in Firestore');
      }
      
    } catch (error) {
      console.error('❌ Error tagging run in Firestore:', error);
      alert(`Failed to tag run: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTagging(false);
    }
  };

  // Fetch activities with run tagging support
  const fetchActivities = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');
      
      // Fetch directly from Firestore to get tagged data
      console.log('🏃 Fetching activities from Firestore...');
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const stravaDataRef = collection(db, "strava_data");
      const stravaQuery = query(
        stravaDataRef,
        where("userId", "==", userId),
        where("start_date", ">=", thirtyDaysAgo.toISOString()),
        orderBy("start_date", "desc"),
        limit(50)
      );
      
      const stravaSnapshot = await getDocs(stravaQuery);
      
      if (!stravaSnapshot.empty) {
        const processedActivities = stravaSnapshot.docs.map(doc => {
          const activity = doc.data();
          const activityType = activity.type || 'Activity';
          const isRun = isRunActivity(activityType);

          return {
            id: activity.id?.toString() || Math.random().toString(),
            name: activity.name || 'Unnamed Activity',
            type: activityType,
            start_date: activity.start_date,
            distance: activity.distance || 0,
            moving_time: activity.moving_time || activity.duration * 60 || 0,
            total_elevation_gain: activity.total_elevation_gain || activity.elevation_gain || 0,
            average_speed: activity.average_speed || 0,
            max_speed: activity.max_speed || 0,
            has_heartrate: activity.has_heartrate || false,
            average_heartrate: activity.average_heartrate || activity.heart_rate,
            max_heartrate: activity.max_heartrate,
            calories: activity.calories || 0,
            is_run_activity: isRun,
            // Include run tagging data from Firestore
            runType: activity.runType || null,
            taggedAt: activity.taggedAt || null,
            userOverride: activity.userOverride || false
          };
        });

        const sortedActivities = processedActivities.sort((a: ActivityData, b: ActivityData) => 
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        );

        console.log('🏃 Activities with run tagging loaded from Firestore:', {
          totalActivities: sortedActivities.length,
          runActivities: sortedActivities.filter(a => a.is_run_activity).length,
          taggedRuns: sortedActivities.filter(a => a.is_run_activity && a.runType).length,
          untaggedRuns: sortedActivities.filter(a => a.is_run_activity && !a.runType).length
        });

        setActivities(sortedActivities);
        setLastUpdate(new Date().toLocaleTimeString());

      } else {
        console.log('📊 No activities found in Firestore');
        setActivities([]);
      }

    } catch (error) {
      console.error('❌ Error fetching activities from Firestore:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch activities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await fetchActivities(true);
  };

  useEffect(() => {
    fetchActivities(false);
  }, []);

  // Helper functions
  const formatDistance = (distance: number) => {
    if (distance === 0) return '0.00';
    if (distance < 0.1) return distance.toFixed(3);
    return distance.toFixed(2);
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatPace = (distance: number, time: number) => {
    if (distance === 0 || time === 0) return 'N/A';
    const paceSeconds = time / distance;
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
            🏃‍♂️ Activity Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your training activities with run tagging for better analysis
          </p>
          {lastUpdate && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <Badge variant="secondary" className="text-xs">Last updated: {lastUpdate}</Badge>
              <Badge variant="secondary" className="text-xs">Firestore Connected</Badge>
              <Badge variant="secondary" className="text-xs">
                {activities.filter(a => a.is_run_activity && a.runType).length}/{activities.filter(a => a.is_run_activity).length} runs tagged
              </Badge>
            </div>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        {loading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-white/80 backdrop-blur-sm border border-white/20">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
          <div className="space-y-8">
            {/* Quick Stats */}
            <section>
              <div className="flex items-center mb-6">
                <BarChart3 className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Training Overview</h2>
                <Badge variant="outline" className="ml-3 text-xs">
                  Run tagging enabled
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {activities.length}
                    </div>
                    <div className="text-xs text-gray-600">Total Activities</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {activities.filter(a => a.is_run_activity).length}
                    </div>
                    <div className="text-xs text-gray-600">Running Activities</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {activities.filter(a => a.is_run_activity && a.runType).length}
                    </div>
                    <div className="text-xs text-gray-600">Tagged Runs</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {activities.filter(a => a.is_run_activity && !a.runType).length}
                    </div>
                    <div className="text-xs text-gray-600">Need Tagging</div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Activities List */}
            <section>
              <div className="flex items-center mb-6">
                <Calendar className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Recent Activities</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activities.map((activity) => (
                  <Card key={activity.id} className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-all duration-200">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">
                          {activity.name}
                        </CardTitle>
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className="ml-2 shrink-0">
                            {activity.type}
                          </Badge>
                          {activity.is_run_activity && (
                            <Badge variant="outline" className="ml-2 shrink-0 text-xs border-red-300 text-red-600">
                              Run
                            </Badge>
                          )}
                        </div>
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
                        {activity.calories && activity.calories > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Calories:</span>
                            <span className="font-medium flex items-center">
                              <Zap className="h-3 w-3 mr-1 text-green-500" />
                              {activity.calories}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Run Tagging Widget - Only for runs */}
                      {activity.is_run_activity && (
                        <RunTaggingWidget
                          activity={activity}
                          onTagRun={handleTagRun}
                          isTagging={isTagging}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Summary Stats */}
            <section>
              <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                    30-Day Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {activities.filter(a => a.calories && a.calories > 0).length}
                      </div>
                      <div className="text-xs text-gray-600">Activities with calories</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {activities.reduce((sum, a) => sum + (a.calories || 0), 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">Total calories burned</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {activities.filter(a => a.is_run_activity).length}
                      </div>
                      <div className="text-xs text-gray-600">Running activities</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {activities.filter(a => a.is_run_activity && a.has_heartrate).length}
                      </div>
                      <div className="text-xs text-gray-600">Runs with HR data</div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-white/60 rounded-lg border border-white/30">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-orange-500" />
                      Run Tagging Status
                    </h4>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>✅ Run tagging available in each running activity card</p>
                      <p>✅ AI suggestions based on pace, distance, and heart rate</p>
                      <p>✅ All tags automatically saved to Firestore</p>
                      <p>💡 Tag your runs to get better training analysis in Let's Jam</p>
                      {activities.filter(a => a.is_run_activity && !a.runType).length > 0 && (
                        <p className="text-orange-600 font-medium">
                          🏷️ {activities.filter(a => a.is_run_activity && !a.runType).length} runs still need tagging
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>🏷️ Tag runs for better training analysis</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              HR data from Strava
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Firestore storage
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>
              {activities.filter(a => a.is_run_activity && a.runType).length}/{activities.filter(a => a.is_run_activity).length} runs tagged
            </span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs">Tags Saved</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ActivityJam;
