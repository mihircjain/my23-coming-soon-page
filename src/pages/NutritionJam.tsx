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

  // Safe date formatting
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
          {/* Date Header */}
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium text-gray-600">
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

// Combined Meals Card Component (ActivityJam Recent Activities style)
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

  // Calculate pace-like metric (calories per item)
  const caloriesPerItem = foodCount > 0 ? Math.round(totalCalories / foodCount) : 0;

  return (
    <Card 
      className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">
            {preset.name}
          </CardTitle>
          <Badge variant="secondary" className="ml-2 shrink-0">
            Preset
          </Badge>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <CalendarIcon className="h-4 w-4 mr-2" />
          Combined Meal
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(totalCalories)}
            </div>
            <div className="text-xs text-gray-600">calories</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {foodCount}
            </div>
            <div className="text-xs text-gray-600">items</div>
          </div>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Avg per item:</span>
            <span className="font-medium">{caloriesPerItem} cal</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Protein:</span>
            <span className="font-medium">{Math.round(totalProtein)}g</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Carbs:</span>
            <span className="font-medium flex items-center">
              <Activity className="h-3 w-3 mr-1 text-green-500" />
              {Math.round(totalCarbs)}g
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Fat:</span>
            <span className="font-medium flex items-center">
              <Target className="h-3 w-3 mr-1 text-purple-500" />
              {Math.round(totalFat)}g
            </span>
          </div>
          {totalFiber > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Fiber:</span>
              <span className="font-medium flex items-center">
                <Flame className="h-3 w-3 mr-1 text-amber-500" />
                {Math.round(totalFiber)}g
              </span>
            </div>
          )}
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

  // Vegetarian food database for lookup
  const vegetarianFoods = [
    { name: "Mixed Vegetable Sabzi", servingSize: "50g", calories: 28, protein: 0.7, carbs: 3.6, fat: 1.2, fiber: 1.4 },
    { name: "Mushroom Burrito", servingSize: "300g", calories: 327, protein: 10.9, carbs: 48.2, fat: 11.4, fiber: 11.1 },
    { name: "Tiramisu Ice Cream", servingSize: "100g", calories: 230, protein: 4.4, carbs: 28.3, fat: 4.4, fiber: 0.0 },
    { name: "Beetroot Hummus Toast", servingSize: "126g", calories: 216, protein: 5.3, carbs: 26.0, fat: 9.1, fiber: 6.1 },
    { name: "Mango Peach Smoothie", servingSize: "125ml", calories: 106, protein: 2.3, carbs: 24.2, fat: 0.2, fiber: 1.3 },
    { name: "Lotus Biscoff Cheesecake", servingSize: "50g", calories: 198, protein: 2, fat: 15.3, carbs: 13.7, fiber: 0.1 },
    { name: "Knorr Pizza and Pasta Sauce", servingSize: "40g", calories: 33, protein: 0.5, carbs: 5.6, fat: 1.0, fiber: 0.4 },
    { name: "71% Dark Chocolate", servingSize: "52g", calories: 310, protein: 4.2, carbs: 20.8, fat: 23.4, fiber: 4.2 },
    { name: "Caramel and Salted Popcorn", servingSize: "120g", calories: 461, protein: 9.0, carbs: 100.8, fat: 3.6, fiber: 10.2 },
    { name: "Pyaaz ka Paratha", servingSize: "150g", calories: 287, protein: 5.9, carbs: 34.9, fat: 14.1, fiber: 6.2 },
    { name: "Capsicum Tomato Onion", servingSize: "120g", calories: 77, protein: 1.3, carbs: 7.0, fat: 5.2, fiber: 2.5 },
    { name: "13g Protein Bar, Double Cocoa", servingSize: "52g", calories: 256, protein: 13.3, carbs: 19.6, fat: 13.8, fiber: 5.4 },
    { name: "Ultra Beer, Kingfisher", servingSize: "330ml", calories: 92, protein: 0.0, carbs: 7.9, fat: 0.0, fiber: 0.0 },
    { name: "Avocado Toast", servingSize: "90g", calories: 187, protein: 4.9, carbs: 18.6, fat: 10.1, fiber: 4.2 },
    { name: "Burmese Fried Rice", servingSize: "150g", calories: 155, protein: 4.2, carbs: 27.1, fat: 3.4, fiber: 1.0 },
    { name: "Cocktail", servingSize: "480g", calories: 480, protein: 0.0, carbs: 48.0, fat: 0.0, fiber: 0.0 },
    { name: "Idli (Regular)", servingSize: "50g", calories: 73, protein: 2.2, carbs: 15.2, fat: 0.3, fiber: 1.3 },
    { name: "Mocha", servingSize: "250ml", calories: 202, protein: 9.3, carbs: 20.7, fat: 10.4, fiber: 1.7 },
    { name: "Bhel", servingSize: "100g", calories: 222, protein: 5.5, carbs: 29.0, fat: 9.6, fiber: 3.1 },
    { name: "Wada", servingSize: "60g", calories: 154, protein: 5.8, carbs: 14.3, fat: 8.2, fiber: 2.9 },
    { name: "Parmesan Garlic Popcorn, Smartfood", servingSize: "48g", calories: 257, protein: 3.4, carbs: 24.0, fat: 17.1, fiber: 3.4 },
    { name: "Zucchini Bell Pepper Salad", servingSize: "50g", calories: 48, protein: 1.0, carbs: 1.7, fat: 4.4, fiber: 0.6 },
    { name: "Durum Wheat Pasta", servingSize: "60g", calories: 209, protein: 7.5, carbs: 43.1, fat: 0.8, fiber: 1.5 },
    { name: "Pani Puri", servingSize: "197g", calories: 265, protein: 5.0, carbs: 36.7, fat: 11.0, fiber: 3.2 },
    { name: "Rajma Tikki Burger", servingSize: "100g", calories: 250, protein: 8.0, carbs: 30.0, fat: 10.0, fiber: 5.0 },
    { name: "Salted Caramel Popcorn (PVR/INOX)", servingSize: "95g", calories: 461, protein: 5.0, carbs: 80.0, fat: 15.0, fiber: 8.0 },
    { name: "Omani Dates, Happilo", servingSize: "24g", calories: 68, protein: 0.6, carbs: 18.0, fat: 0.1, fiber: 1.9 },
    { name: "Mango", servingSize: "130g", calories: 96, protein: 0.8, carbs: 22.0, fat: 0.5, fiber: 2.6 },
    { name: "Slim n Trim Skimmed Milk, Amul", servingSize: "100ml", calories: 35, protein: 3.5, carbs: 5.0, fat: 0.1, fiber: 0.0 },
    { name: "Walnut", servingSize: "6g", calories: 40, protein: 0.9, carbs: 0.6, fat: 3.9, fiber: 0.3 },
    { name: "Raw Whey Protein, Unflavoured", servingSize: "47g", calories: 178, protein: 35.6, carbs: 3.5, fat: 2.4, fiber: 0.4 },
    { name: "Almonds", servingSize: "6g", calories: 37, protein: 1.3, carbs: 1.3, fat: 3.0, fiber: 0.8 },
    { name: "Nutty Gritties Super Seeds Mix", servingSize: "9g", calories: 64, protein: 2.4, carbs: 1.1, fat: 4.9, fiber: 1.6 },
    { name: "Skyr High Protein Yogurt, Milky Mist", servingSize: "100g", calories: 100, protein: 12.0, carbs: 9.5, fat: 1.5, fiber: 0.0 },
    { name: "Oats, Quaker", servingSize: "40g", calories: 163, protein: 4.7, carbs: 27.4, fat: 3.8, fiber: 4.0 },
    { name: "Low Fat Paneer, Milky Mist", servingSize: "100g", calories: 204, protein: 25.0, carbs: 5.8, fat: 9.0, fiber: 0.0 },
    { name: "Roti", servingSize: "50g", calories: 122, protein: 4.3, carbs: 24.8, fat: 0.6, fiber: 3.8 },
    { name: "Cocoa Whey Protein, The Whole Truth", servingSize: "48g", calories: 191, protein: 34.1, carbs: 8.6, fat: 2.1, fiber: 2.1 },
    { name: "Sambhar", servingSize: "150g", calories: 114, protein: 5.5, carbs: 16.2, fat: 3.0, fiber: 3.7 },
    { name: "Bhindi Fry", servingSize: "90g", calories: 83, protein: 1.3, carbs: 5.5, fat: 6.3, fiber: 2.3 },
    { name: "Dal", servingSize: "150g", calories: 115, protein: 6.8, carbs: 17.7, fat: 1.9, fiber: 2.8 },
    { name: "Dosa", servingSize: "120g", calories: 221, protein: 5.4, carbs: 33.9, fat: 7.1, fiber: 1.9 },
    { name: "Green Moong Dal Cheela", servingSize: "200g", calories: 363, protein: 19, carbs: 44.3, fat: 12.3, fiber: 13.6 },
    { name: "100% Whole Wheat Bread, Britannia", servingSize: "27g", calories: 67, protein: 2.2, carbs: 13.8, fat: 0.6, fiber: 1.1 },
    { name: "Amul Cheese Slice", servingSize: "20g", calories: 62, protein: 4.0, carbs: 0.3, fat: 5.0, fiber: 0.0 },
    { name: "Bhaji of Pav Bhaji", servingSize: "150g", calories: 137, protein: 2.3, carbs: 16.8, fat: 6.9, fiber: 2.1 },
    { name: "Protein Bar, Double Cocoa, Whole Truth", servingSize: "52g", calories: 256, protein: 13.3, carbs: 19.6, fat: 13.8, fiber: 5.4 },
    { name: "Masala Chai (no sugar)", servingSize: "180ml", calories: 58, protein: 3.2, carbs: 4.1, fat: 3.3, fiber: 0.3 },
    { name: "Aloo Beans", servingSize: "100g", calories: 93, protein: 1.9, carbs: 11.5, fat: 4.5, fiber: 2.7 },
    { name: "Low Fat Paneer Paratha", servingSize: "200g", calories: 445, protein: 26.4, carbs: 40.4, fat: 20.0, fiber: 5.8 },
    { name: "Aloo Palak", servingSize: "100g", calories: 73, protein: 1.8, carbs: 9.4, fat: 3.3, fiber: 2.1 },
    { name: "Elite Gel, Unived", servingSize: "75.7g", calories: 190, protein: 1.0, carbs: 45.0, fat: 0.7, fiber: 0.0 },
    { name: "Guilt Free Ice Cream, Belgian Chocolate", servingSize: "125ml (80g)", calories: 134, protein: 9.8, carbs: 10.4, fat: 5.8, fiber: 1.7 },
    { name: "Dutch Chocolate Ice Cream", servingSize: "130ml", calories: 175, protein: 3.9, carbs: 19.0, fat: 9.2, fiber: 0.0 },
    { name: "Pizza, Garden Veggie", servingSize: "2.5 Slices (267.5g)", calories: 434, protein: 24.1, carbs: 60.2, fat: 12.0, fiber: 9.6 }
  ];

  // Helper function to get food details by name
  const getFoodByName = (name: string) => {
    return vegetarianFoods.find(food => food.name === name);
  };

  // Convert meal presets to the format expected by the UI
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
    if (lastXDaysData && lastXDaysData.length > 0) {
      try {
        const chartData = prepareChartData(lastXDaysData);
        initializeCharts(chartData);
      } catch (error) {
        console.error('Error initializing charts:', error);
      }
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
                      {lastXDaysData && lastXDaysData.length > 0 ? lastXDaysData.map((log, index) => (
                        <DailyMacroBox
                          key={log?.date || index}
                          log={log}
                          date={log?.date}
                          isToday={log?.date === getTodayDateString()}
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
