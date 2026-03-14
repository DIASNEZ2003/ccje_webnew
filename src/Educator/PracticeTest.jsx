import React, { useState, useRef, useEffect } from "react";
import { ref, set, onValue, remove, update } from "firebase/database";
import { db } from "../Firebase"; 
import mammoth from "mammoth";
import { 
  FileText, 
  UploadCloud, 
  CheckCircle, 
  Edit2, 
  Save, 
  Loader2,
  FolderOpen,
  X,
  AlertCircle,
  Layers,
  ChevronRight,
  Trash2,
  BookOpen
} from "lucide-react";

// 🚀 GROQ API CONFIGURATION 🚀
const GROQ_API_KEY = "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";

const PracticeTest = () => {
  const fileInputRef = useRef(null);

  // --- STATE: UPLOAD & ANALYSIS ---
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [customFileName, setCustomFileName] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // --- STATE: EXISTING DATABASE ---
  const [existingData, setExistingData] = useState({});
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  // --- STATE: MODALS & EDITING ---
  const [feedbackModal, setFeedbackModal] = useState({ isOpen: false, title: "", message: "", type: "success" });
  
  // NEW: Added setKey to isolate the modal view
  const [viewModal, setViewModal] = useState({ isOpen: false, subject: "", setKey: "" });
  
  const [editingQuestionId, setEditingQuestionId] = useState(null); 
  const [editFormData, setEditFormData] = useState({ question: "", answer: "" });
  
  const [isDragging, setIsDragging] = useState(false);

  const folders = [
    "Criminal Law",
    "Jurisprudence",
    "Law Enforcement",
    "Forensic Science",
    "Correctional Admin",
    "Criminalistics",
  ];
  
  const sets = ["Set A", "Set B", "Set C"];

  // --- FETCH EXISTING QUIZZES ---
  useEffect(() => {
    const quizzesRef = ref(db, "practice_quizzes");
    const unsubscribe = onValue(quizzesRef, (snapshot) => {
      if (snapshot.exists()) {
        setExistingData(snapshot.val());
      } else {
        setExistingData({});
      }
      setIsLoadingExisting(false);
    });

    return () => unsubscribe();
  }, []);

  // --- 1. PICK DOCUMENT (DRAG AND DROP) ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    validateAndSetFile(file);
  };

  const validateAndSetFile = (file) => {
    if (file && file.name.endsWith('.docx')) {
      setSelectedFile(file);
      setGeneratedQuestions([]); 
      const lastDotIndex = file.name.lastIndexOf(".");
      const nameWithoutExt = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
      setCustomFileName(nameWithoutExt);
    } else if (file) {
      showFeedback("Invalid File", "Please upload a .docx format file.", "error");
    }
  };

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

  const showFeedback = (title, message, type = "success") => {
    setFeedbackModal({ isOpen: true, title, message, type });
  };

  // --- 2. ACCURATE AI ANALYSIS ---
  const handleAnalyzeFile = async () => {
    if (!selectedFolder || !selectedSet || !selectedFile || !customFileName.trim()) {
      showFeedback("Missing Information", "Please complete all selection steps first.", "error");
      return;
    }

    setIsAnalyzing(true);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      let extractedText = result.value;

      if (!extractedText || !extractedText.trim()) throw new Error("Document is empty or cannot be read.");

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `You are a strict JSON data extractor. TASK: Extract EVERY multiple-choice question from the text.
                RULES:
                1. Return ONLY a raw JSON object. NO markdown formatting, NO backticks, NO explanations.
                2. Use the answer key provided at the very bottom of the document to assign the correct answer to each question. DO NOT try to solve the questions yourself.
                3. The JSON MUST follow this exact structure: {"questions": [{"question":"...", "answer":"..."}]}`
              },
              {
                role: "user",
                content: `Process all questions from this text: ${extractedText}`,
              },
            ],
            temperature: 0.1, 
            max_tokens: 8000, 
            response_format: { type: "json_object" },
          }),
        }
      );

      if (!response.ok) throw new Error("API Connection Failed");

      const data = await response.json();
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Received an invalid response structure from the AI.");
      }

      let rawContent = data.choices[0].message.content;
      rawContent = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();

      let aiContent;
      try {
        aiContent = JSON.parse(rawContent);
      } catch (e) {
        throw new Error("AI returned malformed data. Try analyzing again.");
      }

      let questionsArray = [];
      if (Array.isArray(aiContent)) {
        questionsArray = aiContent;
      } else if (aiContent && Array.isArray(aiContent.questions)) {
        questionsArray = aiContent.questions;
      } else if (aiContent && typeof aiContent === 'object') {
        const fallbackArray = Object.values(aiContent).find(val => Array.isArray(val));
        if (fallbackArray) questionsArray = fallbackArray;
      }

      if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
        throw new Error("Could not detect a valid list of questions from the document.");
      }

      const safeQuestions = questionsArray.map((q) => ({
        question: q?.question || "Untitled Question (AI Error)",
        answer: q?.answer || "Unknown Answer"
      }));

      setGeneratedQuestions(safeQuestions);
      showFeedback(
        "Extraction Complete",
        `Successfully captured ${safeQuestions.length} questions. You can review them below before saving.`,
        "success"
      );
    } catch (error) {
      console.error(error);
      setGeneratedQuestions([]);
      showFeedback("Analysis Error", error.message || "Failed to process questions. Try again.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- 3. SAVE TO DATABASES & RESET FORM ---
  const handleSaveQuiz = async () => {
    setIsUploading(true);
    try {
      const cleanName = customFileName.trim().replace(/\s+/g, "_");
      const filePath = `${selectedFolder}/${selectedSet}/${cleanName}.docx`;

      // Upload Document to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("practice_tests")
        .upload(filePath, selectedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Save questions to Firebase Realtime DB
      await set(
        ref(db, `practice_quizzes/${selectedFolder}/${selectedSet}/${cleanName}`),
        generatedQuestions
      );

      showFeedback("Saved Successfully!", "The practice test document and generated questions were saved.", "success");

      // --- RESET STATES ---
      setSelectedFolder(null);
      setSelectedSet(null);
      setSelectedFile(null);
      setCustomFileName("");
      setGeneratedQuestions([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

    } catch (error) {
      showFeedback("Save Error", error.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  // --- 4. VIEW & EDIT EXISTING QUIZZES ---
  const startEditingQuestion = (quizId, idx, questionObj) => {
    setEditingQuestionId(`${quizId}-${idx}`);
    setEditFormData({ question: questionObj.question, answer: questionObj.answer });
  };

  const cancelEditing = () => {
    setEditingQuestionId(null);
    setEditFormData({ question: "", answer: "" });
  };

  const saveEditedQuestion = async (setKey, quizKey, idx) => {
    try {
      const currentSubjectData = existingData[viewModal.subject];
      const currentQuestions = [...currentSubjectData[setKey][quizKey]];
      
      currentQuestions[idx] = { 
        ...currentQuestions[idx], 
        question: editFormData.question, 
        answer: editFormData.answer 
      };

      await set(ref(db, `practice_quizzes/${viewModal.subject}/${setKey}/${quizKey}`), currentQuestions);
      setEditingQuestionId(null);
    } catch (error) {
      alert("Failed to save edit: " + error.message);
    }
  };

  const deleteQuestion = async (setKey, quizKey, idx) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;

    try {
      const currentSubjectData = existingData[viewModal.subject];
      const currentQuestions = [...currentSubjectData[setKey][quizKey]];
      
      currentQuestions.splice(idx, 1);

      if (currentQuestions.length === 0) {
        await remove(ref(db, `practice_quizzes/${viewModal.subject}/${setKey}/${quizKey}`));
      } else {
        await set(ref(db, `practice_quizzes/${viewModal.subject}/${setKey}/${quizKey}`), currentQuestions);
      }
    } catch (error) {
      alert("Failed to delete: " + error.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto font-['Inter',sans-serif] space-y-4 pb-12">
      
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".docx" />

     

      {/* ---------------------------------------------------------
          UPLOAD AND ANALYZE SECTION (COMPACT)
      --------------------------------------------------------- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center border-b border-gray-100 pb-3">
          <div className="bg-[#f4e8e8] p-1.5 rounded-lg mr-2.5 text-[#800000]">
            <UploadCloud className="w-4 h-4" />
          </div>
          Upload New Test
        </h3>

        <div className="space-y-4">
          {/* Step 1: Area Selection */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block pl-0.5">1. Select Subject Area</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {folders.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFolder(f)}
                  className={`px-3 py-2 rounded-lg border text-[10px] font-bold transition-all text-center ${
                    selectedFolder === f 
                      ? "bg-[#f4e8e8] border-[#800000] text-[#800000] shadow-sm ring-1 ring-[#800000]" 
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 2: Set Selection */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block pl-0.5">2. Select Set</label>
              <div className="flex gap-2">
                {sets.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSet(s)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all text-center ${
                      selectedSet === s 
                        ? "bg-[#f4e8e8] border-[#800000] text-[#800000] shadow-sm ring-1 ring-[#800000]" 
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Document Selection */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block pl-0.5">3. Upload File (.DOCX)</label>
              <div
                onClick={triggerFileInput}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full py-2 px-3 border-2 border-dashed rounded-lg flex items-center transition-all text-xs font-bold cursor-pointer ${
                  isDragging 
                    ? "bg-[#f4e8e8] border-[#800000] text-[#800000]" 
                    : selectedFile 
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700" 
                      : "bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100 hover:border-gray-400"
                }`}
              >
                <FileText className={`w-4 h-4 mr-2 transition-transform ${isDragging ? 'animate-bounce text-[#800000]' : ''}`} />
                <span className="truncate select-none">
                  {isDragging ? "Drop document here..." : selectedFile ? selectedFile.name : "Click or drag .DOCX here..."}
                </span>
              </div>
            </div>
          </div>

          {/* Step 4: AI Analysis */}
          {selectedFile && generatedQuestions.length === 0 && (
            <div className="pt-2 border-t border-gray-50 space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="relative">
                <Edit2 className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  placeholder="Name this quiz (e.g. Chapter_1_Quiz)"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f4e8e8] focus:border-[#800000] outline-none text-xs font-bold text-gray-800 transition-all shadow-sm"
                />
              </div>

              <button
                onClick={handleAnalyzeFile}
                disabled={isAnalyzing}
                className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-widest shadow-sm flex items-center justify-center hover:bg-black transition-all active:scale-[0.98]"
              >
                {isAnalyzing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Layers className="w-4 h-4 mr-2" />}
                {isAnalyzing ? "Analyzing Document..." : "Extract Questions"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------
          PREVIEW SECTION
      --------------------------------------------------------- */}
      {generatedQuestions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" /> Extraction Complete
            </h3>
            <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider">
              {generatedQuestions.length} Found
            </span>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg max-h-[300px] overflow-y-auto mb-4 p-3 space-y-3">
            {generatedQuestions.map((item, index) => (
              <div key={index} className="p-3 border border-gray-100 bg-white rounded-lg shadow-sm">
                <span className="text-[9px] font-black text-gray-400 mb-1.5 block tracking-widest uppercase">Q{index + 1}</span>
                <p className="text-gray-900 font-bold text-xs mb-2 leading-relaxed">{item.question}</p>
                <div className="inline-flex items-center bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-100 truncate max-w-full">
                  Ans: {item.answer}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveQuiz}
            disabled={isUploading}
            className="w-full py-2.5 rounded-lg bg-[#800000] text-white text-xs font-bold uppercase tracking-widest shadow-sm hover:bg-[#6a0000] transition-all flex items-center justify-center active:scale-[0.98]"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {isUploading ? "Saving to Database..." : `Save Quiz to Firebase`}
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------
          EXISTING DATA SECTION (SEPARATED BY SET)
      --------------------------------------------------------- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center">
          <FolderOpen className="w-4 h-4 mr-2 text-[#800000]" />
          <h3 className="text-sm font-bold text-gray-800">Database Repository</h3>
        </div>

        {isLoadingExisting ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="animate-spin text-[#800000] w-6 h-6" />
          </div>
        ) : Object.keys(existingData).length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-500">No practice tests saved yet.</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => {
              const folderData = existingData[folder] || {};
              const availableSets = sets.filter(s => folderData[s] && Object.keys(folderData[s]).length > 0);

              if (availableSets.length === 0) return null;

              return (
                <div key={folder} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col">
                  <h4 className="font-bold text-gray-900 text-sm border-b border-gray-100 pb-2 mb-3">
                    {folder}
                  </h4>
                  <div className="space-y-2 flex-1">
                    {availableSets.map(setKey => {
                      const quizzesInSet = folderData[setKey];
                      
                      let qCount = 0;
                      let quizCount = 0;
                      Object.values(quizzesInSet).forEach(qArray => {
                        if (Array.isArray(qArray)) {
                          qCount += qArray.length;
                          quizCount++;
                        }
                      });

                      return (
                        <div key={setKey} className="flex items-center justify-between bg-gray-50 rounded-lg p-2 border border-gray-100">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 pl-1">{setKey}</span>
                            <span className="text-[9px] font-bold text-gray-400 pl-1 mt-0.5">
                              {quizCount} Quiz{quizCount > 1 ? 'zes' : ''} • {qCount} Qs
                            </span>
                          </div>
                          <button
                            onClick={() => setViewModal({ isOpen: true, subject: folder, setKey: setKey })}
                            className="text-[9px] font-bold uppercase tracking-widest text-gray-500 hover:text-[#800000] flex items-center bg-white border border-gray-200 px-2 py-1.5 rounded shadow-sm hover:border-[#e2c7c7] transition-all"
                          >
                            Manage <ChevronRight className="w-3 h-3 ml-0.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------
          VIEW & EDIT EXISTING QUESTIONS MODAL (ISOLATED TO SET)
      --------------------------------------------------------- */}
      {viewModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-gray-100">
            
            <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/80">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <div className="bg-[#e2c7c7] p-1.5 rounded-lg mr-2.5 shadow-sm">
                    <BookOpen className="w-4 h-4 text-[#800000]" />
                  </div>
                  {viewModal.subject}
                </h3>
                <div className="flex items-center mt-1.5 pl-1 gap-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Practice Tests</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                  <span className="text-[10px] text-[#800000] uppercase tracking-widest font-black">{viewModal.setKey}</span>
                </div>
              </div>
              <button 
                onClick={() => { setViewModal({ isOpen: false, subject: "", setKey: "" }); setEditingQuestionId(null); }}
                className="p-1.5 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
              {(() => {
                const currentSubjectData = existingData[viewModal.subject] || {};
                const quizzesInSet = currentSubjectData[viewModal.setKey];
                
                if (!quizzesInSet || Object.keys(quizzesInSet).length === 0) return <p className="text-center text-xs text-gray-400 py-10 font-bold uppercase tracking-widest">No Quizzes Found</p>;

                return Object.keys(quizzesInSet).map((quizKey) => {
                  const questions = quizzesInSet[quizKey];
                  if (!Array.isArray(questions)) return null;

                  return (
                    <div key={quizKey} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4 last:mb-0">
                      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex justify-between items-center">
                        <h4 className="font-bold text-gray-900 text-sm flex items-center">
                          <FileText className="w-3.5 h-3.5 text-[#800000] mr-2" />
                          {quizKey.replace(/_/g, " ")}
                        </h4>
                        <span className="text-[10px] font-black bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded uppercase tracking-wider">
                          {questions.length} Qs
                        </span>
                      </div>
                      
                      <div className="divide-y divide-gray-50">
                        {questions.map((q, idx) => {
                          const qId = `${quizKey}-${idx}`;
                          const isEditing = editingQuestionId === qId;

                          return (
                            <div key={idx} className="p-4 relative group hover:bg-[#f4e8e8]/30 transition-colors">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <textarea 
                                    value={editFormData.question}
                                    onChange={(e) => setEditFormData({...editFormData, question: e.target.value})}
                                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-[#f4e8e8] focus:border-[#800000] outline-none resize-none"
                                    rows={2}
                                  />
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Answer:</span>
                                    <input 
                                      type="text"
                                      value={editFormData.answer}
                                      onChange={(e) => setEditFormData({...editFormData, answer: e.target.value})}
                                      className="flex-1 bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-xs text-emerald-800 font-bold outline-none"
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end pt-1">
                                    <button onClick={cancelEditing} className="px-3 py-1.5 bg-gray-100 text-gray-600 font-bold text-[10px] rounded-md hover:bg-gray-200 transition-colors">Cancel</button>
                                    <button onClick={() => saveEditedQuestion(viewModal.setKey, quizKey, idx)} className="px-3 py-1.5 bg-[#800000] text-white font-bold text-[10px] rounded-md hover:bg-[#6a0000] transition-colors flex items-center shadow-sm">
                                      <Save className="w-3 h-3 mr-1" /> Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Q{idx + 1}</span>
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                      <button onClick={() => startEditingQuestion(quizKey, idx, q)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-colors"><Edit2 size={14} /></button>
                                      <button onClick={() => deleteQuestion(viewModal.setKey, quizKey, idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                  </div>
                                  <p className="text-gray-800 font-bold text-xs mb-2 pr-10">{q.question}</p>
                                  <div className="inline-flex items-center bg-emerald-50 border border-emerald-100 px-2 py-1 rounded text-[10px]">
                                    <span className="text-emerald-700 font-bold truncate max-w-xs" title={q.answer}>Ans: {q.answer}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button 
                onClick={() => { setViewModal({ isOpen: false, subject: "", setKey: "" }); setEditingQuestionId(null); }}
                className="px-5 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg text-xs transition-colors shadow-sm hover:bg-gray-100"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          FEEDBACK MODAL
      --------------------------------------------------------- */}
      {feedbackModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl p-6 max-w-xs w-full shadow-2xl text-center border border-gray-100">
            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4 ${feedbackModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {feedbackModal.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1.5">{feedbackModal.title}</h3>
            <p className="text-gray-500 text-xs font-medium mb-6">{feedbackModal.message}</p>
            <button 
              onClick={() => setFeedbackModal({ ...feedbackModal, isOpen: false })} 
              className="w-full py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest rounded-lg shadow-sm transition-colors"
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeTest;