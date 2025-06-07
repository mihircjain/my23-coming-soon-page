// Add these imports to your existing OverallJam component
import { RefreshCw } from "lucide-react";

// Add these state variables after your existing useState declarations
const [refreshing, setRefreshing] = useState(false);
const [lastUpdate, setLastUpdate] = useState<string>('');

// Update your fetchCombinedData function to handle refresh
const fetchCombinedData = async (forceRefresh = false) => {
  try {
    setLoading(true);
    if (forceRefresh) {
      setRefreshing(true);
    }

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

    // Log what we're fetching
    console.log(`🔄 Fetching combined data (forceRefresh: ${forceRefresh})...`);

    // Fetch all data in parallel using Promise.all
    const [nutritionSnapshot, stravaSnapshot, bloodMarkersSnapshot] = await Promise.all([
      // Fetch nutrition data
      getDocs(query(
        collection(db, "nutritionLogs"),
        where("date", ">=", dateString),
        orderBy("date", "desc")
      )),
      
      // Fetch Strava data
      getDocs(query(
        collection(db, "strava_data"),
        where("userId", "==", "mihir_jain"),
        orderBy("start_date", "desc"),
        limit(50)
      )).catch(error => {
        console.warn("Could not fetch Strava data (collection might be missing):", error);
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
        
        // Log nutrition data for debugging
        console.log(`📊 Nutrition for ${data.date}:`, {
          calories: data.totals?.calories,
          protein: data.totals?.protein,
          carbs: data.totals?.carbs,
          fat: data.totals?.fat,
          fiber: data.totals?.fiber
        });
      }
    });

    // Process Strava data with correct field mappings
    stravaSnapshot.docs.forEach(doc => {
      const data = doc.data() as StravaData;
      
      /* pick the short yyyy-mm-dd form no matter what's in the doc */
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
    
    // Update last refresh time
    setLastUpdate(new Date().toLocaleTimeString());

    // Render chart after data is loaded
    setTimeout(() => {
      renderCombinedChart(sortedData);
    }, 100);

  } catch (error) {
    console.error("Error fetching combined data:", error);
    setCombinedData([]); // Set empty data on error
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

// Add manual refresh function
const handleRefresh = async () => {
  await fetchCombinedData(true); // Force refresh
};

// Update your useEffect to not force refresh on mount
useEffect(() => {
  fetchCombinedData(false); // Don't force refresh on initial load
}, []);

// Update your header section to include refresh button and last update time
// Replace your existing header section with this:

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
      Overall Jam
    </h1>
    <p className="mt-3 text-lg text-gray-600">
      Your complete health overview for the last 30 days
    </p>
    {lastUpdate && (
      <p className="mt-1 text-sm text-gray-500">
        Last updated: {lastUpdate}
      </p>
    )}
  </div>
</header>
