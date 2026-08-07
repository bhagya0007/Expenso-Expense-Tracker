from app.ocr.ocr_engine import OcrEngine
from app.utils.logger import logger


class OcrServiceWrapper:
    def __init__(self, ocr_engine: OcrEngine = None):
        self.ocr_engine = ocr_engine or OcrEngine()

    def process_image(self, file_bytes: bytes) -> str:
        logger.info(f"OcrServiceWrapper processing {len(file_bytes)} image bytes")
        return self.ocr_engine.extract_text_from_bytes(file_bytes)
