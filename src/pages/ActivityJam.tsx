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

// Cached data freshness (in hours)
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

  // In prod, derive from auth
  const userId = "mihir_jain";

  // =============================
  // HELPERS – FIRESTORE / STRAVA
  // =============================
  const getCachedActivities = async (): Promise<StravaActivity[]> => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - CACHE_HOURS);

    const ref = collection(db, "strava_data");
    const q = query(
      ref,
      where("userId", "==", userId),
      where("fetched_at", ">=", Timestamp.fromDate(cutoff)),
      orderBy("fetched_at", "desc"),
      limit(50)
    );

    const snap = await getDocs(q);
    if (snap.empty) return [];

    return snap.docs.map((d) => {
      const x = d.data();
      return {
        date: new Date(x.start_date).toLocaleDateString(),
        type: x.type,
        distance: x.distance,
        duration: x.duration,
        heart_rate: x.heart_rate ?? null,
        name: x.name,
        elevation_gain: x.elevation_gain ?? 0,
        calories: x.caloriesBurned ?? 0,
      } as StravaActivity;
    });
  };

  const refreshFromStrava = async () => {
    try {
      const resp = await fetch(`/api/strava?days=30&userId=${userId}`);
      if (!resp.ok) throw new Error(`Strava ${resp.status}`);
      const json = await resp.json();

      const acts: StravaActivity[] = json.map((a: any) => ({
        date: new Date(a.start_date).toLocaleDateString(),
        type: a.type,
        distance: a.distance,
        duration: a.duration,
        heart_rate: a.heart_rate,
        name: a.name,
        elevation_gain: a.elevation_gain ?? 0,
        calories: a.caloriesBurned ?? 0,
      }));

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const filtered = acts.filter((a) => new Date(a.date) >= cutoff);

      setActivities(filtered);
      generateChartData(filtered);
      calculateSummaryStats(filtered);
    } catch (err) {
      console.error("Strava fetch failed", err);
    }
  };

  // =============================
  // PRIMARY FETCH
  // =============================
  const loadActivities = async () => {
    setLoading(true);

    try {
      const cached = await getCachedActivities();
      if (cached.length) {
        // show instantly
        setActivities(cached);
        generateChartData(cached);
        calculateSummaryStats(cached);
        // background refresh (no await)
        refreshFromStrava();
      } else {
        // no cache; wait for Strava once
        await refreshFromStrava();
      }
    } finally {
      setLoading(false);
    }
  };

  // =============================
  // CHART BUILDERS & SUMMARY
  // =============================
  const generateChartData = (acts: StravaActivity[]) => {
    const sorted = [...acts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Heart rate
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

    // Distance
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

    // Activity types distribution
    const allTypes = sorted.map((a) => a.type);
    const uniq = [...new Set(allTypes)];
    const counts = uniq.map((t) => allTypes.filter((x) => x === t).length);
    const colors = uniq.map((_, i) => `hsla(${(i * 137) % 360},70%,60%,0.7)`);

    setActivityTypeData({
      labels: uniq,
      datasets: [
        {
          label: "Activity Types",
          data: counts,
          backgroundColor: colors,
        },
      ],
    });

    // Weight training (minutes per day)
    const wMap = new Map<string, number>();
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      wMap.set(d.toLocaleDateString(), 0);
    }
    sorted
      .filter((a) => a.type.toLowerCase() === "weighttraining")
      .forEach((a) => wMap.set(a.date, (wMap.get(a.date) || 0) + a.duration));

    const wDates = [...wMap.keys()].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
    setWeightTrainingData({
      labels: wDates,
      datasets: [
        {
          label: "Weight Training (minutes)",
          data: wDates.map((d) => wMap.get(d) || 0),
          borderColor: "rgba(139,92,246,0.8)",
          backgroundColor: "rgba(139,92,246,0.2)",
          fill: true,
          tension: 0.3,
        },
      ],
    });

    // Calories burned
    const cMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      cMap.set(d.toLocaleDateString(), 0);
    }
    sorted.forEach((a) => cMap.set(a.date, (cMap.get(a.date) || 0) + a.calories));

    const cDates = [...cMap.keys()].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
    setCaloriesData({
      labels: cDates,
      datasets: [
        {
          label: "Calories Burned",
          data: cDates.map((d) => cMap.get(d) || 0),
          borderColor: "rgba(245,158,11,0.8)",
          backgroundColor: "rgba(245,158,11,0.2)",
          fill: true,
          tension: 0.3,
        },
      ],
    });
  };

  const calculateSummaryStats = (acts: StravaActivity[]) => {
    const totalDistance = acts.reduce((s, a) => s + a.distance, 0);
    const totalDuration = acts.reduce((s, a) => s + a.duration, 0);
    const hrActs = acts.filter((a) => a.heart_rate !== null);
    const avgHr = hrActs.length
      ? hrActs.reduce((s, a) => s + (
