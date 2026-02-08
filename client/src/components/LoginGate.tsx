import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export function LoginGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const res = await fetch("/api/auth/check", { 
        credentials: "include",
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        console.error('[LoginGate] Auth check failed:', res.status, res.statusText);
        setAuthenticated(false);
        return;
      }
      
      const data = await res.json();
      
      // If session expired, the API will return authenticated: false
      // and we'll redirect to login page
      setAuthenticated(data.authenticated === true);
    } catch (error: any) {
      console.error('[LoginGate] Auth check error:', error);
      // If it's an abort error (timeout), still set to false to allow login
      if (error.name === 'AbortError') {
        console.warn('[LoginGate] Auth check timed out');
      }
      setAuthenticated(false);
    }
  };

  // Show loading state
  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, send user back to login page
  if (authenticated === false) {
    navigate("/");
    return null;
  }

  // Show protected content
  return <>{children}</>;
}

