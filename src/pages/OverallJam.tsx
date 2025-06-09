import { useState, useEffect } from "react";
import { ArrowLeft, Activity, Heart, Flame, Utensils, Droplet, Apple, Wheat, Drumstick, Leaf, RefreshCw, BarChart3, Target, TrendingUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import Chart from 'chart.js/auto';
import { db } from "@/lib/firebaseConfig";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import { DailyLog } from "@/types/nutrition";

// Define types for our data
interface StravaData {
  date: string;
  type: string;
  start_date?: string;
  heart_rate: number | null;
  calories: number;
  duration: number;
}

interface BloodMarkerData {
  date: string;
  markers: Record<string, number | string>;
}

interface CombinedData {
  date: string;
  heartRate: number | null;
  caloriesBurned: number;
  caloriesConsumed: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  workoutDuration: number;
  activityTypes: string[];
}

// Daily Health Box Component (ActivityJam style)
const DailyHealthBox = ({ data, date, isToday, onClick }) => {
  const hasData = data.caloriesConsumed > 0 || data.caloriesBurned > 0 || data.heartRate > 0;
  
  // Calculate health score based on nutrition and fitness metrics
  const calculateHealthScore = () => {
    let score = 0;
    
    // Calories Consumed Score (40% of total) - Target: under 2000 calories
    // Perfect score at 1800-2000 cal, decreasing below 1500 and above 2200
    const caloriesScore = (() => {
      if (data.caloriesConsumed >= 1800 && data.caloriesConsumed <= 2000) return 40;
      if (data.caloriesConsumed < 1500) return Math.max(0, (data.caloriesConsumed / 1500) * 40);
      if (data.caloriesConsumed > 2000) return Math.max(0, 40 - ((data.caloriesConsumed - 2000) / 500) * 40);
      // Between 1500-1800: gradual increase to 40
      return ((data.caloriesConsumed - 1500) / 300) * 40;
    })();
    
    // Protein Score (30% of total) - Target: 140g+ 
    // Perfect score at 140g+, proportional below that
    const proteinScore = Math.min(30, (data.protein / 140) * 30);
    
    // Calories Burned Score (30% of total) - Target: 500+ calories
    // Perfect score at 500+, proportional below that
    const burnedScore = Math.min(30, (data.caloriesBurned / 500) * 30);
    
    score = caloriesScore + proteinScore + burnedScore;
    return Math.min(Math.round(score), 100);
  };

  const healthScore = calculateHealthScore();

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg group ${
        hasData 
          ? "bg-gradient-to-br from-blue-50 to-green-50 border-blue-200 hover:shadow-blue-100" 
          : "bg-gray-50 border-gray-200 hover:shadow-gray-100"
      } ${isToday ? "ring-2 ring-purple-500" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Date Header */}
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium text-gray-600">
              {new Date(date).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
            {isToday && (
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full font-medium">
                Today
              </span>
            )}
          </div>

          {hasData ? (
            <>
              {/* Health Score with progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <Heart className="h-4 w-4 text-red-500" />
                    <span className="text-lg font-bold text-gray-800">
                      {healthScore}%
                    </span>
                    <span className="text-sm text-gray-500">health</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${healthScore}%` }}
                  />
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-green-600">{Math.round(data.caloriesConsumed)}</div>
                  <div className="text-gray-500">Cal In</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-orange-600">{Math.round(data.caloriesBurned)}</div>
                  <div className="text-gray-500">Cal Out</div>
                </div>
              </div>

              {/* Additional metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{Math.round(data.protein)}g</div>
                  <div className="text-gray-500">Protein</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-red-600">{data.heartRate ? Math.round(data.heartRate) : '-'}</div>
                  <div className="text-gray-500">HR</div>
                </div>
              </div>

              {/* Activity types */}
              {data.activityTypes.length > 0 && (
                <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                  <Activity className="h-3 w-3" />
                  <span>{data.activityTypes.join(', ')}</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-gray-400 text-sm mb-1">No data</div>
              <div className="text-xs text-gray-400">Rest day</div>
              <Heart className="h-6 w-6 mx-auto mt-2 text-gray-300 group-hover:text-purple-500 transition-colors" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const OverallJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [combinedData, setCombinedData] = useState([]);
  const [last7DaysData, setLast7DaysData] = useState({});
  const [latestBloodMarkers, setLatestBloodMarkers] = useState(null);

  // Fetch combined data from Firebase - FIXED with proper activity calories
  const fetchCombinedData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      if (forceRefresh) {
        setRefreshing(true);
      }

      // Get the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateString = sevenDaysAgo.toISOString().split('T')[0];

      // Initialize data structure for 7 days
      const tempData = {};
      const tempDailyData = {};
      
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayData = {
          date: dateStr,
          heartRate: null,
          caloriesBurned: 0,
          caloriesConsumed: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          workoutDuration: 0,
          activityTypes: []
        };
        
        tempData[dateStr] = dayData;
        tempDailyData[dateStr] = dayData;
      }

      console.log(`🔄 Fetching 7-day health data (forceRefresh: ${forceRefresh})...`);

      // Fetch all data in parallel using Promise.all
      const [nutritionSnapshot, stravaSnapshot, bloodMarkersSnapshot] = await Promise.all([
        // Fetch nutrition data from nutritionLogs collection
        getDocs(query(
          collection(db, "nutritionLogs"),
          where("date", ">=", dateString),
          orderBy("date", "desc")
        )).catch(error => {
          console.warn("Could not fetch nutrition data from nutritionLogs:", error);
          return { docs: [] };
        }),
        
        // Fetch Strava data
        getDocs(query(
          collection(db, "strava_data"),
          where("userId", "==", "mihir_jain"),
          orderBy("start_date", "desc"),
          limit(20)
        )).catch(error => {
          console.warn("Could not fetch Strava data:", error);
          return { docs: [] };
        }),
        
        // Fetch latest blood markers
        getDocs(query(
          collection(db, "blood_markers"),
          where("userId", "==", "mihir_jain"),
          orderBy("date", "desc"),
          limit(1)
        )).catch(error => {
          console.warn("Could not fetch blood markers:", error);
          return { docs: [] };
        })
      ]);

      console.log(
        '⚡ nutrition docs →', nutritionSnapshot.docs.length,
        'strava docs →', stravaSnapshot.docs.length,
        'blood docs →', bloodMarkersSnapshot.docs.length
      );

      // Process nutrition data
      nutritionSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`📊 Processing nutrition data for ${data.date}:`, data);
        
        if (tempData[data.date]) {
          tempData[data.date].caloriesConsumed = data.totals?.calories || 0;
          tempData[data.date].protein = data.totals?.protein || 0;
          tempData[data.date].carbs = data.totals?.carbs || 0;
          tempData[data.date].fat = data.totals?.fat || 0;
          tempData[data.date].fiber = data.totals?.fiber || 0;
          
          console.log(`✅ Updated nutrition for ${data.date}:`, {
            calories: data.totals?.calories,
            protein: data.totals?.protein
          });
        }
      });

      // Process Strava data - FIXED: Use proper calories field from activity data
      stravaSnapshot.docs.forEach(doc => {
        const data = doc.data();
        
        const activityDate = data.date || (data.start_date ? data.start_date.substring(0, 10) : undefined);
        
        if (!activityDate || !tempData[activityDate]) return;

        // Heart rate (average across multiple activities)
        if (data.heart_rate != null) {
          const curHR = tempData[activityDate].heartRate || 0;
          const cnt = tempData[activityDate].activityTypes.length;
          tempData[activityDate].heartRate = cnt === 0 ? data.heart_rate : ((curHR * cnt) + data.heart_rate) / (cnt + 1);
        }

        // FIXED: Use the correct calories field from Strava activity data
        const activityCalories = data.calories || data.activity?.calories || data.kilojoules_to_calories || 0;
        tempData[activityDate].caloriesBurned += activityCalories;
        tempData[activityDate].workoutDuration += data.duration || 0;

        console.log(`🔥 Activity calories for ${activityDate}: ${activityCalories} (type: ${data.type})`);

        // Activity type list
        if (data.type && !tempData[activityDate].activityTypes.includes(data.type)) {
          tempData[activityDate].activityTypes.push(data.type);
        }
      });

      // Process blood markers
      if (bloodMarkersSnapshot.docs.length > 0) {
        const latestDoc = bloodMarkersSnapshot.docs[0];
        setLatestBloodMarkers(latestDoc.data());
      }

      // Convert to array and sort by date
      const sortedData = Object.values(tempData).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setCombinedData(sortedData);
      setLast7DaysData(tempDailyData);
      
      // Update last refresh time
      setLastUpdate(new Date().toLocaleTimeString());

      // Render chart after data is loaded
      setTimeout(() => {
        renderCombinedChart(sortedData);
      }, 100);

    } catch (error) {
      console.error("Error fetching combined data:", error);
      setCombinedData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Add manual refresh function
  const handleRefresh = async () => {
    await fetchCombinedData(true);
  };

  // FIXED: Enhanced chart rendering with better Y-axis scaling for protein variability
  const renderCombinedChart = (data) => {
    const container = document.getElementById('combined-health-chart');
    if (!container) return;

    let canvas = container.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      container.appendChild(canvas);
    } else {
      const chartInstance = Chart.getChart(canvas);
      if (chartInstance) {
        chartInstance.destroy();
      }
    }

    const dateLabels = data.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    });

    // Calculate data ranges for better scaling
    const proteinData = data.map(d => d.protein).filter(p => p > 0);
    const caloriesConsumedData = data.map(d => d.caloriesConsumed).filter(c => c > 0);
    const caloriesBurnedData = data.map(d => d.caloriesBurned).filter(c => c > 0);
    const heartRateData = data.map(d => d.heartRate).filter(hr => hr !== null && hr > 0);

    // Calculate separate Y-axis scales for better visibility
    const proteinMin = proteinData.length > 0 ? Math.min(...proteinData) : 0;
    const proteinMax = proteinData.length > 0 ? Math.max(...proteinData) : 100;
    const proteinRange = proteinMax - proteinMin;
    const proteinPadding = Math.max(5, proteinRange * 0.1); // At least 5g padding

    const caloriesMin = Math.min(...caloriesConsumedData, ...caloriesBurnedData);
    const caloriesMax = Math.max(...caloriesConsumedData, ...caloriesBurnedData);
    const caloriesRange = caloriesMax - caloriesMin;
    const caloriesPadding = Math.max(50, caloriesRange * 0.1); // At least 50 cal padding

    new Chart(canvas, {
      type: 'line',
      data: {
        labels: dateLabels,
        datasets: [
          {
            label: 'Calories Consumed',
            data: data.map(d => d.caloriesConsumed),
            borderColor: 'rgba(16, 185, 129, 0.8)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8,
            yAxisID: 'y-calories'
          },
          {
            label: 'Calories Burned',
            data: data.map(d => d.caloriesBurned),
            borderColor: 'rgba(245, 158, 11, 0.8)',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8,
            yAxisID: 'y-calories'
          },
          {
            label: 'Protein (g)',
            data: data.map(d => d.protein),
            borderColor: 'rgba(139, 92, 246, 0.8)',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8,
            yAxisID: 'y-protein'
          },
          {
            label: 'Heart Rate (bpm)',
            data: data.map(d => d.heartRate),
            borderColor: 'rgba(239, 68, 68, 0.8)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8,
            hidden: true, // Hidden by default
            yAxisID: 'y-heartrate'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: { size: 12 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#334155',
            bodyColor: '#334155',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            usePointStyle: true,
            callbacks: {
              title: function(context) {
                const dateIndex = context[0]?.dataIndex;
                if (dateIndex !== undefined && data[dateIndex]) {
                  const dateStr = data[dateIndex].date;
                  const activityTypes = data[dateIndex].activityTypes;
                  let title = new Date(dateStr).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  if (activityTypes.length > 0) {
                    title += ` (${activityTypes.join(', ')})`;
                  }
                  return title;
                }
                return '';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: 0,
              font: { size: 11 }
            }
          },
          // FIXED: Separate Y-axes for different data types
          'y-calories': {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: 'rgba(226, 232, 240, 0.3)' },
            min: Math.max(0, caloriesMin - caloriesPadding),
            max: caloriesMax + caloriesPadding,
            ticks: { 
              font: { size: 11 },
              stepSize: Math.max(50, Math.round(caloriesRange / 6)),
              callback: function(value) {
                return Math.round(value) + ' cal';
              }
            },
            title: {
              display: true,
              text: 'Calories',
              font: { size: 12, weight: 'bold' },
              color: 'rgba(16, 185, 129, 0.8)'
            }
          },
          'y-protein': {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { display: false }, // Hide grid for secondary axis
            min: Math.max(0, proteinMin - proteinPadding),
            max: proteinMax + proteinPadding,
            ticks: { 
              font: { size: 11 },
              stepSize: Math.max(2, Math.round(proteinRange / 8)), // More granular steps for protein
              callback: function(value) {
                return Math.round(value) + 'g';
              }
            },
            title: {
              display: true,
              text: 'Protein (g)',
              font: { size: 12, weight: 'bold' },
              color: 'rgba(139, 92, 246, 0.8)'
            }
          },
          'y-heartrate': {
            type: 'linear',
            display: false, // Hidden since heart rate is hidden by default
            position: 'right',
            min: heartRateData.length > 0 ? Math.min(...heartRateData) - 10 : 60,
            max: heartRateData.length > 0 ? Math.max(...heartRateData) + 10 : 180,
            ticks: { 
              font: { size: 11 },
              callback: function(value) {
                return Math.round(value) + ' bpm';
              }
            }
          }
        }
      }
    });
  };

  // Calculate averages from actual data
  const calculateAvgMetric = (metric) => {
    const validData = combinedData.filter(d => d[metric] !== null && d[metric] > 0);
    if (validData.length === 0) return 0;
    const sum = validData.reduce((total, d) => total + (d[metric] || 0), 0);
    return Math.round(sum / validData.length);
  };

  // Generate last 7 days dates for the daily boxes
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  // Fetch data on component mount
  useEffect(() => {
    fetchCombinedData(false);
  }, []);

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
            Mihir's Overall Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your complete health overview for the last 7 days
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
        
        {/* 7-Day Health Overview */}
        <section className="mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                Last 7 Days Health Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                {last7Days.map((date) => (
                  <DailyHealthBox
                    key={date}
                    data={last7DaysData[date] || {}}
                    date={date}
                    isToday={date === new Date().toISOString().split('T')[0]}
                    onClick={() => {
                      // Could navigate to detailed view for that day
                      console.log(`Clicked on ${date}`);
                    }}
                  />
                ))}
              </div>
              
              {/* Health Score Explanation Footer */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Health Score Calculation (100 points total)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600">
                  <div className="space-y-1">
                    <div className="font-medium text-green-600">Calories Consumed (40 pts)</div>
                    <div>🎯 Target: 1800-2000 cal = 40 pts</div>
                    <div>📉 Below/Above: Proportional scoring</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium text-purple-600">Protein Intake (30 pts)</div>
                    <div>🎯 Target: 140g+ = 30 pts</div>
                    <div>📈 Below: (protein/140) × 30</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium text-orange-600">Calories Burned (30 pts)</div>
                    <div>🎯 Target: 500+ cal = 30 pts</div>
                    <div>📈 Below: (burned/500) × 30</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 border-t pt-2">
                  <strong>Perfect Day Example:</strong> 1900 cal consumed + 140g protein + 550 cal burned = 100 points 🎉
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Summary Stats Section */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            Weekly Averages
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Calories Consumed Card */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center">
                  <Utensils className="mr-2 h-4 w-4 text-green-500" />
                  Avg Calories In
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold text-green-600">
                    {calculateAvgMetric('caloriesConsumed')}/day
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Calories Burned Card */}
            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center">
                  <Flame className="mr-2 h-4 w-4 text-amber-500" />
                  Avg Calories Out
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold text-amber-600">
                    {calculateAvgMetric('caloriesBurned')}/day
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Protein Card */}
            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center">
                  <Target className="mr-2 h-4 w-4 text-violet-500" />
                  Avg Protein
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold text-violet-600">
                    {calculateAvgMetric('protein')}g/day
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Heart Rate Card */}
            <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center">
                  <Heart className="mr-2 h-4 w-4 text-red-500" />
                  Avg Heart Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold text-red-600">
                    {calculateAvgMetric('heartRate') || '-'} {calculateAvgMetric('heartRate') ? 'bpm' : ''}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Combined Chart Section */}
        <section className="mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Health Trends (Last 7 Days)
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Track your key health metrics over the past week. Toggle datasets using the legend.
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-80 flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <div className="h-80" id="combined-health-chart">
                  {/* Chart will be rendered here */}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Latest Blood Markers Section */}
        {latestBloodMarkers && (
          <section className="mb-8">
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplet className="h-5 w-5 text-blue-500" />
                  Latest Blood Markers
                </CardTitle>
                <p className="text-sm text-gray-600">
                  As of {new Date(latestBloodMarkers.date).toLocaleDateString()}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {Object.entries(latestBloodMarkers.markers).map(([key, value]) => (
                    <div key={key} className="text-center bg-white/50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{key}</p>
                      <p className="text-xl font-semibold text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Action Buttons */}
        <section className="mb-8 flex justify-center gap-4">
          <Button
            onClick={() => navigate('/activity-jam')}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-6 py-3"
          >
            <Activity className="mr-2 h-5 w-5" />
            View Fitness Details
          </Button>
          <Button
            onClick={() => navigate('/nutrition-jam')}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3"
          >
            <Utensils className="mr-2 h-5 w-5" />
            View Nutrition Details
          </Button>
        </section>
      </main>

      {/* Enhanced Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>Comprehensive health data from the last 7 days</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              Your health, tracked intelligently
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Last updated: {new Date().toLocaleDateString()}</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs">Live</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default OverallJam;
