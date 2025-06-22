
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TallyProvider } from "./context/TallyContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import TallyPage from "./pages/TallyPage";
import SettingsPage from "./pages/SettingsPage";
import HistoryPage from "./pages/HistoryPage";
import HelpPage from "./pages/HelpPage";
import NotFound from "./pages/NotFound";
import "./index.css";

const queryClient = new QueryClient();

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TallyProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <div className="min-h-screen bg-background">
              <Navbar />
              <AnimatePresence mode="wait">
                <Routes>
                  <Route 
                    path="/" 
                    element={
                      <PageWrapper>
                        <TallyPage />
                      </PageWrapper>
                    } 
                  />
                  <Route 
                    path="/settings" 
                    element={
                      <PageWrapper>
                        <SettingsPage />
                      </PageWrapper>
                    } 
                  />
                  <Route 
                    path="/history" 
                    element={
                      <PageWrapper>
                        <HistoryPage />
                      </PageWrapper>
                    } 
                  />
                  <Route 
                    path="/help" 
                    element={
                      <PageWrapper>
                        <HelpPage />
                      </PageWrapper>
                    } 
                  />
                  <Route 
                    path="*" 
                    element={
                      <PageWrapper>
                        <NotFound />
                      </PageWrapper>
                    } 
                  />
                </Routes>
              </AnimatePresence>
            </div>
          </BrowserRouter>
        </TallyProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
