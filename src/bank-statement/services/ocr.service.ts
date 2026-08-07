export interface IOcrService {
  extractTextFromImage(imageFile: File | Blob): Promise<string>;
}

export class OcrService implements IOcrService {
  async extractTextFromImage(_imageFile: File | Blob): Promise<string> {
    throw new Error("Method not implemented. Architectural placeholder.");
  }
}

export const ocrService = new OcrService();
