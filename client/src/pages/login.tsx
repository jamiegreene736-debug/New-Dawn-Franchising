import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Lock, Shield } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.role === "admin") {
        setLocation("/crm");
      } else if (data.role === "broker") {
        queryClient.invalidateQueries({ queryKey: ["/api/brokers/me"] });
        setLocation("/brokers");
      }
    },
    onError: (err: Error) => {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div data-testid="page-login" className="bg-gray-50 flex flex-col items-center justify-center min-h-[calc(100vh-5rem)] py-8 px-4">
      <div className="w-full max-w-md">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[hsl(var(--primary))] mb-4">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Login</h1>
          <p className="mt-1 text-sm text-gray-500">New Dawn Franchising — Internal Access</p>
        </div>

        <Card className="nh-surface border-card-border/80 p-6 shadow-sm">
          {/* Internal-only notice */}
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-6">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Restricted access.</strong> This portal is for authorised New Dawn Franchising staff and CRM administrators only.
            </p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(); }}
          >
            <div>
              <Label htmlFor="login-email">Email</Label>
              <Input
                data-testid="input-login-email"
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@newdawnfranchising.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="login-password">Password</Label>
              <Input
                data-testid="input-login-password"
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              data-testid="button-login"
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign in to CRM"}
            </Button>
          </form>
        </Card>

      </div>
    </div>
  );
}
