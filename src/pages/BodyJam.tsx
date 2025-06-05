import { useState } from "react";
import { ArrowLeft, Activity, Info, Scale, Heart, Dumbbell, Flame, Apple, Kidney, Droplet } from "lucide-react";
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
  unit: string;
  explanation: string;
  icon: React.ReactNode;
}

// Define types for macros
interface Macro {
  id: string;
  name: string;
  value: number | string;
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
  
  // Blood marker data with actual values from blood report
  const [bloodMarkers, setBloodMarkers] = useState<BloodMarker[]>([
    {
      id: "rbc",
      name: "RBC",
      value: 5.80,
      unit: "mill/mm³",
      normalRange: "4.5-5.9 million cells/mcL (men); 4.1-5.1 (women)",
      explanation: "Carries oxygen from lungs to tissues and carbon dioxide back to lungs",
      status: "good",
      category: "blood"
    },
    {
      id: "hemoglobin",
      name: "Hemoglobin",
      value: 16.3,
      unit: "g/dL",
      normalRange: "13.5-17.5 g/dL (men); 12.0-15.5 (women)",
      explanation: "Protein in red blood cells that carries oxygen",
      status: "good",
      category: "blood"
    },
    {
      id: "wbc",
      name: "WBC",
      value: 5560,
      unit: "cells/mm³",
      normalRange: "4,500-11,000 cells/mcL",
      explanation: "Part of immune system, helps fight infections",
      status: "good",
      category: "blood"
    },
    {
      id: "platelets",
      name: "Platelet Count",
      value: 309,
      unit: "10³/µL",
      normalRange: "150,000-450,000 platelets/mcL",
      explanation: "Helps blood clot, prevents excessive bleeding",
      status: "good",
      category: "blood"
    },
    {
      id: "hdl",
      name: "HDL Cholesterol",
      value: 38,
      unit: "mg/dL",
      normalRange: "40 mg/dL or higher (men); 50 or higher (women)",
      explanation: "'Good' cholesterol that helps remove other forms of cholesterol",
      status: "low",
      category: "heart"
    },
    {
      id: "ldl",
      name: "LDL Cholesterol",
      value: 96,
      unit: "mg/dL",
      normalRange: "Less than 100 mg/dL",
      explanation: "'Bad' cholesterol that can build up in arteries",
      status: "good",
      category: "heart"
    },
    {
      id: "total_cholesterol",
      name: "Total Cholesterol",
      value: 144,
      unit: "mg/dL",
      normalRange: "Less than 200 mg/dL",
      explanation: "Fatty substance in blood, needed for cell building",
      status: "good",
      category: "heart"
    },
    {
      id: "triglycerides",
      name: "Triglycerides",
      value: 50,
      unit: "mg/dL",
      normalRange: "Less than 150 mg/dL",
      explanation: "Type of fat in blood that stores excess energy",
      status: "good",
      category: "heart"
    },
    {
      id: "vitamin_b12",
      name: "Vitamin B12",
      value: 405,
      unit: "pg/mL",
      normalRange: "200-900 pg/mL",
      explanation: "Helps make DNA and red blood cells, supports nerve function",
      status: "good",
      category: "vitamins"
    },
    {
      id: "vitamin_d",
      name: "Vitamin D",
      value: 48.2,
      unit: "ng/mL",
      normalRange: "20-50 ng/mL",
      explanation: "Helps body absorb calcium, important for bone health",
      status: "good",
      category: "vitamins"
    },
    {
      id: "hba1c",
      name: "HbA1C",
      value: 5.1,
      unit: "%",
      normalRange: "Below 5.7%",
      explanation: "Average blood glucose levels over the past 2-3 months",
      status: "good",
      category: "metabolic"
    },
    {
      id: "glucose",
      name: "Glucose (Random)",
      value: 89,
      unit: "mg/dL",
      normalRange: "70-140 mg/dL (random); 70-99 mg/dL (fasting)",
      explanation: "Blood sugar level",
      status: "good",
      category: "metabolic"
    },
    {
      id: "tsh",
      name: "TSH",
      value: 2.504,
      unit: "µIU/mL",
      normalRange: "0.4-4.0 µIU/mL",
      explanation: "Thyroid stimulating hormone, controls thyroid gland function",
      status: "good",
      category: "metabolic"
    },
    {
      id: "creatinine",
      name: "Creatinine",
      value: 0.7,
      unit: "mg/dL",
      normalRange: "0.7-1.3 mg/dL (men); 0.6-1.1 mg/dL (women)",
      explanation: "Waste product filtered by kidneys, indicator of kidney function",
      status: "good",
      category: "kidney"
    },
    {
      id: "uric_acid",
      name: "Uric Acid",
      value: 4.4,
      unit: "mg/dL",
      normalRange: "3.5-7.2 mg/dL (men); 2.5-6.0 mg/dL (women)",
      explanation: "Waste product from breakdown of purines in food",
      status: "good",
      category: "kidney"
    },
    {
      id: "calcium",
      name: "Calcium",
      value: 9.3,
      unit: "mg/dL",
      normalRange: "8.5-10.5 mg/dL",
      explanation: "Essential for bone health, muscle function, and nerve signaling",
      status: "good",
      category: "electrolytes"
    },
    {
      id: "sodium",
      name: "Sodium",
      value: 134,
      unit: "mmol/L",
      normalRange: "135-145 mmol/L",
      explanation: "Electrolyte that helps maintain fluid balance and nerve/muscle function",
      status: "low",
      category: "electrolytes"
    },
    {
      id: "potassium",
      name: "Potassium",
      value: 4.8,
      unit: "mmol/L",
      normalRange: "3.5-5.0 mmol/L",
      explanation: "Electrolyte essential for heart, muscle, and nerve function",
      status: "good",
      category: "electrolytes"
    }
  ]);

  // Body composition data from DEXA scan
  const [bodyComposition, setBodyComposition] = useState<BodyComposition[]>([
    {
      id: "weight",
      name: "Weight",
      value: 73,
      unit: "kg",
      explanation: "Total body weight",
      icon: <Scale className="h-4 w-4 text-blue-500" />
    },
    {
      id: "height",
      name: "Height",
      value: 170,
      unit: "cm",
      explanation: "Standing height",
      icon: <Activity className="h-4 w-4 text-blue-500" />
    },
    {
      id: "age",
      name: "Age",
      value: 27.8,
      unit: "years",
      explanation: "Chronological age",
      icon: <Activity className="h-4 w-4 text-blue-500" />
    },
    {
      id: "body_fat",
      name: "Body Fat",
      value: 25.7,
      unit: "%",
      explanation: "Percentage of total body mass that is fat",
      icon: <Heart className="h-4 w-4 text-red-500" />
    },
    {
      id: "fat_mass",
      name: "Fat Mass",
      value: 18.7,
      unit: "kg",
      explanation: "Total mass of body fat",
      icon: <Heart className="h-4 w-4 text-red-500" />
    },
    {
      id: "lean_mass",
      name: "Lean Mass",
      value: 51.1,
      unit: "kg",
      explanation: "Total mass of non-fat tissue including muscle, organs, and water",
      icon: <Dumbbell className="h-4 w-4 text-green-500" />
    },
    {
      id: "bone_mass",
      name: "Bone Mass",
      value: 3.1,
      unit: "kg",
      explanation: "Total mass of bone mineral content",
      icon: <Activity className="h-4 w-4 text-purple-500" />
    },
    {
      id: "visceral_fat_mass",
      name: "Visceral Fat Mass",
      value: 580,
      unit: "g",
      explanation: "Mass of fat surrounding internal organs",
      icon: <Heart className="h-4 w-4 text-amber-500" />
    },
    {
      id: "visceral_fat_volume",
      name: "Visceral Fat Volume",
      value: 615,
      unit: "cm³",
      explanation: "Volume of fat surrounding internal organs",
      icon: <Heart className="h-4 w-4 text-amber-500" />
    },
    {
      id: "android_gynoid_ratio",
      name: "Android-Gynoid Ratio",
      value: 1.31,
      unit: "",
      explanation: "Ratio of android (abdominal) fat to gynoid (hip/thigh) fat",
      icon: <Activity className="h-4 w-4 text-blue-500" />
    },
    {
      id: "rmr",
      name: "RMR",
      value: 1479,
      unit: "kcal/day",
      explanation: "Resting Metabolic Rate - calories burned at rest",
      icon: <Flame className="h-4 w-4 text-orange-500" />
    }
  ]);

  // Maintenance macros
  const [macros, setMacros] = useState<Macro[]>([
    {
      id: "protein",
      name: "Protein",
      value: 96,
      unit: "g",
      explanation: "Daily protein intake for maintenance",
      icon: <Dumbbell className="h-4 w-4 text-blue-500" />
    },
    {
      id: "carbs",
      name: "Carbs",
      value: 166,
      unit: "g",
      explanation: "Daily carbohydrate intake for maintenance",
      icon: <Apple className="h-4 w-4 text-purple-500" />
    },
    {
      id: "fat",
      name: "Fat",
      value: 47,
      unit: "g",
      explanation: "Daily fat intake for maintenance",
      icon: <Activity className="h-4 w-4 text-yellow-500" />
    }
  ]);

  // Group blood markers by category
  const markerCategories: MarkerCategory[] = [
    {
      id: "heart",
      name: "Heart",
      icon: <Heart className="h-5 w-5 text-red-500" />,
      description: "Cardiovascular health markers including cholesterol and triglycerides",
      markers: bloodMarkers.filter(marker => marker.category === "heart")
    },
    {
      id: "kidney",
      name: "Kidney",
      icon: <Kidney className="h-5 w-5 text-blue-500" />,
      description: "Kidney function markers including creatinine and uric acid",
      markers: bloodMarkers.filter(marker => marker.category === "kidney")
    },
    {
      id: "metabolic",
      name: "Metabolic",
      icon: <Activity className="h-5 w-5 text-green-500" />,
      description: "Metabolic health markers including glucose and thyroid function",
      markers: bloodMarkers.filter(marker => marker.category === "metabolic")
    },
    {
      id: "blood",
      name: "Blood",
      icon: <Droplet className="h-5 w-5 text-red-500" />,
      description: "Blood cell counts and related markers",
      markers: bloodMarkers.filter(marker => marker.category === "blood")
    },
    {
      id: "vitamins",
      name: "Vitamins",
      icon: <Apple className="h-5 w-5 text-orange-500" />,
      description: "Vitamin levels and nutritional markers",
      markers: bloodMarkers.filter(marker => marker.category === "vitamins")
    },
    {
      id: "electrolytes",
      name: "Electrolytes",
      icon: <Flame className="h-5 w-5 text-blue-500" />,
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
        return 'text-amber-500';
      case 'high':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  // Format value for display
  const formatValue = (value: number | string, unit: string) => {
    if (value === null) return '—';
    
    // Format large numbers with commas
    if (typeof value === 'number' && value >= 1000) {
      return value.toLocaleString() + ' ' + unit;
    }
    
    return value + (unit ? ' ' + unit : '');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
      {/* Background decoration - similar to landing page */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-green-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-green-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header */}
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
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent">
            Mihir's Body Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Track your key health metrics and body composition
          </p>
          <p className="mt-2 text-md font-medium text-blue-600">
            📅 All data shown is from April 7, 2025
          </p>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        <Tabs defaultValue="blood" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="blood">Blood Markers</TabsTrigger>
            <TabsTrigger value="composition">Body Composition</TabsTrigger>
            <TabsTrigger value="macros">Maintenance Macros</TabsTrigger>
          </TabsList>
          
          {/* Blood Markers Tab */}
          <TabsContent value="blood">
            {loading ? (
              // Loading skeletons
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array(8).fill(0).map((_, i) => (
                  <Card key={i} className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
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
                    <div className="flex items-center space-x-2 border-b pb-2">
                      {category.icon}
                      <h2 className="text-xl font-semibold text-gray-800">{category.name}</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{category.description}</p>
                    
                    {/* Category Markers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {category.markers.map((marker) => (
                        <TooltipProvider key={marker.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-medium text-gray-500 flex items-center justify-between">
                                    <span className="flex items-center">
                                      <Activity className="mr-2 h-4 w-4 text-blue-500" />
                                      {marker.name}
                                    </span>
                                    <Info className={`h-4 w-4 ${getStatusColor(marker.status)}`} />
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className={`text-2xl font-bold ${getStatusColor(marker.status)}`}>
                                    {formatValue(marker.value, marker.unit)}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {bodyComposition.map((item) => (
                <TooltipProvider key={item.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-gray-500 flex items-center justify-between">
                            <span className="flex items-center">
                              {item.icon}
                              <span className="ml-2">{item.name}</span>
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-gray-800">
                            {formatValue(item.value, item.unit)}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {macros.map((item) => (
                <TooltipProvider key={item.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-gray-500 flex items-center justify-between">
                            <span className="flex items-center">
                              {item.icon}
                              <span className="ml-2">{item.name}</span>
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-gray-800">
                            {formatValue(item.value, item.unit)}
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
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <p>Data from your latest health assessment</p>
      </footer>
    </div>
  );
};

export default BodyJam;
