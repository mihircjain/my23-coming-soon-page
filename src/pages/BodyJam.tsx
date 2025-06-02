import { useState } from "react";
import { ArrowLeft, Activity, Info } from "lucide-react";
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

// Define types for our blood markers
interface BloodMarker {
  id: string;
  name: string;
  value: number | null;
  unit: string;
  normalRange: string;
  explanation: string;
  status: 'good' | 'low' | 'high' | 'unknown';
}

const BodyJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Sample blood marker data
  const [bloodMarkers, setBloodMarkers] = useState<BloodMarker[]>([
    {
      id: "rbc",
      name: "RBC",
      value: 5.2,
      unit: "million cells/mcL",
      normalRange: "4.5-5.9 million cells/mcL (men); 4.1-5.1 (women)",
      explanation: "Carries oxygen from lungs to tissues and carbon dioxide back to lungs",
      status: "good"
    },
    {
      id: "wbc",
      name: "WBC",
      value: 7500,
      unit: "cells/mcL",
      normalRange: "4,500-11,000 cells/mcL",
      explanation: "Part of immune system, helps fight infections",
      status: "good"
    },
    {
      id: "hemoglobin",
      name: "Hemoglobin",
      value: 14.5,
      unit: "g/dL",
      normalRange: "13.5-17.5 g/dL (men); 12.0-15.5 (women)",
      explanation: "Protein in red blood cells that carries oxygen",
      status: "good"
    },
    {
      id: "platelets",
      name: "Platelet Count",
      value: 250000,
      unit: "platelets/mcL",
      normalRange: "150,000-450,000 platelets/mcL",
      explanation: "Helps blood clot, prevents excessive bleeding",
      status: "good"
    },
    {
      id: "total_cholesterol",
      name: "Total Cholesterol",
      value: 210,
      unit: "mg/dL",
      normalRange: "Less than 200 mg/dL",
      explanation: "Fatty substance in blood, needed for cell building",
      status: "high"
    },
    {
      id: "hdl",
      name: "HDL Cholesterol",
      value: 45,
      unit: "mg/dL",
      normalRange: "40 mg/dL or higher (men); 50 or higher (women)",
      explanation: "'Good' cholesterol that helps remove other forms of cholesterol",
      status: "good"
    },
    {
      id: "ldl",
      name: "LDL Cholesterol",
      value: 130,
      unit: "mg/dL",
      normalRange: "Less than 100 mg/dL",
      explanation: "'Bad' cholesterol that can build up in arteries",
      status: "high"
    },
    {
      id: "triglycerides",
      name: "Triglycerides",
      value: 120,
      unit: "mg/dL",
      normalRange: "Less than 150 mg/dL",
      explanation: "Type of fat in blood that stores excess energy",
      status: "good"
    },
    {
      id: "vitamin_d",
      name: "Vitamin D",
      value: 18,
      unit: "ng/mL",
      normalRange: "20-50 ng/mL",
      explanation: "Helps body absorb calcium, important for bone health",
      status: "low"
    },
    {
      id: "vitamin_b12",
      name: "Vitamin B12",
      value: 550,
      unit: "pg/mL",
      normalRange: "200-900 pg/mL",
      explanation: "Helps make DNA and red blood cells, supports nerve function",
      status: "good"
    },
    {
      id: "fasting_glucose",
      name: "Fasting Glucose",
      value: 95,
      unit: "mg/dL",
      normalRange: "70-99 mg/dL",
      explanation: "Blood sugar level after not eating for at least 8 hours",
      status: "good"
    }
  ]);

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
  const formatValue = (value: number | null, unit: string) => {
    if (value === null) return 'N/A';
    
    // Format large numbers with commas
    if (value >= 1000) {
      return value.toLocaleString() + ' ' + unit;
    }
    
    return value + ' ' + unit;
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
            Track your key blood test markers and health indicators
          </p>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        {/* Blood Markers Grid */}
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? (
              // Loading skeletons
              Array(8).fill(0).map((_, i) => (
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
              ))
            ) : (
              // Actual blood marker cards
              bloodMarkers.map((marker) => (
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
                        <div className="text-xs">
                          <span className="font-medium">Status:</span> 
                          <span className={`ml-1 ${getStatusColor(marker.status)}`}>
                            {marker.status.charAt(0).toUpperCase() + marker.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))
            )}
          </div>
        </section>
        
        {/* Information Section */}
        <section className="mb-12">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">About Blood Markers</h3>
            <p className="text-gray-600 mb-4">
              Blood markers are important indicators of your overall health. Regular monitoring can help identify potential health issues before they become serious.
            </p>
            <p className="text-gray-600 mb-4">
              The color indicators show whether your values are within normal range (green), below normal range (amber), or above normal range (red).
            </p>
            <p className="text-gray-600">
              Click on any marker card to see more details about that specific marker, including the normal range and a brief explanation.
            </p>
          </Card>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>Sample data for demonstration purposes</div>
          <div>Last updated: {new Date().toLocaleDateString()}</div>
        </div>
      </footer>
    </div>
  );
};

export default BodyJam;
