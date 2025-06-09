import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Utensils, Calendar as CalendarIcon, BarChart3, Plus, Minus, Target, TrendingUp, Activity, Flame, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FoodSelector } from "@/components/nutrition/FoodSelector";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import { PublicFoodLog } from "@/components/nutrition/PublicFoodLog";

// Safe wrapper functions
const safeFormatDateToYYYYMMDD = (date) => {
  try {
    if (!date) return new Date().toISOString().split('T')[0];
    if (typeof formatDateToYYYYMMDD === 'function') {
      return formatDateToYYYYMMDD(date);
    }
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date().toISOString().split('T')[0];
  }
};

const safeGetTodayDateString = () => {
  try {
    if (typeof getTodayDateString === 'function') {
      return getTodayDateString();
    }
    return new Date().toISOString().split('T')[0];
  } catch (error) {
    console.error('Error getting today string:', error);
    return new Date().toISOString().split('T')[0];
  }
};

const safeFormatDateForDisplay = (date) => {
  try {
    if (!date) return 'Invalid Date';
    if (typeof formatDateForDisplay === 'function') {
      return formatDateForDisplay(date);
    }
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting display date:', error);
    return 'Invalid Date';
  }
};

const safeCalculateTotals = (entries) => {
  try {
    if (typeof calculateTotals === 'function') {
      return calculateTotals(entries);
    }
    if (!Array.isArray(entries)) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    }
    return entries.reduce((totals, entry) => {
      const calories = parseFloat(entry?.calories || 0) * parseFloat(entry?.quantity || 1);
      const protein = parseFloat(entry?.protein || 0) * parseFloat(entry?.quantity || 1);
      const carbs = parseFloat(entry?.carbs || 0) * parseFloat(entry?.quantity || 1);
      const fat = parseFloat(entry?.fat || 0) * parseFloat(entry?.quantity || 1);
      const fiber = parseFloat(entry?.fiber || 0) * parseFloat(entry?.quantity || 1);
      return {
        calories: totals.calories + (isNaN(calories) ? 0 : calories),
        protein: totals.protein + (isNaN(protein) ? 0 : protein),
        carbs: totals.carbs + (isNaN(carbs) ? 0 : carbs),
        fat: totals.fat + (isNaN(fat) ? 0 : fat),
        fiber: totals.fiber + (isNaN(fiber) ? 0 : fiber)
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  } catch (error) {
    console.error('Error calculating totals:', error);
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  }
};

// Daily Macro Box Component
const DailyMacroBox = ({ log, date, isToday, onClick }) => {
  const totals = log?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const hasData = log?.entries?.length > 0;
  const calorieGoal = 2000;
  const caloriePercent = Math.min((totals.calories / calorieGoal) * 100, 100);

  const formatDate = (dateValue) => {
    try {
      if (!dateValue) return 'Invalid Date';
      const dateObj = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
      if (isNaN(dateObj.getTime())) return 'Invalid Date';
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

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
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium text-gray-700">
              {formatDate(date)}
            </div>
            {isToday && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium">
                Today
              </span>
            )}
          </div>

          {hasData ? (
            <>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-xl font-bold text-gray-800">
                      {Math.round(totals.calories)}
                    </span>
                    <span className="text-sm text-gray-500">cal</span>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    {Math.round(caloriePercent)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${caloriePercent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center bg-blue-50 rounded-lg py-2">
                  <div className="font-bold text-blue-600">{Math.round(totals.protein)}g</div>
                  <div className="text-gray-500 text-[10px]">Protein</div>
                </div>
                <div className="text-center bg-green-50 rounded-lg py-2">
                  <div className="font-bold text-green-600">{Math.round(totals.carbs)}g</div>
                  <div className="text-gray-500 text-[10px]">Carbs</div>
                </div>
                <div className="text-center bg-purple-50 rounded-lg py-2">
                  <div className="font-bold text-purple-600">{Math.round(totals.fat)}g</div>
                  <div className="text-gray-500 text-[10px]">Fat</div>
                </div>
                <div className="text-center bg-amber-50 rounded-lg py-2">
                  <div className="font-bold text-amber-600">{Math.round(totals.fiber || 0)}g</div>
                  <div className="text-gray-500 text-[10px]">Fiber</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mt-2">
                <Utensils className="h-3 w-3" />
                <span>{log.entries.length} items logged</span>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-gray-400 text-sm mb-1">No data</div>
              <div className="text-xs text-gray-400">Tap to log food</div>
              <Plus className="h-6 w-6 mx-auto mt-2 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Food Item Card Component
const FoodItemCard = ({ entry, index, onRemove, onUpdateQuantity }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [quantity, setQuantity] = useState(entry.quantity);

  const handleSave = () => {
    onUpdateQuantity(index, quantity);
    setIsEditing(false);
  };

  const safeNumber = (value) => {
    const num = parseFloat(value);
    return isNaN(num) || !isFinite(num) ? 0 : num;
  };

  const totalCals = Math.round(safeNumber(entry.calories) * safeNumber(entry.quantity));
  const totalProtein = Math.round(safeNumber(entry.protein) * safeNumber(entry.quantity));

  return (
    <Card className="group hover:shadow-md transition-all duration-200 bg-gradient-to-r from-white to-gray-50">
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
                    onClick={() => onUpdateQuantity(index, Math.max(0.1, safeNumber(entry.quantity) - 0.5))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-16 text-center text-sm font-medium">
                    {safeNumber(entry.quantity)} {entry.unit}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateQuantity(index, safeNumber(entry.quantity) + 0.5)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="h-3 w-3" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRemove(index)}
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
  );
};

// Combined Meals Card Component
const CombinedMealCard = ({ preset, onClick }) => {
  const totalCalories = preset.foods?.reduce((sum, food) => 
    sum + (food.calories || 0) * (food.quantity || 1), 0) || 0;
  const totalProtein = preset.foods?.reduce((sum, food) => 
    sum + (food.protein || 0) * (food.quantity || 1), 0) || 0;
  const totalCarbs = preset.foods?.reduce((sum, food) => 
    sum + (food.carbs || 0) * (food.quantity || 1), 0) || 0;
  const totalFat = preset.foods?.reduce((sum, food) => 
    sum + (food.fat || 0) * (food.quantity || 1), 0) || 0;
  const totalFiber = preset.foods?.reduce((sum, food) => 
    sum + (food.fiber || 0) * (food.quantity || 1), 0) || 0;

  const foodCount = preset.foods?.length || 0;

  return (
    <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-blue-300">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">
            {preset.name}
          </CardTitle>
          <Badge variant="secondary" className="ml-2 shrink-0 bg-blue-100 text-blue-700">
            Preset
          </Badge>
        </div>
        
        {/* Food items description */}
        <div className="text-sm text-gray-600 mb-3">
          <div className="line-clamp-2">
            {preset.foods?.slice(0, 3).map(food => food.foodId).join(", ")}
            {foodCount > 3 && ` + ${foodCount - 3} more items`}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(totalCalories)}
            </div>
            <div className="text-xs text-orange-700 font-medium">calories</div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">
              {foodCount}
            </div>
            <div className="text-xs text-blue-700 font-medium">items</div>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
          <div className="text-center bg-blue-50 rounded-lg py-2 border border-blue-100">
            <div className="font-bold text-blue-600">{Math.round(totalProtein)}g</div>
            <div className="text-blue-700 text-[10px]">Protein</div>
          </div>
          <div className="text-center bg-green-50 rounded-lg py-2 border border-green-100">
            <div className="font-bold text-green-600">{Math.round(totalCarbs)}g</div>
            <div className="text-green-700 text-[10px]">Carbs</div>
          </div>
          <div className="text-center bg-purple-50 rounded-lg py-2 border border-purple-100">
            <div className="font-bold text-purple-600">{Math.round(totalFat)}g</div>
            <div className="text-purple-700 text-[10px]">Fat</div>
          </div>
          <div className="text-center bg-amber-50 rounded-lg py-2 border border-amber-100">
            <div className="font-bold text-amber-600">{Math.round(totalFiber)}g</div>
            <div className="text-amber-700 text-[10px]">Fiber</div>
          </div>
        </div>

        <Button 
          onClick={onClick}
          className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-medium py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Meal to Today
        </Button>
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

  // Real meal presets
  const mealPresets = [
    {
      id: 1,
      name: "Morning Smoothie",
      foods: [
        { foodId: "Oats, Quaker", calories: 163, protein: 4.7, carbs: 27.4, fat: 3.8, fiber: 4.0, quantity: 1, unit: "serving" },
        { foodId: "Omani Dates, Happilo", calories: 68, protein: 0.6, carbs: 18.0, fat: 0.1, fiber: 1.9, quantity: 1, unit: "serving" },
        { foodId: "Almonds", calories: 37, protein: 1.3, carbs: 1.3, fat: 3.0, fiber: 0.8, quantity: 1, unit: "serving" },
        { foodId: "Skyr High Protein Yogurt, Milky Mist", calories: 100, protein: 12.0, carbs: 9.5, fat: 1.5, fiber: 0.0, quantity: 1, unit: "serving" },
        { foodId: "Raw Whey Protein, Unflavoured", calories: 178, protein: 35.6, carbs: 3.5, fat: 2.4, fiber: 0.4, quantity: 1, unit: "serving" },
        { foodId: "Nutty Gritties Super Seeds Mix", calories: 64, protein: 2.4, carbs: 1.1, fat: 4.9, fiber: 1.6, quantity: 1, unit: "serving" },
        { foodId: "Slim n Trim Skimmed Milk, Amul", calories: 35, protein: 3.5, carbs: 5.0, fat: 0.1, fiber: 0.0, quantity: 1, unit: "serving" },
        { foodId: "Walnut", calories: 40, protein: 0.9, carbs: 0.6, fat: 3.9, fiber: 0.3, quantity: 1, unit: "serving" },
        { foodId: "Mango", calories: 96, protein: 0.8, carbs: 22.0, fat: 0.5, fiber: 2.6, quantity: 1, unit: "serving" }
      ]
    },
    {
      id: 2,
      name: "Evening Smoothie",
      foods: [
        { foodId: "Cocoa Whey Protein, The Whole Truth", calories: 191, protein: 34.1, carbs: 8.6, fat: 2.1, fiber: 2.1, quantity: 1, unit: "serving" },
        { foodId: "Slim n Trim Skimmed Milk, Amul", calories: 35, protein: 3.5, carbs: 5.0, fat: 0.1, fiber: 0.0, quantity: 1, unit: "serving" }
      ]
    },
    {
      id: 3,
      name: "Bread Pizza",
      foods: [
        { foodId: "Capsicum Tomato Onion", calories: 77, protein: 1.3, carbs: 7.0, fat: 5.2, fiber: 2.5, quantity: 1, unit: "serving" },
        { foodId: "100% Whole Wheat Bread, Britannia", calories: 67, protein: 2.2, carbs: 13.8, fat: 0.6, fiber: 1.1, quantity: 4, unit: "slices" },
        { foodId: "Knorr Pizza and Pasta Sauce", calories: 33, protein: 0.5, carbs: 5.6, fat: 1.0, fiber: 0.4, quantity: 1.25, unit: "serving" },
        { foodId: "Amul Cheese Slice", calories: 62, protein: 4.0, carbs: 0.3, fat: 5.0, fiber: 0.0, quantity: 4, unit: "slices" }
      ]
    },
    {
      id: 4,
      name: "Aloo Beans Dal Roti",
      foods: [
        { foodId: "Roti", calories: 122, protein: 4.3, carbs: 24.8, fat: 0.6, fiber: 3.8, quantity: 1, unit: "serving" },
        { foodId: "Aloo Beans", calories: 93, protein: 1.9, carbs: 11.5, fat: 4.5, fiber: 2.7, quantity: 1, unit: "serving" },
        { foodId: "Dal", calories: 115, protein: 6.8, carbs: 17.7, fat: 1.9, fiber: 2.8, quantity: 1, unit: "serving" }
      ]
    },
    {
      id: 5,
      name: "Paneer Chilla",
      foods: [
        { foodId: "Green Moong Dal Cheela", calories: 363, protein: 19, carbs: 44.3, fat: 12.3, fiber: 13.6, quantity: 1, unit: "serving" },
        { foodId: "Low Fat Paneer, Milky Mist", calories: 204, protein: 25.0, carbs: 5.8, fat: 9.0, fiber: 0.0, quantity: 0.5, unit: "serving" }
      ]
    },
    {
      id: 6,
      name: "Bhindi Dal Roti",
      foods: [
        { foodId: "Bhindi Fry", calories: 83, protein: 1.3, carbs: 5.5, fat: 6.3, fiber: 2.3, quantity: 1, unit: "serving" },
        { foodId: "Dal", calories: 115, protein: 6.8, carbs: 17.7, fat: 1.9, fiber: 2.8, quantity: 1, unit: "serving" },
        { foodId: "Roti", calories: 122, protein: 4.3, carbs: 24.8, fat: 0.6, fiber: 3.8, quantity: 1, unit: "serving" }
      ]
    },
    {
      id: 7,
      name: "Matar Paneer + Dal",
      foods: [
        { foodId: "Mixed Vegetable Sabzi", calories: 28, protein: 0.7, carbs: 3.6, fat: 1.2, fiber: 1.4, quantity: 2, unit: "servings" },
        { foodId: "Low Fat Paneer, Milky Mist", calories: 204, protein: 25.0, carbs: 5.8, fat: 9.0, fiber: 0.0, quantity: 1, unit: "serving" },
        { foodId: "Roti", calories: 122, protein: 4.3, carbs: 24.8, fat: 0.6, fiber: 3.8, quantity: 1, unit: "serving" },
        { foodId: "Dal", calories: 115, protein: 6.8, carbs: 17.7, fat: 1.9, fiber: 2.8, quantity: 1, unit: "serving" }
      ]
    },
    {
      id: 8,
      name: "Dosa Sambhar",
      foods: [
        { foodId: "Dosa", calories: 221, protein: 5.4, carbs: 33.9, fat: 7.1, fiber: 1.9, quantity: 1, unit: "serving" },
        { foodId: "Sambhar", calories: 114, protein: 5.5, carbs: 16.2, fat: 3.0, fiber: 3.7, quantity: 1, unit: "serving" }
      ]
    }
  ];

  const loadDailyLog = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const dateString = safeFormatDateToYYYYMMDD(date);
      if (!dateString) {
        throw new Error('Invalid date provided');
      }
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
      // Generate last 7 days data even if some days are missing
      const last7Days = [];
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = safeFormatDateToYYYYMMDD(date);
        
        const existingLog = data?.find(log => log.date === dateString);
        if (existingLog) {
          last7Days.push(existingLog);
        } else {
          // Create empty log for missing days
          last7Days.push({
            date: dateString,
            entries: [],
            totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
            lastUpdated: null
          });
        }
      }
      
      setLastXDaysData(last7Days);
    } catch (error) {
      console.error('Error loading last X days data:', error);
      setLastXDaysData([]);
    }
  }, []);

  const loadWeeklyAverages = useCallback(async () => {
    try {
      const averages = await getWeeklyAveragesFirestore();
      setWeeklyAverages(averages);
    } catch (error) {
      console.error('Error loading weekly averages:', error);
      setWeeklyAverages(null);
    }
  }, []);

  useEffect(() => {
    loadDailyLog(selectedDate);
    loadLastXDaysData();
    loadWeeklyAverages();
  }, [selectedDate, loadDailyLog, loadLastXDaysData, loadWeeklyAverages]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      try {
        if (isNaN(date.getTime())) {
          console.error('Invalid date selected');
          return;
        }
        setSelectedDate(date);
        setIsCalendarOpen(false);
      } catch (error) {
        console.error('Error handling date select:', error);
      }
    }
  };

  const handleAddFood = async (foodEntry: FoodEntry) => {
    if (!currentLog) return;

    setSaving(true);
    try {
      const updatedEntries = [...currentLog.entries, foodEntry];
      const updatedTotals = safeCalculateTotals(updatedEntries);
      
      const updatedLog: DailyLog = {
        ...currentLog,
        entries: updatedEntries,
        totals: updatedTotals,
        lastUpdated: new Date().toISOString()
      };

      await saveDailyLogToFirestore(updatedLog);
      setCurrentLog(updatedLog);
      toast.success('Food added successfully!');
      
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
      const updatedTotals = safeCalculateTotals(updatedEntries);
      
      const updatedLog: DailyLog = {
        ...currentLog,
        entries: updatedEntries,
        totals: updatedTotals,
        lastUpdated: new Date().toISOString()
      };

      await saveDailyLogToFirestore(updatedLog);
      setCurrentLog(updatedLog);
      toast.success('Food removed successfully!');
      
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
      const updatedTotals = safeCalculateTotals(updatedEntries);
      
      const updatedLog: DailyLog = {
        ...currentLog,
        entries: updatedEntries,
        totals: updatedTotals,
        lastUpdated: new Date().toISOString()
      };

      await saveDailyLogToFirestore(updatedLog);
      setCurrentLog(updatedLog);
      toast.success('Quantity updated successfully!');
      
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
        foodId: food.foodId || food.name,
        calories: Number(food.calories) || 0,
        protein: Number(food.protein) || 0,
        carbs: Number(food.carbs) || 0,
        fat: Number(food.fat) || 0,
        fiber: Number(food.fiber) || 0,
        quantity: Number(food.quantity) || 1,
        unit: food.unit || 'serving',
        timestamp: new Date().toISOString()
      }));
      
      const updatedEntries = [...currentLog.entries, ...newEntries];
      const updatedTotals = safeCalculateTotals(updatedEntries);
      
      const updatedLog: DailyLog = {
        ...currentLog,
        entries: updatedEntries,
        totals: updatedTotals,
        lastUpdated: new Date().toISOString()
      };

      await saveDailyLogToFirestore(updatedLog);
      setCurrentLog(updatedLog);
      toast.success(`${preset.name} added successfully!`);
      
      loadLastXDaysData();
    } catch (error) {
      console.error('Error adding preset:', error);
      toast.error('Failed to add preset');
    } finally {
      setSaving(false);
    }
  };

  const isToday = safeFormatDateToYYYYMMDD(selectedDate) === safeGetTodayDateString();
  const safeTodayString = safeGetTodayDateString();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col">
      <Toaster position="top-right" />
      
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
                  {selectedDate ? safeFormatDateForDisplay(selectedDate) : <span>Pick a date</span>}
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

      <main className="flex-1 px-6 md:px-12 pb-12">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="today">Today's Log</TabsTrigger>
            <TabsTrigger value="last7days">Last 7 Days</TabsTrigger>
            <TabsTrigger value="presets">Combined Meals</TabsTrigger>
            <TabsTrigger value="public">Public Logs</TabsTrigger>
          </TabsList>

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
                <div className="lg:col-span-2 space-y-6">
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

                <div className="space-y-6">
                  <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-purple-800">
                        <BarChart3 className="h-5 w-5 text-purple-600" />
                        Daily Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Calories Progress */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Flame className="h-5 w-5 text-orange-500" />
                            <span className="font-semibold text-gray-800">Calories</span>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-orange-600">
                              {Math.round(currentLog?.totals?.calories || 0)}
                            </div>
                            <div className="text-sm text-gray-500">/ 2000 goal</div>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-orange-400 to-red-500 h-3 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(((currentLog?.totals?.calories || 0) / 2000) * 100, 100)}%`
                            }}
                          />
                        </div>
                        <div className="text-center text-sm text-gray-600">
                          {Math.round(((currentLog?.totals?.calories || 0) / 2000) * 100)}% of daily goal
                        </div>
                      </div>

                      {/* Macros Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                          <Target className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                          <div className="text-2xl font-bold text-blue-600">
                            {Math.round(currentLog?.totals?.protein || 0)}g
                          </div>
                          <div className="text-xs text-blue-700 font-medium">Protein</div>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                          <Activity className="h-5 w-5 mx-auto mb-2 text-green-500" />
                          <div className="text-2xl font-bold text-green-600">
                            {Math.round(currentLog?.totals?.carbs || 0)}g
                          </div>
                          <div className="text-xs text-green-700 font-medium">Carbs</div>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                          <div className="w-5 h-5 mx-auto mb-2 bg-purple-500 rounded-full"></div>
                          <div className="text-2xl font-bold text-purple-600">
                            {Math.round(currentLog?.totals?.fat || 0)}g
                          </div>
                          <div className="text-xs text-purple-700 font-medium">Fat</div>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                          <div className="w-5 h-5 mx-auto mb-2 bg-amber-500 rounded-sm"></div>
                          <div className="text-2xl font-bold text-amber-600">
                            {Math.round(currentLog?.totals?.fiber || 0)}g
                          </div>
                          <div className="text-xs text-amber-700 font-medium">Fiber</div>
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Utensils className="h-4 w-4" />
                            Foods logged
                          </span>
                          <span className="font-semibold text-gray-800">
                            {currentLog?.entries?.length || 0}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {weeklyAverages && (
                    <MacroAveragesSummary averages={weeklyAverages} />
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="last7days" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Last 7 Days Nutrition Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                  {lastXDaysData && lastXDaysData.length > 0 ? lastXDaysData.map((log, index) => (
                    <DailyMacroBox
                      key={log?.date || index}
                      log={log}
                      date={log?.date}
                      isToday={log?.date === safeTodayString}
                      onClick={() => {
                        if (log?.date) {
                          try {
                            const date = new Date(log.date);
                            if (!isNaN(date.getTime())) {
                              setSelectedDate(date);
                              setActiveTab("today");
                            }
                          } catch (error) {
                            console.error('Error handling date click:', error);
                          }
                        }
                      }}
                    />
                  )) : (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No data available for the last 7 days</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="presets" className="space-y-6">
            <section>
              <div className="flex items-center mb-6">
                <CalendarIcon className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Combined Meals (Presets)</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mealPresets.map((preset) => (
                  <CombinedMealCard
                    key={preset.id}
                    preset={preset}
                    onClick={() => handleAddPreset(preset)}
                  />
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="public" className="space-y-6">
            <PublicFoodLog />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default NutritionJam;
