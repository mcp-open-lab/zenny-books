"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, Receipt } from "lucide-react";

type DocTypeSelectorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocType: "receipt" | "bank_statement";
  setSelectedDocType: (type: "receipt" | "bank_statement") => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DocTypeSelectorDialog({
  open,
  onOpenChange,
  selectedDocType,
  setSelectedDocType,
  onConfirm,
  onCancel,
}: DocTypeSelectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Document Type</DialogTitle>
          <DialogDescription>
            What type of document are you uploading?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <RadioGroup
            value={selectedDocType}
            onValueChange={(value) =>
              setSelectedDocType(value as "receipt" | "bank_statement")
            }
          >
            <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors">
              <RadioGroupItem value="receipt" id="receipt" />
              <Label
                htmlFor="receipt"
                className="flex items-center gap-3 cursor-pointer flex-1"
              >
                <Receipt className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Receipt</p>
                  <p className="text-sm text-muted-foreground">
                    Expense receipts with images
                  </p>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors">
              <RadioGroupItem value="bank_statement" id="bank_statement" />
              <Label
                htmlFor="bank_statement"
                className="flex items-center gap-3 cursor-pointer flex-1"
              >
                <CreditCard className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Bank Statement</p>
                  <p className="text-sm text-muted-foreground">
                    CSV or spreadsheet files
                  </p>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type InstallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InstallDialog({ open, onOpenChange }: InstallDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install on iPhone or iPad</DialogTitle>
        </DialogHeader>
        <ol className="list-decimal list-inside text-sm space-y-2">
          <li>Tap the Share icon in Safari (square with an upward arrow).</li>
          <li>Scroll down and choose "Add to Home Screen".</li>
          <li>Confirm the name and tap "Add".</li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}

