import { useEffect, useState } from "react";
import { ArrowLeft, Activity, Heart, Clock, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { initializeCharts } from './ActivityJamCharts';

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
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [heartRateData, setHeartRateData] = useState<ChartData | null>(null);
  const [distanceData, setDistanceData] = useState<ChartData | null>(null);
  const [activityTypeData, setActivityTypeData] = useState<ChartData | null>(null);
  const [weightTrainingData, setWeightTrainingData] = useState<ChartData | null>(null);
  const [caloriesData, setCaloriesData] = useState<ChartData | null>(null);
  const [summaryStats, setSummaryStats] = useState({
    totalDistance: 0,
    totalDuration: 0,
    avgHeartRate: 0,
    activityCount: 0,
  });

  // Function to fetch Strava data using our secure backend API
  const fetchStravaData = async () => {
  try {
    setLoading(true);
    
    // Use our secure backend API endpoint instead of direct Strava API calls
    // This keeps all credentials secure on the server side
    // Updated to fetch data from the last 30 calendar days
    const activitiesResponse = await fetch('/api/strava?days=30');
    
    if (!activitiesResponse.ok) {
      throw new Error(`Failed to fetch Strava data: ${activitiesResponse.status} ${activitiesResponse.statusText}`);
    }
    
    const activitiesData = await activitiesResponse.json();
    
    // Process the activities into the format your charts expect
    const processedActivities = activitiesData.map(activity => ({
      date: new Date(activity.start_date).toLocaleDateString(),
      type: activity.type,
      distance: activity.distance / 1000, // Convert meters to kilometers
      duration: Math.round(activity.moving_time / 60), // Convert seconds to minutes
      heart_rate: activity.has_heartrate ? activity.average_heartrate : null,
      name: activity.name,
      elevation_gain: activity.total_elevation_gain,
      calories: activity.calories || Math.round(activity.moving_time / 60 * 7) // Include calories, estimate if not available
    }));
    
    // Filter to ensure we only have activities from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const filteredActivities = processedActivities.filter(activity => {
      const activityDate = new Date(activity.date);
      return activityDate >= thirtyDaysAgo;
    });
    
    setActivities(filteredActivities);
    
    // Generate chart data
    generateChartData(filteredActivities);
    
    // Calculate summary stats
    calculateSummaryStats(filteredActivities);
    
  } catch (error) {
    console.error('Error fetching Strava data:', error);
  } finally {
    setLoading(false);
  }
};


  // Process the raw activities data
  const processActivities = (data: any): StravaActivity[] => {
    // Extract the raw data
    const dates = data.raw_data.dates || [];
    const heartRates = data.raw_data.heart_rates || [];
    const distances = data.raw_data.distances || [];
    const durations = data.raw_data.durations || [];
    const activityTypes = data.raw_data.activity_types || [];
    
    // Create an array of activity objects
    return dates.map((date: string, index: number) => ({
      date,
      type: activityTypes[index] || 'Unknown',
      distance: distances[index] || 0,
      duration: durations[index] || 0,
      heart_rate: heartRates[index],
      name: `Activity on ${date}`,
      elevation_gain: 0, // Default value if not available
    })).slice(0, 30); // Limit to last 30 days
  };

  // Generate chart data for our visualizations
  const generateChartData = (activities: StravaActivity[]) => {
    // Sort activities by date
    const sortedActivities = [...activities].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Extract data for heart rate chart
    const heartRateLabels = sortedActivities.map(a => a.date);
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
    
    // Extract data for distance chart
    const distanceLabels = sortedActivities.map(a => a.date);
    const distanceValues = sortedActivities.map(a => a.distance);
    
    setDistanceData({
      labels: distanceLabels,
      datasets: [{
        label: 'Distance (km)',
        data: distanceValues,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
      }]
    });
    
    // Extract data for activity type distribution
    const activityTypes = sortedActivities.map(a => a.type);
    const uniqueTypes = [...new Set(activityTypes)];
    const typeCounts = uniqueTypes.map(type => 
      activityTypes.filter(t => t === type).length
    );
    
    // Generate gradient colors for activity types
    const typeColors = uniqueTypes.map((_, index) => {
      const hue = (index * 137) % 360; // Golden angle approximation for good distribution
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
    
    // Generate Weight Training Time Graph data
    // Filter for weight training activities
    const weightTrainingActivities = sortedActivities.filter(a => 
      a.type.toLowerCase() === 'weighttraining'
    );
    
    // Group by date and sum durations
    const weightTrainingByDate = new Map<string, number>();
    
    // Initialize all dates in the last 30 days with zero minutes
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateString = date.toLocaleDateString();
      weightTrainingByDate.set(dateString, 0);
    }
    
    // Add actual weight training durations
    weightTrainingActivities.forEach(activity => {
      const currentDuration = weightTrainingByDate.get(activity.date) || 0;
      weightTrainingByDate.set(activity.date, currentDuration + activity.duration);
    });
    
    // Convert to arrays for chart
    const weightTrainingDates = Array.from(weightTrainingByDate.keys()).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );
    
    const weightTrainingDurations = weightTrainingDates.map(date => 
      weightTrainingByDate.get(date) || 0
    );
    
    // Set weight training chart data
    setWeightTrainingData({
      labels: weightTrainingDates,
      datasets: [{
        label: 'Weight Training (minutes)',
        data: weightTrainingDurations,
        borderColor: 'rgba(139, 92, 246, 0.8)', // Purple
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        fill: true,
        tension: 0.3
      }]
    });
    
    // Generate Calories Burned Chart data
    const caloriesByDate = new Map<string, number>();
    
    // Initialize all dates in the last 30 days with zero calories
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateString = date.toLocaleDateString();
      caloriesByDate.set(dateString, 0);
    }
    
    // Add actual calories burned
    sortedActivities.forEach(activity => {
      const currentCalories = caloriesByDate.get(activity.date) || 0;
      caloriesByDate.set(activity.date, currentCalories + activity.calories);
    });
    
    // Convert to arrays for chart
    const calorieDates = Array.from(caloriesByDate.keys()).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );
    
    const calorieValues = calorieDates.map(date => 
      caloriesByDate.get(date) || 0
    );
    
    // Set calories chart data
    setCaloriesData({
      labels: calorieDates,
      datasets: [{
        label: 'Calories Burned',
        data: calorieValues,
        borderColor: 'rgba(245, 158, 11, 0.8)', // Amber
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        fill: true,
        tension: 0.3
      }]
    });
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
      totalDistance: Math.round(totalDistance * 10) / 10, // Round to 1 decimal place
      totalDuration: Math.round(totalDuration),
      avgHeartRate: Math.round(avgHeartRate),
      activityCount: activities.length,
    });
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchStravaData();
  }, []);

  // Function to render charts after they're loaded
  useEffect(() => {
    if (!loading && heartRateData && distanceData && activityTypeData && weightTrainingData && caloriesData) {
      // We'll use this effect to render charts with Chart.js
      renderCharts();
    }
  }, [loading, heartRateData, distanceData, activityTypeData, weightTrainingData, caloriesData]);// Function to render charts after they're loaded
const renderCharts = ( ) => {
  if (heartRateData && distanceData && activityTypeData && weightTrainingData && caloriesData) {
    // Make sure to call the function with all data sets
    initializeCharts(heartRateData, distanceData, activityTypeData, weightTrainingData, caloriesData);
  }
};  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
      {/* Background decoration - similar to landing page */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-green-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-green-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <Button 
          onClick={() => navigate('/')} 
          variant="ghost" 
          className="mb-6 hover:bg-white/20"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent">
            Mihir's Activity Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            My workout activity over the last 30 days
          </p>
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
            <h3 className="text-lg font-medium mb-4">Distance by Day</h3>
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
          
          {/* Weight Training Time Chart */}
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Weight Training Duration per Day</h3>
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
          
          {/* Calories Burned Chart */}
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Calories Burned per Day</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-gray-400">Loading calories data...</div>
              </div>
            ) : (
              <div className="h-64" id="calories-burned-chart">
                {/* Chart will be rendered here */}
              </div>
            )}
          </Card>
          
          {/* Activity Type Chart */}
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Activity Types</h3>
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
        </section>
        
        {/* Activity Timeline */}
        <section className="mb-12">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Activity Timeline</h3>
            {loading ? (
              <div className="h-24 flex items-center justify-center">
                <div className="text-gray-400">Loading timeline data...</div>
              </div>
            ) : (
              <div className="h-24 relative">
                {/* Simple timeline visualization will be implemented here */}
                <div className="absolute inset-0 flex items-center">
                  <div className="h-0.5 w-full bg-gray-200"></div>
                </div>
                {activities.map((activity, index) => (
                  <div 
                    key={index}
                    className="absolute top-1/2 transform -translate-y-1/2"
                    style={{ 
                      left: `${(index / (activities.length - 1)) * 100}%`,
                      zIndex: 10
                    }}
                  >
                    <div 
                      className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-600 to-green-600"
                      title={`${activity.name} - ${activity.distance}km - ${activity.duration} min`}
                    ></div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>Powered by Strava</div>
          <div>Last updated: {new Date().toLocaleDateString()}</div>
        </div>
      </footer>
    </div>
  );
};

export default CurrentJam;
