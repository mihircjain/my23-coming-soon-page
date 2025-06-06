// Customized Food Database with macros
// Each food item includes: calories, protein, carbs, fat, fiber, and default serving size

export interface FoodItem {
  name: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export const vegetarianFoods: FoodItem[] = [
  {
    name: "Mixed Vegetable Sabzi",
    servingSize: "50g",
    calories: 28,
    protein: 0.7,
    carbs: 3.6,
    fat: 1.2,
    fiber: 1.4
  },
  {
  "name": "Lotus Biscoff Cheesecake",
  "quantity": 125,
  "unit": "g",
  "nutrition": {
    "calories": 494,
    "protein_g": 4.9,
    "fat_g": 38.2,
    "carbs_g": 34.4,
    "fiber_g": 0.2
  }
  },
  {
    name: "Knorr Pizza and Pasta Sauce",
    servingSize: "40g",
    calories: 33,
    protein: 0.5,
    carbs: 5.6,
    fat: 1.0,
    fiber: 0.4
  },
  {
    name: "71% Dark Chocolate",
    servingSize: "52g",
    calories: 310,
    protein: 4.2,
    carbs: 20.8,
    fat: 23.4,
    fiber: 4.2
  },
  {
    name: "Caramel and Salted Popcorn",
    servingSize: "120g",
    calories: 461,
    protein: 9.0,
    carbs: 100.8,
    fat: 3.6,
    fiber: 10.2
  },
  {
    name: "Pyaaz ka Paratha",
    servingSize: "150g",
    calories: 287,
    protein: 5.9,
    carbs: 34.9,
    fat: 14.1,
    fiber: 6.2
  },
  {
    name: "Capsicum Tomato Onion",
    servingSize: "120g",
    calories: 77,
    protein: 1.3,
    carbs: 7.0,
    fat: 5.2,
    fiber: 2.5
  },
  {
    name: "13g Protein Bar, Double Cocoa",
    servingSize: "52g",
    calories: 256,
    protein: 13.3,
    carbs: 19.6,
    fat: 13.8,
    fiber: 5.4
  },
  {
    name: "Zucchini Bell Pepper Salad",
    servingSize: "50g",
    calories: 48,
    protein: 1.0,
    carbs: 1.7,
    fat: 4.4,
    fiber: 0.6
  },
  {
    name: "Durum Wheat Pasta",
    servingSize: "60g",
    calories: 209,
    protein: 7.5,
    carbs: 43.1,
    fat: 0.8,
    fiber: 1.5
  },
  {
    name: "Pani Puri",
    servingSize: "197g",
    calories: 265,
    protein: 5.0,
    carbs: 36.7,
    fat: 11.0,
    fiber: 3.2
  },
  {
    name: "Rajma Tikki Burger",
    servingSize: "100g",
    calories: 250,
    protein: 8.0,
    carbs: 30.0,
    fat: 10.0,
    fiber: 5.0
  },
  {
    name: "Salted Caramel Popcorn (PVR/INOX)",
    servingSize: "95g",
    calories: 461,
    protein: 5.0,
    carbs: 80.0,
    fat: 15.0,
    fiber: 8.0
  },
  {
    name: "Omani Dates, Happilo",
    servingSize: "24g",
    calories: 68,
    protein: 0.6,
    carbs: 18.0,
    fat: 0.1,
    fiber: 1.9
  },
  {
    name: "Mango",
    servingSize: "130g",
    calories: 96,
    protein: 0.8,
    carbs: 22.0,
    fat: 0.5,
    fiber: 2.6
  },
  {
    name: "Slim n Trim Skimmed Milk, Amul",
    servingSize: "100ml",
    calories: 35,
    protein: 3.5,
    carbs: 5.0,
    fat: 0.1,
    fiber: 0.0
  },
  {
    name: "Walnut",
    servingSize: "6g",
    calories: 40,
    protein: 0.9,
    carbs: 0.6,
    fat: 3.9,
    fiber: 0.3
  },
  {
    name: "Raw Whey Protein, Unflavoured",
    servingSize: "47g",
    calories: 178,
    protein: 35.6,
    carbs: 3.5,
    fat: 2.4,
    fiber: 0.4
  },
  {
    name: "Almonds",
    servingSize: "6g",
    calories: 37,
    protein: 1.3,
    carbs: 1.3,
    fat: 3.0,
    fiber: 0.8
  },
  {
    name: "Nutty Gritties Super Seeds Mix",
    servingSize: "9g",
    calories: 64,
    protein: 2.4,
    carbs: 1.1,
    fat: 4.9,
    fiber: 1.6
  },
  {
    name: "Skyr High Protein Yogurt, Milky Mist",
    servingSize: "100g",
    calories: 100,
    protein: 12.0,
    carbs: 9.5,
    fat: 1.5,
    fiber: 0.0
  },
  {
    name: "Oats, Quaker",
    servingSize: "40g",
    calories: 163,
    protein: 4.7,
    carbs: 27.4,
    fat: 3.8,
    fiber: 4.0
  },
  {
    name: "Low Fat Paneer, Milky Mist",
    servingSize: "100g",
    calories: 204,
    protein: 25.0,
    carbs: 5.8,
    fat: 9.0,
    fiber: 0.0
  },
  {
    name: "Roti",
    servingSize: "50g",
    calories: 122,
    protein: 4.3,
    carbs: 24.8,
    fat: 0.6,
    fiber: 3.8
  },
  {
    name: "Cocoa Whey Protein, The Whole Truth",
    servingSize: "48g",
    calories: 191,
    protein: 34.1,
    carbs: 8.6,
    fat: 2.1,
    fiber: 2.1
  },
  {
    name: "Sambhar",
    servingSize: "150g",
    calories: 114,
    protein: 5.5,
    carbs: 16.2,
    fat: 3.0,
    fiber: 3.7
  },
  {
    name: "Bhindi Fry",
    servingSize: "90g",
    calories: 83,
    protein: 1.3,
    carbs: 5.5,
    fat: 6.3,
    fiber: 2.3
  },
  {
    name: "Dal",
    servingSize: "150",
    calories: 115,
    protein: 6.8,
    carbs: 17.7,
    fat: 1.9,
    fiber: 2.8
  },
  {
    name: "Dosa",
    servingSize: "120",
    calories: 221,
    protein: 5.4,
    carbs: 33.9,
    fat: 7.1,
    fiber: 1.9
  },
  {
    name: "Green Moong Dal Cheela",
    servingSize: "200g",
    calories: 363,
    protein: 19,
    carbs: 44.3,
    fat: 12.3,
    fiber: 13.6
  },
  {
    name: "100% Whole Wheat Bread, Britannia",
    servingSize: "27",
    calories: 67,
    protein: 2.2,
    carbs: 13.8,
    fat: 0.6,
    fiber: 1.1
  },
  {
    name: "Amul Cheese Slice",
    servingSize: "20",
    calories: 62,
    protein: 4.0,
    carbs: 0.3,
    fat: 5.0,
    fiber: 0.0
  },
  {
    name: "Bhaji of Pav Bhaji",
    servingSize: "150g",
    calories: 137,
    protein: 2.3,
    carbs: 16.8,
    fat: 6.9,
    fiber: 2.1
  },
  {
    name: "Protein Bar, Double Cocoa, Whole Truth",
    servingSize: "52g",
    calories: 256,
    protein: 13.3,
    carbs: 19.6,
    fat: 13.8,
    fiber: 5.4
  },
  {
    name: "Masala Chai (no sugar)",
    servingSize: "180ml",
    calories: 58,
    protein: 3.2,
    carbs: 4.1,
    fat: 3.3,
    fiber: 0.3
  },
  {
    name: "Aloo Beans",
    servingSize: "100g",
    calories: 93,
    protein: 1.9,
    carbs: 11.5,
    fat: 4.5,
    fiber: 2.7
  },
  {
    name: "Low Fat Paneer Paratha",
    servingSize: "200g",
    calories: 445,
    protein: 26.4,
    carbs: 40.4,
    fat: 20.0,
    fiber: 5.8
  },
  {
    name: "Aloo Palak",
    servingSize: "100g",
    calories: 73,
    protein: 1.8,
    carbs: 9.4,
    fat: 3.3,
    fiber: 2.1
  },
  {
    name: "Elite Gel, Unived",
    servingSize: "75.7g",
    calories: 190,
    protein: 1.0,
    carbs: 45.0,
    fat: 0.7,
    fiber: 0.0
  },
  {
    name: "Guilt Free Ice Cream, Belgian Chocolate",
    servingSize: "125ml (80g)",
    calories: 134,
    protein: 9.8,
    carbs: 10.4,
    fat: 5.8,
    fiber: 1.7
  },
  {
    name: "Dutch Chocolate Ice Cream",
    servingSize: "130ml",
    calories: 175,
    protein: 3.9,
    carbs: 19.0,
    fat: 9.2,
    fiber: 0.0
  },
  {
    name: "Pizza, Garden Veggie",
    servingSize: "2.5 Slices (267.5g)",
    calories: 434,
    protein: 24.1,
    carbs: 60.2,
    fat: 12.0,
    fiber: 9.6
  }
];

// Predefined meal presets
export interface MealPreset {
  name: string;
  foods: {
    name: string;
    quantity: number;
  }[];
  totalCalories?: number;
}

export const mealPresets: MealPreset[] = [
  {
    name: "Morning Smoothie",
    foods: [
      { name: "Oats, Quaker", quantity: 1 }, // 40g
      { name: "Omani Dates, Happilo", quantity: 1 }, // 24g
      { name: "Almonds", quantity: 1 }, // 6g
      { name: "Skyr High Protein Yogurt, Milky Mist", quantity: 1 }, // 100g
      { name: "Raw Whey Protein, Unflavoured", quantity: 1 }, // 47g
      { name: "Nutty Gritties Super Seeds Mix", quantity: 1 }, // 9g
      { name: "Slim n Trim Skimmed Milk, Amul", quantity: 1 }, // 100ml
      { name: "Walnut", quantity: 1 }, // 6g
      { name: "Mango", quantity: 1 } // 130g
    ]
  },
  {
    name: "Evening Smoothie",
    foods: [
      { name: "Cocoa Whey Protein, The Whole Truth", quantity: 1 }, // 48g
      { name: "Slim n Trim Skimmed Milk, Amul", quantity: 1 } // 100ml
    ]
  },
  {
    name: "Bread Pizza",
    foods: [
      { name: "Capsicum Tomato Onion", quantity: 1 }, // 150g - 96 Cal
      { name: "100% Whole Wheat Bread, Britannia", quantity: 4 }, // 4 slices - 266 Cal
      { name: "Knorr Pizza and Pasta Sauce", quantity: 1 }, // 50g - 41 Cal
      { name: "Amul Cheese Slice", quantity: 1 } // 4 slices - 249 Cal
    ],
    totalCalories: 652 
  },
  {
    name: "Aloo Beans Dal Roti",
    foods: [
      { name: "Roti", quantity: 1 }, // 50g 
      { name: "Aloo Beans", quantity: 1 }, // 100g
      { name: "Dal", quantity: 1 } // 150g 
    ]
  },
  {
    name: "Paneer Chilla",
    foods: [
      { name: "Green Moong Dal Cheela", quantity: 1 }, // 200g 
      { name: "Low Fat Paneer, Milky Mist", quantity: 0.5 } // 50g (100g * 0.5)
    ]
  },
  {
    name: "Bhindi Dal Roti",
    foods: [
      { name: "Bhindi Fry", quantity: 1 }, // 100g 
      { name: "Dal", quantity: 1 }, // 150g 
      { name: "Roti", quantity: 1 } // 50g
    ]
  },
  {
    name: "Matar Paneer + Dal",
    foods: [
      { name: "Mixed Vegetable Sabzi", quantity: 2 }, // 100g (50g * 2) - using as substitute for Matar Sabzi
      { name: "Low Fat Paneer, Milky Mist", quantity: 1 }, // 100g
      { name: "Roti", quantity: 1 }, // 50g
      { name: "Dal", quantity: 1 } // 200g 
    ]
  },
  {
    name: "Dosa Sambhar",
    foods: [
      { name: "Dosa", quantity: 1 }, // 120g
      { name: "Sambhar", quantity: 1 } // 200g
    ]
  }
];
