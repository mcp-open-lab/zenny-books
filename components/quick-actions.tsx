"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
    }>;
  }
}
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { scanReceipt } from "@/app/actions/scan-receipt";
import {
  Camera,
  Upload,
  X,
  Plus,
  ArrowUpToLine,
  Brain,
  Maximize2,
  Minimize2,
  Smartphone,
} from "lucide-react";
import { future_genUploader } from "uploadthing/client-future";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
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

// Get API URL from window location (works in browser)
const getApiUrl = () => {
  if (typeof window !== "undefined") {
    return new URL("/api/uploadthing", window.location.origin);
  }
  return new URL(
    "/api/uploadthing",
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  );
};

// Downscale large camera images before upload to keep them fast and under limits
async function compressImageFile(
  file: File,
  maxSize = 1800,
  quality = 0.8
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const imageUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = imageUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (err) => reject(err);
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    const { width, height } = img;
    const maxDim = Math.max(width, height);
    const scale = maxDim > maxSize ? maxSize / maxDim : 1;

    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", quality)
    );

    if (!blob) return file;

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export function QuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(false);
  const [showDocTypeSelector, setShowDocTypeSelector] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<
    "receipt" | "bank_statement"
  >("receipt");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Add to Home Screen logic
  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isAndroid = /android/i.test(window.navigator.userAgent);
    setPlatform(isIos ? "ios" : isAndroid ? "android" : null);

    const checkStandalone = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(standalone);
    };
    checkStandalone();

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  // Check fullscreen support and state
  useEffect(() => {
    // Detect iOS/Safari - Fullscreen API is not supported
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    // Check if Fullscreen API is available
    const hasFullscreenSupport =
      !isIOS &&
      (document.documentElement.requestFullscreen ||
        (document.documentElement as any).webkitRequestFullscreen ||
        (document.documentElement as any).mozRequestFullScreen ||
        (document.documentElement as any).msRequestFullscreen);

    setIsFullscreenSupported(!!hasFullscreenSupport);

    if (hasFullscreenSupport) {
      const checkFullscreen = () => {
        setIsFullscreen(
          !!(
            document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).mozFullScreenElement ||
            (document as any).msFullscreenElement
          )
        );
      };

      // Listen for fullscreen changes (with vendor prefixes)
      document.addEventListener("fullscreenchange", checkFullscreen);
      document.addEventListener("webkitfullscreenchange", checkFullscreen);
      document.addEventListener("mozfullscreenchange", checkFullscreen);
      document.addEventListener("MSFullscreenChange", checkFullscreen);

      checkFullscreen();

      return () => {
        document.removeEventListener("fullscreenchange", checkFullscreen);
        document.removeEventListener("webkitfullscreenchange", checkFullscreen);
        document.removeEventListener("mozfullscreenchange", checkFullscreen);
        document.removeEventListener("MSFullscreenChange", checkFullscreen);
      };
    }
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".quick-actions-menu")) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen]);

  const toggleFullscreen = async () => {
    if (!isFullscreenSupported) {
      toast.info(
        "Fullscreen not available on iOS. Add to Home Screen for immersive mode."
      );
      setIsOpen(false);
      return;
    }

    try {
      const doc = document.documentElement as any;
      const isCurrentlyFullscreen =
        document.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement;

      if (!isCurrentlyFullscreen) {
        // Try different vendor-prefixed methods
        if (doc.requestFullscreen) {
          await doc.requestFullscreen();
        } else if (doc.webkitRequestFullscreen) {
          await doc.webkitRequestFullscreen();
        } else if (doc.mozRequestFullScreen) {
          await doc.mozRequestFullScreen();
        } else if (doc.msRequestFullscreen) {
          await doc.msRequestFullscreen();
        }
        setIsFullscreen(true);
        toast.success("Entered fullscreen mode");
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
        setIsFullscreen(false);
        toast.success("Exited fullscreen mode");
      }
      setIsOpen(false);
    } catch (error) {
      console.error("Fullscreen error:", error);
      toast.error("Fullscreen not supported or blocked");
    }
  };

  const handleFileSelect = async (
    files: FileList | null,
    docType?: "receipt" | "bank_statement"
  ) => {
    if (!files || files.length === 0) return;

    // If doc type not provided, show selector
    if (!docType) {
      setPendingFiles(files);
      setShowDocTypeSelector(true);
      return;
    }

    setIsUploading(true);
    setIsOpen(false);
    setShowDocTypeSelector(false);
    setPendingFiles(null);

    try {
      const docTypeLabel =
        docType === "bank_statement" ? "bank statement" : "receipt";
      toast.info(`Uploading ${docTypeLabel}...`);

      const compressedFiles = await Promise.all(
        Array.from(files).map((file) => compressImageFile(file))
      );

      const uploader = future_genUploader<OurFileRouter>({
        url: getApiUrl(),
      });

      const uploadedFiles = await uploader.uploadFiles("receiptUploader", {
        files: compressedFiles,
        onEvent: (event) => {
          if (event.type === "upload-progress") {
            const progress = Math.round(
              (event.file.sent / event.file.size) * 100
            );
            toast.info(`Uploading... ${progress}%`);
          }
        },
      });

      if (
        uploadedFiles &&
        uploadedFiles[0] &&
        uploadedFiles[0].status === "uploaded"
      ) {
        toast.info(`Processing ${docTypeLabel} with AI...`);
        await scanReceipt(uploadedFiles[0].url);
        toast.success(
          `${
            docTypeLabel.charAt(0).toUpperCase() + docTypeLabel.slice(1)
          } processed!`
        );
        router.refresh();
      }
    } catch (error) {
      console.error("[Quick Actions] Upload error:", error);
      toast.error(
        `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDocTypeConfirm = () => {
    if (pendingFiles) {
      handleFileSelect(pendingFiles, selectedDocType);
    }
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input so same file can be selected again
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      {/* Document Type Selector Dialog */}
      <Dialog open={showDocTypeSelector} onOpenChange={setShowDocTypeSelector}>
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
            <Button
              variant="outline"
              onClick={() => {
                setShowDocTypeSelector(false);
                setPendingFiles(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleDocTypeConfirm}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
        disabled={isUploading}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.csv,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {/* Quick Actions Menu - Hidden on desktop (lg screens and above) */}
      <div className="fixed bottom-20 right-4 z-50 quick-actions-menu md:hidden">
        {/* Quick Actions Fan-out */}
        {isOpen && (
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
            {isFullscreenSupported && (
              <Button
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
              </Button>
            )}

            {/* Add to Home Screen */}
            {!isStandalone &&
              ((platform === "android" && deferredPrompt) ||
                platform === "ios") && (
                <Button
                  onClick={async () => {
                    setIsOpen(false);
                    if (platform === "android" && deferredPrompt) {
                      try {
                        await deferredPrompt.prompt();
                        const choice = await deferredPrompt.userChoice;
                        if (choice.outcome === "accepted") {
                          setDeferredPrompt(null);
                          setIsStandalone(true);
                        }
                      } catch (error) {
                        console.error("Error showing install prompt:", error);
                      }
                    } else if (platform === "ios") {
                      setShowInstallDialog(true);
                    }
                  }}
                  variant="secondary"
                  className="w-full justify-start gap-2 shadow-md"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Add to Home</span>
                </Button>
              )}
          </div>
        )}

        {/* Main FAB Button - Smaller */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isUploading}
          className={`rounded-full w-14 h-14 p-0 shadow-xl transition-all duration-300 ${
            isOpen
              ? "bg-destructive hover:bg-destructive/90 rotate-45"
              : "bg-primary hover:bg-primary/90"
          } text-primary-foreground`}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </Button>
      </div>
    </>
  );
}
