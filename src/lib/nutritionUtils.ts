import { DailyLog, FoodEntry, FoodItem } from "@/types/nutrition";
import { vegetarianFoods } from "@/data/vegetarianFoods";

// Calculate totals for a set of food entries
export function calculateTotals(entries: FoodEntry[]): DailyLog["totals"] {
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0
  };

  entries.forEach(entry => {
    const food = vegetarianFoods.find(f => f.name === entry.foodId);
    if (food) {
      totals.calories += food.calories * entry.quantity;
      totals.protein += food.protein * entry.quantity;
      totals.carbs += food.carbs * entry.quantity;
      totals.fat += food.fat * entry.quantity;
      totals.fiber += food.fiber * entry.quantity;
    }
  });

  // Round to 1 decimal place
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    fiber: Math.round(totals.fiber * 10) / 10
  };
}

// Get today's date in YYYY-MM-DD format
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

// Get date from X days ago in YYYY-MM-DD format
export function getDateXDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

// Format date for display (e.g., "Jun 3")
export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Load nutrition logs from localStorage
export function loadNutritionLogs(): Record<string, DailyLog> {
  const savedLogs = localStorage.getItem('nutritionLogs');
  return savedLogs ? JSON.parse(savedLogs) : {};
}

// Save nutrition logs to localStorage
export function saveNutritionLogs(logs: Record<string, DailyLog>): void {
  localStorage.setItem('nutritionLogs', JSON.stringify(logs));
}

// Get or create a daily log for a specific date
export function getOrCreateDailyLog(logs: Record<string, DailyLog>, date: string): DailyLog {
  if (!logs[date]) {
    logs[date] = {
      date,
      entries: [],
      totals: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0
      }
    };
  }
  return logs[date];
}

// Check if it's past 6 PM
export function isPastSixPM(): boolean {
  const now = new Date();
  return now.getHours() >= 18;
}

// Get yesterday's date in YYYY-MM-DD format
export function getYesterdayDateString(): string {
  return getDateXDaysAgo(1);
}

// Copy yesterday's entries to today if none exist and it's past 6 PM
export function autoFillFromYesterday(logs: Record<string, DailyLog>): Record<string, DailyLog> {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();
  
  // If today has no entries, it's past 6 PM, and yesterday has entries
  if (
    (!logs[today] || logs[today].entries.length === 0) && 
    isPastSixPM() && 
    logs[yesterday] && 
    logs[yesterday].entries.length > 0
  ) {
    const newLogs = { ...logs };
    newLogs[today] = {
      date: today,
      entries: [...logs[yesterday].entries],
      totals: { ...logs[yesterday].totals }
    };
    return newLogs;
  }
  
  return logs;
}

// Get data for the last X days
export function getLastXDaysData(logs: Record<string, DailyLog>, days: number): DailyLog[] {
  const result: DailyLog[] = [];
  const today = getTodayDateString();
  
  for (let i = 0; i < days; i++) {
    const date = getDateXDaysAgo(i);
    if (logs[date]) {
      result.push(logs[date]);
    } else {
      // Add empty log for missing dates
      result.push({
        date,
        entries: [],
        totals: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0
        }
      });
    }
  }
  
  // Sort by date (oldest to newest)
  return result.sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

// Find a food by name
export function findFoodByName(name: string): FoodItem | undefined {
  return vegetarianFoods.find(food => food.name === name);
}

// Get weekly average macros
export function getWeeklyAverages(logs: Record<string, DailyLog>): DailyLog["totals"] {
  const lastSevenDays = getLastXDaysData(logs, 7);
  const daysWithData = lastSevenDays.filter(day => day.entries.length > 0).length;
  
  if (daysWithData === 0) {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0
    };
  }
  
  const totals = lastSevenDays.reduce(
    (acc, day) => {
      acc.calories += day.totals.calories;
      acc.protein += day.totals.protein;
      acc.carbs += day.totals.carbs;
      acc.fat += day.totals.fat;
      acc.fiber += day.totals.fiber;
      return acc;
    },
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0
    }
  );
  
  return {
    calories: Math.round(totals.calories / daysWithData),
    protein: Math.round((totals.protein / daysWithData) * 10) / 10,
    carbs: Math.round((totals.carbs / daysWithData) * 10) / 10,
    fat: Math.round((totals.fat / daysWithData) * 10) / 10,
    fiber: Math.round((totals.fiber / daysWithData) * 10) / 10
  };
}
