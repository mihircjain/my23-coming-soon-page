// Complete Enhanced ActivityJam.tsx with Run Tagging & Training Analysis - FULL VERSION

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, Calendar, Clock, Zap, Heart, Activity, BarChart3, Tag, CheckCircle, AlertCircle, Target, Timer, TrendingUp, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import Chart from 'chart.js/auto';

interface ActivityData {
  id: string;
  name: string;
  type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  calories: number;
  is_run_activity: boolean;
  runType?: string;
  taggedAt?: string;
  userOverride?: boolean;
  autoSuggestion?: string;
}

// Run classification algorithm
const classifyRun = (activity: ActivityData) => {
  if (!activity.distance || !activity.moving_time) {
    return { type: 'easy', confidence: 0.3, reason: 'Insufficient data - defaulting to easy' };
  }
  
  const pace = (activity.moving_time / 60) / activity.distance; // min/km
  const hr = activity.average_heartrate || 0;
  const distance = activity.distance;
  
  if (distance >= 15) {
    return { 
      type: 'long', 
      confidence: 0.9, 
      reason: `${distance.toFixed(1)}km indicates long run distance` 
    };
  }
  
  if (pace < 4.5 || hr > 175) {
    return { 
      type: 'interval', 
      confidence: 0.8, 
      reason: `Fast pace (${pace.toFixed(2)} min/km)${hr > 175 ? ` and high HR (${hr} bpm)` : ''}` 
    };
  }
  
  if (pace >= 4.3 && pace <= 5.5 && hr >= 160 && hr <= 180) {
    return { 
      type: 'tempo', 
      confidence: 0.75, 
      reason: `Sustained moderate-hard effort (${pace.toFixed(2)} min/km, ${hr} bpm)` 
    };
  }
  
  if (pace > 6.5 || (hr > 0 && hr < 140)) {
    return { 
      type: 'recovery', 
      confidence: 0.7, 
      reason: `Very easy effort (${pace.toFixed(2)} min/km${hr > 0 ? `, ${hr} bpm` : ''})` 
    };
  }
  
  return { 
    type: 'easy', 
    confidence: 0.6, 
    reason: `Moderate effort (${pace.toFixed(2)} min/km) - typical easy run` 
  };
};

// Run Tagging Section Component
const RunTaggingSection: React.FC<{
  activities: ActivityData[],
  onTagRun: (activityId: string, runType: string) => void,
  isTagging: boolean
}> = ({ activities, onTagRun, isTagging }) => {
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  
  const runActivities = activities.filter(activity => activity.is_run_activity);
  const untaggedRuns = runActivities.filter(run => !run.runType);
  const taggedRuns = runActivities.filter(run => run.runType);
  
  const runTypes = [
    { 
      value: 'easy', 
      label: 'Easy Run', 
      color: 'bg-green-100 text-green-800 border-green-300', 
      description: '70-80% of training',
      icon: '🟢'
    },
    { 
      value: 'tempo', 
      label: 'Tempo', 
      color: 'bg-orange-100 text-orange-800 border-orange-300', 
      description: 'Comfortably hard',
      icon: '🟠'
    },
    { 
      value: 'interval', 
      label: 'Intervals', 
      color: 'bg-red-100 text-red-800 border-red-300', 
      description: 'High intensity',
      icon: '🔴'
    },
    { 
      value: 'long', 
      label: 'Long Run', 
      color: 'bg-blue-100 text-blue-800 border-blue-300', 
      description: 'Weekly endurance',
      icon: '🔵'
    },
    { 
      value: 'recovery', 
      label: 'Recovery', 
      color: 'bg-gray-100 text-gray-800 border-gray-300', 
      description: 'Very easy',
      icon: '⚪'
    },
    { 
      value: 'race', 
      label: 'Race', 
      color: 'bg-purple-100 text-purple-800 border-purple-300', 
      description: 'Race effort',
      icon: '🟣'
    }
  ];
  
  if (runActivities.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-blue-800 flex items-center gap-2">
            <Tag className="h-5 w-5" />
            No Running Activities Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-blue-700">Start running to see training analysis and tagging options!</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Run Training Overview */}
      <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-orange-800 flex items-center gap-2">
            <Target className="h-5 w-5" />
            Training Analysis
            <Badge variant="outline" className="ml-2 text-xs border-orange-300 text-orange-700">
              {runActivities.length} runs total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-white/60 rounded-lg border border-orange-200">
              <div className="text-2xl font-bold text-orange-600">{runActivities.length}</div>
              <div className="text-xs text-orange-700">Total Runs</div>
            </div>
            <div className="text-center p-3 bg-white/60 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">{taggedRuns.length}</div>
              <div className="text-xs text-green-700">Tagged</div>
            </div>
            <div className="text-center p-3 bg-white/60 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-600">{untaggedRuns.length}</div>
              <div className="text-xs text-red-700">Need Tagging</div>
            </div>
            <div className="text-center p-3 bg-white/60 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {taggedRuns.length > 0 ? Math.round((taggedRuns.length / runActivities.length) * 100) : 0}%
              </div>
              <div className="text-xs text-blue-700">Classified</div>
            </div>
          </div>
          
          {untaggedRuns.length > 0 ? (
            <div className="p-3 bg-orange-100/50 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-800">
                <strong>Training Tip:</strong> Tag your runs to get better training analysis! 
                The AI can provide more specific advice when it knows your run types.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-green-100/50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800">
                <strong>Excellent!</strong> All your runs are properly tagged. You can now get detailed training insights.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Untagged Runs Section - Only show if there are untagged runs */}
      {untaggedRuns.length > 0 && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-yellow-800 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Runs Need Classification
              <Badge variant="outline" className="ml-2 text-xs border-yellow-300 text-yellow-700">
                {untaggedRuns.length} pending
              </Badge>
            </CardTitle>
            <p className="text-sm text-yellow-700">
              Click the suggested type or choose your own to improve training analysis
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {untaggedRuns.slice(0, 5).map((run) => {
              const suggestion = classifyRun(run);
              const suggestedType = runTypes.find(t => t.value === suggestion.type);
              
              return (
                <div key={run.id} className="p-4 bg-white/70 rounded-lg border border-yellow-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800">{run.name}</h4>
                      <div className="text-sm text-gray-600 flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {run.distance.toFixed(1)}km
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.round(run.moving_time / 60)}min
                        </span>
                        <span>{new Date(run.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        {run.average_heartrate && (
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3 text-red-500" />
                            {run.average_heartrate} bpm
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`${suggestedType?.color} border-0 text-xs`}
                    >
                      {suggestedType?.icon} AI: {suggestedType?.label}
                    </Badge>
                  </div>
                  
                  <div className="text-xs text-gray-600 mb-3 p-2 bg-gray-50 rounded">
                    <span className="font-medium">AI Analysis:</span> {suggestion.reason}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {runTypes.map((type) => (
                      <Button
                        key={type.value}
                        size="sm"
                        variant={suggestion.type === type.value ? "default" : "outline"}
                        className={`text-xs h-auto p-2 ${
                          suggestion.type === type.value 
                            ? 'ring-2 ring-orange-300 bg-orange-100 text-orange-800' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          setSelectedRun(run.id);
                          onTagRun(run.id, type.value);
                        }}
                        disabled={isTagging && selectedRun === run.id}
                      >
                        <div className="text-center">
                          <div className="text-lg mb-1">{type.icon}</div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs opacity-75">{type.description}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                  
                  {isTagging && selectedRun === run.id && (
                    <div className="mt-2 text-center">
                      <div className="text-xs text-blue-600 flex items-center justify-center gap-2">
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        Saving tag...
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {untaggedRuns.length > 5 && (
              <div className="text-center pt-3 border-t border-yellow-200">
                <p className="text-sm text-yellow-600">
                  +{untaggedRuns.length - 5} more runs to classify
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Tagged Runs Summary */}
      {taggedRuns.length > 0 && (
        <RunTypeSummary taggedRuns={taggedRuns} />
      )}
    </div>
  );
};

// Run Type Summary Component
const RunTypeSummary: React.FC<{ taggedRuns: ActivityData[] }> = ({ taggedRuns }) => {
  const distribution = {
    easy: taggedRuns.filter(r => r.runType === 'easy').length,
    tempo: taggedRuns.filter(r => r.runType === 'tempo').length,
    interval: taggedRuns.filter(r => r.runType === 'interval').length,
    long: taggedRuns.filter(r => r.runType === 'long').length,
    recovery: taggedRuns.filter(r => r.runType === 'recovery').length,
    race: taggedRuns.filter(r => r.runType === 'race').length
  };
  
  const totalTagged = Object.values(distribution).reduce((a, b) => a + b, 0);
  const easyPercentage = totalTagged > 0 ? Math.round((distribution.easy / totalTagged) * 100) : 0;
  const hardPercentage = totalTagged > 0 ? Math.round(((distribution.tempo + distribution.interval + distribution.race) / totalTagged) * 100) : 0;
  
  const getTrainingBalance = () => {
    if (totalTagged < 3) return { score: 'insufficient', color: 'gray', message: 'Need more runs for analysis' };
    if (easyPercentage >= 70 && easyPercentage <= 80 && hardPercentage >= 15 && hardPercentage <= 25) {
      return { score: 'excellent', color: 'green', message: 'Perfect 80/20 balance!' };
    } else if (easyPercentage >= 60 && hardPercentage <= 30) {
      return { score: 'good', color: 'blue', message: 'Good training balance' };
    } else if (hardPercentage > 40) {
      return { score: 'too-hard', color: 'red', message: 'Too much hard running - add easy runs' };
    } else if (easyPercentage < 50) {
      return { score: 'unbalanced', color: 'orange', message: 'Need more easy runs' };
    } else {
      return { score: 'needs-improvement', color: 'yellow', message: 'Training balance needs work' };
    }
  };
  
  const balance = getTrainingBalance();
  
  return (
    <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-green-800 flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Training Distribution Analysis
          <Badge variant="outline" className="ml-2 text-xs border-green-300 text-green-700">
            {totalTagged} runs analyzed
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
          <div className="text-center p-3 bg-green-100/60 rounded-lg border border-green-200">
            <div className="text-xl font-bold text-green-700">🟢</div>
            <div className="text-lg font-bold text-green-800">{distribution.easy}</div>
            <div className="text-xs text-green-700">Easy</div>
          </div>
          <div className="text-center p-3 bg-orange-100/60 rounded-lg border border-orange-200">
            <div className="text-xl font-bold text-orange-700">🟠</div>
            <div className="text-lg font-bold text-orange-800">{distribution.tempo}</div>
            <div className="text-xs text-orange-700">Tempo</div>
          </div>
          <div className="text-center p-3 bg-red-100/60 rounded-lg border border-red-200">
            <div className="text-xl font-bold text-red-700">🔴</div>
            <div className="text-lg font-bold text-red-800">{distribution.interval}</div>
            <div className="text-xs text-red-700">Intervals</div>
          </div>
          <div className="text-center p-3 bg-blue-100/60 rounded-lg border border-blue-200">
            <div className="text-xl font-bold text-blue-700">🔵</div>
            <div className="text-lg font-bold text-blue-800">{distribution.long}</div>
            <div className="text-xs text-blue-700">Long</div>
          </div>
          <div className="text-center p-3 bg-gray-100/60 rounded-lg border border-gray-200">
            <div className="text-xl font-bold text-gray-700">⚪</div>
            <div className="text-lg font-bold text-gray-800">{distribution.recovery}</div>
            <div className="text-xs text-gray-700">Recovery</div>
          </div>
          <div className="text-center p-3 bg-purple-100/60 rounded-lg border border-purple-200">
            <div className="text-xl font-bold text-purple-700">🟣</div>
            <div className="text-lg font-bold text-purple-800">{distribution.race}</div>
            <div className="text-xs text-purple-700">Race</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-white/60 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-green-600">{easyPercentage}%</div>
            <div className="text-xs text-gray-700">Easy Runs</div>
            <div className="text-xs text-gray-500">Target: 70-80%</div>
          </div>
          <div className="text-center p-3 bg-white/60 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-orange-600">{hardPercentage}%</div>
            <div className="text-xs text-gray-700">Hard Runs</div>
            <div className="text-xs text-gray-500">Target: 15-25%</div>
          </div>
          <div className="text-center p-3 bg-white/60 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">{Math.round(((distribution.long) / totalTagged) * 100)}%</div>
            <div className="text-xs text-gray-700">Long Runs</div>
            <div className="text-xs text-gray-500">Target: 5-15%</div>
          </div>
        </div>
        
        <div className={`p-3 rounded-lg border ${
          balance.color === 'green' ? 'bg-green-100/50 border-green-200' :
          balance.color === 'blue' ? 'bg-blue-100/50 border-blue-200' :
          balance.color === 'red' ? 'bg-red-100/50 border-red-200' :
          balance.color === 'orange' ? 'bg-orange-100/50 border-orange-200' :
          balance.color === 'yellow' ? 'bg-yellow-100/50 border-yellow-200' :
          'bg-gray-100/50 border-gray-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Award className={`h-4 w-4 ${
              balance.color === 'green' ? 'text-green-600' :
              balance.color === 'blue' ? 'text-blue-600' :
              balance.color === 'red' ? 'text-red-600' :
              balance.color === 'orange' ? 'text-orange-600' :
              balance.color === 'yellow' ? 'text-yellow-600' :
              'text-gray-600'
            }`} />
            <span className={`font-medium ${
              balance.color === 'green' ? 'text-green-800' :
              balance.color === 'blue' ? 'text-blue-800' :
              balance.color === 'red' ? 'text-red-800' :
              balance.color === 'orange' ? 'text-orange-800' :
              balance.color === 'yellow' ? 'text-yellow-800' :
              'text-gray-800'
            }`}>
              Training Balance: {balance.score.charAt(0).toUpperCase() + balance.score.slice(1)}
            </span>
          </div>
          <p className={`text-sm ${
            balance.color === 'green' ? 'text-green-700' :
            balance.color === 'blue' ? 'text-blue-700' :
            balance.color === 'red' ? 'text-red-700' :
            balance.color === 'orange' ? 'text-orange-700' :
            balance.color === 'yellow' ? 'text-yellow-700' :
            'text-gray-700'
          }`}>
            {balance.message}
          </p>
          
          {balance.score === 'too-hard' && (
            <div className="mt-2 text-xs text-red-600">
              <strong>Training Tip:</strong> Most of your runs (70-80%) should be at an easy, conversational pace to build your aerobic base effectively.
            </div>
          )}
          
          {balance.score === 'excellent' && (
            <div className="mt-2 text-xs text-green-600">
              <strong>Excellent!</strong> You're following the proven 80/20 training principle used by elite athletes.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const ActivityJam = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isTagging, setIsTagging] = useState(false);

  // Chart refs
  const caloriesChartRef = useRef<HTMLCanvasElement>(null);
  const distanceChartRef = useRef<HTMLCanvasElement>(null);
  const weightTrainingChartRef = useRef<HTMLCanvasElement>(null);
  const heartRateRunsChartRef = useRef<HTMLCanvasElement>(null);

  // Chart instances
  const chartInstances = useRef<{ [key: string]: Chart }>({});

  const isRunActivity = (activityType: string): boolean => {
    const runTypes = ['run', 'virtualrun', 'treadmill', 'trail'];
    return runTypes.some(type => 
      activityType.toLowerCase().includes(type.toLowerCase())
    );
  };

  // Handle run tagging with Firestore storage
  const handleTagRun = async (activityId: string, runType: string) => {
    setIsTagging(true);
    try {
      console.log(`🏷️ Tagging run ${activityId} as ${runType}`);
      
      const response = await fetch('/api/tag-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activityId,
          runType,
          userId: 'mihir_jain'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to tag run');
      }
      
      const result = await response.json();
      console.log('✅ Run tagged successfully and stored in Firestore:', result);
      
      // Update local state immediately
      setActivities(prev => 
        prev.map(activity => 
          activity.id === activityId 
            ? { 
                ...activity, 
                runType, 
                taggedAt: new Date().toISOString(),
                userOverride: result.activityInfo?.userOverride || false
              }
            : activity
        )
      );
      
      // Recreate charts with updated data
      setTimeout(() => {
        const updatedActivities = activities.map(activity => 
          activity.id === activityId 
            ? { ...activity, runType, taggedAt: new Date().toISOString() }
            : activity
        );
        createCharts(updatedActivities);
      }, 100);
      
    } catch (error) {
      console.error('❌ Error tagging run:', error);
      alert(`Failed to tag run: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTagging(false);
    }
  };

  // Process activities data for charts
  const processChartData = (activities: ActivityData[]) => {
    const sortedActivities = [...activities].sort((a, b) => 
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    const dailyData = new Map();

    sortedActivities.forEach(activity => {
      const date = activity.start_date.split('T')[0];
      
      if (!dailyData.has(date)) {
        dailyData.set(date, {
          calories: 0,
          distance: 0,
          weightTrainingTime: 0,
          runHeartRateCount: 0,
          totalRunHeartRate: 0
        });
      }

      const dayData = dailyData.get(date);
      
      dayData.calories += activity.calories || 0;
      dayData.distance += activity.distance || 0;
      
      if (activity.type?.toLowerCase().includes('weight') || 
          activity.type?.toLowerCase().includes('strength')) {
        dayData.weightTrainingTime += Math.round(activity.moving_time / 60);
      }

      if (activity.is_run_activity && activity.has_heartrate && activity.average_heartrate) {
        dayData.totalRunHeartRate += activity.average_heartrate;
        dayData.runHeartRateCount += 1;
      }
    });

    const dates = Array.from(dailyData.keys()).sort();
    const labels = dates.map(date => new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }));

    return {
      labels: dates,
      displayLabels: labels,
      calories: dates.map(date => dailyData.get(date).calories),
      distance: dates.map(date => Math.round(dailyData.get(date).distance * 10) / 10),
      weightTraining: dates.map(date => dailyData.get(date).weightTrainingTime),
      runHeartRate: dates.map(date => {
        const dayData = dailyData.get(date);
        return dayData.runHeartRateCount > 0 ? Math.round(dayData.totalRunHeartRate / dayData.runHeartRateCount) : 0;
      })
    };
  };

  // Destroy existing charts
  const destroyCharts = () => {
    Object.values(chartInstances.current).forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    chartInstances.current = {};
  };

  // Create calories chart
  const createCaloriesChart = (chartData: any) => {
    if (!caloriesChartRef.current) return;

    const ctx = caloriesChartRef.current.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
    gradient.addColorStop(1, 'rgba(245, 158, 11, 0.1)');

    chartInstances.current.calories = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Calories Burned',
          data: chartData.calories,
          borderColor: 'rgba(245, 158, 11, 1)',
          backgroundColor: gradient,
          borderWidth: 3,
fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'rgba(245, 158, 11, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#374151',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => `${context.parsed.y} calories`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              maxTicksLimit: 6,
              color: '#6b7280'
            }
          },
          y: {
            grid: { color: 'rgba(156, 163, 175, 0.2)' },
            border: { display: false },
            beginAtZero: true,
            ticks: { color: '#6b7280' }
          }
        }
      }
    });
  };

  // Create distance chart
  const createDistanceChart = (chartData: any) => {
    if (!distanceChartRef.current) return;

    const ctx = distanceChartRef.current.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.8)');

    chartInstances.current.distance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Distance (km)',
          data: chartData.distance,
          backgroundColor: gradient,
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#374151',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => `${context.parsed.y} km`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              maxTicksLimit: 6,
              color: '#6b7280'
            }
          },
          y: {
            grid: { color: 'rgba(156, 163, 175, 0.2)' },
            border: { display: false },
            beginAtZero: true,
            ticks: { color: '#6b7280' }
          }
        }
      }
    });
  };

  // Create weight training chart
  const createWeightTrainingChart = (chartData: any) => {
    if (!weightTrainingChartRef.current) return;

    const ctx = weightTrainingChartRef.current.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.8)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.1)');

    chartInstances.current.weightTraining = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Weight Training (minutes)',
          data: chartData.weightTraining,
          borderColor: 'rgba(139, 92, 246, 1)',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'rgba(139, 92, 246, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#374151',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => `${context.parsed.y} minutes`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              maxTicksLimit: 6,
              color: '#6b7280'
            }
          },
          y: {
            grid: { color: 'rgba(156, 163, 175, 0.2)' },
            border: { display: false },
            beginAtZero: true,
            ticks: { color: '#6b7280' }
          }
        }
      }
    });
  };

  // Create run heart rate chart
  const createRunHeartRateChart = (chartData: any) => {
    if (!heartRateRunsChartRef.current) return;

    const ctx = heartRateRunsChartRef.current.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.1)');

    chartInstances.current.runHeartRate = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Run Heart Rate (bpm)',
          data: chartData.runHeartRate,
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'rgba(239, 68, 68, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#374151',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => `${context.parsed.y} bpm (runs only)`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              maxTicksLimit: 6,
              color: '#6b7280'
            }
          },
          y: {
            grid: { color: 'rgba(156, 163, 175, 0.2)' },
            border: { display: false },
            beginAtZero: false,
            ticks: { color: '#6b7280' }
          }
        }
      }
    });
  };

  // Create all charts
  const createCharts = (activities: ActivityData[]) => {
    if (activities.length === 0) return;

    destroyCharts();
    
    const chartData = processChartData(activities);
    
    console.log('📊 Creating charts with run tagging data:', {
      totalDays: chartData.labels.length,
      totalCalories: chartData.calories.reduce((a, b) => a + b, 0),
      totalDistance: chartData.distance.reduce((a, b) => a + b, 0),
      totalWeightTraining: chartData.weightTraining.reduce((a, b) => a + b, 0),
      runHeartRateDays: chartData.runHeartRate.filter(hr => hr > 0).length,
      taggedRuns: activities.filter(a => a.is_run_activity && a.runType).length,
      totalRuns: activities.filter(a => a.is_run_activity).length
    });

    setTimeout(() => {
      createCaloriesChart(chartData);
      createDistanceChart(chartData);
      createWeightTrainingChart(chartData);
      createRunHeartRateChart(chartData);
    }, 100);
  };

  // Fetch activities with run tagging support
  const fetchActivities = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');
      
      const params = new URLSearchParams({
        days: '30',
        userId: 'mihir_jain'
      });
      
      if (forceRefresh) {
        params.set('refresh', 'true');
        params.set('timestamp', Date.now().toString());
      }
      
      const response = await fetch(`/api/strava?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch activities: ${response.status}`);
      }

      const data = await response.json();
      
      const processedActivities = data.map((activity: any) => {
        const activityType = activity.type || 'Activity';
        const isRun = isRunActivity(activityType);

        return {
          id: activity.id?.toString() || Math.random().toString(),
          name: activity.name || 'Unnamed Activity',
          type: activityType,
          start_date: activity.start_date,
          distance: typeof activity.distance === 'number' 
            ? activity.distance 
            : (activity.distance || 0) / 1000,
          moving_time: activity.moving_time || activity.duration * 60 || 0,
          total_elevation_gain: activity.total_elevation_gain || activity.elevation_gain || 0,
          average_speed: activity.average_speed || 0,
          max_speed: activity.max_speed || 0,
          has_heartrate: activity.has_heartrate || false,
          average_heartrate: activity.average_heartrate || activity.heart_rate,
          max_heartrate: activity.max_heartrate,
          calories: activity.calories || 0,
          is_run_activity: isRun,
          runType: activity.runType || null,
          taggedAt: activity.taggedAt || null,
          userOverride: activity.userOverride || false,
          autoSuggestion: activity.originalSuggestion || null
        };
      });

      const sortedActivities = processedActivities.sort((a: ActivityData, b: ActivityData) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

      console.log('🏃 Enhanced activity processing with run tagging:', {
        totalActivities: sortedActivities.length,
        runActivities: sortedActivities.filter(a => a.is_run_activity).length,
        taggedRuns: sortedActivities.filter(a => a.is_run_activity && a.runType).length,
        untaggedRuns: sortedActivities.filter(a => a.is_run_activity && !a.runType).length,
        storedInFirestore: 'Yes - tagged runs saved to Firestore'
      });

      setActivities(sortedActivities);
      setLastUpdate(new Date().toLocaleTimeString());
      createCharts(sortedActivities);

    } catch (error) {
      console.error('❌ Error fetching activities:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch activities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await fetchActivities(true);
  };

  useEffect(() => {
    fetchActivities(false);
    
    return () => {
      destroyCharts();
    };
  }, []);

  // Helper functions
  const formatDistance = (distance: number) => {
    if (distance === 0) return '0.00';
    if (distance < 0.1) return distance.toFixed(3);
    return distance.toFixed(2);
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatPace = (distance: number, time: number) => {
    if (distance === 0 || time === 0) return 'N/A';
    const paceSeconds = time / distance;
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex flex-col">
        <header className="pt-8 px-6 md:px-12">
          <div className="flex items-center justify-between mb-6">
            <Button onClick={() => navigate('/')} variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Try Again
            </Button>
          </div>
        </header>
        
        <main className="flex-grow flex items-center justify-center px-6">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <div className="text-red-500 mb-4">⚠️</div>
              <h3 className="text-lg font-semibold mb-2">Unable to Load Activities</h3>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <Button onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Retrying...' : 'Try Again'}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-red-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-orange-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-red-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => navigate('/')} variant="ghost" className="hover:bg-white/20">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <Button 
            onClick={handleRefresh}
            variant="outline"
            disabled={refreshing}
            className="hover:bg-white/20"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent">
            🏃‍♂️ Enhanced Activity Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your training activities with intelligent run classification
          </p>
          {lastUpdate && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <Badge variant="secondary" className="text-xs">Last updated: {lastUpdate}</Badge>
              <Badge variant="secondary" className="text-xs">Training Ready</Badge>
              <Badge variant="secondary" className="text-xs">
                {activities.filter(a => a.is_run_activity && a.runType).length}/{activities.filter(a => a.is_run_activity).length} runs tagged
              </Badge>
              <Badge variant="outline" className="text-xs border-green-300 text-green-600">
                Firestore Storage
              </Badge>
            </div>
          )}
        </div>
      </header>
      
      <main className="relative z-10 px-6 md:px-12 py-8">
        {loading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-white/80 backdrop-blur-sm border border-white/20">
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20">
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-lg">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2 mb-3" />
                      <div className="grid grid-cols-3 gap-2">
                        {[...Array(6)].map((_, j) => (
                          <Skeleton key={j} className="h-16 w-full" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Calendar className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Recent Activities</h3>
            <p className="text-gray-600 mb-4">
              No activities found in the last 30 days. Try refreshing or check your Strava connection.
            </p>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Activities'}
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <RunTaggingSection 
                activities={activities}
                onTagRun={handleTagRun}
                isTagging={isTagging}
              />
            </section>

            <section>
              <div className="flex items-center mb-6">
                <BarChart3 className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Activity Trends</h2>
                <Badge variant="outline" className="ml-3 text-xs">
                  Enhanced with run classification
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Zap className="h-5 w-5 mr-2 text-green-500" />
                      Calories Burned
                    </CardTitle>
                    <p className="text-xs text-gray-600">Direct from Strava API</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <canvas ref={caloriesChartRef} className="w-full h-full"></canvas>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Activity className="h-5 w-5 mr-2 text-blue-500" />
                      Distance Covered
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <canvas ref={distanceChartRef} className="w-full h-full"></canvas>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Activity className="h-5 w-5 mr-2 text-purple-500" />
                      Weight Training Time
                    </CardTitle>
                    <p className="text-xs text-gray-600">Essential for injury prevention</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <canvas ref={weightTrainingChartRef} className="w-full h-full"></canvas>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Heart className="h-5 w-5 mr-2 text-red-500" />
                      Run Heart Rate
                    </CardTitle>
                    <p className="text-xs text-gray-600">Only from running activities</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <canvas ref={heartRateRunsChartRef} className="w-full h-full"></canvas>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section>
              <div className="flex items-center mb-6">
                <Calendar className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Recent Activities</h2>
                <Badge variant="outline" className="ml-3 text-xs">
                  With run type classification
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activities.map((activity) => (
                  <Card key={activity.id} className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-all duration-200">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">
                          {activity.name}
                        </CardTitle>
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className="ml-2 shrink-0">
                            {activity.type}
                          </Badge>
                          {activity.is_run_activity && (
                            <Badge variant="outline" className="ml-2 shrink-0 text-xs border-red-300 text-red-600">
                              Run
                            </Badge>
                          )}
                          {activity.runType && (
                            <Badge variant="default" className="ml-2 shrink-0 text-xs bg-green-100 text-green-800 border-green-300">
                              {activity.runType}
                            </Badge>
                          )}
                          {activity.is_run_activity && !activity.runType && (
                            <Badge variant="outline" className="ml-2 shrink-0 text-xs border-orange-300 text-orange-600">
                              Untagged
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(activity.start_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">
                            {formatDistance(activity.distance)}
                          </div>
                          <div className="text-xs text-gray-600">km</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {formatTime(activity.moving_time)}
                          </div>
                          <div className="text-xs text-gray-600">duration</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Pace:</span>
                          <span className="font-medium">{formatPace(activity.distance, activity.moving_time)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Elevation:</span>
                          <span className="font-medium">{activity.total_elevation_gain}m</span>
                        </div>
                        {activity.is_run_activity && activity.has_heartrate && activity.average_heartrate && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Avg HR:</span>
                            <span className="font-medium flex items-center">
                              <Heart className="h-3 w-3 mr-1 text-red-500" />
                              {activity.average_heartrate} bpm
                            </span>
                          </div>
                        )}
                        {activity.calories && activity.calories > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Calories:</span>
                            <span className="font-medium flex items-center">
                              <Zap className="h-3 w-3 mr-1 text-green-500" />
                              {activity.calories}
                            </span>
                          </div>
                        )}
                        {activity.runType && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Run Type:</span>
                            <span className="font-medium flex items-center">
                              <Tag className="h-3 w-3 mr-1 text-blue-500" />
                              {activity.runType}
                              {activity.userOverride && (
                                <Badge variant="outline" className="ml-1 text-xs border-purple-300 text-purple-600">
                                  Override
                                </Badge>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Quick tag button for untagged runs */}
                      {activity.is_run_activity && !activity.runType && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                            onClick={() => {
                              const suggestion = classifyRun(activity);
                              handleTagRun(activity.id, suggestion.type);
                            }}
                            disabled={isTagging}
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {isTagging ? 'Tagging...' : `Quick Tag as ${classifyRun(activity).type}`}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Enhanced Summary Stats */}
            <section>
              <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                    Training Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-center">
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {activities.filter(a => a.calories && a.calories > 0).length}
                      </div>
                      <div className="text-xs text-gray-600">Activities with calories</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {activities.reduce((sum, a) => sum + (a.calories || 0), 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">Total calories burned</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {activities.filter(a => a.is_run_activity).length}
                      </div>
                      <div className="text-xs text-gray-600">Running activities</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {activities.filter(a => a.is_run_activity && a.runType).length}
                      </div>
                      <div className="text-xs text-gray-600">Tagged runs</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {activities.filter(a => a.is_run_activity && a.has_heartrate).length}
                      </div>
                      <div className="text-xs text-gray-600">Runs with HR data</div>
                    </div>
                  </div>
                  
                  {/* Training Tips */}
                  <div className="mt-6 p-4 bg-white/60 rounded-lg border border-white/30">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4 text-orange-500" />
                      Training Insights
                    </h4>
                    <div className="text-xs text-gray-600 space-y-1">
                      {activities.filter(a => a.is_run_activity && !a.runType).length > 0 && (
                        <p className="text-orange-600">
                          🏷️ Tag your {activities.filter(a => a.is_run_activity && !a.runType).length} untagged runs for better training analysis
                        </p>
                      )}
                      {activities.filter(a => a.is_run_activity && a.runType).length > 3 && (
                        <p className="text-green-600">
                          ✅ Great job tagging your runs! This helps with proper training distribution analysis
                        </p>
                      )}
                      <p>💡 Aim for 70-80% easy runs, 15-25% hard efforts, and 5-15% long runs</p>
                      <p>🏋️ Include 2-3 strength training sessions per week for injury prevention</p>
                      <p>📊 Heart rate data from runs helps determine proper training zones</p>
                      <p>💾 All run tags are automatically saved to Firestore for persistent storage</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </main>
      
      {/* Enhanced Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>📊 Enhanced with intelligent run analysis</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              HR tracking for training zones
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Tag className="h-4 w-4" />
              AI-powered run classification
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>
              {activities.filter(a => a.is_run_activity && a.runType).length}/{activities.filter(a => a.is_run_activity).length} runs classified
            </span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs">Training Ready</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default ActivityJam;


