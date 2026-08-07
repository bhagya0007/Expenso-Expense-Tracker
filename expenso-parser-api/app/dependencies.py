from app.services.parser_service import ParserService
from app.services.ocr_service import OcrServiceWrapper
from app.services.validation_service import ValidationService
from app.parser.pdf_parser import PdfParser
from app.ocr.ocr_engine import OcrEngine


def get_validation_service() -> ValidationService:
    return ValidationService()


def get_parser_service() -> ParserService:
    """
    Factory that wires up the parsing pipeline and returns a
    ready-to-use ParserService instance.
    ParserService creates its own PdfParser and ValidationService internally.
    """
    return ParserService()


def get_ocr_service() -> OcrServiceWrapper:
    ocr_engine = OcrEngine()
    return OcrServiceWrapper(ocr_engine=ocr_engine)
