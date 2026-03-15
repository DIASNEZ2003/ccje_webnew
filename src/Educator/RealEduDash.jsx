import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import {
  Users, BookOpen, TrendingUp, ShieldAlert, Clock, Award,
  CheckCircle, AlertTriangle, User, Search, X, ChevronRight
} from 'lucide-react';

// ── Student Detail Modal ──────────────────────────────────────────────────────
const StudentModal = ({ student, alerts, onClose }) => {
  if (!student) return null;

  const studentAlerts = alerts.filter(a =>
    a.message.startsWith(student.name + ' ')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#800000] px-6 py-5 flex items-center gap-4">
          {student.profilePic ? (
            <img src={student.profilePic} alt={student.name}
              className="h-12 w-12 rounded-full object-cover border-2 border-white/40 shadow" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
              <User className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-base truncate">{student.name}</p>
            <p className="text-[#ffcccc] text-xs truncate">{student.email}</p>
          </div>
          <button onClick={onClose}
            className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
          <div className="px-6 py-4 text-center">
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Exams Completed</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{student.examsTaken}</p>
          </div>
          <div className="px-6 py-4 text-center">
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Average Score</p>
            <p className={`text-2xl font-black mt-0.5 ${
              student.avgScore >= 75 ? 'text-green-600' :
              student.avgScore > 0 ? 'text-red-600' : 'text-gray-400'
            }`}>{student.avgScore}%</p>
          </div>
        </div>

        {/* Activity List */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Activity History</p>
          {studentAlerts.length > 0 ? (
            <div className="space-y-2">
              {studentAlerts.map(alert => (
                <div key={alert.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                  {alert.type === 'violation' ? (
                    <ShieldAlert className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 leading-snug">
                      {alert.message.replace(student.name + ' ', '')}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{alert.time}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    alert.status === 'Warning' ? 'bg-orange-100 text-orange-700' :
                    alert.status === 'Failed'  ? 'bg-red-100 text-red-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {alert.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <CheckCircle className="h-8 w-8 mb-2 text-gray-200" />
              <p className="text-sm">No activity recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const RealEduDash = ({ fullName }) => {
  const [loading, setLoading] = useState(true);

  const [totalStudents, setTotalStudents] = useState(0);
  const [avgPassingRate, setAvgPassingRate] = useState(0);
  const [activeExamsCount, setActiveExamsCount] = useState(0);
  const [totalViolations, setTotalViolations] = useState(0);

  const [performanceData, setPerformanceData] = useState([]);
  const [engagementData, setEngagementData] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [studentInsights, setStudentInsights] = useState([]);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((new Date() - timestamp) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " mins ago";
    return "Just now";
  };

  useEffect(() => {
    const db = getDatabase();
    const usersRef = ref(db, 'users');
    const schedulesRef = ref(db, 'exam_schedules');
    let allSchedulesData = {};

    const unsubSchedules = onValue(schedulesRef, (snapshot) => {
      if (snapshot.exists()) {
        allSchedulesData = snapshot.val();
        let activeCount = 0;
        const now = new Date();
        Object.values(allSchedulesData).forEach(schedule => {
          if (schedule.date) {
            const scheduleDate = new Date(`${schedule.date}T${schedule.endTime || '23:59'}`);
            if (scheduleDate >= now) activeCount++;
          }
        });
        setActiveExamsCount(activeCount);
      }
    });

    const unsubUsers = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const users = snapshot.val();
        let studentCount = 0;
        let totalScorePercentages = 0;
        let totalExamsTaken = 0;
        let violationsCount = 0;
        let subjectAverages = {};
        let examsPerDay = {};
        let alerts = [];
        let studentsArray = [];

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          examsPerDay[d.toLocaleDateString()] = { name: days[d.getDay()], dateObj: d, exams: 0 };
        }

        Object.keys(users).forEach(uid => {
          const user = users[uid];
          const isStudent = !user.role || user.role === 'user' || user.role === 'student';
          if (!isStudent) return;

          studentCount++;
          const studentName = user.fullName || user.firstName || 'A Student';
          const profilePic = user.profileImage || user.profilePicture || null;
          let s_totalScore = 0;
          let s_examsTaken = 0;

          if (user.live_exams && user.live_exams.final_quiz) {
            const subjects = user.live_exams.final_quiz;
            Object.keys(subjects).forEach(subjectKey => {
              const sets = subjects[subjectKey];
              Object.keys(sets).forEach(setKey => {
                const exam = sets[setKey];
                const subjectName = exam.subject || subjectKey.replace(/_/g, ' ');
                const setName = exam.setName || setKey.replace(/_/g, ' ');
                const percentage = exam.percentage || 0;
                const timestamp = exam.timestamp || Date.now();

                totalScorePercentages += percentage;
                totalExamsTaken++;
                s_totalScore += percentage;
                s_examsTaken++;

                if (!subjectAverages[subjectName]) {
                  subjectAverages[subjectName] = { totalPercentage: 0, count: 0 };
                }
                subjectAverages[subjectName].totalPercentage += percentage;
                subjectAverages[subjectName].count++;

                const examDateStr = new Date(timestamp).toLocaleDateString();
                if (examsPerDay[examDateStr]) examsPerDay[examDateStr].exams++;

                alerts.push({
                  id: `exam-${uid}-${timestamp}`,
                  type: 'completion',
                  message: `${studentName} completed ${subjectName} ${setName} (${percentage}%)`,
                  timestamp,
                  time: formatTimeAgo(timestamp),
                  status: percentage >= 75 ? 'Passed' : 'Failed'
                });

                if (exam.violationsAtSubmit && exam.violationsAtSubmit > 0) {
                  violationsCount += exam.violationsAtSubmit;
                  alerts.push({
                    id: `violation-${uid}-${timestamp}`,
                    type: 'violation',
                    message: `${studentName} recorded ${exam.violationsAtSubmit} violation(s) in ${subjectName}`,
                    timestamp,
                    time: formatTimeAgo(timestamp),
                    status: 'Warning'
                  });
                }
              });
            });
          }

          studentsArray.push({
            uid,
            name: studentName,
            email: user.email || 'No email provided',
            profilePic,
            avgScore: s_examsTaken > 0 ? Math.round(s_totalScore / s_examsTaken) : 0,
            examsTaken: s_examsTaken
          });
        });

        setTotalStudents(studentCount);
        setTotalViolations(violationsCount);
        setAvgPassingRate(totalExamsTaken > 0 ? (totalScorePercentages / totalExamsTaken).toFixed(1) : 0);

        const formattedPerformance = Object.keys(subjectAverages).map(subject => ({
          subject: subject.length > 12 ? subject.substring(0, 12) + '...' : subject,
          score: Math.round(subjectAverages[subject].totalPercentage / subjectAverages[subject].count)
        }));
        setPerformanceData(formattedPerformance);

        const formattedEngagement = Object.values(examsPerDay)
          .sort((a, b) => a.dateObj - b.dateObj)
          .map(day => ({ name: day.name, exams: day.exams }));
        setEngagementData(formattedEngagement);

        alerts.sort((a, b) => b.timestamp - a.timestamp);
        setRecentAlerts(alerts.slice(0, 50)); // keep more for modal use

        studentsArray.sort((a, b) => b.avgScore - a.avgScore);
        setStudentInsights(studentsArray);
      }
      setLoading(false);
    });

    return () => { unsubSchedules(); unsubUsers(); };
  }, []);

  const filteredStudents = studentInsights.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-gray-200 border-t-[#800000]"></div>
      </div>
    );
  }

  return (
    <>
      {/* Student Detail Modal */}
      {selectedStudent && (
        <StudentModal
          student={selectedStudent}
          alerts={recentAlerts}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      <div className="space-y-6 pb-10">
        {/* Hero Welcome */}
        <div className="rounded-2xl bg-[#800000] p-6 text-white shadow-md">
          <h2 className="text-2xl font-bold mb-1">Welcome back, {fullName}</h2>
          <p className="text-[#ffcccc] text-sm">Here is a real-time summary of your students' performance and recent activities.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">Total Students</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900">{totalStudents}</div>
            <p className="mt-1 text-[10px] text-gray-400 font-medium">Registered examinees</p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">Avg. Passing Rate</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900">{avgPassingRate}%</div>
            <p className="mt-1 text-[10px] text-gray-400 font-medium">Across all completed exams</p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">Active Exams</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900">{activeExamsCount}</div>
            <p className="mt-1 text-[10px] text-gray-400 font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" /> Scheduled or running
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">Total Violations</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900">{totalViolations}</div>
            <p className="mt-1 text-[10px] text-red-500 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Recorded warnings
            </p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-gray-900">Average Performance by Subject</h3>
            <div className="h-64 w-full">
              {performanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData} margin={{ top: 5, right: 10, bottom: 35, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="subject" axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: '#6b7280' }} interval={0} angle={-35} textAnchor="end" />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <RechartsTooltip cursor={{ fill: '#f3f4f6' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                    <Bar dataKey="score" fill="#800000" radius={[4, 4, 0, 0]} barSize={28} name="Average Score %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">No exam data available yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-gray-900">Exams Taken (Last 7 Days)</h3>
            <div className="h-64 w-full">
              {engagementData.some(d => d.exams > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={engagementData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                    <defs>
                      <linearGradient id="colorExams" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#800000" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#800000" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="exams" name="Total Exams" stroke="#800000"
                      strokeWidth={3} fillOpacity={1} fill="url(#colorExams)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">No activity in the last 7 days.</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Student Performance Insights (bottom) ── */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {/* Header + Search */}
          <div className="border-b border-gray-100 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-white">
            <h3 className="text-sm font-bold text-gray-900 shrink-0">Student Performance Insights</h3>
            <div className="relative sm:ml-auto w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#800000]/30 focus:border-[#800000]/50 transition"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-xs uppercase tracking-wider text-gray-500 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-5 py-3 font-semibold">Student Profile</th>
                  <th className="px-5 py-3 font-semibold text-center">Exams Completed</th>
                  <th className="px-5 py-3 font-semibold text-center">Average Score</th>
                  <th className="px-5 py-3 font-semibold text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map(student => (
                    <tr key={student.uid} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 flex items-center gap-3">
                        {student.profilePic ? (
                          <img src={student.profilePic} alt={student.name}
                            className="h-9 w-9 rounded-full object-cover border border-gray-200 shadow-sm" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 shadow-sm">
                            <User className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-gray-900 text-xs">{student.name}</p>
                          <p className="text-[10px] text-gray-500">{student.email}</p>
                        </div>
                      </td>

                      <td className="px-5 py-3 text-center font-bold text-gray-700">{student.examsTaken}</td>

                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-black ${
                          student.avgScore >= 75 ? 'bg-green-100 text-green-700 border border-green-200' :
                          student.avgScore > 0  ? 'bg-red-100 text-red-700 border border-red-200' :
                          'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}>
                          {student.avgScore}%
                        </span>
                      </td>

                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#800000]/8 hover:bg-[#800000]/15 text-[#800000] text-[11px] font-semibold px-3 py-1.5 transition-colors"
                        >
                          View <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-5 py-8 text-center text-sm text-gray-400">
                      {searchQuery ? 'No students match your search.' : 'No students registered yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default RealEduDash;