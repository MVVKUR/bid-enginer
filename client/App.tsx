import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuctionProvider } from "@/context/AuctionContext";
import { DemoSimulationProvider } from "@/context/DemoSimulationContext";
import { AuthProvider, useAuth, UserRole } from "@/context/AuthContext";
import Layout from "@/components/layout/Layout";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import AuctionRoom from "./pages/AuctionRoom";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function RequireAuth({ children, role }: { children: React.ReactNode; role?: UserRole }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AuctionProvider>
            <DemoSimulationProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <Layout><Index /></Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="/auction/:auctionId"
                element={
                  <RequireAuth>
                    <Layout><AuctionRoom /></Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireAuth role="admin">
                    <Layout><Admin /></Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="*"
                element={
                  <RequireAuth>
                    <Layout><NotFound /></Layout>
                  </RequireAuth>
                }
              />
            </Routes>
            </DemoSimulationProvider>
          </AuctionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
