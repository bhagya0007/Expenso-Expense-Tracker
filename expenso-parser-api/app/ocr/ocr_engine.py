import io
from typing import List, Dict, Any
from app.ocr.preprocessor import OpenCvPreprocessor
from app.ocr.spatial_row_reconstructor import spatial_reconstructor
from app.utils.logger import logger


class PaddleOcrEngine:
    """
    High-Precision Scanned PDF OCR Engine powered by PyMuPDF (200 DPI),
    OpenCV 6-step Preprocessing, and RapidOCR / EasyOCR / PyTesseract.
    """

    def __init__(self, preprocessor: OpenCvPreprocessor = None):
        self.preprocessor = preprocessor or OpenCvPreprocessor()
        self._rapid_ocr_instance = None
        self._easy_ocr_reader = None

    def process_scanned_pdf_bytes(self, pdf_bytes: bytes) -> Dict[str, Any]:
        logger.info(f"PaddleOcrEngine processing scanned PDF ({len(pdf_bytes)} bytes)")
        all_rows: List[Dict[str, Any]] = []
        all_ocr_texts: List[str] = []

        try:
            # 1. Page image rendering via PyMuPDF (200 DPI)
            page_images = self._render_pdf_to_images(pdf_bytes, dpi=200)
            logger.info(f"Rendered {len(page_images)} PDF page images at 200 DPI")

            for page_idx, img_bytes in enumerate(page_images, start=1):
                # a. Try RapidOCR on RAW image
                bbox_words = self._run_rapidocr(img_bytes)

                # b. If RapidOCR returns < 5 words, retry with OpenCV-preprocessed image
                if len(bbox_words) < 5:
                    logger.info(f"Page {page_idx}: RapidOCR returned < 5 words, trying with OpenCV preprocessing")
                    # OpenCV Preprocessing (Grayscale, CLAHE contrast, Denoising, Sharpening, Deskew)
                    processed_img, metadata = self.preprocessor.process_image_bytes(img_bytes)

                    # Convert processed OpenCV image back to bytes if available, else raw bytes
                    target_bytes = img_bytes
                    if processed_img is not None:
                        try:
                            import cv2
                            _, encoded = cv2.imencode(".png", processed_img)
                            target_bytes = encoded.tobytes()
                        except Exception as enc_err:
                            logger.warning(f"Failed to encode preprocessed image to bytes: {str(enc_err)}")

                    # Try RapidOCR again on preprocessed image
                    bbox_words = self._run_rapidocr(target_bytes)

                    # c. If RapidOCR fails entirely, fall back to EasyOCR then PyTesseract
                    if not bbox_words:
                        bbox_words = self._extract_fallback(target_bytes)

                logger.info(f"Page {page_idx}: extracted {len(bbox_words)} word bounding boxes")

                # Collect all OCR text for bank detection (includes headers, footers, logos)
                for w in bbox_words:
                    all_ocr_texts.append(w.get("text", ""))

                # 4. Spatial Coordinate Table Reconstruction
                page_rows = spatial_reconstructor.reconstruct_rows(bbox_words, page_idx=page_idx)
                all_rows.extend(page_rows)

        except Exception as exc:
            logger.error(f"PaddleOcrEngine processing error: {str(exc)}", exc_info=True)

        return {
            "engine": "paddleocr_opencv",
            "total_rows": len(all_rows),
            "rows": all_rows,
            "all_ocr_text": " ".join(all_ocr_texts),
        }

    def _render_pdf_to_images(self, pdf_bytes: bytes, dpi: int = 200) -> List[bytes]:
        """Renders all PDF pages to PNG byte streams at high DPI."""
        images: List[bytes] = []

        # Primary: PyMuPDF (fitz)
        try:
            import fitz
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            for page in doc:
                pix = page.get_pixmap(dpi=dpi)
                images.append(pix.tobytes("png"))
            doc.close()
            if images:
                return images
        except Exception as e:
            logger.warning(f"PyMuPDF rendering fallback: {str(e)}")

        # Fallback: pdf2image
        try:
            from pdf2image import convert_from_bytes
            pil_images = convert_from_bytes(pdf_bytes, dpi=dpi)
            for img in pil_images:
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                images.append(buf.getvalue())
            return images
        except Exception as e:
            logger.error(f"pdf2image fallback error: {str(e)}")

        return images

    def _run_rapidocr(self, img_bytes: bytes) -> List[Dict[str, Any]]:
        try:
            from rapidocr_onnxruntime import RapidOCR
            if self._rapid_ocr_instance is None:
                self._rapid_ocr_instance = RapidOCR()
            
            result, _ = self._rapid_ocr_instance(img_bytes)
            bbox_words = []
            if result:
                for item in result:
                    box, text, score = item[0], item[1], item[2]
                    text_clean = str(text).strip()
                    if not text_clean:
                        continue
                    x_min = min(pt[0] for pt in box)
                    y_min = min(pt[1] for pt in box)
                    x_max = max(pt[0] for pt in box)
                    y_max = max(pt[1] for pt in box)
                    bbox_words.append({
                        "text": text_clean,
                        "box": [float(x_min), float(y_min), float(x_max), float(y_max)],
                        "confidence": float(score),
                    })
            return bbox_words
        except Exception as e:
            logger.warning(f"RapidOCR warning: {str(e)}")
            return []

    def _extract_fallback(self, img_bytes: bytes) -> List[Dict[str, Any]]:
        """Extracts word bounding boxes using EasyOCR or PyTesseract fallback."""
        # Method 3: EasyOCR
        try:
            import easyocr
            if self._easy_ocr_reader is None:
                self._easy_ocr_reader = easyocr.Reader(["en"], gpu=False)

            results = self._easy_ocr_reader.readtext(img_bytes)
            bbox_words = []
            for box, text, prob in results:
                text_clean = str(text).strip()
                if not text_clean:
                    continue
                x_min = min(pt[0] for pt in box)
                y_min = min(pt[1] for pt in box)
                x_max = max(pt[0] for pt in box)
                y_max = max(pt[1] for pt in box)
                bbox_words.append({
                    "text": text_clean,
                    "box": [float(x_min), float(y_min), float(x_max), float(y_max)],
                    "confidence": float(prob),
                })
            if bbox_words:
                return bbox_words
        except Exception as e:
            logger.warning(f"EasyOCR fallback warning: {str(e)}")

        # Method 4: PyTesseract Fallback
        try:
            import pytesseract
            from PIL import Image

            img = Image.open(io.BytesIO(img_bytes))
            data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)

            bbox_words = []
            for i in range(len(data["text"])):
                text = str(data["text"][i]).strip()
                if not text:
                    continue
                x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
                bbox_words.append({
                    "text": text,
                    "box": [float(x), float(y), float(x + w), float(y + h)],
                })
            return bbox_words

        except Exception as e:
            logger.error(f"PyTesseract fallback error: {str(e)}")

        return []


OcrEngine = PaddleOcrEngine

