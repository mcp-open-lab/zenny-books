"use client";

import { useState, useCallback, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  createLinkToken,
  createUpdateLinkToken,
  exchangePublicToken,
  getLinkedAccounts,
  unlinkAccount,
  syncAccount,
  handleReconnectSuccess,
} from "@/app/actions/plaid";
import {
  Building2,
  CreditCard,
  RefreshCw,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Link2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type LinkedAccount = {
  id: string;
  institutionName: string | null;
  accountName: string | null;
  accountMask: string | null;
  accountType: string | null;
  accountSubtype: string | null;
  lastSyncedAt: Date | null;
  syncStatus: string | null;
  syncErrorMessage: string | null;
  createdAt: Date;
};

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Never";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getAccountIcon(type: string | null) {
  switch (type) {
    case "credit":
      return <CreditCard className="h-4 w-4" />;
    default:
      return <Building2 className="h-4 w-4" />;
  }
}

function getSyncStatusBadge(status: string | null, errorMessage: string | null) {
  switch (status) {
    case "active":
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      );
    case "syncing":
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Syncing
        </Badge>
      );
    case "error":
      return (
        <Badge variant="outline" className="text-red-600 border-red-600" title={errorMessage || undefined}>
          <AlertCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    case "pending_expiration":
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-600" title={errorMessage || undefined}>
          <AlertCircle className="h-3 w-3 mr-1" />
          Expiring Soon
        </Badge>
      );
    case "disconnected":
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          <AlertCircle className="h-3 w-3 mr-1" />
          Disconnected
        </Badge>
      );
    default:
      return null;
  }
}

function needsReconnect(status: string | null): boolean {
  return status === "error" || status === "pending_expiration" || status === "disconnected";
}

export function LinkedAccounts() {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [reconnectingAccountId, setReconnectingAccountId] = useState<string | null>(null);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [unlinkingAccountId, setUnlinkingAccountId] = useState<string | null>(null);
  const [accountToUnlink, setAccountToUnlink] = useState<LinkedAccount | null>(null);

  // Fetch accounts on mount
  const fetchAccounts = useCallback(async () => {
    try {
      const result = await getLinkedAccounts();
      if (result.success) {
        setAccounts(result.accounts);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Create link token for Plaid Link
  const initializePlaidLink = useCallback(async () => {
    const result = await createLinkToken();
    if (result.success && result.linkToken) {
      setLinkToken(result.linkToken);
    } else {
      toast.error(result.error || "Failed to initialize bank connection");
    }
  }, []);

  // Handle successful Plaid Link (new connection or reconnection)
  const onPlaidSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      // Check if this is a reconnection (update mode doesn't provide public_token for exchange)
      if (reconnectingAccountId) {
        toast.loading("Reconnecting your account...", { id: "plaid-link" });
        const result = await handleReconnectSuccess(reconnectingAccountId);
        
        if (result.success) {
          toast.success("Bank account reconnected!", { id: "plaid-link" });
          fetchAccounts();
        } else {
          toast.error(result.error || "Failed to reconnect", { id: "plaid-link" });
        }
        setReconnectingAccountId(null);
        setLinkToken(null);
        return;
      }

      // New connection flow
      toast.loading("Linking your account...", { id: "plaid-link" });

      const result = await exchangePublicToken(publicToken, {
        institution: metadata.institution,
        accounts: metadata.accounts,
      });

      if (result.success) {
        toast.success("Bank account linked successfully!", { id: "plaid-link" });
        fetchAccounts();
        setLinkToken(null);
      } else {
        toast.error(result.error || "Failed to link account", { id: "plaid-link" });
      }
    },
    [fetchAccounts, reconnectingAccountId]
  );

  // Handle reconnect for expired/error accounts
  const handleReconnect = async (accountId: string) => {
    setReconnectingAccountId(accountId);
    const result = await createUpdateLinkToken(accountId);
    if (result.success && result.linkToken) {
      setLinkToken(result.linkToken);
    } else {
      toast.error(result.error || "Failed to start reconnection");
      setReconnectingAccountId(null);
    }
  };

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: () => {
      setLinkToken(null);
      setReconnectingAccountId(null);
    },
  });

  // Open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && plaidReady) {
      openPlaidLink();
    }
  }, [linkToken, plaidReady, openPlaidLink]);

  // Handle sync
  const handleSync = async (accountId: string) => {
    setSyncingAccountId(accountId);
    toast.loading("Syncing transactions...", { id: `sync-${accountId}` });

    try {
      const result = await syncAccount(accountId);
      if (result.success) {
        toast.success(
          `Synced ${result.transactionCount || 0} new transactions`,
          { id: `sync-${accountId}` }
        );
        fetchAccounts();
      } else {
        toast.error(result.error || "Sync failed", { id: `sync-${accountId}` });
      }
    } catch (error) {
      toast.error("Sync failed", { id: `sync-${accountId}` });
    } finally {
      setSyncingAccountId(null);
    }
  };

  // Handle unlink
  const handleUnlink = async () => {
    if (!accountToUnlink) return;

    setUnlinkingAccountId(accountToUnlink.id);
    toast.loading("Unlinking account...", { id: `unlink-${accountToUnlink.id}` });

    try {
      const result = await unlinkAccount(accountToUnlink.id);
      if (result.success) {
        toast.success("Account unlinked", { id: `unlink-${accountToUnlink.id}` });
        fetchAccounts();
      } else {
        toast.error(result.error || "Failed to unlink", { id: `unlink-${accountToUnlink.id}` });
      }
    } catch (error) {
      toast.error("Failed to unlink", { id: `unlink-${accountToUnlink.id}` });
    } finally {
      setUnlinkingAccountId(null);
      setAccountToUnlink(null);
    }
  };

  return (
    <>
      <Card className="p-6">
        <Accordion type="single" collapsible className="w-full" defaultValue="linked-accounts">
          <AccordionItem value="linked-accounts">
            <AccordionTrigger className="text-lg font-semibold">
              Linked Bank Accounts
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Connect your bank accounts to automatically import transactions daily.
                This is an alternative to uploading CSV/PDF statements.
              </p>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : accounts.length > 0 ? (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-lg p-4 border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          {getAccountIcon(account.accountType)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {account.institutionName || "Bank"}
                            </span>
                            {getSyncStatusBadge(account.syncStatus, account.syncErrorMessage)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {account.accountName || account.accountSubtype || "Account"}
                            {account.accountMask && ` ••••${account.accountMask}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last synced: {formatRelativeTime(account.lastSyncedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {needsReconnect(account.syncStatus) ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleReconnect(account.id)}
                            disabled={reconnectingAccountId === account.id}
                          >
                            {reconnectingAccountId === account.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                            <span className="ml-1">Reconnect</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSync(account.id)}
                            disabled={syncingAccountId === account.id}
                          >
                            {syncingAccountId === account.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            <span className="ml-1 hidden sm:inline">Sync</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAccountToUnlink(account)}
                          disabled={unlinkingAccountId === account.id}
                          className="text-destructive hover:text-destructive"
                        >
                          {unlinkingAccountId === account.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">Unlink</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No bank accounts linked yet</p>
                </div>
              )}

              <Button
                onClick={initializePlaidLink}
                disabled={!!linkToken}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Connect Bank Account
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Unlink Confirmation Dialog */}
      <AlertDialog open={!!accountToUnlink} onOpenChange={() => setAccountToUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Bank Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect{" "}
              <strong>
                {accountToUnlink?.institutionName} {accountToUnlink?.accountMask && `(••••${accountToUnlink.accountMask})`}
              </strong>{" "}
              from your account. Previously imported transactions will remain, but new transactions
              will no longer sync automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

