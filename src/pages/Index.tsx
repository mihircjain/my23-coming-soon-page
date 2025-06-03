// Update the Index.tsx to include the NutritionWidget component
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NutritionWidget } from "@/components/nutrition/NutritionWidget";

const Index = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-green-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-green-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 flex flex-col items-center justify-center p-6 md:p-12">
        <div className="max-w-4xl w-full mx-auto space-y-12">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent">
              my23.ai
            </h1>
            <p className="mt-4 text-xl text-gray-600">
              Mihir's personal dashboard
            </p>
            <div className="mt-2 text-lg font-mono text-gray-500">
              {formatTime(currentTime)}
            </div>
          </div>
          
          {/* Current Jam Section */}
          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Current Jam</h2>
            <Tabs defaultValue="health" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="health">Health</TabsTrigger>
                <TabsTrigger value="body">Body</TabsTrigger>
                <TabsTrigger value="mind">Mind</TabsTrigger>
              </TabsList>
              
              <TabsContent value="health" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Health Dashboard Card */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle>Health Dashboard</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 mb-4">
                        Track health metrics from Strava, Oura, and more.
                      </p>
                      <Button asChild>
                        <Link to="/health-dashboard">View Dashboard</Link>
                      </Button>
                    </CardContent>
                  </Card>
                  
                  {/* Nutrition Jam Card */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle>Nutrition Jam</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 mb-4">
                        Track daily nutrition with vegetarian food database.
                      </p>
                      <Button asChild>
                        <Link to="/nutrition-jam">View Tracker</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="body" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Body Jam Card */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle>Body Jam</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 mb-4">
                        Track workouts, body metrics, and progress.
                      </p>
                      <Button asChild>
                        <Link to="/body-jam">View Tracker</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="mind" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Mind Jam Card */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle>Mind Jam</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 mb-4">
                        Track meditation, journaling, and mental wellness.
                      </p>
                      <Button asChild disabled>
                        <Link to="/mind-jam">Coming Soon</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </section>
          
          {/* Nutrition Widgets Section */}
          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Nutrition Summary</h2>
            <NutritionWidget />
          </section>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div>© {new Date().getFullYear()} Mihir Jain. All rights reserved.</div>
      </footer>
    </div>
  );
};

export default Index;
