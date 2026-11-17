from typing import List, Dict, Any
import pymupdf  # PyMuPDF
import re

def clean_text(text: str) -> str:
    """Normalize whitespace and strip spurious control characters."""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """Split text into overlapping chunks based on words."""
    words = text.split()
    if not words:
        return []
    if len(words) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunks.append(" ".join(chunk_words))
        if end == len(words):
            break
        start += (chunk_size - overlap)
    return chunks

class DocumentProcessor:
    @staticmethod
    def process_pdf(pdf_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        """
        Extract text from PDF preserving page numbers, and chunk text.
        Returns list of dicts: {'text': ..., 'source_file': ..., 'page_number': ...}
        """
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        chunks = []
        
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_num = page_idx + 1
            raw_text = page.get_text("text")
            cleaned = clean_text(raw_text)
            
            if not cleaned:
                continue
            
            page_chunks = chunk_text(cleaned, chunk_size=350, overlap=40)
            for chunk in page_chunks:
                chunks.append({
                    "text": chunk,
                    "source_file": filename,
                    "page_number": page_num
                })
        
        doc.close()
        return chunks
