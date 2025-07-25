import { useState } from "react";
import { ArrowLeft, Activity, Info, Scale, Heart, Dumbbell, Flame, Apple, Droplet } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col">
      {/* Background decoration - Updated with green/blue theme */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-blue-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-green-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-blue-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header - Updated with green/blue theme */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <Button 
          onClick={() => navigate('/')} 
          variant="ghost" 
          className="mb-6 hover:bg-white/20"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
            🩺 Mihir's Body Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Track your key health metrics and body composition
          </p>
          <p className="mt-2 text-md font-medium text-green-600">
            📅 Latest: June 15, 2025 | Previous: April 7, 2025
          </p>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        <Tabs defaultValue="blood" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 bg-green-100 border border-green-200 h-auto">
            <TabsTrigger value="blood" className="data-[state=active]:bg-green-200 text-xs sm:text-sm py-2 px-1 sm:px-3">
              <span className="hidden sm:inline">Blood Markers</span>
              <span className="sm:hidden">Blood</span>
            </TabsTrigger>
            <TabsTrigger value="composition" className="data-[state=active]:bg-green-200 text-xs sm:text-sm py-2 px-1 sm:px-3">
              <span className="hidden sm:inline">Body Composition</span>
              <span className="sm:hidden">Body</span>
            </TabsTrigger>
            <TabsTrigger value="macros" className="data-[state=active]:bg-green-200 text-xs sm:text-sm py-2 px-1 sm:px-3">
              <span className="hidden sm:inline">Maintenance Macros</span>
              <span className="sm:hidden">Macros</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Blood Markers Tab */}
          <TabsContent value="blood">
            {loading ? (
              // Loading skeletons
              <div className="mobile-grid-2 gap-4 sm:gap-6">
                {Array(8).fill(0).map((_, i) => (
                  <Card key={i} className="bg-white/80 backdrop-blur-sm border border-green-200 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                        <Skeleton className="h-4 w-4 mr-2 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              // Categorized blood markers
              <div className="space-y-10">
                {markerCategories.map(category => (
                  <div key={category.id} className="space-y-4">
                    {/* Category Header */}
                    <div className="flex items-center space-x-2 border-b border-green-200 pb-2">
                      {category.icon}
                      <h2 className="text-xl font-semibold text-gray-800">{category.name}</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{category.description}</p>
                    
                    {/* Category Markers */}
                    <div className="mobile-grid-2 gap-4 sm:gap-6">
                      {category.markers.map((marker) => (
                        <TooltipProvider key={marker.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Card className="bg-white/80 backdrop-blur-sm border border-green-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-green-300">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-medium text-gray-500 flex items-center justify-between">
                                    <span className="flex items-center">
                                      <Activity className="mr-2 h-4 w-4 text-green-500" />
                                      {marker.name}
                                    </span>
                                    <Info className={`h-4 w-4 ${getStatusColor(marker.status)}`} />
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-1">
                                    <div className={`text-2xl font-bold ${getStatusColor(marker.status)}`}>
                                      {formatValue(marker.value, marker.unit)}
                                    </div>
                                    {marker.previousValue && (
                                      <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-500">
                                          Was: {formatValue(marker.previousValue, marker.unit)}
                                        </span>
                                        {typeof marker.value === 'number' && typeof marker.previousValue === 'number' && (
                                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                            marker.value > marker.previousValue 
                                              ? 'bg-green-100 text-green-700' 
                                              : marker.value < marker.previousValue
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-gray-100 text-gray-700'
                                          }`}>
                                            {marker.value > marker.previousValue ? '↗' : marker.value < marker.previousValue ? '↘' : '→'}
                                            {Math.abs(((marker.value - marker.previousValue) / marker.previousValue * 100)).toFixed(1)}%
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs p-4">
                              <div className="space-y-2">
                                <h4 className="font-semibold">{marker.name}</h4>
                                <p className="text-sm text-gray-500">{marker.explanation}</p>
                                <div className="text-xs">
                                  <span className="font-medium">Normal Range:</span> {marker.normalRange}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Body Composition Tab */}
          <TabsContent value="composition">
            <div className="mobile-grid-2 gap-4 sm:gap-6">
              {bodyComposition.map((item) => (
                <TooltipProvider key={item.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="bg-white/80 backdrop-blur-sm border border-green-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-green-300">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-gray-500 flex items-center justify-between">
                            <span className="flex items-center">
                              {item.icon}
                              <span className="ml-2">{item.name}</span>
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-gray-800">
                              {formatValue(item.value, item.unit)}
                            </div>
                            {item.previousValue && (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-500">
                                  Was: {formatValue(item.previousValue, item.unit)}
                                </span>
                                {typeof item.value === 'number' && typeof item.previousValue === 'number' && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    // Determine if the change is good based on the metric
                                    (['body_fat', 'fat_mass', 'visceral_fat_mass', 'visceral_fat_volume', 'android_gynoid_ratio'].includes(item.id) && item.value < item.previousValue) ||
                                    (['lean_mass'].includes(item.id) && item.value > item.previousValue)
                                      ? 'bg-green-100 text-green-700' 
                                      : (['body_fat', 'fat_mass', 'visceral_fat_mass', 'visceral_fat_volume', 'android_gynoid_ratio'].includes(item.id) && item.value > item.previousValue) ||
                                        (['lean_mass'].includes(item.id) && item.value < item.previousValue)
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {item.value > item.previousValue ? '↗' : item.value < item.previousValue ? '↘' : '→'}
                                    {Math.abs(((item.value - item.previousValue) / item.previousValue * 100)).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs p-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold">{item.name}</h4>
                        <p className="text-sm text-gray-500">{item.explanation}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </TabsContent>
          
          {/* Maintenance Macros Tab */}
          <TabsContent value="macros">
            <div className="mobile-grid-1 gap-4 sm:gap-6">
              {macros.map((item) => (
                <TooltipProvider key={item.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="bg-white/80 backdrop-blur-sm border border-green-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-green-300">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-gray-500 flex items-center justify-between">
                            <span className="flex items-center">
                              {item.icon}
                              <span className="ml-2">{item.name}</span>
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-gray-800">
                              {formatValue(item.value, item.unit)}
                            </div>
                            {item.previousValue && (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-500">
                                  Was: {formatValue(item.previousValue, item.unit)}
                                </span>
                                {typeof item.value === 'number' && typeof item.previousValue === 'number' && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    item.value > item.previousValue 
                                      ? 'bg-blue-100 text-blue-700' 
                                      : item.value < item.previousValue
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {item.value > item.previousValue ? '↗' : item.value < item.previousValue ? '↘' : '→'}
                                    {Math.abs(((item.value - item.previousValue) / item.previousValue * 100)).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs p-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold">{item.name}</h4>
                        <p className="text-sm text-gray-500">{item.explanation}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Footer - Updated with green/blue theme */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>Data from your latest health assessment</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4 text-teal-500" />
              18 Blood markers
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Scale className="h-4 w-4 text-green-500" />
              11 Body metrics
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Latest Update: June 15, 2025 | Compared to: April 7, 2025</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs">Progress tracking</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BodyJam;
