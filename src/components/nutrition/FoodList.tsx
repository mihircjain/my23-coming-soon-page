import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FoodEntry } from "@/types/nutrition";
import { vegetarianFoods } from "@/data/vegetarianFoods";
import { calculateTotals } from "@/lib/nutritionUtils";

interface FoodListProps {
  entries: FoodEntry[];
  onRemoveFood: (index: number) => void;
  onUpdateQuantity: (index: number, quantity: number) => void;
}

export function FoodList({ entries, onRemoveFood, onUpdateQuantity }: FoodListProps) {
  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0
  });

  useEffect(() => {
    // Ensure entries is an array before calculating totals
    if (Array.isArray(entries)) {
      setTotals(calculateTotals(entries));
    } else {
      // Reset totals if entries is not an array (e.g., undefined)
      setTotals({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
    }
  }, [entries]);

  // Ensure entries is an array before rendering the list
  const safeEntries = Array.isArray(entries) ? entries : [];

  return (
    <div className="space-y-4">
      {safeEntries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No foods added yet. Use the selector above to add foods.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Food</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Qty</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Cal</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Protein</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Carbs</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Fat</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Fiber</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {safeEntries.map((entry, index) => {
                  const food = vegetarianFoods.find(f => f.name === entry.foodId);
                  if (!food) return null;
                  
                  const calories = Math.round(food.calories * entry.quantity);
                  const protein = Math.round(food.protein * entry.quantity * 10) / 10;
                  const carbs = Math.round(food.carbs * entry.quantity * 10) / 10;
                  const fat = Math.round(food.fat * entry.quantity * 10) / 10;
                  const fiber = Math.round(food.fiber * entry.quantity * 10) / 10;
                  
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-sm">
                        <div className="font-medium">{food.name}</div>
                        <div className="text-xs text-muted-foreground">{food.servingSize}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="relative group">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={entry.quantity}
                            onChange={(e) => {
                              // Allow direct text input but convert to number
                              const inputValue = e.target.value.replace(/[^\d.]/g, '');
                              const value = parseFloat(inputValue);
                              
                              // Only update if it's a valid positive number
                              if (!isNaN(value) && value > 0) {
                                onUpdateQuantity(index, value);
                              }
                            }}
                            onBlur={(e) => {
                              // On blur, ensure we have a valid value (minimum 0.01)
                              const value = parseFloat(e.target.value);
                              if (isNaN(value) || value <= 0) {
                                onUpdateQuantity(index, 0.01);
                              }
                            }}
                            className="w-16 h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                            title="Enter any quantity above 0"
                          />
                          <div className="absolute left-0 -bottom-8 hidden group-hover:block bg-black text-white text-xs rounded p-1 z-10 whitespace-nowrap">
                            Enter any quantity above 0
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">{calories}</td>
                      <td className="py-3 px-4 text-sm">{protein}g</td>
                      <td className="py-3 px-4 text-sm">{carbs}g</td>
                      <td className="py-3 px-4 text-sm">{fat}g</td>
                      <td className="py-3 px-4 text-sm">{fiber}g</td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveFood(index)}
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 font-medium">
                  <td className="py-3 px-4 text-sm">Total</td>
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-sm">{totals.calories}</td>
                  <td className="py-3 px-4 text-sm">{totals.protein}g</td>
                  <td className="py-3 px-4 text-sm">{totals.carbs}g</td>
                  <td className="py-3 px-4 text-sm">{totals.fat}g</td>
                  <td className="py-3 px-4 text-sm">{totals.fiber}g</td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="pt-4">
              <div className="grid grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold">{totals.calories}</div>
                  <div className="text-xs text-muted-foreground">Calories</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{totals.protein}g</div>
                  <div className="text-xs text-muted-foreground">Protein</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{totals.carbs}g</div>
                  <div className="text-xs text-muted-foreground">Carbs</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{totals.fat}g</div>
                  <div className="text-xs text-muted-foreground">Fat</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{totals.fiber}g</div>
                  <div className="text-xs text-muted-foreground">Fiber</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

