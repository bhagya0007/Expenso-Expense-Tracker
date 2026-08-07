import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  UploadCloud, FileText, AlertCircle, CheckCircle2, X,
  ShieldCheck, RefreshCcw, RefreshCw, Lock, Sparkles, Check,
} from "lucide-react";
import { useStatementUploadMutation } from "../hooks/use-statement-upload-mutation";
import type { StatementUploadResponse } from "../services/statement-upload.service";
import { toast } from "sonner";

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export interface StatementDropzoneProps {
  onUploadSuccess?: (response: StatementUploadResponse) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export function StatementDropzone({
  onUploadSuccess,
  onCancel,
  disabled = false,
}: StatementDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    uploadPdf,
    cancelUpload,
    retryUpload,
    progress,
    uploadResponse,
    isUploading,
    isSuccess,
    isError,
    error,
    reset,
  } = useStatementUploadMutation();

  const validateFile = (file: File): boolean => {
    setValidationError(null);

    // 1. Validate file extension & mime type (PDF only)
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      const err = "Invalid file type. Only PDF bank statements are supported.";
      setValidationError(err);
      toast.error(err);
      return false;
    }

    // 2. Validate max size (20MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const err = `File size exceeds 20MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
      setValidationError(err);
      toast.error(err);
      return false;
    }

    return true;
  };

  const processFile = (file: File) => {
    if (!validateFile(file)) return;

    setSelectedFile(file);
    uploadPdf(file, {
      onSuccess: (response) => {
        onUploadSuccess?.(response);
      },
    });
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !selectedFile) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || selectedFile) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleCancel = () => {
    cancelUpload();
    setSelectedFile(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onCancel?.();
  };

  const handleRetry = () => {
    if (selectedFile) {
      retryUpload(selectedFile);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="relative overflow-hidden border-border/60 gradient-card p-6 md:p-8 shadow-card backdrop-blur-xl transition-all duration-300">
      {/* Background Decorative Glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full gradient-primary opacity-20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full gradient-accent opacity-15 blur-2xl" />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <AnimatePresence mode="wait">
        {!selectedFile ? (
          // Dropzone Interactive State
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 md:p-12 text-center cursor-pointer transition-all duration-300 ${
              isDragging
                ? "border-primary bg-primary/10 scale-[1.01] shadow-glow"
                : "border-border/80 bg-background/40 hover:border-primary/50 hover:bg-background/60"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {/* Animated Icon */}
            <motion.div
              animate={{ y: isDragging ? -6 : 0 }}
              className="grid h-16 w-16 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-glow group-hover:scale-105 transition-transform"
            >
              <UploadCloud className="h-8 w-8" />
            </motion.div>

            <div className="mt-5 space-y-2">
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                Drop your Bank Statement PDF here
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Or click to browse from your computer. Only PDF bank statements up to <span className="font-semibold text-foreground">20MB</span> are accepted.
              </p>
            </div>

            {/* Action Badges & Buttons */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <FileText className="mr-2 h-4 w-4" /> Browse PDF
              </Button>
              <Badge variant="outline" className="rounded-lg border-border/60 text-xs font-normal text-muted-foreground px-2.5 py-1">
                PDF only (Max 20MB)
              </Badge>
            </div>

            {/* Privacy Guarantee Note */}
            <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>100% On-Device Privacy. Upload powered by TanStack Query Mutation.</span>
            </div>

            {/* Inline Validation Error Message */}
            {validationError && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {validationError}
              </motion.div>
            )}
          </motion.div>
        ) : (
          // Selected File & Upload Progress / Success / Error Card
          <motion.div
            key="upload-active"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            {/* File Card Header */}
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/60 p-4 backdrop-blur">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display font-semibold text-sm sm:text-base text-foreground">
                    {selectedFile.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>{formatFileSize(selectedFile.size)}</span>
                    <span>•</span>
                    <Badge variant="outline" className="text-[10px] font-medium border-primary/30 text-primary uppercase">
                      PDF Statement
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Cancel Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive shrink-0"
                title="Cancel Upload"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Upload Status / Progress Indicator */}
            {isUploading && (
              <div className="space-y-3 rounded-2xl border border-border/60 bg-background/30 p-5">
                <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
                  <span className="flex items-center gap-2 text-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    {progress < 15
                      ? "Uploading PDF..."
                      : progress < 30
                        ? "Rendering pages at high resolution..."
                        : progress < 55
                          ? "Running OCR text extraction..."
                          : progress < 75
                            ? "Extracting transactions from table..."
                            : progress < 90
                              ? "Validating and finalizing data..."
                              : "Almost done..."}
                  </span>
                  <span className="font-mono font-semibold text-primary">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2.5 rounded-full bg-secondary transition-all duration-500 ease-out" />
              </div>
            )}

            {/* Error State with Retry Trigger */}
            {isError && (
              <div className="flex items-start justify-between gap-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Upload Failed</div>
                    <div className="text-xs opacity-90 mt-0.5">{error?.message || "Failed to upload file."}</div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="rounded-xl border-destructive/40 bg-background/50 hover:bg-destructive/20 text-destructive text-xs font-semibold shrink-0"
                >
                  <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Retry Upload
                </Button>
              </div>
            )}

            {/* Uploaded Success Summary Card */}
            {isSuccess && uploadResponse && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-foreground space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm sm:text-base">
                    <CheckCircle2 className="h-5 w-5" /> PDF Upload Response Received
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400">
                    STATUS: UPLOADED
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-background/40 p-3 rounded-xl border border-emerald-500/20 font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">FILE ID</span>
                    <span className="font-bold text-foreground">{uploadResponse.fileId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">FILE SIZE</span>
                    <span className="font-bold text-foreground">{formatFileSize(uploadResponse.fileSizeBytes)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">UPLOADED AT</span>
                    <span className="font-bold text-foreground">
                      {new Date(uploadResponse.uploadedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Actions Toolbar */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="rounded-xl border-border/60 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>

              {isSuccess && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    setSelectedFile(null);
                  }}
                  className="rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                >
                  Upload Another PDF
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
