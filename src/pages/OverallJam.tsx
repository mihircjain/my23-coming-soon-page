import { useState, useEffect } from "react";
import { ArrowLeft, Activity, Heart, Flame, Utensils, Droplet, Apple, Wheat, Drumstick, Leaf, RefreshCw, BarChart3, Target, TrendingUp, Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import Chart from 'chart.js/auto';
import { db } from '@/lib/firebaseConfig';
import { collection, addDoc, query, where, orderBy, getDocs, limit } from 'firebase/firestore';

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

// Weekly Goals Tracker Component - Updated with surplus instead of deficit
const WeeklyGoalsTracker: React.FC<{
  weekData: Record<string, CombinedData>;
  loading: boolean;
}> = ({ weekData, loading }) => {
  // Calculate weekly totals
  const calculateWeeklyTotals = () => {
    const totals = {
      caloriesBurned: 0,
      protein: 0,
      calorieSurplus: 0,
      activeDays: 0
    };

    const BMR = 1479;
    
    Object.values(weekData).forEach((day: CombinedData) => {
      totals.caloriesBurned += day.caloriesBurned || 0;
      totals.protein += day.protein || 0;
      
      // Calorie surplus = calories consumed - (calories burned + BMR)
      const dailySurplus = day.caloriesConsumed - (day.caloriesBurned + BMR);
      totals.calorieSurplus += dailySurplus;
      
      if (day.caloriesBurned > 0 || day.caloriesConsumed > 0) {
        totals.activeDays += 1;
      }
    });

    return totals;
  };

  const weeklyTotals = calculateWeeklyTotals();

  // Weekly Goals - Updated with surplus goal (positive surplus is good)
  const goals = {
    caloriesBurned: { target: 3500, label: "Calories Burned", icon: Flame, color: "green", shortLabel: "Cal Burn" },
    protein: { target: 980, label: "Protein (140g×7)", icon: Utensils, color: "blue", shortLabel: "Protein" },
    calorieSurplus: { target: 1000, label: "Calorie Surplus (goal: positive)", icon: Target, color: "emerald", shortLabel: "Cal Surplus" }
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
            const isNegativeGoal = key === 'calorieSurplus';
            let percentage;
            
            if (isNegativeGoal) {
              // For surplus, calculate how well we're doing relative to negative goal
              percentage = (actual / goal.target) * 100;
            } else {
              percentage = Math.min((actual / goal.target) * 100, 100);
            }
            
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
                  {actual >= 0 && key === 'calorieSurplus' ? '+' : ''}{Math.round(actual).toLocaleString()}
                  {key === 'protein' ? 'g' : ' cal'}
                  <span className="text-xs text-gray-600">
                    /{goal.target < 0 ? '' : goal.target.toLocaleString()}{goal.target < 0 ? Math.abs(goal.target).toLocaleString() + ' cal' : (key === 'protein' ? 'g' : ' cal')}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(percentage, isNegativeGoal)}`}
                    style={{ width: `${Math.min(Math.abs(percentage), 100)}%` }}
                  />
                </div>
                
                <div className={`text-xs font-semibold ${
                  isNegativeGoal 
                    ? (actual <= goal.target ? 'text-green-600' : actual <= 0 ? 'text-teal-600' : 'text-red-600')
                    : (percentage >= 100 ? 'text-green-600' : percentage >= 75 ? 'text-teal-600' : 'text-blue-600')
                }`}>
                  {isNegativeGoal ? (actual <= goal.target ? '✓' : actual <= 0 ? '~' : '⚠') : `${Math.round(percentage)}%`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Compact Daily Breakdown - Updated with surplus */}
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
              const dailySurplus = (dayData.caloriesConsumed || 0) - ((dayData.caloriesBurned || 0) + BMR);
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
                  
                  {/* Surplus */}
                  <div className={`text-xs font-semibold ${dailySurplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Cal Surplus: {dailySurplus >= 0 ? '+' : ''}{Math.round(dailySurplus)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-600 text-center">
            P: Protein (g) • Cal Burn: Burned (cal) • Cal Surplus: Surplus (cal) • Positive = Good
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Daily Health Box Component - Updated with surplus
const DailyHealthBox = ({ data, date, isToday, onClick }) => {
  const hasData = data.caloriesConsumed > 0 || data.caloriesBurned > 0 || data.heartRateRuns > 0;
  
  // Calculate calorie surplus: calories consumed - (calories burned + BMR)
  const BMR = 1479;
  const calorieSurplus = data.caloriesConsumed - (data.caloriesBurned + BMR);

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
              {/* Key Metrics */}
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

              {/* Additional metrics - Updated with surplus */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{Math.round(data.protein)}g</div>
                  <div className="text-gray-500">Protein</div>
                </div>
                <div className="text-center">
                  <div className={`font-semibold ${calorieSurplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {calorieSurplus >= 0 ? '+' : ''}{Math.round(calorieSurplus)}
                  </div>
                  <div className="text-gray-500">Cal Surplus</div>
                </div>
              </div>

              {/* Heart Rate for Runs Only */}
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [combinedData, setCombinedData] = useState([]);
  const [last7DaysData, setLast7DaysData] = useState({});
  const [latestBloodMarkers, setLatestBloodMarkers] = useState(null);

  // UPDATED: Real Firebase data fetching instead of mock data
  const fetchCombinedData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      if (forceRefresh) {
        setRefreshing(true);
      }

      console.log(`🔄 Fetching 7-day health data from Firebase (forceRefresh: ${forceRefresh})...`);

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

      // Prepare Firebase queries
      const nutritionQuery = query(
        collection(db, "nutritionLogs"),
        where("date", ">=", dateString),
        orderBy("date", "desc")
      );

      const stravaQuery = query(
        collection(db, "strava_data"),
        where("userId", "==", "mihir_jain"),
        orderBy("start_date", "desc"),
        limit(50)
      );

      const bloodQuery = query(
        collection(db, "blood_markers"),
        where("userId", "==", "mihir_jain"),
        orderBy("date", "desc"),
        limit(1)
      );

      // Execute all queries
      const [nutritionSnapshot, stravaSnapshot, bloodMarkersSnapshot] = await Promise.all([
        getDocs(nutritionQuery).catch((error) => {
          console.error("Error fetching nutrition data:", error);
          return { docs: [] };
        }),
        getDocs(stravaQuery).catch((error) => {
          console.error("Error fetching Strava data:", error);
          return { docs: [] };
        }),
        getDocs(bloodQuery).catch((error) => {
          console.error("Error fetching blood markers:", error);
          return { docs: [] };
        })
      ]);

      console.log(`📊 Fetched ${nutritionSnapshot.docs.length} nutrition logs`);
      console.log(`🏃 Fetched ${stravaSnapshot.docs.length} Strava activities`);
      console.log(`🩸 Fetched ${bloodMarkersSnapshot.docs.length} blood marker records`);

      // Process nutrition data
      nutritionSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (tempData[data.date]) {
          tempData[data.date].caloriesConsumed = data.totals?.calories || 0;
          tempData[data.date].protein = data.totals?.protein || 0;
          tempData[data.date].carbs = data.totals?.carbs || 0;
          tempData[data.date].fat = data.totals?.fat || 0;
          tempData[data.date].fiber = data.totals?.fiber || 0;
        }
      });

      // Process Strava data with run-only heart rate tracking
      stravaSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const activityDate = data.date || (data.start_date ? data.start_date.substring(0, 10) : undefined);
        
        if (!activityDate || !tempData[activityDate]) return;

        const activityType = data.type || '';
        const isRun = activityType.toLowerCase().includes('run');

        // Heart Rate: Only track for runs and average properly
        if (data.heart_rate != null && isRun) {
          const currentHR = tempData[activityDate].heartRateRuns;
          const runCount = tempData[activityDate].runCount;
          
          if (currentHR === null) {
            tempData[activityDate].heartRateRuns = data.heart_rate;
            tempData[activityDate].runCount = 1;
          } else {
            // Calculate weighted average
            tempData[activityDate].heartRateRuns = ((currentHR * runCount) + data.heart_rate) / (runCount + 1);
            tempData[activityDate].runCount = runCount + 1;
          }
        }

        // Calories: Use direct Strava calories field
        const activityCalories = data.calories || data.activity?.calories || data.kilojoules_to_calories || 0;
        tempData[activityDate].caloriesBurned += activityCalories;
        
        // Duration and activity types
        tempData[activityDate].workoutDuration += data.duration || 0;

        if (activityType && !tempData[activityDate].activityTypes.includes(activityType)) {
          tempData[activityDate].activityTypes.push(activityType);
        }
      });

      // Process blood markers
      if (bloodMarkersSnapshot.docs.length > 0) {
        const latestDoc = bloodMarkersSnapshot.docs[0];
        setLatestBloodMarkers(latestDoc.data() as BloodMarkerData);
        console.log('🩸 Latest blood markers updated');
      }

      // Convert to array and sort by date
      const sortedData = Object.values(tempData).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      console.log('✅ Data processing complete');
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

  // UPDATED: Enhanced chart rendering with surplus instead of deficit
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

    // Calculate calorie surplus for each day
    const BMR = 1479;
    const calorieSurplusData = data.map(d => d.caloriesConsumed - (d.caloriesBurned + BMR));

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

    const surplusMin = Math.min(...calorieSurplusData);
    const surplusMax = Math.max(...calorieSurplusData);
    const surplusRange = surplusMax - surplusMin;
    const surplusPadding = Math.max(100, surplusRange * 0.1);

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
            label: 'Calorie Surplus',
            data: calorieSurplusData,
            borderColor: 'rgba(34, 197, 94, 0.8)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8,
            yAxisID: 'y-surplus'
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
          'y-surplus': {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { display: false },
            min: surplusMin - surplusPadding,
            max: surplusMax + surplusPadding,
            ticks: { 
              font: { size: 11 },
              stepSize: Math.max(100, Math.round(surplusRange / 6)),
              callback: function(value) {
                return (value >= 0 ? '+' : '') + Math.round(value) + ' cal';
              }
            },
            title: {
              display: true,
              text: 'Calorie Surplus (positive = good)',
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

  // Calculate average calorie surplus
  const calculateAvgCalorieSurplus = () => {
    const BMR = 1479;
    const validData = combinedData.filter(d => d.caloriesConsumed > 0 || d.caloriesBurned > 0);
    if (validData.length === 0) return 0;
    const sum = validData.reduce((total, d) => total + (d.caloriesConsumed - (d.caloriesBurned + BMR)), 0);
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
              Last updated: {lastUpdate} • Heart rate from runs only • Calories from Strava • Surplus: positive is good
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

         {/* 7-Day Health Overview - Updated with surplus */}
        <section className="mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border border-green-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-teal-500" />
                Last 7 Days Health Overview
                <Badge variant="secondary" className="ml-2 text-xs">
                  HR: Runs Only | Cal: Strava Direct | Surplus: Positive = Good
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
                    onClick={() => navigate(`/daily-details/${date}`)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Weekly Averages Section - Updated with surplus */}
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

            {/* Calorie Surplus Card - Updated with green theme since surplus is good */}
            <div className="bg-gradient-to-br from-emerald-400 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Cal Surplus</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <p className={`text-3xl font-bold ${calculateAvgCalorieSurplus() >= 0 ? 'text-white' : 'text-red-200'}`}>
                  {calculateAvgCalorieSurplus() >= 0 ? '+' : ''}{calculateAvgCalorieSurplus()}
                </p>
                <p className="text-sm text-emerald-100">cal/day</p>
                <p className="text-xs text-emerald-200">Positive = Good</p>
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

        {/* Combined Chart Section - Updated with surplus */}
        <section className="mb-8">
          <Card className="bg-gradient-to-r from-green-200 to-blue-200 rounded-2xl p-6 text-gray-800 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-semibold bg-gradient-to-r from-green-700 to-blue-700 bg-clip-text text-transparent flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gray-700" />
                Health Trends (Last 7 Days)
                <Badge variant="secondary" className="ml-2 text-xs">
                  Live Firebase Data • Surplus: Positive = Good
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-700 mt-2">
                Track your key health metrics with real-time data: HR from runs only, calories direct from Strava, surplus tracking (positive is better).
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

      {/* Enhanced Footer - Updated with surplus info */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>Live health data from Firebase</span>
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
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Target className="h-4 w-4 text-green-500" />
              Surplus: Positive = Good
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
