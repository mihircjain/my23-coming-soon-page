import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vegetarianFoods } from "@/data/vegetarianFoods";
import { FoodEntry } from "@/types/nutrition";
import { toast } from "sonner";
import { CustomFoodSelect } from "./CustomFoodSelect";

interface FoodSelectorProps {
  onAddFood: (entry: FoodEntry) => void;
}

/**
 * Selector for adding a food item to today’s log.
 * ● Autocomplete drop‑down (CustomFoodSelect) for the food name.
 * ● Numeric input for quantity (any positive decimal).
 * ● “Add” button sends { foodId, quantity } to the parent.
 */
export function FoodSelector({ onAddFood }: FoodSelectorProps) {
  const [selectedFood, setSelectedFood] = useState<string>("");
  const [qty, setQty] = useState<number>(1);

  /* when the user chooses a food in the autocomplete */
  const handleSelect = (name: string) => setSelectedFood(name);

  /* add button */
  const handleAdd = () => {
    if (!selectedFood) return; // guard

    const food = vegetarianFoods.find(f => f.name === selectedFood);
    if (!food) {
      toast.error("Food not found in database");
      return;
    }

    if (!qty || qty <= 0) {
      toast.error("Quantity must be > 0");
      return;
    }

    onAddFood({ foodId: selectedFood, quantity: qty });
    toast.success(`${food.name} added!`);

    // reset form
    setSelectedFood("");
    setQty(1);
  };

  return (
    <div className="flex flex-col md:flex-row gap-2 items-end">
      {/* food selector */}
      <div className="flex-grow">
        <CustomFoodSelect value={selectedFood} onSelect={handleSelect} />
      </div>

      {/* quantity input */}
      <div className="w-24 relative">
        <Input
          type="number"
          min={0.01}
          step={0.1}
          value={qty}
          onChange={e => setQty(parseFloat(e.target.value) || 0)}
          className="h-10 text-right"
        />
        <div className="absolute left-0 -bottom-5 text-xs text-gray-500">g / ml</div>
      </div>

      {/* add button */}
      <Button onClick={handleAdd} disabled={!selectedFood || !qty || qty <= 0}>
        <Plus className="mr-2 h-4 w-4" /> Add
      </Button>
    </div>
  );
}
