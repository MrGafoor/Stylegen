import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnnouncementBar from './components/AnnouncementBar.jsx';
import Hero from './components/Hero.jsx';
import InputPanel from './components/InputPanel.jsx';
import Dashboard from './components/Dashboard.jsx';

// Subtle observatory starfield canvas background
function StarfieldBackground({ theme }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const isLight = theme === 'light';

    // Create 60 tiny, sparse stars
    const stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 0.4 + Math.random() * 0.8,
      vx: (Math.random() - 0.5) * 0.025, // imperceptibly slow movement
      vy: (Math.random() - 0.5) * 0.025,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.004 + Math.random() * 0.012,
      baseAlpha: 0.12 + Math.random() * 0.28
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Space backdrop color depending on light/dark mode
      ctx.fillStyle = isLight ? '#ffffff' : '#000000';
      ctx.fillRect(0, 0, width, height);

      stars.forEach((s) => {
        s.x += s.vx;
        s.y += s.vy;
        s.twinklePhase += s.twinkleSpeed;

        // Wrap boundaries
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height;
        if (s.y > height) s.y = 0;

        // Subtle twinkling opacity
        const alpha = s.baseAlpha + Math.sin(s.twinklePhase) * 0.12;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = isLight
          ? `rgba(0, 0, 0, ${Math.max(0.04, Math.min(alpha, 0.25))})`
          : `rgba(255, 255, 255, ${Math.max(0.04, Math.min(alpha, 0.45))})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme]);

  return <canvas ref={canvasRef} className="starfield-canvas" />;
}

// Preloaded calm Linear spec presets
const DEFAULT_TOKENS = {
  siteUrl: "https://linear.app",
  siteTitle: "Linear - A better way to build product",
  colors: {
    primary: [
      { hex: "#5E6AD2", count: 12 },
      { hex: "#B4BCD0", count: 8 },
      { hex: "#6E7BE2", count: 4 }
    ],
    neutral: [
      { hex: "#0B0B0F", count: 120 },
      { hex: "#191924", count: 90 },
      { hex: "#2E2E3E", count: 60 },
      { hex: "#B4BCD0", count: 40 },
      { hex: "#F4F5F6", count: 20 },
      { hex: "#121218", count: 10 }
    ],
    semantic: [
      { hex: "#10B981", count: 4, type: "success" },
      { hex: "#EF4444", count: 3, type: "error" },
      { hex: "#F59E0B", count: 2, type: "warning" }
    ]
  },
  typography: [
    {
      family: "Inter",
      sizes: [
        { label: "H1 Heading", value: "48px", weight: "700", lineHeight: "1.1" },
        { label: "H2 Heading", value: "32px", weight: "600", lineHeight: "1.2" },
        { label: "H3 Heading", value: "20px", weight: "600", lineHeight: "1.3" },
        { label: "Body Text", value: "15px", weight: "400", lineHeight: "1.6" },
        { label: "Button", value: "13px", weight: "600", lineHeight: "1.4" },
        { label: "Link", value: "14px", weight: "500", lineHeight: "1.4" }
      ]
    }
  ],
  breakpoints: [320, 640, 768, 1024, 1200, 1440],
  cssVariables: {
    "--bg": "#0B0B0F",
    "--surface": "#191924",
    "--border": "#2E2E3E",
    "--primary": "#5E6AD2",
    "--fg": "#F4F5F6"
  },
  interactionStates: []
};

const DEFAULT_MARKDOWN = `# Linear Design System Specification

> Source: https://linear.app  
> Measured: May 25, 2026  
> Compiled by Style Gen Space Observatory

---
name: Linear
url: https://linear.app
colors:
  primary: '#5E6AD2'
  primary-active: '#6E7BE2'
  text-accent: '#B4BCD0'
  background: '#0B0B0F'
  surface: '#191924'
  surface-muted: '#121218'
  text-primary: '#F4F5F6'
  text-muted: '#B4BCD0'
  text-subtle: '#6E7BE2'
  text-inverse: '#0B0B0F'
  border: '#2E2E3E'
  dark-surface: '#0B0B0F'
  focus-ring: 'rgba(94, 106, 210, 0.35)'
typography:
  display:
    family: Inter
    size: 48px
    weight: 700
    line-height: 1.1
  heading:
    family: Inter
    size: 32px
    weight: 600
    line-height: 1.2
  body:
    family: Inter
    size: 15px
    weight: 400
    line-height: 1.6
  caption:
    family: Inter
    size: 13px
    weight: 600
    line-height: 1.4
---

## 1. Visual Theme & Atmosphere
The design system of **Linear** is universally recognized for its masterclass dark-mode presentation. Operating on a deep space canvas (\`#0B0B0F\`), it coordinates high-contrast typography scaling and amethyst gradients. High hairline border boundaries (\`#2E2E3E\`) partition surfaces with extreme visual structure.

## 2. Color Palette & Roles
*   **Primary Accent (\`#5E6AD2\`)**: Glowing indigo tone for core CTAs and validation triggers.
*   **Neutral Canvas (\`#0B0B0F\`)**: Deep black backdrop governs all screen segments.
*   **Surface Cards (\`#191924\`)**: Subtle grey borders and elevated container sections.
`;

export default function App() {
  const [url, setUrl] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Set default Stripe preset so the dashboard works out-of-the-box
  const [tokens, setTokens] = useState(DEFAULT_TOKENS);
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [classicMarkdown, setClassicMarkdown] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('live-spec'); // Live Spec is default active first tab
  const liveSpecRef = useRef(null);

  // Lifted Dashboard states to preserve data and avoid resets
  const [specViewType, setSpecViewType] = useState('preview'); // 'preview' | 'raw' | 'json'
  const [specFormat, setSpecFormat] = useState('enterprise'); // 'enterprise' | 'classic'
  const [selectedBenchmarkIdx, setSelectedBenchmarkIdx] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptGeneratingPhase, setPromptGeneratingPhase] = useState(0);

  // Persistence and color-scheme configuration state
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('stylegen_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch (_) {}
    return 'dark'; // default to obsidian theme
  });

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (theme === 'light') {
        root.classList.remove('dark');
        root.classList.add('light');
      } else {
        root.classList.remove('light');
        root.classList.add('dark');
      }
      localStorage.setItem('stylegen_theme', theme);
    } catch (_) {}
  }, [theme]);
  
  const [quota, setQuota] = useState({ remaining: 10, limit: 10, resetSeconds: 0 });
  const [totalAnalyses, setTotalAnalyses] = useState(6400);
  
  // Stopwatch
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);

  // Toasts
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    fetchQuota();
  }, []);

  const fetchQuota = async () => {
    try {
      const res = await fetch('/api/quota');
      if (res.ok) {
        const data = await res.json();
        setQuota({
          remaining: data.remaining,
          limit: data.limit,
          resetSeconds: data.resetSeconds
        });
        if (data.totalAnalyses) {
          setTotalAnalyses(data.totalAnalyses);
        }
      }
    } catch (_) {}
  };

  const startStopwatch = () => {
    setElapsed(0);
    startTimeRef.current = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((Date.now() - startTimeRef.current) / 1000);
    }, 100);
  };

  const stopStopwatch = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
    }, 2000);
  };

  const handleReset = () => {
    setTokens(null);
    setMarkdown('');
    setClassicMarkdown('');
    setError('');
    setUrl('');
    setElapsed(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!url || isAnalyzing) return;

    setError('');

    // 1. Strict URL validation
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter a valid URL.');
      return;
    }

    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    if (!urlRegex.test(trimmedUrl)) {
      setError('Please enter a valid website URL (e.g. stripe.com or https://stripe.com)');
      return;
    }

    let normalizedUrl = trimmedUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    // Set normalized URL back to state
    setUrl(normalizedUrl);

    // Reset prompt and active settings for the new analysis run
    setPrompt('');
    setIsGeneratingPrompt(false);
    setPromptGeneratingPhase(0);
    setSpecViewType('preview');
    setSpecFormat('enterprise');
    setSelectedBenchmarkIdx(0);

    setIsAnalyzing(true);
    startStopwatch();

    // Smooth scroll down to the decoder progress panel
    setTimeout(() => {
      document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    try {
      // 1. Submit request to Puppeteer crawler
      const analyzeRes = await fetch('/api/analyze-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      const remainingHeader = analyzeRes.headers.get('RateLimit-Remaining');
      if (remainingHeader !== null) {
        setQuota(q => ({ ...q, remaining: parseInt(remainingHeader, 10) }));
      }

      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json();
        throw new Error(errData.error || 'Analyze request failed');
      }

      const analyzeData = await analyzeRes.json();
      setTokens(analyzeData.tokens);
      
      setIsAnalyzing(false);
      setIsGenerating(true);

      // 2. Submit spec document generation
      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens: analyzeData.tokens,
          sourceUrl: url,
          apiKey: geminiKey || undefined
        }),
      });

      if (!generateRes.ok) {
        const errData = await generateRes.json();
        throw new Error(errData.error || 'Markdown generation failed');
      }

      const generateData = await generateRes.json();
      setMarkdown(generateData.markdown);
      setClassicMarkdown(generateData.classicMarkdown || '');
      
      stopStopwatch();
      setIsGenerating(false);
      triggerToast('Design specification loaded');
      fetchQuota();

      // Automatically switch to Live Spec
      setActiveTab("live-spec");

      // Smoothly scroll to results section and focus it, prevent abrupt jumps
      setTimeout(() => {
        liveSpecRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 100);

    } catch (err) {
      console.error(err);
      stopStopwatch();
      setIsAnalyzing(false);
      setIsGenerating(false);
      setError('Could not analyze this website. Please try another URL.');
    }
  };

  const formatElapsed = (sec) => {
    const min = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec - Math.floor(sec)) * 10);
    return `${min}:${s < 10 ? '0' : ''}${s}.${ms}s`;
  };

  // Maps stopwatch elapsed progress to sequenced monospaced loading steps
  const getLoadingPhase = (sec) => {
    if (sec < 2) return 0;    // Scanning DOM...
    if (sec < 4) return 1;    // Extracting CSS...
    if (sec < 6) return 2;    // Analyzing Typography...
    if (sec < 8) return 3;    // Computing Tokens...
    return 4;                 // Building Live Spec...
  };

  const loadingSteps = [
    "Scanning DOM...",
    "Extracting CSS...",
    "Analyzing Typography...",
    "Computing Tokens...",
    "Building Live Spec..."
  ];

  const currentPhase = getLoadingPhase(elapsed);
  const progressPercent = Math.min(95, Math.floor((elapsed / 10) * 100));

  return (
    <>
      {/* Calm Starfield Canvas backdrop */}
      <StarfieldBackground theme={theme} />

      <AnnouncementBar />

      {/* Global theme toggle button visible when landing results are not mounted */}
      {!tokens && (
        <button
          type="button"
          className="global-theme-toggle"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label="Toggle theme"
          title="Switch theme"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      )}

      {/* Slide reveal for page shell */}
      <motion.main 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="shell"
      >
        <section className="hero-layout">
          <Hero />
          
          <InputPanel
            url={url}
            setUrl={setUrl}
            onSubmit={handleSubmit}
            isAnalyzing={isAnalyzing || isGenerating}
            quota={quota}
            geminiKey={geminiKey}
            setGeminiKey={setGeminiKey}
          />
        </section>

        {error && !isAnalyzing && !isGenerating && (
          <div style={{
            maxWidth: '620px',
            margin: '0 auto 24px',
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.04)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            fontSize: '12.5px',
            lineHeight: '1.4'
          }}>
            {error}
          </div>
        )}

        {/* Dynamic content workspace panel */}
        <AnimatePresence mode="wait">
          {(isAnalyzing || isGenerating) ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="result"
              id="result"
            >
              <div className="done-meta" style={{ borderBottom: 'none' }}>
                <div className="done-meta-name">
                  <div className="progress-spinner-dot"></div>
                  <span>Analyzing visual DNA... DECODING {url.toUpperCase()}...</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  ELAPSED: {formatElapsed(elapsed)}
                </div>
              </div>
              
              <div className="studio-workspace-panel" style={{ paddingTop: 0 }}>
                <div className="progress-scanner-overlay">
                  <div className="progress-scanner-bar">
                    <div className="progress-scanner-fill" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                  
                  <div className="progress-logs-terminal">
                    {loadingSteps.map((step, idx) => {
                      const isActive = currentPhase === idx;
                      const isCompleted = currentPhase > idx;
                      
                      return (
                        <div key={idx} className={`progress-log-line ${isActive ? 'active' : isCompleted ? 'completed' : ''}`}>
                          <span className="log-bullet">
                            {isCompleted ? "✓" : isActive ? "🛰️" : "◦"}
                          </span>
                          <span>{step}</span>
                          {isActive && <span style={{fontSize: '9px', color: 'var(--text-muted)', marginLeft: '6px'}}>(running...)</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            tokens && markdown && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <Dashboard
                  liveSpecRef={liveSpecRef}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  tokens={tokens}
                  markdown={markdown}
                  classicMarkdown={classicMarkdown}
                  onReset={handleReset}
                  showToast={triggerToast}
                  geminiKey={geminiKey}
                  theme={theme}
                  setTheme={setTheme}
                  specViewType={specViewType}
                  setSpecViewType={setSpecViewType}
                  specFormat={specFormat}
                  setSpecFormat={setSpecFormat}
                  selectedBenchmarkIdx={selectedBenchmarkIdx}
                  setSelectedBenchmarkIdx={setSelectedBenchmarkIdx}
                  prompt={prompt}
                  setPrompt={setPrompt}
                  isGeneratingPrompt={isGeneratingPrompt}
                  setIsGeneratingPrompt={setIsGeneratingPrompt}
                  promptGeneratingPhase={promptGeneratingPhase}
                  setPromptGeneratingPhase={setPromptGeneratingPhase}
                />
              </motion.div>
            )
          )}
        </AnimatePresence>

        <section className="faq" id="faq">
          <div className="faq-head">
            <span className="kicker">FAQ</span>
            <h2 className="faq-h2">Design Intelligence System Details</h2>
            <p className="faq-sub">How our parsing engine measures visual specs, structures custom variables, and builds dev prompts.</p>
          </div>
          <div className="faq-list">
            <details className="faq-item" open>
              <summary>What is a Space Intelligence specification?</summary>
              <div className="faq-a">A highly precise design tokens specification computed dynamically from active CSS/DOM layouts. It maps branding hues, responsive bounds, rounded scales, and computed spacing charts cleanly.</div>
            </details>
            <details className="faq-item">
              <summary>How does the Puppeteer extractor function?</summary>
              <div className="faq-a">The analyzer runs a headless chromium instance in the cloud, navigates to the input URL, compiles loaded stylesheet media matrices, and parses variables using standard browser layout trees.</div>
            </details>
            <details className="faq-item">
              <summary>How is prompt blueprinting compiled?</summary>
              <div className="faq-a">Our system parses the reverse-engineered layout tree programmatically, matching elements to spacing grids and typography scales. By entering an optional Gemini Key, the engine applies customized heuristics to compile highly bespoke Tailwind code directives.</div>
            </details>
          </div>
        </section>
      </motion.main>

      <footer className="f">
        <p className="f-tagline">Style Gen: Space Intelligence System.</p>
        <div className="f-row">
          <span>Obsidian Observatory Console</span>
          <span aria-hidden="true">·</span>
          <a href="#faq">Docs</a>
          <span aria-hidden="true">·</span>
          <span>v3.0.0</span>
        </div>
      </footer>

      {/* Toasts */}
      <div className={`toast ${showToast ? 'show' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </>
  );
}
