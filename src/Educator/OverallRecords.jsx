import React, { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../Firebase";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import { 
  Eye, 
  Search, 
  Award, 
  CheckCircle, 
  XCircle, 
  Users, 
  Mail,
  UserCircle,
  GraduationCap,
  X,
  Download
} from "lucide-react";

const OverallRecords = () => {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("eligible"); 
  const [searchQuery, setSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- SCORE CALCULATION LOGIC ---
  const getScoreStats = (progressData) => {
    let correct = 0;
    let totalItems = 0;
    
    if (!progressData) return { correct: 0, wrong: 0, total: 0, percentage: 0 };

    const findScores = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if ('correct' in obj && 'wrong' in obj) {
        correct += (Number(obj.correct) || 0);
        totalItems += (Number(obj.correct) || 0) + (Number(obj.wrong) || 0);
      } else if ('score' in obj && 'total' in obj && 'setName' in obj) {
        correct += (Number(obj.score) || 0);
        totalItems += (Number(obj.total) || 0);
      } else {
        Object.values(obj).forEach(val => findScores(val));
      }
    };

    findScores(progressData);
    const percentage = totalItems > 0 ? Math.round((correct / totalItems) * 100) : 0;
    return { correct, wrong: totalItems - correct, total: totalItems, percentage };
  };

  const getFinalExamStats = (user) => {
    const finalData = user.live_exams?.final_quiz || user.diagnostic_exam_progress || user.final_exam_progress || user.final_exam_score;
    
    if (!finalData) return { display: "Not Taken", percentage: 0, total: 0 };
    if (typeof finalData === 'number') return { display: `${finalData}%`, percentage: finalData, total: 100 };

    const stats = getScoreStats(finalData);
    if (stats.total === 0) return { display: "Not Taken", percentage: 0, total: 0 };
    
    return { display: `${stats.percentage}% (${stats.correct}/${stats.total})`, percentage: stats.percentage, total: stats.total };
  };

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);

        if (usersSnapshot.exists()) {
          const allUsersData = Object.entries(usersSnapshot.val()).map(([uid, user]) => ({
            uid,
            ...user,
          }));
          
          const activeStudents = allUsersData.filter(
            (user) => user.role !== "admin" && user.role !== "educator" && (!user.status || user.status === 'active')
          );
          
          const studentsWithStats = activeStudents.map(user => {
            const finalStats = getFinalExamStats(user);
            return {
              ...user,
              finalStats,
              hasTakenExam: finalStats.total > 0,
              isEligible: finalStats.total > 0 && finalStats.percentage >= 75
            };
          });

          setAllUsers(studentsWithStats);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // --- GENERATE CERTIFICATE LOGIC ---
  const handleGenerateCertificate = async (user) => {
    setIsGenerating(true);
    try {
      // Fetch the template from the PUBLIC folder directly
      const response = await fetch("/Gm.docx");
      if (!response.ok) throw new Error("Could not find Gm.docx in public folder");
      
      const content = await response.arrayBuffer();
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      // 1. First Underline: Calculate Full Name
      const fName = user.firstName || "";
      const lName = user.lastName || "";
      const fullName = `${fName} ${lName}`.trim() || user.username || "Student";

      // 2. Second Underline: Calculate Mr. or Ms. + LastName
      const isMale = user.gender?.toLowerCase() === 'male';
      const isFemale = user.gender?.toLowerCase() === 'female';
      let title = "Mr./Ms."; // Fallback if gender isn't specified
      
      if (isMale) title = "Mr.";
      if (isFemale) title = "Ms.";
      
      // Use just the last name if available, otherwise fallback to their full name
      const titleName = `${title} ${lName || fullName}`.trim();

      // Render the document by replacing the {fullName} and {titleName} tags in Gm.docx
      doc.render({
        fullName: fullName.toUpperCase(),
        titleName: titleName
      });

      // Generate the downloaded file
      const out = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      saveAs(out, `${fullName}_GoodMoral_Certificate.docx`);
    } catch (error) {
      console.error("Error generating certificate:", error);
      alert("Failed to generate certificate. Ensure Gm.docx is in your public folder and contains {fullName} and {titleName} tags.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- FILTERING ---
  const eligibleUsers = allUsers.filter(u => u.isEligible);
  const notEligibleUsers = allUsers.filter(u => !u.isEligible && u.hasTakenExam);

  const getFilteredUsers = () => {
    let list = activeTab === 'eligible' ? eligibleUsers : notEligibleUsers;
    
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      list = list.filter(u => 
        (u.firstName && u.firstName.toLowerCase().includes(lowerQuery)) ||
        (u.lastName && u.lastName.toLowerCase().includes(lowerQuery)) ||
        (u.username && u.username.toLowerCase().includes(lowerQuery)) ||
        (u.email && u.email.toLowerCase().includes(lowerQuery))
      );
    }
    
    return list.sort((a, b) => b.finalStats.percentage - a.finalStats.percentage);
  };

  const currentDisplayList = getFilteredUsers();

  // --- MODAL HANDLERS ---
  const handleView = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-[#e2c7c7] border-t-[#800000] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto font-['Inter',sans-serif] space-y-4">
      
      {/* TABS */}
      <div className="flex flex-row gap-1.5 border-b border-gray-100 pb-3">
        <button 
          onClick={() => setActiveTab('eligible')}
          className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'eligible' ? 'bg-[#f4e8e8] text-[#800000]' : 'text-slate-500 hover:bg-gray-50 hover:text-slate-900'
          }`}
        >
          <CheckCircle className={`w-3.5 h-3.5 mr-2 ${activeTab === 'eligible' ? 'text-[#800000]' : 'text-slate-400'}`} />
          Eligible Students
          <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-black ${activeTab === 'eligible' ? 'bg-[#e2c7c7] text-[#800000]' : 'bg-gray-100 text-gray-500'}`}>
            {eligibleUsers.length}
          </span>
        </button>
        
        <button 
          onClick={() => setActiveTab('not-eligible')}
          className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'not-eligible' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:bg-gray-50 hover:text-slate-900'
          }`}
        >
          <XCircle className={`w-3.5 h-3.5 mr-2 ${activeTab === 'not-eligible' ? 'text-red-600' : 'text-slate-400'}`} />
          Not Eligible
          <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-black ${activeTab === 'not-eligible' ? 'bg-red-200 text-red-800' : 'bg-gray-100 text-gray-500'}`}>
            {notEligibleUsers.length}
          </span>
        </button>
      </div>

      <div className="space-y-4 animate-in fade-in duration-300">
        
        {/* STATS & SEARCH HEADER */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-100">
                <Award className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Eligible Rate</p>
                <p className="text-xl font-black text-emerald-600">
                  {allUsers.filter(u => u.hasTakenExam).length > 0 
                    ? Math.round((eligibleUsers.length / allUsers.filter(u => u.hasTakenExam).length) * 100) 
                    : 0}%
                </p>
              </div>
            </div>

            <div className="w-px h-10 bg-gray-100 hidden sm:block"></div>

            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total Examined</p>
                <p className="text-xl font-black text-gray-900">{allUsers.filter(u => u.hasTakenExam).length}</p>
              </div>
            </div>
          </div>

          <div className="relative w-full lg:w-72">
            <input 
              type="text" 
              placeholder={`Search ${activeTab === 'eligible' ? 'eligible' : 'not eligible'} students...`} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f4e8e8] focus:border-[#800000] outline-none text-xs font-medium transition-all"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          {currentDisplayList.length === 0 ? (
            <div className="text-center py-12">
              <Award className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-500">
                {searchQuery ? "No students match your search." : `No ${activeTab.replace('-', ' ')} students found.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 pl-5 text-[9px] font-black uppercase tracking-widest text-gray-400">Student Profile</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Final Score</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Eligibility Status</th>
                    <th className="px-4 py-3 pr-5 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {currentDisplayList.map((user) => {
                    const profilePic = user.profileImage || user.profilePicture;
                    
                    return (
                      <tr key={user.uid} className="transition-colors hover:bg-gray-50/80 group">
                        <td className="px-4 py-3 pl-5">
                          <div className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 overflow-hidden border border-gray-200 ${
                              !profilePic ? (user.gender?.toLowerCase() === 'male' ? 'bg-blue-100 text-blue-700' : user.gender?.toLowerCase() === 'female' ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600') : 'bg-gray-100'
                            }`}>
                              {profilePic ? (
                                <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                user.firstName?.charAt(0) || user.username?.charAt(0) || 'U'
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <p className="font-bold text-gray-900 text-xs truncate">
                                {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
                              </p>
                              <p className="text-[10px] text-gray-500 truncate mt-0.5">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-[9px] uppercase tracking-wider font-bold ${
                            user.isEligible ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {user.finalStats.display}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            {user.isEligible ? (
                              <><CheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> <span className="text-xs font-bold text-emerald-600">Eligible</span></>
                            ) : (
                              <><XCircle className="w-3.5 h-3.5 mr-1.5 text-red-500" /> <span className="text-xs font-bold text-red-600">Not Eligible</span></>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 pr-5 text-right">
                          <button onClick={() => handleView(user)} className="px-2.5 py-1.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-md hover:bg-[#f4e8e8] hover:text-[#800000] transition-colors text-[10px] shadow-sm flex items-center justify-center ml-auto">
                            <Eye className="w-3 h-3 mr-1.5" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* --- USER DETAILS MODAL --- */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-[50] p-4 animate-in fade-in duration-200 font-['Inter',sans-serif]">
          <div className="bg-white rounded-xl w-full max-w-[500px] overflow-hidden shadow-2xl">
            <div className="relative h-24 bg-[#800000] overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
              <button onClick={closeModal} className="absolute top-3 right-3 p-1.5 bg-black/20 text-white rounded-md hover:bg-black/40 transition-colors backdrop-blur-md z-10">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-6 pb-6 relative">
              <div className="flex justify-between items-end -mt-10 mb-4">
                <div className="w-20 h-20 rounded-xl flex items-center justify-center font-black text-3xl shadow-lg border-4 border-white overflow-hidden relative z-10 bg-white">
                  {(selectedUser.profileImage || selectedUser.profilePicture) ? (
                    <img src={selectedUser.profileImage || selectedUser.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.firstName?.charAt(0) || selectedUser.username?.charAt(0) || 'U'
                  )}
                </div>
                <div className="mb-2">
                  <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                    selectedUser.isEligible ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedUser.isEligible ? 'Eligible' : 'Not Eligible'}
                  </span>
                </div>
              </div>
              <div className="mb-5">
                <h2 className="text-xl font-black text-gray-900 tracking-tight">
                  {selectedUser.firstName && selectedUser.lastName ? `${selectedUser.firstName} ${selectedUser.lastName}` : selectedUser.username || 'Unnamed Student'}
                </h2>
                <p className="text-xs text-gray-500 font-medium flex items-center mt-0.5">
                  <Mail className="w-3 h-3 mr-1.5 opacity-70" /> {selectedUser.email}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center">
                    <UserCircle className="w-3 h-3 mr-1.5" /> Demographics
                  </h4>
                  <div className="space-y-1.5">
                    <DetailRow label="Gender" value={selectedUser.gender || "Not specified"} />
                    <DetailRow label="Phone" value={selectedUser.phoneNumber || "Not provided"} />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center">
                    <GraduationCap className="w-3 h-3 mr-1.5" /> Academics
                  </h4>
                  <div className="space-y-1.5">
                    <DetailRow label="School" value={selectedUser.school || "Not specified"} />
                    <DetailRow label="Graduated" value={selectedUser.yearGraduated || "N/A"} />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Footer with Action Buttons */}
            <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex justify-between items-center">
               
               {/* Show Generate Certificate Button ONLY if the student is Eligible */}
               {selectedUser.isEligible ? (
                 <button 
                   onClick={() => handleGenerateCertificate(selectedUser)} 
                   disabled={isGenerating}
                   className="px-4 py-1.5 bg-[#800000] text-white font-bold text-xs rounded-lg hover:bg-red-900 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                 >
                   <Download className="w-3.5 h-3.5" /> 
                   {isGenerating ? "Generating..." : "Download Certificate"}
                 </button>
               ) : (
                 <div></div> // Empty div to keep the Close button aligned to the right
               )}

               <button onClick={closeModal} className="px-4 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-100 transition-colors shadow-sm">
                 Close
               </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

const DetailRow = ({ label, value }) => (
  <div className="flex justify-between items-start text-[10px]">
    <span className="font-semibold text-gray-400">{label}</span>
    <span className="font-bold text-gray-800 text-right max-w-[60%] truncate" title={value}>{value}</span>
  </div>
);

export default OverallRecords;