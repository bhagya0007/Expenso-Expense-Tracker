from typing import Tuple, Union
from app.utils.logger import logger


def detect_pdf_type_and_strategy(file_path_or_bytes: Union[bytes, str]) -> Tuple[str, str, int]:
    """
    Uses PyMuPDF (fitz) or fallback to detect whether a PDF is Digital or Scanned.
    
    If selectable text exists -> ("digital", "digital_pdf_extractor", page_count)
    Else -> ("scanned", "ocr_pdf_extractor", page_count)
    """
    total_pages = 0
    total_selectable_chars = 0
    
    try:
        import fitz  # PyMuPDF
        
        if isinstance(file_path_or_bytes, bytes):
            doc = fitz.open(stream=file_path_or_bytes, filetype="pdf")
        else:
            doc = fitz.open(file_path_or_bytes)
            
        total_pages = len(doc)
        
        for page in doc:
            text = page.get_text() or ""
            clean_text = "".join(text.split())
            total_selectable_chars += len(clean_text)
            
        doc.close()
        
    except ImportError:
        logger.warning("PyMuPDF (fitz) is not installed. Using fallback text detection.")
        try:
            from pypdf import PdfReader
            if isinstance(file_path_or_bytes, bytes):
                import io
                reader = PdfReader(io.BytesIO(file_path_or_bytes))
            else:
                reader = PdfReader(file_path_or_bytes)
            total_pages = len(reader.pages)
            for page in reader.pages:
                text = page.extract_text() or ""
                total_selectable_chars += len("".join(text.split()))
        except Exception as e:
            logger.error(f"Fallback PDF detection error: {str(e)}")
            total_pages = 1
            total_selectable_chars = 0
    except Exception as exc:
        logger.error(f"PyMuPDF detection error: {str(exc)}")
        total_pages = 1
        total_selectable_chars = 0

    if total_selectable_chars > 30:
        pdf_type = "digital"
        strategy = "digital_pdf_extractor"
    else:
        pdf_type = "scanned"
        strategy = "ocr_pdf_extractor"
        
    logger.info(
        f"PDF Detection Result: pages={total_pages}, chars={total_selectable_chars} -> pdfType='{pdf_type}', strategy='{strategy}'"
    )
    
    return pdf_type, strategy, total_pages
