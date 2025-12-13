"use client";

import { Button } from "@/components/ui/button";
import {
  Camera,
  Upload,
  Brain,
  ArrowUpToLine,
  Maximize2,
  Minimize2,
  Smartphone,
} from "lucide-react";
import type { useQuickActions } from "./use-quick-actions";

type QuickActionsMenuProps = {
  isUploading: boolean;
  isFullscreen: boolean;
  isFullscreenSupported: boolean;
  isStandalone: boolean;
  platform: "ios" | "android" | null;
  deferredPrompt: any;
  setIsOpen: (open: boolean) => void;
  handleCameraClick: () => void;
  handleFileUploadClick: () => void;
  toggleFullscreen: () => void;
  handleAddToHome: () => void;
  router: ReturnType<typeof useQuickActions>["router"];
};

export function QuickActionsMenu({
  isUploading,
  isFullscreen,
  isFullscreenSupported,
  isStandalone,
  platform,
  deferredPrompt,
  setIsOpen,
  handleCameraClick,
  handleFileUploadClick,
  toggleFullscreen,
  handleAddToHome,
  router,
}: QuickActionsMenuProps) {
  return (
    <div className="absolute bottom-16 right-0 flex flex-col gap-2 mb-3 w-44">
      {/* Camera */}
      <Button
        onClick={() => {
          setIsOpen(false);
          handleCameraClick();
        }}
        disabled={isUploading}
        className="w-full justify-start gap-2 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Camera className="h-4 w-4" />
        <span>Camera</span>
        <Brain className="h-3.5 w-3.5 ml-auto" />
      </Button>

      {/* File Upload */}
      <Button
        onClick={() => {
          setIsOpen(false);
          handleFileUploadClick();
        }}
        disabled={isUploading}
        className="w-full justify-start gap-2 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Upload className="h-4 w-4" />
        <span>Upload</span>
        <Brain className="h-3.5 w-3.5 ml-auto" />
      </Button>

      <div className="h-px bg-border my-1" />

      {/* Export */}
      <Button
        onClick={() => {
          setIsOpen(false);
          router.push("/app/export");
        }}
        variant="secondary"
        className="w-full justify-start gap-2 shadow-md"
      >
        <ArrowUpToLine className="h-4 w-4" />
        <span>Export</span>
      </Button>

      {/* Fullscreen */}
      {isFullscreenSupported ? <Button
          onClick={() => {
            setIsOpen(false);
            toggleFullscreen();
          }}
          variant="secondary"
          className="w-full justify-start gap-2 shadow-md"
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="h-4 w-4" />
              <span>Exit Fullscreen</span>
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4" />
              <span>Fullscreen</span>
            </>
          )}
        </Button> : null}

      {/* Add to Home Screen */}
      {!isStandalone &&
        ((platform === "android" && deferredPrompt) || platform === "ios") ? <Button
            onClick={handleAddToHome}
            variant="secondary"
            className="w-full justify-start gap-2 shadow-md"
          >
            <Smartphone className="h-4 w-4" />
            <span>Add to Home</span>
          </Button> : null}
    </div>
  );
}

