import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data for blood markers - in a real app, this would come from an API or database
const mockBloodMarkers = {
  heart: {
    cholesterol: { value: 185, unit: "mg/dL", normal: "125-200" },
    hdl: { value: 65, unit: "mg/dL", normal: ">40" },
    ldl: { value: 110, unit: "mg/dL", normal: "<130" },
    triglycerides: { value: 120, unit: "mg/dL", normal: "<150" }
  },
  kidney: {
    creatinine: { value: 0.9, unit: "mg/dL", normal: "0.7-1.3" },
    urea: { value: 15, unit: "mg/dL", normal: "7-20" },
    egfr: { value: 95, unit: "mL/min/1.73m²", normal: ">60" }
  }
};

const BloodMarkersJam = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-green-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-green-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <Button 
          onClick={() => navigate("/")} 
          variant="ghost" 
          className="mb-6 hover:bg-white/20"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent">
            Blood Markers Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Track and monitor your key health indicators
          </p>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        <Tabs defaultValue="all" value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="all" className="text-sm md:text-base">
              All Markers
            </TabsTrigger>
            <TabsTrigger value="heart" className="text-sm md:text-base">
              Heart Health
            </TabsTrigger>
            <TabsTrigger value="kidney" className="text-sm md:text-base">
              Kidney Health
            </TabsTrigger>
          </TabsList>
          
          {/* All Markers Tab */}
          <TabsContent value="all" className="space-y-6">
            {/* Heart Health Section */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-blue-700">Heart Health</CardTitle>
                <CardDescription>
                  These markers are related to cardiovascular risk and heart function
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(mockBloodMarkers.heart).map(([key, marker]) => (
                    <Card key={key} className="bg-white/50 shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg capitalize">{key}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center">
                          <span className="text-2xl font-bold">{marker.value}</span>
                          <span className="text-sm text-gray-500">{marker.unit}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Normal range: {marker.normal}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Kidney Health Section */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-green-700">Kidney Health</CardTitle>
                <CardDescription>
                  These markers indicate kidney function and filtration efficiency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(mockBloodMarkers.kidney).map(([key, marker]) => (
                    <Card key={key} className="bg-white/50 shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg capitalize">{key}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center">
                          <span className="text-2xl font-bold">{marker.value}</span>
                          <span className="text-sm text-gray-500">{marker.unit}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Normal range: {marker.normal}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Heart Health Tab */}
          <TabsContent value="heart" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-blue-700">Heart Health</CardTitle>
                <CardDescription>
                  These markers are related to cardiovascular risk and heart function
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(mockBloodMarkers.heart).map(([key, marker]) => (
                    <Card key={key} className="bg-white/50 shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg capitalize">{key}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center">
                          <span className="text-2xl font-bold">{marker.value}</span>
                          <span className="text-sm text-gray-500">{marker.unit}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Normal range: {marker.normal}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Kidney Health Tab */}
          <TabsContent value="kidney" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-green-700">Kidney Health</CardTitle>
                <CardDescription>
                  These markers indicate kidney function and filtration efficiency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(mockBloodMarkers.kidney).map(([key, marker]) => (
                    <Card key={key} className="bg-white/50 shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg capitalize">{key}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center">
                          <span className="text-2xl font-bold">{marker.value}</span>
                          <span className="text-sm text-gray-500">{marker.unit}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Normal range: {marker.normal}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>Data stored securely in the cloud</div>
          <div>Last updated: {new Date().toLocaleDateString()}</div>
        </div>
      </footer>
    </div>
  );
};

export default BloodMarkersJam;
