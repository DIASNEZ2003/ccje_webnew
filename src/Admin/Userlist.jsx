import React, { useEffect, useState } from "react";
import { ref, get, update, remove } from "firebase/database";
import { db } from "../Firebase";
import { 
  Eye, Edit, Trash2, Save, X, Filter, User, Mail, 
  GraduationCap, Briefcase, MapPin, Phone, UserCircle,
  Users, VenusAndMars, Award, CheckCircle, Clock, Check, XCircle, Search, FileText
} from "lucide-react";

const UserList = () => {
  const [allUsers, setAllUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [activeTab, setActiveTab] = useState("active"); 
  const [scoreFilter, setScoreFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // New states for the Subject Breakdown Modal
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownUser, setBreakdownUser] = useState(null);

  // Helper to find scores in BOTH practice and diagnostic formats
  const getScoreStats = (progressData) => {
    let correct = 0;
    let totalItems = 0;
    
    if (!progressData) return { correct: 0, wrong: 0, total: 0, percentage: 0 };

    const findScores = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      // Format 1: Practice Exam (uses 'correct' and 'wrong')
      if ('correct' in obj && 'wrong' in obj) {
        correct += (Number(obj.correct) || 0);
        totalItems += (Number(obj.correct) || 0) + (Number(obj.wrong) || 0);
      } 
      // Format 2: Diagnostic/Final Quiz (uses 'score' and 'total')
      else if ('score' in obj && 'total' in obj && 'setName' in obj) {
        correct += (Number(obj.score) || 0);
        totalItems += (Number(obj.total) || 0);
      } 
      // Otherwise keep digging deeper into the object
      else {
        Object.values(obj).forEach(val => findScores(val));
      }
    };

    findScores(progressData);
    
    const percentage = totalItems > 0 ? Math.round((correct / totalItems) * 100) : 0;
    const wrong = totalItems - correct;

    return { correct, wrong, total: totalItems, percentage };
  };

  const getFinalExamStats = (user) => {
    const finalData = user.live_exams?.final_quiz || user.diagnostic_exam_progress || user.final_exam_progress || user.final_exam_score;
    
    if (!finalData) return { display: "Not Taken", percentage: 0 };
    if (typeof finalData === 'number') return { display: `${finalData}%`, percentage: finalData };

    const stats = getScoreStats(finalData);
    if (stats.total === 0) return { display: "Not Taken", percentage: 0 };
    
    return { display: `${stats.percentage}% (${stats.correct}/${stats.total})`, percentage: stats.percentage };
  };

  // ── HELPER: Get Diagnostic Score Breakdown by Subject AND Set ──
  const getSubjectBreakdown = (user) => {
    const finalQuiz = user.live_exams?.final_quiz;
    if (!finalQuiz) return [];

    const breakdown = [];
    Object.keys(finalQuiz).forEach(subjectKey => {
      const sets = finalQuiz[subjectKey];
      let actualSubjectName = subjectKey.replace(/_/g, ' '); // Fallback
      
      const subjectSets = [];
      let totalSetsScore = 0;
      let totalSetsMax = 0;

      // Loop through sets (Set A, Set B, etc.) for this subject
      Object.keys(sets).forEach(setKey => {
        const setData = sets[setKey];
        if (setData.subject) actualSubjectName = setData.subject;
        
        const setScore = Number(setData.score) || 0;
        const setTotal = Number(setData.total) || 0;
        const setPercentage = setTotal > 0 ? Math.round((setScore / setTotal) * 100) : 0;
        
        totalSetsScore += setScore;
        totalSetsMax += setTotal;

        subjectSets.push({
          setName: setData.setName || setKey.replace(/_/g, ' '),
          score: setScore,
          total: setTotal,
          percentage: setPercentage
        });
      });

      // Sort sets alphabetically (Set A, Set B, etc.)
      subjectSets.sort((a, b) => a.setName.localeCompare(b.setName));

      breakdown.push({
        subjectKey,
        subjectName: actualSubjectName,
        totalScore: totalSetsScore,
        totalMax: totalSetsMax,
        sets: subjectSets
      });
    });

    return breakdown;
  };

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
          
          const regularUsers = allUsersData.filter(
            (user) => user.role !== "admin" && user.role !== "educator"
          );
          
          setAllUsers(regularUsers);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleStatusChange = async (uid, newStatus, userName) => {
    try {
      await update(ref(db, `users/${uid}`), { status: newStatus });
      setAllUsers((prev) => prev.map((user) => user.uid === uid ? { ...user, status: newStatus } : user));
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    }
  };

  const activeUsers = allUsers.filter(u => !u.status || u.status === 'active');
  const pendingUsers = allUsers.filter(u => u.status === 'pending');
  const rejectedUsers = allUsers.filter(u => u.status === 'rejected' || u.status === 'declined');

  const getFilteredActiveUsers = () => {
    let filtered = activeUsers;
    
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        (u.firstName && u.firstName.toLowerCase().includes(lowerQuery)) ||
        (u.lastName && u.lastName.toLowerCase().includes(lowerQuery)) ||
        (u.username && u.username.toLowerCase().includes(lowerQuery)) ||
        (u.email && u.email.toLowerCase().includes(lowerQuery))
      );
    }

    filtered = filtered.filter(u => u.gender && u.gender.toLowerCase() !== "not specified");

    if (scoreFilter !== "all") {
      filtered = filtered.filter((user) => {
        const stats = getScoreStats(user.live_exam_progress);
        if (scoreFilter === "passed") return stats.percentage >= 75 && stats.total > 0;
        if (scoreFilter === "failed") return stats.percentage < 75 && stats.total > 0;
        if (scoreFilter === "notTaken") return stats.total === 0;
        return true;
      });
    }
    
    if (genderFilter !== "all") {
      filtered = filtered.filter((user) => user.gender?.toLowerCase() === genderFilter.toLowerCase());
    }
    
    return filtered;
  };

  const handleEdit = (user) => {
    setEditingUser(user.uid);
    setEditUsername(user.username);
    setEditEmail(user.email);
  };

  const handleSave = async () => {
    if (!editUsername || !editEmail) return alert("Username and Email cannot be empty.");
    try {
      await update(ref(db, `users/${editingUser}`), { username: editUsername, email: editEmail });
      setAllUsers((prevUsers) => prevUsers.map((user) => user.uid === editingUser ? { ...user, username: editUsername, email: editEmail } : user));
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditUsername("");
    setEditEmail("");
  };

  const handleDelete = async (uid) => {
    if (window.confirm("Are you sure you want to completely delete this student?")) {
      try {
        await remove(ref(db, `users/${uid}`));
        setAllUsers((prevUsers) => prevUsers.filter((user) => user.uid !== uid));
      } catch (error) {
        console.error("Error deleting student:", error);
      }
    }
  };

  const handleView = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  // Handlers for Breakdown Modal
  const handleViewBreakdown = (user) => {
    setBreakdownUser(user);
    setShowBreakdownModal(true);
  };

  const closeBreakdownModal = () => {
    setShowBreakdownModal(false);
    setBreakdownUser(null);
  };

  const filteredActiveUsers = getFilteredActiveUsers();
  
  const getGenderStats = () => {
    const male = activeUsers.filter(u => u.gender?.toLowerCase() === 'male').length;
    const female = activeUsers.filter(u => u.gender?.toLowerCase() === 'female').length;
    return { male, female };
  };
  const genderStats = getGenderStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-[#e2c7c7] border-t-[#800000] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto font-['Inter',sans-serif] space-y-4">
      
      {/* TABS (Condensed) */}
      <div className="flex flex-row gap-1.5 border-b border-gray-100 pb-3">
        <button 
          onClick={() => setActiveTab('active')}
          className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'active' ? 'bg-[#f4e8e8] text-[#800000]' : 'text-slate-500 hover:bg-gray-50 hover:text-slate-900'
          }`}
        >
          <CheckCircle className={`w-3.5 h-3.5 mr-2 ${activeTab === 'active' ? 'text-[#800000]' : 'text-slate-400'}`} />
          Active Roster
          <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-black ${activeTab === 'active' ? 'bg-[#e2c7c7] text-[#800000]' : 'bg-gray-100 text-gray-500'}`}>
            {activeUsers.length}
          </span>
        </button>
        
        <button 
          onClick={() => setActiveTab('pending')}
          className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'pending' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:bg-gray-50 hover:text-slate-900'
          }`}
        >
          <Clock className={`w-3.5 h-3.5 mr-2 ${activeTab === 'pending' ? 'text-orange-600' : 'text-slate-400'}`} />
          Pending Approvals
          {pendingUsers.length > 0 && (
            <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-black ${activeTab === 'pending' ? 'bg-orange-200 text-orange-800' : 'bg-orange-100 text-orange-600'}`}>
              {pendingUsers.length}
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('rejected')}
          className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'rejected' ? 'bg-gray-800 text-white' : 'text-slate-500 hover:bg-gray-50 hover:text-slate-900'
          }`}
        >
          <XCircle className={`w-3.5 h-3.5 mr-2 ${activeTab === 'rejected' ? 'text-gray-300' : 'text-slate-400'}`} />
          Declined
          <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-black ${activeTab === 'rejected' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
            {rejectedUsers.length}
          </span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          TAB 1: ACTIVE STUDENTS 
      ────────────────────────────────────────────────────────────────── */}
      {activeTab === 'active' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          
          {/* STATS CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total Active</p>
                <p className="text-2xl font-black text-gray-900">{activeUsers.length}</p>
              </div>
              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-400" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Passed Practice</p>
                <p className="text-2xl font-black text-emerald-600">
                  {activeUsers.filter(u => getScoreStats(u.live_exam_progress).percentage >= 75).length}
                </p>
              </div>
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Male</p>
                <p className="text-2xl font-black text-blue-600">{genderStats.male}</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <VenusAndMars className="w-5 h-5 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Female</p>
                <p className="text-2xl font-black text-pink-600">{genderStats.female}</p>
              </div>
              <div className="w-10 h-10 bg-pink-50 rounded-lg flex items-center justify-center">
                <VenusAndMars className="w-5 h-5 text-pink-500" />
              </div>
            </div>
          </div>

          {/* FILTERS & SEARCH */}
          <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            <div className="relative w-full lg:w-64">
              <input 
                type="text" 
                placeholder="Search students..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#f4e8e8] focus:border-[#800000] outline-none text-xs font-medium transition-all"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200">
                <button onClick={() => setScoreFilter("all")} className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${scoreFilter === "all" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>All Scores</button>
                <button onClick={() => setScoreFilter("passed")} className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${scoreFilter === "passed" ? "bg-emerald-100 text-emerald-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Passed</button>
                <button onClick={() => setScoreFilter("failed")} className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${scoreFilter === "failed" ? "bg-red-100 text-red-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Failed</button>
                <button onClick={() => setScoreFilter("notTaken")} className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${scoreFilter === "notTaken" ? "bg-gray-200 text-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>No Exam</button>
              </div>

              <div className="hidden lg:block w-px h-6 bg-gray-200 mx-1"></div>

              <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200">
                <button onClick={() => setGenderFilter("all")} className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${genderFilter === "all" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>All</button>
                <button onClick={() => setGenderFilter("male")} className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${genderFilter === "male" ? "bg-blue-100 text-blue-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Male</button>
                <button onClick={() => setGenderFilter("female")} className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${genderFilter === "female" ? "bg-pink-100 text-pink-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Female</button>
              </div>
            </div>
          </div>

          {/* TABLE */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            {filteredActiveUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-500">No students match your criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-3 pl-5 text-[9px] font-black uppercase tracking-widest text-gray-400">Student Profile</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Practice Score</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Diagnostic Exam</th>
                      <th className="px-4 py-3 pr-5 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredActiveUsers.map((user) => {
                      const practiceStats = getScoreStats(user.live_exam_progress);
                      const finalStats = getFinalExamStats(user);
                      const profilePic = user.profileImage || user.profilePicture;
                      
                      return (
                        <tr key={user.uid} className="transition-colors hover:bg-[#f4e8e8]/30 group">
                          <td className="px-4 py-3 pl-5">
                            {editingUser === user.uid ? (
                              <div className="space-y-1.5">
                                <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs" placeholder="Username" />
                                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs" placeholder="Email" />
                              </div>
                            ) : (
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
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-[9px] uppercase tracking-wider font-bold ${
                              practiceStats.total === 0 ? 'bg-gray-100 text-gray-500' : 
                              practiceStats.percentage >= 75 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                              'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {practiceStats.total === 0 ? 'No Data' : `${practiceStats.percentage}% (${practiceStats.correct}/${practiceStats.total})`}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center">
                                <Award className={`w-3.5 h-3.5 mr-1.5 ${finalStats.display === 'Not Taken' ? 'text-gray-300' : 'text-[#800000]'}`} />
                                <span className={`text-xs font-bold ${finalStats.display === 'Not Taken' ? 'text-gray-400' : 'text-gray-900'}`}>
                                  {finalStats.display}
                                </span>
                              </div>
                              {/* New Button for Subject Breakdown */}
                              {finalStats.display !== 'Not Taken' && (
                                <button 
                                  onClick={() => handleViewBreakdown(user)}
                                  className="px-2 py-1 bg-[#f4e8e8] text-[#800000] text-[9px] font-black uppercase tracking-widest rounded hover:bg-[#e2c7c7] transition-colors border border-[#e2c7c7] flex items-center"
                                  title="View Subject Breakdown"
                                >
                                  <FileText className="w-2.5 h-2.5 mr-1" /> Details
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 pr-5 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleView(user)} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-md transition-colors" title="View Profile">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {editingUser === user.uid ? (
                                <>
                                  <button onClick={handleSave} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-md transition-colors"><Save className="w-3.5 h-3.5" /></button>
                                  <button onClick={handleCancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition-colors"><X className="w-3.5 h-3.5" /></button>
                                </>
                              ) : (
                                <button onClick={() => handleEdit(user)} className="p-1.5 text-blue-400 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                              )}
                              <button onClick={() => handleDelete(user.uid)} className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
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
      )}

      {/* ─────────────────────────────────────────────────────────────────
          TAB 2: PENDING APPROVALS
      ────────────────────────────────────────────────────────────────── */}
      {activeTab === 'pending' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
          {pendingUsers.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed">
              <CheckCircle className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
              <p className="text-gray-900 text-sm font-bold">Inbox Zero!</p>
              <p className="text-gray-500 mt-1 text-xs font-medium">There are no pending accounts waiting for approval.</p>
            </div>
          ) : (
            pendingUsers.map((user) => {
              const profilePic = user.profileImage || user.profilePicture;
              
              return (
                <div key={user.uid} className="bg-white rounded-xl border border-orange-200 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">
                  <div className="h-1 bg-orange-400 w-full" />
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden border border-orange-200 ${!profilePic ? 'bg-orange-50 text-orange-600' : 'bg-gray-100'}`}>
                          {profilePic ? (
                            <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            user.firstName?.charAt(0) || user.username?.charAt(0) || 'U'
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-xs text-gray-900 line-clamp-1">
                            {user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.username || 'Unnamed'}
                          </h3>
                          <p className="text-gray-500 text-[10px] mt-0.5 line-clamp-1">{user.email}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-orange-50/50 rounded-lg p-2.5 space-y-1.5 mb-3 flex-1 border border-orange-100/50">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500 font-medium">Gender:</span>
                        <span className="font-bold text-gray-900">{user.gender || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500 font-medium">School:</span>
                        <span className="font-bold text-gray-900 text-right max-w-[60%] truncate" title={user.school}>{user.school || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500 font-medium">Applied:</span>
                        <span className="font-bold text-gray-900">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <button 
                        onClick={() => handleStatusChange(user.uid, "rejected", user.firstName)}
                        className="flex-1 flex items-center justify-center py-1.5 bg-white border border-gray-200 text-gray-600 text-[10px] font-bold rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      >
                        <X className="w-3 h-3 mr-1" /> Decline
                      </button>
                      <button 
                        onClick={() => handleStatusChange(user.uid, "active", user.firstName)}
                        className="flex-1 flex items-center justify-center py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        <Check className="w-3 h-3 mr-1" /> Approve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          TAB 3: DECLINED ACCOUNTS
      ────────────────────────────────────────────────────────────────── */}
      {activeTab === 'rejected' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm animate-in fade-in duration-300">
          {rejectedUsers.length === 0 ? (
            <div className="text-center py-12">
              <XCircle className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-500 font-bold text-xs">No declined accounts found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 pl-5 text-[9px] font-black uppercase tracking-widest text-gray-400">Student Info</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Status</th>
                    <th className="px-4 py-3 pr-5 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rejectedUsers.map((user) => {
                    const profilePic = user.profileImage || user.profilePicture;
                    return (
                      <tr key={user.uid} className="transition-colors hover:bg-gray-50/50">
                        <td className="px-4 py-3 pl-5">
                          <div className="flex items-center opacity-70">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 overflow-hidden border border-gray-200 bg-gray-100 text-gray-500">
                              {profilePic ? (
                                <img src={profilePic} alt="Profile" className="w-full h-full object-cover grayscale" />
                              ) : (
                                user.firstName?.charAt(0) || user.username?.charAt(0) || 'U'
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <p className="font-bold text-gray-600 line-through decoration-gray-400 text-xs truncate">
                                {user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.username}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5 truncate">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-gray-100 text-gray-500 text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-wider">
                            Declined
                          </span>
                        </td>
                        <td className="px-4 py-3 pr-5 flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => handleStatusChange(user.uid, "active", user.firstName)}
                            className="px-2.5 py-1 bg-white border border-gray-200 text-emerald-600 font-bold rounded-md hover:bg-emerald-50 hover:border-emerald-200 transition-colors text-[10px] shadow-sm"
                          >
                            Restore
                          </button>
                          <button 
                            onClick={() => handleDelete(user.uid)}
                            className="p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* ─────────────────────────────────────────────────────────────────
          USER DETAILS MODAL (VIEW) - COMPACT ID CARD STYLE
      ────────────────────────────────────────────────────────────────── */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-[50] p-4 animate-in fade-in duration-200 font-['Inter',sans-serif]">
          <div className="bg-white rounded-xl w-full max-w-[500px] overflow-hidden shadow-2xl transform scale-100">
            
            {/* Header / Banner */}
            <div className="relative h-24 bg-[#800000] overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
              <button onClick={closeModal} className="absolute top-3 right-3 p-1.5 bg-black/20 text-white rounded-md hover:bg-black/40 transition-colors backdrop-blur-md z-10">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="px-6 pb-6 relative">
              {/* Avatar overlapping banner */}
              <div className="flex justify-between items-end -mt-10 mb-4">
                <div className={`w-20 h-20 rounded-xl flex items-center justify-center font-black text-3xl shadow-lg border-4 border-white overflow-hidden relative z-10 ${
                  !(selectedUser.profileImage || selectedUser.profilePicture) ? (
                    selectedUser.gender?.toLowerCase() === 'male' ? 'bg-blue-100 text-blue-700' : 
                    selectedUser.gender?.toLowerCase() === 'female' ? 'bg-pink-100 text-pink-700' : 
                    'bg-gray-100 text-gray-700'
                  ) : 'bg-white'
                }`}>
                  {(selectedUser.profileImage || selectedUser.profilePicture) ? (
                    <img src={selectedUser.profileImage || selectedUser.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.firstName?.charAt(0) || selectedUser.username?.charAt(0) || 'U'
                  )}
                </div>
                <div className="mb-2">
                  <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                    selectedUser.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                    selectedUser.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {(selectedUser.status || 'Active')}
                  </span>
                </div>
              </div>

              {/* Name & Title */}
              <div className="mb-5">
                <h2 className="text-xl font-black text-gray-900 tracking-tight">
                  {selectedUser.firstName && selectedUser.lastName ? `${selectedUser.firstName} ${selectedUser.lastName}` : selectedUser.username || 'Unnamed Student'}
                </h2>
                <p className="text-xs text-gray-500 font-medium flex items-center mt-0.5">
                  <Mail className="w-3 h-3 mr-1.5 opacity-70" /> {selectedUser.email}
                </p>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Box 1: Demographics */}
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center">
                    <UserCircle className="w-3 h-3 mr-1.5" /> Demographics
                  </h4>
                  <div className="space-y-1.5">
                    <DetailRow label="Gender" value={selectedUser.gender || "Not specified"} />
                    <DetailRow label="Phone" value={selectedUser.phoneNumber || "Not provided"} />
                    <DetailRow label="Address" value={selectedUser.address || "Not provided"} />
                  </div>
                </div>

                {/* Box 2: Academics */}
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center">
                    <GraduationCap className="w-3 h-3 mr-1.5" /> Academics
                  </h4>
                  <div className="space-y-1.5">
                    <DetailRow label="School" value={selectedUser.school || "Not specified"} />
                    <DetailRow label="Graduated" value={selectedUser.yearGraduated || "N/A"} />
                    <DetailRow label="Board Exam" value={selectedUser.boardExamName || "N/A"} />
                  </div>
                </div>

                {/* Box 3: Exam Scores (Full Width) */}
                <div className="sm:col-span-2 bg-[#f4e8e8]/30 rounded-lg p-3 border border-[#e2c7c7]">
                  <h4 className="text-[9px] font-black text-[#800000] uppercase tracking-widest mb-2 flex items-center">
                    <Award className="w-3 h-3 mr-1.5" /> Examination Records
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-2 rounded-md border border-gray-100 shadow-sm">
                      <p className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">Practice Tests</p>
                      <p className="text-base font-black text-gray-900">
                        {getScoreStats(selectedUser.live_exam_progress).total === 0 
                          ? "No Data" 
                          : `${getScoreStats(selectedUser.live_exam_progress).percentage}%`}
                      </p>
                    </div>
                    <div className="bg-white p-2 rounded-md border border-gray-100 shadow-sm border-l-2 border-l-[#800000]">
                      <div className="flex justify-between items-center mb-0.5">
                        <p className="text-[9px] text-gray-500 uppercase font-bold">Diagnostic Final</p>
                        {getFinalExamStats(selectedUser).display !== 'Not Taken' && (
                          <button 
                            onClick={() => handleViewBreakdown(selectedUser)} 
                            className="text-[9px] text-[#800000] hover:underline font-black uppercase"
                          >
                            View Breakdown
                          </button>
                        )}
                      </div>
                      <p className={`text-base font-black ${getFinalExamStats(selectedUser).display === 'Not Taken' ? 'text-gray-400' : 'text-[#800000]'}`}>
                        {getFinalExamStats(selectedUser).display}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex justify-between items-center">
               <span className="text-[9px] font-bold text-gray-400">ID: <span className="font-mono">{selectedUser.uid.substring(0,8)}...</span></span>
               <button onClick={closeModal} className="px-4 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-100 transition-colors shadow-sm">
                 Close
               </button>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          DIAGNOSTIC EXAM BREAKDOWN MODAL (SUBJECTS & SETS)
      ────────────────────────────────────────────────────────────────── */}
      {showBreakdownModal && breakdownUser && (
        <div className="fixed inset-0 bg-slate-900/40 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 font-['Inter',sans-serif]">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden border border-gray-100">

            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/80">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center">
                  <div className="bg-[#e2c7c7] p-1.5 rounded-lg mr-2.5 shadow-sm">
                    <Award className="w-4 h-4 text-[#800000]" />
                  </div>
                  Diagnostic Breakdown
                </h3>
                <p className="text-[10px] text-slate-500 mt-1.5 font-bold flex items-center">
                  <User className="w-3 h-3 mr-1 opacity-70" />
                  {breakdownUser.firstName} {breakdownUser.lastName}
                </p>
              </div>
              <button
                onClick={closeBreakdownModal}
                className="p-2 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shadow-sm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Legend */}
            <div className="px-4 pt-3 pb-0 flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> Passed (≥75%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span> Failed (&#60;75%)</span>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1 bg-white">
              <div className="space-y-4">
                {getSubjectBreakdown(breakdownUser).length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-gray-100 shadow-sm">
                      <Award className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-xs font-bold text-gray-500">No detailed subject data available.</p>
                  </div>
                ) : (
                  getSubjectBreakdown(breakdownUser).map((subject, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      
                      {/* Subject Header */}
                      <div className="bg-gray-100/50 p-3 border-b border-gray-200 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-900 truncate pr-2">{subject.subjectName}</h4>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 shrink-0">
                          {subject.totalScore} / {subject.totalMax}
                        </span>
                      </div>

                      {/* Sets List */}
                      <div className="divide-y divide-gray-100">
                        {subject.sets.map((set, setIdx) => {
                          const isPassed = set.percentage >= 75;
                          const dotColor = isPassed ? 'bg-emerald-400' : 'bg-red-500';
                          const textColor = isPassed ? 'text-emerald-600' : 'text-red-600';

                          return (
                            <div key={setIdx} className="p-3 bg-white flex items-center justify-between hover:bg-gray-50 transition-colors">
                              <div className="flex items-center gap-2.5">
                                <FileText className="w-3.5 h-3.5 text-gray-400" />
                                <div>
                                  <p className="text-[11px] font-bold text-gray-800">{set.setName}</p>
                                  <p className="text-[9px] text-gray-500 font-medium">Score: {set.score} / {set.total}</p>
                                </div>
                              </div>
                              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black tracking-widest ${textColor}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                                {set.percentage}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <div className="flex flex-col pl-2">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Subjects</span>
                <span className="text-xs font-bold text-[#800000]">{getSubjectBreakdown(breakdownUser).length}</span>
              </div>
              <button
                onClick={closeBreakdownModal}
                className="px-5 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold rounded-lg text-xs transition-colors shadow-sm"
              >
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

export default UserList;