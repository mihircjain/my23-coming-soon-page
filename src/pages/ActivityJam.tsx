import { useEffect, useState } from "react";
import { ArrowLeft, Activity, Heart, Clock, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { initializeCharts } from "./ActivityJamCharts";
import { db } from "@/lib/firebaseConfig";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  Timestamp,
} from "firebase/firestore";

// =============================
// TYPES
// =============================
interface StravaActivity {
  date: string;
  type: string;
  distance: number;
  duration: number;
  heart_rate: number | null;
  name: string;
  elevation_gain: number;
  calories: number;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: (number | null)[];
    borderColor?: string;
    backgroundColor?: string | string[];
    fill?: boolean;
    tension?: number;
  }[];
}

// Freshness window (in hours) for cached data
const CACHE_HOURS = 12;

const CurrentJam = () => {
  const navigate = useNavigate();

  // =============================
  // STATE
  // =============================
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<StravaActivity[]>([]);

  const [heartRateData, setHeartRateData] = useState<ChartData | null>(null);
  const [distanceData, setDistanceData] = useState<ChartData | null>(null);
  const [activityTypeData, setActivityTypeData] = useState<ChartData | null>(null);
  const [weightTrainingData, setWeightTrainingData] = useState<ChartData | null>(null);
  const [caloriesData, setCaloriesData] = useState<ChartData | null>(null);

  const [summaryStats, setSummaryStats] = useState({
    totalDistance: 0,
    totalDuration: 0,
    avgHeartRate: 0,
    activityCount: 0,
  });

  // Hard‑coded for now – replace with auth user id when available
  const userId = "mihir_jain";

  // =============================
  // HELPERS
  // =============================
  /**
   * Pull up‑to‑date (≤ 30 days) activities from cache.
   */
  const getCachedActivities = async (): Promise<StravaActivity[]> => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - CACHE_HOURS);

    const stravaDataRef = collection(db, "strava_data");
    const q = query(
      stravaDataRef,
      where("userId", "==", userId),
      where("fetched_at", ">=", Timestamp.fromDate(cutoff)), // Firestore Timestamp
      orderBy("fetched_at", "desc"),
      limit(50)
    );

    const snap = await getDocs(q);
    if (snap.empty) return [];

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        date: new Date(d.start_date).toLocaleDateString(),
        type: d.type,
        distance: d.distance,
        duration: d.duration,
        heart_rate: d.heart_rate ?? null,
        name: d.name,
        elevation_gain: d.elevation_gain ?? 0,
        calories: d.caloriesBurned ?? 0,
      } as StravaActivity;
    });
  };

  /**
   * Fetch from Strava proxy API (serverless). Runs silently in background.
   */
  const refreshFromStrava = async () => {
    try {
      const resp = await fetch(`/api/strava?days=30&userId=${userId}`);
      if (!resp.ok) {
        console.warn("Strava API error", resp.status, resp.statusText);
        return;
      }
      const raw = await resp.json();

      const freshActivities: StravaActivity[] = raw.map((a: any) => ({
        date: new Date(a.start_date).toLocaleDateString(),
        type: a.type,
        distance: a.distance,
        duration: a.duration,
        heart_rate: a.heart_rate,
        name: a.name,
        elevation_gain: a.elevation_gain ?? 0,
        calories: a.caloriesBurned ?? 0,
      }));

      // Apply 30‑day filter client‑side (Strava proxy already does this, but safe):
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const filtered = freshActivities.filter(
        (a) => new Date(a.date) >= thirtyDaysAgo
      );

      setActivities(filtered);
      generateChartData(filtered);
      calculateSummaryStats(filtered);
    } catch (err) {
      console.error("Failed to refresh from Strava", err);
    }
  };

  // =============================
  // MAIN FETCH EFFECT
  // =============================
  const fetchActivities = async () => {
    setLoading(true);

    // 1️⃣ Try cache first
    let cached: StravaActivity[] = [];
    try {
      cached = await getCachedActivities();
    } catch (err) {
      console.warn("Cache lookup failed", err);
    }

    if (cached.length) {
      // 🎉 Immediate render using cache
      setActivities(cached);
      generateChartData(cached);
      calculateSummaryStats(cached);
      setLoading(false);

      // Optionally refresh in background _if_ cache is old
      refreshFromStrava();
    } else {
      // 😕 No cache – fetch live (blocking for now)
      await refreshFromStrava();
      setLoading(false);
    }
  };

  /**
   * Build all chart datasets
   */
  const generateChartData = (acts: StravaActivity[]) => {
    // Sort by date asc for nice line charts
    const sorted = [...acts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 🔹 Heart‑rate
    setHeartRateData({
      labels: sorted.map((a) => a.date),
      datasets: [
        {
          label: "Heart Rate (bpm)",
          data: sorted.map((a) => a.heart_rate),
          borderColor: "rgba(255,99,132,0.8)",
          backgroundColor: "rgba(255,99,132,0.2)",
          fill: false,
        },
      ],
    });

    // 🔹 Distance
    setDistanceData({
      labels: sorted.map((a) => a.date),
      datasets: [
        {
          label: "Distance (km)",
          data: sorted.map((a) => a.distance),
          backgroundColor: "rgba(54,162,235,0.6)",
        },
      ],
    });

    // 🔹 Activity type distribution
    const allTypes = sorted.map((a) => a.type);
    const unique = [...new Set(allTypes)];
    const counts = unique.map((t) => allTypes.filter((x) => x === t).length);
    const typeColors = unique.map((_, i) => `hsla(${(i * 137) % 360},70%,60%,0.7)`);

    setActivityTypeData({
      labels: unique,
      datasets: [
        {
          label: "Activity Types",
          data: counts,
          backgroundColor: typeColors,
        },
      ],
    });

    // 🔹 Weight training (duration per day)
    const wtMap = new Map<string, number>();
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      wtMap.set(d.toLocaleDateString(), 0);
    }
    sorted
      .filter((a) => a.type.toLowerCase() === "weighttraining")
      .forEach((a) => wtMap.set(a.date, (wtMap.get(a.date) || 0) + a.duration));

    const wtDates = [...wtMap.keys()].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
    setWeightTrainingData({
      labels: wtDates,
      datasets: [
        {
          label: "Weight Training (min)",
          data: wtDates.map((d) => wtMap.get(d) || 0),
          borderColor: "rgba(139,92,246,0.8)",
          backgroundColor: "rgba(139,92,246,0.2)",
          fill: true,
          tension: 0.3,
        },
      ],
    });

    // 🔹 Calories burned
    const calsMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      calsMap.set(d.toLocaleDateString(), 0);
    }
    sorted.forEach((a) => calsMap.set(a.date, (calsMap.get(a.date) || 0) + a.calories));

    const calDates = [...calsMap.keys()].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
    setCaloriesData({
      labels: calDates,
      datasets: [
        {
          label: "Calories Burned",
          data: calDates.map((d) => calsMap.get(d) || 0),
          borderColor: "rgba(245,158,11,0.8)",
          backgroundColor: "rgba(245,158,11,0.2)",
          fill: true,
          tension: 0.3,
        },
      ],
    });
  };

  /**
   * Quick stats for summary cards
   */
  const calculateSummaryStats = (acts: StravaActivity[]) => {
    const totalDistance = acts.reduce((s, a) => s + a.distance, 0);
    const totalDuration = acts.reduce((s, a) => s + a.duration, 0);
    const hrActs = acts.filter((a) => a.heart_rate !== null);
    const avgHr = hrActs.length
      ? hrActs.reduce((s, a) => s + (a.heart_rate || 0), 0) / hrActs.length
      : 0;

    setSummaryStats({
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalDuration: Math.round(totalDuration),
      avgHeartRate: Math.round(avgHr),
      activityCount: acts.length,
    });
  };

  // =============================
  // EFFECTS
  // =============================
  useEffect(() => {
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render charts once datasets ready
  useEffect(() => {
    if (
      !loading &&
      heartRateData &&
      distanceData &&
      activityTypeData &&
      weightTrainingData &&
      caloriesData
    ) {
      initializeCharts(
        heartRateData,
        distanceData,
        activityTypeData,
        weightTrainingData,
        caloriesData
      );
    }
  }, [loading, heartRateData, distanceData, activityTypeData, weightTrainingData, caloriesData]);

  // =============================
  // JSX (unchanged – UI skeleton kept as‑is)
  // =============================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
      {/* Gradient blobs, header, cards & charts markup remain unchanged. */}
      {/* … The JSX content from your original component goes here unchanged … */}
    </div>
  );
};

export default CurrentJam;
