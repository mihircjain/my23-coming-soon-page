import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Utensils, Calendar as CalendarIcon, BarChart3, CheckCircle, Plus, Minus, Target, TrendingUp, Activity, Flame, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(index);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 p-4 bg-white border rounded-lg shadow-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-700 mb-2">Nutrition per {entry.unit}</div>
              <div className="space-y-1 text-gray-600">
                <div>Calories: {Math.round(safeNumber(entry.calories))}</div>
                <div>Protein: {Math.round(safeNumber(entry.protein))}g</div>
                <div>Carbs: {Math.round(safeNumber(entry.carbs))}g</div>
                <div>Fat: {Math.round(safeNumber(entry.fat))}g</div>
                {entry.fiber && <div>Fiber: {Math.round(safeNumber(entry.fiber))}g</div>}
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-700 mb-2">Total ({safeNumber(entry.quantity)} {entry.unit})</div>
              <div className="space-y-1 text-gray-600">
                <div>Calories: {totalCals}</div>
                <div>Protein: {totalProtein}g</div>
                <div>Carbs: {totalCarbs}g</div>
                <div>Fat: {totalFat}g</div>
                {entry.fiber && <div>Fiber: {totalFiber}g</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Combined Meals Card Component (Recent Activities style)
const CombinedMealCard = ({ preset, onClick }) => {
  const totalCalories = preset.foods?.reduce((sum, food) => 
    sum + (food.calories || 0) * (food.quantity || 1), 0) || 0;
  const totalProtein = preset.foods?.reduce((sum, food) => 
    sum + (food.protein || 0) * (food.quantity || 1), 0) || 0;
  const totalCarbs = preset.foods?.reduce((sum, food) => 
    sum + (food.carbs || 0) * (food.quantity || 1), 0) || 0;
  const totalFat = preset.foods?.reduce((sum, food) => 
    sum + (food.fat || 0) * (food.quantity || 1), 0) || 0;

  const foodCount = preset.foods?.length || 0;

  return (
    <Card 
      className="cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg group bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-green-100"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Preset Header */}
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium text-gray-600">
              {preset.name}
            </div>
            <Badge className="text-xs bg-green-100 text-green-600 hover:bg-green-100">
              Preset
            </Badge>
          </div>

          {/* Calories with progress bar */}
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
                {Math.round((totalCalories / 2000) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((totalCalories / 2000) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Macro Breakdown */}
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
              <div className="font-semibold text-amber-600">{Math.round(0)}g</div>
              <div className="text-gray-500">Fib</div>
            </div>
          </div>

          {/* Meals count */}
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
            <Utensils className="h-3 w-3" />
            <span>{foodCount} items</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const NutritionJam = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentLog, setCurrentLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastXDaysData, setLastXDaysData] = useState<DailyLog[]>([]);
  const [weeklyAverages, setWeeklyAverages] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("today");

  // Sample meal presets data (you can replace this with actual data from your backend)
  const mealPresets = [
    {
      id: 1,
      name: "High Protein Breakfast",
      foods: [
        { foodId: "Eggs (2 large)", calories: 140, protein: 12, carbs: 1, fat: 10, quantity: 1, unit: "serving" },
        { foodId: "Greek Yogurt", calories: 100, protein: 17, carbs: 6, fat: 0, quantity: 1, unit: "cup" },
        { foodId: "Banana", calories: 105, protein: 1, carbs: 27, fat: 0, quantity: 1, unit: "medium" }
      ]
    },
    {
      id: 2,
      name: "Post-Workout Meal",
      foods: [
        { foodId: "Chicken Breast", calories: 165, protein: 31, carbs: 0, fat: 3.6, quantity: 100, unit: "g" },
        { foodId: "Brown Rice", calories: 216, protein: 5, carbs: 45, fat: 1.8, quantity: 1, unit: "cup" },
        { foodId: "Broccoli", calories: 25, protein: 3, carbs: 5, fat: 0, quantity: 1, unit: "cup" }
      ]
    },
    {
      id: 3,
      name: "Healthy Snack",
      foods: [
        { foodId: "Almonds", calories: 164, protein: 6, carbs: 6, fat: 14, quantity: 28, unit: "g" },
        { foodId: "Apple", calories: 95, protein: 0, carbs: 25, fat: 0, quantity: 1, unit: "medium" }
      ]
    },
    {
      id: 4,
      name: "Balanced Lunch",
      foods: [
        { foodId: "Salmon Fillet", calories: 206, protein: 22, carbs: 0, fat: 12, quantity: 100, unit: "g" },
        { foodId: "Quinoa", calories: 222, protein: 8, carbs: 39, fat: 4, quantity: 1, unit: "cup" },
        { foodId: "Mixed Vegetables", calories: 50, protein: 2, carbs: 10, fat: 0, quantity: 1, unit: "cup" }
      ]
    }
  ];

  const loadDailyLog = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const dateString = formatDateToYYYYMMDD(date);
      const log = await getOrCreateDailyLogFirestore(dateString);
      setCurrentLog(log);
    } catch (error) {
      console.error('Error loading daily log:', error);
      toast.error('Failed to load nutrition data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLastXDaysData = useCallback(async () => {
    try {
      const data = await getLastXDaysDataFirestore(7);
      setLastXDaysData(data);
    } catch (error) {
      console.error('Error loading last X days data:', error);
    }
  }, []);

  const loadWeeklyAverages = useCallback(async () => {
    try {
      const averages = await getWeeklyAveragesFirestore();
      setWeeklyAverages(averages);
    } catch (error) {
      console.error('Error loading weekly averages:', error);
    }
  }, []);

  useEffect(() => {
    loadDailyLog(selectedDate);
    loadLastXDaysData();
    loadWeeklyAverages();
  }, [selectedDate, loadDailyLog, loadLastXDaysData, loadWeeklyAverages]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setIsCalendarOpen(false);
    }
  };

  const handleAddFood = async (foodEntry: FoodEntry) => {
    if (!currentLog) return;

    setSaving(true);
    try {
      const updatedEntries = [...currentLog.entries, foodEntry];
      const updatedTotals = calculateTotals(updatedEntries);
      
      const updatedLog: DailyLog = {
        ...currentLog,
        entries: updatedEntries,
        totals: updatedTotals,
        lastUpdated: new Date().toISOString()
      };

      await saveDailyLogToFirestore(updatedLog);
      setCurrentLog(updatedLog);
      toast.success('Food added successfully!');
      
      // Reload last X days data to update charts
      loadLastXDaysData();
    } catch (error) {
      console.error('Error adding food:', error);
      toast.error('Failed to add food');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFood = async (index: number) => {
    if (!currentLog) return;

    setSaving(true);
    try {
      const updatedEntries = currentLog.entries.filter((_, i) => i !== index);
      const updatedTotals = calculateTotals(updatedEntries);
      
      const updatedLog: DailyLog = {
        ...currentLog,
        entries: updatedEntries,
        totals: updatedTotals,
        lastUpdated: new Date().toISOString()
      };

      await saveDailyLogToFirestore(updatedLog);
      setCurrentLog(updatedLog);
      toast.success('Food removed successfully!');
      
      // Reload last X days data to update charts
      loadLastXDaysData();
    } catch (error) {
      console.error('Error removing food:', error);
      toast.error('Failed to remove food');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateQuantity = async (index: number, newQuantity: number) => {
    if (!currentLog || newQuantity <= 0) return;

    setSaving(true);
    try {
      const updatedEntries = [...currentLog.entries];
      updatedEntries[index] = { ...updatedEntries[index], quantity: newQuantity };
      const updatedTotals = calculateTotals(updatedEntries);
      
      const updatedLog: DailyLog = {
        ...currentLog,
        entries: updatedEntries,
        totals: updatedTotals,
        lastUpdated: new Date().toISOString()
      };

      await saveDailyLogToFirestore(updatedLog);
      setCurrentLog(updatedLog);
      toast.success('Quantity updated successfully!');
      
      // Reload last X days data to update charts
      loadLastXDaysData();
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('Failed to update quantity');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoFillFromYesterday = async () => {
    if (!currentLog) return;

    setSaving(true);
    try {
      const updatedLog = await autoFillFromYesterdayFirestore(currentLog.date);
      setCurrentLog(updatedLog);
      toast.success('Auto-filled from yesterday!');
      
      // Reload last X days data to update charts
      loadLastXDaysData();
    } catch (error) {
      console.error('Error auto-filling from yesterday:', error);
      toast.error('Failed to auto-fill from yesterday');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPreset = async (preset) => {
    if (!currentLog) return;

    setSaving(true);
    try {
      const newEntries = preset.foods.map(food => ({
        ...food,
        timestamp: new Date().toISOString()
      }));
      
      const updatedEntries = [...currentLog.entries, ...newEntries];
      const updatedTotals = calculateTotals(updatedEntries);
      
      const updatedLog: DailyLog = {
        ...currentLog,
        entries: updatedEntries,
        totals: updatedTotals,
        lastUpdated: new Date().toISOString()
      };

      await saveDailyLogToFirestore(updatedLog);
      setCurrentLog(updatedLog);
      toast.success(`${preset.name} added successfully!`);
      
      // Reload last X days data to update charts
      loadLastXDaysData();
    } catch (error) {
      console.error('Error adding preset:', error);
      toast.error('Failed to add preset');
    } finally {
      setSaving(false);
    }
  };

  const isToday = formatDateToYYYYMMDD(selectedDate) === getTodayDateString();

  // Initialize charts when data changes
  useEffect(() => {
    if (lastXDaysData.length > 0) {
      const chartData = prepareChartData(lastXDaysData);
      initializeCharts(chartData);
    }
  }, [lastXDaysData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/overall')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Utensils className="h-8 w-8 text-green-600" />
                Nutrition Jam
              </h1>
              <p className="text-gray-600 mt-1">Track your daily nutrition and meals</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? formatDateForDisplay(selectedDate) : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {isToday && (
              <Button
                onClick={handleAutoFillFromYesterday}
                disabled={saving}
                variant="outline"
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Auto-fill from Yesterday
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 md:px-12 pb-12">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="today">Today's Log</TabsTrigger>
            <TabsTrigger value="last7days">Last 7 Days</TabsTrigger>
            <TabsTrigger value="presets">Combined Meals</TabsTrigger>
            <TabsTrigger value="public">Public Logs</TabsTrigger>
          </TabsList>

          {/* Today's Log Tab */}
          <TabsContent value="today" className="space-y-6">
            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Skeleton className="h-[200px] w-full" />
                  <Skeleton className="h-[300px] w-full" />
                </div>
                <div className="space-y-6">
                  <Skeleton className="h-[150px] w-full" />
                  <Skeleton className="h-[200px] w-full" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Food Entry and List */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Food Selector */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 text-green-600" />
                        Add Food
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FoodSelector onAddFood={handleAddFood} disabled={saving} />
                    </CardContent>
                  </Card>

                  {/* Food List */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Utensils className="h-5 w-5 text-blue-600" />
                        Today's Foods ({currentLog?.entries?.length || 0})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {currentLog?.entries?.length > 0 ? (
                        <div className="space-y-3">
                          {currentLog.entries.map((entry, index) => (
                            <FoodItemCard
                              key={index}
                              entry={entry}
                              index={index}
                              onRemove={handleRemoveFood}
                              onUpdateQuantity={handleUpdateQuantity}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Utensils className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No foods logged yet</p>
                          <p className="text-sm">Add your first food above</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column - Summary and Stats */}
                <div className="space-y-6">
                  {/* Daily Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-purple-600" />
                        Daily Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Calories */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Calories</span>
                            <span className="text-sm text-gray-600">
                              {Math.round(currentLog?.totals?.calories || 0)} / 2000
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full"
                              style={{
                                width: `${Math.min(((currentLog?.totals?.calories || 0) / 2000) * 100, 100)}%`
                              }}
                            />
                          </div>
                        </div>

                        {/* Macros */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-lg font-bold text-blue-600">
                              {Math.round(currentLog?.totals?.protein || 0)}g
                            </div>
                            <div className="text-xs text-gray-600">Protein</div>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <div className="text-lg font-bold text-green-600">
                              {Math.round(currentLog?.totals?.carbs || 0)}g
                            </div>
                            <div className="text-xs text-gray-600">Carbs</div>
                          </div>
                          <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <div className="text-lg font-bold text-purple-600">
                              {Math.round(currentLog?.totals?.fat || 0)}g
                            </div>
                            <div className="text-xs text-gray-600">Fat</div>
                          </div>
                          <div className="text-center p-3 bg-amber-50 rounded-lg">
                            <div className="text-lg font-bold text-amber-600">
                              {Math.round(currentLog?.totals?.fiber || 0)}g
                            </div>
                            <div className="text-xs text-gray-600">Fiber</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Weekly Averages */}
                  {weeklyAverages && (
                    <MacroAveragesSummary averages={weeklyAverages} />
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Last 7 Days Tab */}
          <TabsContent value="last7days" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Last 7 Days Grid */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-green-600" />
                      Last 7 Days Nutrition
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {lastXDaysData.map((log, index) => (
                        <DailyMacroBox
                          key={log.date}
                          log={log}
                          date={log.date}
                          isToday={log.date === getTodayDateString()}
                          onClick={() => {
                            const date = new Date(log.date);
                            setSelectedDate(date);
                            setActiveTab("today");
                          }}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Calories Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <canvas id="caloriesChart"></canvas>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Protein Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <canvas id="proteinChart"></canvas>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Carbs Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <canvas id="carbsChart"></canvas>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Fat Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <canvas id="fatChart"></canvas>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Combined Meals (Presets) Tab */}
          <TabsContent value="presets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Combined Meals (Presets)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {mealPresets.map((preset) => (
                    <CombinedMealCard
                      key={preset.id}
                      preset={preset}
                      onClick={() => handleAddPreset(preset)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Public Logs Tab */}
          <TabsContent value="public" className="space-y-6">
            <PublicFoodLog />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default NutritionJam;

