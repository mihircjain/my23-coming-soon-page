import { useEffect, useState } from "react";
import { ArrowLeft, Utensils, Beef, Grain, Oil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { initializeCharts } from './NutritionJamCharts';

// Define types for our nutrition data
interface NutritionData {
  date: string;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: (number | null)[];
    borderColor?: string;
    backgroundColor?: string | string[];
    fill?: boolean;
  }[];
}

const NutritionJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nutritionData, setNutritionData] = useState<NutritionData[]>([]);
  const [proteinData, setProteinData] = useState<ChartData | null>(null);
  const [carbsData, setCarbsData] = useState<ChartData | null>(null);
  const [fatData, setFatData] = useState<ChartData | null>(null);
  const [summaryStats, setSummaryStats] = useState({
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    avgCalories: 0,
  });

  // Initialize nutrition data for the last 30 days
  const initializeNutritionData = () => {
    // Check if we have data in localStorage
    const savedData = localStorage.getItem('nutritionData');
    
    if (savedData) {
      return JSON.parse(savedData);
    }
    
    // If no saved data, create empty entries for the last 30 days
    const data: NutritionData[] = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0], // YYYY-MM-DD format
        protein: null,
        carbs: null,
        fat: null
      });
    }
    
    return data;
  };

  // Load nutrition data on component mount
  useEffect(() => {
    setLoading(true);
    const data = initializeNutritionData();
    setNutritionData(data);
    generateChartData(data);
    calculateSummaryStats(data);
    setLoading(false);
  }, []);

  // Save nutrition data to localStorage whenever it changes
  useEffect(() => {
    if (nutritionData.length > 0) {
      localStorage.setItem('nutritionData', JSON.stringify(nutritionData));
    }
  }, [nutritionData]);

  // Update chart data whenever nutrition data changes
  useEffect(() => {
    if (!loading && nutritionData.length > 0) {
      generateChartData(nutritionData);
      calculateSummaryStats(nutritionData);
    }
  }, [loading, nutritionData]);

  // Render charts after data is loaded
  useEffect(() => {
    if (!loading && proteinData && carbsData && fatData) {
      renderCharts();
    }
  }, [loading, proteinData, carbsData, fatData]);

  // Generate chart data for visualizations
  const generateChartData = (data: NutritionData[]) => {
    // Sort data by date (oldest to newest)
    const sortedData = [...data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Extract dates for labels
    const dateLabels = sortedData.map(d => d.date);
    
    // Extract data for protein chart
    setProteinData({
      labels: dateLabels,
      datasets: [{
        label: 'Protein (g)',
        data: sortedData.map(d => d.protein),
        borderColor: 'rgba(59, 130, 246, 0.8)', // blue
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: false
      }]
    });
    
    // Extract data for carbs chart
    setCarbsData({
      labels: dateLabels,
      datasets: [{
        label: 'Carbs (g)',
        data: sortedData.map(d => d.carbs),
        borderColor: 'rgba(139, 92, 246, 0.8)', // purple
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        fill: false
      }]
    });
    
    // Extract data for fat chart
    setFatData({
      labels: dateLabels,
      datasets: [{
        label: 'Fat (g)',
        data: sortedData.map(d => d.fat),
        borderColor: 'rgba(16, 185, 129, 0.8)', // green
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        fill: false
      }]
    });
  };

  // Calculate summary statistics
  const calculateSummaryStats = (data: NutritionData[]) => {
    // Filter out entries with null values
    const validEntries = data.filter(d => 
      d.protein !== null && d.carbs !== null && d.fat !== null
    );
    
    if (validEntries.length === 0) {
      setSummaryStats({
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        avgCalories: 0
      });
      return;
    }
    
    // Calculate totals
    const totalProtein = validEntries.reduce((sum, d) => sum + (d.protein || 0), 0);
    const totalCarbs = validEntries.reduce((sum, d) => sum + (d.carbs || 0), 0);
    const totalFat = validEntries.reduce((sum, d) => sum + (d.fat || 0), 0);
    
    // Calculate average daily calories (protein: 4 cal/g, carbs: 4 cal/g, fat: 9 cal/g)
    const totalCalories = validEntries.reduce((sum, d) => {
      const proteinCal = (d.protein || 0) * 4;
      const carbsCal = (d.carbs || 0) * 4;
      const fatCal = (d.fat || 0) * 9;
      return sum + proteinCal + carbsCal + fatCal;
    }, 0);
    
    const avgCalories = Math.round(totalCalories / validEntries.length);
    
    setSummaryStats({
      totalProtein: Math.round(totalProtein),
      totalCarbs: Math.round(totalCarbs),
      totalFat: Math.round(totalFat),
      avgCalories
    });
  };

  // Handle input change for nutrition data
  const handleInputChange = (index: number, field: 'protein' | 'carbs' | 'fat', value: string) => {
    const newData = [...nutritionData];
    
    // Convert empty string to null, otherwise parse as number
    const numValue = value === '' ? null : parseFloat(value);
    
    newData[index] = {
      ...newData[index],
      [field]: numValue
    };
    
    setNutritionData(newData);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Render charts
  const renderCharts = () => {
    if (proteinData && carbsData && fatData) {
      initializeCharts(proteinData, carbsData, fatData);
    }
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
            Mihir's Nutrition Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Track your daily nutrition intake over the last 30 days
          </p>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        {/* Summary Stats Section */}
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Protein Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Beef className="mr-2 h-4 w-4 text-blue-500" />
                  Total Protein
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{summaryStats.totalProtein} g</div>
                )}
              </CardContent>
            </Card>
            
            {/* Total Carbs Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Grain className="mr-2 h-4 w-4 text-purple-500" />
                  Total Carbs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{summaryStats.totalCarbs} g</div>
                )}
              </CardContent>
            </Card>
            
            {/* Total Fat Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Oil className="mr-2 h-4 w-4 text-green-500" />
                  Total Fat
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{summaryStats.totalFat} g</div>
                )}
              </CardContent>
            </Card>
            
            {/* Average Calories Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
                  <Utensils className="mr-2 h-4 w-4 text-red-500" />
                  Avg. Daily Calories
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{summaryStats.avgCalories} cal</div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
        
        {/* Charts Section */}
        <section className="mb-12">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Nutrition Trends</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-gray-400">Loading nutrition data...</div>
              </div>
            ) : (
              <div className="h-64" id="nutrition-chart">
                {/* Chart will be rendered here */}
              </div>
            )}
          </Card>
        </section>
        
        {/* Data Input Table */}
        <section className="mb-12">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm p-6">
            <h3 className="text-lg font-medium mb-4">Daily Nutrition Data</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Date</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Protein (g)</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Carbs (g)</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Fat (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-3 px-4"><Skeleton className="h-6 w-24" /></td>
                        <td className="py-3 px-4"><Skeleton className="h-6 w-16" /></td>
                        <td className="py-3 px-4"><Skeleton className="h-6 w-16" /></td>
                        <td className="py-3 px-4"><Skeleton className="h-6 w-16" /></td>
                      </tr>
                    ))
                  ) : (
                    nutritionData.map((data, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="py-3 px-4 text-sm text-gray-600">{formatDate(data.date)}</td>
                        <td className="py-3 px-4">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={data.protein === null ? '' : data.protein}
                            onChange={(e) => handleInputChange(index, 'protein', e.target.value)}
                            className="h-8 w-20 text-sm"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={data.carbs === null ? '' : data.carbs}
                            onChange={(e) => handleInputChange(index, 'carbs', e.target.value)}
                            className="h-8 w-20 text-sm"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={data.fat === null ? '' : data.fat}
                            onChange={(e) => handleInputChange(index, 'fat', e.target.value)}
                            className="h-8 w-20 text-sm"
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>Data stored locally in your browser</div>
          <div>Last updated: {new Date().toLocaleDateString()}</div>
        </div>
      </footer>
    </div>
  );
};

export default NutritionJam;
