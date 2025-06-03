import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DailyLog } from "@/types/nutrition";
import { loadAllNutritionLogsFromFirestore, formatDateForDisplay } from "@/lib/nutritionUtils";

export const PublicFoodLog = () => {
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const logsRecord = await loadAllNutritionLogsFromFirestore();
        // Convert record to array and sort by date (most recent first)
        const logsArray = Object.values(logsRecord).sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setAllLogs(logsArray);
      } catch (error) {
        console.error("Error fetching all logs for public display:", error);
        // Optionally show an error message to the user
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm mt-6">
      <CardHeader>
        <CardTitle>Public Food Log (All Entries)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-8 w-1/4 mt-4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : allLogs.length === 0 ? (
          <p className="text-center text-gray-500">No food logs found.</p>
        ) : (
          <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2"> {/* Added scroll */} 
            {allLogs.map((log) => (
              <div key={log.date}>
                <h3 className="text-lg font-semibold mb-2">{formatDateForDisplay(log.date)}</h3>
                {Array.isArray(log.entries) && log.entries.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Food</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Cal</TableHead>
                        <TableHead className="text-right">P (g)</TableHead>
                        <TableHead className="text-right">C (g)</TableHead>
                        <TableHead className="text-right">F (g)</TableHead>
                        {/* <TableHead className="text-right">Fib (g)</TableHead> */}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {log.entries.map((entry, index) => {
                        // Find the base food item to get macro details per 1 unit
                        const baseFood = vegetarianFoods.find(f => f.name === entry.foodId);
                        const displayQty = entry.quantity || 0;
                        const displayCal = baseFood ? Math.round(baseFood.calories * displayQty) : 0;
                        const displayP = baseFood ? (baseFood.protein * displayQty).toFixed(1) : "0.0";
                        const displayC = baseFood ? (baseFood.carbs * displayQty).toFixed(1) : "0.0";
                        const displayF = baseFood ? (baseFood.fat * displayQty).toFixed(1) : "0.0";
                        // const displayFib = baseFood ? (baseFood.fiber * displayQty).toFixed(1) : "0.0";
                        
                        return (
                          <TableRow key={`${log.date}-${index}`}>
                            <TableCell>{entry.foodId}</TableCell>
                            <TableCell className="text-right">{displayQty}</TableCell>
                            <TableCell className="text-right">{displayCal}</TableCell>
                            <TableCell className="text-right">{displayP}</TableCell>
                            <TableCell className="text-right">{displayC}</TableCell>
                            <TableCell className="text-right">{displayF}</TableCell>
                            {/* <TableCell className="text-right">{displayFib}</TableCell> */}
                          </TableRow>
                        );
                      })}
                      {/* Display Totals Row */}
                       <TableRow className="font-semibold bg-gray-50">
                        <TableCell>Total</TableCell>
                        <TableCell></TableCell> {/* Empty cell for Qty */}
                        <TableCell className="text-right">{log.totals.calories}</TableCell>
                        <TableCell className="text-right">{log.totals.protein.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{log.totals.carbs.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{log.totals.fat.toFixed(1)}</TableCell>
                        {/* <TableCell className="text-right">{log.totals.fiber.toFixed(1)}</TableCell> */}
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-gray-500 pl-2">No entries for this day.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Need to import vegetarianFoods here or pass it as a prop if needed for calculations
import { vegetarianFoods } from "@/data/vegetarianFoods";

