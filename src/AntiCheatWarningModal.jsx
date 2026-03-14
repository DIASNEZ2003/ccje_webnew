// AntiCheatWarningModal.jsx
import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, Eye, Timer } from 'lucide-react';

const VIOLATION_META = {
  tab_switch:  { label: 'Tab Switch Detected',           icon: '🔀', detail: 'You navigated away from the exam tab.' },
  window_blur: { label: 'Application Switch Detected',   icon: '🖥️', detail: 'You switched to another program or window (e.g. Chrome, desktop).' },
  fullscreen:  { label: 'Fullscreen Exited',             icon: '⛶',  detail: 'You exited fullscreen mode during the exam.' },
  copy_paste:  { label: 'Copy / Paste Blocked',          icon: '📋', detail: 'Copying or pasting is not allowed during the exam.' },
  print:       { label: 'Print Attempt Blocked',         icon: '🖨️', detail: 'Printing is not allowed during the exam.' },
  right_click: { label: 'Right-Click Blocked',           icon: '🖱️', detail: 'Right-clicking is disabled during the exam.' },
  devtools:    { label: 'Developer Tools Blocked',       icon: '🔧', detail: 'Opening developer tools is not permitted during the exam.' },
};

const AntiCheatWarningModal = ({
  warningInfo,       // { type, count }
  maxViolations,
  onDismiss,
  isForcedSubmit,
}) => {
  const [countdown, setCountdown] = useState(null);

  const violationCount = warningInfo?.count ?? 0;
  const type           = warningInfo?.type ?? 'window_blur';
  const meta           = VIOLATION_META[type] ?? { label: 'Suspicious Activity', icon: '⚠️', detail: 'Unexpected behaviour was detected.' };
  const remaining      = maxViolations - violationCount;
  const isDanger       = remaining <= 1 || isForcedSubmit;

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div
        className={`bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border-2 transition-all
          ${isDanger ? 'border-red-500' : 'border-amber-400'}`}
        // Stop click/focus events from leaking to the page behind
        onMouseDown={e => e.stopPropagation()}
      >

        {/* ── Colour header ── */}
        <div className={`px-6 py-4 flex items-center gap-3 ${isDanger ? 'bg-red-600' : 'bg-amber-500'}`}>
          <ShieldAlert className="w-6 h-6 text-white shrink-0" />
          <div className="flex-1">
            <h2 className="text-white font-black text-sm uppercase tracking-widest">
              {isForcedSubmit ? 'Exam Auto-Submitted' : 'Anti-Cheat Warning'}
            </h2>
            <p className="text-white/80 text-xs font-medium mt-0.5">
              {isForcedSubmit
                ? 'Maximum violations reached'
                : `Strike ${violationCount} of ${maxViolations} — ${remaining} remaining`}
            </p>
          </div>

          {/* Countdown badge on final violation */}
          {isForcedSubmit && countdown !== null && (
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 border-2 border-white/40">
              <span className="text-white font-black text-lg leading-none">{countdown}</span>
            </div>
          )}
        </div>

        {/* ── Strike bar ── */}
        <div className="px-6 pt-5 flex gap-2">
          {Array.from({ length: maxViolations }).map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                i < violationCount
                  ? isDanger ? 'bg-red-500' : 'bg-amber-400'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4">

          {/* What happened */}
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${isDanger ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <span className="text-2xl leading-none mt-0.5">{meta.icon}</span>
            <div>
              <p className={`text-sm font-black mb-0.5 ${isDanger ? 'text-red-700' : 'text-amber-700'}`}>
                {meta.label}
              </p>
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                {meta.detail}
              </p>
            </div>
          </div>

          {/* What's being monitored — only show on non-final warnings */}
          {!isForcedSubmit && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Active Monitoring
                </span>
              </div>
              <ul className="space-y-2">
                {[
                  { icon: '🔀', text: 'Tab switching & Alt+Tab' },
                  { icon: '🖥️', text: 'Switching to other apps (Chrome, desktop, etc.)' },
                  { icon: '📋', text: 'Copy, paste, cut & print shortcuts' },
                  { icon: '⛶',  text: 'Exiting fullscreen mode' },
                  { icon: '🖱️', text: 'Right-click context menu' },
                  { icon: '🔧', text: 'Developer tools (F12, Ctrl+Shift+I)' },
                ].map(({ icon, text }) => (
                  <li key={text} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="text-sm leading-none">{icon}</span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Auto-submit notice */}
          {isForcedSubmit ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Timer className="w-4 h-4 text-red-500" />
                <p className="text-red-700 font-black text-sm">
                  {countdown !== null && countdown > 0
                    ? `Submitting in ${countdown} second${countdown !== 1 ? 's' : ''}…`
                    : 'Your exam has been submitted.'}
                </p>
              </div>
              <p className="text-red-400 text-xs mt-1">
                Contact your instructor if you believe this was an error.
              </p>
            </div>
          ) : (
            <button
              onClick={onDismiss}
              className={`w-full py-3 rounded-xl text-white text-sm font-black uppercase tracking-widest
                transition-all active:scale-[0.98] focus:outline-none
                ${isDanger
                  ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-100'
                  : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-100'
                }`}
            >
              I Understand — Return to Exam
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default AntiCheatWarningModal;