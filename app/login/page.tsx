import { GoogleSignInButton } from "./GoogleSignInButton";

export default function LoginPage() {
  return (
    <>
      <style>{`
        .login-wrap {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: var(--bg); padding: 24px;
        }
        .login-box { width: 100%; max-width: 420px; }
        .login-brand {
          display: flex; align-items: center; gap: 14px;
          justify-content: center; margin-bottom: 32px;
        }
        .login-mark {
          width: 52px; height: 52px; border-radius: 18px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          display: grid; place-items: center; color: white;
          box-shadow: 0 8px 24px rgba(99,102,241,.3);
        }
        .login-brand-name { font-size: 26px; font-weight: 800; color: var(--ink); letter-spacing: -.01em; }
        .login-brand-tag { font-size: 13px; color: var(--mut); }
        .login-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 24px; padding: 32px;
          box-shadow: 0 2px 4px rgba(15,23,42,.04), 0 12px 32px rgba(15,23,42,.06);
        }
        .login-features { display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px; }
        .login-feat { display: flex; align-items: flex-start; gap: 12px; }
        .login-feat-ico {
          width: 34px; height: 34px; border-radius: 10px;
          background: var(--indigo-soft); display: grid; place-items: center;
          color: var(--indigo); flex-shrink: 0;
        }
        .login-feat-text { font-size: 13px; color: var(--ink-2); line-height: 1.4; padding-top: 8px; }
        .login-google-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px;
          padding: 13px 20px; background: white;
          border: 1.5px solid var(--line); border-radius: 12px;
          font-size: 14px; font-weight: 600; color: var(--ink);
          cursor: pointer; font-family: inherit;
          box-shadow: 0 1px 2px rgba(15,23,42,.06);
          transition: all .15s;
        }
        .login-google-btn:hover { border-color: #d0d1db; box-shadow: 0 4px 12px rgba(15,23,42,.08); }
        .login-note { font-size: 11.5px; color: var(--mut); text-align: center; margin-top: 14px; }
      `}</style>
      <div className="login-wrap">
        <div className="login-box">
          <div className="login-brand">
            <div className="login-mark">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
              </svg>
            </div>
            <div>
              <div className="login-brand-name">TempoFlow</div>
              <div className="login-brand-tag">Master your time.</div>
            </div>
          </div>

          <div className="login-card">
            <div className="login-features">
              {[
                { text: "Real-time deadline tracking with urgency levels", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
                { text: "Syncs directly to Google Calendar with pop-up reminders", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg> },
                { text: "Tasks synced to Google Tasks for mobile visibility", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
                { text: "12-widget dashboard — workload, timeline, calendar & more", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg> },
              ].map(({ text, icon }, i) => (
                <div key={i} className="login-feat">
                  <div className="login-feat-ico">{icon}</div>
                  <div className="login-feat-text">{text}</div>
                </div>
              ))}
            </div>

            <GoogleSignInButton />

            <p className="login-note">Grants calendar event creation and tasks access</p>
          </div>
        </div>
      </div>
    </>
  );
}
