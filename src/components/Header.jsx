import React from 'react';

export default function Header({ onNavClick }) {
  return (
    <header className="h">
      <div className="h-inner">
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <span className="brand-mark">S</span>
          <span>Style Gen</span>
          <span className="brand-title-lab">Observatory</span>
        </a>
        <nav className="h-actions" aria-label="Primary">
          {onNavClick ? (
            <>
              <button type="button" className="h-nav-tab-link" onClick={() => onNavClick('live-spec')}>Live Spec</button>
              <button type="button" className="h-nav-tab-link" onClick={() => onNavClick('dev-prompt')}>Dev Prompt</button>
              <button type="button" className="h-nav-tab-link" onClick={() => onNavClick('token-inspector')}>Token Inspector</button>
              <button type="button" className="h-nav-tab-link" onClick={() => onNavClick('export')}>Export</button>
            </>
          ) : (
            <>
              <a href="#result">Live Spec</a>
              <a href="#result">Dev Prompt</a>
              <a href="#result">Token Inspector</a>
              <a href="#result">Export</a>
            </>
          )}
          <a href="#faq">Docs</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
      </div>
    </header>
  );
}
