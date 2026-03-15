import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../Firebase';
import { 
  Users, 
  UserCircle, 
  Award,
  CheckCircle,
  XCircle,
  BookOpen
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

const RealAdminDash = ({ fullName }) => {
  const [loading, setLoading] = useState(true);
  
  // --- STATS STATE ---
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalEducators: 0,
    passedPractice: 0,
    passedDiagnostic: 0,
    takingReview: 0,
    failedStudents: 0
  });

  // --- CHART DATA STATES ---
  const [scoreDistribution, setScoreDistribution] = useState([]);
  const [passFailData, setPassFailData] = useState([]);

  // --- SCORE CALCULATION LOGIC ---
  const getScoreStats = (progressData) => {
    let correct = 0;
    let totalItems = 0;
    if (!progressData) return { percentage: 0, total: 0 };

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
    return { percentage, total: totalItems };
  };

  const getFinalExamStats = (user) => {
    const finalData = user.live_exams?.final_quiz || user.diagnostic_exam_progress || user.final_exam_progress || user.final_exam_score;
    if (!finalData) return { percentage: 0, total: 0 };
    if (typeof finalData === 'number') return { percentage: finalData, total: 100 };
    return getScoreStats(finalData);
  };

  // --- REAL-TIME DATA FETCHING ---
  useEffect(() => {
    const usersRef = ref(db, 'users');
    
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        
        let tStudents = 0;
        let tEducators = 0;
        let passPrac = 0;
        let passDiag = 0;
        let failDiag = 0;
        let inReview = 0;

        // For Charts
        let dist = { "0-50%": 0, "51-74%": 0, "75-89%": 0, "90-100%": 0 };

        Object.values(usersData).forEach((user) => {
          
          // Check Educators
          if (user.role === 'educator') {
            tEducators++;
          } 
          // Check Students
          else if (user.role === 'student' || !user.role) {
            tStudents++;
            
            // Only count stats for active students
            if (!user.status || user.status === 'active') {
              
              // Practice Stats
              const pracStats = getScoreStats(user.live_exam_progress);
              if (pracStats.total > 0 && pracStats.percentage >= 75) {
                passPrac++;
              }

              // Diagnostic Stats
              const diagStats = getFinalExamStats(user);
              if (diagStats.total > 0) {
                if (diagStats.percentage >= 75) {
                  passDiag++;
                } else {
                  failDiag++;
                }

                // Populate Chart Distribution
                if (diagStats.percentage <= 50) dist["0-50%"]++;
                else if (diagStats.percentage < 75) dist["51-74%"]++;
                else if (diagStats.percentage < 90) dist["75-89%"]++;
                else dist["90-100%"]++;

              } else {
                // If active but hasn't taken/passed the diagnostic, they are in review
                inReview++;
              }
            }
          }
        });

        setStats({
          totalStudents: tStudents,
          totalEducators: tEducators,
          passedPractice: passPrac,
          passedDiagnostic: passDiag,
          takingReview: inReview,
          failedStudents: failDiag
        });

        setScoreDistribution([
          { name: '0-50%', Students: dist["0-50%"] },
          { name: '51-74%', Students: dist["51-74%"] },
          { name: '75-89%', Students: dist["75-89%"] },
          { name: '90-100%', Students: dist["90-100%"] }
        ]);

        setPassFailData([
          { name: 'Passed', value: passDiag },
          { name: 'Failed', value: failDiag }
        ]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const PIE_COLORS = ['#10B981', '#EF4444']; 

  if (loading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-gray-200 border-t-[#800000]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 font-['Inter',sans-serif]">
      
      {/* --- HERO WELCOME --- */}
      <div className="rounded-2xl bg-[#800000] p-6 text-white shadow-md">
        <h2 className="text-2xl font-bold mb-1">Welcome back, {fullName}</h2>
        <p className="text-[#ffcccc] text-sm">Here is a real-time summary of the system's overall statistics and analytics.</p>
      </div>

      {/* --- KPI CARDS (Matched styling to EduDash) --- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Total Students</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900">{stats.totalStudents}</div>
          <p className="mt-1 text-[10px] text-gray-400 font-medium">Registered examinees</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Total Educators</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4e8e8] text-[#800000]">
              <UserCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900">{stats.totalEducators}</div>
          <p className="mt-1 text-[10px] text-gray-400 font-medium">Registered teachers</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Taking Review</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900">{stats.takingReview}</div>
          <p className="mt-1 text-[10px] text-gray-400 font-medium">Currently reviewing material</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Passed Practice</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900">{stats.passedPractice}</div>
          <p className="mt-1 text-[10px] text-gray-400 font-medium">Achieved 75%+ on practice</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Passed Diagnostic</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900">{stats.passedDiagnostic}</div>
          <p className="mt-1 text-[10px] text-gray-400 font-medium">Achieved 75%+ on final</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Failed Diagnostic</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900">{stats.failedStudents}</div>
          <p className="mt-1 text-[10px] text-gray-400 font-medium">Under 75% on final</p>
        </div>

      </div>

      {/* --- CHARTS ROW --- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
        
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-gray-900">Diagnostic Score Distribution</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution} margin={{ top: 5, right: 10, bottom: 25, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#6b7280' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  allowDecimals={false}
                />
                <RechartsTooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Bar 
                  dataKey="Students" 
                  fill="#800000" 
                  radius={[4, 4, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm flex flex-col">
          <h3 className="mb-4 text-sm font-bold text-gray-900">Pass / Fail Ratio (Final Exam)</h3>
          <div className="flex-1 min-h-[200px] flex items-center justify-center">
            {stats.passedDiagnostic === 0 && stats.failedStudents === 0 ? (
              <div className="text-center text-sm text-gray-400">No exam data available yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={passFailData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {passFailData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default RealAdminDash;