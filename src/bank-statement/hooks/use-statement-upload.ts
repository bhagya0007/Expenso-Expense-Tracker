import { useState, useCallback } from "react";
import type { StatementMimeType } from "../types";

export interface StatementFileMetadata {
  id: string;
  name: string;
  size: number;
  type: StatementMimeType;
  uploadedAt: Date;
}

export interface UseStatementUploadReturn {
  file: File | null;
  metadata: StatementFileMetadata | null;
  error: string | null;
  handleFileSelect: (selectedFile: File) => void;
  resetUpload: () => void;
}

export function useStatementUpload(): UseStatementUploadReturn {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<StatementFileMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setMetadata({
      id: crypto.randomUUID(),
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type as StatementMimeType,
      uploadedAt: new Date(),
    });
    setError(null);
  }, []);

  const resetUpload = useCallback(() => {
    setFile(null);
    setMetadata(null);
    setError(null);
  }, []);

  return { file, metadata, error, handleFileSelect, resetUpload };
}
