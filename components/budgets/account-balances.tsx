"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Landmark, CreditCard, Wallet, PiggyBank, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAccountBalances, type AccountBalance } from "@/lib/modules/plaid/actions";

interface AccountBalancesProps {
  currency?: string;
}

const accountTypeIcons: Record<string, typeof Landmark> = {
  depository: Landmark,
  credit: CreditCard,
  loan: Wallet,
  investment: PiggyBank,
};

export function AccountBalances({ currency = "USD" }: AccountBalancesProps) {
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const fetchBalances = async () => {
    startTransition(async () => {
      const result = await getAccountBalances();
      if (result.success) {
        setBalances(result.balances || []);
        setTotalBalance(result.totalBalance || 0);
        setError(null);
      } else {
        setError(result.error || "Failed to load balances");
      }
      setIsLoading(false);
    });
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium">Account Balances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (balances.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium">Account Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Link className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No linked accounts</p>
            <p className="text-xs mt-1">
              Connect a bank in Settings to see balances
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Account Balances</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchBalances}
          disabled={isPending}
        >
          <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="text-sm text-destructive mb-2">{error}</div>
        )}

        {/* Individual Accounts */}
        {balances.map((account) => {
          const Icon = accountTypeIcons[account.accountType || "depository"] || Landmark;
          const isCredit = account.accountType === "credit";

          return (
            <div
              key={account.accountId}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium text-sm">
                    {account.accountName}
                    {account.accountMask && (
                      <span className="text-muted-foreground ml-1">
                        ••{account.accountMask}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {account.institutionName}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    "font-medium",
                    isCredit && account.currentBalance && account.currentBalance > 0
                      ? "text-red-600"
                      : ""
                  )}
                >
                  {isCredit && account.currentBalance && account.currentBalance > 0
                    ? `-${formatCurrency(account.currentBalance)}`
                    : formatCurrency(account.currentBalance)}
                </div>
                {account.availableBalance !== null &&
                  account.availableBalance !== account.currentBalance && (
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(account.availableBalance)} available
                    </div>
                  )}
              </div>
            </div>
          );
        })}

        {/* Total Net Worth */}
        <div className="flex items-center justify-between pt-3 border-t mt-3">
          <div className="font-medium">Net Worth</div>
          <div
            className={cn(
              "text-xl font-bold",
              totalBalance >= 0 ? "text-green-600" : "text-red-600"
            )}
          >
            {formatCurrency(totalBalance)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

