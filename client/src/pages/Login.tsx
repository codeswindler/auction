import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Users, Moon, Sun } from "lucide-react";
import { GalaxyBackground } from "@/components/GalaxyBackground";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const { toast } = useToast();
  const [, setLocation] = useLocation();

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

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/check", { credentials: "include" });
      const data = await res.json();
      if (data.authenticated === true) {
        setAuthenticated(true);
      } else {
        setAuthenticated(false);
      }
    } catch (error) {
      setAuthenticated(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAuthenticated(true);
        toast({
          title: "Login successful",
          description: "Welcome to LiveAuction!",
        });
      } else {
        toast({
          title: "Login failed",
          description: data.error || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading state
  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative">
        <GalaxyBackground />
        <Card className="p-6 relative z-10">
          <p className="text-foreground">Checking authentication...</p>
        </Card>
      </div>
    );
  }

  // If authenticated, show navigation options
  if (authenticated === true) {
    return (
      <div className="min-h-screen bg-background relative flex items-center justify-center p-6">
        {isDarkMode && <GalaxyBackground />}
        <Card className="p-8 w-full max-w-2xl relative z-10 bg-card/95 backdrop-blur-sm">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to LiveAuction</h1>
                <p className="text-muted-foreground">Select an admin option to continue</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="absolute top-4 right-4"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* USSD Simulator Option */}
              <button
                onClick={() => setLocation("/simulator")}
                className="p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group bg-card"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Smartphone className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground mb-1">USSD Simulator</h3>
                    <p className="text-sm text-muted-foreground">
                      Test and simulate USSD flows for bids and payments
                    </p>
                  </div>
                </div>
              </button>

              {/* Admin Dashboard Option */}
              <button
                onClick={() => setLocation("/admin")}
                className="p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group bg-card"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground mb-1">Admin Dashboard</h3>
                    <p className="text-sm text-muted-foreground">
                      View transactions, analytics, and manage auctions
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="pt-4 border-t border-border">
              <Button
                variant="ghost"
                className="w-full"
                onClick={async () => {
                  await fetch("/api/logout", { method: "POST", credentials: "include" });
                  setAuthenticated(false);
                  setUsername("");
                  setPassword("");
                  toast({
                    title: "Logged out",
                    description: "You have been logged out successfully",
                  });
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Show login form
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {isDarkMode && <GalaxyBackground />}
      
      {/* Header with theme toggle */}
      <div className="absolute top-4 right-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="bg-card/80 backdrop-blur-sm hover:bg-card"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </div>

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="min-h-screen flex items-center justify-center">
          <Card className="p-8 w-full max-w-md bg-card/95 backdrop-blur-sm border-2 border-border shadow-2xl">
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Admin Portal</h2>
                <p className="text-sm text-muted-foreground">
                  Staff login only
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder="Enter your username"
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="bg-background"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

