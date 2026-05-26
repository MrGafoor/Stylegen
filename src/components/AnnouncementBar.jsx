import React, { useState, useEffect } from 'react';

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(false);
  const ANN_ID = 'stylegen_ann_v3';
  const ANN_TTL_MS = 21 * 24 * 60 * 60 * 1000; // 21 days

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ANN_ID);
      if (raw) {
        const ts = parseInt(raw, 10) || 0;
        if (ts && Date.now() - ts < ANN_TTL_MS) {
          setVisible(false);
          return;
        }
      }
      setVisible(true);
    } catch (_) {
      setVisible(true); // default if localStorage is disabled
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(ANN_ID, String(Date.now()));
    } catch (_) {}
  };

  if (!visible) return null;

  return (
    <div className="ann" role="banner">
      <div className="ann-inner">
        <a className="ann-link" href="#faq">
          <span className="ann-pill">OBSERVATORY REPORT</span>
          <span className="ann-text">
            Style Gen v3.0 (Minimal Space Interface) is active — Built using pure canvas stars, Vercel-style transitions, and low-density layouts.
          </span>
        </a>
        <button
          type="button"
          className="ann-dismiss"
          aria-label="Dismiss announcement"
          onClick={handleDismiss}
        >
          ×
        </button>
      </div>
    </div>
  );
}
