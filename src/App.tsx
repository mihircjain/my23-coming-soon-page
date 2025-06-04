import { Toaster } from "@/components/ui/toaster";
import CurrentJam from "./pages/ActivityJam";
import NutritionJam from "./pages/NutritionJam";
import BodyJam from "./pages/BodyJam";
import BloodMarkersJam from "./pages/BloodMarkersJam";
import OverallJam from "./pages/OverallJam";
import LetsJam from "./pages/LetsJam";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/activity-jam" element={<CurrentJam />} />
          <Route path="/nutrition-jam" element={<NutritionJam />} />
          <Route path="/body-jam" element={<BodyJam />} />
          <Route path="/blood-markers-jam" element={<BloodMarkersJam />} />
          <Route path="/overall-jam" element={<OverallJam />} />
          <Route path="/lets-jam" element={<LetsJam />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
