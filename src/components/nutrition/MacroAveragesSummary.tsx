import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLastXDaysDataFirestore } from "@/lib/nutritionUtils";
import { prepareChartData } from "@/pages/NutritionJamCharts";

interface MacroAveragesSummaryProps {
  chartTimeframe: "7day" | "30day";
  loading: boolean;
}

interface AveragesData {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

export function MacroAveragesSummary({ chartTimeframe, loading }: MacroAveragesSummaryProps) {
  const [averages, setAverages] = useState<AveragesData>({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    fiber: 0
  });
  const [isCalculating, setIsCalculating] = useState(true);

  // Calculate averages when timeframe changes
  useEffect(() => {
    const calculateAverages = async () => {
      setIsCalculating(true);
      try {
        // Get data for the selected timeframe
        const days = chartTimeframe === "7day" ? 7 : 30;
        const logsData = await getLastXDaysDataFirestore(days);
        const chartData = prepareChartData(logsData, chartTimeframe);
        
        // Filter out days with no entries
        const daysWithData = chartData.filter(day => 
          Array.isArray(day.entries) && day.entries.length > 0
        );
        
        const daysCount = daysWithData.length || 1; // Avoid division by zero
        
        // Calculate totals
        const totals = daysWithData.reduce((acc, day) => {
          acc.calories += day.totals.calories || 0;
          acc.protein += day.totals.protein || 0;
          acc.fat += day.totals.fat || 0;
          acc.carbs += day.totals.carbs || 0;
          acc.fiber += day.totals.fiber || 0;
          return acc;
        }, {
          calories: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
          fiber: 0
        });
        
        // Calculate averages and round to 1 decimal place
        setAverages({
          calories: Math.round(totals.calories / daysCount),
          protein: Math.round((totals.protein / daysCount) * 10) / 10,
          fat: Math.round((totals.fat / daysCount) * 10) / 10,
          carbs: Math.round((totals.carbs / daysCount) * 10) / 10,
          fiber: Math.round((totals.fiber / daysCount) * 10) / 10
        });
      } catch (error) {
        console.error("Error calculating macro averages:", error);
      } finally {
        setIsCalculating(false);
      }
    };
    
    calculateAverages();
  }, [chartTimeframe]);

  // Define the macros to display
  const macros = [
    { name: "Calories", value: averages.calories, unit: "" },
    { name: "Protein", value: averages.protein, unit: "g" },
    { name: "Fat", value: averages.fat, unit: "g" },
    { name: "Carbs", value: averages.carbs, unit: "g" },
    { name: "Fiber", value: averages.fiber, unit: "g" }
  ];

  return (
    <Card className="bg-white/90 backdrop-blur-sm border border-white/20 shadow-sm mb-6 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-green-50">
        <CardTitle className="text-lg flex items-center">
          <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            Average Daily Macros ({chartTimeframe === "7day" ? "7" : "30"} Days)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {loading || isCalculating ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {macros.map((macro, index) => {
              // Generate different gradient colors for each macro
              const gradients = [
                "from-red-500 to-red-600", // Calories
                "from-blue-500 to-blue-600", // Protein
                "from-green-500 to-green-600", // Fat
                "from-purple-500 to-purple-600", // Carbs
                "from-amber-500 to-amber-600", // Fiber
              ];
              
              return (
                <div 
                  key={macro.name} 
                  className="bg-white/50 rounded-lg p-3 text-center shadow-sm border border-gray-100 hover:shadow-md transition-all transform hover:scale-105"
                >
                  <div className="text-sm text-gray-500">Avg {macro.name}/day{macro.unit ? ` (${macro.unit})` : ""}</div>
                  <div className={`text-xl font-semibold mt-1 bg-gradient-to-r ${gradients[index]} bg-clip-text text-transparent`}>
                    {macro.value}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
