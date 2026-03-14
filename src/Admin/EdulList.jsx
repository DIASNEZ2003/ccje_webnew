import React, { useEffect, useState, useRef } from "react";
import { ref, get, update, remove, set } from "firebase/database";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "../Firebase"; 
import { supabase } from "../../supabaseClient"; 
import { 
  UserPlus, Mail, Shield, Camera, Trash2, Edit2, 
  Search, X, CheckCircle, Loader2, UserCircle, Save, ChevronRight, Key, User, RefreshCw
} from "lucide-react";

const EduList = () => {
  const fileInputRef = useRef(null);
  const editFileRef = useRef(null);

  // --- STATE: REGISTRATION ---
  const [formData, setFormData] = useState({ firstName: "", lastName: "", middleName: "", email: "", password: "", gender: "m" });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  // --- STATE: DIRECTORY ---
  const [educators, setEducators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // --- STATE: EDITING ---
  const [editingId, setEditingId] = useState(null); 
  const [editFormData, setEditFormData] = useState({ firstName: "", lastName: "", email: "", middleName: "", gender: "" });
  const [editFile, setEditFile] = useState(null);
  const [editPreview, setEditPreview] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const [feedback, setFeedback] = useState({ isOpen: false, title: "", msg: "", type: "success" });

  useEffect(() => { fetchEducators(); }, []);

  const fetchEducators = async () => {
    setIsLoading(true);
    const usersRef = ref(db, "users");
    const snapshot = await get(usersRef);
    if (snapshot.exists()) {
      const data = Object.entries(snapshot.val())
        .map(([uid, val]) => ({ uid, ...val }))
        .filter(user => user.role === "educator");
      setEducators(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    }
    setIsLoading(false);
  };

  const showFeedback = (title, msg, type = "success") => {
    setFeedback({ isOpen: true, title, msg, type });
  };

  // --- PASSWORD RESET LOGIC ---
  const handlePasswordReset = async () => {
    if (!editFormData.email) return;
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, editFormData.email);
      showFeedback("Email Sent", `A password reset link has been sent to ${editFormData.email}`, "success");
    } catch (error) {
      showFeedback("Reset Failed", error.message, "error");
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleFileChange = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (file) {
      if (isEdit) {
        setEditFile(file);
        setEditPreview(URL.createObjectURL(file));
      } else {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const handleAddEducator = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.firstName) {
      return showFeedback("Error", "Please fill in required fields.", "error");
    }
    setIsAdding(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const uid = userCredential.user.uid;
      let publicUrl = "";

      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${uid}_${Date.now()}.${fileExt}`;
        await supabase.storage.from("profile_ccjs").upload(fileName, selectedFile);
        const { data } = supabase.storage.from("profile_ccjs").getPublicUrl(fileName);
        publicUrl = data.publicUrl;
      }

      await set(ref(db, `users/${uid}`), {
        firstName: formData.firstName, lastName: formData.lastName, middleName: formData.middleName,
        email: formData.email, gender: formData.gender, role: "educator", status: "active",
        profileImage: publicUrl, profilePicture: publicUrl, createdAt: new Date().toISOString(), timestamp: Date.now()
      });

      showFeedback("Success", "Educator created successfully!", "success");
      setFormData({ firstName: "", lastName: "", middleName: "", email: "", password: "", gender: "m" });
      setSelectedFile(null); setPreviewUrl(null);
      fetchEducators();
    } catch (error) {
      showFeedback("Failed", error.message, "error");
    } finally {
      setIsAdding(false);
    }
  };

  const openEditModal = (edu) => {
    setEditingId(edu.uid);
    setEditFormData({ firstName: edu.firstName || "", lastName: edu.lastName || "", middleName: edu.middleName || "", email: edu.email || "", gender: edu.gender || "m" });
    setEditPreview(edu.profileImage || edu.profilePicture || null);
    setEditFile(null);
  };

  const handleUpdateEducator = async () => {
    setIsUpdating(true);
    try {
      let finalImageUrl = editPreview;
      if (editFile) {
        const fileExt = editFile.name.split(".").pop();
        const fileName = `${editingId}_${Date.now()}.${fileExt}`;
        await supabase.storage.from("profile_ccjs").upload(fileName, editFile);
        const { data } = supabase.storage.from("profile_ccjs").getPublicUrl(fileName);
        finalImageUrl = data.publicUrl;
      }

      const updateData = { firstName: editFormData.firstName, lastName: editFormData.lastName, middleName: editFormData.middleName, email: editFormData.email, gender: editFormData.gender, profileImage: finalImageUrl, profilePicture: finalImageUrl };
      await update(ref(db, `users/${editingId}`), updateData);
      setEducators(prev => prev.map(edu => edu.uid === editingId ? { ...edu, ...updateData } : edu));
      showFeedback("Updated", "Profile updated successfully!", "success");
      setEditingId(null);
    } catch (error) {
      showFeedback("Error", error.message, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (user) => {
    if (window.confirm(`Permanently delete ${user.firstName}?`)) {
      await remove(ref(db, `users/${user.uid}`));
      setEducators(prev => prev.filter(e => e.uid !== user.uid));
    }
  };

  const filteredEducators = educators.filter(e => 
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto font-['Inter',sans-serif] space-y-4 pb-12 animate-in fade-in duration-500">
      
      {/* ═════════ REGISTRATION FORM ═════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center border-b border-gray-100 pb-3">
          <div className="bg-[#f4e8e8] p-1.5 rounded-lg mr-2.5 text-[#800000]"><UserPlus className="w-4 h-4" /></div>
          Register New Educator
        </h3>

        <form onSubmit={handleAddEducator} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="flex flex-col items-center justify-center border-r border-gray-50 pr-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current.click()}>
              <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden transition-all group-hover:border-[#800000]">
                {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" alt="" /> : <Camera className="w-5 h-5 text-gray-400" />}
              </div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileChange(e, false)} accept="image/*" />
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-2">Avatar</span>
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-[#f4e8e8] outline-none" placeholder="First Name" />
            <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-[#f4e8e8] outline-none" placeholder="Last Name" />
            <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none">
              <option value="m">Male</option><option value="f">Female</option>
            </select>
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="md:col-span-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none" placeholder="Email Address" />
            <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none" placeholder="Password" />
            <button type="submit" disabled={isAdding} className="md:col-span-3 py-2 bg-[#800000] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#6a0000] transition-all">
              {isAdding ? "Registering..." : "Confirm Registration"}
            </button>
          </div>
        </form>
      </div>

      {/* ═════════ DIRECTORY ═════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center"><UserCircle className="w-4 h-4 mr-2 text-[#800000]" /><h3 className="text-sm font-bold text-gray-800">Educator Directory</h3></div>
          <div className="relative"><input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] focus:ring-1 focus:ring-[#800000] outline-none w-40" /><Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" /></div>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {isLoading ? <div className="col-span-2 flex justify-center py-10"><Loader2 className="animate-spin text-[#800000]" /></div> : filteredEducators.map((edu) => (
            <div key={edu.uid} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-[#e2c7c7] transition-all group shadow-sm">
              <div className="flex items-center min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gray-100 mr-3 flex-shrink-0 overflow-hidden border border-gray-200">
                  {edu.profileImage ? <img src={edu.profileImage} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center bg-[#f4e8e8] text-[#800000] font-black text-xs">{edu.firstName?.charAt(0)}</div>}
                </div>
                <div className="min-w-0"><p className="text-xs font-black text-gray-900 truncate uppercase">{edu.firstName} {edu.lastName}</p><p className="text-[10px] text-gray-400 truncate">{edu.email}</p></div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEditModal(edu)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(edu)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═════════ EDIT MODAL ═════════ */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#800000]">Edit Profile</h3>
              <button onClick={() => setEditingId(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-center mb-4">
                <div className="relative group cursor-pointer" onClick={() => editFileRef.current.click()}>
                  <div className="w-20 h-20 rounded-2xl border-2 border-[#e2c7c7] overflow-hidden bg-gray-50">
                    {editPreview ? <img src={editPreview} className="w-full h-full object-cover" alt="" /> : <UserCircle className="w-full h-full text-gray-300" />}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-[#800000] text-white p-1.5 rounded-lg"><Camera size={12} /></div>
                </div>
                <input type="file" ref={editFileRef} className="hidden" onChange={(e) => handleFileChange(e, true)} accept="image/*" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Full Name</label><div className="flex gap-2"><input type="text" value={editFormData.firstName} onChange={e => setEditFormData({...editFormData, firstName: e.target.value})} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none" /><input type="text" value={editFormData.lastName} onChange={e => setEditFormData({...editFormData, lastName: e.target.value})} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none" /></div></div>
                <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Email</label><input type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none" /></div>
                
                {/* Reset Password Button */}
                <div className="col-span-2 pt-2">
                  <button onClick={handlePasswordReset} disabled={isSendingReset} className="w-full py-2 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center hover:bg-gray-200 transition-all border border-gray-200">
                    {isSendingReset ? <Loader2 className="animate-spin w-3 h-3 mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />} 
                    Send Password Reset Link
                  </button>
                </div>
              </div>
              <button onClick={handleUpdateEducator} disabled={isUpdating} className="w-full py-3 bg-[#800000] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md flex items-center justify-center hover:bg-[#6a0000]">
                {isUpdating ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      {feedback.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl p-6 max-w-xs w-full shadow-2xl text-center border border-gray-100">
            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4 ${feedback.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {feedback.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1.5">{feedback.title}</h3>
            <p className="text-gray-500 text-[11px] font-medium mb-6 leading-relaxed">{feedback.msg}</p>
            <button onClick={() => setFeedback({ ...feedback, isOpen: false })} className="w-full py-2 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg">Okay</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EduList;