import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vegetarianFoods } from "@/data/vegetarianFoods";
import { FoodEntry } from "@/types/nutrition";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FoodSelectorProps {
  onAddFood: (entry: FoodEntry) => void;
  disabled?: boolean;
}

/**
 * Streamlined food selector with single input and inline suggestions
 */
export function FoodSelector({ onAddFood, disabled }: FoodSelectorProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedFood, setSelectedFood] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Filter foods based on search term
  const filteredFoods = vegetarianFoods.filter(food => 
    food.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5); // Limit to 5 suggestions

  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    setSelectedFood("");
    setShowSuggestions(value.length > 0);
  };

  const handleSelectFood = (foodName: string) => {
    setSearchTerm(foodName);
    setSelectedFood(foodName);
    setShowSuggestions(false);
  };

  const handleAdd = () => {
    if (!selectedFood && !searchTerm) {
      toast.error("Please select a food");
      return;
    }

    const foodName = selectedFood || searchTerm;
    const food = vegetarianFoods.find(f => f.name.toLowerCase() === foodName.toLowerCase());
    
    if (!food) {
      toast.error("Food not found in database");
      return;
    }

    if (!qty || qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    onAddFood({ foodId: food.name, quantity: qty });
    toast.success(`${food.name} added!`);

    // Reset form
    setSearchTerm("");
    setSelectedFood("");
    setQty(1);
    setShowSuggestions(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (filteredFoods.length > 0 && !selectedFood) {
        handleSelectFood(filteredFoods[0].name);
      } else {
        handleAdd();
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Food Search Input */}
        <div className="relative flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Type to search foods (e.g., oats, banana)..."
              value={searchTerm}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => searchTerm && setShowSuggestions(true)}
              disabled={disabled}
              className="pl-14 h-12 border-2 border-green-200 focus:border-green-500 mobile-button"
            />
          </div>
          
          {/* Suggestions Dropdown */}
          {showSuggestions && filteredFoods.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white border-2 border-green-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredFoods.map((food) => (
                <div
                  key={food.name}
                  onClick={() => handleSelectFood(food.name)}
                  className="px-4 py-3 cursor-pointer hover:bg-green-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{food.name}</span>
                    <span className="text-sm text-gray-600">
                      {food.calories}cal • P:{food.protein}g • C:{food.carbs}g • F:{food.fat}g
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quantity and Add Button Row */}
        <div className="flex gap-3 sm:gap-2">
          {/* Quantity Input */}
          <div className="flex-1 sm:w-32">
            <div className="relative">
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                disabled={disabled}
                className="h-12 text-center border-2 border-blue-200 focus:border-blue-500 mobile-button"
                placeholder="1.0"
              />
              <div className="absolute inset-x-0 -bottom-6 text-center text-xs text-gray-500">
                Quantity (g/ml)
              </div>
            </div>
          </div>

          {/* Add Button */}
          <Button 
            onClick={handleAdd} 
            disabled={disabled || (!selectedFood && !searchTerm) || !qty || qty <= 0}
            className="h-12 px-6 bg-green-600 hover:bg-green-700 mobile-button"
            size="lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Add Food</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Selected Food Preview */}
      {selectedFood && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-green-800">{selectedFood}</span>
              <span className="text-sm text-green-600 ml-2">
                ({qty} serving{qty !== 1 ? 's' : ''})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setSelectedFood("");
                setShowSuggestions(false);
              }}
              className="text-green-600 hover:text-green-800"
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
