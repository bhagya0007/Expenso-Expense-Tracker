import numpy as np
from typing import Tuple, Any, Dict
from app.utils.logger import logger


class OpenCvPreprocessor:
    """
    Advanced OpenCV Image Preprocessing Pipeline for Scanned Bank Statements.
    Implements:
      1. Grayscale conversion
      2. Contrast enhancement via CLAHE
      3. Denoising (Bilateral filtering & Gaussian blur)
      4. Sharpening (Unsharp matrix kernel)
      5. Adaptive & Otsu Thresholding
      6. Automatic Deskew & Rotation Correction
    """

    def process_image_bytes(self, image_bytes: bytes) -> Tuple[Any, Dict[str, Any]]:
        logger.info(f"OpenCvPreprocessor processing image bytes ({len(image_bytes)} bytes)")
        metadata = {"deskew_angle": 0.0, "processed": False}
        
        try:
            import cv2
            
            # 1. Decode byte array to BGR OpenCV image
            np_arr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            
            if img is None:
                logger.warning("OpenCV imdecode failed to decode image bytes.")
                return None, metadata

            # 2. Convert to Grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # 3. Contrast Enhancement via CLAHE (Contrast Limited Adaptive Histogram Equalization)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            contrast_enhanced = clahe.apply(gray)

            # 4. Noise Removal via Bilateral Filter (preserves text edges while smoothing background noise)
            denoised = cv2.bilateralFilter(contrast_enhanced, d=7, sigmaColor=50, sigmaSpace=50)

            # 5. Sharpening Filter Kernel
            sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
            sharpened = cv2.filter2D(denoised, -1, sharpen_kernel)

            # 6. Adaptive / Otsu Thresholding
            _, thresholded = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            # 7. Deskew & Rotation Correction
            angle = self._calculate_deskew_angle(thresholded)
            metadata["deskew_angle"] = angle

            if abs(angle) > 0.3:
                thresholded = self._rotate_image(thresholded, angle)
                logger.info(f"Corrected scanned PDF page skew angle by {angle:.2f} degrees")

            metadata["processed"] = True
            return thresholded, metadata

        except Exception as e:
            logger.error(f"OpenCvPreprocessor error: {str(e)}")
            return None, metadata

    def _calculate_deskew_angle(self, thresh_img: Any) -> float:
        try:
            import cv2
            coords = np.column_stack(np.where(thresh_img < 128))
            if len(coords) < 10:
                return 0.0
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            elif angle > 45:
                angle = 90 - angle
            else:
                angle = -angle
            return float(angle)
        except Exception:
            return 0.0

    def _rotate_image(self, img: Any, angle: float) -> Any:
        try:
            import cv2
            (h, w) = img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            return rotated
        except Exception:
            return img


ImagePreprocessor = OpenCvPreprocessor

