import { PhoneSimulator } from "@/components/PhoneSimulator";
import { CampaignManager } from "@/components/CampaignManager";
import { LoginGate } from "@/components/LoginGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@shared/routes";
import { Github, Smartphone, BarChart3, ArrowLeft, Moon, Sun } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { GalaxyBackground } from "@/components/GalaxyBackground";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const SIMULATED_PHONE_NUMBER = "0700000000";
  const [, navigate] = useLocation();
  const [showMenuModular, setShowMenuModular] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const { data: campaigns = [] } = useQuery({
    queryKey: [api.admin.campaigns.list.path],
    queryFn: async () => {
      const response = await fetch(`${api.admin.campaigns.list.path}?include_inactive=true`);
      if (!response.ok) {
        throw new Error(`Failed to fetch campaigns: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30000,
  });

  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const activeCampaigns = safeCampaigns.filter((campaign: any) => campaign && campaign.isActive);
  const inactiveCampaigns = safeCampaigns.filter((campaign: any) => campaign && !campaign.isActive);

  return (
    <LoginGate>
      <div className="min-h-screen bg-background relative flex flex-col">
        {isDarkMode && <GalaxyBackground />}
      {/* Header */}
      <header className="w-full py-6 px-6 md:px-12 border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-10 relative">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-700">
                USSD Simulator
              </h1>
              <p className="text-xs text-muted-foreground font-medium tracking-wide">
                LIVEAUCTION - PROTOTYPE v1.0
              </p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={toggleDarkMode}
              className="gap-2"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Badge variant="secondary" className="px-3 py-1 font-mono text-xs">
              *123#
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4" />
              Main Menu
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => navigate("/admin")}
            >
              <BarChart3 className="w-4 h-4" />
              Admin Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-12 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24">
        
        {/* Left Side - Instructions & Debug */}
        <div className="flex-1 w-full max-w-2xl space-y-8 order-2 lg:order-1">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground leading-tight">
              Test your campaign USSD flow instantly.
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Simulate selecting active campaign items and triggering MPesa payments. 
              Analytics update in real-time on the admin dashboard.
            </p>
          </div>

          <div className="grid gap-4">
             <div className="p-4 rounded-lg bg-card border border-border shadow-sm">
                <h4 className="font-semibold text-sm mb-2 text-foreground">How to test:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground marker:text-muted-foreground">
                  <li>Dial <span className="font-mono font-bold text-foreground bg-muted px-1 py-0.5 rounded">*123#</span> on the simulator</li>
                  <li>Select one of the active campaign options</li>
                  <li>Review transactions and fees in the admin dashboard</li>
                  <li>Toast notifications simulate STK pushes</li>
                </ol>
             </div>
          </div>

          <Card className="p-4">
            <Tabs defaultValue="active" onValueChange={() => setShowMenuModular(true)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active">Active ({activeCampaigns.length})</TabsTrigger>
                <TabsTrigger value="inactive">Inactive ({inactiveCampaigns.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="mt-4 space-y-2">
                {activeCampaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active campaigns.</p>
                ) : (
                  activeCampaigns.map((campaign: any) => (
                    <div key={campaign.id} className="text-sm text-foreground">{campaign.name}</div>
                  ))
                )}
              </TabsContent>
              <TabsContent value="inactive" className="mt-4 space-y-2">
                {inactiveCampaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No inactive campaigns.</p>
                ) : (
                  inactiveCampaigns.map((campaign: any) => (
                    <div key={campaign.id} className="text-sm text-foreground">{campaign.name}</div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </Card>

        </div>

        {/* Right Side - Phone Simulator */}
        <div className="flex-none order-1 lg:order-2">
          <div className="relative">
             {/* Decorative blob behind phone */}
             <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 to-purple-500/20 rounded-[4rem] blur-2xl -z-10" />
             <PhoneSimulator phoneNumber={SIMULATED_PHONE_NUMBER} />
          </div>
        </div>

      </main>

      {showMenuModular && (
        <section className="w-full max-w-7xl mx-auto px-6 md:px-12 pb-12">
          <CampaignManager />
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-muted-foreground font-medium relative">
        <p>&copy; 2024 LiveAuction. All systems operational.</p>
      </footer>
      </div>
    </LoginGate>
  );
}
