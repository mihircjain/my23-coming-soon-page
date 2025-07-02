import { useState } from "react";
import { ArrowLeft, Activity, Info, Scale, Heart, Dumbbell, Flame, Apple, Droplet, Target, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define types for our blood markers
interface BloodMarker {
  id: string;
  name: string;
  value: number | string;
  previousValue?: number | string;
  unit: string;
  normalRange: string;
  explanation: string;
  status: 'good' | 'low' | 'high' | 'unknown';
  category: 'heart' | 'kidney' | 'metabolic' | 'vitamins' | 'electrolytes' | 'blood';
}

// Define types for body composition data
interface BodyComposition {
  id: string;
  name: string;
  value: number | string;
  previousValue?: number | string;
  unit: string;
  explanation: string;
  icon: React.ReactNode;
}

// Define types for macros
interface Macro {
  id: string;
  name: string;
  value: number | string;
  previousValue?: number | string;
  unit: string;
  explanation: string;
  icon: React.ReactNode;
}

// Define category type for grouping
interface MarkerCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  markers: BloodMarker[];
}

const BodyJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Blood marker data with comparison values from April and June reports
  const [bloodMarkers, setBloodMarkers] = useState<BloodMarker[]>([
    {
      id: "rbc",
      name: "RBC",
      value: 5.99,
      previousValue: 5.80,
      unit: "mill/mm³",
      normalRange: "4.5-5.9 million cells/mcL (men); 4.1-5.1 (women)",
      explanation: "Carries oxygen from lungs to tissues and carbon dioxide back to lungs",
      status: "good",
      category: "blood"
    },
    {
      id: "hemoglobin",
      name: "Hemoglobin",
      value: 16.8,
      previousValue: 16.3,
      unit: "g/dL",
      normalRange: "13.5-17.5 g/dL (men); 12.0-15.5 (women)",
      explanation: "Protein in red blood cells that carries oxygen",
      status: "good",
      category: "blood"
    },
    {
      id: "wbc",
      name: "WBC",
      value: 5600,
      previousValue: 5560,
      unit: "cells/mm³",
      normalRange: "4,500-11,000 cells/mcL",
      explanation: "Part of immune system, helps fight infections",
      status: "good",
      category: "blood"
    },
    {
      id: "platelets",
      name: "Platelet Count",
      value: 281,
      previousValue: 309,
      unit: "10³/µL",
      normalRange: "150,000-450,000 platelets/mcL",
      explanation: "Helps blood clot, prevents excessive bleeding",
      status: "good",
      category: "blood"
    },
    {
      id: "hdl",
      name: "HDL Cholesterol",
      value: 52,
      previousValue: 38,
      unit: "mg/dL",
      normalRange: "40 mg/dL or higher (men); 50 or higher (women)",
      explanation: "'Good' cholesterol that helps remove other forms of cholesterol",
      status: "good",
      category: "heart"
    },
    {
      id: "ldl",
      name: "LDL Cholesterol",
      value: 87,
      previousValue: 96,
      unit: "mg/dL",
      normalRange: "Less than 100 mg/dL",
      explanation: "'Bad' cholesterol that can build up in arteries",
      status: "good",
      category: "heart"
    },
    {
      id: "total_cholesterol",
      name: "Total Cholesterol",
      value: 149,
      previousValue: 144,
      unit: "mg/dL",
      normalRange: "Less than 200 mg/dL",
      explanation: "Fatty substance in blood, needed for cell building",
      status: "good",
      category: "heart"
    },
    {
      id: "triglycerides",
      name: "Triglycerides",
      value: 51,
      previousValue: 50,
      unit: "mg/dL",
      normalRange: "Less than 150 mg/dL",
      explanation: "Type of fat in blood that stores excess energy",
      status: "good",
      category: "heart"
    },
    {
      id: "vitamin_b12",
      name: "Vitamin B12",
      value: 450,
      previousValue: 405,
      unit: "pg/mL",
      normalRange: "200-900 pg/mL",
      explanation: "Helps make DNA and red blood cells, supports nerve function",
      status: "good",
      category: "vitamins"
    },
    {
      id: "vitamin_d",
      name: "Vitamin D",
      value: 55.4,
      previousValue: 48.2,
      unit: "ng/mL",
      normalRange: "20-50 ng/mL",
      explanation: "Helps body absorb calcium, important for bone health",
      status: "good",
      category: "vitamins"
    },
    {
      id: "hba1c",
      name: "HbA1C",
      value: 5.4,
      previousValue: 5.1,
      unit: "%",
      normalRange: "Below 5.7%",
      explanation: "Average blood glucose levels over the past 2-3 months",
      status: "good",
      category: "metabolic"
    },
    {
      id: "glucose",
      name: "Glucose (Random)",
      value: 84,
      previousValue: 89,
      unit: "mg/dL",
      normalRange: "70-140 mg/dL (random); 70-99 mg/dL (fasting)",
      explanation: "Blood sugar level",
      status: "good",
      category: "metabolic"
    },
    {
      id: "tsh",
      name: "TSH",
      value: 2.530,
      previousValue: 2.504,
      unit: "µIU/mL",
      normalRange: "0.4-4.0 µIU/mL",
      explanation: "Thyroid stimulating hormone, controls thyroid gland function",
      status: "good",
      category: "metabolic"
    },
    {
      id: "creatinine",
      name: "Creatinine",
      value: 0.6,
      previousValue: 0.7,
      unit: "mg/dL",
      normalRange: "0.7-1.3 mg/dL (men); 0.6-1.1 mg/dL (women)",
      explanation: "Waste product filtered by kidneys, indicator of kidney function",
      status: "good",
      category: "kidney"
    },
    {
      id: "uric_acid",
      name: "Uric Acid",
      value: 3.6,
      previousValue: 4.4,
      unit: "mg/dL",
      normalRange: "3.5-7.2 mg/dL (men); 2.5-6.0 mg/dL (women)",
      explanation: "Waste product from breakdown of purines in food",
      status: "good",
      category: "kidney"
    },
    {
      id: "calcium",
      name: "Calcium",
      value: 9.7,
      previousValue: 9.3,
      unit: "mg/dL",
      normalRange: "8.5-10.5 mg/dL",
      explanation: "Essential for bone health, muscle function, and nerve signaling",
      status: "good",
      category: "electrolytes"
    },
    {
      id: "sodium",
      name: "Sodium",
      value: 136,
      previousValue: 134,
      unit: "mmol/L",
      normalRange: "135-145 mmol/L",
      explanation: "Electrolyte that helps maintain fluid balance and nerve/muscle function",
      status: "good",
      category: "electrolytes"
    },
    {
      id: "potassium",
      name: "Potassium",
      value: 5.4,
      previousValue: 4.8,
      unit: "mmol/L",
      normalRange: "3.5-5.0 mmol/L",
      explanation: "Electrolyte essential for heart, muscle, and nerve function",
      status: "good",
      category: "electrolytes"
    }
  ]);

  // Body composition data from DEXA scan - Updated with comparison values
  const [bodyComposition, setBodyComposition] = useState<BodyComposition[]>([
    {
      id: "weight",
      name: "Weight",
      value: 68.2,
      previousValue: 72.9,
      unit: "kg",
      explanation: "Total body weight",
      icon: <Scale className="h-4 w-4 text-green-500" />
    },
    {
      id: "height",
      name: "Height",
      value: 170,
      previousValue: 170,
      unit: "cm",
      explanation: "Standing height",
      icon: <Activity className="h-4 w-4 text-green-500" />
    },
    {
      id: "age",
      name: "Age",
      value: 28.1,
      previousValue: 27.8,
      unit: "years",
      explanation: "Chronological age",
      icon: <Activity className="h-4 w-4 text-green-500" />
    },
    {
      id: "body_fat",
      name: "Body Fat",
      value: 21.2,
      previousValue: 25.7,
      unit: "%",
      explanation: "Percentage of total body mass that is fat",
      icon: <Heart className="h-4 w-4 text-teal-500" />
    },
    {
      id: "fat_mass",
      name: "Fat Mass",
      value: 14.5,
      previousValue: 18.7,
      unit: "kg",
      explanation: "Total mass of body fat",
      icon: <Heart className="h-4 w-4 text-teal-500" />
    },
    {
      id: "lean_mass",
      name: "Lean Mass",
      value: 50.7,
      previousValue: 51.1,
      unit: "kg",
      explanation: "Total mass of non-fat tissue including muscle, organs, and water",
      icon: <Dumbbell className="h-4 w-4 text-emerald-500" />
    },
    {
      id: "bone_mass",
      name: "Bone Mass",
      value: 3.0,
      previousValue: 3.1,
      unit: "kg",
      explanation: "Total mass of bone mineral content",
      icon: <Activity className="h-4 w-4 text-blue-500" />
    },
    {
      id: "visceral_fat_mass",
      name: "Visceral Fat Mass",
      value: 349,
      previousValue: 580,
      unit: "g",
      explanation: "Mass of fat surrounding internal organs",
      icon: <Heart className="h-4 w-4 text-cyan-500" />
    },
    {
      id: "visceral_fat_volume",
      name: "Visceral Fat Volume",
      value: 370,
      previousValue: 615,
      unit: "cm³",
      explanation: "Volume of fat surrounding internal organs",
      icon: <Heart className="h-4 w-4 text-cyan-500" />
    },
    {
      id: "android_gynoid_ratio",
      name: "Android-Gynoid Ratio",
      value: 1.18,
      previousValue: 1.31,
      unit: "",
      explanation: "Ratio of android (abdominal) fat to gynoid (hip/thigh) fat",
      icon: <Activity className="h-4 w-4 text-green-500" />
    },
    {
      id: "rmr",
      name: "RMR",
      value: 1472,
      previousValue: 1479,
      unit: "kcal/day",
      explanation: "Resting Metabolic Rate - calories burned at rest",
      icon: <Flame className="h-4 w-4 text-green-500" />
    }
  ]);

  // Maintenance macros - Updated with comparison values
  const [macros, setMacros] = useState<Macro[]>([
    {
      id: "protein",
      name: "Protein",
      value: 90,
      previousValue: 96,
      unit: "g",
      explanation: "Daily protein intake for maintenance",
      icon: <Dumbbell className="h-4 w-4 text-green-500" />
    },
    {
      id: "carbs",
      name: "Carbs",
      value: 171,
      previousValue: 166,
      unit: "g",
      explanation: "Daily carbohydrate intake for maintenance",
      icon: <Apple className="h-4 w-4 text-teal-500" />
    },
    {
      id: "fat",
      name: "Fat",
      value: 47,
      previousValue: 47,
      unit: "g",
      explanation: "Daily fat intake for maintenance",
      icon: <Activity className="h-4 w-4 text-cyan-500" />
    }
  ]);

  // Group blood markers by category - Updated with green/blue theme colors
  const markerCategories: MarkerCategory[] = [
    {
      id: "heart",
      name: "Heart",
      icon: <Heart className="h-5 w-5 text-teal-500" />,
      description: "Cardiovascular health markers including cholesterol and triglycerides",
      markers: bloodMarkers.filter(marker => marker.category === "heart")
    },
    {
      id: "kidney",
      name: "Kidney",
      icon: <Activity className="h-5 w-5 text-green-500" />,
      description: "Kidney function markers including creatinine and uric acid",
      markers: bloodMarkers.filter(marker => marker.category === "kidney")
    },
    {
      id: "metabolic",
      name: "Metabolic",
      icon: <Activity className="h-5 w-5 text-emerald-500" />,
      description: "Metabolic health markers including glucose and thyroid function",
      markers: bloodMarkers.filter(marker => marker.category === "metabolic")
    },
    {
      id: "blood",
      name: "Blood",
      icon: <Droplet className="h-5 w-5 text-teal-500" />,
      description: "Blood cell counts and related markers",
      markers: bloodMarkers.filter(marker => marker.category === "blood")
    },
    {
      id: "vitamins",
      name: "Vitamins",
      icon: <Apple className="h-5 w-5 text-green-500" />,
      description: "Vitamin levels and nutritional markers",
      markers: bloodMarkers.filter(marker => marker.category === "vitamins")
    },
    {
      id: "electrolytes",
      name: "Electrolytes",
      icon: <Flame className="h-5 w-5 text-green-500" />,
      description: "Electrolyte balance markers including sodium and potassium",
      markers: bloodMarkers.filter(marker => marker.category === "electrolytes")
    }
  ];

  // Get status color based on marker status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-green-500';
      case 'low':
        return 'text-cyan-500';
      case 'high':
        return 'text-teal-500';
      default:
        return 'text-gray-500';
    }
  };

  // Format value for display with comparison
  const formatValue = (value: number | string, unit: string) => {
    if (value === null) return '—';
    
    // Format large numbers with commas
    if (typeof value === 'number' && value >= 1000) {
      return value.toLocaleString() + ' ' + unit;
    }
    
    return value + (unit ? ' ' + unit : '');
  };

  // Calculate change percentage
  const getChangeIndicator = (current: number | string, previous?: number | string) => {
    if (!previous || typeof current !== 'number' || typeof previous !== 'number') return null;
    
    const change = ((current - previous) / previous * 100);
    const isPositive = change > 0;
    const isImprovement = 
      // For these metrics, lower is better
      current < previous && ['body_fat', 'fat_mass', 'visceral_fat_mass', 'visceral_fat_volume', 'android_gynoid_ratio', 'ldl', 'total_cholesterol', 'triglycerides', 'hba1c', 'glucose'].includes('current') ||
      // For these metrics, higher is better
      current > previous && ['hdl', 'vitamin_b12', 'vitamin_d', 'lean_mass'].includes('current');
    
    return {
      percentage: Math.abs(change).toFixed(1),
      isPositive,
      isImprovement
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50">
      {/* Header */}
      <div className="mobile-container">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-6 pb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
              ❤️ Body Jam
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Monitor your health metrics and biomarkers
            </p>
          </div>
          <Button 
            onClick={() => window.location.href = '/'} 
            variant="outline"
            className="mobile-button"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Back to</span> Home
          </Button>
        </div>
      </div>

      <div className="mobile-container mobile-section">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-8 bg-green-100 border border-green-200">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="blood-markers" className="text-xs sm:text-sm">Blood Markers</TabsTrigger>
            <TabsTrigger value="vitals" className="text-xs sm:text-sm">Vitals</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            {/* Quick Health Stats */}
            <div className="mobile-grid-4 gap-6">
              <Card className="bg-gradient-to-r from-red-100 to-red-200 border-red-300">
                <CardContent className="mobile-card text-center">
                  <Heart className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <div className="text-xl sm:text-2xl font-bold text-red-600 mb-1">--</div>
                  <div className="text-xs sm:text-sm text-red-700">Heart Rate</div>
                  <div className="text-xs text-gray-600">bpm</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-100 to-blue-200 border-blue-300">
                <CardContent className="mobile-card text-center">
                  <Activity className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-xl sm:text-2xl font-bold text-blue-600 mb-1">--</div>
                  <div className="text-xs sm:text-sm text-blue-700">Blood Pressure</div>
                  <div className="text-xs text-gray-600">mmHg</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-green-100 to-green-200 border-green-300">
                <CardContent className="mobile-card text-center">
                  <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-xl sm:text-2xl font-bold text-green-600 mb-1">--</div>
                  <div className="text-xs sm:text-sm text-green-700">Weight</div>
                  <div className="text-xs text-gray-600">kg</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-100 to-purple-200 border-purple-300">
                <CardContent className="mobile-card text-center">
                  <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-xl sm:text-2xl font-bold text-purple-600 mb-1">--</div>
                  <div className="text-xs sm:text-sm text-purple-700">Body Fat</div>
                  <div className="text-xs text-gray-600">%</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="blood-markers" className="space-y-6">
            {/* Blood Markers Grid */}
            <div className="mobile-grid-4 gap-6">
              <Card className="bg-gradient-to-r from-orange-100 to-orange-200 border-orange-300">
                <CardContent className="mobile-card text-center">
                                     <Droplet className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                  <div className="text-xl sm:text-2xl font-bold text-orange-600 mb-1">--</div>
                  <div className="text-xs sm:text-sm text-orange-700">Cholesterol</div>
                  <div className="text-xs text-gray-600">mg/dL</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-pink-100 to-pink-200 border-pink-300">
                <CardContent className="mobile-card text-center">
                  <Heart className="h-8 w-8 text-pink-600 mx-auto mb-2" />
                  <div className="text-xl sm:text-2xl font-bold text-pink-600 mb-1">--</div>
                  <div className="text-xs sm:text-sm text-pink-700">Glucose</div>
                  <div className="text-xs text-gray-600">mg/dL</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-teal-100 to-teal-200 border-teal-300">
                <CardContent className="mobile-card text-center">
                  <Activity className="h-8 w-8 text-teal-600 mx-auto mb-2" />
                  <div className="text-xl sm:text-2xl font-bold text-teal-600 mb-1">--</div>
                  <div className="text-xs sm:text-sm text-teal-700">HbA1c</div>
                  <div className="text-xs text-gray-600">%</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-indigo-100 to-indigo-200 border-indigo-300">
                <CardContent className="mobile-card text-center">
                  <Zap className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
                  <div className="text-xl sm:text-2xl font-bold text-indigo-600 mb-1">--</div>
                  <div className="text-xs sm:text-sm text-indigo-700">Vitamin D</div>
                  <div className="text-xs text-gray-600">ng/mL</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="vitals" className="space-y-6">
            {/* Vitals Grid */}
            <div className="mobile-grid-3 gap-6">
              <Card className="bg-gradient-to-r from-cyan-100 to-cyan-200 border-cyan-300">
                <CardContent className="mobile-card text-center">
                  <Activity className="h-8 w-8 text-cyan-600 mx-auto mb-2" />
                  <div className="text-xl sm:text-2xl font-bold text-cyan-600 mb-1">--</div>
                  <div className="text-xs sm:text-sm text-cyan-700">Resting HR</div>
                  <div className="text-xs text-gray-600">bpm</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-emerald-100 to-emerald-200 border-emerald-300">
                <CardContent className="mobile-card text-center">
                  <Heart className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                  <div className="text-xl sm:text-2xl font-bold text-emerald-600 mb-1">--</div>
                  <div className="text-xs sm:text-sm text-emerald-700">HRV</div>
                  <div className="text-xs text-gray-600">ms</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-yellow-100 to-yellow-200 border-yellow-300">
                <CardContent className="mobile-card text-center">
                  <TrendingUp className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <div className="text-xl sm:text-2xl font-bold text-yellow-600 mb-1">--</div>
                  <div className="text-xs sm:text-sm text-yellow-700">Temperature</div>
                  <div className="text-xs text-gray-600">°C</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Connect Devices */}
        <Card className="mt-8 bg-white/60 backdrop-blur-sm border border-white/30">
          <CardContent className="mobile-card text-center">
            <div className="text-4xl mb-4">🔗</div>
            <h3 className="mobile-subheading mb-2">Connect Your Health Devices</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              Sync with Apple Health, Google Fit, or other health monitoring devices
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button className="mobile-button bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white">
                Connect Apple Health
              </Button>
              <Button variant="outline" className="mobile-button">
                Other Devices
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BodyJam;
