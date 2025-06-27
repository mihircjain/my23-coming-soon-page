
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Utensils } from "lucide-react";
import { Link } from "react-router-dom";
import { getTodayDateString } from "@/lib/nutritionUtils";
import { DailyLog } from "@/types/nutrition";

// Fallback utility functions
const loadNutritionLogs = () => {
  try {
    const logs = localStorage.getItem('nutritionLogs');
    return logs ? JSON.parse(logs) : {};
  } catch (error) {
    console.error('Error loading nutrition logs:', error);
    return {};
  }
};

const getWeeklyAverages = (logs: Record<string, DailyLog>) => {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const weeklyEntries = Object.entries(logs).filter(([dateStr]) => {
    const date = new Date(dateStr);
    return date >= weekAgo && date <= today;
  });

  if (weeklyEntries.length === 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  }

  const totals = weeklyEntries.reduce((acc, [_, log]) => ({
    calories: acc.calories + (log.totals?.calories || 0),
    protein: acc.protein + (log.totals?.protein || 0),
    carbs: acc.carbs + (log.totals?.carbs || 0),
    fat: acc.fat + (log.totals?.fat || 0),
    fiber: acc.fiber + (log.totals?.fiber || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  const avgDivisor = weeklyEntries.length;
  return {
    calories: Math.round(totals.calories / avgDivisor),
    protein: Math.round(totals.protein / avgDivisor),
    carbs: Math.round(totals.carbs / avgDivisor),
    fat: Math.round(totals.fat / avgDivisor),
    fiber: Math.round(totals.fiber / avgDivisor),
  };
};

export function NutritionWidget() {
  // Initialize with default structure to avoid null errors
  const defaultTotals: DailyLog["totals"] = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0
  };

  const [todayData, setTodayData] = useState<DailyLog["totals"] | null>(null);
  const [weeklyData, setWeeklyData] = useState<DailyLog["totals"]>(defaultTotals);
  const [hasData, setHasData] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    try {
      // Load nutrition data from localStorage
      const logs = loadNutritionLogs();
      const today = getTodayDateString();
      
      // Set today's data if it exists
      if (logs[today] && logs[today].entries.length > 0) {
        setTodayData(logs[today].totals);
        setHasData(true);
      } else {
        setTodayData(null);
        setHasData(false);
      }
      
      // Calculate weekly averages
      const weeklyAverages = getWeeklyAverages(logs);
      setWeeklyData(weeklyAverages);
    } catch (error) {
      console.error("Error loading nutrition data:", error);
      setTodayData(null);
      setWeeklyData(defaultTotals);
      setHasData(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Today's Nutrition Summary */}
      <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
            <Utensils className="mr-2 h-4 w-4 text-blue-500" />
            Today's Nutrition
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-gray-500">Loading today's data...</div>
          ) : hasData && todayData ? (
            <div className="space-y-2">
              <div className="text-2xl font-bold">{todayData.calories} calories</div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div>
                  <div className="font-medium">{todayData.protein}g</div>
                  <div className="text-xs text-muted-foreground">Protein</div>
                </div>
                <div>
                  <div className="font-medium">{todayData.carbs}g</div>
                  <div className="text-xs text-muted-foreground">Carbs</div>
                </div>
                <div>
                  <div className="font-medium">{todayData.fat}g</div>
                  <div className="text-xs text-muted-foreground">Fat</div>
                </div>
                <div>
                  <div className="font-medium">{todayData.fiber}g</div>
                  <div className="text-xs text-muted-foreground">Fiber</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-gray-500">No nutrition data logged today</div>
              <Button asChild variant="outline" size="sm">
                <Link to="/nutrition-jam">Log now</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Summary */}
      <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
            <Utensils className="mr-2 h-4 w-4 text-purple-500" />
            Weekly Average
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-gray-500">Loading weekly data...</div>
          ) : (
            <div className="space-y-2">
              <div className="text-xl font-bold">{weeklyData.calories} calories</div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div>
                  <div className="font-medium">{weeklyData.protein}g</div>
                  <div className="text-xs text-muted-foreground">Protein</div>
                </div>
                <div>
                  <div className="font-medium">{weeklyData.carbs}g</div>
                  <div className="text-xs text-muted-foreground">Carbs</div>
                </div>
                <div>
                  <div className="font-medium">{weeklyData.fat}g</div>
                  <div className="text-xs text-muted-foreground">Fat</div>
                </div>
                <div>
                  <div className="font-medium">{weeklyData.fiber}g</div>
                  <div className="text-xs text-muted-foreground">Fiber</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
