import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Utensils, Calendar as CalendarIcon, BarChart3, CheckCircle, Plus, Minus, Target, TrendingUp, Activity, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FoodSelector } from "@/components/nutrition/FoodSelector";
import { FoodList } from "@/components/nutrition/FoodList";
import { MealPresets } from "@/components/nutrition/MealPresets";
import { MacroAveragesSummary } from "@/components/nutrition/MacroAveragesSummary";
import { DailyLog, FoodEntry } from "@/types/nutrition";
import { 
  getTodayDateString, 
  calculateTotals,
  formatDateForDisplay,
  formatDateToYYYYMMDD,
  getOrCreateDailyLogFirestore,
  saveDailyLogToFirestore,
  autoFillFromYesterdayFirestore,
  getLastXDaysDataFirestore,
  getWeeklyAveragesFirestore
} from "@/lib/nutritionUtils";
import { initializeCharts, prepareChartData } from "./NutritionJamCharts";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import { PublicFoodLog } from "@/components/nutrition/PublicFoodLog";

// Daily Macro Box Component (ActivityJam style)
const DailyMacroBox = ({ log, date, isToday, onClick }) => {
  const totals = log?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const hasData = log?.entries?.length > 0;
  
  // Calculate macro percentages for visual indicators
  const calorieGoal = 2200; // Could be made configurable
  const proteinGoal = 165;
  const carbsGoal = 275;
  const fatGoal = 73;
  
  const caloriePercent = Math.min((totals.calories / calorieGoal) * 100, 100);
  const proteinPercent = Math.min((totals.protein / proteinGoal) * 100, 100);
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg",
        hasData 
          ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-green-100" 
          : "bg-gray-50 border-gray-200 hover:shadow-gray-100",
        isToday && "ring-2 ring-blue-500"
      )}
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
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium">
                Today
              </span>
            )}
          </div>

          {hasData ? (
            <>
              {/* Calories with progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-lg font-bold text-gray-800">
                      {Math.round(totals.calories)}
                    </span>
                    <span className="text-sm text-gray-500">cal</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {Math.round(caloriePercent)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${caloriePercent}%` }}
                  />
                </div>
              </div>

              {/* Macro Breakdown */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{Math.round(totals.protein)}g</div>
                  <div className="text-gray-500">Protein</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-green-600">{Math.round(totals.carbs)}g</div>
                  <div className="text-gray-500">Carbs</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-purple-600">{Math.round(totals.fat)}g</div>
                  <div className="text-gray-500">Fat</div>
                </div>
              </div>

              {/* Meals count */}
              <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                <Utensils className="h-3 w-3" />
                <span>{log.entries.length} items logged</span>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-gray-400 text-sm">No data logged</div>
              <div className="text-xs text-gray-400 mt-1">Tap to add food</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Enhanced Food Logger with Daily Summary
const EnhancedFoodLogger = ({ currentLog, currentDate, onAddFood, onRemoveFood, onUpdateQuantity, loading }) => {
  const currentEntries = Array.isArray(currentLog?.entries) ? currentLog.entries : [];
  const totals = currentLog?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };

  return (
    <div className="space-y-6">
      {/* Daily Summary Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-green-50 border-blue-200">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-bold text-gray-800">{Math.round(totals.calories)}</span>
              </div>
              <div className="text-sm text-gray-600">Calories</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Target className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold text-blue-600">{Math.round(totals.protein)}</span>
              </div>
              <div className="text-sm text-gray-600">Protein (g)</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Activity className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold text-green-600">{Math.round(totals.carbs)}</span>
              </div>
              <div className="text-sm text-gray-600">Carbs (g)</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold text-purple-600">{Math.round(totals.fat)}</span>
              </div>
              <div className="text-sm text-gray-600">Fat (g)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Food Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-500" />
            Add Food
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FoodSelector onAddFood={onAddFood} />
        </CardContent>
      </Card>

      {/* Food List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-blue-500" />
            Today's Food Log ({currentEntries.length} items)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <FoodList 
              entries={currentEntries}
              onRemoveFood={onRemoveFood}
              onUpdateQuantity={onUpdateQuantity}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Enhanced Meal Presets Section
const EnhancedMealPresets = ({ onAddMeal }) => {
  return (
    <div className="space-y-6">
      {/* Quick Meal Presets */}
      <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-green-500" />
            Quick Meal Presets
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Save time with pre-configured meals. Click "Add" to log the entire meal to your current day.
          </p>
        </CardHeader>
        <CardContent>
          <MealPresets onAddMeal={onAddMeal} />
        </CardContent>
      </Card>

      {/* Create Custom Meal Section */}
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-purple-500" />
            Create Custom Meal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-gray-500 mb-4">
              <Utensils className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Create your own meal presets</p>
              <p className="text-sm">Combine multiple foods into reusable meals</p>
            </div>
            <Button 
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              onClick={() => toast.info("Custom meal creator coming soon!")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Meal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const NutritionJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(getTodayDateString());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentLog, setCurrentLog] = useState(null);
  const [activeTab, setActiveTab] = useState("trends"); // Changed default to trends
  const [chartTimeframe, setChartTimeframe] = useState("7day");
  const [last7DaysData, setLast7DaysData] = useState({});

  // Fetch log for the current date
  const fetchLogForDate = useCallback(async (date) => {
    console.log(`NutritionJam: Fetching log for date: ${date}`);
    setLoading(true);
    try {
      let logData = date === getTodayDateString() 
        ? await autoFillFromYesterdayFirestore(date) 
        : await getOrCreateDailyLogFirestore(date);
        
      if (!logData) {
        logData = await getOrCreateDailyLogFirestore(date);
      }

      console.log(`NutritionJam: Fetched log for ${date}:`, logData);
      setCurrentLog(logData);
    } catch (error) {
      console.error(`Error fetching log for date ${date}:`, error);
      toast.error(`Failed to load data for ${formatDateForDisplay(date)}`);
      setCurrentLog(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch last 7 days data for trends view
  const fetchLast7DaysData = useCallback(async () => {
    try {
      const data = await getLastXDaysDataFirestore(7);
      setLast7DaysData(data);
    } catch (error) {
      console.error('Error fetching last 7 days data:', error);
    }
  }, []);

  // Initial load and fetch when currentDate changes
  useEffect(() => {
    fetchLogForDate(currentDate);
    fetchLast7DaysData();
  }, [currentDate, fetchLogForDate, fetchLast7DaysData]);

  // Initialize charts when data is loaded and trends tab is active
  useEffect(() => {
    const initialize = async () => {
      if (!loading && activeTab === "trends") {
        console.log("NutritionJam: Initializing charts");
        const logsForChart = await getLastXDaysDataFirestore(chartTimeframe === "7day" ? 7 : 30);
        const chartData = prepareChartData(logsForChart, chartTimeframe);
        setTimeout(() => {
          initializeCharts(chartData, chartTimeframe);
        }, 100);
      }
    };
    initialize();
  }, [loading, activeTab, chartTimeframe]);

  // Handle date selection
  const handleDateChange = (date) => {
    if (date) {
      console.log("NutritionJam: Date selected:", date);
      setSelectedDate(date);
      const newDateStr = formatDateToYYYYMMDD(date);
      console.log("NutritionJam: Setting currentDate to:", newDateStr);
      setCurrentDate(newDateStr);
    }
  };

  // Update entries for the current date and save to Firestore
  const updateEntriesAndSave = async (newEntries) => {
    console.log(`NutritionJam: Updating entries for date ${currentDate}:`, newEntries);
    setLoading(true);
    try {
      const safeEntries = Array.isArray(newEntries) ? newEntries : [];
      const totals = calculateTotals(safeEntries);
      const updatedLog = {
        date: currentDate,
        entries: safeEntries,
        totals
      };
      await saveDailyLogToFirestore(updatedLog);
      setCurrentLog(updatedLog);
      
      // Refresh 7-day data if we're updating today or recent dates
      const today = new Date();
      const currentDateObj = new Date(currentDate);
      const daysDiff = Math.floor((today.getTime() - currentDateObj.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 7) {
        fetchLast7DaysData();
      }
      
      console.log(`NutritionJam: Successfully saved log for ${currentDate} to Firestore.`);
    } catch (error) {
      console.error(`Error saving log for date ${currentDate}:`, error);
      toast.error("Failed to save changes.");
      fetchLogForDate(currentDate);
    } finally {
      setLoading(false);
    }
  };

  // Handle adding a food to the selected date
  const handleAddFood = async (entry) => {
    console.log("NutritionJam: Adding food:", entry, "to date:", currentDate);
    const currentLogEntries = Array.isArray(currentLog?.entries) ? currentLog.entries : [];
    const newEntries = [...currentLogEntries, entry];
    await updateEntriesAndSave(newEntries);
    toast.success(`${entry.foodId} added successfully!`, {
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
    });
  };

  // Handle adding a meal preset to the selected date
  const handleAddMeal = async (entries) => {
    console.log("NutritionJam: Adding meal:", entries, "to date:", currentDate);
    const currentLogEntries = Array.isArray(currentLog?.entries) ? currentLog.entries : [];
    const newEntries = [...currentLogEntries, ...entries];
    await updateEntriesAndSave(newEntries);
    toast.success(`Meal added successfully!`, {
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
    });
  };

  // Handle removing a food from the selected date
  const handleRemoveFood = async (index) => {
    console.log("NutritionJam: Removing food at index:", index, "from date:", currentDate);
    const currentLogEntries = Array.isArray(currentLog?.entries) ? [...currentLog.entries] : [];
    if (index >= 0 && index < currentLogEntries.length) {
      const removedFoodName = currentLogEntries[index].foodId;
      currentLogEntries.splice(index, 1);
      await updateEntriesAndSave(currentLogEntries);
      toast.success(`${removedFoodName} removed.`, {
        icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      });
    } else {
      console.error("NutritionJam: Invalid index for remove food:", index);
      toast.error("Error removing food item.");
    }
  };

  // Handle updating a food quantity for the selected date
  const handleUpdateQuantity = async (index, quantity) => {
    console.log("NutritionJam: Updating quantity for food at index:", index, "to:", quantity, "on date:", currentDate);
    const currentLogEntries = Array.isArray(currentLog?.entries) ? [...currentLog.entries] : [];
    if (index >= 0 && index < currentLogEntries.length) {
      const updatedFoodName = currentLogEntries[index].foodId;
      currentLogEntries[index] = {
        ...currentLogEntries[index],
        quantity
      };
      await updateEntriesAndSave(currentLogEntries);
      toast.success(`${updatedFoodName} quantity updated.`, {
        icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      });
    } else {
      console.error("NutritionJam: Invalid index for update quantity:", index);
      toast.error("Error updating food quantity.");
    }
  };

  // Handle tab change
  const handleTabChange = (value) => {
    console.log("NutritionJam: Tab changed to:", value);
    setActiveTab(value);
  };

  // Handle chart timeframe change
  const handleTimeframeChange = (value) => {
    console.log("NutritionJam: Chart timeframe changed to:", value);
    setChartTimeframe(value);
  };

  // Generate last 7 days dates for the daily boxes
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return formatDateToYYYYMMDD(date);
  }).reverse();

  const currentEntriesForList = Array.isArray(currentLog?.entries) ? currentLog.entries : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
      <Toaster richColors position="bottom-right" />
      
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-green-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-green-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <Button 
          onClick={() => navigate("/")} 
          variant="ghost" 
          className="mb-6 hover:bg-white/20"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent">
            Nutrition Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Track your daily nutrition intake with smart insights and trends
          </p>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        <Tabs defaultValue="trends" value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="trends" className="text-sm md:text-base">
              <BarChart3 className="mr-2 h-4 w-4" />
              Nutrition Trends
            </TabsTrigger>
            <TabsTrigger value="today" className="text-sm md:text-base">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Daily Logger
            </TabsTrigger>
            <TabsTrigger value="meals" className="text-sm md:text-base">
              <Utensils className="mr-2 h-4 w-4" />
              Meal Presets
            </TabsTrigger>
          </TabsList>
          
          {/* Trends Tab - Now the default */}
          <TabsContent value="trends" className="space-y-6">
            {/* Timeframe selector */}
            <div className="flex justify-end mb-4">
              <div className="inline-flex rounded-md shadow-sm">
                <Button
                  variant={chartTimeframe === "7day" ? "default" : "outline"}
                  className="rounded-l-md rounded-r-none"
                  onClick={() => handleTimeframeChange("7day")}
                >
                  7 Days
                </Button>
                <Button
                  variant={chartTimeframe === "30day" ? "default" : "outline"}
                  className="rounded-r-md rounded-l-none"
                  onClick={() => handleTimeframeChange("30day")}
                >
                  30 Days
                </Button>
              </div>
            </div>

            {/* Average Daily Macros Summary */}
            <MacroAveragesSummary 
              chartTimeframe={chartTimeframe} 
              loading={loading} 
            />

            {/* Last 7 Days - Daily Macro Boxes (ActivityJam Style) */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  Last 7 Days Nutrition
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                  {last7Days.map((date) => (
                    <DailyMacroBox
                      key={date}
                      log={last7DaysData[date]}
                      date={date}
                      isToday={date === getTodayDateString()}
                      onClick={() => {
                        setCurrentDate(date);
                        setSelectedDate(new Date(date));
                        setActiveTab("today");
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Charts Section */}
            {["Calories", "Macro Distribution", "Macros (g)"].map((title) => {
              let chartId = "";
              if (title === "Calories") chartId = "calories-chart";
              else if (title === "Macro Distribution") chartId = "macro-distribution-chart";
              else if (title === "Macros (g)") chartId = "combined-macros-chart";
              
              return (
                <Card key={title} className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader>
                    <CardTitle>{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64" id={chartId}>
                      {loading && <Skeleton className="h-full w-full" />}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
          
          {/* Daily Logger Tab */}
          <TabsContent value="today" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Food Log for {formatDateForDisplay(currentDate)}</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? formatDateForDisplay(formatDateToYYYYMMDD(selectedDate)) : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EnhancedFoodLogger
                  currentLog={currentLog}
                  currentDate={currentDate}
                  onAddFood={handleAddFood}
                  onRemoveFood={handleRemoveFood}
                  onUpdateQuantity={handleUpdateQuantity}
                  loading={loading}
                />
              </CardContent>
            </Card>

            {/* Public Food Log Display */}
            <PublicFoodLog />
          </TabsContent>
          
          {/* Meal Presets Tab */}
          <TabsContent value="meals" className="space-y-6">
            <EnhancedMealPresets onAddMeal={handleAddMeal} />
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Enhanced Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>Data stored securely in the cloud</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
             Nutrition tracking powered by smart insights
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

export default NutritionJam;
