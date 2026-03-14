import React, { useState, useRef, useEffect } from "react";
import { ref, set, onValue, remove, update } from "firebase/database";
import { db } from "../Firebase";
import mammoth from "mammoth";
import { 
  FileText, UploadCloud, CheckCircle, Edit2, Save, Loader2, FolderOpen, X, AlertCircle, Layers, ChevronRight, Trash2, Shield, Eye
} from "lucide-react";

// 🚀 GROQ API CONFIGURATION 🚀
const GROQ_API_KEY = "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";

const ManageDiag = () => {
  const fileInputRef = useRef(null);

  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const [existingQuestions, setExistingQuestions] = useState({});
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  const [feedbackModal, setFeedbackModal] = useState({ isOpen: false, title: "", message: "", type: "success" });
  const [viewModal, setViewModal] = useState({ isOpen: false, areaKey: "", areaLabel: "", setKey: "" });
  const [editingQuestionId, setEditingQuestionId] = useState(null); 
  const [editFormData, setEditFormData] = useState({ question: "", options: { a: "", b: "", c: "", d: "" }, answer: "" });
  
  const [isDragging, setIsDragging] = useState(false);

  const diagnosticAreas = [
    { label: "Criminal Jurisprudence", node: "Criminal_Jurisprudence" },
    { label: "Law Enforcement", node: "Law_Enforcement" },
    { label: "Crime Detection", node: "Crime_Detection" },
    { label: "Criminalistics", node: "Criminalistics" },
    { label: "Sociology of Crimes", node: "Sociology_of_Crimes" },
    { label: "Correctional Admin", node: "Correctional_Admin" },
  ];

  const sets = ["Set A", "Set B", "Set C"];

  useEffect(() => {
    setIsLoadingExisting(true);
    const examRef = ref(db, `exams`);
    const unsubscribe = onValue(examRef, (snapshot) => {
      if (snapshot.exists()) {
        setExistingQuestions(snapshot.val());
      } else {
        setExistingQuestions({});
      }
      setIsLoadingExisting(false);
    });

    return () => unsubscribe();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    validateAndSetFile(file);
  };

  const validateAndSetFile = (file) => {
    if (file && file.name.endsWith('.docx')) {
      setSelectedFile(file);
      setGeneratedQuestions([]);
    } else if (file) {
      showFeedback("Invalid File", "Please upload a .docx file.", "error");
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

  const handleAnalyzeFile = async () => {
    if (!selectedArea || !selectedSet || !selectedFile) {
      showFeedback("Missing Info", "Select area, set, and document first.", "error");
      return;
    }

    setIsAnalyzing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      let extractedText = result.value;

      if (!extractedText || !extractedText.trim()) throw new Error("Document is empty.");

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `You are a strict JSON data extractor. TASK: Extract EVERY multiple-choice question from the text.
              RULES:
              1. Return ONLY a raw JSON object. NO markdown formatting, NO backticks, NO explanations.
              2. The JSON MUST follow this exact structure: {"questions": [{"question": "...", "options": {"a": "...", "b": "...", "c": "...", "d": "..."}, "answer": "A"}]}`
            },
            { role: "user", content: `Process this text: ${extractedText}` },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1, 
          max_tokens: 15000
        }),
      });

      const data = await response.json();
      let rawContent = data.choices[0].message.content.replace(/```json/gi, '').replace(/```/g, '').trim();
      let aiContent = JSON.parse(rawContent);

      let questionsArray = aiContent.questions || Object.values(aiContent).find(Array.isArray) || [];

      const safeQuestions = questionsArray.map((q) => {
        const opts = q.options || {};
        return {
          question: q.question || "Untitled Question",
          options: {
            a: opts.a || opts.A || "N/A",
            b: opts.b || opts.B || "N/A",
            c: opts.c || opts.C || "N/A",
            d: opts.d || opts.D || "N/A"
          },
          answer: String(q.answer || q.correctAnswer || "A").toUpperCase()
        };
      });

      setGeneratedQuestions(safeQuestions);
      showFeedback("Extraction Complete", `Captured ${safeQuestions.length} questions.`, "success");
    } catch (error) {
      setGeneratedQuestions([]);
      showFeedback("Analysis Error", error.message, "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveDiagnostic = async () => {
    setIsUploading(true);
    try {
      const questionsArray = generatedQuestions.map((q) => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.answer
      }));
      await set(ref(db, `exams/${selectedArea}/${selectedSet}`), questionsArray);
      showFeedback("Saved!", `${selectedSet} updated successfully.`, "success");
      setSelectedArea(null); setSelectedSet(null); setSelectedFile(null); setGeneratedQuestions([]);
    } catch (error) {
      showFeedback("Save Error", error.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const startEditing = (qId, qData) => {
    setEditingQuestionId(qId);
    setEditFormData({ 
      question: qData?.question || "", 
      options: qData?.options || { a: "", b: "", c: "", d: "" }, 
      answer: qData?.correctAnswer || "" 
    });
  };

  const saveEdit = async (node, setKey, qId) => {
    try {
      await update(ref(db, `exams/${node}/${setKey}/${qId}`), {
        question: editFormData.question,
        options: editFormData.options,
        correctAnswer: editFormData.answer.toUpperCase()
      });
      setEditingQuestionId(null);
    } catch (error) { alert(error.message); }
  };

  const deleteQuestion = async (node, setKey, qId) => {
    if (window.confirm("Remove this question?")) {
      await remove(ref(db, `exams/${node}/${setKey}/${qId}`));
    }
  };

  const hasAnyData = Object.values(existingQuestions).some(obj => obj && Object.keys(obj).length > 0);

  return (
    <div className="max-w-5xl mx-auto font-['Inter',sans-serif] space-y-4 pb-12">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".docx" />

   

      {/* UPLOAD SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center border-b border-gray-100 pb-3">
          <div className="bg-[#f4e8e8] p-1.5 rounded-lg mr-2.5 text-[#800000]">
            <UploadCloud className="w-4 h-4" />
          </div>
          Import New Questions
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">1. Select Area</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {diagnosticAreas.map((area) => (
                <button key={area.node} onClick={() => setSelectedArea(area.node)}
                  className={`px-3 py-2 rounded-lg border text-[10px] font-bold transition-all ${selectedArea === area.node ? "bg-[#f4e8e8] border-[#800000] text-[#800000] shadow-sm ring-1 ring-[#800000]" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
                  {area.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">2. Select Set</label>
              <div className="flex gap-2">
                {sets.map((s) => (
                  <button key={s} onClick={() => setSelectedSet(s)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${selectedSet === s ? "bg-[#f4e8e8] border-[#800000] text-[#800000] shadow-sm ring-1 ring-[#800000]" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">3. Upload File (.DOCX)</label>
              <div onClick={triggerFileInput} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                className={`w-full py-2 px-3 border-2 border-dashed rounded-lg flex items-center transition-all text-xs font-bold cursor-pointer ${isDragging ? "bg-[#f4e8e8] border-[#800000] text-[#800000]" : selectedFile ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100 hover:border-gray-400"}`}>
                <UploadCloud className={`w-4 h-4 mr-2 ${isDragging ? 'animate-bounce text-[#800000]' : ''}`} />
                <span className="truncate">{isDragging ? "Drop here..." : selectedFile ? selectedFile.name : "Click or drag .DOCX here..."}</span>
              </div>
            </div>
          </div>

          {selectedFile && generatedQuestions.length === 0 && (
            <button onClick={handleAnalyzeFile} disabled={isAnalyzing} className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-widest shadow-sm flex items-center justify-center hover:bg-black transition-all">
              {isAnalyzing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Layers className="w-4 h-4 mr-2" />}
              {isAnalyzing ? "Processing..." : "Analyze & Extract Questions"}
            </button>
          )}
        </div>
      </div>

      {/* PREVIEW SECTION */}
      {generatedQuestions?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center"><Eye className="w-4 h-4 mr-2 text-[#800000]" /> Extraction Preview</h3>
            <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider">{generatedQuestions.length} Questions</span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg max-h-[300px] overflow-y-auto mb-4 p-3 space-y-3">
            {generatedQuestions.map((q, i) => (
              <div key={i} className="p-3 border border-gray-100 bg-white rounded-lg shadow-sm">
                <p className="text-gray-900 font-bold text-xs mb-2">{i+1}. {q?.question}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] text-gray-600 mb-2">
                  <p>A. {q?.options?.a}</p><p>B. {q?.options?.b}</p>
                  <p>C. {q?.options?.c}</p><p>D. {q?.options?.d}</p>
                </div>
                <div className="inline-flex items-center bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-100">Answer: {q?.answer}</div>
              </div>
            ))}
          </div>
          <button onClick={handleSaveDiagnostic} disabled={isUploading} className="w-full py-2.5 rounded-lg bg-[#800000] text-white text-xs font-bold uppercase tracking-widest shadow-sm hover:bg-[#6a0000] transition-all flex items-center justify-center">
            {isUploading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />} Save to {selectedSet}
          </button>
        </div>
      )}

      {/* EXISTING DATA SECTION (MATCHING PRACTICE DESIGN) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center">
          <FolderOpen className="w-4 h-4 mr-2 text-[#800000]" />
          <h3 className="text-sm font-bold text-gray-800">Database Repository</h3>
        </div>

        {isLoadingExisting ? (
          <div className="flex justify-center items-center py-12"><Loader2 className="animate-spin text-[#800000] w-6 h-6" /></div>
        ) : !hasAnyData ? (
          <div className="text-center py-12"><FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-xs font-bold text-gray-500">No question banks found.</p></div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {diagnosticAreas.map((area) => {
              const areaData = existingQuestions[area.node] || {};
              const availableSets = sets.filter(s => areaData[s] && Object.keys(areaData[s]).length > 0);

              if (availableSets.length === 0) return null;

              return (
                <div key={area.node} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col">
                  <h4 className="font-bold text-gray-900 text-sm border-b border-gray-100 pb-2 mb-3 truncate" title={area.label}>{area.label}</h4>
                  <div className="space-y-2 flex-1">
                    {availableSets.map(setKey => {
                      const questionsInSet = areaData[setKey];
                      const qCount = Array.isArray(questionsInSet) 
                        ? questionsInSet.filter(q => q !== null).length 
                        : Object.keys(questionsInSet).length;

                      return (
                        <div key={setKey} className="flex items-center justify-between bg-gray-50 rounded-lg p-2 border border-gray-100">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 pl-1">{setKey}</span>
                            <span className="text-[9px] font-bold text-gray-400 pl-1 mt-0.5">{qCount} Questions</span>
                          </div>
                          <button onClick={() => setViewModal({ isOpen: true, areaKey: area.node, areaLabel: area.label, setKey: setKey })}
                            className="text-[9px] font-bold uppercase tracking-widest text-gray-500 hover:text-[#800000] flex items-center bg-white border border-gray-200 px-2 py-1.5 rounded shadow-sm hover:border-[#e2c7c7] transition-all">
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

      {/* VIEW & EDIT MODAL */}
      {viewModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/80">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center"><Shield className="w-4 h-4 text-[#800000] mr-2.5" /> {viewModal.areaLabel}</h3>
                <p className="text-[10px] text-[#800000] uppercase tracking-widest font-black mt-1 pl-1">{viewModal.setKey}</p>
              </div>
              <button onClick={() => { setViewModal({ isOpen: false, areaKey: "", areaLabel: "", setKey: "" }); setEditingQuestionId(null); }} 
                className="p-1.5 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shadow-sm"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
              {(() => {
                const areaData = existingQuestions[viewModal.areaKey] || {};
                const rawQuestions = areaData[viewModal.setKey] || [];
                const questions = Object.entries(rawQuestions).filter(([_, qData]) => qData !== null).sort(([aK], [bK]) => Number(aK) - Number(bK));
                return questions.map(([qId, qData], idx) => {
                  const isEditing = editingQuestionId === qId;
                  return (
                    <div key={qId} className="bg-white border border-gray-100 rounded-xl p-4 relative group shadow-sm hover:border-[#e2c7c7] transition-all">
                      {isEditing ? (
                        <div className="space-y-3">
                          <textarea value={editFormData.question} onChange={(e) => setEditFormData({...editFormData, question: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-medium text-gray-800 focus:border-[#800000] outline-none" rows={2} />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {['a', 'b', 'c', 'd'].map(key => (
                              <div key={key} className="flex items-center"><span className="text-[10px] font-bold text-gray-400 uppercase mr-2">{key}.</span>
                                <input value={editFormData.options[key]} onChange={(e) => setEditFormData({...editFormData, options: {...editFormData.options, [key]: e.target.value}})}
                                  className="w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-[11px]" /></div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-gray-400 uppercase">Ans:</span>
                            <input type="text" value={editFormData.answer} onChange={(e) => setEditFormData({...editFormData, answer: e.target.value})}
                              className="w-16 border border-emerald-200 rounded-md px-2 py-1.5 text-xs font-black text-center text-emerald-700 bg-emerald-50" maxLength={1} /></div>
                          <div className="flex gap-2 justify-end pt-2 border-t border-gray-50">
                            <button onClick={() => setEditingQuestionId(null)} className="px-3 py-1.5 bg-gray-100 rounded-lg font-bold text-[10px] text-gray-500">Cancel</button>
                            <button onClick={() => saveEdit(viewModal.areaKey, viewModal.setKey, qId)} className="px-3 py-1.5 bg-[#800000] text-white rounded-lg font-bold text-[10px] flex items-center"><Save className="w-3 h-3 mr-1" /> Save</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-2"><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Q{idx + 1}</span>
                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                              <button onClick={() => startEditing(qId, qData)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-colors"><Edit2 size={14} /></button>
                              <button onClick={() => deleteQuestion(viewModal.areaKey, viewModal.setKey, qId)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </div>
                          <p className="text-gray-800 font-bold text-xs mb-3 pr-10">{qData?.question}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] text-gray-600">
                            <div className={`px-2 py-1 rounded bg-gray-50 truncate ${qData?.correctAnswer === 'A' ? 'ring-1 ring-emerald-300 text-emerald-800 font-bold bg-emerald-50' : ''}`}>A. {qData?.options?.a}</div>
                            <div className={`px-2 py-1 rounded bg-gray-50 truncate ${qData?.correctAnswer === 'B' ? 'ring-1 ring-emerald-300 text-emerald-800 font-bold bg-emerald-50' : ''}`}>B. {qData?.options?.b}</div>
                            <div className={`px-2 py-1 rounded bg-gray-50 truncate ${qData?.correctAnswer === 'C' ? 'ring-1 ring-emerald-300 text-emerald-800 font-bold bg-emerald-50' : ''}`}>C. {qData?.options?.c}</div>
                            <div className={`px-2 py-1 rounded bg-gray-50 truncate ${qData?.correctAnswer === 'D' ? 'ring-1 ring-emerald-300 text-emerald-800 font-bold bg-emerald-50' : ''}`}>D. {qData?.options?.d}</div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
            <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button onClick={() => { setViewModal({ isOpen: false, areaKey: "", areaLabel: "", setKey: "" }); setEditingQuestionId(null); }}
                className="px-5 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg text-xs transition-colors shadow-sm hover:bg-gray-100">Close Editor</button>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      {feedbackModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl p-6 max-w-xs w-full shadow-2xl text-center border border-gray-100">
            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4 ${feedbackModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {feedbackModal.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1.5">{feedbackModal.title}</h3>
            <p className="text-gray-500 text-xs font-medium mb-6">{feedbackModal.message}</p>
            <button onClick={() => setFeedbackModal({ ...feedbackModal, isOpen: false })} 
              className="w-full py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-colors">Okay</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageDiag;