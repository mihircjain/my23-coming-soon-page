import { DailyLog, FoodEntry, FoodItem } from "@/types/nutrition";
import { vegetarianFoods } from "@/data/vegetarianFoods";
import { db } from "./firebase"; // Import Firestore instance
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy 
} from "firebase/firestore";

// --- Firestore Collection Reference ---
const logsCollectionRef = collection(db, "nutritionLogs");

// --- Utility Functions (Date, Calculation, etc.) ---

// Calculate totals for a set of food entries
export function calculateTotals(entries: FoodEntry[]): DailyLog["totals"] {
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0
  };

  if (Array.isArray(entries)) {
    entries.forEach(entry => {
      const food = vegetarianFoods.find(f => f.name === entry.foodId);
      if (food) {
        totals.calories += (food.calories || 0) * (entry.quantity || 0);
        totals.protein += (food.protein || 0) * (entry.quantity || 0);
        totals.carbs += (food.carbs || 0) * (entry.quantity || 0);
        totals.fat += (food.fat || 0) * (entry.quantity || 0);
        totals.fiber += (food.fiber || 0) * (entry.quantity || 0);
      }
    });
  }

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
  const now = new Date();
  // Use local date methods to ensure consistency with user's timezone
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Format Date object to YYYY-MM-DD string
export function formatDateToYYYYMMDD(date: Date): string {
  // Use local date methods to ensure consistency with user's timezone
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Get date from X days ago in YYYY-MM-DD format
export function getDateXDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return formatDateToYYYYMMDD(date);
}

// Format date string (YYYY-MM-DD) for display (e.g., "Jun 3")
export function formatDateForDisplay(dateString: string): string {
  // Use consistent date parsing to match the local timezone approach
  const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Find a food by name
export function findFoodByName(name: string): FoodItem | undefined {
  return vegetarianFoods.find(food => food.name === name);
}

// --- Firestore Operations ---

// Load all nutrition logs from Firestore
export async function loadAllNutritionLogsFromFirestore(): Promise<Record<string, DailyLog>> {
  console.log("Firestore: Loading all nutrition logs...");
  try {
    const logsSnapshot = await getDocs(logsCollectionRef);
    const logs: Record<string, DailyLog> = {};
    logsSnapshot.forEach((doc) => {
      // Ensure data conforms to DailyLog structure
      const data = doc.data();
      if (data && typeof data === "object" && data.date && Array.isArray(data.entries) && data.totals) {
        logs[doc.id] = data as DailyLog;
      } else {
        console.warn(`Firestore: Invalid data format for log ${doc.id}`, data);
      }
    });
    console.log("Firestore: Loaded logs:", logs);
    return logs;
  } catch (error) {
    console.error("Firestore: Error loading nutrition logs:", error);
    return {}; // Return empty object on error
  }
}

// Load a specific daily log from Firestore
export async function loadDailyLogFromFirestore(date: string): Promise<DailyLog | null> {
  console.log(`Firestore: Loading log for date: ${date}`);
  try {
    const docRef = doc(db, "nutritionLogs", date);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log(`Firestore: Log found for ${date}:`, docSnap.data());
      // Ensure data conforms to DailyLog structure
      const data = docSnap.data();
      if (data && typeof data === "object" && data.date && Array.isArray(data.entries) && data.totals) {
        return data as DailyLog;
      } else {
        console.warn(`Firestore: Invalid data format for log ${date}`, data);
        return null;
      }
    } else {
      console.log(`Firestore: No log found for date: ${date}`);
      return null;
    }
  } catch (error) {
    console.error(`Firestore: Error loading log for date ${date}:`, error);
    return null;
  }
}

// Save (create or update) a daily log to Firestore
export async function saveDailyLogToFirestore(log: DailyLog): Promise<void> {
  console.log(`Firestore: Saving log for date: ${log.date}`, log);
  try {
    // Ensure entries is an array
    const safeLog = { 
      ...log, 
      entries: Array.isArray(log.entries) ? log.entries : [] 
    };
    const docRef = doc(db, "nutritionLogs", log.date);
    await setDoc(docRef, safeLog); // setDoc will create or overwrite
    console.log(`Firestore: Successfully saved log for date: ${log.date}`);
  } catch (error) {
    console.error(`Firestore: Error saving log for date ${log.date}:`, error);
  }
}

// Get or create a daily log for a specific date (handles Firestore interaction)
export async function getOrCreateDailyLogFirestore(date: string): Promise<DailyLog> {
  console.log(`Firestore: Getting or creating log for date: ${date}`);
  let log = await loadDailyLogFromFirestore(date);
  
  if (!log) {
    console.log(`Firestore: Creating new log for date: ${date}`);
    log = {
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
    // Optionally save the newly created empty log immediately, 
    // or wait until an entry is added.
    // await saveDailyLogToFirestore(log); 
  }
  // Ensure entries is always an array
  if (!Array.isArray(log.entries)) {
    log.entries = [];
  }
  return log;
}

// --- Functions potentially needing adaptation or removal (related to localStorage/bulk ops) ---

// // Load nutrition logs from localStorage (REPLACED)
// export function loadNutritionLogs(): Record<string, DailyLog> { ... }

// // Save nutrition logs to localStorage (REPLACED)
// export function saveNutritionLogs(logs: Record<string, DailyLog>): void { ... }

// // Get or create a daily log for a specific date (REPLACED by Firestore version)
// export function getOrCreateDailyLog(logs: Record<string, DailyLog>, date: string): DailyLog { ... }

// Check if it's past 6 PM (Still potentially useful)
export function isPastSixPM(): boolean {
  const now = new Date();
  return now.getHours() >= 18;
}

// Get yesterday's date in YYYY-MM-DD format (Still useful)
export function getYesterdayDateString(): string {
  return getDateXDaysAgo(1);
}

// Copy yesterday's entries to today if none exist and it's past 6 PM (Needs adaptation for Firestore)
export async function autoFillFromYesterdayFirestore(todayDate: string): Promise<DailyLog | null> {
  console.log(`Firestore: Checking autoFill for date: ${todayDate}`);
  const todayLog = await loadDailyLogFromFirestore(todayDate);
  
  if ((!todayLog || !Array.isArray(todayLog.entries) || todayLog.entries.length === 0) && isPastSixPM()) {
    const yesterdayDate = getYesterdayDateString();
    const yesterdayLog = await loadDailyLogFromFirestore(yesterdayDate);
    
    if (yesterdayLog && Array.isArray(yesterdayLog.entries) && yesterdayLog.entries.length > 0) {
      console.log(`Firestore: Auto-filling ${todayDate} from ${yesterdayDate}`);
      const newTodayLog: DailyLog = {
        date: todayDate,
        entries: [...yesterdayLog.entries],
        totals: { ...yesterdayLog.totals }
      };
      await saveDailyLogToFirestore(newTodayLog);
      return newTodayLog;
    }
  }
  console.log(`Firestore: No autoFill needed or possible for ${todayDate}`);
  return todayLog; // Return existing todayLog or null if none exists
}

// Get data for the last X days (Needs adaptation for Firestore)
export async function getLastXDaysDataFirestore(days: number): Promise<Record<string, DailyLog>> {
  console.log(`Firestore: Getting data for last ${days} days`);
  const result: Record<string, DailyLog> = {};
  const datePromises: Promise<DailyLog | null>[] = [];
  const dates: string[] = [];

  for (let i = 0; i < days; i++) {
    const date = getDateXDaysAgo(i);
    dates.push(date);
    datePromises.push(loadDailyLogFromFirestore(date));
  }

  try {
    const dailyLogs = await Promise.all(datePromises);
    dailyLogs.forEach((log, index) => {
      const date = dates[index];
      if (log && Array.isArray(log.entries)) {
        result[date] = log;
      } else {
        // Add empty log for missing dates or invalid entries
        result[date] = {
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
    });

    return result;
  } catch (error) {
    console.error(`Firestore: Error getting last ${days} days data:`, error);
    return {}; // Return empty object on error
  }
}

// Get weekly average macros (Needs adaptation for Firestore)
export async function getWeeklyAveragesFirestore(): Promise<DailyLog["totals"]> {
  console.log("Firestore: Calculating weekly averages...");
  const lastSevenDaysData = await getLastXDaysDataFirestore(7);
  const lastSevenDays = Object.values(lastSevenDaysData);
  const daysWithData = lastSevenDays.filter(day => Array.isArray(day.entries) && day.entries.length > 0).length;
  
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
      if (day.totals) {
        acc.calories += day.totals.calories || 0;
        acc.protein += day.totals.protein || 0;
        acc.carbs += day.totals.carbs || 0;
        acc.fat += day.totals.fat || 0;
        acc.fiber += day.totals.fiber || 0;
      }
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
  
  return {
    calories: Math.round(totals.calories / daysWithData),
    protein: Math.round((totals.protein / daysWithData) * 10) / 10,
    carbs: Math.round((totals.carbs / daysWithData) * 10) / 10,
    fat: Math.round((totals.fat / daysWithData) * 10) / 10,
    fiber: Math.round((totals.fiber / daysWithData) * 10) / 10
  };
}
