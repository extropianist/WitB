import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

export default function GoogleAuth() {
  const { login, isLoggingIn } = useAuth();
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch Google Client ID from backend
    const fetchConfig = async () => {
      try {
        const response = await apiRequest("GET", "/api/auth/config");
        const config = await response.json();
        setGoogleClientId(config.googleClientId);
      } catch (error) {
        console.error("Failed to fetch auth config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    if (!googleClientId || isLoading) return;

    // Load Google Identity Services
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
        });
      }
    };

    return () => {
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [googleClientId, isLoading]);

  const handleCredentialResponse = (response: any) => {
    if (response.credential) {
      login(response.credential);
    }
  };

  const handleGoogleSignIn = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <i className="fas fa-boxes text-primary-foreground text-lg"></i>
            </div>
            <CardTitle className="text-2xl font-semibold">Inventory Manager</CardTitle>
          </div>
          <p className="text-muted-foreground">
            Sign in with Google to access your inventory
          </p>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoggingIn || isLoading || !googleClientId}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            data-testid="button-google-signin"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Loading...
              </>
            ) : isLoggingIn ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Signing in...
              </>
            ) : (
              <>
                <i className="fab fa-google mr-2"></i>
                Sign in with Google
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
