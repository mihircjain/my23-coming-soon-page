import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Utensils, Calendar as CalendarIcon, BarChart3, Plus, Minus, Target, TrendingUp, Activity, Flame, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FoodSelector } from "@/components/nutrition/FoodSelector";
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
    if (!date) return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    let dateObj;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    
    if (isNaN(dateObj.getTime())) {
      return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    
    if (typeof formatDateForDisplay === 'function') {
      const result = formatDateForDisplay(dateObj);
      if (result && result !== 'Invalid Date') return result;
    }
    
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting display date:', error);
    return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
};

const safeCalculateTotals = (entries) => {
  try {
    if (typeof calculateTotals === 'function') {
      const result = calculateTotals(entries);
      console.log('calculateTotals function result:', result);
      return result;
    }
    if (!Array.isArray(entries)) {
      console.warn('Entries is not an array:', entries);
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    }
    
    console.log('Calculating totals for entries:', entries);
    
    const totals = entries.reduce((totals, entry, index) => {
      console.log(`Processing entry ${index}:`, entry);
      
      const calories = parseFloat(entry?.calories || 0) * parseFloat(entry?.quantity || 1);
      const protein = parseFloat(entry?.protein || 0) * parseFloat(entry?.quantity || 1);
      const carbs = parseFloat(entry?.carbs || 0) * parseFloat(entry?.quantity || 1);
      const fat = parseFloat(entry?.fat || 0) * parseFloat(entry?.quantity || 1);
      const fiber = parseFloat(entry?.fiber || 0) * parseFloat(entry?.quantity || 1);
      
      console.log(`Entry ${index} calculated values:`, {
        calories: `${entry?.calories} * ${entry?.quantity} = ${calories}`,
        protein: `${entry?.protein} * ${entry?.quantity} = ${protein}`,
        carbs: `${entry?.carbs} * ${entry?.quantity} = ${carbs}`,
        fat: `${entry?.fat} * ${entry?.quantity} = ${fat}`,
        fiber: `${entry?.fiber} * ${entry?.quantity} = ${fiber}`
      });
      
      return {
        calories: totals.calories + (isNaN(calories) ? 0 : calories),
        protein: totals.protein + (isNaN(protein) ? 0 : protein),
        carbs: totals.carbs + (isNaN(carbs) ? 0 : carbs),
        fat: totals.fat + (isNaN(fat) ? 0 : fat),
        fiber: totals.fiber + (isNaN(fiber) ? 0 : fiber)
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
    
    console.log('Final calculated totals:', totals);
    return totals;
  } catch (error) {
    console.error('Error calculating totals:', error);
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  }
};

// Daily meal plans for each day of the week
const dailyMealPlans = [
  {
    id: 1,
    day: "Monday",
    meals: ["Morning Smoothie", "Evening Smoothie", "Bhindi Dal Roti", "Paneer Chilla"],
    description: "High protein day with smoothies and traditional Indian meals"
  },
  {
    id: 2,
    day: "Tuesday", 
    meals: ["Morning Smoothie", "Evening Smoothie", "Matar Paneer", "Dosa Sambhar"],
    description: "Balanced day with smoothies and South Indian cuisine"
  },
  {
    id: 3,
    day: "Wednesday",
    meals: ["Morning Smoothie", "Evening Smoothie", "Low Fat Paneer Paratha", "Dal Rice"],
    description: "Protein-rich day with paratha and dal rice"
  },
  {
    id: 4,
    day: "Thursday",
    meals: ["Morning Smoothie", "Evening Smoothie", "Matar Paneer","Bhaji of Pav Bhaji", "100% Whole Wheat Bread (2 servings)"],
    description: "Street food inspired day with nutritious options"
  },
  {
    id: 5,
    day: "Friday",
    meals: ["Morning Smoothie", "Evening Smoothie", "Paneer Pasta", "Aloo Beans Dal Roti"],
    description: "Fusion day with Italian and Indian flavors"
  },
  {
    id: 6,
    day: "Saturday",
    meals: ["Morning Smoothie", "Evening Smoothie", "Low Fat Paneer Paratha", "Bread Pizza"],
    description: "Weekend indulgence with healthy twists"
  }
];

// Multi-line Chart Component for 7-day nutrition data with weekly averages
const MultiLineNutritionChart = ({ last7DaysData }) => {
  // Calculate weekly averages
  const calculateWeeklyAverages = (data) => {
    const totals = data.reduce((acc, dayLog) => {
      return {
        calories: acc.calories + (dayLog.totals?.calories || 0),
        protein: acc.protein + (dayLog.totals?.protein || 0),
        carbs: acc.carbs + (dayLog.totals?.carbs || 0),
        fat: acc.fat + (dayLog.totals?.fat || 0),
        fiber: acc.fiber + (dayLog.totals?.fiber || 0)
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

    return {
      calories: Math.round(totals.calories / 7),
      protein: Math.round(totals.protein / 7),
      carbs: Math.round(totals.carbs / 7),
      fat: Math.round(totals.fat / 7),
      fiber: Math.round(totals.fiber / 7)
    };
  };

  const weeklyAverages = calculateWeeklyAverages(last7DaysData);

  // Transform data for recharts
  const chartData = last7DaysData.map(dayLog => {
    const date = new Date(dayLog.date);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: dayLog.date,
      caloriesIn: Math.round(dayLog.totals?.calories || 0),
      protein: Math.round(dayLog.totals?.protein || 0),
      carbs: Math.round(dayLog.totals?.carbs || 0),
      fat: Math.round(dayLog.totals?.fat || 0),
      fiber: Math.round(dayLog.totals?.fiber || 0)
    };
  });

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}{entry.name.includes('Calories') ? ' cal' : 'g'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600" />
          <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            7-Day Nutrition Trends
          </span>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Nutrition metrics tracked over the last 7 days with weekly averages
        </p>
      </CardHeader>
      <CardContent>
        {/* Weekly Averages Summary */}
        <div className="mb-6 p-4 bg-white/60 rounded-lg border border-green-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 text-center">Weekly Averages vs Daily Goals</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
              <div className="text-lg font-bold text-green-700">{weeklyAverages.calories}</div>
              <div className="text-xs text-green-800 font-medium">Avg Calories</div>
              <div className="text-xs text-green-600 mt-1">
                {Math.round((weeklyAverages.calories / 2300) * 100)}% of 2300
              </div>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <div className="text-lg font-bold text-blue-700">{weeklyAverages.protein}g</div>
              <div className="text-xs text-blue-800 font-medium">Avg Protein</div>
              <div className="text-xs text-blue-600 mt-1">
                {Math.round((weeklyAverages.protein / 150) * 100)}% of 150g
              </div>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
              <div className="text-lg font-bold text-emerald-700">{weeklyAverages.carbs}g</div>
              <div className="text-xs text-emerald-800 font-medium">Avg Carbs</div>
              <div className="text-xs text-emerald-600 mt-1">
                {Math.round((weeklyAverages.carbs / 311) * 100)}% of 311g
              </div>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg border border-teal-200">
              <div className="text-lg font-bold text-teal-700">{weeklyAverages.fat}g</div>
              <div className="text-xs text-teal-800 font-medium">Avg Fat</div>
              <div className="text-xs text-teal-600 mt-1">
                {Math.round((weeklyAverages.fat / 51) * 100)}% of 51g
              </div>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
              <div className="text-lg font-bold text-green-600">{weeklyAverages.fiber}g</div>
              <div className="text-xs text-green-700 font-medium">Avg Fiber</div>
              <div className="text-xs text-green-600 mt-1">
                Daily intake
              </div>
            </div>
          </div>
        </div>

        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 60, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                fontSize={12}
              />
              {/* Left Y-axis for Calories (0-3000 range) */}
              <YAxis 
                yAxisId="calories"
                orientation="left"
                stroke="#6b7280"
                fontSize={12}
                domain={[0, 'dataMax + 200']}
                label={{ value: 'Calories', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
              />
              {/* Right Y-axis for Macros (0-200 range) */}
              <YAxis 
                yAxisId="macros"
                orientation="right"
                stroke="#6b7280"
                fontSize={12}
                domain={[0, 'dataMax + 20']}
                label={{ value: 'Grams', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              
              {/* Calories In - Deep Forest Green stroke - Left axis */}
              <Line 
                yAxisId="calories"
                type="monotone" 
                dataKey="caloriesIn" 
                stroke="#2d5016"
                strokeWidth={4}
                dot={{ fill: '#2d5016', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, fill: '#2d5016' }}
                name="Calories In"
              />
              
              {/* Protein - Ocean Blue stroke - Right axis */}
              <Line 
                yAxisId="macros"
                type="monotone" 
                dataKey="protein" 
                stroke="#1e40af"
                strokeWidth={4}
                dot={{ fill: '#1e40af', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, fill: '#1e40af' }}
                name="Protein"
              />
              
              {/* Carbs - Fresh Mint stroke - Right axis */}
              <Line 
                yAxisId="macros"
                type="monotone" 
                dataKey="carbs" 
                stroke="#10b981"
                strokeWidth={4}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, fill: '#10b981' }}
                name="Carbs"
              />
              
              {/* Fat - Teal stroke - Right axis */}
              <Line 
                yAxisId="macros"
                type="monotone" 
                dataKey="fat" 
                stroke="#0891b2"
                strokeWidth={4}
                dot={{ fill: '#0891b2', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, fill: '#0891b2' }}
                name="Fat"
              />
              
              {/* Fiber - Sage Green stroke - Right axis */}
              <Line 
                yAxisId="macros"
                type="monotone" 
                dataKey="fiber" 
                stroke="#4a7c59"
                strokeWidth={4}
                dot={{ fill: '#4a7c59', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, fill: '#4a7c59' }}
                name="Fiber"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Chart Legend Info */}
        <div className="mt-4 p-4 bg-white/60 rounded-lg border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Chart Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
            <div>
              <div className="font-medium text-gray-700 mb-1">Left Axis (Calories):</div>
              <div>• <span className="text-green-800 font-medium">Calories In</span>: Daily food intake</div>
            </div>
            <div>
              <div className="font-medium text-gray-700 mb-1">Right Axis (Grams):</div>
              <div>• <span className="text-blue-700 font-medium">Protein</span>: Daily protein consumption</div>
              <div>• <span className="text-emerald-600 font-medium">Carbs</span>: Daily carbohydrate intake</div>
              <div>• <span className="text-teal-600 font-medium">Fat</span>: Daily fat consumption</div>
              <div>• <span className="text-green-700 font-medium">Fiber</span>: Daily fiber intake</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Daily Macro Box Component
const DailyMacroBox = ({ log, date, isToday, onClick }) => {
  const totals = log?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const hasData = log?.entries?.length > 0;
  const calorieGoal = 2300;
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

  const getCardStyle = () => {
    if (isToday) {
      return "ring-2 ring-green-500 bg-gradient-to-br from-green-50 to-blue-100 border-green-300";
    }
    if (hasData) {
      return "bg-gradient-to-br from-green-50 to-blue-50 border-green-300 hover:shadow-green-200";
    }
    return "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:shadow-gray-200";
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg group min-h-[280px] flex flex-col",
        getCardStyle()
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-medium text-gray-700">
            {formatDate(date)}
          </div>
          {isToday && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
              Today
            </span>
          )}
        </div>

        {hasData ? (
          <div className="flex-1 flex flex-col justify-between">
            {/* Calories Section */}
            <div className="space-y-3 mb-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Flame className="h-4 w-4 text-green-600" />
                  <span className="text-2xl font-bold text-gray-800">
                    {Math.round(totals.calories)}
                  </span>
                  <span className="text-sm text-gray-500">cal</span>
                </div>
                <div className="text-xs text-gray-500 font-medium mb-2">
                  {Math.round(caloriePercent)}% of goal
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${caloriePercent}%` }}
                />
              </div>
            </div>

            {/* Macros Grid */}
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center bg-white/60 rounded-lg py-3 border border-blue-200">
                <div className="font-bold text-blue-700 text-lg">{Math.round(totals.protein)}g</div>
                <div className="text-blue-800 text-xs">Protein</div>
                <div className="text-blue-600 text-xs mt-1">
                  {Math.round((totals.protein / 150) * 100)}%
                </div>
              </div>
              <div className="text-center bg-white/60 rounded-lg py-3 border border-emerald-200">
                <div className="font-bold text-emerald-600 text-lg">{Math.round(totals.carbs)}g</div>
                <div className="text-emerald-700 text-xs">Carbs</div>
                <div className="text-emerald-600 text-xs mt-1">
                  {Math.round((totals.carbs / 311) * 100)}%
                </div>
              </div>
              <div className="text-center bg-white/60 rounded-lg py-3 border border-teal-200">
                <div className="font-bold text-teal-600 text-lg">{Math.round(totals.fat)}g</div>
                <div className="text-teal-700 text-xs">Fat</div>
                <div className="text-teal-600 text-xs mt-1">
                  {Math.round((totals.fat / 51) * 100)}%
                </div>
              </div>
              <div className="text-center bg-white/60 rounded-lg py-3 border border-green-200">
                <div className="font-bold text-green-600 text-lg">{Math.round(totals.fiber || 0)}g</div>
                <div className="text-green-700 text-xs">Fiber</div>
                <div className="text-green-600 text-xs mt-1">
                  Daily
                </div>
              </div>
            </div>

            {/* Items Count */}
            <div className="flex items-center justify-center gap-1 text-xs text-gray-600 mt-auto">
              <Utensils className="h-3 w-3" />
              <span>{log.entries.length} items logged</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="text-gray-400 text-sm mb-2">No data</div>
            <div className="text-xs text-gray-400 mb-4">Tap to log food</div>
            <Plus className="h-8 w-8 text-gray-300 group-hover:text-green-500 transition-colors" />
          </div>
        )}
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
    <Card className="group hover:shadow-md transition-all duration-200 bg-gradient-to-r from-white to-green-50">
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="font-medium text-gray-800 mb-1">{entry.foodId}</div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Flame className="h-3 w-3 text-green-600" />
                {totalCals} cal
              </span>
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3 text-blue-600" />
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
                  className="w-16 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-green-500"
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

// Daily Meal Plan Card Component
const DailyMealPlanCard = ({ dailyPlan, mealPresets, onClick }) => {
  // Find all the meal presets for this day
  const dayMeals = dailyPlan.meals.map(mealName => 
    mealPresets.find(preset => preset.name === mealName)
  ).filter(Boolean);

  // Calculate total nutrition for the entire day
  const dayTotals = dayMeals.reduce((totals, meal) => {
    const mealCalories = meal.foods?.reduce((sum, food) => 
      sum + (food.calories || 0) * (food.quantity || 1), 0) || 0;
    const mealProtein = meal.foods?.reduce((sum, food) => 
      sum + (food.protein || 0) * (food.quantity || 1), 0) || 0;
    const mealCarbs = meal.foods?.reduce((sum, food) => 
      sum + (food.carbs || 0) * (food.quantity || 1), 0) || 0;
    const mealFat = meal.foods?.reduce((sum, food) => 
      sum + (food.fat || 0) * (food.quantity || 1), 0) || 0;
    const mealFiber = meal.foods?.reduce((sum, food) => 
      sum + (food.fiber || 0) * (food.quantity || 1), 0) || 0;

    return {
      calories: totals.calories + mealCalories,
      protein: totals.protein + mealProtein,
      carbs: totals.carbs + mealCarbs,
      fat: totals.fat + mealFat,
      fiber: totals.fiber + mealFiber
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  return (
    <Card className="bg-white border border-green-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-blue-300 h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex justify-between items-start mb-2">
          <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">
            {dailyPlan.day}
          </CardTitle>
          <Badge variant="secondary" className="ml-2 shrink-0 bg-blue-100 text-blue-700">
            Full Day
          </Badge>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          {dailyPlan.description}
        </p>
      </CardHeader>
      
      <CardContent className="pt-0 flex flex-col flex-1">
        <div className="flex-1 min-h-0">
          <div className="text-sm text-gray-600 mb-4 h-12 overflow-hidden">
            <div className="leading-relaxed">
              {dailyPlan.meals.join(", ")}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 h-20">
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 flex flex-col justify-center">
              <div className="text-xl font-bold text-green-700 leading-tight">
                {Math.round(dayTotals.calories)}
              </div>
              <div className="text-xs text-green-800 font-medium mt-1">calories</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 flex flex-col justify-center">
              <div className="text-xl font-bold text-blue-700 leading-tight">
                {dayMeals.length}
              </div>
              <div className="text-xs text-blue-800 font-medium mt-1">meals</div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-2 mb-4 text-xs h-16">
            <div className="text-center bg-blue-50 rounded-lg py-2 px-1 border border-blue-100 flex flex-col justify-center">
              <div className="font-bold text-blue-700 text-sm leading-tight">{Math.round(dayTotals.protein)}g</div>
              <div className="text-blue-800 text-[10px] mt-1">Protein</div>
            </div>
            <div className="text-center bg-emerald-50 rounded-lg py-2 px-1 border border-emerald-100 flex flex-col justify-center">
              <div className="font-bold text-emerald-600 text-sm leading-tight">{Math.round(dayTotals.carbs)}g</div>
              <div className="text-emerald-700 text-[10px] mt-1">Carbs</div>
            </div>
            <div className="text-center bg-teal-50 rounded-lg py-2 px-1 border border-teal-100 flex flex-col justify-center">
              <div className="font-bold text-teal-600 text-sm leading-tight">{Math.round(dayTotals.fat)}g</div>
              <div className="text-teal-700 text-[10px] mt-1">Fat</div>
            </div>
            <div className="text-center bg-green-50 rounded-lg py-2 px-1 border border-green-100 flex flex-col justify-center">
              <div className="font-bold text-green-600 text-sm leading-tight">{Math.round(dayTotals.fiber)}g</div>
              <div className="text-green-700 text-[10px] mt-1">Fiber</div>
            </div>
          </div>

          <div className="h-16 overflow-hidden">
            <div className="space-y-1 text-xs text-gray-600">
              {dailyPlan.meals.slice(0, 3).map((mealName, index) => {
                const meal = mealPresets.find(preset => preset.name === mealName);
                const mealCalories = meal?.foods?.reduce((sum, food) => 
                  sum + (food.calories || 0) * (food.quantity || 1), 0) || 0;
                return (
                  <div key={index} className="flex justify-between">
                    <span className="truncate flex-1">{mealName}</span>
                    <span className="ml-2 text-gray-500 flex-shrink-0">
                      {Math.round(mealCalories)}cal
                    </span>
                  </div>
                );
              })}
              {dailyPlan.meals.length > 3 && (
                <div className="text-center text-gray-400 text-[10px]">
                  +{dailyPlan.meals.length - 3} more meals
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 flex-shrink-0">
          <Button 
            onClick={onClick}
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-medium py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add {dailyPlan.day}'s Meals
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Combined Meals Card Component with fixed alignment
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
    <Card className="bg-white border border-green-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-blue-300 h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex justify-between items-start mb-2">
          <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">
            {preset.name}
          </CardTitle>
          <Badge variant="secondary" className="ml-2 shrink-0 bg-green-100 text-green-700">
            Preset
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 flex flex-col flex-1">
        {/* Main content area that can grow */}
        <div className="flex-1 min-h-0">
          {/* Food items description - fixed height with overflow */}
          <div className="text-sm text-gray-600 mb-4 h-12 overflow-hidden">
            <div className="leading-relaxed">
              {preset.foods?.map(food => food.foodId).join(", ")}
            </div>
          </div>

          {/* Summary stats - fixed height */}
          <div className="grid grid-cols-2 gap-3 mb-4 h-20">
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 flex flex-col justify-center">
              <div className="text-xl font-bold text-green-700 leading-tight">
                {Math.round(totalCalories)}
              </div>
              <div className="text-xs text-green-800 font-medium mt-1">calories</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 flex flex-col justify-center">
              <div className="text-xl font-bold text-blue-700 leading-tight">
                {foodCount}
              </div>
              <div className="text-xs text-blue-800 font-medium mt-1">items</div>
            </div>
          </div>
          
          {/* Detailed macros grid - Fixed alignment with consistent heights and green/blue theme */}
          <div className="grid grid-cols-4 gap-2 mb-4 text-xs h-16">
            <div className="text-center bg-blue-50 rounded-lg py-2 px-1 border border-blue-100 flex flex-col justify-center">
              <div className="font-bold text-blue-700 text-sm leading-tight">{Math.round(totalProtein)}g</div>
              <div className="text-blue-800 text-[10px] mt-1">Protein</div>
            </div>
            <div className="text-center bg-emerald-50 rounded-lg py-2 px-1 border border-emerald-100 flex flex-col justify-center">
              <div className="font-bold text-emerald-600 text-sm leading-tight">{Math.round(totalCarbs)}g</div>
              <div className="text-emerald-700 text-[10px] mt-1">Carbs</div>
            </div>
            <div className="text-center bg-teal-50 rounded-lg py-2 px-1 border border-teal-100 flex flex-col justify-center">
              <div className="font-bold text-teal-600 text-sm leading-tight">{Math.round(totalFat)}g</div>
              <div className="text-teal-700 text-[10px] mt-1">Fat</div>
            </div>
            <div className="text-center bg-green-50 rounded-lg py-2 px-1 border border-green-100 flex flex-col justify-center">
              <div className="font-bold text-green-600 text-sm leading-tight">{Math.round(totalFiber)}g</div>
              <div className="text-green-700 text-[10px] mt-1">Fiber</div>
            </div>
          </div>

          {/* Food breakdown - fixed height container */}
          <div className="h-16 overflow-hidden">
            <div className="space-y-1 text-xs text-gray-600">
              {preset.foods?.slice(0, 3).map((food, index) => (
                <div key={index} className="flex justify-between">
                  <span className="truncate flex-1">{food.foodId}</span>
                  <span className="ml-2 text-gray-500 flex-shrink-0">
                    {Math.round(food.calories * food.quantity)}cal
                  </span>
                </div>
              ))}
              {preset.foods && preset.foods.length > 3 && (
                <div className="text-center text-gray-400 text-[10px]">
                  +{preset.foods.length - 3} more items
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed bottom section with button - always at bottom */}
        <div className="pt-4 flex-shrink-0">
          <Button 
            onClick={onClick}
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-medium py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Meal to Today
          </Button>
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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("last7days");

  // Real meal presets
  const mealPresets = [
    {
      id: 1,
      name: "Morning Smoothie",
      foods: [
        { foodId: "Oats, Quaker", calories: 163, protein: 4.7, carbs: 27.4, fat: 3.8, fiber: 4.0, quantity: 1, unit: "serving" },
        { foodId: "Omani Dates, Happilo", calories: 68, protein: 0.6, carbs: 18.0, fat: 0.1, fiber: 1.9, quantity: 1, unit: "serving" },
        { foodId: "Almonds", calories: 56, protein: 1.9, carbs: 1.9, fat: 4.5, fiber: 1.1, quantity: 1, unit: "serving" },
        { foodId: "Skyr High Protein Yogurt, Milky Mist", calories: 100, protein: 12.0, carbs: 9.5, fat: 1.5, fiber: 0.0, quantity: 1, unit: "serving" },
        { foodId: "Raw Whey Protein, Unflavoured", calories: 178, protein: 35.6, carbs: 3.5, fat: 2.4, fiber: 0.4, quantity: 1, unit: "serving" },
        { foodId: "Nutty Gritties Super Seeds Mix", calories: 107, protein: 4, carbs: 1.9, fat: 8, fiber: 2.7, quantity: 1, unit: "serving" },
        { foodId: "Slim n Trim Skimmed Milk, Amul", calories: 35, protein: 3.5, carbs: 5.0, fat: 0.1, fiber: 0.0, quantity: 1, unit: "serving" },
        { foodId: "Walnut", calories: 60, protein: 1.3, carbs: 0.8, fat: 5.8, fiber: 0.35, quantity: 1, unit: "serving" },
        { foodId: "Mango", calories: 96, protein: 0.8, carbs: 22.0, fat: 0.5, fiber: 2.6, quantity: 1, unit: "serving" }
      ]
    },
    {
      id: 2,
      name: "Evening Smoothie",
      foods: [
        { foodId: "Cocoa Whey Protein, The Whole Truth", calories: 191, protein: 34.1, carbs: 8.6, fat: 2.1, fiber: 2.1, quantity: 1, unit: "serving" },
        { foodId: "Oats, Quaker", calories: 163, protein: 4.7, carbs: 27.4, fat: 3.8, fiber: 4.0, quantity: 1, unit: "serving" },
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
      name: "Matar Paneer",
      foods: [
        { foodId: "Mixed Vegetable Sabzi", calories: 28, protein: 0.7, carbs: 3.6, fat: 1.2, fiber: 1.4, quantity: 2, unit: "servings" },
        { foodId: "Low Fat Paneer, Milky Mist", calories: 204, protein: 25.0, carbs: 5.8, fat: 9.0, fiber: 0.0, quantity: 1, unit: "serving" },
        { foodId: "Roti", calories: 122, protein: 4.3, carbs: 24.8, fat: 0.6, fiber: 3.8, quantity: 1, unit: "serving" }
      ]
    },
    {
      id: 8,
      name: "Paneer Pasta",
      foods: [
        {
          foodId: "Zucchini Bell Pepper Salad",
          calories: 48,
          protein: 1.0,
          carbs: 1.7,
          fat: 4.4,
          fiber: 0.6,
          quantity: 1,
          unit: "serving"
        },
        {
          foodId: "Durum Wheat Pasta, Borges",
          calories: 157,
          protein: 5.6,
          carbs: 32.4,
          fat: 0.6,
          fiber: 1.1,
          quantity: 1,
          unit: "serving"
        },
        {
          foodId: "High Protein Low Fat Paneer, Milky Mist",
          calories: 204,
          protein: 25.0,
          carbs: 5.8,
          fat: 9.0,
          fiber: 0.0,
          quantity: 1,
          unit: "serving"
        }
      ]
    },
    {
      id: 9,
      name: "Dosa Sambhar",
      foods: [
        { foodId: "Dosa", calories: 221, protein: 5.4, carbs: 33.9, fat: 7.1, fiber: 1.9, quantity: 1, unit: "serving" },
        { foodId: "Sambhar", calories: 228, protein: 11, carbs: 32.4, fat: 6.0, fiber: 7.4, quantity: 1, unit: "serving" }
      ]
    },
    {
      id: 10,
      name: "Dal Rice",
      foods: [
        { foodId: "Dal", calories: 115, protein: 6.8, carbs: 17.7, fat: 1.9, fiber: 2.8, quantity: 1, unit: "serving" },
        { foodId: "White Rice", calories: 97, protein: 2.1, carbs: 21.5, fat: 0.3, fiber: 0.4, quantity: 1, unit: "serving" }
      ]
    },
    {
      id: 11,
      name: "Low Fat Paneer Paratha",
      foods: [
        { foodId: "Low Fat Paneer Paratha", calories: 445, protein: 26.4, carbs: 40.4, fat: 20.0, fiber: 5.8, quantity: 1, unit: "serving" }
      ]
    },
    {
      id: 12,
      name: "100% Whole Wheat Bread (2 servings)",
      foods: [
        { foodId: "100% Whole Wheat Bread, Britannia", calories: 67, protein: 2.2, carbs: 13.8, fat: 0.6, fiber: 1.1, quantity: 2, unit: "servings" }
      ]
    },
    {
      id: 13,
      name: "Bhaji of Pav Bhaji",
      foods: [
        { foodId: "Bhaji of Pav Bhaji", calories: 137, protein: 2.3, carbs: 16.8, fat: 6.9, fiber: 2.1, quantity: 1, unit: "serving" }
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
      // Always generate 7 days regardless of what's in Firestore
      const last7Days = [];
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = safeFormatDateToYYYYMMDD(date);
        
        // Create a basic log structure for each day
        const dayLog = {
          date: dateString,
          entries: [],
          totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          lastUpdated: null
        };
        
        // Try to get actual data from Firestore if available
        try {
          const actualLog = await getOrCreateDailyLogFirestore(dateString);
          if (actualLog && actualLog.entries && actualLog.entries.length > 0) {
            dayLog.entries = actualLog.entries;
            dayLog.totals = actualLog.totals || safeCalculateTotals(actualLog.entries);
            dayLog.lastUpdated = actualLog.lastUpdated;
          }
        } catch (error) {
          console.error(`Error loading data for ${dateString}:`, error);
          // Keep the empty structure
        }
        
        last7Days.push(dayLog);
      }
      
      // FIXED: Reverse array so latest day appears first on mobile
      setLastXDaysData(last7Days.reverse());
    } catch (error) {
      console.error('Error loading last X days data:', error);
      // Still create empty 7 days structure
      const fallback7Days = [];
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = safeFormatDateToYYYYMMDD(date);
        
        fallback7Days.push({
          date: dateString,
          entries: [],
          totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          lastUpdated: null
        });
      }
      
      // FIXED: Reverse array so latest day appears first on mobile
      setLastXDaysData(fallback7Days.reverse());
    }
  }, []);

  useEffect(() => {
    loadDailyLog(selectedDate);
    loadLastXDaysData();
  }, [selectedDate, loadDailyLog, loadLastXDaysData]);

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
      // Log the incoming food entry to debug
      console.log('Raw food entry received:', foodEntry);
      
      // Normalize the food entry data structure
      const normalizedEntry = {
        foodId: foodEntry.foodId || foodEntry.name || 'Unknown Food',
        calories: Number(foodEntry.calories) || 0,
        protein: Number(foodEntry.protein) || 0,
        carbs: Number(foodEntry.carbs) || 0,
        fat: Number(foodEntry.fat) || 0,
        fiber: Number(foodEntry.fiber) || 0,
        quantity: Number(foodEntry.quantity) || 1,
        unit: foodEntry.unit || 'serving',
        timestamp: new Date().toISOString()
      };
      
      // Log the normalized entry
      console.log('Normalized food entry:', normalizedEntry);
      
      // Validate that we have meaningful nutrition data
      if (normalizedEntry.calories === 0 && normalizedEntry.protein === 0 && 
          normalizedEntry.carbs === 0 && normalizedEntry.fat === 0) {
        console.warn('Warning: Food entry has no nutrition data:', normalizedEntry);
        toast.error('Warning: This food has no nutrition data');
      }
      
      const updatedEntries = [...currentLog.entries, normalizedEntry];
      const updatedTotals = safeCalculateTotals(updatedEntries);
      
      // Log the calculated totals
      console.log('Updated totals after adding food:', updatedTotals);
      
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

  const handleAddDailyPlan = async (dailyPlan) => {
    if (!currentLog) return;

    setSaving(true);
    try {
      // Find all the meal presets for this day and flatten their foods
      const dayMeals = dailyPlan.meals.map(mealName => 
        mealPresets.find(preset => preset.name === mealName)
      ).filter(Boolean);

      const allFoodsFromDay = dayMeals.flatMap(meal => 
        meal.foods.map(food => ({
          foodId: food.foodId || food.name,
          calories: Number(food.calories) || 0,
          protein: Number(food.protein) || 0,
          carbs: Number(food.carbs) || 0,
          fat: Number(food.fat) || 0,
          fiber: Number(food.fiber) || 0,
          quantity: Number(food.quantity) || 1,
          unit: food.unit || 'serving',
          timestamp: new Date().toISOString()
        }))
      );
      
      const updatedEntries = [...currentLog.entries, ...allFoodsFromDay];
      const updatedTotals = safeCalculateTotals(updatedEntries);
      
      const updatedLog: DailyLog = {
        ...currentLog,
        entries: updatedEntries,
        totals: updatedTotals,
        lastUpdated: new Date().toISOString()
      };

      await saveDailyLogToFirestore(updatedLog);
      setCurrentLog(updatedLog);
      toast.success(`${dailyPlan.day}'s meals added successfully!`);
      
      loadLastXDaysData();
    } catch (error) {
      console.error('Error adding daily plan:', error);
      toast.error('Failed to add daily meal plan');
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
          <Button 
            onClick={() => navigate('/')} 
            variant="ghost" 
            className="hover:bg-white/20"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <div className="flex items-center gap-4">
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="today">Today's Log</TabsTrigger>
            <TabsTrigger value="last7days">Last 7 Days</TabsTrigger>
            <TabsTrigger value="presets">Combined Meals</TabsTrigger>
            <TabsTrigger value="daily">Daily Nutrition</TabsTrigger>
            <TabsTrigger value="public">Public Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-6">
            {loading ? (
              <div className="space-y-6">
                <Skeleton className="h-[200px] w-full" />
                <Skeleton className="h-[150px] w-full" />
                <Skeleton className="h-[300px] w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Daily Summary - Top Section */}
                <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-medium text-gray-700 flex items-center">
                      <BarChart3 className="mr-2 h-4 w-4 text-green-600" />
                      Daily Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-6">
                      {/* Calories Progress */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Flame className="h-5 w-5 text-green-600" />
                            <span className="font-semibold text-gray-800">Calories</span>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-700">
                              {Math.round(currentLog?.totals?.calories || 0)}
                            </div>
                            <div className="text-sm text-gray-500">/ 2300 goal</div>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(((currentLog?.totals?.calories || 0) / 2300) * 100, 100)}%`
                            }}
                          />
                        </div>
                        <div className="text-center text-sm text-gray-600">
                          {Math.round(((currentLog?.totals?.calories || 0) / 2300) * 100)}% of daily goal
                        </div>
                      </div>

                      {/* Macros Grid - Green/Blue theme with goals */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                          <Target className="h-5 w-5 mx-auto mb-2 text-blue-600" />
                          <div className="text-2xl font-bold text-blue-700">
                            {Math.round(currentLog?.totals?.protein || 0)}g
                          </div>
                          <div className="text-xs text-blue-800 font-medium">Protein</div>
                          <div className="text-xs text-blue-600 mt-1">
                            {Math.round(((currentLog?.totals?.protein || 0) / 150) * 100)}% of 150g
                          </div>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200">
                          <Activity className="h-5 w-5 mx-auto mb-2 text-emerald-600" />
                          <div className="text-2xl font-bold text-emerald-600">
                            {Math.round(currentLog?.totals?.carbs || 0)}g
                          </div>
                          <div className="text-xs text-emerald-700 font-medium">Carbs</div>
                          <div className="text-xs text-emerald-600 mt-1">
                            {Math.round(((currentLog?.totals?.carbs || 0) / 311) * 100)}% of 311g
                          </div>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl border border-teal-200">
                          <div className="w-5 h-5 mx-auto mb-2 bg-teal-600 rounded-full"></div>
                          <div className="text-2xl font-bold text-teal-600">
                            {Math.round(currentLog?.totals?.fat || 0)}g
                          </div>
                          <div className="text-xs text-teal-700 font-medium">Fat</div>
                          <div className="text-xs text-teal-600 mt-1">
                            {Math.round(((currentLog?.totals?.fat || 0) / 51) * 100)}% of 51g
                          </div>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                          <div className="w-5 h-5 mx-auto mb-2 bg-green-600 rounded-sm"></div>
                          <div className="text-2xl font-bold text-green-600">
                            {Math.round(currentLog?.totals?.fiber || 0)}g
                          </div>
                          <div className="text-xs text-green-700 font-medium">Fiber</div>
                          <div className="text-xs text-green-600 mt-1">
                            Daily intake
                          </div>
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="mt-6 bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-center text-sm">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Utensils className="h-4 w-4" />
                            <span className="font-semibold text-gray-800">
                              {currentLog?.entries?.length || 0}
                            </span> foods logged today
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Add Food - Horizontal Section */}
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

                {/* Today's Foods - Full Width Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Utensils className="h-5 w-5 text-blue-600" />
                      Today's Foods ({currentLog?.entries?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[500px] overflow-y-auto">
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
                        <p className="text-sm">Add your first food using the form above</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                  {lastXDaysData.map((log, index) => (
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
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Multi-line Chart replaces the Weekly Averages Summary */}
            <MultiLineNutritionChart last7DaysData={lastXDaysData} />
          </TabsContent>

          <TabsContent value="presets" className="space-y-6">
            <section>
              <div className="flex items-center mb-6">
                <CalendarIcon className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Combined Meals (Presets)</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mealPresets.map((preset) => (
                  <div key={preset.id} className="h-full">
                    <CombinedMealCard
                      preset={preset}
                      onClick={() => handleAddPreset(preset)}
                    />
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="daily" className="space-y-6">
            <section>
              <div className="flex items-center mb-6">
                <CalendarIcon className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Daily Nutrition Plans</h2>
              </div>
              <p className="text-gray-600 mb-6">
                Complete daily meal plans for each day of the week. Each plan includes all meals with calculated nutrition totals.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dailyMealPlans.map((dailyPlan) => (
                  <div key={dailyPlan.id} className="h-full">
                    <DailyMealPlanCard
                      dailyPlan={dailyPlan}
                      mealPresets={mealPresets}
                      onClick={() => handleAddDailyPlan(dailyPlan)}
                    />
                  </div>
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
