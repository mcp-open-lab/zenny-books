"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { scanReceipt } from "@/lib/modules/receipts/actions";
import { future_genUploader } from "uploadthing/client-future";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

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

export function useQuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(false);
  const [showDocTypeSelector, setShowDocTypeSelector] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
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
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

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
    files: FileList | File[] | null,
    docType?: "receipt" | "bank_statement"
  ) => {
    if (!files || files.length === 0) return;

    // Convert FileList to array to avoid stale references
    const filesArray = Array.isArray(files) ? files : Array.from(files);

    if (!docType) {
      setPendingFiles(filesArray);
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
        filesArray.map((file) => compressImageFile(file))
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
    if (!pendingFiles || pendingFiles.length === 0) {
      toast.error("No files selected. Please try again.");
      setShowDocTypeSelector(false);
      return;
    }
    handleFileSelect(pendingFiles, selectedDocType);
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFileSelect(files);
    }
    // Reset input after handling files
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFileSelect(files);
    }
    // Reset input after handling files
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddToHome = async () => {
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
  };

  return {
    // State
    isOpen,
    setIsOpen,
    isUploading,
    isFullscreen,
    isFullscreenSupported,
    showDocTypeSelector,
    setShowDocTypeSelector,
    pendingFiles,
    setPendingFiles,
    selectedDocType,
    setSelectedDocType,
    deferredPrompt,
    showInstallDialog,
    setShowInstallDialog,
    isStandalone,
    platform,
    // Refs
    fileInputRef,
    cameraInputRef,
    // Handlers
    toggleFullscreen,
    handleFileSelect,
    handleDocTypeConfirm,
    handleCameraClick,
    handleFileUploadClick,
    handleCameraCapture,
    handleFileChange,
    handleAddToHome,
    router,
  };
}

