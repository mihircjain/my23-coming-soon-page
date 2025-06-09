import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Utensils, Calendar as CalendarIcon, BarChart3, CheckCircle, Plus, Minus, Target, TrendingUp, Activity, Flame, Edit, Trash2 } from "lucide-react";
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
  const totals = log?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const hasData = log?.entries?.length > 0;
  
  // Calculate macro percentages for visual indicators
  const calorieGoal = 2000;
  const proteinGoal = 143;
  const carbsGoal = 238;
  const fatGoal = 30;
  
  const caloriePercent = Math.min((totals.calories / calorieGoal) * 100, 100);
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg group",
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
              <div className="grid grid-cols-4 gap-1 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{Math.round(totals.protein)}g</div>
                  <div className="text-gray-500">Pro</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-green-600">{Math.round(totals.carbs)}g</div>
                  <div className="text-gray-500">Carb</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-purple-600">{Math.round(totals.fat)}g</div>
                  <div className="text-gray-500">Fat</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-amber-600">{Math.round(totals.fiber || 0)}g</div>
                  <div className="text-gray-500">Fib</div>
                </div>
              </div>

              {/* Meals count */}
              <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                <Utensils className="h-3 w-3" />
                <span>{log.entries.length} items</span>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-gray-400 text-sm mb-1">No data</div>
              <div className="text-xs text-gray-400">Tap to log</div>
              <Plus className="h-6 w-6 mx-auto mt-2 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// FIXED: Enhanced Food Item Card with proper NaN handling
const FoodItemCard = ({ entry, index, onRemove, onUpdateQuantity }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [quantity, setQuantity] = useState(entry.quantity);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleSave = () => {
    onUpdateQuantity(index, quantity);
    setIsEditing(false);
  };

  // FIXED: Proper handling of numeric values with fallbacks
  const safeNumber = (value) => {
    const num = parseFloat(value);
    return isNaN(num) || !isFinite(num) ? 0 : num;
  };

  const totalCals = Math.round(safeNumber(entry.calories) * safeNumber(entry.quantity));
  const totalProtein = Math.round(safeNumber(entry.protein) * safeNumber(entry.quantity));
  const totalCarbs = Math.round(safeNumber(entry.carbs) * safeNumber(entry.quantity));
  const totalFat = Math.round(safeNumber(entry.fat) * safeNumber(entry.quantity));
  const totalFiber = Math.round(safeNumber(entry.fiber || 0) * safeNumber(entry.quantity));

  return (
    <div className="relative">
      <Card 
        className="group hover:shadow-md transition-all duration-200 bg-gradient-to-r from-white to-gray-50 cursor-pointer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <div className="font-medium text-gray-800 mb-1">{entry.foodId}</div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-500" />
                  {totalCals} cal
                </span>
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3 text-blue-500" />
                  {totalProtein}g protein
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                    step="0.1"
                    min="0"
                  />
                  <Button size="sm" onClick={handleSave}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity(index, Math.max(0.1, safeNumber(entry.quantity) - 0.5));
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-16 text-center text-sm font-medium">
                      {safeNumber(entry.quantity)} {entry.unit}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity(index, safeNumber(entry.quantity) + 0.5);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(index);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tooltip showing detailed macros */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-64">
          <div className="text-sm font-semibold text-gray-800 mb-2">{entry.foodId}</div>
          <div className="text-xs text-gray-600 mb-3">{safeNumber(entry.quantity)} {entry.unit}</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Calories:</span>
              <span className="font-medium text-orange-600">{totalCals}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Protein:</span>
              <span className="font-medium text-blue-600">{totalProtein}g</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Carbs:</span>
              <span className="font-medium text-green-600">{totalCarbs}g</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fat:</span>
              <span className="font-medium text-purple-600">{totalFat}g</span>
            </div>
            {totalFiber > 0 && (
              <div className="flex justify-between col-span-2">
                <span className="text-gray-600">Fiber:</span>
                <span className="font-medium text-amber-600">{totalFiber}g</span>
              </div>
            )}
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white"></div>
        </div>
      )}
    </div>
  );
};

// Enhanced Food Logger with Daily Summary
const EnhancedFoodLogger = ({ currentLog, currentDate, onAddFood, onRemoveFood, onUpdateQuantity, loading }) => {
  const currentEntries = Array.isArray(currentLog?.entries) ? currentLog.entries : [];
  const totals = currentLog?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

  return (
    <div className="space-y-6">
      {/* Daily Summary Card */}
      <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-200">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-bold text-gray-800">{Math.round(totals.calories || 0)}</span>
              </div>
              <div className="text-sm text-gray-600">Calories</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Target className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold text-blue-600">{Math.round(totals.protein || 0)}</span>
              </div>
              <div className="text-sm text-gray-600">Protein (g)</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Activity className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold text-green-600">{Math.round(totals.carbs || 0)}</span>
              </div>
              <div className="text-sm text-gray-600">Carbs (g)</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold text-purple-600">{Math.round(totals.fat || 0)}</span>
              </div>
              <div className="text-sm text-gray-600">Fat (g)</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <BarChart3 className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold text-amber-600">{Math.round(totals.fiber || 0)}</span>
              </div>
              <div className="text-sm text-gray-600">Fiber (g)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Food Section */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
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
          ) : currentEntries.length === 0 ? (
            <div className="text-center py-12">
              <Utensils className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-2">No food logged today</p>
              <p className="text-sm text-gray-400">Add your first meal above to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentEntries.map((entry, index) => (
                <FoodItemCard
                  key={index}
                  entry={entry}
                  index={index}
                  onRemove={onRemoveFood}
                  onUpdateQuantity={onUpdateQuantity}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// FIXED: Cute Widget-Style Meal Preset Cards like Daily Nutrition Boxes
const MealPresetWidget = ({ meal, onAddMeal }) => {
  const safeNumber = (value) => {
    const num = parseFloat(value);
    return isNaN(num) || !isFinite(num) ? 0 : num;
  };

  const totalCalories = meal.foods?.reduce((sum, food) => sum + (safeNumber(food.calories) * safeNumber(food.quantity)), 0) || 0;
  const totalProtein = meal.foods?.reduce((sum, food) => sum + (safeNumber(food.protein) * safeNumber(food.quantity)), 0) || 0;
  const totalCarbs = meal.foods?.reduce((sum, food) => sum + (safeNumber(food.carbs) * safeNumber(food.quantity)), 0) || 0;
  const totalFat = meal.foods?.reduce((sum, food) => sum + (safeNumber(food.fat) * safeNumber(food.quantity)), 0) || 0;
  const totalFiber = meal.foods?.reduce((sum, food) => sum + (safeNumber(food.fiber || 0) * safeNumber(food.quantity)), 0) || 0;
  const itemCount = meal.foods?.length || 0;

  // Calculate calorie percentage for visual indicator (using 500 cal as typical meal goal)
  const mealCalorieGoal = 500;
  const caloriePercent = Math.min((totalCalories / mealCalorieGoal) * 100, 100);
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg group",
        "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-green-100"
      )}
      onClick={() => onAddMeal(meal.foods)}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Meal Header - similar to date header in DailyMacroBox */}
          <div className="flex justify-between items-center">
            <div className="text-sm font-bold text-gray-800 truncate">
              {meal.name}
            </div>
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium">
              {itemCount} items
            </span>
          </div>

          {/* Calories with progress bar - matching DailyMacroBox */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-lg font-bold text-gray-800">
                  {Math.round(totalCalories)}
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

          {/* Macro Breakdown - exactly matching DailyMacroBox */}
          <div className="grid grid-cols-4 gap-1 text-xs">
            <div className="text-center">
              <div className="font-semibold text-blue-600">{Math.round(totalProtein)}g</div>
              <div className="text-gray-500">Pro</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-600">{Math.round(totalCarbs)}g</div>
              <div className="text-gray-500">Carb</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-purple-600">{Math.round(totalFat)}g</div>
              <div className="text-gray-500">Fat</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-amber-600">{Math.round(totalFiber)}g</div>
              <div className="text-gray-500">Fib</div>
            </div>
          </div>

          {/* Add meal indicator - similar to meals count in DailyMacroBox */}
          <div className="flex items-center justify-center gap-1 text-xs text-green-600 group-hover:text-green-700 transition-colors">
            <Plus className="h-3 w-3" />
            <span>Add Meal</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Enhanced Meal Presets Section with Widget Grid
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
            Save time with pre-configured meals. Click any card to add the entire meal to your current day.
          </p>
        </CardHeader>
        <CardContent>
          {/* UPDATED: Grid layout: 4-5 cards per row depending on screen size */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <MealPresets onAddMeal={onAddMeal} renderAs="widget" />
          </div>
        </CardContent>
      </Card>

      {/* Rest of the component remains the same... */}
    </div>
  );
};

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
              <p className="font-medium">Create your own meal presets</p>
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
  const [activeTab, setActiveTab] = useState("trends");
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

// Add this function before your useEffect
const refreshCharts = async () => {
  try {
    const logsForChart = await getLastXDaysDataFirestore(chartTimeframe === "7day" ? 7 : 30);
    const chartData = prepareChartData(logsForChart, chartTimeframe);
    
    const combinedChartElement = document.getElementById('combined-nutrition-chart');
    const macroChartElement = document.getElementById('macro-distribution-chart');
    
    if (combinedChartElement && macroChartElement) {
      combinedChartElement.innerHTML = '';
      macroChartElement.innerHTML = '';
      initializeCharts(chartData, chartTimeframe);
      toast.success("Charts refreshed successfully!");
    }
  } catch (error) {
    console.error("Error refreshing charts:", error);
    toast.error("Failed to refresh charts");
  }
};

// Replace your existing chart useEffect with this:
useEffect(() => {
  const initialize = async () => {
    if (!loading && activeTab === "trends") {
      console.log("NutritionJam: Initializing charts");
      try {
        const logsForChart = await getLastXDaysDataFirestore(chartTimeframe === "7day" ? 7 : 30);
        const chartData = prepareChartData(logsForChart, chartTimeframe);
        
        // Ensure DOM elements exist before initializing charts
        const checkAndInitializeCharts = () => {
          const combinedChartElement = document.getElementById('combined-nutrition-chart');
          const macroChartElement = document.getElementById('macro-distribution-chart');
          
          if (combinedChartElement && macroChartElement) {
            try {
              // Clear any existing content first
              combinedChartElement.innerHTML = '';
              macroChartElement.innerHTML = '';
              
              // Initialize charts
              initializeCharts(chartData, chartTimeframe);
              console.log("Charts initialized successfully");
            } catch (chartError) {
              console.error("Error initializing charts:", chartError);
              
              // Fallback: Show error message in chart containers
              if (combinedChartElement) {
                combinedChartElement.innerHTML = `
                  <div class="flex items-center justify-center h-full text-gray-500">
                    <div class="text-center">
                      <p class="mb-2">Chart loading failed</p>
                      <p class="text-sm">Please refresh the page</p>
                    </div>
                  </div>
                `;
              }
              if (macroChartElement) {
                macroChartElement.innerHTML = `
                  <div class="flex items-center justify-center h-full text-gray-500">
                    <div class="text-center">
                      <p class="mb-2">Chart loading failed</p>
                      <p class="text-sm">Please refresh the page</p>
                    </div>
                  </div>
                `;
              }
            }
          } else {
            console.warn("Chart elements not found in DOM, retrying...");
            // Retry after a short delay
            setTimeout(checkAndInitializeCharts, 500);
          }
        };
        
        // Start the check process with a small delay to ensure DOM is ready
        setTimeout(checkAndInitializeCharts, 100);
        
      } catch (error) {
        console.error("Error preparing chart data:", error);
        
        // Show error message in chart containers
        const combinedChartElement = document.getElementById('combined-nutrition-chart');
        const macroChartElement = document.getElementById('macro-distribution-chart');
        
        if (combinedChartElement) {
          combinedChartElement.innerHTML = `
            <div class="flex items-center justify-center h-full text-gray-500">
              <div class="text-center">
                <p class="mb-2">Unable to load chart data</p>
                <p class="text-sm">Please check your connection and try again</p>
              </div>
            </div>
          `;
        }
        if (macroChartElement) {
          macroChartElement.innerHTML = `
            <div class="flex items-center justify-center h-full text-gray-500">
              <div class="text-center">
                <p class="mb-2">Unable to load chart data</p>
                <p class="text-sm">Please check your connection and try again</p>
              </div>
            </div>
          `;
        }
      }
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
           
           {/* Combined Charts Section - Improved */}
           {/* Combined Nutrition Chart */}
           <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <BarChart3 className="h-5 w-5 text-purple-500" />
                 Nutrition Overview
               </CardTitle>
               <p className="text-sm text-gray-600 mt-2">
                 Complete nutrition tracking with calories, protein, carbs, fat, and fiber
               </p>
             </CardHeader>
             <CardContent>
               <div className="h-80" id="combined-nutrition-chart">
                 {loading && <Skeleton className="h-full w-full" />}
               </div>
             </CardContent>
           </Card>

           {/* Macro Distribution Chart */}
           <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Target className="h-5 w-5 text-green-500" />
                 Macro Distribution
               </CardTitle>
               <p className="text-sm text-gray-600 mt-2">
                 Breakdown of your macronutrient ratios
               </p>
             </CardHeader>
             <CardContent>
               <div className="h-64" id="macro-distribution-chart">
                 {loading && <Skeleton className="h-full w-full" />}
               </div>
             </CardContent>
           </Card>
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
