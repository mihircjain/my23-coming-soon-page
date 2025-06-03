import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vegetarianFoods } from "@/data/vegetarianFoods";
import { FoodEntry } from "@/types/nutrition";
import { toast } from "sonner"; // Import toast
import { CustomFoodSelect } from "./CustomFoodSelect"; // Import the new custom component

interface FoodSelectorProps {
  onAddFood: (entry: FoodEntry) => void;
}

export function FoodSelector({ onAddFood }: FoodSelectorProps) {
  const [value, setValue] = useState(""); // This will hold the selected food name
  const [quantity, setQuantity] = useState(1);

  const handleSelect = (selectedFoodName: string) => {
    console.log("Custom select handleSelect called with:", selectedFoodName);
    setValue(selectedFoodName);
  };

  const handleAddFood = () => {
    if (value) {
      const foodItem = vegetarianFoods.find((food) => food.name === value);
      if (foodItem) {
        onAddFood({
          foodId: value,
          quantity: quantity,
        });
        // Show success toast
        toast.success(`${foodItem.name} added successfully!`);
        // Reset form
        setValue("");
        setQuantity(1);
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-2 items-end">
      <div className="flex-grow">
        {/* Use the new CustomFoodSelect component */}
        <CustomFoodSelect 
          value={value} 
          onSelect={handleSelect} 
        />
      </div>

      <div className="w-24 relative">
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={quantity}
          onChange={(e) => setQuantity(parseFloat(e.target.value) || 0.01)}
          className="h-10"
          title="Enter any quantity above 0"
        />
        <div className="absolute text-xs text-gray-500 mt-1">Any value > 0</div>
      </div>

      <Button onClick={handleAddFood} disabled={!value}>
        <Plus className="mr-2 h-4 w-4" /> Add
      </Button>
    </div>
  );
}

