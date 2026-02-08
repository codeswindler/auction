import { useEffect, useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

function useAuthStatus() {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/check", { credentials: "include" });
        const data = await res.json();
        setStatus(data.authenticated === true ? "authenticated" : "unauthenticated");
      } catch {
        setStatus("unauthenticated");
      }
    };

    checkAuth();
  }, []);

  return status;
}

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const status = useAuthStatus();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground">Checking authentication...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Login />;
  }

  return <Component />;
}

function Router() {
  const ProtectedHome = () => <ProtectedRoute component={Home} />;
  const ProtectedAdmin = () => <ProtectedRoute component={Admin} />;

  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/simulator" component={ProtectedHome} />
      <Route path="/admin" component={ProtectedAdmin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
