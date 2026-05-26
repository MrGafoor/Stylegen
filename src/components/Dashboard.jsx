import React, { useState } from 'react';
import { marked } from 'marked';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard({
  liveSpecRef,
  activeTab,
  setActiveTab,
  tokens,
  markdown,
  classicMarkdown,
  onReset,
  showToast,
  geminiKey,
  theme,
  setTheme,
  specViewType,
  setSpecViewType,
  specFormat,
  setSpecFormat,
  selectedBenchmarkIdx,
  setSelectedBenchmarkIdx,
  prompt,
  setPrompt,
  isGeneratingPrompt,
  setIsGeneratingPrompt,
  promptGeneratingPhase,
  setPromptGeneratingPhase
}) {

  const BENCHMARKS = [
    {
      name: 'Linear App',
      description: 'Elegantly dark product management tool. Sleek obsidian dark mode with subtle amethyst and cool steel colors.',
      primary: '#5E6AD2',
      secondary: '#B4BCD0',
      background: '#0B0B0F',
      neutrals: ['#0B0B0F', '#191924', '#2E2E3E', '#B4BCD0'],
      features: ['Obsidian space canvases with deep grays', 'Delicate glowing amethyst brand accents', 'Super-clean hairline border dividers']
    },
    {
      name: 'Stripe Connect',
      description: 'The global standard for fintech developer interfaces. Clean slate panels with electric blue and emerald highlights.',
      primary: '#635BFF',
      secondary: '#00D4B2',
      background: '#0A2540',
      neutrals: ['#0A2540', '#425466', '#7A90A8', '#F6F9FC'],
      features: ['High-voltage Indigo primary CTA buttons', 'Ultra-clean gray/slate text contrast scales', 'Vibrant semantic teal outlines and badges']
    },
    {
      name: 'Apple iOS',
      description: 'Minimalist stark corporate system. High-density monochrome elements, thin rules, and subtle off-white backdrops.',
      primary: '#000000',
      secondary: '#86868B',
      background: '#F5F5F7',
      neutrals: ['#1D1D1F', '#333336', '#86868B', '#F5F5F7'],
      features: ['Stark pure black buttons and primary targets', 'Ultra-thin subtle visual border constraints', 'Highly consistent cool gray surfaces']
    },
    {
      name: 'Vercel Core',
      description: 'Stark black-and-white theme for cloud products. Minimalist pitch-black panels with clean high-contrast geometric rules.',
      primary: '#000000',
      secondary: '#0070F3',
      background: '#000000',
      neutrals: ['#000000', '#111111', '#333333', '#888888'],
      features: ['Monochromatic pitch-black canvas areas', 'Vibrant blue focus rings and active states', 'Clean, sharp, high-contrast borders']
    }
  ];

  const selectedBenchmark = BENCHMARKS[selectedBenchmarkIdx];

  const host = new URL(tokens.siteUrl).hostname.replace(/^www\./, '');
  const hostSlug = host.replace(/\./g, '-');
  const filename = `${hostSlug}-Stylegen`;

  const handleCopyBenchmarkCss = async (benchmark) => {
    const css = `:root {
  --bg: ${benchmark.background};
  --primary: ${benchmark.primary};
  --secondary: ${benchmark.secondary};
  --border: ${benchmark.neutrals[1]};
  --fg: ${benchmark.neutrals[3] || '#ffffff'};
}`;
    try {
      await navigator.clipboard.writeText(css);
      showToast(`${benchmark.name} CSS variables copied`);
    } catch (_) {
      showToast('Copy failed — try again');
    }
  };

  const handleGeneratePrompt = async () => {
    if (isGeneratingPrompt) return;
    setIsGeneratingPrompt(true);
    setPromptGeneratingPhase(0);
    setPrompt('');
    
    const phaseInterval = setInterval(() => {
      setPromptGeneratingPhase(p => (p < 3 ? p + 1 : p));
    }, 1100);

    try {
      const res = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tokens,
          sourceUrl: tokens.siteUrl,
          apiKey: geminiKey || undefined
        })
      });
      clearInterval(phaseInterval);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate prompt');
      }

      const data = await res.json();
      setPrompt(data.prompt);
      showToast('Developer prompt generated!');
    } catch (err) {
      clearInterval(phaseInterval);
      showToast(err.message || 'Generation failed — try again');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      showToast('Prompt copied to clipboard!');
    } catch (_) {
      showToast('Copy failed — try again');
    }
  };

  const handleDownloadPrompt = () => {
    if (!prompt) return;
    const blob = new Blob([prompt], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `developer-prompt-${hostSlug}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Prompt downloaded!');
  };

  const activeMarkdown = specFormat === 'enterprise' ? markdown : (classicMarkdown || markdown);

  const renderedHtml = marked.parse(
    activeMarkdown
      .replace(/---\s*\n[\s\S]*?\n---\s*(?:\n|$)/g, '')
      .replace(/\n*<!--\s*STYLEGEN_VALIDATOR_WARNINGS[\s\S]*?-->\s*$/, '')
  );

  const colors = tokens.colors || {};
  const typography = tokens.typography || [];
  const screenshots = tokens.screenshots || [];
  const screenshotBase64 = screenshots[0] || '';

  const handleCopySpec = async () => {
    let contentToCopy = activeMarkdown;
    let toastLabel = 'Markdown copied to clipboard';
    
    if (specViewType === 'json') {
      const cleanTokens = { ...tokens };
      delete cleanTokens.screenshots;
      contentToCopy = JSON.stringify(cleanTokens, null, 2);
      toastLabel = 'Tokens JSON copied to clipboard';
    }

    try {
      await navigator.clipboard.writeText(contentToCopy);
      showToast(toastLabel);
    } catch (_) {
      showToast('Copy failed — try again');
    }
  };

  const handleDownloadSpec = () => {
    let content = activeMarkdown;
    let mime = 'text/markdown';
    let file = filename;

    if (specViewType === 'json') {
      const cleanTokens = { ...tokens };
      delete cleanTokens.screenshots;
      content = JSON.stringify(cleanTokens, null, 2);
      mime = 'application/json';
      file = `design-tokens-${hostSlug}.json`;
    }

    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyColor = async (hex) => {
    try {
      await navigator.clipboard.writeText(hex.toUpperCase());
      showToast(`Color ${hex.toUpperCase()} copied`);
    } catch (_) {}
  };

  const panelVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 }
  };

  const generateTailwindConfig = () => {
    if (!tokens) return '';
    const primary = tokens.colors?.primary?.[0]?.hex || tokens.cssVariables?.['--primary'] || '#635BFF';
    const background = tokens.cssVariables?.['--bg'] || tokens.colors?.neutral?.[0]?.hex || '#ffffff';
    const surface = tokens.cssVariables?.['--surface'] || tokens.colors?.neutral?.[1]?.hex || '#f3f4f6';
    const text = tokens.cssVariables?.['--fg'] || tokens.colors?.neutral?.[3]?.hex || '#111111';
    const font = tokens.typography?.[0]?.family || 'Inter';

    return `module.exports = {
  theme: {
    extend: {
      colors: {
        primary: "${primary}",
        background: "${background}",
        surface: "${surface}",
        text: "${text}",
      },
      fontFamily: {
        sans: ["${font}", "sans-serif"],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
      }
    }
  }
}`;
  };

  const generateCSSVariables = () => {
    if (!tokens) return '';
    const primary = tokens.colors?.primary?.[0]?.hex || tokens.cssVariables?.['--primary'] || '#635BFF';
    const background = tokens.cssVariables?.['--bg'] || tokens.colors?.neutral?.[0]?.hex || '#ffffff';
    const surface = tokens.cssVariables?.['--surface'] || tokens.colors?.neutral?.[1]?.hex || '#f3f4f6';
    const text = tokens.cssVariables?.['--fg'] || tokens.colors?.neutral?.[3]?.hex || '#111111';
    const font = tokens.typography?.[0]?.family || 'Inter';

    return `:root {
  --primary: ${primary};
  --background: ${background};
  --surface: ${surface};
  --text: ${text};
  --font-sans: "${font}", sans-serif;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}`;
  };

  const generateJSONTokens = () => {
    if (!tokens) return '';
    const primary = tokens.colors?.primary?.[0]?.hex || tokens.cssVariables?.['--primary'] || '#635BFF';
    const background = tokens.cssVariables?.['--bg'] || tokens.colors?.neutral?.[0]?.hex || '#ffffff';
    const surface = tokens.cssVariables?.['--surface'] || tokens.colors?.neutral?.[1]?.hex || '#f3f4f6';
    const text = tokens.cssVariables?.['--fg'] || tokens.colors?.neutral?.[3]?.hex || '#111111';
    const font = tokens.typography?.[0]?.family || 'Inter';

    const data = {
      colors: {
        primary,
        background,
        surface,
        text,
      },
      typography: {
        fontFamily: font,
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
      }
    };
    return JSON.stringify(data, null, 2);
  };

  const getSafeHost = (urlStr) => {
    try {
      let formatted = urlStr || 'https://example.com';
      if (!/^https?:\/\//i.test(formatted)) {
        formatted = 'https://' + formatted;
      }
      return new URL(formatted).hostname.replace(/^www\./, '');
    } catch (_) {
      return 'example.com';
    }
  };

  const generateProgrammaticPrompt = () => {
    if (!tokens) return '';
    const host = getSafeHost(tokens.siteUrl);
    const colors = tokens.colors || {};
    const typography = tokens.typography || [];
    
    const primary = colors.primary?.[0]?.hex || '#097fe8';
    const primaryActive = colors.primary?.[1]?.hex || '#005bab';
    const textAccent = colors.primary?.[2]?.hex || colors.primary?.[0]?.hex || '#0075de';
    const background = colors.neutral?.[0]?.hex || '#ffffff';
    const surface = colors.neutral?.[1]?.hex || '#f6f5f4';
    const surfaceMuted = colors.neutral?.[2]?.hex || '#f0efed';
    
    const isDarkBg = background === '#000000' || background === '#000' || background === '#0b0b0f' || background === '#0a2540' || background === '#0e0d0b';
    
    const textPrimary = isDarkBg ? '#ffffff' : '#000000';
    const textMuted = colors.neutral?.[3]?.hex || (isDarkBg ? '#a999c7' : '#615d59');
    const textSubtle = colors.neutral?.[4]?.hex || (isDarkBg ? '#8b847a' : '#a39e98');
    const border = colors.neutral?.[5]?.hex || (isDarkBg ? '#2e2e3e' : '#dfdcd9');
    const darkSurface = isDarkBg ? '#050308' : '#02093a';

    const mainFont = typography?.[0]?.family || 'Inter';
    const displaySize = typography?.[0]?.sizes?.find(s => s.label.includes('H1'))?.value || '54px';
    const displayWeight = typography?.[0]?.sizes?.find(s => s.label.includes('H1'))?.weight || '600';
    const displayLh = typography?.[0]?.sizes?.find(s => s.label.includes('H1'))?.lineHeight || '1.2';
    
    const headingSize = typography?.[0]?.sizes?.find(s => s.label.includes('H2'))?.value || '40px';
    const headingWeight = typography?.[0]?.sizes?.find(s => s.label.includes('H2'))?.weight || '600';
    const headingLh = typography?.[0]?.sizes?.find(s => s.label.includes('H2'))?.lineHeight || '1.2';
    
    const bodySize = typography?.[0]?.sizes?.find(s => s.label.includes('Body'))?.value || '16px';
    const bodyWeight = typography?.[0]?.sizes?.find(s => s.label.includes('Body'))?.weight || '400';
    const bodyLh = typography?.[0]?.sizes?.find(s => s.label.includes('Body'))?.lineHeight || '1.5';
    
    const hostName = host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);

    let visualStyle = `${hostName} has a sleek dark visual design system. It uses high-contrast accents overlaying dark backdrop panels, providing a high-tech premium feel.`;
    if (!isDarkBg) {
      visualStyle = `${hostName} features a bright, clean, minimalist design style. It leverages ample white space, refined light-gray containers, and a high-density, sharp typographic hierarchy.`;
    }

    const baseSpacing = tokens.cssVariables?.['--spacing-base'] || '4px';
    const radiusSm = tokens.cssVariables?.['--radius-sm'] || '4px';
    const radiusMd = tokens.cssVariables?.['--radius-md'] || '8px';
    const radiusLg = tokens.cssVariables?.['--radius-lg'] || '12px';

    return `Create a React + Tailwind application that replicates the visual aesthetic, components, and layout of ${hostName} (${tokens.siteUrl || 'extracted website'}).

The application must adhere to the following strict design systems specifications:

### 1. Design Style
- **Visual Personality**: ${visualStyle}
- **Radii Hierarchy**: Extra small items use rounded-[${radiusSm}], standard buttons/cards use rounded-[${radiusMd}], and prominent sections use rounded-[${radiusLg}].
- **Aesthetic Vibe**: Ultra-premium, state-of-the-art interface with clean borders, cohesive colors, and subtle micro-animations.

### 2. Color System
Customize your Tailwind config or write arbitrary classes to match these colors perfectly:
- **Primary Color**: \`${primary}\` (Used for main actions, active navigation states, and branding accents)
- **Primary Hover/Active**: \`${primaryActive}\` (Used for button hover/active states)
- **Text Accent**: \`${textAccent}\` (Used for highlighted inline links, secondary icons, and emphasis text)
- **Background (Canvas)**: \`${background}\` (Main background of the page)
- **Surface Panels**: \`${surface}\` (Secondary cards, section layers, and elevated areas)
- **Surface Muted**: \`${surfaceMuted}\` (Sidebar background, dropdown containers, or inactive tags)
- **Text Primary**: \`${textPrimary}\` (High-contrast text for headings and main body paragraphs)
- **Text Muted**: \`${textMuted}\` (Secondary text for descriptions, lists, and metadata)
- **Text Subtle**: \`${textSubtle}\` (Placeholders, disabled elements, and footer captions)
- **Borders & Dividers**: \`${border}\` (Faint outline rules for cards, header dividers, and text fields)
- **Dark Surface Accent**: \`${darkSurface}\` (Used for hero banners or immersive dark CTA blocks)

### 3. Typography
Configure Tailwind fonts to match:
- **Font Family**: Primary font family is \`${mainFont}\` with standard system fallbacks (\`system-ui, -apple-system, sans-serif\`).
- **Heading Scale**:
  - **Display (H1)**: Font size \`${displaySize}\`, weight \`${displayWeight}\`, line-height \`${displayLh}\`.
  - **Heading (H2)**: Font size \`${headingSize}\`, weight \`${headingWeight}\`, line-height \`${headingLh}\`.
- **Body Text**: Size \`${bodySize}\`, weight \`${bodyWeight}\`, line-height \`${bodyLh}\`.

### 4. Layout & Spacing
- **Base Spacing**: Built on a \`${baseSpacing}\` grid. Use precise spacing values (e.g. \`gap-4\`, \`p-6\`, \`my-8\`).
- **Container Sizes**: Content should be centered inside a \`max-w-6xl\` or \`max-w-7xl\` container with horizontal padding.
- **Responsive Behavior**: 
  - Grids collapse to single columns on small viewports (\`< 768px\`).
  - Navigation links collapse into an accessible hamburger menu on mobile.
  - Section paddings reduce by ~20% on mobile.

### 5. Components
Build the following reusable components styled with our design tokens:
- **Navbar**: Clean sticky top bar with logo (\`${primary}\`), nav items with subtle bottom border on hover, a "Sign In" CTA, and a responsive mobile toggle drawer.
- **Hero Section**: Prominent section over \`${darkSurface}\` featuring a massive H1 Display heading, high-contrast subtext, a main primary CTA button (\`${primary}\`), and an outline CTA button (\`${primaryActive}\`).
- **Feature Grid Cards**: Rounded cards using \`${surface}\` with border of \`${border}\`, deep elegant shadows, containing feature icons, H2 headings, and short description text.
- **Interactive Forms**: A mock newsletter input field and newsletter box. Inputs must have background \`${background}\`, border \`${border}\`, and focus transition ring.
- **Footer**: Responsive 4-column layout including company profile, product list, legal docs, social icons, and copyright text using \`${textSubtle}\`.

### 6. Interactions & Hover States
- **Button States**: Transition speed \`duration-200\` using \`ease-out\`. Primary buttons should bright-shift on hover (\`hover:brightness-110\`) and translate slightly upwards on active hover (\`hover:-translate-y-0.5\`).
- **Focus Rings**: Standard inputs should show a focus border of \`${primary}\` and a focus shadow ring of \`rgba(35,131,226,0.2)\`.
- **Card Hover**: Card components should smooth-shift upwards (\`group-hover:-translate-y-1 group-hover:shadow-lg\`).

### 7. Core Requirements
- **Responsive**: Native mobile responsiveness.
- **Clean Structure**: Modular code with reusable UI elements.
- **Accessibility**: Correct semantic tags (\`<header>\`, \`<main>\`, \`<footer>\`, \`<button>\`) with \`aria-label\` attributes.
- **Modern UX**: Sleek micro-interactions, clean alignment, and professional layout.`;
  };

  const handleCopyText = async (text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(label);
    } catch (_) {
      showToast('Copy failed — try again');
    }
  };

  const handleDownloadFile = (text, filename, mime) => {
    if (!text) return;
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`${filename} downloaded!`);
  };

  return (
    <section ref={liveSpecRef} className="result" id="result">
      {/* Done Meta Panel */}
      <div className="done-meta">
        <div className="done-meta-name">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--accent-primary)'}}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>SPECS COMPLETED FOR </span>
          <span className="done-meta-source">{host}</span>
        </div>
        <button type="button" className="done-meta-action" onClick={onReset}>
          <span>Analyze New URL</span>
          <span className="arr">→</span>
        </button>
      </div>

      {/* Tabs Menu Navigation Bar (Single Unified Navigation Section) */}
      <div className="studio-tabs-bar">
        <div className="studio-tabs-list">
          <button
            type="button"
            className={`studio-tab-btn ${activeTab === 'live-spec' ? 'active' : ''}`}
            onClick={() => setActiveTab('live-spec')}
          >
            <span>🔭</span>
            <span>Live Spec</span>
          </button>
          <button
            type="button"
            className={`studio-tab-btn ${activeTab === 'dev-prompt' ? 'active' : ''}`}
            onClick={() => setActiveTab('dev-prompt')}
          >
            <span>🚀</span>
            <span>Dev Prompt</span>
          </button>
          <button
            type="button"
            className={`studio-tab-btn ${activeTab === 'token-inspector' ? 'active' : ''}`}
            onClick={() => setActiveTab('token-inspector')}
          >
            <span>🔍</span>
            <span>Token Inspector</span>
          </button>
          <button
            type="button"
            className={`studio-tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <span>📦</span>
            <span>Export</span>
          </button>
        </div>
        
        <div className="studio-tabs-links">
          <a href="#faq">Docs</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label="Toggle theme"
            title="Switch theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>

      {/* Active Panel Viewport with slide transition animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="studio-workspace-panel"
        >
          
          {/* PANEL 1: DEVELOPER PROMPT */}
          {activeTab === 'dev-prompt' && (
            <div className="prompt-pane-layout">
              <div className="pane-header-title">
                <span>🚀</span>
                <h3>High-Fidelity Prompt Blueprint</h3>
              </div>
              
              <p className="prompt-intro">
                Synthesize extracted style rules, spatial dimensions, and custom variables into a single, high-fidelity React + Tailwind instruction set ready for Cursor, Claude Code, or ChatGPT.
              </p>

              <div className="prompt-workspace" style={{marginTop: '8px'}}>
                {!prompt && !isGeneratingPrompt && (
                  <div className="prompt-cta-card">
                    <div className="glow-brand-mark">🛰️</div>
                    <h4>Transform Extracted Style DNA</h4>
                    <p style={{fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '440px'}}>
                      Compile parsed palettes, spacing constraints, typography grids, component rules, and visual styles into an optimized, copy-pasteable context directive.
                    </p>
                    <button 
                      type="button" 
                      className="btn-compile-prompt" 
                      onClick={handleGeneratePrompt}
                    >
                      <span>Generate Developer Prompt</span>
                      <span className="arrow">→</span>
                    </button>
                  </div>
                )}

                {isGeneratingPrompt && (
                  <div className="prompt-loading-card">
                    <div className="dna-loader">
                      <span className="dna-bar"></span>
                      <span className="dna-bar"></span>
                      <span className="dna-bar"></span>
                      <span className="dna-bar"></span>
                    </div>
                    <div className="prompt-loading-status">
                      {promptGeneratingPhase === 0 && "Decoding primary & neutral branding scales..."}
                      {promptGeneratingPhase === 1 && "Synthesizing typographic scales and CSS values..."}
                      {promptGeneratingPhase === 2 && "Formulating interactive hover and animation rules..."}
                      {promptGeneratingPhase === 3 && "Assembling final Tailwind + React blueprint code..."}
                    </div>
                    <div className="prompt-loading-hint">Generating custom instructions using {geminiKey ? "Gemini 1.5 Flash Model" : "Style Gen Compiler Engine"}...</div>
                  </div>
                )}

                {prompt && !isGeneratingPrompt && (
                  <div className="prompt-terminal">
                    <div className="terminal-header">
                      <div className="terminal-dots">
                        <span className="term-dot dot-r"></span>
                        <span className="term-dot dot-y"></span>
                        <span className="term-dot dot-g"></span>
                      </div>
                      <span className="terminal-title">developer-prompt-{hostSlug}.txt</span>
                      <div className="terminal-actions">
                        <button type="button" className="term-action-btn" onClick={handleCopyPrompt}>
                          <span>⧉</span> Copy Prompt
                        </button>
                        <button type="button" className="term-action-btn" onClick={handleDownloadPrompt}>
                          <span>↓</span> Export
                        </button>
                        <button type="button" className="term-action-btn term-reset-btn" onClick={handleGeneratePrompt}>
                          <span>⟳</span> Recompile
                        </button>
                      </div>
                    </div>
                    <div className="terminal-body">
                      <pre>
                        <code>{prompt}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PANEL 2: LIVE SPEC */}
          {activeTab === 'live-spec' && (
            <div className="spec-pane">
              <div className="pane-header-title">
                <span>🔭</span>
                <h3>Design Specification Document</h3>
              </div>
              
              <div className="spec-split-grid">
                {/* Left Column: Markdown spec */}
                <div className="spec-content-doc">
                  <div className="spec-toolbar">
                    <div className="spec-format-pills">
                      <button
                        type="button"
                        className={`spec-format-pill ${specViewType === 'preview' ? 'active' : ''}`}
                        onClick={() => setSpecViewType('preview')}
                      >
                        Preview Spec
                      </button>
                      <button
                        type="button"
                        className={`spec-format-pill ${specViewType === 'raw' ? 'active' : ''}`}
                        onClick={() => setSpecViewType('raw')}
                      >
                        Markdown Source
                      </button>
                      <button
                        type="button"
                        className={`spec-format-pill ${specViewType === 'json' ? 'active' : ''}`}
                        onClick={() => setSpecViewType('json')}
                      >
                        Tokens JSON
                      </button>
                    </div>

                    {specViewType !== 'json' && (
                      <div className="spec-format-pills">
                        <button 
                          type="button" 
                          className={`spec-format-pill ${specFormat === 'enterprise' ? 'active' : ''}`}
                          onClick={() => setSpecFormat('enterprise')}
                        >
                          Enterprise
                        </button>
                        <button 
                          type="button" 
                          className={`spec-format-pill ${specFormat === 'classic' ? 'active' : ''}`}
                          onClick={() => setSpecFormat('classic')}
                        >
                          Classic
                        </button>
                      </div>
                    )}

                    <div className="spec-action-group">
                      <button className="btn-spec-action" type="button" onClick={handleCopySpec}>
                        <span>Copy</span>
                      </button>
                      <button className="btn-spec-action primary" type="button" onClick={handleDownloadSpec}>
                        <span>Download</span>
                      </button>
                    </div>
                  </div>

                  <div className="spec-viewport">
                    {specViewType === 'preview' && (
                      <div 
                        className="spec-render-viewport" 
                        dangerouslySetInnerHTML={{ __html: renderedHtml }}
                      />
                    )}

                    {specViewType === 'raw' && (
                      <pre className="spec-raw-pre">
                        <code>{activeMarkdown}</code>
                      </pre>
                    )}

                    {specViewType === 'json' && (
                      <pre className="spec-raw-pre">
                        <code>
                          {JSON.stringify(
                            (() => {
                              const clean = { ...tokens };
                              delete clean.screenshots;
                              return clean;
                            })(),
                            null,
                            2
                          )}
                        </code>
                      </pre>
                    )}
                  </div>
                </div>

                {/* Right Column: Comparative Presets */}
                <div className="spec-benchmarks-aside">
                  <span className="benchmarks-aside-title">DESIGN BENCHMARKS</span>
                  {BENCHMARKS.map((bench, idx) => (
                    <motion.div
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                      className={`bench-card ${selectedBenchmarkIdx === idx ? 'active' : ''}`}
                      onClick={() => setSelectedBenchmarkIdx(idx)}
                    >
                      <div className="bench-card-meta">
                        <span className="bench-card-name">{bench.name}</span>
                        <span className="bench-card-bullet"></span>
                      </div>
                      <p className="bench-card-desc">{bench.description}</p>
                      <div className="bench-card-colors">
                        <span className="bench-color-dot" style={{ backgroundColor: bench.primary }} title="Primary"></span>
                        <span className="bench-color-dot" style={{ backgroundColor: bench.secondary }} title="Secondary"></span>
                        <span className="bench-color-dot" style={{ backgroundColor: bench.background }} title="Background"></span>
                        {bench.neutrals.slice(1, 3).map((n, i) => (
                          <span key={i} className="bench-color-dot" style={{ backgroundColor: n }} title={`Neutral ${i+1}`}></span>
                        ))}
                      </div>
                    </motion.div>
                  ))}

                  {/* comparator details */}
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                    className="bench-card active" 
                    style={{ marginTop: '8px', borderColor: 'var(--border)' }}
                  >
                    <div className="bench-card-meta">
                      <span className="bench-card-name" style={{color: 'var(--accent-highlight)'}}>Ref Comparator Check</span>
                    </div>
                    <p className="bench-card-desc">Compare primary accent to selected benchmark system:</p>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '10px', paddingBottom: '3px', borderBottom: '1px solid var(--border)'}}>
                        <span style={{color: 'var(--text-secondary)'}}>Extracted:</span>
                        <span style={{fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)'}}>{(colors.primary?.[0]?.hex || '#3B82F6').toUpperCase()}</span>
                      </div>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '10px'}}>
                        <span style={{color: 'var(--text-secondary)'}}>{selectedBenchmark.name}:</span>
                        <span style={{fontFamily: 'var(--font-mono)', fontWeight: 600, color: selectedBenchmark.primary}}>{selectedBenchmark.primary.toUpperCase()}</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          )}

          {/* PANEL 3: TOKEN INSPECTOR */}
          {activeTab === 'token-inspector' && (
            <div className="tokens-pane-layout">
              <div className="pane-header-title">
                <span>🔍</span>
                <h3>Design Token Inspector</h3>
              </div>
              
              <p className="tokens-intro">
                Inspect structured variable palettes, typography scales, and baseline system properties reverse-engineered from stylesheet hierarchies.
              </p>

              <div className="tokens-grid-layout" style={{marginTop: '8px'}}>
                {/* Left Column: Visual assets */}
                <div className="tokens-visuals">
                  {screenshotBase64 && (
                    <motion.div 
                      whileHover={{ scale: 1.01 }}
                      transition={{ duration: 0.25 }}
                      className="card"
                    >
                      <div className="card-head">
                        <span className="cam">📸</span>
                        <span className="head-title">Screenshot Capture Map</span>
                        <span className="head-sub">— {host}</span>
                      </div>
                      <div className="carousel">
                        <div className="carousel-meta">
                          <span>ABOVE-THE-FOLD VIEWPORT</span>
                        </div>
                        <div className="carousel-stage">
                          <img
                            src={`data:image/jpeg;base64,${screenshotBase64}`}
                            alt={`${host} snapshot`}
                            loading="lazy"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {typography && typography.length > 0 && (
                    <div className="card">
                      <div className="card-head">
                        <span className="head-title">Extracted Typography Scale</span>
                      </div>
                      <div className="card-body" style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                        {typography.map((f, idx) => (
                          <div key={idx} className="type-fam">
                            <div className="type-fam-name">{f.family}</div>
                            <div className="type-table">
                              <div className="th">Role</div>
                              <div className="th">Size</div>
                              <div className="th">Weight</div>
                              <div className="th">LH</div>
                              {f.sizes.map((s, sIdx) => (
                                <React.Fragment key={sIdx}>
                                  <div className="td">{s.label}</div>
                                  <div className="td">{s.value}</div>
                                  <div className="td">{s.weight}</div>
                                  <div className="td">{s.lineHeight}</div>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Palette swatches */}
                <div className="tokens-palette-col">
                  <div className="card">
                    <div className="card-head">
                      <span className="head-title">Reverse-Engineered Swatches</span>
                    </div>
                    <div className="card-body">
                      {colors.primary && colors.primary.length > 0 && (
                        <div className="color-group">
                          <span className="group-label">Primary Brand Accent</span>
                          <div className="swatches">
                            {colors.primary.slice(0, 8).map((c, i) => (
                              <motion.div 
                                key={i} 
                                whileHover={{ scale: 1.02 }}
                                transition={{ duration: 0.15 }}
                                className="swatch-wrapper"
                                onClick={() => handleCopyColor(c.hex)}
                                title="Click to copy hex code"
                              >
                                <span className="sw-chip" style={{ backgroundColor: c.hex }}></span>
                                <span className="sw-hex">{c.hex.toUpperCase()}</span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      {colors.neutral && colors.neutral.length > 0 && (
                        <div className="color-group">
                          <span className="group-label">Neutral Contrast Scales</span>
                          <div className="swatches">
                            {colors.neutral.slice(0, 8).map((c, i) => (
                              <motion.div 
                                key={i} 
                                whileHover={{ scale: 1.02 }}
                                transition={{ duration: 0.15 }}
                                className="swatch-wrapper"
                                onClick={() => handleCopyColor(c.hex)}
                                title="Click to copy hex code"
                              >
                                <span className="sw-chip" style={{ backgroundColor: c.hex }}></span>
                                <span className="sw-hex">{c.hex.toUpperCase()}</span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      {colors.semantic && colors.semantic.length > 0 && (
                        <div className="color-group">
                          <span className="group-label">Semantic Signaling Channels</span>
                          <div className="swatches">
                            {colors.semantic.map((c, i) => (
                              <motion.div 
                                key={i} 
                                whileHover={{ scale: 1.02 }}
                                transition={{ duration: 0.15 }}
                                className="swatch-wrapper"
                                onClick={() => handleCopyColor(c.hex)}
                                title={`Click to copy hex (${c.type})`}
                              >
                                <span className="sw-chip" style={{ backgroundColor: c.hex }}></span>
                                <span className="sw-hex">{c.hex.toUpperCase()}</span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PANEL 4: EXPORT DESIGN SYSTEM */}
          {activeTab === 'export' && (
            <div className="export-pane-layout">
              <div className="pane-header-title">
                <span>📦</span>
                <h3>Export Design System</h3>
              </div>
              
              <p className="export-intro">
                Export reverse-engineered variables, tokens, and instructions in production-ready formats. Integrate custom visual DNA directly into your workflows.
              </p>

              <div className="export-grid-layout" style={{marginTop: '12px'}}>
                {/* Tailwind Config Card */}
                <div className="export-card">
                  <div className="export-card-header">
                    <span className="export-icon">💅</span>
                    <div className="export-meta">
                      <span className="export-title">Tailwind Config</span>
                      <span className="export-desc">Tailwind configuration theme extension</span>
                    </div>
                  </div>
                  <div className="code-preview-viewport">
                    <pre className="code-preview-pre">
                      <code>{generateTailwindConfig()}</code>
                    </pre>
                  </div>
                  <div className="export-card-actions">
                    <button 
                      className="btn-export-action" 
                      type="button" 
                      onClick={() => handleCopyText(generateTailwindConfig(), 'Tailwind config copied')}
                    >
                      Copy
                    </button>
                    <button 
                      className="btn-export-action primary" 
                      type="button" 
                      onClick={() => handleDownloadFile(generateTailwindConfig(), `tailwind.config-${hostSlug}.js`, 'application/javascript')}
                    >
                      Download
                    </button>
                  </div>
                </div>

                {/* CSS Variables Card */}
                <div className="export-card">
                  <div className="export-card-header">
                    <span className="export-icon">🎨</span>
                    <div className="export-meta">
                      <span className="export-title">CSS Variables</span>
                      <span className="export-desc">Custom properties defined for :root scope</span>
                    </div>
                  </div>
                  <div className="code-preview-viewport">
                    <pre className="code-preview-pre">
                      <code>{generateCSSVariables()}</code>
                    </pre>
                  </div>
                  <div className="export-card-actions">
                    <button 
                      className="btn-export-action" 
                      type="button" 
                      onClick={() => handleCopyText(generateCSSVariables(), 'CSS variables copied')}
                    >
                      Copy
                    </button>
                    <button 
                      className="btn-export-action primary" 
                      type="button" 
                      onClick={() => handleDownloadFile(generateCSSVariables(), `variables-${hostSlug}.css`, 'text/css')}
                    >
                      Download
                    </button>
                  </div>
                </div>

                {/* JSON Tokens Card */}
                <div className="export-card">
                  <div className="export-card-header">
                    <span className="export-icon">📦</span>
                    <div className="export-meta">
                      <span className="export-title">JSON Tokens</span>
                      <span className="export-desc">Extracted visual system raw tokens mapping</span>
                    </div>
                  </div>
                  <div className="code-preview-viewport">
                    <pre className="code-preview-pre">
                      <code>{generateJSONTokens()}</code>
                    </pre>
                  </div>
                  <div className="export-card-actions">
                    <button 
                      className="btn-export-action" 
                      type="button" 
                      onClick={() => handleCopyText(generateJSONTokens(), 'JSON tokens copied')}
                    >
                      Copy
                    </button>
                    <button 
                      className="btn-export-action primary" 
                      type="button" 
                      onClick={() => handleDownloadFile(generateJSONTokens(), `tokens-${hostSlug}.json`, 'application/json')}
                    >
                      Download
                    </button>
                  </div>
                </div>

                {/* Developer Prompt Card */}
                <div className="export-card">
                  <div className="export-card-header">
                    <span className="export-icon">🚀</span>
                    <div className="export-meta">
                      <span className="export-title">Developer Prompt</span>
                      <span className="export-desc">React + Tailwind high-fidelity instructions</span>
                    </div>
                  </div>
                  <div className="code-preview-viewport">
                    <pre className="code-preview-pre">
                      <code>{prompt || generateProgrammaticPrompt()}</code>
                    </pre>
                  </div>
                  <div className="export-card-actions">
                    <button 
                      className="btn-export-action" 
                      type="button" 
                      onClick={() => handleCopyText(prompt || generateProgrammaticPrompt(), 'Developer prompt copied')}
                    >
                      Copy
                    </button>
                    <button 
                      className="btn-export-action primary" 
                      type="button" 
                      onClick={() => handleDownloadFile(prompt || generateProgrammaticPrompt(), `dev-prompt-${hostSlug}.txt`, 'text/plain')}
                    >
                      Download
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </section>
  );
}
