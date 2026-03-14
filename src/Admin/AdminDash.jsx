import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { supabase } from '../../supabaseClient'; 

// --- ADMIN COMPONENT IMPORTS ---
import UserList from './Userlist';
import EduList from './EdulList';
import {
  Home,
  GraduationCap,
  UserCircle,
  BarChart3,
  CheckCircle,
  XCircle,
  LogOut,
  Menu,
  Camera,
  Shield
} from 'lucide-react';

const AdminDash = () => {
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
  const [fullName, setFullName] = useState("Administrator");
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
            
            const nameFromEmail = user.email ? user.email.split("@")[0] : "Admin";
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

      const { data } = supabase.storage
        .from("profile_ccjs")
        .getPublicUrl(fileName);

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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // --- ADMINISTRATOR NAVIGATION ITEMS ---
  const navItems = [
    { id: 'dashboard', icon: <Home className="h-[18px] w-[18px]" />, label: 'Dashboard' },
    { id: 'student-mgmt', icon: <GraduationCap className="h-[18px] w-[18px]" />, label: 'Student Management' },
    { id: 'educator-mgmt', icon: <UserCircle className="h-[18px] w-[18px]" />, label: 'Educator Management' },
    { id: 'records', icon: <BarChart3 className="h-[18px] w-[18px]" />, label: 'Overall Records' },
    { id: 'eligible', icon: <CheckCircle className="h-[18px] w-[18px]" />, label: 'Eligible' },
    { id: 'not-eligible', icon: <XCircle className="h-[18px] w-[18px]" />, label: 'Not Eligible' }
  ];

  // Helper to get dynamic page titles for the header
  const getPageTitle = () => {
    const activeItem = navItems.find(item => item.id === activeTab);
    return activeItem ? activeItem.label : 'Administrator Dashboard';
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
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');
        `}
      </style>

      {/* Full Screen Layout Container */}
      <div className="flex h-screen w-screen overflow-hidden bg-[#F8F9FA] font-['Inter',sans-serif]">
        
        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          accept="image/*" 
          className="hidden" 
        />

        {/* --- SIDEBAR --- */}
        <aside className={`relative z-40 flex h-full flex-col bg-white border-r border-gray-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
          
          {/* Sidebar Top 1: Logo, Text & Menu Toggle */}
          <div className={`flex h-16 shrink-0 items-center border-b border-gray-100 ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
            <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
              <img 
                src="/logo.png" 
                alt="CCJE Logo" 
                className="h-8 w-auto shrink-0 object-contain"
              />
              <span className="font-['Playfair_Display',serif] text-xl font-black tracking-wide text-[#800000]">
                CCJE
              </span>
            </div>
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#800000]/20"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>

          {/* Sidebar Top 2: User Profile Area (Condensed) */}
          <div className={`flex flex-col items-center border-b border-gray-100 py-6 bg-gradient-to-b from-white to-gray-50/50 ${sidebarCollapsed ? 'px-2' : 'px-6'}`}>
            <div className="relative group">
              <button 
                onClick={triggerFileInput}
                className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white shadow-sm bg-gray-100 transition-all group-hover:border-gray-50 group-hover:shadow-md"
                style={{ width: sidebarCollapsed ? '48px' : '72px', height: sidebarCollapsed ? '48px' : '72px' }}
                title="Upload Profile Picture"
              >
                {uploading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#800000] border-t-transparent"></div>
                ) : profileImage ? (
                  <>
                    <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 hidden items-center justify-center bg-black/40 transition-all group-hover:flex">
                      <Camera className="text-white" style={{ width: sidebarCollapsed ? '16px' : '20px', height: sidebarCollapsed ? '16px' : '20px' }} />
                    </div>
                  </>
                ) : (
                  <>
                    <UserCircle className="text-gray-400" style={{ width: sidebarCollapsed ? '24px' : '36px', height: sidebarCollapsed ? '24px' : '36px' }} />
                    <div className="absolute inset-0 hidden items-center justify-center bg-black/5 transition-all group-hover:flex">
                      <Camera className="text-gray-600" style={{ width: sidebarCollapsed ? '16px' : '24px', height: sidebarCollapsed ? '16px' : '24px' }} />
                    </div>
                  </>
                )}
              </button>
              
              <div className="absolute bottom-0 right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500"></div>
            </div>

            {!sidebarCollapsed && (
              <div className="mt-3 flex w-full flex-col items-center overflow-hidden text-center">
                <span className="w-full truncate text-sm font-bold text-gray-900">{fullName}</span>
                <span className="mt-0.5 flex items-center gap-1.5 w-full justify-center truncate text-[10px] font-bold uppercase tracking-wider text-[#800000]">
                  Administrator
                </span>
              </div>
            )}
          </div>

          {/* Sidebar Middle: Navigation Links */}
          <nav className="flex flex-col flex-1 py-4 pl-4 pr-0 overflow-hidden">
            {!sidebarCollapsed && (
              <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Admin Panel
              </div>
            )}
            
            <div className="flex flex-col flex-1 space-y-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={sidebarCollapsed ? item.label : ""}
                    className={`group relative flex w-full items-center py-2.5 text-sm transition-all duration-200
                      ${sidebarCollapsed ? 'justify-center px-0 rounded-xl' : 'justify-start pl-3'}
                      ${isActive && !sidebarCollapsed
                        ? 'bg-[#f4e8e8] text-[#800000] font-bold border-r-4 border-[#800000] rounded-l-xl' 
                        : isActive && sidebarCollapsed
                        ? 'bg-[#f4e8e8] text-[#800000] font-bold'
                        : 'text-slate-600 hover:bg-gray-50 hover:text-gray-900 font-medium rounded-l-xl'}`}
                  >
                    <div className={`shrink-0 transition-colors duration-200 
                      ${isActive ? 'text-[#800000]' : 'text-slate-500 group-hover:text-slate-700'}`}>
                      <div className={`${isActive && !sidebarCollapsed ? 'bg-[#e2c7c7] p-1.5 rounded-md' : 'p-1.5'}`}>
                        {item.icon}
                      </div>
                    </div>
                    
                    {!sidebarCollapsed && (
                      <span className="ml-3 text-left whitespace-normal leading-snug pr-3">
                        {item.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Sidebar Bottom: Log Out Button */}
          <div className="p-4 bg-gray-50/50">
            <button 
              onClick={handleLogout}
              title={sidebarCollapsed ? "Sign Out" : ""}
              className={`flex w-full items-center rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-gray-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-700 ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <LogOut className="h-[18px] w-[18px]" />
              {!sidebarCollapsed && <span className="ml-3">Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* --- MAIN CONTENT AREA --- */}
        <main className="flex h-full flex-1 flex-col overflow-hidden">
          
          {/* Header */}
          <header className="sticky top-0 z-30 flex h-20 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              {getPageTitle()}
            </h1>
            
            <div className="flex items-center gap-3">
              <div className="flex h-8 items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                </span>
                System Online
              </div>
            </div>
          </header>

          {/* Content Container */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="mx-auto w-full max-w-7xl">
              
              {/* Insert Admin Components Here based on activeTab state */}
              {activeTab === 'dashboard' && (
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-2xl">
                    <p className="text-gray-400 font-medium">Dashboard Overview Stats Coming Soon</p>
                </div>
              )}
              
              {activeTab === 'student-mgmt' && <UserList />}
              
              {activeTab === 'educator-mgmt' && <EduList />}
              
              {activeTab === 'records' && <></>}
              {activeTab === 'eligible' && <></>}
              {activeTab === 'not-eligible' && <></>}

            </div>
          </div>
        </main>

      </div>
    </>
  );
};

export default AdminDash;