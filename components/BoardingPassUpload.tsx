"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import ContentModal from "@/components/ContentModal";

interface BoardingPass {
  id: string;
  fileName: string;
  fileUrl: string;
  clientId: string;
  clientName: string;
  flightNumber?: string;
  uploadedAt: string;
  fileType?: string;
}

interface BoardingPassUploadProps {
  serviceId: string;
  flightNumber: string;
  clientId: string;
  clientName: string;
  existingPasses?: BoardingPass[];
  onUpload?: (file: File, clientId: string, flightNumber: string) => Promise<void>;
  onView?: (pass: BoardingPass) => void;
  onDelete?: (passId: string) => void;
}

export default function BoardingPassUpload({
  serviceId,
  flightNumber,
  clientId,
  clientName,
  existingPasses = [],
  onUpload,
  onView,
  onDelete,
}: BoardingPassUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPass, setPreviewPass] = useState<BoardingPass | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contentModal, setContentModal] = useState<{ url: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Find ALL passes for this client AND this flight
  const clientPasses = existingPasses.filter(
    p => p.clientName === clientName && p.flightNumber === flightNumber
  );

  // Reset selection when menu opens
  useEffect(() => {
    if (showMenu) {
      setSelectedIds(new Set(clientPasses.map(p => p.id))); // Select all by default
    }
  }, [showMenu]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!onUpload) return;
    
    const allowedExtensions = ["pdf", "png", "jpg", "jpeg", "pkpass", "gif"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    
    if (!allowedExtensions.includes(ext)) {
      alert("Allowed: PDF, PNG, JPG, GIF, Apple Wallet (.pkpass)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(file, clientId, flightNumber);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload boarding pass");
    } finally {
      setIsUploading(false);
      setDragOver(false);
    }
  }, [onUpload, clientId, flightNumber]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => handleFileSelect(file));
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOver(false);
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => handleFileSelect(file));
    e.target.value = "";
  }, [handleFileSelect]);

  const handlePreview = useCallback((pass: BoardingPass) => {
    setPreviewPass(pass);
    setShowPreview(true);
    setShowMenu(false);
  }, []);

  const handleDownload = useCallback(async (pass: BoardingPass) => {
    if (pass.fileUrl) {
      try {
        const response = await fetch(pass.fileUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = pass.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch {
        setContentModal({ url: pass.fileUrl, title: pass.fileName || "Boarding pass" });
      }
    }
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleShare = useCallback(async (method: "whatsapp" | "email") => {
    const passesToShare = clientPasses.filter(p => selectedIds.has(p.id));
    if (passesToShare.length === 0) {
      alert("Select at least one file to send");
      return;
    }
    
    setShowMenu(false);
    
    try {
      const files: File[] = [];
      for (const pass of passesToShare) {
        try {
          const response = await fetch(pass.fileUrl);
          const blob = await response.blob();
          const ext = pass.fileName.split(".").pop()?.toLowerCase();
          let mimeType = blob.type;
          if (ext === "pkpass") mimeType = "application/vnd.apple.pkpass";
          else if (ext === "pdf") mimeType = "application/pdf";
          files.push(new File([blob], pass.fileName, { type: mimeType }));
        } catch (err) {
          console.error("Failed to download:", pass.fileName, err);
        }
      }

      if (files.length === 0) {
        alert("Failed to download files");
        return;
      }

      // Try Web Share API (works on mobile)
      if (navigator.share && navigator.canShare?.({ files })) {
        await navigator.share({
          title: `Boarding Pass - ${flightNumber}`,
          text: `Boarding Pass for ${clientName} - Flight ${flightNumber}`,
          files,
        });
        return;
      }

      // Desktop fallback: download files first
      for (const file of files) {
        const url = window.URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }

      // Show instruction and open app
      const fileNames = passesToShare.map(p => p.fileName).join(", ");
      
      if (method === "whatsapp") {
        alert(`Files downloaded: ${fileNames}\n\nOpen WhatsApp and attach the downloaded files.`);
        setContentModal({ url: "https://web.whatsapp.com/", title: "WhatsApp" });
      } else {
        // Email - open mailto with just subject, user will attach files
        window.location.href = `mailto:?subject=${encodeURIComponent(`Boarding Pass - ${flightNumber}`)}`;
        alert(`Files downloaded: ${fileNames}\n\nAttach them to your email.`);
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  }, [clientPasses, selectedIds, clientName, flightNumber]);

  const handleDeletePass = useCallback((passId: string) => {
    if (onDelete) onDelete(passId);
    setShowMenu(false);
  }, [onDelete]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const getFileIcon = (pass: BoardingPass) => {
    const ext = pass.fileName.split(".").pop()?.toLowerCase();
    if (ext === "pkpass") return "📱";
    if (["png", "jpg", "jpeg", "gif"].includes(ext || "")) return "🖼️";
    return "📄";
  };

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".pdf,.png,.jpg,.jpeg,.gif,.pkpass"
      multiple
      onChange={handleInputChange}
      className="hidden"
    />
  );

  // If passes exist
  if (clientPasses.length > 0) {
    return (
      <>
        {fileInput}
        <div className="relative inline-flex items-center gap-1" ref={menuRef}>
          {/* Main BP button */}
          <button
            ref={buttonRef}
            onClick={() => setShowMenu(!showMenu)}
            className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 border border-green-300 rounded text-sm font-medium hover:bg-green-200"
          >
            <span>📋</span>
            <span>BP{clientPasses.length > 1 ? ` (${clientPasses.length})` : ""}</span>
            <span className="text-green-500">✓</span>
            <span className="text-xs">▼</span>
          </button>

          {/* Add file button */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`cursor-pointer p-1.5 rounded border-2 border-dashed transition-all ${
              dragOver
                ? "bg-blue-100 border-blue-400 text-blue-700 scale-110"
                : isUploading
                ? "bg-gray-100 border-gray-300 text-gray-400"
                : "bg-orange-50 border-orange-300 text-orange-600 hover:bg-orange-100"
            }`}
            title="Click or drag file here to add"
          >
            {isUploading ? "⏳" : dragOver ? "📥" : "➕"}
          </div>

          {/* Dropdown menu - fixed positioning */}
          {showMenu && (
            <div 
              className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl min-w-[200px] max-h-[400px] overflow-y-auto"
              style={{
                top: buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: buttonRef.current ? Math.min(buttonRef.current.getBoundingClientRect().left, window.innerWidth - 220) : 0,
              }}
            >
              {/* Files list */}
              {clientPasses.map((pass, idx) => (
                <div key={pass.id} className={`${idx > 0 ? 'border-t border-gray-100' : ''}`}>
                  <div className="px-3 py-2">
                    <span className="text-sm text-gray-700 truncate" title={pass.fileName}>
                      {pass.fileName.length > 22 ? pass.fileName.slice(0, 19) + "..." : pass.fileName}
                    </span>
                  </div>
                  <div className="px-2 pb-2 flex gap-1">
                    <button 
                      onClick={() => handlePreview(pass)} 
                      className="flex-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      View
                    </button>
                    <button 
                      onClick={() => handleDownload(pass)} 
                      className="flex-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      Download
                    </button>
                    <button 
                      onClick={() => handleDeletePass(pass.id)} 
                      className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="px-2 pb-2 flex gap-1">
                    <button
                      onClick={() => { setSelectedIds(new Set([pass.id])); handleShare("whatsapp"); }}
                      className="flex-1 px-2 py-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded"
                    >
                      WhatsApp
                    </button>
                    <button
                      onClick={() => { setSelectedIds(new Set([pass.id])); handleShare("email"); }}
                      className="flex-1 px-2 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded"
                    >
                      Email
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {showPreview && previewPass && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" onClick={() => setShowPreview(false)}>
            <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-auto m-4" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{getFileIcon(previewPass)}</span>
                  <span className="font-medium">{previewPass.fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDownload(previewPass)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                    Download
                  </button>
                  <button onClick={() => setShowPreview(false)} className="p-1.5 hover:bg-gray-100 rounded text-xl">
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4">
                {previewPass.fileName.toLowerCase().endsWith(".pkpass") ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">📱</div>
                    <p className="text-gray-600 mb-2">Apple Wallet Pass</p>
                    <p className="text-sm text-gray-500">Download to add to Apple Wallet</p>
                  </div>
                ) : previewPass.fileName.toLowerCase().endsWith(".pdf") ? (
                  <iframe src={previewPass.fileUrl} className="w-full h-[70vh] border rounded" title="PDF Preview" />
                ) : (
                  <img src={previewPass.fileUrl} alt="Boarding Pass" className="max-w-full h-auto mx-auto rounded" />
                )}
              </div>
            </div>
          </div>
        )}
      {contentModal && (
        <ContentModal
          isOpen
          onClose={() => setContentModal(null)}
          title={contentModal.title}
          url={contentModal.url}
        />
      )}
      </>
    );
  }

  // No passes yet - upload button
  return (
    <>
      {contentModal && (
        <ContentModal
          isOpen
          onClose={() => setContentModal(null)}
          title={contentModal.title}
          url={contentModal.url}
        />
      )}
      {fileInput}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium transition-all border-2 ${
          dragOver 
            ? "bg-blue-100 text-blue-700 border-blue-400 border-dashed scale-105 shadow-md"
            : isUploading
            ? "bg-gray-200 text-gray-400 border-gray-300"
            : "bg-orange-50 text-orange-600 border-orange-200 border-dashed hover:bg-orange-100 hover:border-orange-300"
        }`}
        title="Click or drag file to upload (PDF, Image, Wallet)"
      >
        {isUploading ? "⏳ Uploading..." : dragOver ? "📥 Drop here!" : "📋 +BP"}
      </div>
    </>
  );
}
