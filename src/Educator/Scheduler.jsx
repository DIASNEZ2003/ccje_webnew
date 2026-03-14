import React, { useState, useEffect } from 'react';
import { Calendar, Users, Clock, Save, Trash2, Edit2, X, AlertCircle, Eye, User, CheckCircle, RefreshCcw, CheckSquare, Clock3, ChevronRight, ShieldAlert, AlertTriangle } from 'lucide-react';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { db } from '../Firebase'; // <-- Make sure this path is correct for your project

// ═════════ CUSTOM CLOCK PICKER MODAL (CONDENSED) ═════════
const CustomTimePicker = ({ initialTime, onSave, onClose, title }) => {
  const [mode, setMode] = useState('hours'); 
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState('AM');

  useEffect(() => {
    if (initialTime) {
      const [hStr, mStr] = initialTime.split(':');
      let h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (h >= 12) {
        setPeriod('PM');
        if (h > 12) h -= 12;
      } else {
        setPeriod('AM');
        if (h === 0) h = 12;
      }
      setHour(h);
      setMinute(m);
    }
  }, [initialTime]);

  const handleHourSelect = (h) => {
    setHour(h);
    setMode('minutes'); 
  };

  const handleMinuteSelect = (m) => {
    setMinute(m);
  };

  const handleSave = () => {
    let finalHour = hour;
    if (period === 'PM' && finalHour < 12) finalHour += 12;
    if (period === 'AM' && finalHour === 12) finalHour = 0;
    
    const formattedHour = finalHour.toString().padStart(2, '0');
    const formattedMinute = minute.toString().padStart(2, '0');
    onSave(`${formattedHour}:${formattedMinute}`);
  };

  const getCoordinates = (index, total) => {
    const radius = 75; 
    const angle = (index * (360 / total) - 90) * (Math.PI / 180);
    return {
      x: 100 + radius * Math.cos(angle),
      y: 100 + radius * Math.sin(angle)
    };
  };

  const currentItems = mode === 'hours' 
    ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] 
    : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const activeValue = mode === 'hours' ? hour : minute;
  const activeIndex = mode === 'hours' ? currentItems.indexOf(hour) : currentItems.indexOf(minute);
  const lineCoords = activeIndex !== -1 ? getCoordinates(activeIndex, 12) : { x: 100, y: 100 - 75 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[260px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#f4e8e8] p-4 flex flex-col items-center">
          <span className="text-[9px] font-bold text-[#800000] uppercase tracking-widest mb-3 w-full text-left">{title}</span>
          <div className="flex items-center gap-2">
            <div className="flex items-baseline text-4xl font-light text-[#800000]">
              <button 
                onClick={() => setMode('hours')}
                className={`p-1.5 rounded-lg transition-colors ${mode === 'hours' ? 'bg-[#e2c7c7] font-medium' : 'hover:bg-white/50 opacity-60'}`}
              >
                {hour.toString().padStart(2, '0')}
              </button>
              <span className="opacity-60 mx-0.5">:</span>
              <button 
                onClick={() => setMode('minutes')}
                className={`p-1.5 rounded-lg transition-colors ${mode === 'minutes' ? 'bg-[#e2c7c7] font-medium' : 'hover:bg-white/50 opacity-60'}`}
              >
                {minute.toString().padStart(2, '0')}
              </button>
            </div>
            
            <div className="flex flex-col ml-2 bg-white rounded-md overflow-hidden border border-[#e2c7c7]">
              <button 
                onClick={() => setPeriod('AM')}
                className={`px-2 py-1 text-[10px] font-bold transition-colors ${period === 'AM' ? 'bg-[#800000] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                AM
              </button>
              <button 
                onClick={() => setPeriod('PM')}
                className={`px-2 py-1 text-[10px] font-bold border-t border-[#e2c7c7] transition-colors ${period === 'PM' ? 'bg-[#800000] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                PM
              </button>
            </div>
          </div>
        </div>

        {/* Analog Clock Face */}
        <div className="p-5 flex justify-center bg-white relative">
          <div className="w-[200px] h-[200px] bg-gray-100 rounded-full relative">
            <div className="absolute w-1.5 h-1.5 bg-[#800000] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"></div>
            {activeIndex !== -1 && (
              <svg className="absolute inset-0 pointer-events-none w-full h-full">
                <line x1="100" y1="100" x2={lineCoords.x} y2={lineCoords.y} stroke="#800000" strokeWidth="1.5" />
              </svg>
            )}
            {currentItems.map((val, i) => {
              const coords = getCoordinates(i, 12);
              const isActive = activeValue === val;
              return (
                <button
                  key={val}
                  onClick={() => mode === 'hours' ? handleHourSelect(val) : handleMinuteSelect(val)}
                  className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-xs transition-colors z-20 ${
                    isActive ? 'bg-[#800000] text-white font-bold shadow-md' : 'text-gray-700 hover:bg-gray-200'
                  }`}
                  style={{ left: coords.x, top: coords.y }}
                >
                  {val === 0 ? '00' : val}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 flex justify-end gap-1 bg-white border-t border-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-md transition-colors">
            CANCEL
          </button>
          <button onClick={handleSave} className="px-3 py-1.5 text-xs font-bold text-[#800000] hover:bg-[#f4e8e8] rounded-md transition-colors">
            OK
          </button>
        </div>

      </div>
    </div>
  );
};

// ═════════ MAIN SCHEDULER COMPONENT ═════════
const Scheduler = () => {
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState(''); 
  const [examEndTime, setExamEndTime] = useState(''); 
  const [studentCapacity, setStudentCapacity] = useState('');
  
  const [scheduledExams, setScheduledExams] = useState([]);
  const [usersMap, setUsersMap] = useState({}); 
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('active');
  const [viewingStudents, setViewingStudents] = useState(null);
  const [activePicker, setActivePicker] = useState(null); 

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(h, m);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    const usersRef = ref(db, 'users');
    const unsubUsers = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) setUsersMap(snapshot.val());
    });

    const schedulesRef = ref(db, 'exam_schedules');
    const unsubSchedules = onValue(schedulesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const formattedData = Object.keys(data).map(key => {
          const schedule = data[key];
          const studentsList = [];
          if (schedule.enrolledStudents) {
            Object.entries(schedule.enrolledStudents).forEach(([uid, student]) => {
              studentsList.push({ uid, ...student });
            });
          }

          const now = new Date();
          const endDateTimeStr = `${schedule.date}T${schedule.endTime || schedule.time}`;
          const endDateTime = new Date(endDateTimeStr);
          
          const isAutoCompleted = now > endDateTime;
          const isManuallyCompleted = schedule.status === 'completed';

          return {
            id: key,
            ...schedule,
            status: schedule.status || 'active',
            isCompleted: isAutoCompleted || isManuallyCompleted,
            studentsList, 
            enrolled: studentsList.length || schedule.enrolled || 0 
          };
        });
        
        formattedData.sort((a, b) => new Date(a.date) - new Date(b.date));
        setScheduledExams(formattedData);

        // Update viewingStudents live if modal is open
        setViewingStudents(prev => {
          if (prev) {
            return formattedData.find(e => e.id === prev.id) || null;
          }
          return prev;
        });

      } else {
        setScheduledExams([]); 
      }
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubSchedules();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!examDate || !examTime || !examEndTime || !studentCapacity) {
      alert("Please fill in all fields including Start and End times.");
      return;
    }

    const start = new Date(`${examDate}T${examTime}`);
    const end = new Date(`${examDate}T${examEndTime}`);
    if (end <= start) {
      alert("End Time must be later than Start Time.");
      return;
    }

    const scheduleData = {
      date: examDate,
      time: examTime,
      endTime: examEndTime,
      capacity: parseInt(studentCapacity),
      updatedAt: Date.now()
    };

    try {
      if (editingId) {
        const examRef = ref(db, `exam_schedules/${editingId}`);
        await update(examRef, scheduleData);
        setEditingId(null); 
      } else {
        scheduleData.createdAt = Date.now();
        scheduleData.enrolled = 0; 
        scheduleData.status = 'active'; 
        
        const newExamRef = push(ref(db, 'exam_schedules'));
        await set(newExamRef, scheduleData);
      }

      setExamDate('');
      setExamTime('');
      setExamEndTime('');
      setStudentCapacity('');
    } catch (error) {
      console.error("Error saving schedule:", error);
      alert("Failed to save schedule. Check your connection.");
    }
  };

  const handleEdit = (exam) => {
    setEditingId(exam.id);
    setExamDate(exam.date);
    setExamTime(exam.time);
    setExamEndTime(exam.endTime || ''); 
    setStudentCapacity(exam.capacity.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setExamDate('');
    setExamTime('');
    setExamEndTime('');
    setStudentCapacity('');
  };

  const toggleScheduleStatus = async (id, isCompleted) => {
    const newStatus = isCompleted ? 'active' : 'completed';
    const confirmMessage = isCompleted 
      ? "Force re-enable this schedule?" 
      : "Manually close this schedule before the time is up?";
      
    if (window.confirm(confirmMessage)) {
      try {
        const examRef = ref(db, `exam_schedules/${id}`);
        await update(examRef, { status: newStatus });
      } catch (error) {
        console.error("Error updating schedule status:", error);
        alert("Failed to update status.");
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this schedule?")) {
      try {
        const examRef = ref(db, `exam_schedules/${id}`);
        await remove(examRef);
      } catch (error) {
        console.error("Error deleting schedule:", error);
        alert("Failed to delete schedule.");
      }
    }
  };

  // ═════════ RETAKE QUIZ (Clear Violations & Score) ═════════
  const handleRetakeQuiz = async (scheduleId, student) => {
    if (!window.confirm(`Are you sure you want to let ${student.name || 'this student'} retake the quiz?\n\nThis will permanently delete their anti-cheat violations and current score for this attempt.`)) {
      return;
    }

    try {
      // 1. Wipe the schedule data for this student so they appear fresh
      const scheduleStudentRef = ref(db, `exam_schedules/${scheduleId}/enrolledStudents/${student.uid}`);
      await update(scheduleStudentRef, {
        score: null,
        total: null,
        percentage: null,
        submittedAt: null,
        autoSubmitted: null,
        violationCount: null,
        lastViolationType: null,
        lastSubject: null,
        lastSet: null
      });

      // 2. Safely format and delete the actual exam result node based on lastSubject and lastSet
      if (student.lastSubject && student.lastSet) {
        const subjectKey = String(student.lastSubject).replace(/[.$#[\]/]/g, '_').replace(/\s+/g, '_');
        const setKey = String(student.lastSet).replace(/[.$#[\]/]/g, '_').replace(/\s+/g, '_');
        
        const finalQuizRef = ref(db, `users/${student.uid}/live_exams/final_quiz/${subjectKey}/${setKey}`);
        await remove(finalQuizRef);
      }

      // 3. ✨ NEW: Delete any violations logged in the main user profile node
      const userRootRef = ref(db, `users/${student.uid}`);
      await update(userRootRef, {
        violationCount: null,
        lastViolationType: null,
        autoSubmitted: null
      });

    } catch (error) {
      console.error("Error resetting student quiz:", error);
      alert("Failed to reset student. Check console for details.");
    }
  };

  const activeExams = scheduledExams.filter(exam => !exam.isCompleted);
  const completedExams = scheduledExams.filter(exam => exam.isCompleted);
  const displayExams = activeTab === 'active' ? activeExams : completedExams;

  return (
    <div className="max-w-5xl mx-auto space-y-4 relative font-['Inter',sans-serif]">
      
      {/* ═════════ CLOCK MODALS ═════════ */}
      {activePicker === 'start' && (
        <CustomTimePicker title="Select Start Time" initialTime={examTime} onSave={(t) => { setExamTime(t); setActivePicker(null); }} onClose={() => setActivePicker(null)} />
      )}
      {activePicker === 'end' && (
        <CustomTimePicker title="Select End Time" initialTime={examEndTime} onSave={(t) => { setExamEndTime(t); setActivePicker(null); }} onClose={() => setActivePicker(null)} />
      )}

      {/* ═════════ FORM SECTION (COMPACT) ═════════ */}
      <div className={`bg-white rounded-xl shadow-sm border p-5 transition-all duration-300 ${editingId ? 'border-[#800000] ring-2 ring-[#f4e8e8]' : 'border-gray-100'}`}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg mr-3 flex items-center justify-center ${editingId ? 'bg-orange-50 text-orange-600' : 'bg-[#f4e8e8] text-[#800000]'}`}>
              {editingId ? <Edit2 className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
            </div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">
              {editingId ? 'Edit Schedule' : 'Create Schedule'}
            </h3>
          </div>
          
          {editingId && (
            <span className="bg-orange-50 text-orange-700 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center border border-orange-100 shadow-sm">
              <AlertCircle className="w-3 h-3 mr-1" /> Edit Mode
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col col-span-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 pl-0.5">Date</label>
            <div className="relative group">
              <input
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#f4e8e8] focus:border-[#800000] outline-none transition-all text-xs font-bold text-gray-700 cursor-pointer"
              />
              <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 group-hover:text-[#800000] transition-colors" />
            </div>
          </div>

          <div className="flex flex-col col-span-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 pl-0.5">Capacity</label>
            <div className="relative group">
              <input
                type="number"
                min="1"
                required
                placeholder="e.g. 50"
                value={studentCapacity}
                onChange={(e) => setStudentCapacity(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#f4e8e8] focus:border-[#800000] outline-none transition-all text-xs font-bold text-gray-700"
              />
              <Users className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 group-hover:text-[#800000] transition-colors" />
            </div>
          </div>

          <div className="flex flex-col col-span-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 pl-0.5">Start Time</label>
            <div onClick={() => setActivePicker('start')} className="relative group cursor-pointer">
              <div className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg transition-all text-xs font-bold text-gray-700 group-hover:border-gray-300 flex items-center justify-between">
                <span>{examTime ? formatTime(examTime) : 'Select'}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              </div>
              <Clock className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 group-hover:text-[#800000] transition-colors" />
            </div>
          </div>

          <div className="flex flex-col col-span-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 pl-0.5">End Time</label>
            <div onClick={() => setActivePicker('end')} className="relative group cursor-pointer">
              <div className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg transition-all text-xs font-bold text-gray-700 group-hover:border-gray-300 flex items-center justify-between">
                <span>{examEndTime ? formatTime(examEndTime) : 'Select'}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              </div>
              <Clock3 className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 group-hover:text-[#800000] transition-colors" />
            </div>
          </div>

          <div className="md:col-span-4 flex justify-end gap-2 mt-2 pt-3 border-t border-gray-50">
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-3 h-3 mr-1.5" /> Cancel
              </button>
            )}
            <button
              type="submit"
              className="flex items-center px-5 py-2 bg-[#800000] text-white text-xs font-bold rounded-lg hover:bg-[#6a0000] transition-colors shadow-sm active:scale-95"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" /> {editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      {/* ═════════ LIST SECTION (COMPACT) ═════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* TABS */}
        <div className="flex flex-row gap-1.5 p-3 border-b border-gray-100 bg-gray-50/50">
          <button 
            onClick={() => setActiveTab('active')}
            className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'active' ? 'bg-white text-[#800000] shadow-sm ring-1 ring-gray-200' : 'text-slate-500 hover:bg-gray-100/50 hover:text-slate-900'
            }`}
          >
            <Calendar className={`w-3.5 h-3.5 mr-2 ${activeTab === 'active' ? 'text-[#800000]' : 'text-slate-400'}`} />
            Active
            <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-black ${activeTab === 'active' ? 'bg-[#f4e8e8] text-[#800000]' : 'bg-gray-200 text-gray-500'}`}>
              {activeExams.length}
            </span>
          </button>
          
          <button 
            onClick={() => setActiveTab('completed')}
            className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'completed' ? 'bg-white text-[#800000] shadow-sm ring-1 ring-gray-200' : 'text-slate-500 hover:bg-gray-100/50 hover:text-slate-900'
            }`}
          >
            <CheckSquare className={`w-3.5 h-3.5 mr-2 ${activeTab === 'completed' ? 'text-[#800000]' : 'text-slate-400'}`} />
            Completed
            <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-black ${activeTab === 'completed' ? 'bg-[#f4e8e8] text-[#800000]' : 'bg-gray-200 text-gray-500'}`}>
              {completedExams.length}
            </span>
          </button>
        </div>
        
        <div>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="w-8 h-8 border-4 border-[#f4e8e8] border-t-[#800000] rounded-full animate-spin"></div>
            </div>
          ) : displayExams.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200 m-4">
              {activeTab === 'active' ? <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-3" /> : <CheckSquare className="w-8 h-8 text-gray-300 mx-auto mb-3" />}
              <p className="text-sm text-gray-500 font-bold">No {activeTab} schedules found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-white">
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Date & Time</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Capacity</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Enrolled</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Status</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {displayExams.map((exam) => (
                    <tr key={exam.id} className={`transition-colors ${exam.isCompleted ? 'bg-gray-50/50' : 'hover:bg-[#f4e8e8]/30'}`}>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className={`text-xs font-black ${exam.isCompleted ? 'text-gray-500' : 'text-gray-900'}`}>{exam.date}</span>
                          <span className="text-[10px] text-slate-500 font-bold mt-1 flex items-center">
                            <Clock className="w-3 h-3 mr-1 opacity-70" />
                            {formatTime(exam.time)} - {exam.endTime ? formatTime(exam.endTime) : '?'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center ${exam.isCompleted ? 'opacity-50' : ''}`}>
                          <div className="bg-gray-100 p-1 rounded-md mr-2">
                            <Users className="w-3 h-3 text-gray-500" />
                          </div>
                          <span className={`text-xs font-black ${exam.isCompleted ? 'text-gray-500' : 'text-gray-900'}`}>{exam.capacity}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button 
                          onClick={() => setViewingStudents(exam)}
                          className={`flex items-center font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition-all ${
                            exam.isCompleted 
                              ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              : exam.enrolled >= exam.capacity 
                                ? 'bg-[#f4e8e8] text-[#800000] hover:bg-[#e2c7c7]' 
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          <Eye className="w-3 h-3 mr-1.5 opacity-80" />
                          {exam.enrolled} / {exam.capacity}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {exam.isCompleted ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-[9px] uppercase tracking-wider font-black bg-gray-100 text-gray-500 border border-gray-200">
                            {exam.status === 'completed' ? 'Force Closed' : 'Finished'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-[9px] uppercase tracking-wider font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right flex justify-end gap-1.5">
                        {!exam.isCompleted ? (
                          <>
                            <button onClick={() => toggleScheduleStatus(exam.id, exam.isCompleted)} className="p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors border border-gray-100 shadow-sm" title="Force Complete">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleEdit(exam)} className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors border border-gray-100 shadow-sm" title="Edit">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(exam.id)} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors border border-gray-100 shadow-sm" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => toggleScheduleStatus(exam.id, exam.isCompleted)} className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors border border-gray-100 shadow-sm" title="Re-Enable">
                              <RefreshCcw className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(exam.id)} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors border border-gray-100 shadow-sm" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ═════════ VIEW STUDENTS MODAL — with violation warnings ═════════ */}
      {viewingStudents && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden border border-gray-100">

            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/80">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center">
                  <div className="bg-[#e2c7c7] p-1.5 rounded-lg mr-2.5 shadow-sm">
                    <Users className="w-4 h-4 text-[#800000]" />
                  </div>
                  Enrolled Students
                </h3>
                <p className="text-[10px] text-slate-500 mt-1.5 font-bold flex items-center">
                  <Calendar className="w-3 h-3 mr-1 opacity-70" />
                  {viewingStudents.date} • {formatTime(viewingStudents.time)} to {formatTime(viewingStudents.endTime)}
                </p>
              </div>
              <button
                onClick={() => setViewingStudents(null)}
                className="p-2 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shadow-sm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Violation legend */}
            <div className="px-4 pt-3 pb-0 flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> Clean</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> 1–2 Warnings</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> 3+ / Auto-submitted</span>
            </div>

            {/* Student List */}
            <div className="p-4 overflow-y-auto flex-1 bg-white">
              <div className="space-y-2.5">
                {viewingStudents.studentsList && viewingStudents.studentsList.length > 0 ? (
                  viewingStudents.studentsList.map((student, idx) => {
                    const userProfile    = usersMap[student.uid] || {};
                    const profilePic     = userProfile.profileImage || userProfile.profilePicture;
                    const vCount         = student.violationCount || 0;
                    const wasAutoSubmit  = student.autoSubmitted || false;
                    const lastVType      = student.lastViolationType || null;
                    const hasScore       = student.score !== undefined && student.score !== null;

                    // Colour-code by violation severity
                    const violBg    = vCount === 0 ? 'bg-emerald-50 border-emerald-100'
                                    : vCount <= 2  ? 'bg-amber-50 border-amber-200'
                                    :                'bg-red-50 border-red-200';
                    const violDot   = vCount === 0 ? 'bg-emerald-400'
                                    : vCount <= 2  ? 'bg-amber-400'
                                    :                'bg-red-500';
                    const violText  = vCount === 0 ? 'text-emerald-600'
                                    : vCount <= 2  ? 'text-amber-600'
                                    :                'text-red-600';

                    return (
                      <div key={idx} className={`p-3 rounded-xl border transition-all shadow-sm ${violBg}`}>
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-[#f4e8e8] flex items-center justify-center text-[#800000] font-black flex-shrink-0 overflow-hidden ring-2 ring-white shadow-sm">
                            {profilePic ? (
                              <img src={profilePic} alt={student.name} className="w-full h-full object-cover" />
                            ) : student.name ? (
                              <span className="text-xs">{student.name.charAt(0).toUpperCase()}</span>
                            ) : (
                              <User className="w-3.5 h-3.5" />
                            )}
                          </div>

                          {/* Name + email */}
                          <div className="flex-1 overflow-hidden">
                            <p className="text-xs font-bold text-gray-900 truncate">{student.name || "Unknown Student"}</p>
                            <p className="text-[10px] text-slate-500 truncate font-medium">{student.email || "No email"}</p>
                          </div>

                          {/* Violation badge */}
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${violText}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${violDot}`}></span>
                            {vCount} / 3
                          </div>
                        </div>

                        {/* Violation detail row */}
                        {vCount > 0 && (
                          <div className={`mt-2 pt-2 border-t ${vCount >= 3 ? 'border-red-200' : 'border-amber-200'} flex flex-wrap items-center gap-2`}>
                            <ShieldAlert className={`w-3 h-3 shrink-0 ${vCount >= 3 ? 'text-red-500' : 'text-amber-500'}`} />
                            <span className={`text-[9px] font-black uppercase tracking-widest ${violText}`}>
                              {vCount >= 3 ? (wasAutoSubmit ? 'Auto-Submitted' : 'Max Violations') : `${vCount} Warning${vCount > 1 ? 's' : ''}`}
                            </span>
                            {lastVType && (
                              <span className="text-[9px] text-gray-500 font-medium">
                                Last: {lastVType}
                              </span>
                            )}
                            {wasAutoSubmit && (
                              <span className="ml-auto text-[9px] font-black text-red-600 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded">
                                Force-Submitted
                              </span>
                            )}
                          </div>
                        )}

                        {/* Combined Actions/Score row */}
                        {(hasScore || vCount > 0) && (
                          <div className="mt-2 pt-2 border-t border-gray-200/60 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {hasScore ? (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Score:</span>
                                  <span className={`text-[10px] font-black ${student.percentage >= 75 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {student.score}/{student.total} ({student.percentage}%)
                                  </span>
                                </>
                              ) : (
                                <span className="text-[9px] font-bold text-gray-400 italic">Not submitted yet</span>
                              )}
                            </div>
                            
                            {/* RETAKE BUTTON */}
                            <button
                              onClick={() => handleRetakeQuiz(viewingStudents.id, student)}
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 text-[#800000] rounded text-[9px] font-black uppercase tracking-widest hover:bg-[#f4e8e8] hover:border-[#800000] transition-colors shadow-sm active:scale-95"
                              title="Delete score & violations to allow retake"
                            >
                              <RefreshCcw className="w-3 h-3" /> Retake
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-gray-100 shadow-sm">
                      <User className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-xs font-bold text-gray-500">No students enrolled</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <div className="flex gap-4 pl-2">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Capacity</span>
                  <span className="text-xs font-bold text-[#800000]">{viewingStudents.studentsList?.length || 0} / {viewingStudents.capacity}</span>
                </div>
                {/* Count students with violations */}
                {(() => {
                  const withViolations = viewingStudents.studentsList?.filter(s => (s.violationCount || 0) > 0).length || 0;
                  return withViolations > 0 ? (
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Violations</span>
                      <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {withViolations} student{withViolations !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ) : null;
                })()}
              </div>
              <button
                onClick={() => setViewingStudents(null)}
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

export default Scheduler;