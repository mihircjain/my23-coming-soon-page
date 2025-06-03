import { useState, useEffect } from "react";
import { ArrowLeft, Utensils, Calendar, BarChart3, BarChart4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FoodSelector } from "@/components/nutrition/FoodSelector";
import { FoodList } from "@/components/nutrition/FoodList";
import { MealPresets } from "@/components/nutrition/MealPresets";
import { DailyLog, FoodEntry } from "@/types/nutrition";
import { 
  getTodayDateString, 
  getOrCreateDailyLog, 
  loadNutritionLogs, 
  saveNutritionLogs,
  calculateTotals,
  autoFillFromYesterday,
  formatDateForDisplay
} from "@/lib/nutritionUtils";
import { initializeCharts, prepareChartData } from './NutritionJamCharts';

const NutritionJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<Record<string, DailyLog>>({});
  const [currentDate, setCurrentDate] = useState(getTodayDateString());
  const [currentEntries, setCurrentEntries] = useState<FoodEntry[]>([]);
  const [activeTab, setActiveTab] = useState("today");
  const [chartTimeframe, setChartTimeframe] = useState<'7day' | '30day'>('7day');

  // Load nutrition logs on component mount
  useEffect(() => {
    setLoading(true);
    const savedLogs = loadNutritionLogs();
    
    // Check if we need to auto-fill from yesterday
    const updatedLogs = autoFillFromYesterday(savedLogs);
    
    setLogs(updatedLogs);
    
    // Set current entries to today's log
    const today = getTodayDateString();
    const todayLog = getOrCreateDailyLog(updatedLogs, today);
    setCurrentEntries(todayLog.entries);
    
    setLoading(false);
  }, []);

  // Save logs whenever they change
  useEffect(() => {
    if (!loading && Object.keys(logs).length > 0) {
      saveNutritionLogs(logs);
    }
  }, [logs, loading]);

  // Initialize charts when data is loaded
  useEffect(() => {
    if (!loading && Object.keys(logs).length > 0 && activeTab === "trends") {
      const chartData = prepareChartData(logs, chartTimeframe);
      setTimeout(() => {
        initializeCharts(chartData, chartTimeframe);
      }, 100);
    }
  }, [loading, logs, activeTab, chartTimeframe]);

  // Handle adding a food to the current day
  const handleAddFood = (entry: FoodEntry) => {
    const newEntries = [...currentEntries, entry];
    updateCurrentEntries(newEntries);
  };

  // Handle adding a meal preset to the current day
  const handleAddMeal = (entries: FoodEntry[]) => {
    const newEntries = [...currentEntries, ...entries];
    updateCurrentEntries(newEntries);
  };

  // Handle removing a food from the current day
  const handleRemoveFood = (index: number) => {
    const newEntries = [...currentEntries];
    newEntries.splice(index, 1);
    updateCurrentEntries(newEntries);
  };

  // Handle updating a food quantity
  const handleUpdateQuantity = (index: number, quantity: number) => {
    const newEntries = [...currentEntries];
    newEntries[index] = {
      ...newEntries[index],
      quantity
    };
    updateCurrentEntries(newEntries);
  };

  // Update current entries and save to logs
  const updateCurrentEntries = (entries: FoodEntry[]) => {
    setCurrentEntries(entries);
    
    // Calculate totals
    const totals = calculateTotals(entries);
    
    // Update logs
    const newLogs = { ...logs };
    newLogs[currentDate] = {
      date: currentDate,
      entries,
      totals
    };
    
    setLogs(newLogs);
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Handle chart timeframe change
  const handleTimeframeChange = (value: '7day' | '30day') => {
    setChartTimeframe(value);
  };

  return (
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
            Mihir's Nutrition Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Track your daily nutrition intake with the vegetarian food database
          </p>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        <Tabs defaultValue="today" value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="today" className="text-sm md:text-base">
              <Calendar className="mr-2 h-4 w-4" />
              Today's Food
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
          
          {/* Today's Food Tab */}
          <TabsContent value="today" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Food for {formatDateForDisplay(currentDate)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FoodSelector onAddFood={handleAddFood} />
                
                <FoodList 
                  entries={currentEntries}
                  onRemoveFood={handleRemoveFood}
                  onUpdateQuantity={handleUpdateQuantity}
                />
              </CardContent>
            </Card>
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
                  variant={chartTimeframe === '7day' ? 'default' : 'outline'}
                  className="rounded-l-md rounded-r-none"
                  onClick={() => handleTimeframeChange('7day')}
                >
                  7 Days
                </Button>
                <Button
                  variant={chartTimeframe === '30day' ? 'default' : 'outline'}
                  className="rounded-r-md rounded-l-none"
                  onClick={() => handleTimeframeChange('30day')}
                >
                  30 Days
                </Button>
              </div>
            </div>
            
            {/* Calories Chart */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle>Calories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" id="calories-chart">
                  {loading && <Skeleton className="h-full w-full" />}
                </div>
              </CardContent>
            </Card>
            
            {/* Macro Distribution Chart */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle>Macro Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" id="macro-distribution-chart">
                  {loading && <Skeleton className="h-full w-full" />}
                </div>
              </CardContent>
            </Card>
            
            {/* Protein Chart */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle>Protein (g)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" id="protein-chart">
                  {loading && <Skeleton className="h-full w-full" />}
                </div>
              </CardContent>
            </Card>
            
            {/* Carbs Chart */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle>Carbs (g)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" id="carbs-chart">
                  {loading && <Skeleton className="h-full w-full" />}
                </div>
              </CardContent>
            </Card>
            
            {/* Fat Chart */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle>Fat (g)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" id="fat-chart">
                  {loading && <Skeleton className="h-full w-full" />}
                </div>
              </CardContent>
            </Card>
            
            {/* Fiber Chart */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle>Fiber (g)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" id="fiber-chart">
                  {loading && <Skeleton className="h-full w-full" />}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>Data stored locally in your browser</div>
          <div>Last updated: {new Date().toLocaleDateString()}</div>
        </div>
      </footer>
    </div>
  );
};

export default NutritionJam;
