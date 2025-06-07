import { Button } from "@/components/ui/button";
import { MessageCircle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LetsJamButtonProps {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
}

const LetsJamButton = ({ 
  className = "", 
  variant = "default",
  size = "default" 
}: LetsJamButtonProps) => {
  const navigate = useNavigate();

  return (
    <div className={`text-center ${className}`}>
      <Button
        onClick={() => navigate('/lets-jam')}
        variant={variant}
        size={size}
        className={`
          ${variant === "default" 
            ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl" 
            : "border-blue-600 text-blue-600 hover:bg-blue-50"
          } 
          transition-all duration-300 transform hover:scale-105
          ${size === "lg" ? "px-8 py-6 text-lg" : size === "sm" ? "px-4 py-2 text-sm" : "px-6 py-3"}
        `}
      >
        <MessageCircle className={`${size === "lg" ? "mr-3 h-6 w-6" : "mr-2 h-5 w-5"}`} />
        Chat with AI Health Assistant
        <Sparkles className={`${size === "lg" ? "ml-3 h-6 w-6" : "ml-2 h-5 w-5"}`} />
      </Button>
      <p className={`
        mt-2 text-gray-600
        ${size === "lg" ? "text-base" : size === "sm" ? "text-xs" : "text-sm"}
      `}>
        AI-powered health insights based on your personal data
      </p>
    </div>
  );
};

export default LetsJamButton;
