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
  heartRateRuns: number | null; // Only from runs
  caloriesBurned: number; // From Strava calories field
  caloriesConsumed: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  workoutDuration: number;
  activityTypes: string[];
  runCount: number; // Track number of runs for proper averaging
}

// Daily Health Box Component with updated Health Score (Calorie Deficit + Protein)
const DailyHealthBox = ({ data, date, isToday, onClick }) => {
  const hasData = data.caloriesConsumed > 0 || data.caloriesBurned > 0 || data.heartRateRuns > 0;
  
  // Calculate calorie deficit: calories burned + BMR - calories consumed
  const BMR = 1479;
  const calorieDeficit = data.caloriesBurned + BMR - data.caloriesConsumed;
  
  // Calculate health score based on calories burned, protein, and calorie deficit
  const calculateHealthScore = () => {
    let score = 0;
    
    // Calories Burned Score (40% of total) - Target: 300+ calories burned
    const burnedScore = Math.min(40, (data.caloriesBurned / 300) * 40);
    
    // Protein Score (30% of total) - Target: 140g+ 
    const proteinScore = Math.min(30, (data.protein / 140) * 30);
    
    // Calorie Deficit Score (30% of total) - Progressive scoring
    const deficitScore = (() => {
      if (calorieDeficit <= 0) return 0;
      if (calorieDeficit >= 500) return 30;
      if (calorieDeficit >= 400) return 25;
      if (calorieDeficit >= 300) return 20;
      if (calorieDeficit >= 200) return 15;
      if (calorieDeficit >= 100) return 10;
      return 5; // 1-99 calorie deficit gets 5 points
    })();
    
    score = burnedScore + proteinScore + deficitScore;
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
                    <span className="text-base font-bold text-gray-800">
                      {healthScore}%
                    </span>
                    <span className="text-xs text-gray-500">health</span>
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
                  <div className={`font-semibold ${calorieDeficit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {calorieDeficit >= 0 ? '+' : ''}{Math.round(calorieDeficit)}
                  </div>
                  <div className="text-gray-500">Cal Deficit</div>
                </div>
              </div>

              {/* Heart Rate for Runs Only */}
              {data.heartRateRuns && (
                <div className="text-center text-xs">
                  <div className="font-semibold text-red-600 flex items-center justify-center gap-1">
                    <Heart className="h-3 w-3" />
                    {Math.round(data.heartRateRuns)} bpm
                  </div>
                  <div className="text-gray-500">Run HR Avg</div>
                </div>
              )}

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

  // Fetch combined data from Firebase - UPDATED with proper run-only HR and Strava calories
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
          heartRateRuns: null, // Only from runs
          caloriesBurned: 0, // From Strava calories field
          caloriesConsumed: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          workoutDuration: 0,
          activityTypes: [],
          runCount: 0 // Track runs for proper HR averaging
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

      // Process Strava data - UPDATED: HR only from runs, use actual Strava calories
      stravaSnapshot.docs.forEach(doc => {
        const data = doc.data();
        
        const activityDate = data.date || (data.start_date ? data.start_date.substring(0, 10) : undefined);
        
        if (!activityDate || !tempData[activityDate]) return;

        // Heart rate ONLY from runs (not weight training or other activities)
        const isRunActivity = data.type && (
          data.type.toLowerCase().includes('run') || 
          data.type === 'Run' || 
          data.type === 'VirtualRun'
        );
        
        if (isRunActivity && data.heart_rate != null) {
          const currentHR = tempData[activityDate].heartRateRuns || 0;
          const currentRunCount = tempData[activityDate].runCount;
          
          // Calculate weighted average for multiple runs in a day
          tempData[activityDate].heartRateRuns = currentRunCount === 0 
            ? data.heart_rate 
            : ((currentHR * currentRunCount) + data.heart_rate) / (currentRunCount + 1);
          
          tempData[activityDate].runCount += 1;
          
          console.log(`💓 Run HR for ${activityDate}: ${data.heart_rate} bpm (type: ${data.type})`);
        } else if (data.heart_rate != null) {
          console.log(`⏭️ Skipping HR for non-run activity: ${data.type} on ${activityDate}`);
        }

        // Use actual Strava calories field (not estimated)
        const stravaCalories = data.calories || 0; // Direct from Strava API
        tempData[activityDate].caloriesBurned += stravaCalories;
        tempData[activityDate].workoutDuration += data.duration || 0;

        console.log(`🔥 Strava calories for ${activityDate}: ${stravaCalories} (type: ${data.type})`);

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

  // UPDATED: Enhanced chart rendering with run-only heart rate
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

    // Calculate calorie deficit for each day
    const BMR = 1479;
    const calorieDeficitData = data.map(d => d.caloriesBurned + BMR - d.caloriesConsumed);

    // Calculate data ranges for better scaling
    const proteinData = data.map(d => d.protein).filter(p => p > 0);
    const caloriesConsumedData = data.map(d => d.caloriesConsumed).filter(c => c > 0);
    const caloriesBurnedData = data.map(d => d.caloriesBurned).filter(c => c > 0);
    const heartRateRunsData = data.map(d => d.heartRateRuns).filter(hr => hr !== null && hr > 0);

    // Calculate separate Y-axis scales for better visibility
    const proteinMin = proteinData.length > 0 ? Math.min(...proteinData) : 0;
    const proteinMax = proteinData.length > 0 ? Math.max(...proteinData) : 100;
    const proteinRange = proteinMax - proteinMin;
    const proteinPadding = Math.max(5, proteinRange * 0.1);

    const caloriesMin = Math.min(...caloriesConsumedData, ...caloriesBurnedData);
    const caloriesMax = Math.max(...caloriesConsumedData, ...caloriesBurnedData);
    const caloriesRange = caloriesMax - caloriesMin;
    const caloriesPadding = Math.max(50, caloriesRange * 0.1);

    const deficitMin = Math.min(...calorieDeficitData);
    const deficitMax = Math.max(...calorieDeficitData);
    const deficitRange = deficitMax - deficitMin;
    const deficitPadding = Math.max(100, deficitRange * 0.1);

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
            label: 'Calories Burned (Strava)',
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
            label: 'Calorie Deficit',
            data: calorieDeficitData,
            borderColor: 'rgba(34, 197, 94, 0.8)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8,
            yAxisID: 'y-deficit'
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
            label: 'Run Heart Rate (bpm)',
            data: data.map(d => d.heartRateRuns),
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
                  const runCount = data[dateIndex].runCount;
                  let title = new Date(dateStr).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  if (activityTypes.length > 0) {
                    title += ` (${activityTypes.join(', ')})`;
                  }
                  if (runCount > 0) {
                    title += ` - ${runCount} run${runCount > 1 ? 's' : ''}`;
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
          'y-deficit': {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { display: false },
            min: deficitMin - deficitPadding,
            max: deficitMax + deficitPadding,
            ticks: { 
              font: { size: 11 },
              stepSize: Math.max(100, Math.round(deficitRange / 6)),
              callback: function(value) {
                return (value >= 0 ? '+' : '') + Math.round(value) + ' cal';
              }
            },
            title: {
              display: true,
              text: 'Calorie Deficit',
              font: { size: 12, weight: 'bold' },
              color: 'rgba(34, 197, 94, 0.8)'
            }
          },
          'y-protein': {
            type: 'linear',
            display: false,
            position: 'right',
            grid: { display: false },
            min: Math.max(0, proteinMin - proteinPadding),
            max: proteinMax + proteinPadding,
            ticks: { 
              font: { size: 11 },
              stepSize: Math.max(2, Math.round(proteinRange / 8)),
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
            display: false,
            position: 'right',
            min: heartRateRunsData.length > 0 ? Math.min(...heartRateRunsData) - 10 : 60,
            max: heartRateRunsData.length > 0 ? Math.max(...heartRateRunsData) + 10 : 180,
            ticks: { 
              font: { size: 11 },
              callback: function(value) {
                return Math.round(value) + ' bpm';
              }
            },
            title: {
              display: true,
              text: 'Run Heart Rate (bpm)',
              font: { size: 12, weight: 'bold' },
              color: 'rgba(239, 68, 68, 0.8)'
            }
          }
        }
      }
    });
  };

  // Calculate averages from actual data - UPDATED for run-only HR
  const calculateAvgMetric = (metric) => {
    if (metric === 'heartRateRuns') {
      const validData = combinedData.filter(d => d.heartRateRuns !== null && d.heartRateRuns > 0);
      if (validData.length === 0) return 0;
      const sum = validData.reduce((total, d) => total + (d.heartRateRuns || 0), 0);
      return Math.round(sum / validData.length);
    }
    
    const validData = combinedData.filter(d => d[metric] !== null && d[metric] > 0);
    if (validData.length === 0) return 0;
    const sum = validData.reduce((total, d) => total + (d[metric] || 0), 0);
    return Math.round(sum / validData.length);
  };

  // Calculate average calorie deficit
  const calculateAvgCalorieDeficit = () => {
    const BMR = 1479;
    const validData = combinedData.filter(d => d.caloriesConsumed > 0 || d.caloriesBurned > 0);
    if (validData.length === 0) return 0;
    const sum = validData.reduce((total, d) => total + (d.caloriesBurned + BMR - d.caloriesConsumed), 0);
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
              Last updated: {lastUpdate} • Heart rate from runs only • Calories from Strava
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
                <Badge variant="secondary" className="ml-2 text-xs">
                  HR: Runs Only | Cal: Strava Direct
                </Badge>
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
                    <div className="font-medium text-orange-600">Calories Burned (40 pts)</div>
                    <div>🎯 Target: 300+ cal = 40 pts</div>
                    <div>📈 Below: (burned/300) × 40</div>
                    <div className="text-blue-600">✅ Uses actual Strava calories</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium text-purple-600">Protein Intake (30 pts)</div>
                    <div>🎯 Target: 140g+ = 30 pts</div>
                    <div>📈 Below: (protein/140) × 30</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium text-green-600">Calorie Deficit (30 pts)</div>
                    <div>🎯 Progressive scoring:</div>
                    <div>• 0 cal = 0 pts</div>
                    <div>• 1-99 cal = 5 pts</div>
                    <div>• 100+ cal = 10 pts</div>
                    <div>• 200+ cal = 15 pts</div>
                    <div>• 300+ cal = 20 pts</div>
                    <div>• 400+ cal = 25 pts</div>
                    <div>• 500+ cal = 30 pts</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 border-t pt-2">
                  <strong>BMR (Basal Metabolic Rate):</strong> 1479 calories/day
                  <br />
                  <strong>Heart Rate Data:</strong> Only from running activities (excludes weight training, cycling, etc.)
                  <br />
                  <strong>Calorie Data:</strong> Direct from Strava API (not estimated)
                  <br />
                  <strong>Deficit Formula:</strong> (Strava Calories Burned + 1479 BMR) - Calories Consumed
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Weekly Averages Section - Updated with run-specific HR */}
        <section className="mb-8">
          <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Weekly Averages
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            
            {/* Calories In Card */}
            <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Calories In</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <Utensils className="h-5 w-5 text-gray-700" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-gray-800">{calculateAvgMetric('caloriesConsumed')}</p>
                <p className="text-sm text-gray-700">cal/day</p>
              </div>
            </div>

            {/* Calories Out Card */}
            <div className="bg-gradient-to-br from-amber-200 to-orange-300 rounded-xl p-6 text-gray-800 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Calories Out</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <Flame className="h-5 w-5 text-gray-700" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-gray-800">{calculateAvgMetric('caloriesBurned')}</p>
                <p className="text-sm text-gray-700">cal/day</p>
                <p className="text-xs text-gray-600">From Strava</p>
              </div>
            </div>

            {/* Protein Card */}
            <div className="bg-gradient-to-br from-purple-200 to-violet-300 rounded-xl p-6 text-gray-800 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Protein</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5 text-gray-700" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-gray-800">{calculateAvgMetric('protein')}</p>
                <p className="text-sm text-gray-700">g/day</p>
              </div>
            </div>

            {/* Calorie Deficit Card */}
            <div className="bg-gradient-to-br from-emerald-200 to-blue-300 rounded-xl p-6 text-gray-800 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Cal Deficit</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-gray-700" />
                </div>
              </div>
              <div className="space-y-2">
                <p className={`text-3xl font-bold ${calculateAvgCalorieDeficit() >= 0 ? 'text-gray-800' : 'text-red-700'}`}>
                  {calculateAvgCalorieDeficit() >= 0 ? '+' : ''}{calculateAvgCalorieDeficit()}
                </p>
                <p className="text-sm text-gray-700">cal/day</p>
              </div>
            </div>

            {/* Run Heart Rate Card - NEW */}
            <div className="bg-gradient-to-br from-red-200 to-pink-300 rounded-xl p-6 text-gray-800 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Run HR</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <Heart className="h-5 w-5 text-gray-700" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-gray-800">
                  {calculateAvgMetric('heartRateRuns') || '--'}
                </p>
                <p className="text-sm text-gray-700">bpm avg</p>
                <p className="text-xs text-gray-600">Runs only</p>
              </div>
            </div>
          </div>
        </section>

        {/* Combined Chart Section */}
        <section className="mb-8">
          <Card className="bg-gradient-to-r from-indigo-200 to-purple-300 rounded-2xl p-6 text-gray-800 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-semibold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gray-700" />
                Health Trends (Last 7 Days)
                <Badge variant="secondary" className="ml-2 text-xs">
                  Updated Data Sources
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-700 mt-2">
                Track your key health metrics with accurate data: HR from runs only, calories direct from Strava.
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-80 flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <div className="h-80 bg-white/30 backdrop-blur-sm rounded-lg p-4" id="combined-health-chart">
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
          <Button
            onClick={() => navigate('/lets-jam')}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6 py-3"
          >
            <Heart className="mr-2 h-5 w-5" />
            AI Health Coach
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
              <Heart className="h-4 w-4 text-red-500" />
              HR: Runs only
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Flame className="h-4 w-4 text-orange-500" />
              Cal: Strava direct
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
