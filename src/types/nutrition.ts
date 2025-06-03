// Types for nutrition tracking

export interface FoodItem {
  name: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface FoodEntry {
  foodId: string;
  quantity: number;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD format
  entries: FoodEntry[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
}

export interface MealPreset {
  name: string;
  foods: {
    name: string;
    quantity: number;
  }[];
}

export interface NutritionState {
  logs: Record<string, DailyLog>;
  currentDate: string;
}
