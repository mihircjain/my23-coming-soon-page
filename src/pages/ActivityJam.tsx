import { useEffect, useState } from "react";
import { ArrowLeft, Activity, Heart, Clock, Route, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { initializeCharts } from './ActivityJamCharts';
import { db } from "@/lib/firebaseConfig";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import LetsJamButton from "@/components/ui/LetsJamButton";

// Define types for our Strava data
interface StravaActivity {
  date: string;
  type: string;
  distance: number;
  duration: number;
  heart_rate: number | null;
  name: string;
  elevation_gain: number;
  calories: number;
  start_date: string;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: (number | null)[];
    borderColor?: string;
    backgroundColor?: string | string[];
    fill?: boolean;
  }[];
}

const CurrentJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [heartRateData, setHeartRateData] = useState<ChartData | null>(null);
  const [distanceData, setDistanceData] = useState<ChartData | null>(null);
  const [activityTypeData, setActivityTypeData] = useState<ChartData | null>(null);
  const [weightTrainingData, setWeightTrainingData] = useState<ChartData | null>(null);
  const [caloriesData, setCaloriesData] = useState<ChartData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [summaryStats, setSummaryStats] = useState({
    totalDistance: 0,
    totalDuration: 0,
    avgHeartRate: 0,
    activityCount: 0,
  });

  // Hardcoded userId for consistency across the application
  const userId = "mihir_jain";

  // Function to fetch data from cache first, then API if needed
  const fetchStravaData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Always try Firestore cache first (fastest option)
      if (!forceRefresh) {
        console.log('Checking Firestore cache...');
        const cachedData = await getCachedDataFromFirestore();
        
        if (cachedData.length > 0) {
          console.log(`Using ${cachedData.length} cached activities from Firestore`);
          processAndSetActivities(cachedData);
          setLastUpdate('Cached data');
          setLoading(false);
          return;
        }
      }
      
      // If no cache or force refresh, call API
      console.log(`Fetching from API (forceRefresh: ${forceRefresh})...`);
      const apiUrl = `/api/strava?days=30&userId=${userId}${forceRefresh ? '&refresh=true' : ''}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const apiData = await response.json();
      console.log(`Received ${apiData.length} activities from API`);
      
      processAndSetActivities(apiData);
      setLastUpdate(new Date().toLocaleTimeString());
      
    } catch (error) {
      console.error('Error fetching Strava data:', error);
      
      // Fallback to any cached data we can find
      try {
        const fallbackData = await getCachedDataFromFirestore();
        if (fallbackData.length > 0) {
          console.log(`Using ${fallbackData.length} fallback cached activities`);
          processAndSetActivities(fallbackData);
          setLastUpdate('Cached data (fallback)');
        }
      } catch (fallbackError) {
        console.error('Fallback cache fetch failed:', fallbackError);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Get cached data from Firestore directly
  const getCachedDataFromFirestore = async (): Promise<StravaActivity[]> => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      console.log('Filtering activities after:', thirtyDaysAgo.toISOString());
      
      const stravaDataRef = collection(db, "strava_data");
      const cacheQuery = query(
        stravaDataRef,
        where("userId", "==", userId),
        where("start_date", ">=", thirtyDaysAgo.toISOString()),
        orderBy("start_date", "desc"),
        limit(50)
      );
      
      const snapshot = await getDocs(cacheQuery);
      console.log(`Found ${snapshot.docs.length} activities in Firestore after ${thirtyDaysAgo.toDateString()}`);
      
      const activities = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`Activity: ${data.name} on ${data.start_date}`);
        return {
          date: new Date(data.start_date).toLocaleDateString(),
          type: data.type,
          distance: data.distance,
          duration: data.duration,
          heart_rate: data.heart_rate,
          name: data.name,
          elevation_gain: data.elevation_gain || 0,
          calories: data.caloriesBurned || 0,
          start_date: data.start_date
        };
      });
      
      // Additional frontend filtering to be extra sure
      const filteredActivities = activities.filter(activity => {
        const activityDate = new Date(activity.start_date);
        const isRecent = activityDate >= thirtyDaysAgo;
        if (!isRecent) {
          console.log(`Filtering out old activity: ${activity.name} from ${activityDate.toDateString()}`);
        }
        return isRecent;
      });
      
      console.log(`Returning ${filteredActivities.length} activities from last 30 days`);
      return filteredActivities;
      
    } catch (error) {
      console.error('Error fetching from Firestore cache:', error);
      return [];
    }
  };

// Fixed processAndSetActivities function - replace in your CurrentJam component

const processAndSetActivities = (activitiesData: any[]) => {
  // Filter to last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const processedActivities = activitiesData
    .map(activity => ({
      date: new Date(activity.start_date || activity.date).toLocaleDateString(),
      type: activity.type,
      distance: activity.distance || 0,
      duration: activity.duration || 0,
      heart_rate: activity.heart_rate,
      name: activity.name,
      elevation_gain: activity.elevation_gain || 0,
      calories: activity.caloriesBurned || activity.calories || 0,
      start_date: activity.start_date || activity.date
    }))
    .filter(activity => {
      const activityDate = new Date(activity.start_date);
      return activityDate >= thirtyDaysAgo;
    });
    // REMOVED: .slice(0, 30) - this was limiting your data artificially
  
  console.log(`Processed ${processedActivities.length} activities`);
  console.log('Date range:', 
    processedActivities.length > 0 ? 
    `${processedActivities[processedActivities.length - 1].start_date} to ${processedActivities[0].start_date}` : 
    'No activities'
  );
  
  setActivities(processedActivities);
  generateChartData(processedActivities);
  calculateSummaryStats(processedActivities);
};

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStravaData(true); // Force refresh
  };

  // Generate chart data for our visualizations
// Fixed generateChartData function - replace in your CurrentJam component

const generateChartData = (activities: StravaActivity[]) => {
  console.log('=== GENERATING CHART DATA ===');
  console.log('Input activities count:', activities.length);
  
  // Sort activities by date
  const sortedActivities = [...activities].sort((a, b) => 
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );
  
  console.log('Sorted activities date range:', 
    sortedActivities.length > 0 ? 
    `${sortedActivities[0].start_date} to ${sortedActivities[sortedActivities.length - 1].start_date}` : 
    'No activities'
  );
  
  // FIXED: Heart Rate Chart - use start_date instead of date, and don't slice
  const heartRateLabels = sortedActivities.map(a => a.start_date);
  const heartRateValues = sortedActivities.map(a => a.heart_rate);
  
  setHeartRateData({
    labels: heartRateLabels,
    datasets: [{
      label: 'Heart Rate (bpm)',
      data: heartRateValues,
      borderColor: 'rgba(255, 99, 132, 0.8)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      fill: false
    }]
  });
  
  // FIXED: Distance Chart - use start_date instead of date, and don't slice
  const distanceLabels = sortedActivities.map(a => a.start_date);
  const distanceValues = sortedActivities.map(a => a.distance);
  
  setDistanceData({
    labels: distanceLabels,
    datasets: [{
      label: 'Distance (km)',
      data: distanceValues,
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
    }]
  });
  
  // Activity Type Distribution (this one was working correctly)
  const activityTypes = sortedActivities.map(a => a.type);
  const uniqueTypes = [...new Set(activityTypes)];
  const typeCounts = uniqueTypes.map(type => 
    activityTypes.filter(t => t === type).length
  );
  
  const typeColors = uniqueTypes.map((_, index) => {
    const hue = (index * 137) % 360;
    return `hsla(${hue}, 70%, 60%, 0.7)`;
  });
  
  setActivityTypeData({
    labels: uniqueTypes,
    datasets: [{
      label: 'Activity Types',
      data: typeCounts,
      backgroundColor: typeColors,
    }]
  });
  
  // FIXED: Weight Training Time Chart - use actual activity dates
  const weightTrainingActivities = sortedActivities.filter(a => 
    a.type.toLowerCase().includes('weight') || 
    a.type.toLowerCase().includes('strength') ||
    a.type.toLowerCase().includes('workout')
  );
  
  console.log('Weight training activities found:', weightTrainingActivities.length);
  
  // Create a map of all unique dates from activities and initialize with 0
  const allDates = [...new Set(sortedActivities.map(a => a.start_date))].sort();
  const weightTrainingByDate = new Map<string, number>();
  
  // Initialize all activity dates with zero
  allDates.forEach(date => {
    weightTrainingByDate.set(date, 0);
  });
  
  // Add actual durations for weight training
  weightTrainingActivities.forEach(activity => {
    const currentDuration = weightTrainingByDate.get(activity.start_date) || 0;
    weightTrainingByDate.set(activity.start_date, currentDuration + activity.duration);
  });
  
  const weightTrainingDates = Array.from(weightTrainingByDate.keys()).sort();
  const weightTrainingDurations = weightTrainingDates.map(date => 
    weightTrainingByDate.get(date) || 0
  );
  
  console.log('Weight training chart dates:', weightTrainingDates.length);
  console.log('Weight training date range:', 
    weightTrainingDates.length > 0 ? 
    `${weightTrainingDates[0]} to ${weightTrainingDates[weightTrainingDates.length - 1]}` : 
    'No dates'
  );
  
  setWeightTrainingData({
    labels: weightTrainingDates,
    datasets: [{
      label: 'Weight Training (minutes)',
      data: weightTrainingDurations,
      borderColor: 'rgba(139, 92, 246, 0.8)',
      backgroundColor: 'rgba(139, 92, 246, 0.2)',
      fill: true,
      tension: 0.3
    }]
  });
  
  // FIXED: Calories Burned Chart - use actual activity dates
  const caloriesByDate = new Map<string, number>();
  
  // Initialize all activity dates with zero
  allDates.forEach(date => {
    caloriesByDate.set(date, 0);
  });
  
  // Add actual calories
  sortedActivities.forEach(activity => {
    const currentCalories = caloriesByDate.get(activity.start_date) || 0;
    caloriesByDate.set(activity.start_date, currentCalories + activity.calories);
  });
  
  const calorieDates = Array.from(caloriesByDate.keys()).sort();
  const calorieValues = calorieDates.map(date => 
    caloriesByDate.get(date) || 0
  );
  
  console.log('Calories chart dates:', calorieDates.length);
  console.log('Calories date range:', 
    calorieDates.length > 0 ? 
    `${calorieDates[0]} to ${calorieDates[calorieDates.length - 1]}` : 
    'No dates'
  );
  
  setCaloriesData({
    labels: calorieDates,
    datasets: [{
      label: 'Calories Burned',
      data: calorieValues,
      borderColor: 'rgba(245, 158, 11, 0.8)',
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      fill: true,
      tension: 0.3
    }]
  });
  
  console.log('=== CHART DATA GENERATION COMPLETE ===');
};

  // Calculate summary statistics
  const calculateSummaryStats = (activities: StravaActivity[]) => {
    const totalDistance = activities.reduce((sum, activity) => sum + activity.distance, 0);
    const totalDuration = activities.reduce((sum, activity) => sum + activity.duration, 0);
    
    const activitiesWithHeartRate = activities.filter(a => a.heart_rate !== null);
    const avgHeartRate = activitiesWithHeartRate.length > 0
      ? activitiesWithHeartRate.reduce((sum, a) => sum + (a.heart_rate || 0), 0) / activitiesWithHeartRate.length
      : 0;
    
    setSummaryStats({
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalDuration: Math.round(totalDuration),
      avgHeartRate: Math.round(avgHeartRate),
      activityCount: activities.length,
    });
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchStravaData(false); // Don't force refresh on initial load
  }, []);

  // Function to render charts after they're loaded
  useEffect(() => {
    if (!loading && heartRateData && distanceData && activityTypeData && weightTrainingData && caloriesData) {
      renderCharts();
    }
  }, [loading, heartRateData, distanceData, activityTypeData, weightTrainingData, caloriesData]);
  
  const renderCharts = () => {
    if (heartRateData && distanceData && activityTypeData && weightTrainingData && caloriesData) {
      initializeCharts(heartRateData, distanceData, activityTypeData, weightTrainingData, caloriesData);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-green-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-green-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-6">
          <Button 
            onClick={() => navigate('/')} 
            variant="ghost" 
            className="hover:bg-white/20"
          >
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
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent">
            Mihir's Activity Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            My workout activity over the last 30 days
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate}
            </p>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        {/* Summary Stats Section */}
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Distance Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Route className="mr-2 h-4 w-4 text-blue-500" />
                  Total Distance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{summaryStats.totalDistance} km</div>
                )}
              </CardContent>
            </Card>
            
            {/* Total Duration Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Clock className="mr-2 h-4 w-4 text-purple-500" />
                  Total Duration
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{Math.floor(summaryStats.totalDuration / 60)} hrs {summaryStats.totalDuration % 60} min</div>
                )}
              </CardContent>
            </Card>
            
            {/* Average Heart Rate Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Heart className="mr-2 h-4 w-4 text-red-500" />
                  Avg Heart Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{summaryStats.avgHeartRate} bpm</div>
                )}
              </CardContent>
            </Card>
            
            {/* Activity Count Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Activity className="mr-2 h-4 w-4 text-green-500" />
                  Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{summaryStats.activityCount}</div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
        
        {/* Charts Section */}
        <section className="mb-12 space-y-8">
          {/* Heart Rate Chart */}
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Heart Rate Trend</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-gray-400">Loading heart rate data...</div>
              </div>
            ) : (
              <div className="h-64" id="heart-rate-chart">
                {/* Chart will be rendered here */}
              </div>
            )}
          </Card>
          
          {/* Distance Chart */}
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Distance by Activity</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-gray-400">Loading distance data...</div>
              </div>
            ) : (
              <div className="h-64" id="distance-chart">
                {/* Chart will be rendered here */}
              </div>
            )}
          </Card>
          
          {/* Activity Type Chart */}
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Activity Type Distribution</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-gray-400">Loading activity type data...</div>
              </div>
            ) : (
              <div className="h-64" id="activity-type-chart">
                {/* Chart will be rendered here */}
              </div>
            )}
          </Card>
          
          {/* Weight Training Chart */}
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Weight Training Time</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-gray-400">Loading weight training data...</div>
              </div>
            ) : (
              <div className="h-64" id="weight-training-chart">
                {/* Chart will be rendered here */}
              </div>
            )}
          </Card>
          
          {/* Calories Chart */}
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Calories Burned</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-gray-400">Loading calories data...</div>
              </div>
            ) : (
              <div className="h-64" id="calories-chart">
                {/* Chart will be rendered here */}
              </div>
            )}
          </Card>
        </section>
        
        {/* Recent Activities Table */}
        <section className="mb-12">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Recent Activities</h3>
            {loading ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Activity</th>
                      <th className="text-left py-3 px-4">Type</th>
                      <th className="text-right py-3 px-4">Distance</th>
                      <th className="text-right py-3 px-4">Duration</th>
                      <th className="text-right py-3 px-4">Heart Rate</th>
                      <th className="text-right py-3 px-4">Calories</th>
                      <th className="text-right py-3 px-4">Elevation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.slice(0, 15).map((activity, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{activity.date}</td>
                        <td className="py-3 px-4">{activity.name}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                            {activity.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {activity.distance > 0 ? `${activity.distance.toFixed(2)} km` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {Math.floor(activity.duration / 60)}:{(activity.duration % 60).toString().padStart(2, '0')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {activity.heart_rate ? `${Math.round(activity.heart_rate)} bpm` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {activity.calories > 0 ? `${activity.calories} cal` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">{activity.elevation_gain} m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      </main>

      // Alternative compact version for pages with less space:
{/* Compact Let's Jam Section */}
<section className="mb-8">
  <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50">
    <CardContent className="p-6 text-center">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        💬 Chat with Your Health AI
      </h3>
      <p className="text-gray-600 text-sm mb-4">
        Get insights about your health data through natural conversation
      </p>
      <LetsJamButton variant="outline" />
    </CardContent>
  </Card>
</section>
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <p>Data from Strava API • Cached for performance • Updates twice daily</p>
      </footer>
    </div>
  );
};

export default CurrentJam;
