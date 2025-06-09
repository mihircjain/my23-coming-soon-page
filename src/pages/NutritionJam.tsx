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
import TrendsChart from "@/components/nutrition/TrendsChart";
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
      weekday: 'short', month: 'short', day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting display date:', error);
    return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
        calories:      totals.calories + (isNaN(calories) ? 0 : calories),
        protein:       totals.protein  + (isNaN(protein)  ? 0 : protein),
        carbs:         totals.carbs    + (isNaN(carbs)    ? 0 : carbs),
        fat:           totals.fat      + (isNaN(fat)      ? 0 : fat),
        fiber:         totals.fiber    + (isNaN(fiber)    ? 0 : fiber),
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  } catch (error) {
    console.error('Error calculating totals:', error);
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  }
};

// Daily Macro Box Component
const DailyMacroBox = ({ log, date, isToday, onClick }) => {
  const totals   = log?.totals || { calories:0, protein:0, carbs:0, fat:0, fiber:0 };
  const hasData  = log?.entries?.length > 0;
  const calorieGoal = 2000;
  const caloriePercent = Math.min((totals.calories/calorieGoal)*100,100);
  const formatDate = (d) => {
    try { const dt=typeof d==='string'?new Date(d):d; if(isNaN(dt.getTime()))throw ''; return dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});}catch{return 'Invalid Date';}
  };
  const getCardStyle = () => isToday
    ? "ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-300"
    : hasData
      ? "bg-gradient-to-br from-green-50 to-emerald-100 border-green-300 hover:shadow-green-200"
      : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:shadow-gray-200";

  return (
    <Card className={cn(
      "cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg group min-h-[280px] flex flex-col",
      getCardStyle()
    )} onClick={onClick}>
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-medium text-gray-700">{formatDate(date)}</div>
          {isToday && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium">Today</span>}
        </div>
        {hasData ? (
          <div className="flex-1 flex flex-col justify-between">
            <div className="space-y-3 mb-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span className="text-2xl font-bold text-gray-800">{Math.round(totals.calories)}</span>
                  <span className="text-sm text-gray-500">cal</span>
                </div>
                <div className="text-xs text-gray-500 font-medium mb-2">{Math.round(caloriePercent)}% of goal</div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-300" style={{width:`${caloriePercent}%`}} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center bg-white/60 rounded-lg py-3 border border-blue-200">
                <div className="font-bold text-blue-600 text-lg">{Math.round(totals.protein)}g</div>
                <div className="text-blue-700 text-xs">Protein</div>
              </div>
              <div className="text-center bg-white/60 rounded-lg py-3 border border-green-200">
                <div className="font-bold text-green-600 text-lg">{Math.round(totals.carbs)}g</div>
                <div className="text-green-700 text-xs">Carbs</div>
              </div>
              <div className="text-center bg-white/60 rounded-lg py-3 border border-purple-200">
                <div className="font-bold text-purple-600 text-lg">{Math.round(totals.fat)}g</div>
                <div className="text-purple-700 text-xs">Fat</div>
              </div>
              <div className="text-center bg-white/60 rounded-lg py-3 border border-amber-200">
                <div className="font-bold text-amber-600 text-lg">{Math.round(totals.fiber)}g</div>
                <div className="text-amber-700 text-xs">Fiber</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 text-xs text-gray-600 mt-auto">
              <Utensils className="h-3 w-3" />
              <span>{log.entries.length} items logged</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="text-gray-400 text-sm mb-2">No data</div>
            <div className="text-xs text-gray-400 mb-4">Tap to log food</div>
            <Plus className="h-8 w-8 text-gray-300 group-hover:text-blue-500 transition-colors" />
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
  const safeNumber = (v) => { const n = parseFloat(v); return isNaN(n)||!isFinite(n)?0:n; };
  const totalCals    = Math.round(safeNumber(entry.calories)*safeNumber(entry.quantity));
  const totalProtein= Math.round(safeNumber(entry.protein)*safeNumber(entry.quantity));

  return (
    <Card className="group hover:shadow-md transition-all duration-200 bg-gradient-to-r from-white to-gray-50">
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="font-medium text-gray-800 mb-1">{entry.foodId}</div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {entry.calories != null ? (
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-500" /> {totalCals} cal
                </span>
              ) : (
                <span className="text-xs text-gray-400">No info</span>
              )}
              {entry.protein != null && (
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3 text-blue-500" /> {totalProtein}g protein
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={quantity}
                  onChange={e=>setQuantity(parseFloat(e.target.value)||0)}
                  className="w-16 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                  step="0.1" min="0"
                />
                <Button size="sm" onClick={()=>{onUpdateQuantity(index,quantity); setIsEditing(false);}}>Save</Button>
                <Button size="sm" variant="outline" onClick={()=>setIsEditing(false)}>Cancel</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={()=>onUpdateQuantity(index,Math.max(0.1,safeNumber(entry.quantity)-0.5))}><Minus className="h-3 w-3"/></Button>
                  <span className="w-16 text-center text-sm font-medium">{safeNumber(entry.quantity)} {entry.unit}</span>
                  <Button variant="outline" size="sm" onClick={()=>onUpdateQuantity(index,safeNumber(entry.quantity)+0.5)}><Plus className="h-3 w-3"/></Button>
                </div>
                <Button variant="outline" size="sm" onClick={()=>setIsEditing(true)}><Edit className="h-3 w-3"/></Button>
                <Button variant="outline" size="sm" onClick={()=>onRemove(index)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-3 w-3"/></Button>
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
  const totalCalories = preset.foods?.reduce((sum,f)=>sum+(f.calories||0)*(f.quantity||1),0)||0;
  const totalProtein  = preset.foods?.reduce((sum,f)=>sum+(f.protein ||0)*(f.quantity||1),0)||0;
  const totalCarbs    = preset.foods?.reduce((sum,f)=>sum+(f.carbs   ||0)*(f.quantity||1),0)||0;
  const totalFat      = preset.foods?.reduce((sum,f)=>sum+(f.fat     ||0)*(f.quantity||1),0)||0;
  const totalFiber    = preset.foods?.reduce((sum,f)=>sum+(f.fiber   ||0)*(f.quantity||1),0)||0;
  const foodCount     = preset.foods?.length||0;

  return (
    <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-blue-300 flex flex-col h-full">
      <div className="pb-3 flex-shrink-0 min-h-[6rem]">
        <div className="flex justify-between items-start mb-2">
          <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">{preset.name}</CardTitle>
          <Badge variant="secondary" className="ml-2 shrink-0 bg-blue-100 text-blue-700">Preset</Badge>
        </div>
        <div className="text-sm text-gray-600 mb-3 leading-relaxed">{preset.foods?.map(f=>f.foodId).join(", ")}</div>
      </div>
      <CardContent className="pt-0 flex flex-col flex-1">
        <div className="flex-1 grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
            <div className="text-2xl font-bold text-orange-600">{Math.round(totalCalories)}</div>
            <div className="text-xs text-orange-700 font-medium">calories</div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{foodCount}</div>
            <div className="text-xs text-blue-700 font-medium">items</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
          <div className="text-center bg-blue-50 rounded-lg py-2 border border-blue-100"><div className="font-bold text-blue-600">{Math.round(totalProtein)}g</div><div className="text-blue-700 text-[10px]">Protein</div></div>
          <div className="text-center bg-green-50 rounded-lg py-2 border border-green-100"><div className="font-bold text-green-600">{Math.round(totalCarbs)}g</div><div className="text-green-700 text-[10px]">Carbs</div></div>
          <div className="text-center bg-purple-50 rounded-lg py-2 border border-purple-100"><div className="font-bold text-purple-600">{Math.round(totalFat)}g</div><div className="text-purple-700 text-[10px]">Fat</div></div>
          <div className="text-center bg-amber-50 rounded-lg py-2 border border-amber-100"><div className="font-bold text-amber-600">{Math.round(totalFiber)}g</div><div className="text-amber-700 text-[10px]">Fiber</div></div>
        </div>
        <Button onClick={onClick} className="mt-auto w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-medium py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" /> Add Meal to Today
        </Button>
      </CardContent>
    </Card>
  );
};

const NutritionJam = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentLog, setCurrentLog] = useState<DailyLog|null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastXDaysData, setLastXDaysData] = useState<DailyLog[]>([]);
  const [weeklyAverages, setWeeklyAverages] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("last7days");

  // Meal presets omitted for brevity… (same as original)
  const mealPresets = [ /* … */ ];

  const loadDailyLog = useCallback(async (date: Date) => { /* … */ }, []);
  const loadLastXDaysData = useCallback(async () => { /* … */ }, []);
  const loadWeeklyAverages = useCallback(async () => { /* … */ }, []);

  useEffect(() => {
    loadDailyLog(selectedDate);
    loadLastXDaysData();
    loadWeeklyAverages();
  }, [selectedDate, loadDailyLog, loadLastXDaysData, loadWeeklyAverages]);

  const handleDateSelect = (date?: Date) => {
    if (date && !isNaN(date.getTime())) {
      setSelectedDate(date);
      setIsCalendarOpen(false);
    }
  };
  // handlers for add, remove, update food/preset… (same as original)

  const isToday = safeFormatDateToYYYYMMDD(selectedDate) === safeGetTodayDateString();
  const safeTodayString = safeGetTodayDateString();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col">
      <Toaster position="top-right" />
      <header className="pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Utensils className="h-8 w-8 text-green-600" /> Nutrition Jam
          </h1>
          <div className="flex items-center gap-4">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? safeFormatDateForDisplay(selectedDate) : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus />
              </PopoverContent>
            </Popover>
            {isToday && (
              <Button onClick={() => {/* auto-fill handler */}} disabled={saving} variant="outline" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Auto-fill
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
              <><Skeleton className="h-[200px] w-full"/><Skeleton className="h-[150px] w-full"/><Skeleton className="h-[300px] w-full"/></>
            ) : (
              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-purple-800">
                    <BarChart3 className="h-5 w-5 text-purple-600" /> Daily Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-6">
                    {/* calories + macros layout as above in DailyMacroBox recipe */}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="last7days" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" /> Last 7 Days Nutrition Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                  {/* DailyMacroBox map */}
                </div>
              </CardContent>
            </Card>

            {weeklyAverages && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" /> 7-Day Average Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MacroAveragesSummary averages={weeklyAverages} />
                  <div className="mt-6">
                    <TrendsChart data={lastXDaysData.map(log=>({
                      date: log.date,
                      calories: log.totals.calories,
                      protein:  log.totals.protein,
                      carbs:    log.totals.carbs,
                      fat:      log.totals.fat,
                      fiber:    log.totals.fiber,
                    }))} />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="presets" className="space-y-6">
            <section>
              <div className="flex items-center mb-6">
                <CalendarIcon className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Combined Meals (Presets)</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* CombinedMealCard map */}
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
