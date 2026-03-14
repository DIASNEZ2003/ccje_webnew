import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from './Firebase';
import QuizEngine from './QuizEngine';
import {
  Shield, ChevronRight, Lock, Loader2, Shuffle, Target,
  CalendarX, Calendar, Clock, AlertTriangle, CheckCircle,
  CheckSquare, BookOpen
} from 'lucide-react';

const SET_ORDER = ['Set A', 'Set B', 'Set C'];

const Areas = ({ userUID, onExamStart, onExamEnd }) => {
  const [examData,        setExamData]        = useState({});
  const [shuffledAreas,   setShuffledAreas]   = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [activeQuiz,      setActiveQuiz]      = useState(null);
  const [completedSets,   setCompletedSets]   = useState({}); // { [subjectKey]: ['Set_A', 'Set_B', ...] }

  // Enrollment
  const [enrollmentStatus,      setEnrollmentStatus]      = useState('checking');
  const [enrolledSchedule,      setEnrolledSchedule]      = useState(null);
  const [showNotEnrolledModal,  setShowNotEnrolledModal]  = useState(false);

  const diagnosticAreas = [
    { label: "Criminal Jurisprudence", node: "Criminal_Jurisprudence" },
    { label: "Law Enforcement",        node: "Law_Enforcement"        },
    { label: "Crime Detection",        node: "Crime_Detection"        },
    { label: "Criminalistics",         node: "Criminalistics"         },
    { label: "Sociology of Crimes",    node: "Sociology_of_Crimes"    },
    { label: "Correctional Admin",     node: "Correctional_Admin"     },
  ];

  const seededShuffle = (array, seed) => {
    if (!seed) return array;
    let s = 0;
    for (let i = 0; i < seed.length; i++) { s = ((s << 5) - s) + seed.charCodeAt(i); s |= 0; }
    const arr = [...array];
    const rng = () => { const x = Math.sin(s++) * 10000; return x - Math.floor(x); };
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const d = new Date(); d.setHours(h, m);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ── 1. Enrollment check ──
  useEffect(() => {
    if (!userUID) return;
    const unsub = onValue(ref(db, 'exam_schedules'), (snap) => {
      if (!snap.exists()) { setEnrollmentStatus('not_enrolled'); return; }
      const now = new Date();
      let found = null;
      Object.entries(snap.val()).forEach(([key, s]) => {
        if (s.status === 'completed') return;
        if (now > new Date(`${s.date}T${s.endTime || s.time}`)) return;
        if (s.enrolledStudents?.[userUID]) found = { id: key, ...s };
      });
      setEnrolledSchedule(found);
      setEnrollmentStatus(found ? 'enrolled' : 'not_enrolled');
    });
    return () => unsub();
  }, [userUID]);

  // ── 2. Load questions ──
  useEffect(() => {
    setShuffledAreas(userUID ? seededShuffle(diagnosticAreas, userUID) : diagnosticAreas);

    const unsubscribes = diagnosticAreas.map(area => {
      return onValue(ref(db, `exams/${area.node}`), (snap) => {
        const data = snap.val() || {};
        const areaSets = {};
        SET_ORDER.forEach(setName => {
          if (data[setName]) {
            const qs = Array.isArray(data[setName])
              ? data[setName].filter(q => q !== null)
              : Object.values(data[setName]).filter(q => q !== null);
            if (qs.length > 0) areaSets[setName] = qs;
          }
        });
        setExamData(prev => ({ ...prev, [area.node]: areaSets }));
      });
    });

    const timer = setTimeout(() => setLoading(false), 800);
    return () => { unsubscribes.forEach(u => u()); clearTimeout(timer); };
  }, [userUID]);

  // ── 3. Load completed sets from Firebase (users/{uid}/live_exams/final_quiz) ──
  useEffect(() => {
    if (!userUID) return;
    const unsub = onValue(ref(db, `users/${userUID}/live_exams/final_quiz`), (snap) => {
      if (!snap.exists()) { setCompletedSets({}); return; }
      // Structure: { Criminal_Jurisprudence: { Set_A: {...}, Set_B: {...} }, ... }
      const data = snap.val();
      const result = {};
      Object.entries(data).forEach(([subjectKey, sets]) => {
        result[subjectKey] = Object.keys(sets); // e.g. ['Set_A', 'Set_B']
      });
      setCompletedSets(result);
    });
    return () => unsub();
  }, [userUID]);

  // ── Get the next set a student should take for an area ──
  // Returns { setName, questions } or null if all sets done / no sets available
  const getNextSet = (areaNode, areaLabel) => {
    const areaData    = examData[areaNode] || {};
    const subjectKey  = areaLabel.replace(/[.$#[\]/]/g, '_').replace(/\s+/g, '_');
    const doneSets    = completedSets[subjectKey] || []; // e.g. ['Set_A']

    for (const setName of SET_ORDER) {
      const setKey = setName.replace(/\s+/g, '_'); // 'Set A' → 'Set_A'
      if (!areaData[setName]) continue;            // set doesn't exist in Firebase
      if (doneSets.includes(setKey)) continue;     // already completed
      return { setName, questions: areaData[setName] };
    }
    return null; // all available sets completed
  };

  // ── Get status label for card badge ──
  const getAreaProgress = (areaNode, areaLabel) => {
    const areaData   = examData[areaNode] || {};
    const subjectKey = areaLabel.replace(/[.$#[\]/]/g, '_').replace(/\s+/g, '_');
    const doneSets   = completedSets[subjectKey] || [];
    const totalSets  = SET_ORDER.filter(s => areaData[s]).length;
    const doneCnt    = doneSets.filter(dk => SET_ORDER.some(s => s.replace(/\s+/g, '_') === dk)).length;
    return { doneCnt, totalSets };
  };

  const handleStartExam = (areaNode, areaLabel) => {
    if (enrollmentStatus === 'not_enrolled') { setShowNotEnrolledModal(true); return; }

    const next = getNextSet(areaNode, areaLabel);
    if (!next) return; // all done — button should be hidden anyway

    setActiveQuiz({
      areaNode,
      areaLabel,
      title:      `${areaLabel} — ${next.setName}`,
      subject:    areaLabel,
      setName:    next.setName,
      questions:  next.questions,
      scheduleId: enrolledSchedule?.id || null,
    });
    if (onExamStart) onExamStart();
  };

  // Called by QuizEngine when student finishes/submits
  // Automatically advance to next set or return to areas list
  const handleQuizDone = (areaNode, areaLabel, completedSetName) => {
    // Figure out what comes next
    const areaData   = examData[areaNode] || {};
    const subjectKey = areaLabel.replace(/[.$#[\]/]/g, '_').replace(/\s+/g, '_');
    // The set the student just finished is now saved in Firebase so completedSets
    // will update via the listener. We compute next manually right now:
    const justDoneKey = completedSetName.replace(/\s+/g, '_');
    const currentDone = [...(completedSets[subjectKey] || []), justDoneKey];

    let nextSet = null;
    for (const setName of SET_ORDER) {
      const setKey = setName.replace(/\s+/g, '_');
      if (!areaData[setName]) continue;
      if (currentDone.includes(setKey)) continue;
      nextSet = { setName, questions: areaData[setName] };
      break;
    }

    if (nextSet) {
      // Auto-advance to next set
      setActiveQuiz({
        areaNode,
        areaLabel,
        title:      `${areaLabel} — ${nextSet.setName}`,
        subject:    areaLabel,
        setName:    nextSet.setName,
        questions:  nextSet.questions,
        scheduleId: enrolledSchedule?.id || null,
      });
      // Keep sidebar locked — still in exam
    } else {
      // All sets done for this area — go back to areas list
      setActiveQuiz(null);
      if (onExamEnd) onExamEnd();
    }
  };

  // Back to areas without finishing (e.g. anti-cheat force-submit already saved)
  const handleQuizClose = () => {
    setActiveQuiz(null);
    if (onExamEnd) onExamEnd();
  };

  // ── RENDER: Active quiz ──
  if (activeQuiz) {
    return (
      <QuizEngine
        questions={activeQuiz.questions}
        quizTitle={activeQuiz.title}
        subject={activeQuiz.subject}
        setName={activeQuiz.setName}
        userId={userUID}
        scheduleId={activeQuiz.scheduleId}
        onSetComplete={(completedSetName) =>
          handleQuizDone(activeQuiz.areaNode, activeQuiz.areaLabel, completedSetName)
        }
        onClose={handleQuizClose}
      />
    );
  }

  // ── RENDER: Areas list ──
  return (
    <div className="max-w-5xl mx-auto font-['Inter',sans-serif] space-y-4 pb-12 animate-in fade-in duration-500">

      {/* Enrollment banner */}
      {enrollmentStatus === 'enrolled' && enrolledSchedule && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-black text-emerald-700 uppercase tracking-widest">Enrolled & Cleared to Take Exam</p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-2">
              <Calendar className="w-3 h-3" /> {enrolledSchedule.date}
              <Clock className="w-3 h-3 ml-1" /> {formatTime(enrolledSchedule.time)} – {formatTime(enrolledSchedule.endTime)}
            </p>
          </div>
        </div>
      )}

      {enrollmentStatus === 'not_enrolled' && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <div>
            <p className="text-xs font-black text-red-700 uppercase tracking-widest">Not Enrolled in Any Active Schedule</p>
            <p className="text-[10px] text-red-500 font-medium mt-0.5">You must be enrolled by an instructor before you can take the exam.</p>
          </div>
        </div>
      )}

     

      {/* Area cards */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center">
            <Target className="w-4 h-4 mr-2 text-[#800000]" />
            <h3 className="text-sm font-bold text-gray-800">Diagnostic Assessments</h3>
          </div>
          <span className="text-[10px] font-black bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded uppercase tracking-wider">
            {shuffledAreas.length} Areas
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-[#800000] w-6 h-6" />
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shuffledAreas.map((area) => {
              const areaData    = examData[area.node] || {};
              const isAvailable = Object.keys(areaData).length > 0;
              const isBlocked   = enrollmentStatus === 'not_enrolled';
              const next        = !isBlocked && isAvailable ? getNextSet(area.node, area.label) : null;
              const { doneCnt, totalSets } = getAreaProgress(area.node, area.label);
              const allDone     = isAvailable && doneCnt >= totalSets && totalSets > 0;

              return (
                <div
                  key={area.node}
                  className={`bg-white border rounded-xl p-4 flex flex-col group relative overflow-hidden transition-all duration-300 ${
                    allDone     ? 'border-emerald-200 bg-emerald-50/30' :
                    isBlocked   ? 'border-gray-100 bg-gray-50/30 opacity-70' :
                    isAvailable ? 'border-gray-200 hover:border-[#800000]/40 shadow-sm' :
                                  'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  {isAvailable && !isBlocked && !allDone && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#800000] opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                  {allDone && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                  )}

                  {/* Top row */}
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                      allDone     ? 'bg-emerald-100 border-emerald-200' :
                      isBlocked   ? 'bg-gray-100 border-gray-200' :
                      isAvailable ? 'bg-[#f4e8e8] border-[#e2c7c7]' :
                                    'bg-gray-100 border-gray-200'
                    }`}>
                      {allDone
                        ? <CheckSquare className="w-4 h-4 text-emerald-600" />
                        : <Shield className={`w-4 h-4 ${isBlocked ? 'text-gray-300' : isAvailable ? 'text-[#800000]' : 'text-gray-300'}`} />
                      }
                    </div>

                    {/* Badge */}
                    {isBlocked ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 border border-gray-200 px-2 py-1 rounded">
                        Not Enrolled
                      </span>
                    ) : allDone ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5" /> Completed
                      </span>
                    ) : isAvailable && next ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#800000] bg-white border border-[#e2c7c7] px-2 py-1 rounded shadow-sm">
                        {next.setName}
                      </span>
                    ) : isAvailable && !next ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                        All Sets Done
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 border border-gray-200 px-2 py-1 rounded">
                        Pending
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className={`text-sm font-bold mb-1 leading-tight ${isBlocked || !isAvailable ? 'text-gray-400' : allDone ? 'text-emerald-700' : 'text-gray-900'}`}>
                    {area.label}
                  </h3>

                  {/* Progress dots — one per set */}
                  {isAvailable && !isBlocked && (
                    <div className="flex items-center gap-1.5 mb-3">
                      {SET_ORDER.filter(s => areaData[s]).map((setName) => {
                        const setKey  = setName.replace(/\s+/g, '_');
                        const subKey  = area.label.replace(/[.$#[\]/]/g, '_').replace(/\s+/g, '_');
                        const isDone  = (completedSets[subKey] || []).includes(setKey);
                        const isCurr  = next?.setName === setName;
                        return (
                          <div key={setName} className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full transition-all ${
                              isDone ? 'bg-emerald-500' : isCurr ? 'bg-[#800000]' : 'bg-gray-200'
                            }`} />
                            <span className={`text-[8px] font-black uppercase ${
                              isDone ? 'text-emerald-500' : isCurr ? 'text-[#800000]' : 'text-gray-300'
                            }`}>{setName}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-[10px] text-gray-500 font-medium mb-4 leading-relaxed line-clamp-2 min-h-[28px]">
                    {isBlocked     ? "Enrollment required. Contact your instructor." :
                     allDone       ? "You have completed all available sets for this area." :
                     isAvailable   ? `Next up: ${next?.setName || ''}. Answer all questions to proceed.` :
                                     "Awaiting educator upload for this module."}
                  </p>

                  {/* Action button */}
                  <div className="mt-auto pt-3 border-t border-gray-100 min-h-[44px]">
                    {isBlocked ? (
                      <button
                        onClick={() => setShowNotEnrolledModal(true)}
                        className="w-full bg-gray-200 text-gray-500 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-not-allowed"
                      >
                        <Lock className="w-3 h-3" /> Enrollment Required
                      </button>
                    ) : allDone ? (
                      <div className="w-full bg-emerald-50 border border-emerald-200 py-2.5 rounded-lg flex items-center justify-center gap-1.5">
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-600 font-bold text-[10px] uppercase tracking-widest">All Sets Completed</span>
                      </div>
                    ) : !isAvailable ? (
                      <div className="w-full bg-transparent py-2 rounded-lg flex items-center justify-center">
                        <Lock className="text-gray-300 mr-1.5 w-3 h-3" />
                        <span className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Locked</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartExam(area.node, area.label)}
                        className="w-full bg-[#800000] text-white py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center hover:bg-[#6a0000] shadow-sm active:scale-[0.98]"
                      >
                        <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                        {doneCnt === 0 ? 'Start Assessment' : `Continue — ${next?.setName}`}
                        <ChevronRight className="ml-1.5 w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Not Enrolled Modal */}
      {showNotEnrolledModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border-2 border-red-200 animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <CalendarX className="w-6 h-6 text-white shrink-0" />
              <div>
                <h2 className="text-white font-black text-sm uppercase tracking-widest">Enrollment Required</h2>
                <p className="text-white/80 text-xs font-medium mt-0.5">You are not cleared to take this exam</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 font-medium leading-relaxed">
                  You must be enrolled in an active exam schedule by your instructor before you can access the assessment.
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-1.5">
                <p className="font-black text-gray-700 uppercase tracking-widest text-[10px] mb-2">What to do:</p>
                <p>1. Contact your instructor or exam coordinator.</p>
                <p>2. Ask to be enrolled in an active exam schedule.</p>
                <p>3. Return here once you have been enrolled.</p>
              </div>
              <button
                onClick={() => setShowNotEnrolledModal(false)}
                className="w-full py-3 bg-[#800000] text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-[#6a0000] transition-all active:scale-[0.98]"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Areas;