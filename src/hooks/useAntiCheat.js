// useAntiCheat.js — STRICT MODE
// Every tab leave / app switch = one violation. Logs to Firebase under the student's schedule.
import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../Firebase'; // adjust path if needed

const useAntiCheat = ({
  isActive = true,
  maxViolations = 3,
  onForceSubmit,
  onViolation,
  enforceFullscreen = true,
  userId = null,       // student UID — needed to write violations to Firebase
  scheduleId = null,   // the exam_schedules key the student is enrolled in
}) => {
  const [violationCount, setViolationCount]     = useState(0);
  const [warningInfo, setWarningInfo]           = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isFullscreen, setIsFullscreen]         = useState(false);

  // ── Stable refs (never stale inside event handlers) ──
  const countRef         = useRef(0);
  const isActiveRef      = useRef(isActive);
  const onForceSubmitRef = useRef(onForceSubmit);
  const onViolationRef   = useRef(onViolation);
  const modalOpenRef     = useRef(false);
  const isFullscreenRef  = useRef(false);
  const pageHiddenRef    = useRef(false);
  const awaitingReturnRef = useRef(false);

  useEffect(() => { isActiveRef.current      = isActive;      }, [isActive]);
  useEffect(() => { onForceSubmitRef.current = onForceSubmit; }, [onForceSubmit]);
  useEffect(() => { onViolationRef.current   = onViolation;   }, [onViolation]);

  // ── Write violation to Firebase ──
  const logViolationToFirebase = useCallback((type, count) => {
    if (!userId) return;

    const timestamp = Date.now();
    const violationData = {
      type,
      count,
      timestamp,
      label: {
        tab_switch:  'Tab Switch',
        window_blur: 'App Switch',
        fullscreen:  'Fullscreen Exit',
        copy_paste:  'Copy/Paste',
        print:       'Print Attempt',
        devtools:    'DevTools',
      }[type] || 'Unknown',
    };

    // Always log under users/{uid}/violations/
    update(ref(db, `users/${userId}/violations/${timestamp}`), violationData).catch(() => {});

    // Also log under the specific schedule so instructor sees it in Scheduler
    if (scheduleId) {
      update(
        ref(db, `exam_schedules/${scheduleId}/enrolledStudents/${userId}/violations/${timestamp}`),
        violationData
      ).catch(() => {});

      // Keep a running total on the student's enrollment record
      update(
        ref(db, `exam_schedules/${scheduleId}/enrolledStudents/${userId}`),
        { violationCount: count, lastViolation: timestamp, lastViolationType: violationData.label }
      ).catch(() => {});
    }
  }, [userId, scheduleId]);

  // ── Core: fire one violation ──
  const triggerViolation = useCallback((type) => {
    if (!isActiveRef.current) return;
    if (modalOpenRef.current) return; // modal already showing — wait for dismiss

    countRef.current += 1;
    const newCount = countRef.current;

    setViolationCount(newCount);
    setWarningInfo({ type, count: newCount });
    setShowWarningModal(true);
    modalOpenRef.current = true;

    // Log to Firebase
    logViolationToFirebase(type, newCount);
    if (onViolationRef.current) onViolationRef.current(type, newCount);

    // Auto-submit after 3s when limit reached
    if (newCount >= maxViolations) {
      setTimeout(() => {
        if (onForceSubmitRef.current) onForceSubmitRef.current();
      }, 3000);
    }
  }, [maxViolations, logViolationToFirebase]);

  // ── Fullscreen helper ──
  const requestFullscreen = useCallback(() => {
    const el = document.documentElement;
    try {
      if      (el.requestFullscreen)            el.requestFullscreen();
      else if (el.webkitRequestFullscreen)      el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen)         el.mozRequestFullScreen();
      else if (el.msRequestFullscreen)          el.msRequestFullscreen();
    } catch (_) {}
  }, []);

  // ── Dismiss modal → re-arm ──
  const dismissWarning = useCallback(() => {
    setShowWarningModal(false);
    setWarningInfo(null);
    modalOpenRef.current     = false;
    awaitingReturnRef.current = false;

    if (enforceFullscreen && !isFullscreenRef.current) {
      setTimeout(() => requestFullscreen(), 100);
    }
  }, [enforceFullscreen, requestFullscreen]);

  // ── Attach all listeners ──
  useEffect(() => {
    if (!isActive) return;

    // 1. Tab visibility — hidden=true means student LEFT
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pageHiddenRef.current      = true;
        awaitingReturnRef.current  = true;
        triggerViolation('tab_switch');
      } else {
        pageHiddenRef.current = false;
        // student came back — do NOT count, just reset
      }
    };

    // 2. Window blur — only if page is still visible (pure Alt+Tab to another app)
    const handleWindowBlur = () => {
      if (!isActiveRef.current)       return;
      if (pageHiddenRef.current)      return; // visibilitychange already handled it
      if (awaitingReturnRef.current)  return; // already counted this leave cycle
      awaitingReturnRef.current = true;
      triggerViolation('window_blur');
    };

    // 3. Window focus — reset so next leave is a fresh violation
    const handleWindowFocus = () => {
      awaitingReturnRef.current = false;
    };

    // 4. Keyboard shortcuts
    const handleKeyDown = (e) => {
      const key  = e.key?.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && ['c','v','x','a','s'].includes(key)) { e.preventDefault(); triggerViolation('copy_paste'); return; }
      if (ctrl && key === 'p')                          { e.preventDefault(); triggerViolation('print');      return; }
      if (e.key === 'F12' || (ctrl && e.shiftKey && ['i','j','c'].includes(key))) { e.preventDefault(); triggerViolation('devtools'); return; }
      if (e.key === 'PrintScreen')                      { e.preventDefault(); triggerViolation('copy_paste'); return; }
    };

    // 5. Clipboard
    const handleCopy  = (e) => { e.preventDefault(); triggerViolation('copy_paste'); };
    const handlePaste = (e) => { e.preventDefault(); triggerViolation('copy_paste'); };
    const handleCut   = (e) => { e.preventDefault(); triggerViolation('copy_paste'); };

    // 6. Fullscreen change
    const handleFullscreenChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      const inFs = !!fsEl;
      isFullscreenRef.current = inFs;
      setIsFullscreen(inFs);
      if (enforceFullscreen && !inFs) triggerViolation('fullscreen');
    };

    document.addEventListener('visibilitychange',        handleVisibilityChange);
    window.addEventListener  ('blur',                    handleWindowBlur);
    window.addEventListener  ('focus',                   handleWindowFocus);
    document.addEventListener('keydown',                 handleKeyDown,    true);
    document.addEventListener('copy',                    handleCopy);
    document.addEventListener('paste',                   handlePaste);
    document.addEventListener('cut',                     handleCut);
    document.addEventListener('fullscreenchange',        handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange',  handleFullscreenChange);
    document.addEventListener('mozfullscreenchange',     handleFullscreenChange);
    document.addEventListener('MSFullscreenChange',      handleFullscreenChange);

    if (enforceFullscreen) requestFullscreen();

    return () => {
      document.removeEventListener('visibilitychange',       handleVisibilityChange);
      window.removeEventListener  ('blur',                   handleWindowBlur);
      window.removeEventListener  ('focus',                  handleWindowFocus);
      document.removeEventListener('keydown',                handleKeyDown,    true);
      document.removeEventListener('copy',                   handleCopy);
      document.removeEventListener('paste',                  handlePaste);
      document.removeEventListener('cut',                    handleCut);
      document.removeEventListener('fullscreenchange',       handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange',    handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange',     handleFullscreenChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return {
    violationCount,
    warningInfo,
    showWarningModal,
    isFullscreen,
    dismissWarning,
    requestFullscreen,
    isForcedSubmit: countRef.current >= maxViolations,
  };
};

export default useAntiCheat;