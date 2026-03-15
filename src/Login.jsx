import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database'; 
import { auth } from './Firebase'; 
import { Eye, EyeOff } from 'lucide-react'; // <-- Imported icons for the password toggle

const Login = () => {
  const navigate = useNavigate();

  // State for form inputs and UI feedback
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // New States for features
  const [showPassword, setShowPassword] = useState(false);
  const [initializing, setInitializing] = useState(true); // Prevents flickering while checking auto-login

  // --- AUTO LOGIN LOGIC ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // If user is already logged in, fetch their role
          const db = getDatabase();
          const userRef = ref(db, `users/${user.uid}`);
          const snapshot = await get(userRef);

          if (snapshot.exists()) {
            const userData = snapshot.val();
            const role = userData.role || 'noRole';

            // Auto route based on role
            if (role === 'admin') {
              navigate('/admin');
            } else if (role === 'educator') {
              navigate('/educator');
            } else {
              navigate('/dashboard');
            }
          } else {
            navigate('/dashboard');
          }
        } catch (err) {
          console.error("Auto-login error:", err);
          setInitializing(false);
        }
      } else {
        // No user is logged in, show the login form
        setInitializing(false);
      }
    });

    // Cleanup the listener on unmount
    return () => unsubscribe();
  }, [navigate]);

  // --- HANDLE MANUAL LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault(); 
    setError('');
    setLoading(true);

    try {
      // 1. Authenticate the user
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 2. Fetch the user's data from Firebase Realtime Database to check their role
      const db = getDatabase();
      const userRef = ref(db, `users/${user.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        const role = userData.role || 'noRole'; 

        // 3. Route based on the fetched role
        if (role === 'admin') {
          navigate('/admin');
        } else if (role === 'educator') {
          navigate('/educator');
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
      
    } catch (err) {
      console.error("Login Error:", err.code);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("Invalid email or password. Please try again.");
      } else {
        setError("Failed to sign in. Please check your connection.");
      }
      setLoading(false); // Only set loading to false if there's an error (otherwise it redirects)
    } 
  };

  // Show a blank screen or a loading spinner while Firebase checks for an existing session
  if (initializing) {
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
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700;900&display=swap');
        `}
      </style>

      <div className="flex h-screen w-screen overflow-hidden bg-[#F8F9FA] font-['Inter',sans-serif]">
        
        {/* LEFT SIDE: CPSU Campus Image with Maroon Tint */}
        <div className="relative hidden w-7/12 lg:block">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('/bg.jpg')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#4a0404] via-[#800000]/80 to-transparent" />
          
          <div className="relative z-10 flex h-full flex-col items-start justify-end p-20 text-white">
            <img 
              src="/logo.png" 
              alt="CCJE Logo" 
              className="mb-8 h-28 w-auto object-contain drop-shadow-xl"
            />
            <h2 className="font-['Playfair_Display',serif] text-5xl font-black leading-tight tracking-wide xl:text-6xl">
              CCJE <br /> 
              <span className="text-3xl font-normal italic text-white/90 xl:text-4xl">
                Licensure Management System
              </span>
            </h2>
          </div>
        </div>

        {/* RIGHT SIDE: Professional College Portal Form */}
        <div className="flex w-full items-center justify-center bg-white lg:w-5/12">
          <div className="w-full max-w-md px-8 lg:px-12">
            
            {/* Header Section */}
            <div className="mb-10 text-center lg:text-left">
              <img 
                src="/logo.png" 
                alt="CCJE Logo" 
                className="mx-auto mb-6 h-20 w-auto object-contain lg:hidden"
              />
              <h1 className="font-['Playfair_Display',serif] text-4xl font-bold tracking-tight text-gray-900">
                Log In
              </h1>
              <p className="mt-2 text-sm font-medium text-gray-500">
                Secure access for CCJE students and authorized personnel.
              </p>
            </div>

            {/* Error Message Display */}
            {error && (
              <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-200">
                {error}
              </div>
            )}

            {/* Form Card */}
            <form onSubmit={handleLogin} className="space-y-5">
              
              {/* Email Input */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Email Address
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. student@cpsu.edu.ph"
                    className="block w-full rounded-lg border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 transition-colors focus:border-[#800000] focus:outline-none focus:ring-1 focus:ring-[#800000]"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700">
                    Password
                  </label>
                 
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full rounded-lg border border-gray-300 bg-white py-3 pl-11 pr-12 text-sm text-gray-900 transition-colors focus:border-[#800000] focus:outline-none focus:ring-1 focus:ring-[#800000]"
                  />
                  {/* Show/Hide Password Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-[#800000] focus:outline-none transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Main Action */}
              <button 
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg bg-[#800000] px-4 py-3.5 text-sm font-bold tracking-wide text-white shadow-sm transition-colors hover:bg-[#600000] focus:outline-none focus:ring-2 focus:ring-[#800000] focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Authenticating...' : 'Secure Sign In'}
              </button>
            </form>

            {/* Support Links */}
            <div className="mt-10 flex flex-col items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-3 text-xs font-medium text-gray-400">
                <a href="#" className="hover:text-gray-600">IT Help Desk</a>
                <span>•</span>
                <a href="#" className="hover:text-gray-600">Privacy Policy</a>
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

export default Login;