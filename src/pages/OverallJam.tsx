
import { useState, useEffect } from "react";
import { ArrowLeft, Activity, Heart, Flame, Utensils, Droplet, Apple, Wheat, Drumstick, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import Chart from 'chart.js/auto';
import { db } from "@/lib/firebaseConfig";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import { DailyLog } from "@/types/nutrition"; // Import DailyLog type

// Define types for our data
interface StravaData {
  date: string;            // ISO
  type: string;                  // Run / Ride / …
  start_date?: string;
  heart_rate: number | null;     // bpm
  caloriesBurned: number;
  duration: number;              // minutes
}


interface BloodMarkerData {
  date: string;
  markers: Record<string, number | string>; // e.g., { HDL: 50, LDL: 100, VitaminD: '30 ng/mL' }
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
  activityTypes: string[]; // Store multiple activity types per day
}

const OverallJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [combinedData, setCombinedData] = useState<CombinedData[]>([]);
  const [latestBloodMarkers, setLatestBloodMarkers] = useState<BloodMarkerData | null>(null);

  // Fetch combined data from Firebase
  const fetchCombinedData = async () => {
    try {
      setLoading(true);

      // Get the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateString = thirtyDaysAgo.toISOString().split('T')[0];

      // Initialize data structure for 30 days
      const tempData: Record<string, CombinedData> = {};
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        tempData[dateStr] = {
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
      }

      // Fetch all data in parallel using Promise.all
      const [nutritionSnapshot, stravaSnapshot, bloodMarkersSnapshot] = await Promise.all([
        // Fetch nutrition data
        getDocs(query(
          collection(db, "nutritionLogs"),
          // where("userId", "==", "mihir_jain"), // TODO: Replace with auth.currentUser.uid when we add Firebase Auth
          where("date", ">=", dateString),
          orderBy("date", "desc")
        )),
        
        // Fetch Strava data
        getDocs(query(
          collection(db, "strava_data"),
          where("userId", "==", "mihir_jain"), // TODO: Replace with auth.currentUser.uid when we add Firebase Auth
          orderBy("start_date", "desc"),
          limit(50)
        )).catch(error => {
          console.warn("Could not fetch Strava data (collection might be missing):", error);
          return { docs: [] }; // Return empty result
        }),
        
        // Fetch latest blood markers
        getDocs(query(
          collection(db, "blood_markers"),
          where("userId", "==", "mihir_jain"), // TODO: Replace with auth.currentUser.uid when we add Firebase Auth
          orderBy("date", "desc"),
          limit(1)
        )).catch(error => {
          console.warn("Could not fetch blood markers:", error);
          return { docs: [] }; // Return empty result
        })
      ]);

      console.log(
  '⚡ nutrition docs →', nutritionSnapshot.size,
  'strava docs →',     stravaSnapshot.size,
  'blood docs →',      bloodMarkersSnapshot.size
);

      // Process nutrition data
      nutritionSnapshot.forEach(doc => {
        const data = doc.data() as DailyLog;
        if (tempData[data.date]) {
          tempData[data.date].caloriesConsumed = data.totals?.calories || 0;
          tempData[data.date].protein = data.totals?.protein || 0;
          tempData[data.date].carbs = data.totals?.carbs || 0;
          tempData[data.date].fat = data.totals?.fat || 0;
          tempData[data.date].fiber = data.totals?.fiber || 0;
        }
      });

      // Process Strava data with correct field mappings
      stravaSnapshot.docs.forEach(doc => {
        const data = doc.data() as StravaData;
        
  /* pick the short yyyy-mm-dd form no matter what’s in the doc */
  const activityDate =
    (data.date as string | undefined)            /* new docs */
    ?? (data.start_date ? data.start_date.substring(0, 10) : undefined);

        console.log('doc', doc.id, 'date field→', data.date,
            'start_date→', data.start_date?.substring(0, 10),
            'activityDate→', activityDate);
  if (!activityDate || !tempData[activityDate]) return;

        if (tempData[activityDate]) {
          // Heart rate (average across multiple activities)
          if (data.heart_rate != null) {
            const curHR = tempData[activityDate].heartRate ?? 0;
            const cnt = tempData[activityDate].activityTypes.length;
            tempData[activityDate].heartRate =
              ((curHR * cnt) + data.heart_rate) / (cnt + 1);
          }

          // Calories burned and workout duration
          tempData[activityDate].caloriesBurned += data.caloriesBurned || 0;
          tempData[activityDate].workoutDuration += data.duration || 0;

          // Activity type list
          if (data.type && !tempData[activityDate].activityTypes.includes(data.type)) {
            tempData[activityDate].activityTypes.push(data.type);
          }
        }
      });

      // Process blood markers
      if (bloodMarkersSnapshot.docs.length > 0) {
        const latestDoc = bloodMarkersSnapshot.docs[0];
        setLatestBloodMarkers(latestDoc.data() as BloodMarkerData);
      }

      // Convert to array and sort by date
      const sortedData = Object.values(tempData).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setCombinedData(sortedData);

      // Render chart after data is loaded
      setTimeout(() => {
        renderCombinedChart(sortedData);
      }, 100);

    } catch (error) {
      console.error("Error fetching combined data:", error);
      setCombinedData([]); // Set empty data on error
    } finally {
      setLoading(false);
    }
  };

  // Render combined chart
  const renderCombinedChart = (data: CombinedData[]) => {
    const container = document.getElementById('combined-chart');
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
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const heartRateData = data.map(d => d.heartRate);
    const caloriesBurnedData = data.map(d => d.caloriesBurned);
    const caloriesConsumedData = data.map(d => d.caloriesConsumed);
    const proteinData = data.map(d => d.protein);
    const carbsData = data.map(d => d.carbs);
    const fatData = data.map(d => d.fat);
    const fiberData = data.map(d => d.fiber);
    // Activity type is harder to plot directly on a line chart, maybe use tooltips or annotations later

    new Chart(canvas, {
      type: 'line',
      data: {
        labels: dateLabels,
        datasets: [
          {
            label: 'Heart Rate (bpm)',
            data: heartRateData,
            borderColor: 'rgba(239, 68, 68, 0.8)', // Red
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            yAxisID: 'y-heart-rate',
            fill: false,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5
          },
          {
            label: 'Calories Burned',
            data: caloriesBurnedData,
            borderColor: 'rgba(245, 158, 11, 0.8)', // Amber
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            yAxisID: 'y-calories',
            fill: false,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5
          },
          {
            label: 'Calories Consumed',
            data: caloriesConsumedData,
            borderColor: 'rgba(16, 185, 129, 0.8)', // Green
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            yAxisID: 'y-calories',
            fill: false,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5
          },
          {
            label: 'Protein (g)',
            data: proteinData,
            borderColor: 'rgba(139, 92, 246, 0.8)', // Violet
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            yAxisID: 'y-macros',
            fill: false,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            hidden: true // Hidden by default
          },
          {
            label: 'Carbs (g)',
            data: carbsData,
            borderColor: 'rgba(217, 119, 6, 0.8)', // Orange
            backgroundColor: 'rgba(217, 119, 6, 0.1)',
            yAxisID: 'y-macros',
            fill: false,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            hidden: true // Hidden by default
          },
          {
            label: 'Fat (g)',
            data: fatData,
            borderColor: 'rgba(244, 114, 182, 0.8)', // Pink
            backgroundColor: 'rgba(244, 114, 182, 0.1)',
            yAxisID: 'y-macros',
            fill: false,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            hidden: true // Hidden by default
          },
          {
            label: 'Fiber (g)',
            data: fiberData,
            borderColor: 'rgba(101, 163, 13, 0.8)', // Lime
            backgroundColor: 'rgba(101, 163, 13, 0.1)',
            yAxisID: 'y-macros',
            fill: false,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            hidden: true // Hidden by default
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
              padding: 15,
              font: {
                size: 11
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#334155',
            bodyColor: '#334155',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            usePointStyle: true,
            callbacks: {
              title: function(context) {
                const dateIndex = context[0]?.dataIndex;
                if (dateIndex !== undefined && data[dateIndex]) {
                  const dateStr = data[dateIndex].date;
                  const activityTypes = data[dateIndex].activityTypes;
                  let title = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  if (activityTypes.length > 0) {
                    title += ` (${activityTypes.join(', ')})`;
                  }
                  return title;
                }
                return context[0]?.label || '';
              },
              label: function(context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                if (value === null || value === undefined) return null; // Don't show label if value is null/undefined

                if (label.includes('Heart Rate')) {
                  return `${label}: ${value.toFixed(0)} bpm`;
                } else if (label.includes('Calories')) {
                  return `${label}: ${value.toFixed(0)}`;
                } else if (label.includes('(g)')) {
                  return `${label}: ${value.toFixed(1)} g`;
                } else {
                  return `${label}: ${value.toFixed(0)}`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 10
            }
          },
          'y-heart-rate': {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'Heart Rate (bpm)'
            },
            grid: {
              color: 'rgba(226, 232, 240, 0.5)'
            },
            // min: 50,
            // suggestedMax: 180,
            beginAtZero: false
          },
          'y-calories': {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Calories'
            },
            grid: {
              display: false
            },
            beginAtZero: true
          },
          'y-macros': {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Macronutrients (g)'
            },
            grid: {
              display: false
            },
            display: false, // Hidden by default, shown when dataset is toggled
            beginAtZero: true
          }
          // Removed y-duration axis as it's less critical and can clutter
        }
      }
    });
  };

  // --- Calculation Functions for Summary Cards ---

  const calculateAvgMetric = (metric: keyof CombinedData) => {
    const validData = combinedData.filter(d => d[metric] !== null && (d[metric] as number) > 0);
    if (validData.length === 0) return 0;
    const sum = validData.reduce((total, d) => total + (d[metric] as number || 0), 0);
    return Math.round(sum / validData.length);
  };

  const calculateAvgHeartRate = () => calculateAvgMetric('heartRate');
  const calculateAvgCaloriesBurned = () => calculateAvgMetric('caloriesBurned');
  const calculateAvgCaloriesConsumed = () => calculateAvgMetric('caloriesConsumed');
  const calculateAvgProtein = () => calculateAvgMetric('protein');
  const calculateAvgCarbs = () => calculateAvgMetric('carbs');
  const calculateAvgFat = () => calculateAvgMetric('fat');
  const calculateAvgFiber = () => calculateAvgMetric('fiber');
  const calculateAvgWorkoutDuration = () => calculateAvgMetric('workoutDuration');

  // Fetch data on component mount
  useEffect(() => {
    fetchCombinedData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
      {/* Background decoration */}
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
            Overall Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your complete health overview for the last 30 days
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        {/* Summary Stats Section - Updated to 2x4 grid */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700">Daily Averages (Last 30 Days)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Calories Consumed Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Utensils className="mr-2 h-4 w-4 text-green-500" />
                  Avg Calories Consumed
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{calculateAvgCaloriesConsumed()}/day</div>}
              </CardContent>
            </Card>

            {/* Calories Burned Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Flame className="mr-2 h-4 w-4 text-amber-500" />
                  Avg Calories Burned
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{calculateAvgCaloriesBurned()}/day</div>}
              </CardContent>
            </Card>

            {/* Heart Rate Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Heart className="mr-2 h-4 w-4 text-red-500" />
                  Avg Heart Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{calculateAvgHeartRate()} bpm</div>}
              </CardContent>
            </Card>

            {/* Workout Duration Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Activity className="mr-2 h-4 w-4 text-blue-500" />
                  Avg Workout Duration
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{calculateAvgWorkoutDuration()} min/day</div>}
              </CardContent>
            </Card>

            {/* Protein Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Drumstick className="mr-2 h-4 w-4 text-violet-500" />
                  Avg Protein
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{calculateAvgProtein()} g/day</div>}
              </CardContent>
            </Card>

            {/* Carbs Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Wheat className="mr-2 h-4 w-4 text-orange-500" />
                  Avg Carbs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{calculateAvgCarbs()} g/day</div>}
              </CardContent>
            </Card>

            {/* Fat Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Apple className="mr-2 h-4 w-4 text-pink-500" /> {/* Using Apple icon for Fat as placeholder */}
                  Avg Fat
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{calculateAvgFat()} g/day</div>}
              </CardContent>
            </Card>

            {/* Fiber Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Leaf className="mr-2 h-4 w-4 text-lime-600" />
                  Avg Fiber
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{calculateAvgFiber()} g/day</div>}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Latest Blood Markers Section */}
        {latestBloodMarkers && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-gray-700">Latest Blood Markers (as of {new Date(latestBloodMarkers.date).toLocaleDateString()})</h2>
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Object.entries(latestBloodMarkers.markers).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{key}</p>
                    <p className="text-xl font-semibold text-gray-800">{value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        {/* Combined Chart Section */}
        <section className="mb-12">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Combined Health Trends (Last 30 Days)</h3>
            <p className="text-sm text-gray-500 mb-6">
              This chart shows your health metrics over the last 30 days.
              Toggle metrics using the legend above the chart. Activity types for the day are shown in the tooltip.
            </p>
            {loading ? (
              <div className="h-96 flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <div className="h-96" id="combined-chart">
                {/* Chart will be rendered here */}
              </div>
            )}
          </Card>
        </section>

        {/* Let's Jam Button */}
        <section className="mb-12 text-center">
          <Button
            onClick={() => navigate('/lets-jam')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 rounded-lg shadow-lg hover:shadow-xl transition-all"
          >
            <Activity className="mr-2 h-5 w-5" />
            Chat with Your Health Assistant
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <p>Data from your health logs over the last 30 days</p>
      </footer>
    </div>
  );
};

export default OverallJam;

