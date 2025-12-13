"use client";

import { ALL_UPLOAD_EXTENSIONS } from "@/lib/constants";
import { useQuickActions } from "./use-quick-actions";
import { FAB } from "./fab";
import { QuickActionsMenu } from "./menu";
import { DocTypeSelectorDialog, InstallDialog } from "./dialogs";

export function QuickActions() {
  const {
    // Hidden input refs (callback refs)
    setCameraInputEl,
    setFileInputEl,

    // State
    isOpen,
    setIsOpen,
    isUploading,
    isFullscreen,
    isFullscreenSupported,
    isStandalone,
    platform,
    deferredPrompt,
    showDocTypeSelector,
    setShowDocTypeSelector,
    pendingFiles,
    setPendingFiles,
    selectedDocType,
    setSelectedDocType,
    showInstallDialog,
    setShowInstallDialog,

    // Handlers
    handleCameraCapture,
    handleFileChange,
    handleCameraClick,
    handleFileUploadClick,
    toggleFullscreen,
    handleAddToHome,
    handleDocTypeConfirm,

    // Router (passed through for menu navigation)
    router,
  } = useQuickActions();

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={setCameraInputEl}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
        disabled={isUploading}
      />
      <input
        ref={setFileInputEl}
        type="file"
        accept={ALL_UPLOAD_EXTENSIONS}
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {/* Quick Actions Menu - Hidden on desktop (md screens and above) */}
      <div className="fixed bottom-20 right-4 z-50 quick-actions-menu md:hidden">
        {/* Fan-out menu */}
        {isOpen ? (
          <QuickActionsMenu
            isUploading={isUploading}
            isFullscreen={isFullscreen}
            isFullscreenSupported={isFullscreenSupported}
            isStandalone={isStandalone}
            platform={platform}
            deferredPrompt={deferredPrompt}
            setIsOpen={setIsOpen}
            handleCameraClick={handleCameraClick}
            handleFileUploadClick={handleFileUploadClick}
            toggleFullscreen={toggleFullscreen}
            handleAddToHome={handleAddToHome}
            router={router}
          />
        ) : null}

        {/* Main FAB Button */}
        <FAB
          isOpen={isOpen}
          isUploading={isUploading}
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>

      {/* Document Type Selector Dialog */}
      <DocTypeSelectorDialog
        open={showDocTypeSelector}
        onOpenChange={setShowDocTypeSelector}
        selectedDocType={selectedDocType}
        setSelectedDocType={setSelectedDocType}
        onConfirm={handleDocTypeConfirm}
        onCancel={() => {
          setShowDocTypeSelector(false);
          setPendingFiles(null);
        }}
        disabled={isUploading || !pendingFiles}
      />

      {/* Install on iOS Dialog */}
      <InstallDialog
        open={showInstallDialog}
        onOpenChange={setShowInstallDialog}
      />
    </>
  );
}

