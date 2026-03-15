import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { Trophy, Target, TrendingUp, BookOpen, Eye, X, AlertTriangle } from 'lucide-react';

const ExamResults = ({ userUID }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!userUID) return;

    const db = getDatabase();
    // Point directly to the user's saved final quizzes to get ALL sets
    const userExamsRef = ref(db, `users/${userUID}/live_exams/final_quiz`);

    const unsubscribe = onValue(userExamsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const studentExams = [];

        // Loop through each Subject (e.g., Criminal_Jurisprudence)
        Object.keys(data).forEach((subjectKey) => {
          const sets = data[subjectKey];
          
          // Loop through each Set taken in that Subject (e.g., Set_A, Set_B)
          Object.keys(sets).forEach((setKey) => {
            const record = sets[setKey];
            
            const timestamp = record.timestamp || Date.now();
            const displayDate = new Date(timestamp).toLocaleDateString();
            const displayTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const subjectName = record.subject || subjectKey.replace(/_/g, ' ');
            const examSet = record.setName || setKey.replace(/_/g, ' ');

            studentExams.push({
              id: `${subjectKey}-${setKey}`,
              displayDate: displayDate,
              displayTime: displayTime,
              timestamp: timestamp,
              subject: subjectName,
              examSet: examSet,
              chartLabel: `${subjectName} (${examSet})`,
              score: record.score || 0,
              total: record.total || 0,
              percentage: record.percentage || 0,
              violations: record.violationsAtSubmit || 0,
              status: record.percentage >= 75 ? 'Passed' : 'Failed'
            });
          });
        });

        // Sort by date from oldest to newest for the graph
        studentExams.sort((a, b) => a.timestamp - b.timestamp);
        setResults(studentExams);
      } else {
        setResults([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userUID]);

  // Helper function to color code Set A, Set B, and Set C
  const getSetBadgeColor = (setName) => {
    if (!setName) return 'bg-gray-100 text-gray-600 border-gray-200';
    const upperSet = setName.toUpperCase();
    if (upperSet.includes('A')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (upperSet.includes('B')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (upperSet.includes('C')) return 'bg-orange-50 text-orange-700 border-orange-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  const openModal = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedRecord(null), 200);
  };

  // Calculate Summary Statistics
  const totalExams = results.length;
  const averageScore = totalExams > 0 
    ? Math.round(results.reduce((acc, curr) => acc + curr.percentage, 0) / totalExams) 
    : 0;
  const highestScore = totalExams > 0 
    ? Math.max(...results.map(r => r.percentage)) 
    : 0;

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-3 border-gray-200 border-t-[#800000]"></div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white shadow-sm">
        <BookOpen className="mb-3 h-8 w-8 text-gray-300" />
        <h3 className="text-base font-bold text-gray-900">No Exam Records Found</h3>
        <p className="text-xs text-gray-500">Take your first live exam to see your progress here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Total Exams</p>
            <p className="text-xl font-bold text-gray-900">{totalExams}</p>
          </div>
        </div>

        <div className="flex items-center rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Average Score</p>
            <p className="text-xl font-bold text-gray-900">{averageScore}%</p>
          </div>
        </div>

        <div className="flex items-center rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#800000]/10 text-[#800000]">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Highest Score</p>
            <p className="text-xl font-bold text-gray-900">{highestScore}%</p>
          </div>
        </div>
      </div>

      {/* ── Charts Section ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Progress Line Chart */}
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <h3 className="mb-4 text-sm font-bold text-gray-900">Performance Over Time</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={results} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="displayDate" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="percentage" 
                  stroke="#800000" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#800000', strokeWidth: 1.5, stroke: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  name="Score %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Scores Bar Chart */}
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <h3 className="mb-4 text-sm font-bold text-gray-900">Recent Exam Scores</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={results.slice(-5)} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="chartLabel" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickFormatter={(value) => value && value.length > 12 ? `${value.substring(0, 12)}...` : value}
                />
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Bar 
                  dataKey="percentage" 
                  fill="#1f2937" 
                  radius={[4, 4, 0, 0]} 
                  name="Score %"
                  barSize={25}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── History Table ── */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-bold text-gray-900">Detailed Live Exam History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/50 uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Subject Area</th>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...results].reverse().map((record) => (
                <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{record.displayDate}</td>
                  
                  <td className="px-4 py-3 flex items-center gap-2">
                    {record.subject}
                    {record.examSet && (
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold border ${getSetBadgeColor(record.examSet)}`}>
                        {record.examSet}
                      </span>
                    )}
                  </td>
                  
                  <td className="px-4 py-3 font-medium">
                    {record.score} / {record.total} <span className="text-gray-400 font-normal">({record.percentage}%)</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${
                      record.percentage >= 75 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => openModal(record)}
                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-500 hover:bg-[#800000]/10 hover:text-[#800000] transition-colors"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          V I E W   D E T A I L S   M O D A L 
      ═══════════════════════════════════════════ */}
      {isModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity">
          <div className="relative w-full max-w-md scale-100 rounded-2xl bg-white shadow-2xl transition-transform">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-bold text-gray-900">Exam Record Details</h3>
              <button 
                onClick={closeModal}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-5 py-5 space-y-4">
              
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase text-gray-500">Subject</span>
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${getSetBadgeColor(selectedRecord.examSet)}`}>
                    {selectedRecord.examSet}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-900">{selectedRecord.subject}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3 border border-gray-100 shadow-sm text-center">
                  <p className="text-[10px] font-semibold uppercase text-gray-500 mb-1">Score</p>
                  <p className="text-xl font-black text-[#800000]">
                    {selectedRecord.score} <span className="text-sm text-gray-400 font-medium">/ {selectedRecord.total}</span>
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3 border border-gray-100 shadow-sm text-center">
                  <p className="text-[10px] font-semibold uppercase text-gray-500 mb-1">Percentage</p>
                  <p className={`text-xl font-black ${selectedRecord.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedRecord.percentage}%
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Date Submitted:</span>
                  <span className="font-medium text-gray-900">{selectedRecord.displayDate} at {selectedRecord.displayTime}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Final Status:</span>
                  <span className={`font-bold ${selectedRecord.status === 'Passed' ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedRecord.status}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50 items-center">
                  <span className="text-gray-500">Violations Recorded:</span>
                  {selectedRecord.violations > 0 ? (
                     <span className="flex items-center gap-1.5 font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 text-xs">
                       <AlertTriangle className="h-3 w-3" />
                       {selectedRecord.violations} Warning(s)
                     </span>
                  ) : (
                    <span className="font-medium text-green-600 text-xs bg-green-50 px-2 py-0.5 rounded border border-green-100">Clean Record</span>
                  )}
                </div>
              </div>

            </div>
            
            {/* Modal Footer */}
            <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 rounded-b-2xl">
              <button
                onClick={closeModal}
                className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default ExamResults;