
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const handleGitHubClick = () => {
    // Replace with your actual GitHub repository URL
    window.open("https://github.com/yourusername/my23-ai", "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-green-400/10 animate-pulse"></div>
      
      {/* Floating elements for visual interest */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-green-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-purple-200/30 rounded-full blur-xl animate-bounce delay-500"></div>
      
      <div className="text-center z-10 max-w-4xl mx-auto px-6">
        {/* Main heading with gradient text */}
        <div className="space-y-6 mb-12">
          <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent animate-fade-in">
            My23.ai
          </h1>
          
          {/* Tagline */}
          <div className="space-y-4">
            <p className="text-2xl md:text-4xl font-light text-gray-700 leading-relaxed animate-slide-up">
              My Health. My Data. My 23.
            </p>
            <p className="text-xl md:text-2xl font-medium text-blue-600 animate-slide-up delay-200">
              Coming Soon
            </p>
          </div>
        </div>
        
        {/* Description */}
        <div className="mb-12 animate-slide-up delay-300">
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Your complete genetic blueprint lives in 23 pairs of chromosomes. 
            Take control of your health journey with AI-powered insights from your personal genomic data.
          </p>
        </div>
        
        {/* GitHub button */}
        <div className="animate-slide-up delay-500">
          <Button 
            onClick={handleGitHubClick}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white px-8 py-4 text-lg font-medium rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <Github className="mr-3 h-5 w-5" />
            View on GitHub
          </Button>
        </div>
        
        {/* Coming soon indicator */}
        <div className="mt-16 animate-slide-up delay-700">
          <div className="inline-flex items-center space-x-2 bg-white/50 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600 font-medium">Stay tuned for updates</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
