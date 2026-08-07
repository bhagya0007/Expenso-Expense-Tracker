import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { statementUploadService, type StatementUploadResponse } from "../services/statement-upload.service";
import { toast } from "sonner";

export function useStatementUploadMutation() {
  const [progress, setProgress] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const mutation = useMutation({
    mutationKey: ["statement-upload"],
    mutationFn: async (file: File): Promise<StatementUploadResponse> => {
      abortControllerRef.current = new AbortController();
      setProgress(0);

      return statementUploadService.uploadStatementPdf(file, {
        onProgress: (p) => setProgress(p),
        signal: abortControllerRef.current.signal,
      });
    },
    onSuccess: (data) => {
      setProgress(100);
      toast.success(`Uploaded "${data.fileName}" successfully!`);
    },
    onError: (error: Error) => {
      if (error.name === "AbortError") {
        toast.info("Upload canceled");
      } else {
        toast.error(error.message || "Failed to upload PDF statement");
      }
    },
  });

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    mutation.reset();
    setProgress(0);
  }, [mutation]);

  const retryUpload = useCallback(
    (file: File) => {
      cancelUpload();
      mutation.mutate(file);
    },
    [cancelUpload, mutation]
  );

  return {
    uploadPdf: mutation.mutate,
    uploadPdfAsync: mutation.mutateAsync,
    cancelUpload,
    retryUpload,
    progress,
    uploadResponse: mutation.data ?? null,
    isUploading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
