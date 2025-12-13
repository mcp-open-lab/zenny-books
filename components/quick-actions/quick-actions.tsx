"use client";

import { ALL_UPLOAD_EXTENSIONS } from "@/lib/constants";
import { useQuickActions } from "./use-quick-actions";
import { FAB } from "./fab";
import { QuickActionsMenu } from "./menu";
import { DocTypeSelectorDialog, InstallDialog } from "./dialogs";

export function QuickActions() {
  const hook = useQuickActions();

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={hook.cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={hook.handleCameraCapture}
        disabled={hook.isUploading}
      />
      <input
        ref={hook.fileInputRef}
        type="file"
        accept={ALL_UPLOAD_EXTENSIONS}
        className="hidden"
        onChange={hook.handleFileChange}
        disabled={hook.isUploading}
      />

      {/* Quick Actions Menu - Hidden on desktop (md screens and above) */}
      <div className="fixed bottom-20 right-4 z-50 quick-actions-menu md:hidden">
        {/* Fan-out menu */}
        {hook.isOpen ? <QuickActionsMenu
            isUploading={hook.isUploading}
            isFullscreen={hook.isFullscreen}
            isFullscreenSupported={hook.isFullscreenSupported}
            isStandalone={hook.isStandalone}
            platform={hook.platform}
            deferredPrompt={hook.deferredPrompt}
            setIsOpen={hook.setIsOpen}
            handleCameraClick={hook.handleCameraClick}
            handleFileUploadClick={hook.handleFileUploadClick}
            toggleFullscreen={hook.toggleFullscreen}
            handleAddToHome={hook.handleAddToHome}
            router={hook.router}
          /> : null}

        {/* Main FAB Button */}
        <FAB
          isOpen={hook.isOpen}
          isUploading={hook.isUploading}
          onClick={() => hook.setIsOpen(!hook.isOpen)}
        />
      </div>

      {/* Document Type Selector Dialog */}
      <DocTypeSelectorDialog
        open={hook.showDocTypeSelector}
        onOpenChange={hook.setShowDocTypeSelector}
        selectedDocType={hook.selectedDocType}
        setSelectedDocType={hook.setSelectedDocType}
        onConfirm={hook.handleDocTypeConfirm}
        onCancel={() => {
          hook.setShowDocTypeSelector(false);
          hook.setPendingFiles(null);
        }}
        disabled={hook.isUploading || !hook.pendingFiles}
      />

      {/* Install on iOS Dialog */}
      <InstallDialog
        open={hook.showInstallDialog}
        onOpenChange={hook.setShowInstallDialog}
      />
    </>
  );
}

