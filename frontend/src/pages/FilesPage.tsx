import React, { useState, useEffect } from 'react';
import { Search, FileText, Folder, Eye, X, ShieldCheck, Sparkles, BookOpen } from 'lucide-react';
import { api } from '../services/api';

export const FilesPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [extension, setExtension] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [approvedDirs, setApprovedDirs] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    api.getApprovedDirectories().then(setApprovedDirs).catch(console.error);
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await api.searchFiles(query.trim(), extension.trim() || undefined);
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFile = async (file: any) => {
    setSelectedFile(file);
    setFileContent(null);
    setSummary('');
    try {
      const data = await api.readDocument(file.path);
      setFileContent(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSummarize = async () => {
    if (!fileContent?.content) return;
    setSummarizing(true);
    try {
      const prompt = `Summarize the following document content concisely, highlighting key points:\n\n${fileContent.content.slice(0, 4000)}`;
      const res = await api.sendMessage([{ role: 'user', content: prompt }]);
      if (res.success && res.content) {
        setSummary(res.content);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07090e] p-6 space-y-5 overflow-hidden">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
          <span>Document & File Intelligence</span>
          <span className="text-xs font-mono text-cyan px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/20">
            Read-Only Sandbox
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Safe search across approved directories with text, PDF, and DOCX extraction
        </p>
      </div>

      {/* Approved Directories Notice */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        <span className="text-[11px] text-slate-500 font-mono shrink-0 flex items-center space-x-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Allowlisted:</span>
        </span>
        {approvedDirs.map((d, i) => (
          <span
            key={i}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 truncate max-w-xs"
            title={d}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="glass-panel rounded-xl p-3 flex items-center space-x-3 border-cyan/20">
        <div className="flex items-center space-x-2 flex-1 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents by name or keyword..."
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
        </div>

        <select
          value={extension}
          onChange={(e) => setExtension(e.target.value)}
          className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan/50 font-mono"
        >
          <option value="">All Formats</option>
          <option value=".pdf">PDF Documents (.pdf)</option>
          <option value=".docx">Word Documents (.docx)</option>
          <option value=".md">Markdown (.md)</option>
          <option value=".txt">Plain Text (.txt)</option>
        </select>

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan/40 text-cyan text-xs font-semibold disabled:opacity-40 transition-all shadow-[0_0_10px_rgba(0,240,255,0.15)]"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Main Area: Results Grid and Document Viewer */}
      <div className="flex-1 flex space-x-4 min-h-0 overflow-hidden">
        {/* Results List */}
        <div className="w-1/2 overflow-y-auto space-y-2 pr-1">
          {results.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
              <Folder className="w-8 h-8 mb-2 opacity-40 text-cyan" />
              <span>Search for files in approved folders above.</span>
            </div>
          ) : (
            results.map((file, idx) => (
              <div
                key={idx}
                onClick={() => handleOpenFile(file)}
                className={`glass-card rounded-xl p-3 flex items-center justify-between border cursor-pointer transition-all ${
                  selectedFile?.path === file.path ? 'border-cyan bg-cyan-950/20' : 'border-slate-800/80 hover:border-cyan/40'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan border border-cyan/20">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-medium text-slate-200 truncate">{file.name}</div>
                    <div className="text-[10px] text-slate-500 truncate font-mono">{file.path}</div>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-2">
                  <span className="text-[10px] font-mono text-cyan uppercase">{file.extension}</span>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {Math.round(file.size / 1024)} KB
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Document Viewer & AI Summarizer */}
        <div className="w-1/2 glass-panel rounded-xl p-4 flex flex-col min-h-0 border-cyan/20 overflow-hidden">
          {selectedFile ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-100 truncate">{selectedFile.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{selectedFile.path}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSummarize}
                    disabled={summarizing || !fileContent?.content}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan/40 text-cyan text-xs font-medium disabled:opacity-40 transition-all"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{summarizing ? 'Summarizing...' : 'Summarize'}</span>
                  </button>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* AI Summary Box */}
              {summary && (
                <div className="mt-3 p-3 rounded-lg bg-purple-950/20 border border-purple-500/30 text-purple-200 text-xs font-sans max-h-36 overflow-y-auto">
                  <div className="font-semibold text-[11px] text-purple-300 mb-1 flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>F.R.I.D.A.Y. Document Summary</span>
                  </div>
                  <div className="whitespace-pre-wrap">{summary}</div>
                </div>
              )}

              {/* File Raw Content */}
              <div className="flex-1 overflow-y-auto mt-3 p-3 rounded-lg bg-slate-950/60 border border-slate-900 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                {fileContent?.content || 'Loading document contents...'}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
              <BookOpen className="w-8 h-8 mb-2 opacity-40 text-cyan" />
              <span>Select a file on the left to inspect or summarize.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
