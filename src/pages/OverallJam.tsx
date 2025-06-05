import { useState, useEffect } from "react";
import { ArrowLeft, Activity, Heart, Flame, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import Chart from 'chart.js/auto';
import { db } from "@/lib/firebaseConfig";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

// Define types for our data
interface CombinedData {
  date: string;
  heartRate: number | null;
  caloriesBurned: number;
  caloriesConsumed: number;
  workoutDuration: number;
}

const OverallJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [combinedData, setCombinedData] = useState<CombinedData[]>([]);
  
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
          workoutDuration: 0
        };
      }
      
      // Fetch nutrition data
      const nutritionLogsRef = collection(db, "nutrition_logs");
      const nutritionQuery = query(
        nutritionLogsRef,
        where("userId", "==", "mihir_jain"), // Hardcoded userId for consistency
        where("date", ">=", dateString),
        orderBy("date", "desc")
      );
      
      const nutritionSnapshot = await getDocs(nutritionQuery);
      nutritionSnapshot.forEach(doc => {
        const data = doc.data();
        if (tempData[data.date]) {
          tempData[data.date].caloriesConsumed = data.totals?.calories || 0;
        }
      });
      
      // Fetch activity data
      const stravaDataRef = collection(db, "strava_data");
      const stravaQuery = query(
        stravaDataRef,
        where("userId", "==", "mihir_jain"), // Hardcoded userId for consistency
        where("date", ">=", dateString),
        orderBy("date", "desc")
      );
      
      const stravaSnapshot = await getDocs(stravaQuery);
      stravaSnapshot.forEach(doc => {
        const data = doc.data();
        const activityDate = data.date; // Use the date directly from Firestore
        
        if (tempData[activityDate]) {
          // Aggregate heart rate (take average if multiple activities)
          if (data.avgHR) {
            const currentHeartRate = tempData[activityDate].heartRate || 0;
            const currentCount = currentHeartRate > 0 ? 1 : 0;
            const newCount = currentCount + 1;
            tempData[activityDate].heartRate = (currentHeartRate * currentCount + data.avgHR) / newCount;
          }
          
          // Sum calories burned
          tempData[activityDate].caloriesBurned += data.caloriesBurned || 0;
          
          // Sum workout duration
          tempData[activityDate].workoutDuration += data.duration || 0;
        }
      });
      
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
      // Set empty data to prevent UI from breaking
      setCombinedData([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Render combined chart
  const renderCombinedChart = (data: CombinedData[]) => {
    const container = document.getElementById('combined-chart');
    if (!container) return;
    
    // Create canvas if it doesn't exist
    let canvas = container.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      container.appendChild(canvas);
    } else {
      // Destroy existing chart if it exists
      const chartInstance = Chart.getChart(canvas);
      if (chartInstance) {
        chartInstance.destroy();
      }
    }
    
    // Format dates for display
    const dateLabels = data.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    // Extract data for each metric
    const heartRateData = data.map(d => d.heartRate);
    const caloriesBurnedData = data.map(d => d.caloriesBurned);
    const caloriesConsumedData = data.map(d => d.caloriesConsumed);
    const workoutDurationData = data.map(d => d.workoutDuration);
    
    // Create the chart
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
            label: 'Workout Duration (min)',
            data: workoutDurationData,
            borderColor: 'rgba(59, 130, 246, 0.8)', // Blue
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            yAxisID: 'y-duration',
            fill: false,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            hidden: true // Hidden by default, can be toggled
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
                return context[0].label || '';
              },
              label: function(context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y || 0;
                
                if (label.includes('Heart Rate')) {
                  return `${label}: ${value.toFixed(0)} bpm`;
                } else if (label.includes('Calories')) {
                  return `${label}: ${value.toFixed(0)}`;
                } else {
                  return `${label}: ${value.toFixed(0)} min`;
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
            min: 50,
            suggestedMax: 180
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
            }
          },
          'y-duration': {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Duration (min)'
            },
            grid: {
              display: false
            },
            display: false // Hidden by default
          }
        }
      }
    });
  };
  
  // Calculate average heart rate from valid data points
  const calculateAvgHeartRate = () => {
    const validHeartRates = combinedData.filter(d => d.heartRate !== null && d.heartRate > 0);
    if (validHeartRates.length === 0) return 0;
    
    const sum = validHeartRates.reduce((total, d) => total + (d.heartRate || 0), 0);
    return Math.round(sum / validHeartRates.length);
  };
  
  // Calculate average calories burned per day with activity
  const calculateAvgCaloriesBurned = () => {
    const daysWithActivity = combinedData.filter(d => d.caloriesBurned > 0);
    if (daysWithActivity.length === 0) return 0;
    
    const sum = daysWithActivity.reduce((total, d) => total + d.caloriesBurned, 0);
    return Math.round(sum / daysWithActivity.length);
  };
  
  // Calculate average calories consumed per day with nutrition data
  const calculateAvgCaloriesConsumed = () => {
    const daysWithNutrition = combinedData.filter(d => d.caloriesConsumed > 0);
    if (daysWithNutrition.length === 0) return 0;
    
    const sum = daysWithNutrition.reduce((total, d) => total + d.caloriesConsumed, 0);
    return Math.round(sum / daysWithNutrition.length);
  };
  
  // Calculate average workout duration per workout
  const calculateAvgWorkoutDuration = () => {
    const daysWithWorkout = combinedData.filter(d => d.workoutDuration > 0);
    if (daysWithWorkout.length === 0) return 0;
    
    const sum = daysWithWorkout.reduce((total, d) => total + d.workoutDuration, 0);
    return Math.round(sum / daysWithWorkout.length);
  };
  
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
        {/* Summary Stats Section */}
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Heart Rate Card */}
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
                  <div className="text-2xl font-bold">
                    {calculateAvgHeartRate()} bpm
                  </div>
                )}
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
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">
                    {calculateAvgCaloriesBurned()}/day
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Calories Consumed Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Utensils className="mr-2 h-4 w-4 text-green-500" />
                  Avg Calories Consumed
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">
                    {calculateAvgCaloriesConsumed()}/day
                  </div>
                )}
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
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">
                    {calculateAvgWorkoutDuration()} min
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
        
        {/* Combined Chart Section */}
        <section className="mb-12">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Combined Health Trends</h3>
            <p className="text-sm text-gray-500 mb-6">
              This chart shows your heart rate, calories burned, and calories consumed over the last 30 days.
              Toggle metrics using the legend above the chart.
            </p>
            {loading ? (
              <div className="h-96 flex items-center justify-center">
                <div className="text-gray-400">Loading combined data...</div>
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
