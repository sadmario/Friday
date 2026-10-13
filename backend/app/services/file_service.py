import os
from pathlib import Path
from typing import Optional, List, Dict
import pypdf
import docx
from app.core.config import settings
from app.core.security import is_path_allowed
from app.database.sqlite import log_action

class FileService:
    def __init__(self):
        pass

    def search_files(self, query: str, extension: Optional[str] = None, base_dir: Optional[str] = None) -> List[Dict]:
        results = []
        search_dirs = [base_dir] if base_dir and is_path_allowed(base_dir) else settings.allowed_directories
        
        query_lower = query.lower()
        if extension and not extension.startswith('.'):
            extension = f".{extension}"
        ext_lower = extension.lower() if extension else None

        for directory in search_dirs:
            p = Path(directory)
            if not p.exists() or not p.is_dir():
                continue
            try:
                # Walk with depth limit of 4 to prevent recursive deep crawls
                for root, dirs, files in os.walk(p):
                    # Filter out hidden or protected directories
                    dirs[:] = [d for d in dirs if not d.startswith('.') and d.lower() not in ['node_modules', '$recycle.bin', 'appdata']]
                    
                    for f in files:
                        file_path = Path(root) / f
                        if not is_path_allowed(str(file_path)):
                            continue
                        
                        if ext_lower and file_path.suffix.lower() != ext_lower:
                            continue
                        
                        if query_lower in f.lower():
                            stat = file_path.stat()
                            results.append({
                                "name": f,
                                "path": str(file_path),
                                "size": stat.st_size,
                                "extension": file_path.suffix.lower(),
                                "modified_at": stat.st_mtime
                            })
                            if len(results) >= 50:
                                return results
            except Exception as e:
                print(f"[FileService] Error scanning {directory}: {e}")
                
        return results

    def read_document_content(self, file_path_str: str, max_chars: int = 15000) -> Dict:
        if not is_path_allowed(file_path_str):
            return {
                "success": False,
                "error": f"Access denied: '{file_path_str}' is outside approved directories."
            }
        
        path = Path(file_path_str)
        if not path.exists():
            return {"success": False, "error": f"File '{file_path_str}' not found."}
        
        suffix = path.suffix.lower()
        content = ""
        try:
            if suffix in ['.txt', '.md', '.json', '.yaml', '.yml', '.py', '.ts', '.tsx', '.js', '.css', '.html']:
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read(max_chars)
            elif suffix == '.pdf':
                reader = pypdf.PdfReader(str(path))
                pages_text = []
                for idx, page in enumerate(reader.pages[:20]):
                    t = page.extract_text() or ""
                    pages_text.append(f"--- Page {idx+1} ---\n{t}")
                    if sum(len(p) for p in pages_text) > max_chars:
                        break
                content = "\n".join(pages_text)[:max_chars]
            elif suffix in ['.docx', '.doc']:
                doc = docx.Document(str(path))
                paras = [p.text for p in doc.paragraphs if p.text.strip()]
                content = "\n".join(paras)[:max_chars]
            else:
                return {
                    "success": False,
                    "error": f"Unsupported document format '{suffix}'. Supported: .pdf, .docx, .txt, .md"
                }
            
            return {
                "success": True,
                "name": path.name,
                "path": str(path),
                "extension": suffix,
                "content": content,
                "length": len(content),
                "truncated": len(content) >= max_chars
            }
        except Exception as e:
            return {"success": False, "error": f"Failed to extract document: {str(e)}"}

    def list_approved_directories(self) -> List[str]:
        return [d for d in settings.allowed_directories if Path(d).exists()]

file_service = FileService()
