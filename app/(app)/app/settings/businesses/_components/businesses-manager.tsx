"use client";

import { useBusinesses } from "@/lib/hooks/use-businesses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, FileText, MoreVertical, Edit2, Trash2 } from "lucide-react";
import type { businesses } from "@/lib/db/schema";

type Business = typeof businesses.$inferSelect;

type BusinessesManagerProps = {
  businesses: Business[];
};

export function BusinessesManager({ businesses }: BusinessesManagerProps) {
  const hook = useBusinesses({ businesses });

  const businessList = businesses.filter((b) => b.type === "business");
  const contractList = businesses.filter((b) => b.type === "contract");

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Your Businesses & Contracts</h2>
            <p className="text-sm text-muted-foreground">
              Organize transactions by assigning them to specific businesses or contracts
            </p>
          </div>
          <Dialog open={hook.businessDialogOpen} onOpenChange={hook.setBusinessDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Business
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Business or Contract</DialogTitle>
                <DialogDescription>
                  Add a new business or contract to organize your transactions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder="e.g., My LLC, Freelance Work"
                    value={hook.newBusinessName}
                    onChange={(e) => hook.setNewBusinessName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={hook.newBusinessType}
                    onValueChange={(v) =>
                      hook.setNewBusinessType(v as "business" | "contract")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Description (Optional)</label>
                  <Textarea
                    placeholder="Brief description"
                    value={hook.newBusinessDescription}
                    onChange={(e) => hook.setNewBusinessDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Tax ID (Optional)</label>
                  <Input
                    placeholder="EIN, GST/HST number, etc."
                    value={hook.newBusinessTaxId}
                    onChange={(e) => hook.setNewBusinessTaxId(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Address (Optional)</label>
                  <Input
                    placeholder="Business address"
                    value={hook.newBusinessAddress}
                    onChange={(e) => hook.setNewBusinessAddress(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={hook.handleCreateBusiness}
                  disabled={hook.isPending || !hook.newBusinessName.trim()}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Business Dialog */}
          <Dialog
            open={hook.editBusinessDialogOpen}
            onOpenChange={hook.setEditBusinessDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Business/Contract</DialogTitle>
                <DialogDescription>
                  Update business or contract details
                </DialogDescription>
              </DialogHeader>
              {hook.editingBusiness ? <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      placeholder="e.g., My LLC"
                      value={hook.newBusinessName}
                      onChange={(e) => hook.setNewBusinessName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <Select
                      value={hook.newBusinessType}
                      onValueChange={(v) =>
                        hook.setNewBusinessType(v as "business" | "contract")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Description (Optional)</label>
                    <Textarea
                      placeholder="Brief description"
                      value={hook.newBusinessDescription}
                      onChange={(e) => hook.setNewBusinessDescription(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Tax ID (Optional)</label>
                    <Input
                      placeholder="EIN, GST/HST number, etc."
                      value={hook.newBusinessTaxId}
                      onChange={(e) => hook.setNewBusinessTaxId(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Address (Optional)</label>
                    <Input
                      placeholder="Business address"
                      value={hook.newBusinessAddress}
                      onChange={(e) => hook.setNewBusinessAddress(e.target.value)}
                    />
                  </div>
                </div> : null}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    hook.setEditBusinessDialogOpen(false);
                    hook.setEditingBusiness(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={hook.handleUpdateBusiness}
                  disabled={hook.isPending || !hook.newBusinessName.trim()}
                >
                  Update
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {businesses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>
              No businesses or contracts yet. Create one to start organizing your transactions!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Businesses Section */}
            {businessList.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Businesses ({businessList.length})
                </h3>
                <div className="space-y-2">
                  {businessList.map((business) => (
                    <div
                      key={business.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{business.name}</span>
                          {business.taxId ? <Badge variant="outline" className="text-xs">
                              {business.taxId}
                            </Badge> : null}
                        </div>
                        {business.description ? <p className="text-sm text-muted-foreground mt-1">
                            {business.description}
                          </p> : null}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => hook.handleEditBusiness(business)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              hook.handleDeleteBusiness(business.id, business.name)
                            }
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contracts Section */}
            {contractList.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Contracts ({contractList.length})
                </h3>
                <div className="space-y-2">
                  {contractList.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{contract.name}</span>
                          {contract.taxId ? <Badge variant="outline" className="text-xs">
                              {contract.taxId}
                            </Badge> : null}
                        </div>
                        {contract.description ? <p className="text-sm text-muted-foreground mt-1">
                            {contract.description}
                          </p> : null}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => hook.handleEditBusiness(contract)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              hook.handleDeleteBusiness(contract.id, contract.name)
                            }
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

