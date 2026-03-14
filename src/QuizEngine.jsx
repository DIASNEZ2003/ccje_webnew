import React, { useState } from "react";
import { ref, update } from "firebase/database";
import useAntiCheat from './hooks/useAntiCheat';
import AntiCheatWarningModal from './AntiCheatWarningModal';
import { db } from "./Firebase";
import {
  CheckCircle, XCircle, Award,
  AlertCircle, RefreshCcw,
  BookOpen, ShieldAlert, ChevronRight,
  Lock
} from "lucide-react";

const QuizEngine = ({
  questions    = [],
  quizTitle    = "Practice Assessment",
  subject      = "General",
  setName      = "Set A",
  userId,
  scheduleId,
  onSetComplete,  // called with (setName) when student finishes — Areas handles next set
  onClose,        // called only on forced/unexpected close
}) => {
  const [currentIndex,    setCurrentIndex]    = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [isSubmitted,     setIsSubmitted]     = useState(false);
  const [score,           setScore]           = useState(0);
  const [isSaving,        setIsSaving]        = useState(false);
  const [shakeWarning,    setShakeWarning]    = useState(false);

  const currentQuestion    = questions[currentIndex];
  const isLastQuestion     = currentIndex === questions.length - 1;
  const progressPercentage = ((currentIndex + 1) / questions.length) * 100;
  const hasAnsweredCurrent = selectedAnswers[currentIndex] !== undefined;

  // ══════════════════════════════════════
  // 🔒 ANTI-CHEAT
  // ══════════════════════════════════════
  const {
    violationCount,
    warningInfo,
    showWarningModal,
    dismissWarning,
    isForcedSubmit,
  } = useAntiCheat({
    isActive:          !isSubmitted,
    maxViolations:     3,
    enforceFullscreen: true,
    userId,
    scheduleId,
    onForceSubmit: () => handleSubmit(true),
  });

  const handleSelectOption = (optionKey) => {
    if (isSubmitted) return;
    setSelectedAnswers(prev => ({ ...prev, [currentIndex]: optionKey.toUpperCase() }));
    setShakeWarning(false);
  };

  const handleNext = () => {
    if (!hasAnsweredCurrent) {
      setShakeWarning(true);
      setTimeout(() => setShakeWarning(false), 600);
      return;
    }
    if (!isLastQuestion) setCurrentIndex(i => i + 1);
  };

  const handleSubmit = async (forced = false) => {
    if (!forced && !hasAnsweredCurrent) {
      setShakeWarning(true);
      setTimeout(() => setShakeWarning(false), 600);
      return;
    }

    setIsSaving(true);

    let calculatedScore = 0;
    
    // --- BUG FIX ---
    // If submission is forced (anti-cheat violation), penalize with a score of 0.
    if (forced) {
      calculatedScore = 0;
    } else {
      // Otherwise, calculate score normally. 
      // Added 'ans &&' to ensure undefined answers don't accidentally match undefined correctAnswers.
      questions.forEach((q, index) => {
        const ans = selectedAnswers[index];
        if (ans && (ans === q.correctAnswer || ans === q.answer)) {
          calculatedScore++;
        }
      });
    }

    setScore(calculatedScore);
    setIsSubmitted(true);

    if (userId) {
      try {
        const subjectKey = subject.replace(/[.$#[\]/]/g, '_').replace(/\s+/g, '_');
        const setKey     = setName.replace(/[.$#[\]/]/g, '_').replace(/\s+/g, '_');

        const resultData = {
          quizTitle,
          subject,
          setName,
          score:              calculatedScore,
          total:              questions.length,
          percentage:         Math.round((calculatedScore / questions.length) * 100),
          timestamp:          Date.now(),
          answers:            selectedAnswers,
          autoSubmitted:      forced,
          violationsAtSubmit: violationCount,
        };

        // Save to: users/{userId}/live_exams/final_quiz/{subject}/{setName}
        await update(
          ref(db, `users/${userId}/live_exams/final_quiz/${subjectKey}/${setKey}`),
          resultData
        );

        if (scheduleId) {
          await update(
            ref(db, `exam_schedules/${scheduleId}/enrolledStudents/${userId}`),
            {
              score:         calculatedScore,
              total:         questions.length,
              percentage:    resultData.percentage,
              submittedAt:   Date.now(),
              autoSubmitted: forced,
              lastSubject:   subject,
              lastSet:       setName,
            }
          );
        }
      } catch (err) {
        console.error("Failed to save results:", err);
      }
    }

    setIsSaving(false);
  };

  // Called when student clicks "Continue" on results screen
  const handleContinue = () => {
    if (onSetComplete) onSetComplete(setName);
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto">
        <AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
        <h2 className="text-gray-500 font-bold">No questions available for this test.</h2>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-6px); }
          40%     { transform: translateX(6px); }
          60%     { transform: translateX(-4px); }
          80%     { transform: translateX(4px); }
        }
        .shake { animation: shake 0.5s ease; }
      `}</style>

      <div className="max-w-3xl mx-auto font-['Inter',sans-serif] space-y-4 pb-12 animate-in fade-in zoom-in-95 duration-300">

        {/* 🔒 ANTI-CHEAT MODAL */}
        {showWarningModal && (
          <AntiCheatWarningModal
            warningInfo={warningInfo}
            maxViolations={3}
            onDismiss={dismissWarning}
            isForcedSubmit={isForcedSubmit}
          />
        )}

        {/* ── Sticky Header ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 sticky top-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Lock icon during exam, nothing to click back to */}
              <div className="p-1.5 text-gray-200 rounded-md cursor-not-allowed" title="Cannot exit during exam">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-black text-gray-900 leading-tight">{quizTitle}</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#800000]">{subject}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isSubmitted && violationCount > 0 && (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                  <ShieldAlert className="w-3 h-3" /> {violationCount}/3
                </div>
              )}
              {!isSubmitted && (
                <div className="text-right">
                  <span className="text-2xl font-black text-gray-900">{currentIndex + 1}</span>
                  <span className="text-xs font-bold text-gray-400"> / {questions.length}</span>
                </div>
              )}
            </div>
          </div>
          {!isSubmitted && (
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#800000] h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          )}
        </div>

        {/* ── Active Quiz ── */}
        {!isSubmitted ? (
          <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 ${shakeWarning ? 'shake' : ''}`}>

            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                {shakeWarning && (
                  <span className="text-[10px] font-black text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full animate-in fade-in duration-200">
                    ⚠ Please select an answer to continue
                  </span>
                )}
              </div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900 leading-relaxed">
                {currentQuestion?.question}
              </h2>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {['a','b','c','d'].map((key) => {
                const optionText = currentQuestion?.options?.[key] || currentQuestion?.options?.[key.toUpperCase()];
                if (!optionText) return null;
                const isSelected = selectedAnswers[currentIndex] === key.toUpperCase();
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectOption(key)}
                    className={`w-full flex items-start text-left p-4 rounded-xl border-2 transition-all duration-200 group
                      ${isSelected
                        ? 'bg-[#f4e8e8] border-[#800000] shadow-sm'
                        : 'bg-gray-50 border-gray-100 hover:border-gray-300 hover:bg-white'
                      }`}
                  >
                    <div className={`flex items-center justify-center w-6 h-6 rounded-md mr-4 flex-shrink-0 text-xs font-black transition-colors
                      ${isSelected ? 'bg-[#800000] text-white' : 'bg-gray-200 text-gray-500 group-hover:bg-gray-300'}`}>
                      {key.toUpperCase()}
                    </div>
                    <span className={`text-sm font-medium pt-0.5 ${isSelected ? 'text-[#800000] font-bold' : 'text-gray-700'}`}>
                      {optionText}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Navigation — Next only, NO Previous */}
            <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100">
              <div className={`flex items-center gap-2 text-xs font-semibold ${hasAnsweredCurrent ? 'text-emerald-600' : 'text-gray-400'}`}>
                {hasAnsweredCurrent ? (
                  <><CheckCircle className="w-4 h-4" /> Answer recorded</>
                ) : (
                  <><div className="w-4 h-4 rounded-full border-2 border-gray-300" /> Not answered yet</>
                )}
              </div>

              {isLastQuestion ? (
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isSaving || !hasAnsweredCurrent}
                  className={`flex items-center px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-md transition-all active:scale-95
                    ${hasAnsweredCurrent
                      ? 'text-white bg-[#800000] hover:bg-[#6a0000]'
                      : 'text-gray-400 bg-gray-100 cursor-not-allowed'}`}
                >
                  {isSaving
                    ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                    : <CheckCircle className="w-4 h-4 mr-2" />}
                  Submit
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className={`flex items-center px-6 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95
                    ${hasAnsweredCurrent
                      ? 'text-white bg-[#800000] hover:bg-[#6a0000]'
                      : 'text-gray-500 bg-gray-100 cursor-not-allowed'}`}
                >
                  Next Question <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              )}
            </div>
          </div>

        ) : (

          /* ── Results ── NO correct answers shown */
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Score card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#800000] to-red-500" />
              <div className="w-20 h-20 mx-auto bg-[#f4e8e8] rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-lg">
                <Award className="w-10 h-10 text-[#800000]" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-1">
                {setName} Complete!
              </h2>
              <p className="text-sm text-gray-500 font-medium mb-6">
                {subject}
              </p>

              {isForcedSubmit && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-4 py-3 rounded-xl flex items-center justify-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  Auto-submitted after {violationCount} anti-cheat violation{violationCount !== 1 ? 's' : ''}.
                </div>
              )}

              <div className="flex items-center justify-center gap-8 mb-2">
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Score</p>
                  <p className="text-4xl font-black text-[#800000]">
                    {score}<span className="text-xl text-gray-300">/{questions.length}</span>
                  </p>
                </div>
                <div className="w-px h-12 bg-gray-200" />
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Percentage</p>
                  <p className={`text-4xl font-black ${Math.round((score/questions.length)*100) >= 75 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {Math.round((score/questions.length)*100)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Answer review — shows what the student picked, but NO correct answers */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center">
                <BookOpen className="w-4 h-4 mr-2 text-[#800000]" />
                <h3 className="text-sm font-bold text-gray-800">Your Answers</h3>
                <span className="ml-auto text-[10px] text-gray-400 font-medium">Correct answers are not shown</span>
              </div>
              <div className="divide-y divide-gray-50">
                {questions.map((q, idx) => {
                  const studentAns = selectedAnswers[idx];
                  const correctAns = q.answer || q.correctAnswer;
                  const isCorrect  = studentAns === correctAns;
                  const optionText = studentAns
                    ? (q.options?.[studentAns.toLowerCase()] || q.options?.[studentAns] || '')
                    : '';

                  return (
                    <div key={idx} className="p-4 flex items-start gap-3">
                      {/* Only show ✓ or ✗ — not which was correct */}
                      <div className="mt-0.5 flex-shrink-0">
                        {isCorrect
                          ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                          : <XCircle    className="w-4 h-4 text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">
                          Q{idx + 1}
                        </span>
                        <p className="text-sm font-medium text-gray-800 mb-2 leading-snug">{q.question}</p>
                        {/* Student's chosen answer only */}
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-red-50 border-red-200 text-red-600'
                        }`}>
                          <span className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-black ${
                            isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-400 text-white'
                          }`}>
                            {studentAns || '—'}
                          </span>
                          {optionText || 'No answer'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Continue / finish footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-[10px] text-gray-400 font-medium">
                  {isForcedSubmit
                    ? 'Exam was auto-submitted.'
                    : 'Your answers have been saved.'}
                </p>
                <button
                  onClick={handleContinue}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#800000] text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-sm hover:bg-[#6a0000] transition-all active:scale-95"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
};

export default QuizEngine;