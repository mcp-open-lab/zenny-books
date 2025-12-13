import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createBusiness,
  updateBusiness,
  deleteBusiness,
} from "@/lib/modules/businesses/actions";
import type { businesses } from "@/lib/db/schema";

type Business = typeof businesses.$inferSelect;

type UseBusinessesProps = {
  businesses: Business[];
};

export function useBusinesses({ businesses }: UseBusinessesProps) {
  const [isPending, startTransition] = useTransition();

  // Business state
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newBusinessType, setNewBusinessType] = useState<
    "business" | "contract"
  >("business");
  const [newBusinessDescription, setNewBusinessDescription] = useState("");
  const [newBusinessTaxId, setNewBusinessTaxId] = useState("");
  const [newBusinessAddress, setNewBusinessAddress] = useState("");
  const [businessDialogOpen, setBusinessDialogOpen] = useState(false);

  // Edit state
  const [editBusinessDialogOpen, setEditBusinessDialogOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);

  // Create business handler
  const handleCreateBusiness = () => {
    if (!newBusinessName.trim()) {
      toast.error("Please enter a business name");
      return;
    }

    startTransition(async () => {
      try {
        await createBusiness({
          name: newBusinessName.trim(),
          type: newBusinessType,
          description: newBusinessDescription.trim() || undefined,
          taxId: newBusinessTaxId.trim() || undefined,
          address: newBusinessAddress.trim() || undefined,
        });
        toast.success("Business created!");
        setNewBusinessName("");
        setNewBusinessType("business");
        setNewBusinessDescription("");
        setNewBusinessTaxId("");
        setNewBusinessAddress("");
        setBusinessDialogOpen(false);
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create business"
        );
      }
    });
  };

  // Edit business handler
  const handleEditBusiness = (business: Business) => {
    setEditingBusiness(business);
    setNewBusinessName(business.name);
    setNewBusinessType(business.type as "business" | "contract");
    setNewBusinessDescription(business.description || "");
    setNewBusinessTaxId(business.taxId || "");
    setNewBusinessAddress(business.address || "");
    setEditBusinessDialogOpen(true);
  };

  // Update business handler
  const handleUpdateBusiness = () => {
    if (!editingBusiness || !newBusinessName.trim()) {
      toast.error("Please enter a business name");
      return;
    }

    startTransition(async () => {
      try {
        await updateBusiness({
          businessId: editingBusiness.id,
          name: newBusinessName.trim(),
          type: newBusinessType,
          description: newBusinessDescription.trim() || undefined,
          taxId: newBusinessTaxId.trim() || undefined,
          address: newBusinessAddress.trim() || undefined,
        });
        toast.success("Business updated!");
        setEditBusinessDialogOpen(false);
        setEditingBusiness(null);
        setNewBusinessName("");
        setNewBusinessType("business");
        setNewBusinessDescription("");
        setNewBusinessTaxId("");
        setNewBusinessAddress("");
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update business"
        );
      }
    });
  };

  // Delete business handler
  const handleDeleteBusiness = (businessId: string, businessName: string) => {
    if (
      !confirm(
        `Delete "${businessName}"?\n\n` +
          "⚠️ Warning: Existing transactions linked to this business will become orphaned.\n" +
          "Consider updating those transactions first.\n\n" +
          "This cannot be undone."
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteBusiness({ businessId });
        toast.success("Business deleted");
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete business"
        );
      }
    });
  };

  return {
    // State
    isPending,
    businesses,

    // Business state
    newBusinessName,
    setNewBusinessName,
    newBusinessType,
    setNewBusinessType,
    newBusinessDescription,
    setNewBusinessDescription,
    newBusinessTaxId,
    setNewBusinessTaxId,
    newBusinessAddress,
    setNewBusinessAddress,
    businessDialogOpen,
    setBusinessDialogOpen,

    // Edit state
    editBusinessDialogOpen,
    setEditBusinessDialogOpen,
    editingBusiness,
    setEditingBusiness,

    // Handlers
    handleCreateBusiness,
    handleEditBusiness,
    handleUpdateBusiness,
    handleDeleteBusiness,
  };
}

