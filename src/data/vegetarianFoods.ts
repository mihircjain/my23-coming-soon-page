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
  name: "Zucchini Bell Pepper Salad",
  servingSize: "50g",
  calories: 48,
  protein: 1.0,
  carbs: 1.7,
  fat: 4.4,
  fiber: 0.6
},
{
  name: "Durum Wheat Pasta, Borges",
  servingSize: "45g",
  calories: 157,
  protein: 5.6,
  carbs: 32.4,
  fat: 0.6,
  fiber: 1.1
},
  {
  name: "Doritos Minis – Doritos",
  servingSize: "50g",
  calories: 268,
  protein: 3.5,
  carbs: 32.0,
  fat: 14.5,
  fiber: 2.0
},
    {
    name: "Farmley Prasadam Makhana",
    servingSize: "50g",
    calories: 175,
    protein: 5,
    carbs: 39,
    fat: 0.3,
    fiber: 7
  },
    {
    name: "Suji Cheela",
    servingSize: "400g",
    calories: 685,
    protein: 13.9,
    carbs: 84,
    fat: 32.7,
    fiber: 4.8
  },
  {
    name: "McVeggie, McDonalds",
    servingSize: "169g",
    calories: 426,
    protein: 9,
    carbs: 56,
    fat: 18,
    fiber: 5
  },
  {
    name: "Paneer Biryani",
    servingSize: "248g",
    calories: 361,
    protein: 11.1,
    carbs: 33.9,
    fat: 20.0,
    fiber: 2.0
  },
  {
    name: "Ghee Masala Dosa",
    servingSize: "211.5g",
    calories: 371,
    protein: 6.6,
    carbs: 44.4,
    fat: 18.7,
    fiber: 3.7
  },
  {
  name: "Cottage Cheese Toast",
  servingSize: "64g",
  calories: 119,
  protein: 7.0,
  carbs: 18.8,
  fat: 1.9,
  fiber: 0.8
},
{
  name: "Neer Dosa (3 pcs)",
  servingSize: "210g",
  calories: 236,
  protein: 4.3,
  carbs: 43.9,
  fat: 4.8,
  fiber: 0.7
},
  {
  name: "Cottage Cheese Bao",
  servingSize: "150g",
  calories: 286,
  protein: 16.3,
  carbs: 18.2,
  fat: 16.6,
  fiber: 1.4
},
  {
  name: "Pad Thai",
  servingSize: "200g",
  calories: 269,
  protein: 10,
  carbs: 31.1,
  fat: 11.8,
  fiber: 2.4
},
  {
  name: "Donut",
  servingSize: "60g",
  calories: 219,
  protein: 3.4,
  carbs: 26.8,
  fat: 10.9,
  fiber: 0.8
},
  {
  name: "Cheese Protein Wafer, SuperYou",
  servingSize: "40g",
  calories: 186,
  protein: 10.0,
  carbs: 20.4,
  fat: 10.4,
  fiber: 3.0
},
{
  name: "Multigrain Chips, Super Masala, SuperYou",
  servingSize: "40g",
  calories: 167,
  protein: 10.0,
  carbs: 25.8,
  fat: 2.6,
  fiber: 3.0
},
{
  name: "Blueberries",
  servingSize: "100g",
  calories: 57,
  protein: 0.7,
  carbs: 14.5,
  fat: 0.3,
  fiber: 2.4
},
{
  name: "Pancake (2.5 medium)",
  servingSize: "100g",
  calories: 208,
  protein: 5.0,
  carbs: 28.5,
  fat: 8.2,
  fiber: 0.8
},
{
  name: "Kal Dosai (2 pcs)",
  servingSize: "200g",
  calories: 367,
  protein: 9.4,
  carbs: 58.2,
  fat: 10.7,
  fiber: 3.3
},
{
  name: "Coconut Chutney",
  servingSize: "50g",
  calories: 102,
  protein: 1.1,
  carbs: 2.9,
  fat: 9.6,
  fiber: 2.6
},
{
  name: "Acai Berry Smoothie",
  servingSize: "250ml",
  calories: 206,
  protein: 4.6,
  carbs: 25.9,
  fat: 10.2,
  fiber: 8.5
}
,
  {
    name: "Mushroom Burrito",
    servingSize: "300g",
    calories: 327,
    protein: 10.9,
    carbs: 48.2,
    fat: 11.4,
    fiber: 11.1
  },
  {
    name: "Palak Paneer Paratha",
    servingSize: "200g",
    calories: 499,
    protein: 19.1,
    carbs: 44.8,
    fat: 27.1,
    fiber: 8.1
  }
,
  {
  name: "Sevaiya",  // You can replace this with the actual food name
  servingSize: "100g",
  calories: 108,
  protein: 2.8,
  carbs: 19.4,
  fat: 2.2,
  fiber: 3.3
},
  {
    name: "Paddu (6 pieces)",
    servingSize: "120g",
    calories: 191,
    protein: 5,
    carbs: 24.4,
    fat: 8.1,
    fiber: 2.6
  },
{
  name: "Tiramisu Ice Cream",
  servingSize: "100g",
  calories: 230,
  protein: 4.4,
  carbs: 28.3,
  fat: 4.4,
  fiber: 0.0
},
{
  name: "Beetroot Hummus Toast",
  servingSize: "126g",
  calories: 216,
  protein: 5.3,
  carbs: 26.0,
  fat: 9.1,
  fiber: 6.1
},
{
  name: "Mango Peach Smoothie",
  servingSize: "125ml",
  calories: 106,
  protein: 2.3,
  carbs: 24.2,
  fat: 0.2,
  fiber: 1.3
},
  {
  name: "Lotus Biscoff Cheesecake",
  servingSize: 50,
  calories: 198,
  protein: 2,
  fat : 15.3,
  carbs: 13.7,
  fiber: 0.1
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
    "name": "Ultra Beer, Kingfisher",
    "servingSize": "330ml",
    "calories": 92,
    "protein": 0.0,
    "carbs": 7.9,
    "fat": 0.0,
    "fiber": 0.0
  },
  {
    "name": "Avocado Toast",
    "servingSize": "90g",
    "calories": 187,
    "protein": 4.9,
    "carbs": 18.6,
    "fat": 10.1,
    "fiber": 4.2
  },
  {
    "name": "Burmese Fried Rice",
    "servingSize": "150g",
    "calories": 155,
    "protein": 4.2,
    "carbs": 27.1,
    "fat": 3.4,
    "fiber": 1.0
  },
  {
    "name": "Cocktail",
    "servingSize": "480g",
    "calories": 480,
    "protein": 0.0,
    "carbs": 48.0,
    "fat": 0.0,
    "fiber": 0.0
  },
  {
    "name": "Idli (Regular)",
    "servingSize": "50g",
    "calories": 73,
    "protein": 2.2,
    "carbs": 15.2,
    "fat": 0.3,
    "fiber": 1.3
  },
  {
  name: "Aloo Matar",
  servingSize: "100g",
  calories: 74,
  protein: 2.1,
  carbs: 9.1,
  fat: 3.4,
  fiber: 2.6
},
  {
    "name": "Mocha",
    "servingSize": "250ml",
    "calories": 202,
    "protein": 9.3,
    "carbs": 20.7,
    "fat": 10.4,
    "fiber": 1.7
  },
  {
    "name": "Bhel",
    "servingSize": "100g",
    "calories": 222,
    "protein": 5.5,
    "carbs": 29.0,
    "fat": 9.6,
    "fiber": 3.1
  },
  {
    "name": "Wada",
    "servingSize": "60g",
    "calories": 154,
    "protein": 5.8,
    "carbs": 14.3,
    "fat": 8.2,
    "fiber": 2.9
  },
  {
    "name": "Parmesan Garlic Popcorn, Smartfood",
    "servingSize": "48g",
    "calories": 257,
    "protein": 3.4,
    "carbs": 24.0,
    "fat": 17.1,
    "fiber": 3.4
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
    servingSize: "9g",
    calories: 60,
    protein: 1.3,
    carbs: 0.9,
    fat: 5.8,
    fiber: 0.5
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
    servingSize: "9g",
    calories: 56,
    protein: 1.9,
    carbs: 1.9,
    fat: 4.5,
    fiber: 1.1
  },
  {
    name: "Nutty Gritties Super Seeds Mix",
    servingSize: "15g",
    calories: 107,
    protein: 4,
    carbs: 1.9,
    fat: 8.2,
    fiber: 2.7
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
    name: "Normal Paneer",
    servingSize: "100g",
    calories: 265,
    protein: 18.3,
    carbs: 1.2,
    fat: 20.8,
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
    servingSize: "300g",
    calories: 228,
    protein: 11,
    carbs: 32.4,
    fat: 6.0,
    fiber: 7.4
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
    name: "Suji Cheela",
    servingSize: "150g",
    calories: 257,
    protein: 5.2,
    carbs: 31.5,
    fat: 12.3,
    fiber: 1.8
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
    name: "Garlic Bread",
    servingSize: "40g",
    calories: 126,
    protein: 2.4,
    carbs: 13.1,
    fat: 7.2,
    fiber: 0.6
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
    name: "White Rice",
    servingSize: "100g",
    calories: 97,
    protein: 2.1,
    carbs: 21.5,
    fat: 0.3,
    fiber: 0.4
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
    name: "Tequila",
    servingSize: "250 ml",
    calories: 578,
    protein: 0.0,
    carbs: 0.0,
    fat: 0.0,
    fiber: 0.0
  },
  {
    name: "Spaghetti Aglio e Olio",
    servingSize: "100 g",
    calories: 228,
    protein: 7.4,
    carbs: 25.4,
    fat: 10.5,
    fiber: 1.2
  },
  {
    name: "Tandoori Roti",
    servingSize: "1 Roti (50 g)",
    calories: 150,
    protein: 4.1,
    carbs: 24.8,
    fat: 3.9,
    fiber: 2.9
  },
  {
    name: "Sabudana Khichdi",
    servingSize: "178 g",
    calories: 287,
    protein: 4.3,
    carbs: 49.4,
    fat: 8.1,
    fiber: 2.7
  },
  {
    name: "Malai Soya Chaap Tikka",
    servingSize: "138 g",
    calories: 287,
    protein: 24.4,
    carbs: 16.5,
    fat: 13.8,
    fiber: 8.3
  },
  {
    name: "Ragda Pattice",
    servingSize: "0.5 Serve (130 g)",
    calories: 163,
    protein: 3.4,
    carbs: 21.2,
    fat: 7.3,
    fiber: 3.3
  },
  {
    name: "Dal Makhani",
    servingSize: "125 g",
    calories: 137,
    protein: 5.1,
    carbs: 13.7,
    fat: 6.9,
    fiber: 4.9
  },
  {
    name: "Shahi Tukda",
    servingSize: "1 Tukda (80 g)",
    calories: 182,
    protein: 5.4,
    carbs: 22.5,
    fat: 8.2,
    fiber: 0.8
  },
  {
    name: "Jager Bomb Shot",
    servingSize: "88.5 ml",
    calories: 173,
    protein: 0.0,
    carbs: 21.2,
    fat: 0.0,
    fiber: 0.0
  },
  {
    name: "Paneer Tikka",
    servingSize: "2 Tikka (54 g)",
    calories: 149,
    protein: 8.5,
    carbs: 1.4,
    fat: 12.1,
    fiber: 0.2
  },
    {
    name: "Homemade Falafal Wrap",
    servingSize: "1 Wrap",
    calories: 322.5,
    protein: 17.5,
    carbs: 55.5,
    fat: 4,
    fiber: 11
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
  name: "Paneer Pasta",
  foods: [
    { name: "Zucchini Bell Pepper Salad", quantity: 1 }, // 50g
    { name: "Durum Wheat Pasta, Borges", quantity: 1 },  // 45g
    { name: "High Protein Low Fat Paneer, Milky Mist", quantity: 1 } // 100g
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
      { name: "Sambhar", quantity: 1 } // 300g
    ]
  }
];
