import React, { useState, useRef, useEffect } from "react";
import { ref, set, onValue, remove } from "firebase/database";
import { db } from "../Firebase"; 
import { supabase } from "../../supabaseClient"; 
import { 
  UploadCloud, 
  CheckCircle, 
  Edit2, 
  Save, 
  Loader2,
  FolderOpen,
  FileText,
  Trash2,
  X,
  AlertCircle,
  ChevronRight
} from "lucide-react";

const DevUpload = () => {
  const fileInputRef = useRef(null);

  // --- UPLOAD STATE ---
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [customFileName, setCustomFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // --- ATTACHMENTS STATE ---
  const [attachments, setAttachments] = useState([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(true);

  // --- CUSTOM MODAL STATE ---
  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "success", 
    onConfirm: null,
  });

  const folders = [
    "Criminal Law",
    "Jurisprudence",
    "Law Enforcement",
    "Forensic Science",
    "Correctional Admin",
    "Criminalistics",
  ];

  // --- FETCH UPLOADED ATTACHMENTS (FIXED FETCH LOGIC) ---
  useEffect(() => {
    const lessonsRef = ref(db, "uploaded_lessons");
    
    setIsLoadingAttachments(true); // Ensure it starts in loading state

    const unsubscribe = onValue(lessonsRef, (snapshot) => {
      try {
        const data = snapshot.val();
        const fetchedAttachments = [];
        
        if (data) {
          Object.entries(data).forEach(([folderName, files]) => {
            if (files && typeof files === 'object') {
              Object.entries(files).forEach(([fileKey, fileData]) => {
                fetchedAttachments.push({
                  id: fileKey,
                  ...fileData,
                });
              });
            }
          });
        }

        fetchedAttachments.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setAttachments(fetchedAttachments);
      } catch (error) {
        console.error("Error processing data:", error);
      } finally {
        // 🔥 FIXED: Used the correct state setter name here
        setIsLoadingAttachments(false); 
      }
    }, (error) => {
      console.error("Firebase fetch error:", error);
      setIsLoadingAttachments(false);
    });

    return () => unsubscribe();
  }, []);

  const validateAndSetFile = (file) => {
    if (file) {
      setSelectedFile(file);
      const lastDotIndex = file.name.lastIndexOf(".");
      const nameWithoutExt = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
      setCustomFileName(nameWithoutExt);
    }
  };

  const handleFileChange = (e) => validateAndSetFile(e.target.files[0]);
  const triggerFileInput = () => fileInputRef.current?.click();
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleUpload = async () => {
    if (!selectedFolder || !selectedFile || !customFileName.trim()) {
      setModal({ isOpen: true, title: "Missing Info", message: "Complete all fields before uploading.", type: "error" });
      return;
    }

    setIsUploading(true);
    try {
      const lastDotIndex = selectedFile.name.lastIndexOf(".");
      const extension = lastDotIndex !== -1 ? selectedFile.name.substring(lastDotIndex) : "";
      const cleanCustomName = customFileName.trim().replace(/\s+/g, "_");
      const filePath = `${selectedFolder}/${cleanCustomName}${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("lessons")
        .upload(filePath, selectedFile, { upsert: true, contentType: selectedFile.type });

      if (uploadError) throw uploadError;

      await set(ref(db, `uploaded_lessons/${selectedFolder}/${cleanCustomName}`), {
        fileName: cleanCustomName,
        extension: extension,
        folder: selectedFolder,
        timestamp: Date.now(),
      });

      setModal({ isOpen: true, title: "Success!", message: `Uploaded: ${cleanCustomName}${extension}`, type: "success" });
      setSelectedFile(null); setSelectedFolder(null); setCustomFileName("");
    } catch (error) {
      setModal({ isOpen: true, title: "Upload Failed", message: error.message, type: "error" });
    } finally {
      setIsUploading(false);
    }
  };

  const executeDelete = async (file) => {
    setModal({ ...modal, isOpen: false });
    try {
      const filePath = `${file.folder}/${file.fileName}${file.extension}`;
      await supabase.storage.from("lessons").remove([filePath]);
      await remove(ref(db, `uploaded_lessons/${file.folder}/${file.fileName}`));
      setModal({ isOpen: true, title: "Deleted", message: "Material removed successfully.", type: "success" });
    } catch (error) {
      setModal({ isOpen: true, title: "Delete Failed", message: error.message, type: "error" });
    }
  };

  const confirmDelete = (file) => {
    setModal({
      isOpen: true,
      title: "Delete Material",
      message: `Are you sure you want to remove this document?`,
      type: "confirm",
      onConfirm: () => executeDelete(file)
    });
  };

  const closeModal = () => setModal({ ...modal, isOpen: false });

  return (
    <div className="max-w-5xl mx-auto font-['Inter',sans-serif] space-y-4 pb-12 animate-in fade-in duration-500">
      
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx" />


      {/* UPLOAD SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center border-b border-gray-100 pb-3">
          <div className="bg-[#f4e8e8] p-1.5 rounded-lg mr-2.5 text-[#800000]">
            <UploadCloud className="w-4 h-4" />
          </div>
          Add Review Content
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block pl-0.5">1. Select Folder</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {folders.map((folder) => (
                <button
                  key={folder}
                  onClick={() => setSelectedFolder(folder)}
                  className={`px-2 py-2 rounded-lg border text-[10px] font-bold transition-all text-center h-12 flex items-center justify-center ${
                    selectedFolder === folder 
                      ? "bg-[#f4e8e8] border-[#800000] text-[#800000] shadow-sm ring-1 ring-[#800000]" 
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {folder}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block pl-0.5">2. Document (.PDF, .DOCX)</label>
              <div onClick={triggerFileInput} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                className={`w-full py-2.5 px-3 border-2 border-dashed rounded-lg flex items-center transition-all text-xs font-bold cursor-pointer h-[46px] ${
                  isDragging ? "bg-[#f4e8e8] border-[#800000]" : selectedFile ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100"
                }`}>
                <FileText className={`w-4 h-4 mr-2 ${isDragging ? 'animate-bounce text-[#800000]' : ''}`} />
                <span className="truncate">{isDragging ? "Drop file..." : selectedFile ? selectedFile.name : "Click or drag document..."}</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block pl-0.5">3. Display Name</label>
              <div className="relative group">
                <input type="text" value={customFileName} onChange={(e) => setCustomFileName(e.target.value)} placeholder="Title..."
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#f4e8e8] focus:border-[#800000] outline-none transition-all text-xs font-bold text-gray-700 h-[46px]" />
                <Edit2 className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-3.5" />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-50">
            <button onClick={handleUpload} disabled={isUploading || !selectedFile || !selectedFolder || !customFileName.trim()}
              className="w-full py-2.5 rounded-lg bg-[#800000] text-white text-xs font-bold uppercase tracking-widest shadow-sm hover:bg-[#6a0000] transition-all flex items-center justify-center disabled:bg-gray-100 disabled:text-gray-400">
              {isUploading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {isUploading ? "Uploading..." : "Save & Post Material"}
            </button>
          </div>
        </div>
      </div>

      {/* MATERIALS LIBRARY SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center">
            <FolderOpen className="w-4 h-4 mr-2 text-[#800000]" />
            <h3 className="text-sm font-bold text-gray-800">Materials Library</h3>
          </div>
          <span className="text-[10px] font-black bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded uppercase">
            {attachments.length} Items
          </span>
        </div>

        <div className="p-4">
          {isLoadingAttachments ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="animate-spin text-[#800000] w-6 h-6" />
            </div>
          ) : attachments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-400">No review materials posted yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {attachments.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-[#e2c7c7] transition-all group shadow-sm">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 ${file.extension === '.pdf' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate pr-2">{file.fileName}{file.extension}</p>
                      <div className="flex items-center mt-0.5 gap-2">
                        <span className="text-[9px] font-black uppercase text-[#800000] bg-[#f4e8e8] px-1.5 py-0.5 rounded leading-none">{file.folder}</span>
                        <span className="text-[10px] text-gray-400 font-medium">{new Date(file.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => confirmDelete(file)} className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FEEDBACK MODAL */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl p-6 max-w-xs w-full shadow-2xl text-center border border-gray-100">
            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4 ${modal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : modal.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
              {modal.type === 'success' ? <CheckCircle size={24} /> : modal.type === 'error' ? <X size={24} /> : <AlertCircle size={24} />}
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1.5">{modal.title}</h3>
            <p className="text-gray-500 text-xs font-medium mb-6 leading-relaxed">{modal.message}</p>
            <div className="flex gap-2">
              {modal.type === 'confirm' ? (
                <>
                  <button onClick={closeModal} className="flex-1 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg">Cancel</button>
                  <button onClick={modal.onConfirm} className="flex-1 py-2 bg-red-600 text-white text-xs font-bold rounded-lg">Delete</button>
                </>
              ) : (
                <button onClick={closeModal} className="w-full py-2 bg-gray-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg">Okay</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevUpload;