import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { supabase } from '../../supabaseClient'; 

// Import your components
import Scheduler from './Scheduler'; 
import UserList from './Userlist';
import ManageDiag from './ManageDiag';
import PracticeTest from './PracticeTest';
import DevUpload from './ManageReview';
import RealEduDash from './RealEduDash';

import {
  Home,
  Calendar,
  Users,
  FileText,
  Target,
  Layers,
  BarChart3,
  LogOut,
  Menu,
  Camera,
  User
} from 'lucide-react';

const EduDash = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const db = getDatabase();
  const fileInputRef = useRef(null);

  // --- NAVIGATION & VIEW STATES ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // --- USER PROFILE STATES ---
  const [userUID, setUserUID] = useState(null);
  const [fullName, setFullName] = useState("Educator");
  const [profileImage, setProfileImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  // --- DATA FETCHING ---
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserUID(user.uid);
        const userRef = ref(db, `users/${user.uid}`);
        const unsubscribeUser = onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            setProfileImage(data.profileImage || data.profilePicture || null);
            const nameFromEmail = user.email ? user.email.split("@")[0] : "Educator";
            const firstLast = data.firstName ? `${data.firstName} ${data.lastName || ""}`.trim() : null;
            const displayValue = data.fullName || firstLast || nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
            setFullName(displayValue);
          }
          setLoading(false);
        });
        return () => unsubscribeUser();
      } else {
        navigate('/');
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [auth, db, navigate]);

  // --- SUPABASE IMAGE UPLOAD ---
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !userUID) return;
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${userUID}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("profile_ccjs")
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("profile_ccjs").getPublicUrl(fileName);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      await update(ref(db, `users/${userUID}`), {
        profileImage: publicUrl,
        profilePicture: publicUrl,
      });
      setProfileImage(publicUrl);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image. Please check your connection.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // --- EDUCATOR NAVIGATION ITEMS (REMOVED ELIGIBLE/NOT-ELIGIBLE) ---
  const navItems = [
    { id: 'dashboard', icon: <Home className="h-[18px] w-[18px]" />, label: 'Dashboard' },
    { id: 'schedule-exam', icon: <Calendar className="h-[18px] w-[18px]" />, label: 'Schedule Exam' },
    { id: 'student-mgmt', icon: <Users className="h-[18px] w-[18px]" />, label: 'Student Management' },
    { id: 'manage-diagnostic', icon: <FileText className="h-[18px] w-[18px]" />, label: 'Manage Diagnostic' },
    { id: 'manage-practice', icon: <Target className="h-[18px] w-[18px]" />, label: 'Manage Practice Test' },
    { id: 'manage-review', icon: <Layers className="h-[18px] w-[18px]" />, label: 'Manage Review' },
    { id: 'records', icon: <BarChart3 className="h-[18px] w-[18px]" />, label: 'Overall Records' }
  ];

  const getPageTitle = () => {
    const activeItem = navItems.find(item => item.id === activeTab);
    return activeItem ? activeItem.label : 'Educator Dashboard';
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-gray-200 border-t-[#800000]"></div>
      </div>
    );
  }

  return (
    <>
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');`}
      </style>

      <div className="flex h-screen w-screen overflow-hidden bg-[#F8F9FA] font-['Inter',sans-serif]">
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

        {/* --- SIDEBAR --- */}
        <aside className={`relative z-40 flex h-full flex-col bg-white border-r border-gray-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
          <div className={`flex h-16 shrink-0 items-center border-b border-gray-100 ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
            <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
              <img src="/logo.png" alt="CCJE Logo" className="h-8 w-auto shrink-0 object-contain" />
              <span className="font-['Playfair_Display',serif] text-xl font-black tracking-wide text-[#800000]">CCJE</span>
            </div>
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-800">
              <Menu className="h-4 w-4" />
            </button>
          </div>

          {/* User Profile Area */}
          <div className={`flex flex-col items-center border-b border-gray-100 py-4 bg-gradient-to-b from-white to-gray-50/50 ${sidebarCollapsed ? 'px-2' : 'px-6'}`}>
            <div className="relative group">
              <button onClick={triggerFileInput} className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white shadow-sm bg-gray-100" style={{ width: sidebarCollapsed ? '40px' : '60px', height: sidebarCollapsed ? '40px' : '60px' }}>
                {uploading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#800000] border-t-transparent"></div>
                ) : profileImage ? (
                  <>
                    <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex"><Camera className="text-white" size={sidebarCollapsed ? 14 : 20} /></div>
                  </>
                ) : (
                  <>
                    <User className="text-gray-400" size={sidebarCollapsed ? 20 : 30} />
                    <div className="absolute inset-0 hidden items-center justify-center bg-black/5 group-hover:flex"><Camera className="text-gray-600" size={sidebarCollapsed ? 14 : 20} /></div>
                  </>
                )}
              </button>
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500"></div>
            </div>
            {!sidebarCollapsed && (
              <div className="mt-2 flex w-full flex-col items-center text-center">
                <span className="w-full truncate text-sm font-bold text-gray-900">{fullName}</span>
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#800000]">Educator</span>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col flex-1 py-3 pl-4 pr-0 overflow-hidden">
            {!sidebarCollapsed && <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Educator Tools</div>}
            <div className="flex flex-col flex-1 justify-evenly space-y-0.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`group relative flex w-full items-center py-2 text-sm transition-all duration-200
                      ${sidebarCollapsed ? 'justify-center px-0 rounded-xl' : 'justify-start pl-3'}
                      ${isActive ? 'bg-[#f4e8e8] text-[#800000] font-bold border-r-4 border-[#800000] rounded-l-xl' : 'text-slate-600 hover:bg-gray-50 rounded-l-xl'}`}
                  >
                    <div className={`p-1.5 ${isActive && !sidebarCollapsed ? 'bg-[#e2c7c7] rounded-md' : ''}`}>{item.icon}</div>
                    {!sidebarCollapsed && <span className="ml-2.5 text-left">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="p-3 bg-gray-50/50">
            <button onClick={handleLogout} className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-700 ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}>
              <LogOut className="h-[18px] w-[18px]" />
              {!sidebarCollapsed && <span className="ml-3">Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* --- MAIN CONTENT --- */}
        <main className="flex h-full flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-30 flex h-20 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8">
            <h1 className="text-xl font-bold text-gray-900">{getPageTitle()}</h1>
            <div className="flex h-8 items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              System Online
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8">
            <div className="mx-auto w-full max-w-7xl">
              {activeTab === 'dashboard' && <RealEduDash fullName={fullName} />}
              {activeTab === 'schedule-exam' && <Scheduler />}
              {activeTab === 'student-mgmt' && <UserList />}
              {activeTab === 'manage-diagnostic' && <ManageDiag />}
              {activeTab === 'manage-practice' && <PracticeTest />}
              {activeTab === 'manage-review' && <DevUpload />}
              {/* Overall Records is currently empty as per your original code */}
              {activeTab === 'records' && <div className="text-center py-10 text-gray-500">Records View Coming Soon</div>}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default EduDash;