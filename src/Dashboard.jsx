import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { supabase } from '../supabaseClient'; 

import Areas from './Areas'; 

import {
  Home,
  User,
  BookOpen,
  BarChart3,
  LogOut,
  Menu,
  Camera,
  ShieldAlert
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const db = getDatabase();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [userUID, setUserUID] = useState(null);
  const [fullName, setFullName] = useState("Student");
  const [profileImage, setProfileImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 🔒 EXAM LOCK STATE
  const [examLocked, setExamLocked] = useState(false);
  // Remember sidebar state before exam so we can restore it after
  const prevSidebarState = useRef(false);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserUID(user.uid);
        const userRef = ref(db, `users/${user.uid}`);
        const unsubscribeUser = onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            setProfileImage(data.profileImage || data.profilePicture || null);
            const nameFromEmail = user.email ? user.email.split("@")[0] : "Student";
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

  // 🔒 When exam starts: remember sidebar state, force-collapse it, lock everything
  const handleExamStart = () => {
    prevSidebarState.current = sidebarCollapsed;
    setSidebarCollapsed(true);
    setExamLocked(true);
  };

  // 🔒 When exam ends: unlock and restore previous sidebar width
  const handleExamEnd = () => {
    setExamLocked(false);
    setSidebarCollapsed(prevSidebarState.current);
  };

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
      await update(ref(db, `users/${userUID}`), { profileImage: publicUrl, profilePicture: publicUrl });
      setProfileImage(publicUrl);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image. Please check your connection.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerFileInput = () => {
    if (examLocked) return;
    fileInputRef.current?.click();
  };

  const handleLogout = async () => {
    if (examLocked) return;
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleTabChange = (tabId) => {
    if (examLocked) return;
    setActiveTab(tabId);
  };

  const navItems = [
    { id: 'home',    icon: <Home className="h-[20px] w-[20px]" />,    label: 'Overview' },
    { id: 'areas',   icon: <BookOpen className="h-[20px] w-[20px]" />, label: 'Licensure Areas' },
    { id: 'results', icon: <BarChart3 className="h-[20px] w-[20px]" />,label: 'Exam Results' }
  ];

  const getPageTitle = () => {
    const activeItem = navItems.find(item => item.id === activeTab);
    return activeItem ? activeItem.label : 'Student Dashboard';
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');

        .sidebar-exam-locked {
          filter: grayscale(1) brightness(0.88) contrast(0.9);
          pointer-events: none;
          user-select: none;
          transition: filter 0.35s ease, width 0.3s ease;
        }
        .sidebar-exam-unlocked {
          filter: grayscale(0) brightness(1) contrast(1);
          pointer-events: all;
          transition: filter 0.35s ease, width 0.3s ease;
        }
      `}</style>

      <div className="flex h-screen w-screen overflow-hidden bg-[#F8F9FA] font-['Inter',sans-serif]">

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />

        {/* ══════════════════════════════════════════
            S I D E B A R
            • Auto-collapses to icon-strip on exam start
            • Goes grayscale + pointer-events:none
        ═══════════════════════════════════════════ */}
        <aside
          className={`
            relative z-40 flex h-full flex-col bg-white border-r border-gray-200
            shadow-[4px_0_24px_rgba(0,0,0,0.02)]
            transition-[width] duration-300 ease-in-out
            ${sidebarCollapsed ? 'w-20' : 'w-72'}
            ${examLocked ? 'sidebar-exam-locked' : 'sidebar-exam-unlocked'}
          `}
        >

          {/* ── Top: Logo + Toggle ── */}
          <div className={`flex h-20 shrink-0 items-center border-b border-gray-100 ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
            <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
              <img src="/logo.png" alt="CCJE Logo" className="h-9 w-auto shrink-0 object-contain" />
              <span className="font-['Playfair_Display',serif] text-2xl font-black tracking-wide text-[#800000]">
                CCJE
              </span>
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#800000]/20"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          {/* ── Profile Area ── */}
          <div className={`flex flex-col items-center border-b border-gray-100 py-8 bg-gradient-to-b from-white to-gray-50/50 ${sidebarCollapsed ? 'px-2' : 'px-6'}`}>
            <div className="relative group">
              <button
                onClick={triggerFileInput}
                className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white shadow-md bg-gray-100 transition-all group-hover:border-gray-50 group-hover:shadow-lg"
                style={{ width: sidebarCollapsed ? '48px' : '88px', height: sidebarCollapsed ? '48px' : '88px' }}
                title="Upload Profile Picture"
              >
                {uploading ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#800000] border-t-transparent" />
                ) : profileImage ? (
                  <>
                    <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 hidden items-center justify-center bg-black/40 transition-all group-hover:flex">
                      <Camera className="text-white" style={{ width: sidebarCollapsed ? '16px' : '24px', height: sidebarCollapsed ? '16px' : '24px' }} />
                    </div>
                  </>
                ) : (
                  <>
                    <User className="text-gray-400" style={{ width: sidebarCollapsed ? '24px' : '40px', height: sidebarCollapsed ? '24px' : '40px' }} />
                    <div className="absolute inset-0 hidden items-center justify-center bg-black/5 group-hover:flex">
                      <Camera className="text-gray-600" style={{ width: sidebarCollapsed ? '16px' : '24px', height: sidebarCollapsed ? '16px' : '24px' }} />
                    </div>
                  </>
                )}
              </button>
              <div className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />
            </div>

            {!sidebarCollapsed && (
              <div className="mt-5 flex w-full flex-col items-center overflow-hidden text-center">
                <span className="w-full truncate text-base font-bold text-gray-900">{fullName}</span>
                <span className="mt-1 flex items-center gap-1.5 w-full justify-center truncate text-xs font-semibold uppercase tracking-wider text-[#800000]">
                  Examinee
                </span>
              </div>
            )}
          </div>

          {/* ── Nav Links ── */}
          <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
            {!sidebarCollapsed && (
              <div className="mb-4 px-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                Student Portal
              </div>
            )}
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  title={sidebarCollapsed ? item.label : ''}
                  className={`
                    group relative flex w-full items-center rounded-xl px-3 py-3.5 text-sm font-medium
                    transition-all duration-200 overflow-hidden
                    ${sidebarCollapsed ? 'justify-center' : 'justify-start'}
                    ${isActive
                      ? 'bg-[#800000]/5 text-[#800000] font-semibold'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 h-full w-1 rounded-r-md bg-[#800000]" />
                  )}
                  <div className={`transition-colors duration-200 ${isActive ? 'text-[#800000]' : 'text-gray-400 group-hover:text-gray-600'}`}>
                    {item.icon}
                  </div>
                  {!sidebarCollapsed && <span className="ml-3.5 truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* ── Exam lock pill — only visible when collapsed + locked ── */}
          {examLocked && sidebarCollapsed && (
            <div className="flex justify-center pb-3">
              <div
                className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center"
                title="Exam in progress"
              >
                <ShieldAlert className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          )}

          {/* ── Exam lock banner — only visible when expanded + locked ── */}
          {examLocked && !sidebarCollapsed && (
            <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-gray-300 bg-gray-100 px-3 py-2.5">
              <ShieldAlert className="w-4 h-4 text-gray-500 shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">Exam in Progress</p>
                <p className="text-[9px] text-gray-400 font-medium mt-0.5">Navigation disabled</p>
              </div>
            </div>
          )}

          {/* ── Sign Out ── */}
          <div className="p-4 bg-gray-50/50">
            <button
              onClick={handleLogout}
              title={sidebarCollapsed ? "Sign Out" : ""}
              className={`flex w-full items-center rounded-xl border border-transparent px-3 py-3 text-sm font-medium text-gray-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-700 ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <LogOut className="h-[20px] w-[20px]" />
              {!sidebarCollapsed && <span className="ml-3.5">Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* ══════════════════════════════════════════
            M A I N   C O N T E N T
        ═══════════════════════════════════════════ */}
        <main className="flex h-full flex-1 flex-col overflow-hidden">

          <header className="sticky top-0 z-30 flex h-20 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              {getPageTitle()}
            </h1>
            <div className="flex items-center gap-3">
              {examLocked && (
                <div className="flex h-8 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-600">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Exam In Progress
                </div>
              )}
              <div className="flex h-8 items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                </span>
                System Online
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8">
            <div className="mx-auto w-full max-w-7xl">

              {activeTab === 'home' && <>{/* <LandingPages /> */}</>}

              {activeTab === 'areas' && (
                <Areas
                  userUID={userUID}
                  onExamStart={handleExamStart}
                  onExamEnd={handleExamEnd}
                />
              )}

              {activeTab === 'results' && <>{/* <Records /> */}</>}

            </div>
          </div>
        </main>

      </div>
    </>
  );
};

export default Dashboard;