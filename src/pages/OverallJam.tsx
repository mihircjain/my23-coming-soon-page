import { useState, useEffect } from "react";
import { ArrowLeft, Activity, Heart, Flame, Utensils, Droplet, Apple, Wheat, Drumstick, Leaf, RefreshCw, BarChart3, Target, TrendingUp, Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import Chart from 'chart.js/auto';

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

// Weekly Goals Tracker Component - Updated with green/blue theme
const WeeklyGoalsTracker: React.FC<{
  weekData: Record<string, CombinedData>;
  loading: boolean;
}> = ({ weekData, loading }) => {
  // Calculate weekly totals
  const calculateWeeklyTotals = () => {
    const totals = {
      caloriesBurned: 0,
      protein: 0,
      calorieDeficit: 0,
      activeDays: 0
    };

    const BMR = 1479;
    
    Object.values(weekData).forEach((day: CombinedData) => {
      totals.caloriesBurned += day.caloriesBurned || 0;
      totals.protein += day.protein || 0;
      
      const dailyDeficit = (day.caloriesBurned + BMR) - day.caloriesConsumed;
      totals.calorieDeficit += dailyDeficit;
      
      if (day.caloriesBurned > 0 || day.caloriesConsumed > 0) {
        totals.activeDays += 1;
      }
    });

    return totals;
  };

  const weeklyTotals = calculateWeeklyTotals();

  // Weekly Goals - Updated with green/blue theme
  const goals = {
    caloriesBurned: { target: 3500, label: "Calories Burned", icon: Flame, color: "green", shortLabel: "Cal Burn" },
    protein: { target: 980, label: "Protein (140g×7)", icon: Utensils, color: "blue", shortLabel: "Protein" },
    calorieDeficit: { target: 1000, label: "Calorie Deficit", icon: Target, color: "teal", shortLabel: "Cal Deficit" }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 75) return "bg-teal-500";
    if (percentage >= 50) return "bg-cyan-500";
    return "bg-blue-500";
  };

  const getWeeklyRating = () => {
    const scores = Object.keys(goals).map(key => {
      const goal = goals[key as keyof typeof goals];
      const actual = weeklyTotals[key as keyof typeof weeklyTotals];
      return Math.min((actual / goal.target) * 100, 100);
    });
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    if (avgScore >= 90) return { rating: "🏆 CHAMPION", color: "text-green-600" };
    if (avgScore >= 75) return { rating: "🔥 STRONG", color: "text-teal-600" };
    if (avgScore >= 50) return { rating: "💪 BUILDING", color: "text-blue-600" };
    return { rating: "🌱 STARTING", color: "text-emerald-600" };
  };

  const weeklyRating = getWeeklyRating();

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-green-200 to-blue-200 rounded-xl shadow-lg">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-white/30 rounded w-1/2 mx-auto"></div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-white/30 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-green-200 to-blue-200 rounded-xl shadow-lg">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl font-bold bg-gradient-to-r from-green-700 to-blue-700 bg-clip-text text-transparent">
          📊 Weekly Goals
        </CardTitle>
        <div className={`text-lg font-bold ${weeklyRating.color}`}>
          {weeklyRating.rating}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Compact Goal Widgets */}
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(goals).map(([key, goal]) => {
            const actual = weeklyTotals[key as keyof typeof weeklyTotals];
            const percentage = Math.min((actual / goal.target) * 100, 100);
            const IconComponent = goal.icon;
            
            return (
              <div key={key} className="bg-white/60 rounded-lg p-3 border border-white/30 text-center">
                <div className="flex items-center justify-center mb-2">
                  <IconComponent className={`h-4 w-4 text-${goal.color}-600`} />
                </div>
                
                <div className="text-xs font-semibold text-gray-700 mb-1">
                  {goal.shortLabel}
                </div>
                
                <div className="text-sm font-bold text-gray-800 mb-2">
                  {Math.round(actual).toLocaleString()}
                  {key === 'protein' ? 'g' : ' cal'}
                  <span className="text-xs text-gray-600">
                    /{goal.target.toLocaleString()}{key === 'protein' ? 'g' : ' cal'}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(percentage)}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                
                <div className={`text-xs font-semibold ${percentage >= 100 ? 'text-green-600' : percentage >= 75 ? 'text-teal-600' : 'text-blue-600'}`}>
                  {Math.round(percentage)}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Compact Daily Breakdown - Updated with green/blue theme */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-700 text-center">This Week</h4>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - (6 - i));
              const dateStr = date.toISOString().split('T')[0];
              const dayData = weekData[dateStr] || {};
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              
              const BMR = 1479;
              const dailyDeficit = ((dayData.caloriesBurned || 0) + BMR) - (dayData.caloriesConsumed || 0);
              const protein = dayData.protein || 0;
              const burned = dayData.caloriesBurned || 0;
              
              return (
                <div 
                  key={dateStr}
                  className={`p-1 rounded text-center text-xs border ${
                    isToday ? 'border-green-500 bg-white/80' : 'border-white/30 bg-white/60'
                  }`}
                >
                  <div className="font-semibold text-gray-600 text-xs mb-1">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  
                  {/* Protein */}
                  <div className="text-xs text-blue-600 font-medium">
                    P: {Math.round(protein)}g
                  </div>
                  
                  {/* Calories Burned */}
                  <div className="text-xs text-green-600 font-medium">
                    Cal Burn: {Math.round(burned)}
                  </div>
                  
                  {/* Deficit */}
                  <div className={`text-xs font-semibold ${dailyDeficit >= 0 ? 'text-teal-600' : 'text-cyan-600'}`}>
                    Cal Deficit: {dailyDeficit >= 0 ? '+' : ''}{Math.round(dailyDeficit)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-600 text-center">
            P: Protein (g) • Cal Burn: Burned (cal) • Cal Deficit: Deficit (cal)
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Daily Health Box Component - Updated with green/blue theme
const DailyHealthBox = ({ data, date, isToday, onClick }) => {
  const hasData = data.caloriesConsumed > 0 || data.caloriesBurned > 0 || data.heartRateRuns > 0;
  
  // Calculate calorie deficit: calories burned + BMR - calories consumed
  const BMR = 1479;
  const calorieDeficit = data.caloriesBurned + BMR - data.caloriesConsumed;

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg group ${
        hasData 
          ? "bg-gradient-to-br from-green-50 to-blue-50 border-green-200 hover:shadow-green-100" 
          : "bg-gray-50 border-gray-200 hover:shadow-gray-100"
      } ${isToday ? "ring-2 ring-green-500" : ""}`}
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
              <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full font-medium">
                Today
              </span>
            )}
          </div>

          {hasData ? (
            <>
              {/* Key Metrics - Updated with green/blue theme */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-emerald-600">{Math.round(data.caloriesConsumed)}</div>
                  <div className="text-gray-500">Cal In</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-green-600">{Math.round(data.caloriesBurned)}</div>
                  <div className="text-gray-500">Cal Out</div>
                </div>
              </div>

              {/* Additional metrics - Updated with green/blue theme */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{Math.round(data.protein)}g</div>
                  <div className="text-gray-500">Protein</div>
                </div>
                <div className="text-center">
                  <div className={`font-semibold ${calorieDeficit >= 0 ? 'text-teal-600' : 'text-cyan-600'}`}>
                    {calorieDeficit >= 0 ? '+' : ''}{Math.round(calorieDeficit)}
                  </div>
                  <div className="text-gray-500">Cal Deficit</div>
                </div>
              </div>

              {/* Heart Rate for Runs Only - Updated with green/blue theme */}
              {data.heartRateRuns && (
                <div className="text-center text-xs">
                  <div className="font-semibold text-teal-600 flex items-center justify-center gap-1">
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
              <Heart className="h-6 w-6 mx-auto mt-2 text-gray-300 group-hover:text-teal-500 transition-colors" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const OverallJam = () => {
  // const navigate = useNavigate();
  const navigate = (path: string) => console.log(`Navigate to ${path}`);
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

      // Simulated data processing - replace with actual Firebase calls
      console.log('📊 Processed sample nutrition and Strava data');
      
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

  // UPDATED: Enhanced chart rendering with run-only heart rate and green/blue theme
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
            borderColor: 'rgba(34, 197, 94, 0.8)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
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
            label: 'Calorie Deficit',
            data: calorieDeficitData,
            borderColor: 'rgba(20, 184, 166, 0.8)',
            backgroundColor: 'rgba(20, 184, 166, 0.1)',
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
            borderColor: 'rgba(59, 130, 246, 0.8)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
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
            borderColor: 'rgba(6, 182, 212, 0.8)',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
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
              color: 'rgba(34, 197, 94, 0.8)'
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
              color: 'rgba(20, 184, 166, 0.8)'
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
              color: 'rgba(59, 130, 246, 0.8)'
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
              color: 'rgba(6, 182, 212, 0.8)'
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col">
      {/* Background decoration - Updated with green/blue theme */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-blue-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-green-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-blue-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>

      {/* Header - Updated with green/blue theme */}
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
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
            🩺 Mihir's Overall Jam
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
        
        {/* Weekly Goals Tracker - Same as Homepage */}
        <section className="mb-8">
          <WeeklyGoalsTracker weekData={last7DaysData} loading={loading} />
        </section>

         {/* 7-Day Health Overview - Updated with green/blue theme */}
        <section className="mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border border-green-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-teal-500" />
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
            </CardContent>
          </Card>
        </section>

        {/* Weekly Averages Section - Updated with green/blue theme */}
        <section className="mb-8">
          <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            Weekly Averages
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            
            {/* Calories In Card - Updated with green theme */}
            <div className="bg-gradient-to-br from-emerald-400 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Calories In</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <Utensils className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-white">{calculateAvgMetric('caloriesConsumed')}</p>
                <p className="text-sm text-emerald-100">cal/day</p>
              </div>
            </div>

            {/* Calories Out Card - Updated with green theme */}
            <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Calories Out</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <Flame className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-white">{calculateAvgMetric('caloriesBurned')}</p>
                <p className="text-sm text-green-100">cal/day</p>
                <p className="text-xs text-green-200">From Strava</p>
              </div>
            </div>

            {/* Protein Card - Updated with blue theme */}
            <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Protein</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-white">{calculateAvgMetric('protein')}</p>
                <p className="text-sm text-blue-100">g/day</p>
              </div>
            </div>

            {/* Calorie Deficit Card - Updated with teal theme */}
            <div className="bg-gradient-to-br from-teal-400 to-cyan-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Cal Deficit</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <p className={`text-3xl font-bold ${calculateAvgCalorieDeficit() >= 0 ? 'text-white' : 'text-cyan-200'}`}>
                  {calculateAvgCalorieDeficit() >= 0 ? '+' : ''}{calculateAvgCalorieDeficit()}
                </p>
                <p className="text-sm text-teal-100">cal/day</p>
              </div>
            </div>

            {/* Run Heart Rate Card - Updated with cyan theme */}
            <div className="bg-gradient-to-br from-cyan-400 to-teal-500 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Run HR</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <Heart className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-white">
                  {calculateAvgMetric('heartRateRuns') || '--'}
                </p>
                <p className="text-sm text-cyan-100">bpm avg</p>
                <p className="text-xs text-cyan-200">Runs only</p>
              </div>
            </div>
          </div>
        </section>

        {/* Combined Chart Section - Updated with green/blue theme */}
        <section className="mb-8">
          <Card className="bg-gradient-to-r from-green-200 to-blue-200 rounded-2xl p-6 text-gray-800 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-semibold bg-gradient-to-r from-green-700 to-blue-700 bg-clip-text text-transparent flex items-center gap-2">
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

        {/* Latest Blood Markers Section - Updated with green/blue theme */}
        {latestBloodMarkers && (
          <section className="mb-8">
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplet className="h-5 w-5 text-teal-500" />
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

        {/* Action Buttons - Updated with green/blue theme */}
        <section className="mb-8 flex justify-center gap-4">
          <Button
            onClick={() => navigate('/activity-jam')}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3"
          >
            <Activity className="mr-2 h-5 w-5" />
            View Fitness Details
          </Button>
          <Button
            onClick={() => navigate('/nutrition-jam')}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-6 py-3"
          >
            <Utensils className="mr-2 h-5 w-5" />
            View Nutrition Details
          </Button>
          <Button
            onClick={() => navigate('/lets-jam')}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-3"
          >
            <Heart className="mr-2 h-5 w-5" />
            AI Health Coach
          </Button>
        </section>
      </main>

      {/* Enhanced Footer - Updated with green/blue theme */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>Comprehensive health data from the last 7 days</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4 text-teal-500" />
              HR: Runs only
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Flame className="h-4 w-4 text-green-500" />
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
