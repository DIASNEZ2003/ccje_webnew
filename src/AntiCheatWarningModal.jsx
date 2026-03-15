// AntiCheatWarningModal.jsx
import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, Eye, Timer } from 'lucide-react';

const VIOLATION_META = {
  tab_switch:  { label: 'Tab Switch Detected',           icon: '🔀', detail: 'You navigated away from the exam tab.' },
  window_blur: { label: 'Application Switch Detected',   icon: '🖥️', detail: 'You switched to another program or window (e.g. Chrome, desktop).' },
  fullscreen:  { label: 'Fullscreen Exited',             icon: '⛶',  detail: 'You exited fullscreen mode during the exam.' },
  copy_paste:  { label: 'Copy / Paste Blocked',          icon: '📋', detail: 'Copying or pasting is not allowed during the exam.' },
  print:       { label: 'Print Attempt Blocked',         icon: '🖨️', detail: 'Printing is not allowed during the exam.' },
  devtools:    { label: 'Developer Tools Blocked',       icon: '🔧', detail: 'Opening developer tools is not permitted during the exam.' },
};

const AntiCheatWarningModal = ({
  warningInfo,       // { type, count }
  maxViolations,
  onDismiss,
  isForcedSubmit,
  onReturnToAreas,   // ── NEW PROP: Triggers the return to the Areas list ──
}) => {
  const [countdown, setCountdown] = useState(null);

  const violationCount = warningInfo?.count ?? 0;
  const type           = warningInfo?.type ?? 'window_blur';
  const meta           = VIOLATION_META[type] ?? { label: 'Suspicious Activity', icon: '⚠️', detail: 'Unexpected behaviour was detected.' };
  const remaining      = maxViolations - violationCount;

  // ── Countdown before auto-submit on final violation ──
  useEffect(() => {
    if (!isForcedSubmit) {
      setCountdown(null);
      return;
    }
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isForcedSubmit]);

  if (!warningInfo) return null;

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700;900&display=swap');
        `}
      </style>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-['Inter',sans-serif]">
        <div
          className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-200 transition-all"
          // Stop click/focus events from leaking to the page behind
          onMouseDown={e => e.stopPropagation()}
        >

          {/* ── Header ── */}
          <div className="px-6 py-5 flex items-center gap-4 bg-white border-b border-gray-100">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#800000]/10 shrink-0">
              <ShieldAlert className="w-6 h-6 text-[#800000]" />
            </div>
            <div className="flex-1">
              <h2 className="font-['Playfair_Display',serif] text-xl font-bold tracking-tight text-gray-900">
                {isForcedSubmit ? 'Exam Auto-Submitted' : 'Anti-Cheat Warning'}
              </h2>
              <p className="text-gray-500 text-sm font-medium mt-0.5">
                {isForcedSubmit
                  ? 'Maximum violations reached'
                  : `Strike ${violationCount} of ${maxViolations} — ${remaining} remaining`}
              </p>
            </div>

            {/* Countdown badge on final violation */}
            {isForcedSubmit && countdown !== null && (
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#800000] text-white shadow-md">
                <span className="font-bold text-lg leading-none">{countdown}</span>
              </div>
            )}
          </div>

          {/* ── Strike bar ── */}
          <div className="px-6 pt-5 flex gap-2">
            {Array.from({ length: maxViolations }).map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                  i < violationCount ? 'bg-[#800000]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* ── Body ── */}
          <div className="px-6 py-5 space-y-5">

            {/* What happened */}
            <div className="flex items-start gap-4 p-4 rounded-xl border border-red-100 bg-red-50/50">
              <span className="text-2xl leading-none mt-0.5">{meta.icon}</span>
              <div>
                <p className="text-sm font-bold text-[#800000] mb-0.5">
                  {meta.label}
                </p>
                <p className="text-sm text-gray-600 font-medium leading-relaxed">
                  {meta.detail}
                </p>
              </div>
            </div>

            {/* What's being monitored — only show on non-final warnings */}
            {!isForcedSubmit && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
                    Active Monitoring
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {[
                    { icon: '🔀', text: 'Tab switching & Alt+Tab' },
                    { icon: '🖥️', text: 'Switching to other apps (Chrome, desktop, etc.)' },
                    { icon: '📋', text: 'Copy, paste, cut & print shortcuts' },
                    { icon: '⛶',  text: 'Exiting fullscreen mode' },
                    { icon: '🔧', text: 'Developer tools (F12, Ctrl+Shift+I)' },
                  ].map(({ icon, text }) => (
                    <li key={text} className="flex items-center gap-3 text-sm font-medium text-gray-600">
                      <span className="text-base leading-none">{icon}</span>
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            {isForcedSubmit ? (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Timer className="w-5 h-5 text-red-600" />
                  <p className="text-red-700 font-bold text-sm">
                    {countdown !== null && countdown > 0
                      ? `Submitting in ${countdown} second${countdown !== 1 ? 's' : ''}…`
                      : 'Your exam has been submitted.'}
                  </p>
                </div>
                <p className="text-red-500 text-xs mt-1 mb-4 font-medium">
                  Contact your instructor if you believe this was an error.
                </p>

                {/* ── NEW: Return to areas button appears when countdown hits 0 ── */}
                {countdown === 0 && (
                  <button
                    onClick={onReturnToAreas || onDismiss}
                    className="flex w-full justify-center rounded-lg bg-red-600 px-4 py-3.5 text-sm font-bold tracking-wide text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
                  >
                    Return to Areas
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={onDismiss}
                className="flex w-full justify-center rounded-lg bg-[#800000] px-4 py-3.5 text-sm font-bold tracking-wide text-white shadow-sm transition-colors hover:bg-[#600000] focus:outline-none focus:ring-2 focus:ring-[#800000] focus:ring-offset-2"
              >
                I Understand — Return to Exam
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default AntiCheatWarningModal;