import numpy as np
import faiss
import json
import os
import threading
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types

from app.config import settings
from app.services.embedding_service import get_embedding_model
from app.schemas.rag import Citation, QueryResponse

class RAGEngine:
    def __init__(self, storage_dir: Optional[Path] = None):
        self.dimension = 384  # Dimension for all-MiniLM-L6-v2
        self.index = faiss.IndexFlatIP(self.dimension)
        self.doc_store: List[Dict[str, Any]] = []
        self._client: Optional[genai.Client] = None
        # Each saved snapshot contains an index and its matching metadata.
        # The manifest is replaced last, so startup never loads a half-written snapshot.
        self.storage_dir = Path(storage_dir or (settings.UPLOAD_DIR / "faiss_store"))
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self.load()

    def _manifest_path(self) -> Path:
        return self.storage_dir / "manifest.json"

    def _persist(self) -> None:
        """Persist FAISS and its metadata as one versioned snapshot."""
        snapshot_id = uuid.uuid4().hex
        index_name = f"index-{snapshot_id}.faiss"
        metadata_name = f"metadata-{snapshot_id}.json"
        index_path = self.storage_dir / index_name
        metadata_path = self.storage_dir / metadata_name
        index_tmp = self.storage_dir / f".{index_name}.tmp"
        metadata_tmp = self.storage_dir / f".{metadata_name}.tmp"
        manifest_tmp = self.storage_dir / ".manifest.json.tmp"

        try:
            faiss.write_index(self.index, str(index_tmp))
            with metadata_tmp.open("w", encoding="utf-8") as handle:
                json.dump(self.doc_store, handle, ensure_ascii=False)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(index_tmp, index_path)
            os.replace(metadata_tmp, metadata_path)

            manifest = {
                "version": 1,
                "dimension": self.dimension,
                "count": len(self.doc_store),
                "index_file": index_name,
                "metadata_file": metadata_name,
            }
            with manifest_tmp.open("w", encoding="utf-8") as handle:
                json.dump(manifest, handle)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(manifest_tmp, self._manifest_path())
            self._remove_old_snapshots(index_name, metadata_name)
        finally:
            for path in (index_tmp, metadata_tmp, manifest_tmp):
                if path.exists():
                    path.unlink()

    def _remove_old_snapshots(self, keep_index: str, keep_metadata: str) -> None:
        """Remove obsolete snapshots after the new manifest is safely committed."""
        for path in self.storage_dir.iterdir():
            if path.name.startswith("index-") and path.name != keep_index:
                path.unlink(missing_ok=True)
            elif path.name.startswith("metadata-") and path.name != keep_metadata:
                path.unlink(missing_ok=True)

    def load(self) -> bool:
        """Load the last complete persisted snapshot, if one exists."""
        manifest_path = self._manifest_path()
        if not manifest_path.exists():
            return False

        with self._lock:
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                if manifest.get("version") != 1 or manifest.get("dimension") != self.dimension:
                    raise ValueError("Unsupported FAISS snapshot version or embedding dimension.")

                index_path = self.storage_dir / manifest["index_file"]
                metadata_path = self.storage_dir / manifest["metadata_file"]
                loaded_index = faiss.read_index(str(index_path))
                loaded_store = json.loads(metadata_path.read_text(encoding="utf-8"))

                if loaded_index.d != self.dimension:
                    raise ValueError("Persisted FAISS index has an unexpected dimension.")
                if loaded_index.ntotal != len(loaded_store) or loaded_index.ntotal != manifest.get("count"):
                    raise ValueError("FAISS index and document metadata are out of sync.")

                self.index = loaded_index
                self.doc_store = loaded_store
                return True
            except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
                # Do not silently replace a corrupt snapshot with an empty index.
                raise RuntimeError(f"Could not load persisted PrepE RAG index: {exc}") from exc

    @property
    def client(self) -> Optional[genai.Client]:
        if self._client is None and settings.GEMINI_API_KEY:
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    def reset(self):
        """Clear the in-memory index and its persisted snapshot."""
        with self._lock:
            self.index = faiss.IndexFlatIP(self.dimension)
            self.doc_store = []
            self._persist()

    def get_total_chunks(self) -> int:
        with self._lock:
            return len(self.doc_store)

    def add_documents(self, chunks: List[Dict[str, Any]]) -> int:
        """Add text chunks with metadata to FAISS index and persist the snapshot."""
        if not chunks:
            return 0

        texts = [chunk["text"] for chunk in chunks]
        embed_model = get_embedding_model()
        embeddings = embed_model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        embeddings = np.asarray(embeddings, dtype=np.float32)
        if embeddings.ndim != 2 or embeddings.shape[1] != self.dimension:
            raise ValueError(f"Expected embeddings with dimension {self.dimension}.")

        # Normalize vectors for cosine similarity using an inner-product index.
        faiss.normalize_L2(embeddings)
        with self._lock:
            previous_index = self.index
            previous_store = self.doc_store
            self.index = faiss.clone_index(previous_index)
            self.doc_store = list(previous_store) + [dict(chunk) for chunk in chunks]
            try:
                self.index.add(embeddings)
                self._persist()
            except Exception:
                self.index = previous_index
                self.doc_store = previous_store
                raise
        return len(chunks)

    def retrieve(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Retrieve most relevant chunks for a query."""
        embed_model = get_embedding_model()
        query_vector = embed_model.encode([query], convert_to_numpy=True, show_progress_bar=False)
        query_vector = np.asarray(query_vector, dtype=np.float32)
        faiss.normalize_L2(query_vector)

        with self._lock:
            if len(self.doc_store) == 0:
                return []
            actual_k = min(top_k, len(self.doc_store))
            distances, indices = self.index.search(query_vector, actual_k)

            results = []
            for dist, idx in zip(distances[0], indices[0]):
                if 0 <= idx < len(self.doc_store):
                    item = dict(self.doc_store[idx])
                    item["score"] = float(dist)
                    results.append(item)
            return results

    def answer_query(self, query: str, top_k: int = 3) -> QueryResponse:
        """Execute RAG query with strict grounding, citations, and fallback."""
        retrieved_chunks = self.retrieve(query, top_k=top_k)
        
        if not retrieved_chunks:
            return QueryResponse(
                answer="No documents have been indexed yet. Please upload study notes first.",
                citations=[],
                found_in_notes=False,
                fallback_message="No notes indexed."
            )
        
        # Format context with citations metadata
        context_blocks = []
        citations_list = []
        for i, chunk in enumerate(retrieved_chunks, 1):
            context_blocks.append(
                f"[Chunk {i}] File: {chunk['source_file']} (Page {chunk['page_number']}):\n{chunk['text']}"
            )
            # Create citation preview (first 180 chars)
            snippet = chunk['text'][:180] + "..." if len(chunk['text']) > 180 else chunk['text']
            citations_list.append(Citation(
                source_file=chunk["source_file"],
                page_number=chunk["page_number"],
                snippet=snippet
            ))
            
        context_str = "\n\n".join(context_blocks)
        
        system_instruction = (
            "You are PrepE, an AI-powered academic exam preparation assistant.\n"
            "Answer the student's question strictly using ONLY the provided context chunks from their notes.\n\n"
            "CRITICAL RULES:\n"
            "1. If the provided context does NOT contain enough information to answer the question accurately, "
            "you MUST reply with this exact phrase:\n"
            "'Information not available in provided notes.'\n"
            "Do NOT attempt to answer from outside knowledge if the notes do not cover it.\n"
            "2. If the context does contain the answer, provide a clear, concise, and structured explanation.\n"
            "3. Ground your explanation directly in the provided text."
        )
        
        prompt = (
            f"Context from uploaded notes:\n{context_str}\n\n"
            f"Student Question: {query}\n\n"
            f"Answer:"
        )
        
        # Check if Gemini Client is available
        client = self.client
        if client is None:
            # Mock / Demo fallback mode for offline or test environments
            # Check if any chunk has simple keyword match
            STOP_WORDS = {"and", "the", "for", "are", "what", "how", "with", "from", "that", "this", "can", "has", "have"}
            query_words = set(query.lower().split()) - STOP_WORDS
            matched = any(any(w in chunk["text"].lower() for w in query_words if len(w) >= 3) for chunk in retrieved_chunks)
            if matched:
                return QueryResponse(
                    answer=f"[Offline Mock Mode] Based on your notes: {retrieved_chunks[0]['text'][:250]}...",
                    citations=citations_list,
                    found_in_notes=True
                )
            else:
                return QueryResponse(
                    answer="Information not available in provided notes.",
                    citations=[],
                    found_in_notes=False,
                    fallback_message="Information not available in provided notes."
                )

        try:
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.2,
                )
            )
            raw_answer = response.text.strip()
            
            # Check for fallback triggers
            is_fallback = "information not available in provided notes" in raw_answer.lower()
            if is_fallback:
                return QueryResponse(
                    answer="Information not available in provided notes.",
                    citations=[],
                    found_in_notes=False,
                    fallback_message="Information not available in provided notes."
                )
            
            return QueryResponse(
                answer=raw_answer,
                citations=citations_list,
                found_in_notes=True
            )
        except Exception as e:
            # If network/API error occurs (e.g. offline, unauthenticated), fallback gracefully to offline matching
            STOP_WORDS = {"and", "the", "for", "are", "what", "how", "with", "from", "that", "this", "can", "has", "have"}
            query_words = set(query.lower().split()) - STOP_WORDS
            matched = any(any(w in chunk["text"].lower() for w in query_words if len(w) >= 3) for chunk in retrieved_chunks)
            if matched:
                return QueryResponse(
                    answer=f"[Offline Fallback] Based on your notes: {retrieved_chunks[0]['text'][:250]}...",
                    citations=citations_list,
                    found_in_notes=True
                )
            else:
                return QueryResponse(
                    answer="Information not available in provided notes.",
                    citations=[],
                    found_in_notes=False,
                    fallback_message="Information not available in provided notes."
                )

# Global singleton instance
rag_service = RAGEngine()
