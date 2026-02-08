import { useUser } from "@/hooks/use-ussd";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCcw, Wallet, CreditCard, Phone, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserDebugPanelProps {
  phoneNumber: string;
}

export function UserDebugPanel({ phoneNumber }: UserDebugPanelProps) {
  const { data: user, isLoading, refetch, isRefetching } = useUser(phoneNumber);

  return (
    <Card className="p-6 w-full max-w-md bg-white/80 backdrop-blur-sm shadow-xl border-zinc-200/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Simulation Data
          </h3>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            Polling backend state every 2s
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          className={`h-8 w-8 rounded-full ${isRefetching ? 'animate-spin' : ''}`}
        >
          <RefreshCcw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : user ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 transition-all hover:shadow-md hover:border-blue-200">
                <div className="flex items-center gap-2 text-blue-600 mb-1.5">
                  <Wallet className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Balance</span>
                </div>
                <div className="text-xl font-bold text-zinc-900">
                  KES {parseFloat(user.balance).toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-purple-50 border border-purple-100 transition-all hover:shadow-md hover:border-purple-200">
                <div className="flex items-center gap-2 text-purple-600 mb-1.5">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Loan Limit</span>
                </div>
                <div className="text-xl font-bold text-zinc-900">
                  KES {parseFloat(user.loanLimit).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-zinc-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-zinc-500">Active SIM</span>
                  <span className="text-sm font-mono font-bold text-zinc-900">{user.phoneNumber}</span>
                </div>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-2 py-0.5">
                Active
              </Badge>
            </div>
          </>
        ) : (
          <div className="p-6 rounded-xl bg-amber-50 border border-amber-100 text-center">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-amber-900 font-medium">User not found</p>
            <p className="text-xs text-amber-700 mt-1">Run a transaction to initialize user</p>
          </div>
        )}
      </div>
    </Card>
  );
}
