import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { vegetarianFoods } from "@/data/vegetarianFoods";
import { FoodEntry } from "@/types/nutrition";

interface FoodSelectorProps {
  onAddFood: (entry: FoodEntry) => void;
}

export function FoodSelector({ onAddFood }: FoodSelectorProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [searchValue, setSearchValue] = useState("");

  const handleSelect = (currentValue: string) => {
    setValue(currentValue);
    setOpen(false);
  };

  const handleAddFood = () => {
    if (value) {
      onAddFood({
        foodId: value,
        quantity: quantity,
      });
      setValue("");
      setQuantity(1);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-2 items-end">
      <div className="flex-grow">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {value
                ? vegetarianFoods.find((food) => food.name === value)?.name
                : "Select food..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput 
                placeholder="Search food..." 
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandEmpty>No food found.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-y-auto">
                {vegetarianFoods.map((food) => (
                  <CommandItem
                    key={food.name}
                    value={food.name}
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === food.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{food.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {food.servingSize} • {food.calories} cal • P: {food.protein}g • C: {food.carbs}g • F: {food.fat}g
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="w-24">
        <Input
          type="number"
          min="0.1"
          step="0.1"
          value={quantity}
          onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
          className="h-10"
        />
      </div>

      <Button onClick={handleAddFood} disabled={!value}>
        <Plus className="mr-2 h-4 w-4" /> Add
      </Button>
    </div>
  );
}
