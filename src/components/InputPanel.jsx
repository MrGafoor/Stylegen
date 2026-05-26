import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function InputPanel({
  url,
  setUrl,
  onSubmit,
  isAnalyzing,
  quota,
  geminiKey,
  setGeminiKey
}) {
  const [showSettings, setShowSettings] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch (_) {
      // Clipboard paste block
    }
  };

  const PRESETS = [
    { label: 'stripe.com', value: 'stripe.com' },
    { label: 'apple.com', value: 'apple.com' },
    { label: 'linear.app', value: 'linear.app' },
    { label: 'vercel.com', value: 'vercel.com' },
    { label: 'notion.so', value: 'notion.so' }
  ];

  return (
    <div className="panel">
      <div className="panel-label">INTERFACE DECODER</div>
      <form onSubmit={onSubmit} autoComplete="off">
        <div className={`input-row-glow ${isAnalyzing ? 'analyzing' : ''}`}>
          <div className="input-row">
            <svg className="input-globe-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <input
              id="url"
              className="url-input"
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellcheck="false"
              placeholder="stripe.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isAnalyzing}
              required
            />
            <button
              type="button"
              className="paste-btn"
              onClick={handlePaste}
              aria-label="Paste URL from clipboard"
              title="Paste from clipboard"
              disabled={isAnalyzing}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="2" width="8" height="4" rx="1" />
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              </svg>
            </button>
            <motion.button
              type="submit"
              className="btn-go"
              disabled={isAnalyzing || !url}
              animate={isAnalyzing ? { scale: [1, 0.98, 1], opacity: [1, 0.72, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            >
              <span>{isAnalyzing ? 'Analyzing' : 'Analyze'}</span>
              <span className="arrow">→</span>
            </motion.button>
          </div>
        </div>
      </form>

      <div className="try">
        <span className="try-label">PRESETS:</span>
        <div className="try-row">
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              className={`chip ${url === preset.value ? 'active' : ''}`}
              onClick={() => setUrl(preset.value)}
              disabled={isAnalyzing}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-toggle-container">
        <button
          type="button"
          className="settings-toggle-btn"
          onClick={() => setShowSettings(!showSettings)}
        >
          <span>⚙ AI Configuration</span>
          <span className={`settings-arrow ${showSettings ? 'open' : ''}`}>▾</span>
        </button>
        
        {showSettings && (
          <div className="settings-panel">
            <label htmlFor="gemini-key" className="settings-label">
              Gemini API Key (Optional — unlocks custom component prompts):
            </label>
            <input
              id="gemini-key"
              type="password"
              className="settings-input"
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              disabled={isAnalyzing}
            />
            <span className="settings-hint">
              Leave blank to run locally-compiled programmatic spec compilers. Keys are only held in current memory.
            </span>
          </div>
        )}
      </div>

      <div className={`quota-counter ${quota.remaining <= 0 ? 'quota-empty' : quota.remaining <= 2 ? 'quota-low' : ''}`}>
        {quota.remaining <= 0 ? (
          `0 left today — resets in ${quota.resetSeconds ? Math.floor(quota.resetSeconds / 3600) + 'h' : 'a moment'}`
        ) : (
          `${quota.remaining} of ${quota.limit} observatory analyses left today`
        )}
      </div>
    </div>
  );
}
