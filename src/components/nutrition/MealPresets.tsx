import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mealPresets } from "@/data/vegetarianFoods";
import { FoodEntry } from "@/types/nutrition";
import { findFoodByName } from "@/lib/nutritionUtils";

interface MealPresetsProps {
  onAddMeal: (entries: FoodEntry[]) => void;
}

export function MealPresets({ onAddMeal }: MealPresetsProps) {
  const handleAddPreset = (presetIndex: number) => {
    const preset = mealPresets[presetIndex];
    if (!preset) return;
    
    const entries: FoodEntry[] = preset.foods.map(food => ({
      foodId: food.name,
      quantity: food.quantity
    }));
    
    onAddMeal(entries);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Combined Meals (Presets)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mealPresets.map((preset, index) => {
          // Calculate total calories for this preset
          const totalCalories = preset.foods.reduce((total, food) => {
            const foodItem = findFoodByName(food.name);
            return total + (foodItem ? foodItem.calories * food.quantity : 0);
          }, 0);
          
          return (
            <Card key={index} className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-md font-medium">{preset.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="text-sm text-muted-foreground">
                    {Math.round(totalCalories)} calories
                  </div>
                  <ul className="text-sm space-y-1">
                    {preset.foods.map((food, foodIndex) => {
                      const foodItem = findFoodByName(food.name);
                      return (
                        <li key={foodIndex} className="flex justify-between">
                          <span>{food.name}</span>
                          <span className="text-muted-foreground">{food.quantity} × {foodItem?.servingSize}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <Button 
                  onClick={() => handleAddPreset(index)}
                  className="w-full"
                  variant="outline"
                >
                  Add to Today
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
