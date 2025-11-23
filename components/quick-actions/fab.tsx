"use client";

import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

type FABProps = {
  isOpen: boolean;
  isUploading: boolean;
  onClick: () => void;
};

export function FAB({ isOpen, isUploading, onClick }: FABProps) {
  return (
    <Button
      onClick={onClick}
      disabled={isUploading}
      className={`rounded-full w-14 h-14 p-0 shadow-xl transition-all duration-300 ${
        isOpen
          ? "bg-destructive hover:bg-destructive/90 rotate-45"
          : "bg-primary hover:bg-primary/90"
      } text-primary-foreground`}
    >
      {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
    </Button>
  );
}

