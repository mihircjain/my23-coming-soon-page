
import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { vegetarianFoods } from "@/data/vegetarianFoods";
import { cn } from "@/lib/utils";

interface CustomFoodSelectProps {
  value: string;
  onSelect: (value: string) => void;
}

export function CustomFoodSelect({ value, onSelect }: CustomFoodSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredFoods = Array.isArray(vegetarianFoods) 
    ? vegetarianFoods.filter(food => 
        food.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const handleSelect = (foodName: string) => {
    onSelect(foodName);
    setIsOpen(false);
    setSearchTerm("");
  };

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
      >
        {value || "Select food..."}
        <span className="ml-2 h-4 w-4">{isOpen ? '▲' : '▼'}</span>
      </Button>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2">
            <Input
              type="text"
              placeholder="Search food..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          {filteredFoods.length > 0 ? (
            filteredFoods.map((food) => (
              <div
                key={food.name}
                onClick={() => handleSelect(food.name)}
                className={cn(
                  "px-4 py-2 cursor-pointer hover:bg-gray-100",
                  value === food.name && "bg-gray-200"
                )}
              >
                <div className="flex flex-col">
                  <span>{food.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {food.servingSize || "N/A"} • {food.calories || 0} cal • P: {food.protein || 0}g • C: {food.carbs || 0}g • F: {food.fat || 0}g
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-gray-500">No food found.</div>
          )}
        </div>
      )}
    </div>
  );
}
