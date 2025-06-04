import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Utensils, Calendar as CalendarIcon, BarChart3, CheckCircle } from "lucide-react";
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
  getOrCreateDailyLogFirestore, // Use Firestore version
  saveDailyLogToFirestore,      // Use Firestore version
  autoFillFromYesterdayFirestore, // Use Firestore version
  getLastXDaysDataFirestore,    // Use Firestore version
  getWeeklyAveragesFirestore    // Use Firestore version
} from "@/lib/nutritionUtils";
import { initializeCharts, prepareChartData } from "./NutritionJamCharts";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Toaster, toast } from "sonner"; // Import Toaster and toast
import { PublicFoodLog } from "@/components/nutrition/PublicFoodLog"; // Import PublicFoodLog

const NutritionJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  // Remove logs state, fetch directly based on currentDate
  // const [logs, setLogs] = useState<Record<string, DailyLog>>({}); 
  const [currentDate, setCurrentDate] = useState<string>(getTodayDateString()); // YYYY-MM-DD format
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date()); // Date object for picker
  const [currentLog, setCurrentLog] = useState<DailyLog | null>(null); // Store the log for the current date
  const [activeTab, setActiveTab] = useState("today");
  const [chartTimeframe, setChartTimeframe] = useState<"7day" | "30day">("7day");

  // Fetch log for the current date
  const fetchLogForDate = useCallback(async (date: string) => {
    console.log(`NutritionJam: Fetching log for date: ${date}`);
    setLoading(true);
    try {
      // Attempt auto-fill first if it's today's date
      let logData = date === getTodayDateString() 
        ? await autoFillFromYesterdayFirestore(date) 
        : await getOrCreateDailyLogFirestore(date);
        
      // If autoFill didn't return a log (e.g., no yesterday data), fetch/create normally
      if (!logData) {
        logData = await getOrCreateDailyLogFirestore(date);
      }

      console.log(`NutritionJam: Fetched log for ${date}:`, logData);
      setCurrentLog(logData);
    } catch (error) {
      console.error(`Error fetching log for date ${date}:`, error);
      toast.error(`Failed to load data for ${formatDateForDisplay(date)}`);
      setCurrentLog(null); // Set to null on error
    } finally {
      setLoading(false);
      console.log(`NutritionJam: Fetching log for date ${date} finished.`);
    }
  }, []);

  // Initial load and fetch when currentDate changes
  useEffect(() => {
    fetchLogForDate(currentDate);
  }, [currentDate, fetchLogForDate]);

  // Initialize charts when data is loaded and trends tab is active
  useEffect(() => {
    const initialize = async () => {
      if (!loading && currentLog && activeTab === "trends") {
        console.log("NutritionJam: Initializing charts");
        // Fetch data needed for charts (e.g., last 7/30 days)
        const logsForChart = await getLastXDaysDataFirestore(chartTimeframe === "7day" ? 7 : 30);
        const chartData = prepareChartData(logsForChart, chartTimeframe);
        // Use timeout to ensure DOM elements are ready
        setTimeout(() => {
          initializeCharts(chartData, chartTimeframe);
        }, 100);
      }
    };
    initialize();
  }, [loading, currentLog, activeTab, chartTimeframe]); // Depend on currentLog

  // Handle date selection
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      console.log("NutritionJam: Date selected:", date);
      setSelectedDate(date);
      const newDateStr = formatDateToYYYYMMDD(date);
      console.log("NutritionJam: Setting currentDate to:", newDateStr);
      setCurrentDate(newDateStr); // This will trigger the useEffect to fetch the log
    }
  };

  // Update entries for the current date and save to Firestore
  const updateEntriesAndSave = async (newEntries: FoodEntry[]) => {
    console.log(`NutritionJam: Updating entries for date ${currentDate}:`, newEntries);
    setLoading(true); // Indicate saving
    try {
      const safeEntries = Array.isArray(newEntries) ? newEntries : [];
      const totals = calculateTotals(safeEntries);
      const updatedLog: DailyLog = {
        date: currentDate,
        entries: safeEntries,
        totals
      };
      await saveDailyLogToFirestore(updatedLog);
      setCurrentLog(updatedLog); // Update local state immediately
      console.log(`NutritionJam: Successfully saved log for ${currentDate} to Firestore.`);
      // Don't show toast here, handle it in the specific add/remove functions
    } catch (error) {
      console.error(`Error saving log for date ${currentDate}:`, error);
      toast.error("Failed to save changes.");
      // Optionally refetch to revert optimistic update
      fetchLogForDate(currentDate); 
    } finally {
      setLoading(false);
    }
  };

  // Handle adding a food to the selected date
  const handleAddFood = async (entry: FoodEntry) => {
    console.log("NutritionJam: Adding food:", entry, "to date:", currentDate);
    const currentLogEntries = Array.isArray(currentLog?.entries) ? currentLog.entries : [];
    const newEntries = [...currentLogEntries, entry];
    await updateEntriesAndSave(newEntries);
    toast.success(`${entry.foodId} added successfully!`, {
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
    });
  };

  // Handle adding a meal preset to the selected date
  const handleAddMeal = async (entries: FoodEntry[]) => {
    console.log("NutritionJam: Adding meal:", entries, "to date:", currentDate);
    const currentLogEntries = Array.isArray(currentLog?.entries) ? currentLog.entries : [];
    const newEntries = [...currentLogEntries, ...entries];
    await updateEntriesAndSave(newEntries);
    toast.success(`Meal added successfully!`, {
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
    });
  };

  // Handle removing a food from the selected date
  const handleRemoveFood = async (index: number) => {
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
  const handleUpdateQuantity = async (index: number, quantity: number) => {
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
  const handleTabChange = (value: string) => {
    console.log("NutritionJam: Tab changed to:", value);
    setActiveTab(value);
  };

  // Handle chart timeframe change
  const handleTimeframeChange = (value: "7day" | "30day") => {
    console.log("NutritionJam: Chart timeframe changed to:", value);
    setChartTimeframe(value);
    // Chart useEffect will refetch and re-render
  };

  const currentEntriesForList = Array.isArray(currentLog?.entries) ? currentLog.entries : [];
  console.log("NutritionJam: Rendering with currentEntriesForList:", currentEntriesForList); // Log before render

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
      <Toaster richColors position="bottom-right" /> {/* Add Toaster */}      
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
            Mihir Nutrition Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Track your daily nutrition intake with the customized food database
          </p>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        <Tabs defaultValue="today" value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="today" className="text-sm md:text-base">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Daily Food Log
            </TabsTrigger>
            <TabsTrigger value="meals" className="text-sm md:text-base">
              <Utensils className="mr-2 h-4 w-4" />
              Meal Presets
            </TabsTrigger>
            <TabsTrigger value="trends" className="text-sm md:text-base">
              <BarChart3 className="mr-2 h-4 w-4" />
              Trends
            </TabsTrigger>
          </TabsList>
          
          {/* Daily Food Log Tab */}
          <TabsContent value="today" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Food for {formatDateForDisplay(currentDate)}</span>
                  {/* Date Picker */}
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
              <CardContent className="space-y-6">
                {loading && !currentLog ? ( // Show skeleton only during initial load or error
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <>
                    <FoodSelector onAddFood={handleAddFood} />
                    <FoodList 
                      entries={currentEntriesForList} // Use derived state
                      onRemoveFood={handleRemoveFood}
                      onUpdateQuantity={handleUpdateQuantity}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Public Food Log Display */}
            <PublicFoodLog />

          </TabsContent>
          
          {/* Meal Presets Tab */}
          <TabsContent value="meals" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle>Combined Meals</CardTitle>
              </CardHeader>
              <CardContent>
                <MealPresets onAddMeal={handleAddMeal} /> 
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
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
            
            {/* Charts Section */}
            {[ "Calories", "Macro Distribution", "Macros (g)"].map((title) => {
              // Create chart ID that matches the expected format in NutritionJamCharts.js
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
        </Tabs>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>Data stored securely in the cloud</div> {/* Updated footer text */}
          <div>Last updated: {new Date().toLocaleDateString()}</div>
        </div>
      </footer>
    </div>
  );
};

export default NutritionJam;

