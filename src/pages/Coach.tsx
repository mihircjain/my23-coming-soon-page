
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, User, Activity, TrendingUp, Heart, Zap, Target, Send } from 'lucide-react';
import useStravaData from '@/hooks/useStrava';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'coach';
  timestamp: Date;
}

interface QuickStart {
  title: string;
  description: string;
  prompt: string;
  icon: React.ReactNode;
  color: string;
}

const quickStarts: QuickStart[] = [
  {
    title: "Training Plan",
    description: "Get a personalized training schedule",
    prompt: "Create a 4-week training plan based on my recent activities",
    icon: <Target className="h-4 w-4" />,
    color: "bg-blue-500"
  },
  {
    title: "Performance Analysis",
    description: "Analyze your recent workouts",
    prompt: "Analyze my recent running performance and suggest improvements",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "bg-green-500"
  },
  {
    title: "Recovery Tips",
    description: "Get recovery recommendations",
    prompt: "What should I focus on for recovery based on my training load?",
    icon: <Heart className="h-4 w-4" />,
    color: "bg-red-500"
  },
  {
    title: "Nutrition Advice",
    description: "Optimize your nutrition",
    prompt: "What should I eat before and after my workouts?",
    icon: <Zap className="h-4 w-4" />,
    color: "bg-orange-500"
  }
];

export default function Coach() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your AI running coach. I can help you with training plans, performance analysis, recovery strategies, and nutrition advice. What would you like to work on today?",
      sender: 'coach',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Mock Strava data - replace with actual hook when available
  const mockStats = {
    weeklyDistance: 45.2,
    weeklyActivities: 5,
    avgPace: "7:32",
    weeklyElevation: 1250
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const coachResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: `Thanks for your question: "${content}". As your AI coach, I'd recommend focusing on consistency and gradual progression. Based on typical training principles, here are some suggestions tailored to your inquiry...`,
        sender: 'coach',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, coachResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const handleQuickStart = (prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-indigo-200/20 to-pink-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            AI Running Coach
          </h1>
          <p className="text-gray-600 text-lg">Your personal training companion powered by AI</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Left Column - Chat Interface */}
          <div className="lg:col-span-2 flex flex-col">
            {/* Quick Start Section - Compressed */}
            <Card className="mb-4 bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <Zap className="mr-2 h-5 w-5 text-blue-500" />
                  Quick Start
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {quickStarts.map((item, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      onClick={() => handleQuickStart(item.prompt)}
                      className="h-auto p-3 flex flex-col items-center text-center hover:shadow-md transition-all bg-white/50 hover:bg-white/80"
                    >
                      <div className={`p-2 rounded-lg ${item.color} text-white mb-2`}>
                        {item.icon}
                      </div>
                      <span className="text-xs font-medium leading-tight">{item.title}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chat Messages - Expandable */}
            <Card className="flex-1 flex flex-col bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <Bot className="mr-2 h-5 w-5 text-green-500" />
                  Chat with Your Coach
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Messages Container - Dynamic Height */}
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-4 rounded-lg ${
                          message.sender === 'user'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white ml-4'
                            : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 mr-4'
                        } shadow-md`}
                      >
                        <div className="flex items-start space-x-2">
                          {message.sender === 'coach' && (
                            <Bot className="h-5 w-5 mt-0.5 text-blue-500 flex-shrink-0" />
                          )}
                          {message.sender === 'user' && (
                            <User className="h-5 w-5 mt-0.5 text-blue-200 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm leading-relaxed">{message.content}</p>
                            <p className="text-xs opacity-70 mt-2">
                              {message.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gradient-to-r from-gray-100 to-gray-200 p-4 rounded-lg mr-4 shadow-md">
                        <div className="flex items-center space-x-2">
                          <Bot className="h-5 w-5 text-blue-500" />
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area - Fixed at Bottom */}
                <div className="flex space-x-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask your coach anything..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(inputValue);
                      }
                    }}
                    className="flex-1 bg-white/70 border-white/30"
                    disabled={isLoading}
                  />
                  <Button 
                    onClick={() => handleSendMessage(inputValue)}
                    disabled={isLoading || !inputValue.trim()}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Stats & Analytics */}
          <div className="space-y-4">
            <Tabs defaultValue="stats" className="h-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/80 backdrop-blur-sm">
                <TabsTrigger value="stats">Stats</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>
              
              <TabsContent value="stats" className="space-y-4 mt-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-sm border border-white/20 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold flex items-center">
                      <Activity className="mr-2 h-5 w-5 text-blue-500" />
                      Weekly Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-white/60 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{mockStats.weeklyDistance}</div>
                        <div className="text-sm text-gray-600">Miles</div>
                      </div>
                      <div className="text-center p-3 bg-white/60 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{mockStats.weeklyActivities}</div>
                        <div className="text-sm text-gray-600">Runs</div>
                      </div>
                      <div className="text-center p-3 bg-white/60 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{mockStats.avgPace}</div>
                        <div className="text-sm text-gray-600">Avg Pace</div>
                      </div>
                      <div className="text-center p-3 bg-white/60 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">{mockStats.weeklyElevation}</div>
                        <div className="text-sm text-gray-600">Elevation</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-blue-500/10 backdrop-blur-sm border border-white/20 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold flex items-center">
                      <TrendingUp className="mr-2 h-5 w-5 text-green-500" />
                      Training Load
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">This Week</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">Moderate</Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                      </div>
                      <div className="text-xs text-gray-500">65% of target load</div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="insights" className="space-y-4 mt-4">
                <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm border border-white/20 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold flex items-center">
                      <Heart className="mr-2 h-5 w-5 text-red-500" />
                      Recovery Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600 mb-2">Good</div>
                      <p className="text-sm text-gray-600">Ready for moderate training</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur-sm border border-white/20 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold">Key Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="p-3 bg-white/60 rounded-lg">
                        <p className="text-sm font-medium text-gray-800">Increase long run distance</p>
                        <p className="text-xs text-gray-600">Add 0.5 miles to weekend run</p>
                      </div>
                      <div className="p-3 bg-white/60 rounded-lg">
                        <p className="text-sm font-medium text-gray-800">Focus on tempo work</p>
                        <p className="text-xs text-gray-600">2x weekly tempo sessions</p>
                      </div>
                      <div className="p-3 bg-white/60 rounded-lg">
                        <p className="text-sm font-medium text-gray-800">Prioritize recovery</p>
                        <p className="text-xs text-gray-600">Include rest day after hard sessions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
