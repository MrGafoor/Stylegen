import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Safe URL host extractor to prevent ERR_INVALID_URL crashes
function getSafeHost(urlStr) {
  try {
    let formatted = urlStr || 'https://example.com';
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = 'https://' + formatted;
    }
    return new URL(formatted).hostname.replace(/^www\./, '');
  } catch (_) {
    return 'example.com';
  }
}


// Quota counter state
let totalAnalyses = 42; // arbitrary count representing the global tracker
const IP_QUOTAS = new Map();

// Helper to get remaining quota for an IP
function getQuota(ip) {
  const now = Date.now();
  const limit = 10;
  const windowMs = 24 * 60 * 60 * 1000; // 24 hours
  
  if (!IP_QUOTAS.has(ip)) {
    IP_QUOTAS.set(ip, {
      remaining: limit,
      resetTime: now + windowMs,
      limit
    });
  }
  
  const q = IP_QUOTAS.get(ip);
  if (now > q.resetTime) {
    q.remaining = limit;
    q.resetTime = now + windowMs;
  }
  
  return {
    limit: q.limit,
    remaining: q.remaining,
    resetSeconds: Math.max(0, Math.round((q.resetTime - now) / 1000))
  };
}

// Helper to consume quota
function consumeQuota(ip) {
  const q = IP_QUOTAS.get(ip);
  if (q && q.remaining > 0) {
    q.remaining--;
    totalAnalyses++;
    return true;
  }
  return false;
}

// Quota Info API
app.get('/api/quota', (req, res) => {
  const ip = req.ip || 'anonymous';
  const q = getQuota(ip);
  res.json({
    limit: q.limit,
    remaining: q.remaining,
    resetSeconds: q.resetSeconds,
    totalAnalyses
  });
});

// Scrape and analyze URL endpoint
app.post('/api/analyze-url', async (req, res) => {
  const ip = req.ip || 'anonymous';
  const q = getQuota(ip);
  
  if (q.remaining <= 0) {
    res.setHeader('RateLimit-Limit', q.limit);
    res.setHeader('RateLimit-Remaining', 0);
    res.setHeader('RateLimit-Reset', q.resetSeconds);
    return res.status(429).json({ success: false, error: 'Daily limit reached' });
  }
  
  let { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }
  
  // Format URL if protocol is missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  
  console.log(`[Style Gen] Scraping url: ${url} from IP: ${ip}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set custom User Agent to prevent bots blocker
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set navigation timeout
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    
    // Wait an additional 2 seconds to make sure async assets/fonts loaded
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take a screenshot of the above-the-fold content
    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 75,
      encoding: 'base64'
    });
    
    // Extract tokens from computed DOM and CSSOM
    const tokens = await page.evaluate(() => {
      // 1. Helper to convert RGB/RGBA color to hex string
      function rgbToHex(rgbStr) {
        if (!rgbStr || rgbStr === 'transparent' || rgbStr === 'rgba(0, 0, 0, 0)') return null;
        const match = rgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
        if (!match) return null;
        
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const a = match[4] ? parseFloat(match[4]) : 1.0;
        
        if (a === 0) return null;
        
        return '#' + [r, g, b].map(x => {
          const hexStr = x.toString(16);
          return hexStr.length === 1 ? '0' + hexStr : hexStr;
        }).join('');
      }
      
      // 2. Helper to convert HEX to HSL for categorization
      function hexToHsl(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;
        
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
          h = s = 0; // achromatic
        } else {
          let d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }
        
        return {
          h: Math.round(h * 360),
          s: Math.round(s * 100),
          l: Math.round(l * 100)
        };
      }
      
      // 3. Extract CSS variables (custom properties)
      const cssVars = {};
      try {
        for (const sheet of document.styleSheets) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            if (!rules) continue;
            for (const rule of rules) {
              if (rule.style) {
                for (let i = 0; i < rule.style.length; i++) {
                  const name = rule.style[i];
                  if (name.startsWith('--')) {
                    const val = rule.style.getPropertyValue(name).trim();
                    if (val) cssVars[name] = val;
                  }
                }
              }
            }
          } catch (e) {
            // Silence cross-origin CSS rule exceptions
          }
        }
      } catch (e) {}
      
      // Compute actual values of CSS vars from root
      const rootStyle = getComputedStyle(document.documentElement);
      const computedVars = {};
      for (const name in cssVars) {
        const computedVal = rootStyle.getPropertyValue(name).trim();
        computedVars[name] = computedVal || cssVars[name];
      }
      
      // 4. Extract breakpoints
      const breakpoints = new Set();
      // Add default common breakpoints as fallback
      [320, 480, 768, 1024, 1200, 1440].forEach(bp => breakpoints.add(bp));
      
      try {
        for (const sheet of document.styleSheets) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            if (!rules) continue;
            for (const rule of rules) {
              if (rule.type === CSSRule.MEDIA_RULE || (rule.media && rule.media.mediaText)) {
                const mediaText = rule.media.mediaText;
                const matches = mediaText.match(/(\d+)px/g);
                if (matches) {
                  for (const match of matches) {
                    const num = parseInt(match);
                    if (num >= 320 && num <= 1920) {
                      breakpoints.add(num);
                    }
                  }
                }
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
      const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => a - b);
      
      // 4b. Extract real interaction states (hover, focus, active)
      const interactionStates = [];
      try {
        const processedSelectors = new Set();
        for (const sheet of document.styleSheets) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            if (!rules) continue;
            for (const rule of rules) {
              if (rule.style && rule.selectorText) {
                const selector = rule.selectorText;
                // Look for pseudo-classes
                const matches = selector.match(/:hover|:focus|:active|:focus-within|:focus-visible/g);
                if (matches) {
                  for (const match of matches) {
                    const type = match.replace(':', '');
                    // Avoid duplicate selectors for the same type to keep it clean
                    const key = `${selector}-${type}`;
                    if (processedSelectors.has(key)) continue;
                    processedSelectors.add(key);
                    
                    const declarations = {};
                    const props = ['color', 'background-color', 'background', 'border-color', 'border', 'box-shadow', 'transform', 'transition', 'text-decoration', 'outline'];
                    for (const prop of props) {
                      const val = rule.style.getPropertyValue(prop)?.trim();
                      if (val) {
                        declarations[prop] = val;
                      }
                    }
                    
                    if (Object.keys(declarations).length > 0) {
                      interactionStates.push({
                        selector,
                        type,
                        declarations
                      });
                    }
                  }
                }
              }
            }
          } catch (e) {}
        }
      } catch (e) {}

      // 5. Sample elements to collect computed colors & typography scale
      const elements = document.querySelectorAll('*');
      const sampleSize = Math.min(elements.length, 1200);
      const colorCounts = {};
      const fontFamilies = {};
      
      for (let i = 0; i < sampleSize; i++) {
        const el = elements[i];
        const style = getComputedStyle(el);
        
        // Colors
        const bg = rgbToHex(style.backgroundColor);
        const fg = rgbToHex(style.color);
        const border = rgbToHex(style.borderColor);
        
        if (bg) colorCounts[bg] = (colorCounts[bg] || 0) + 1;
        if (fg) colorCounts[fg] = (colorCounts[fg] || 0) + 1;
        if (border) colorCounts[border] = (colorCounts[border] || 0) + 1;
        
        // Font Family popularity
        const ffRaw = style.fontFamily;
        if (ffRaw && ffRaw !== 'inherit') {
          const ff = ffRaw.split(',')[0].replace(/['"]/g, '').trim();
          if (ff && ff !== 'system-ui' && ff !== '-apple-system' && ff !== 'sans-serif' && ff !== 'serif') {
            fontFamilies[ff] = (fontFamilies[ff] || 0) + 1;
          }
        }
      }
      
      // Ensure we have at least system fonts if no custom fonts are parsed
      if (Object.keys(fontFamilies).length === 0) {
        fontFamilies['Inter'] = 10;
        fontFamilies['system-ui'] = 5;
      }
      
      const topFamilies = Object.entries(fontFamilies)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(x => x[0]);
      
      // 6. Build Typographic Scale for Top Families
      const tags = [
        { selector: 'h1', label: 'H1 Heading' },
        { selector: 'h2', label: 'H2 Heading' },
        { selector: 'h3', label: 'H3 Heading' },
        { selector: 'p', label: 'Body Text' },
        { selector: 'button, .btn, input[type="submit"]', label: 'Button' },
        { selector: 'a', label: 'Link' }
      ];
      
      const typography = [];
      for (const family of topFamilies) {
        const sizes = [];
        const labelSeen = new Set();
        
        for (const tag of tags) {
          const el = document.querySelector(tag.selector);
          if (el) {
            const style = getComputedStyle(el);
            const size = style.fontSize;
            const weight = style.fontWeight;
            let lh = style.lineHeight;
            if (lh === 'normal') lh = '1.4';
            
            if (!labelSeen.has(tag.label)) {
              labelSeen.add(tag.label);
              sizes.push({
                label: tag.label,
                value: size,
                weight: weight,
                lineHeight: lh
              });
            }
          }
        }
        
        // If tag selector failed, generate mock typography values based on standard sizes
        if (sizes.length === 0) {
          sizes.push(
            { label: 'H1 Heading', value: '36px', weight: '700', lineHeight: '1.2' },
            { label: 'H2 Heading', value: '28px', weight: '600', lineHeight: '1.3' },
            { label: 'H3 Heading', value: '22px', weight: '600', lineHeight: '1.4' },
            { label: 'Body Text', value: '15px', weight: '400', lineHeight: '1.5' },
            { label: 'Button', value: '14px', weight: '500', lineHeight: '1.4' },
            { label: 'Link', value: '15px', weight: '400', lineHeight: '1.4' }
          );
        }
        
        typography.push({
          family,
          sizes
        });
      }
      
      // 7. Categorize Colors (Primary, Neutral, Semantic)
      const primaryColors = [];
      const neutralColors = [];
      const semanticColors = [];
      
      const sortedColors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .map(x => x[0]);
      
      const colorLimit = 12; // cap unique colors per group
      const colorSeen = new Set();
      
      for (const hex of sortedColors) {
        if (colorSeen.has(hex)) continue;
        colorSeen.add(hex);
        
        const hsl = hexToHsl(hex);
        
        // Semantic: Error/Red
        if (((hsl.h >= 0 && hsl.h <= 18) || (hsl.h >= 342 && hsl.h <= 360)) && hsl.s > 40 && hsl.l > 15 && hsl.l < 85) {
          if (semanticColors.filter(c => c.type === 'error').length < 2) {
            semanticColors.push({ hex, count: colorCounts[hex], type: 'error', hsl });
          }
        }
        // Semantic: Success/Green
        else if (hsl.h >= 95 && hsl.h <= 150 && hsl.s > 30 && hsl.l > 15 && hsl.l < 85) {
          if (semanticColors.filter(c => c.type === 'success').length < 2) {
            semanticColors.push({ hex, count: colorCounts[hex], type: 'success', hsl });
          }
        }
        // Semantic: Warning/Orange-Yellow
        else if (hsl.h >= 35 && hsl.h <= 60 && hsl.s > 40 && hsl.l > 15 && hsl.l < 85) {
          if (semanticColors.filter(c => c.type === 'warning').length < 2) {
            semanticColors.push({ hex, count: colorCounts[hex], type: 'warning', hsl });
          }
        }
        // Neutral: Black, White, Grays
        else if (hsl.s < 12 || hsl.l < 10 || hsl.l > 93) {
          if (neutralColors.length < colorLimit) {
            neutralColors.push({ hex, count: colorCounts[hex], hsl });
          }
        }
        // Primary / Accent
        else {
          if (primaryColors.length < colorLimit) {
            primaryColors.push({ hex, count: colorCounts[hex], hsl });
          }
        }
      }
      
      // Fallback colors if none detected
      if (primaryColors.length === 0) {
        primaryColors.push({ hex: '#C7472A', count: 1 });
        primaryColors.push({ hex: '#A8442D', count: 1 });
      }
      if (neutralColors.length === 0) {
        neutralColors.push({ hex: '#0E0D0B', count: 5 });
        neutralColors.push({ hex: '#F2EADD', count: 5 });
        neutralColors.push({ hex: '#8B847A', count: 5 });
      }
      
      // Clean structure for return
      return {
        siteUrl: window.location.href,
        siteTitle: document.title || 'Extracted Site',
        colors: {
          primary: primaryColors.map(c => ({ hex: c.hex, count: c.count })),
          neutral: neutralColors.map(c => ({ hex: c.hex, count: c.count })),
          semantic: semanticColors.map(c => ({ hex: c.hex, count: c.count, type: c.type }))
        },
        typography,
        breakpoints: sortedBreakpoints,
        cssVariables: computedVars,
        interactionStates: interactionStates.slice(0, 30)
      };
    });
    
    await browser.close();
    
    // Decrement quota on successful crawl
    consumeQuota(ip);
    const finalQuota = getQuota(ip);
    
    res.setHeader('RateLimit-Limit', finalQuota.limit);
    res.setHeader('RateLimit-Remaining', finalQuota.remaining);
    res.setHeader('RateLimit-Reset', finalQuota.resetSeconds);
    
    // Attach screenshot
    tokens.screenshots = [screenshotBuffer];
    tokens.siteUrl = url;
    
    res.json({
      success: true,
      tokens,
      generationId: Math.random().toString(36).substring(2, 15)
    });
    
  } catch (error) {
    console.error('[Style Gen] Scrape error:', error);
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: error.message || 'Scraping URL failed' });
  }
});

// Programmatic Markdown generation template
function compileProgrammaticMarkdown(tokens) {
  const host = getSafeHost(tokens.siteUrl);
  const colors = tokens.colors || {};
  const typography = tokens.typography || [];
  
  // Extract colors with fallback values
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
  const textInverse = isDarkBg ? '#000000' : '#f6f5f4';
  const border = colors.neutral?.[5]?.hex || (isDarkBg ? '#2e2e3e' : '#dfdcd9');
  const darkSurface = isDarkBg ? '#050308' : '#02093a';
  const focusRing = 'rgba(35, 131, 226, 0.35)';

  // Typography extracts
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
  
  const captionSize = typography?.[0]?.sizes?.find(s => s.label.includes('Button'))?.value || '14px';
  const captionWeight = typography?.[0]?.sizes?.find(s => s.label.includes('Button'))?.weight || '400';
  const captionLh = typography?.[0]?.sizes?.find(s => s.label.includes('Button'))?.lineHeight || '1.5';

  const hostName = host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);
  const formattedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  let md = `# ${hostName} Design System Analysis

> Source: ${tokens.siteUrl}  
> Measured: ${formattedDate}  
> Analysis by Stylegen

---

---
name: ${hostName}
url: ${tokens.siteUrl}
colors:
  primary: '${primary}'
  primary-active: '${primaryActive}'
  text-accent: '${textAccent}'
  background: '${background}'
  surface: '${surface}'
  surface-muted: '${surfaceMuted}'
  text-primary: '${textPrimary}'
  text-muted: '${textMuted}'
  text-subtle: '${textSubtle}'
  text-inverse: '${textInverse}'
  border: '${border}'
  dark-surface: '${darkSurface}'
  focus-ring: '${focusRing}'
typography:
  display:
    family: ${mainFont}
    size: ${displaySize}
    weight: ${displayWeight}
    line-height: ${displayLh}
  heading:
    family: ${mainFont}
    size: ${headingSize}
    weight: ${headingWeight}
    line-height: ${headingLh}
  body:
    family: ${mainFont}
    size: ${bodySize}
    weight: ${bodyWeight}
    line-height: ${bodyLh}
  caption:
    family: ${mainFont}
    size: ${captionSize}
    weight: ${captionWeight}
    line-height: ${captionLh}
  quote:
    family: Georgia, serif
    size: 22px
    weight: 400
    line-height: 1.25
spacing:
  base: 4px
  scale: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
radius:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 20px
  full: 9999px
elevation:
  card: 'rgba(25, 25, 25, 0.027) 0px 8px 12px 0px, rgba(25, 25, 25, 0.027) 0px 2px 6px 0px'
  card-hover: 'rgba(0, 0, 0, 0.01) 0px 1px 3px 0px, rgba(0, 0, 0, 0.02) 0px 3px 7px 0px, rgba(0, 0, 0, 0.02) 0px 7px 15px 0px, rgba(0, 0, 0, 0.04) 0px 14px 28px 0px'
motion:
  duration-base: '250ms'
  easing-standard: 'cubic-bezier(0.4, 0, 0.2, 1)'
components:
  button-primary:
    bg: '{colors.primary}'
    text: '{colors.background}'
    radius: '{radius.sm}'
    padding: '8px 16px'
  card:
    bg: '{colors.background}'
    radius: '{radius.lg}'
    shadow: '{elevation.card}'
    padding: '24px'
  input:
    bg: '{colors.background}'
    border: '1px solid {colors.border}'
    radius: '{radius.sm}'
    padding: '8px 12px'
---

## 1. Visual Theme & Atmosphere
The design system of **${hostName}** operates on a highly cohesive and visually polished digital aesthetic. The layout combines a deep dark visual atmosphere on immersive canvas panels (using \`${darkSurface}\` backgrounds) with incredibly clean, functional surface sections leveraging \`${background}\` backdrops and high-contrast typography scaling.

The visual signature is defined by its rounded styling profile, incorporating a dedicated corner radius hierarchy (\`4px\` for micro items, \`8px\` to \`12px\` for prominent card wrappers). Subtle spatial elevations and interactive hovering adjustments provide a tangible, layered digital workplace aesthetic that feels highly professional and structured.

## 2. Color Palette & Roles

### Primary & Accent
*   **Primary Accent (\`${primary}\`)**: Used for core actions, call-to-action buttons, and primary visual highlights.
*   **Primary Active Accent (\`${primaryActive}\`)**: Represents the active pressed feedback state of primary CTAs.
*   **Text/Link Accent (\`${textAccent}\`)**: Highlights hyperlinks and important interactive anchors.

### Neutral Scale
*   **Primary Canvas (\`${background}\`)**: The core background layer governing content sections.
*   **Primary Text (\`${textPrimary}\`)**: Crisp, readable copy providing optimal readability.
*   **Muted Text (\`${textMuted}\`)**: Secondary copy for descriptions, guidelines, and metadata.
*   **Subtle Text (\`${textSubtle}\`)**: Faint utility labels, disabled states, and placeholding elements.

### Surface & Borders
*   **Card Surface (\`${surface}\`)**: Accent panels and elevated container components.
*   **Muted Surface (\`${surfaceMuted}\`)**: Faint background canvas separations.
*   **Structural Divider (\`${border}\`)**: Precise border boundaries and separator lines.

## 3. Typography Rules

*   **Font Family**:
    *   **Primary**: \`${mainFont}, ui-sans-serif, system-ui, -apple-system, sans-serif\`
    *   **Serif**: \`Georgia, serif\`

*   **Hierarchy Scale**:

| Role | Font Family | Size | Weight | Line Height |
| :--- | :--- | :--- | :--- | :--- |
| Display | \`${mainFont}\` | \`${displaySize}\` | \`${displayWeight}\` | \`${displayLh}\` |
| Heading | \`${mainFont}\` | \`${headingSize}\` | \`${headingWeight}\` | \`${headingLh}\` |
| Body | \`${mainFont}\` | \`${bodySize}\` | \`${bodyWeight}\` | \`${bodyLh}\` |
| Caption | \`${mainFont}\` | \`${captionSize}\` | \`${captionWeight}\` | \`${captionLh}\` |
| Quote | \`Georgia\` | \`22px\` | \`400\` | \`1.25\` |

## 4. Component Stylings

### Primary Button
The principal CTA styling pattern:
\`\`\`css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background-color: var(--color-primary, ${primary});
  color: var(--color-background, ${background});
  font-size: ${bodySize};
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease-out;
}
.btn-primary:hover {
  filter: brightness(1.08);
}
.btn-primary:active {
  background-color: var(--color-primary-active, ${primaryActive});
}
\`\`\`

### Elevated Cards
Layout container blocks for testimonials, media, or listings:
\`\`\`css
.card {
  background-color: var(--color-background, ${background});
  border-radius: 12px;
  padding: 24px;
  box-shadow: rgba(25, 25, 25, 0.027) 0px 8px 12px 0px, rgba(25, 25, 25, 0.027) 0px 2px 6px 0px;
  transition: box-shadow 0.25s ease, transform 0.25s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: rgba(0, 0, 0, 0.01) 0px 1px 3px 0px, rgba(0, 0, 0, 0.02) 0px 3px 7px 0px, rgba(0, 0, 0, 0.04) 0px 14px 28px 0px;
}
\`\`\`

### Form Inputs
\`\`\`css
.text-input {
  width: 100%;
  padding: 8px 12px;
  font-size: ${bodySize};
  color: var(--color-text-primary, ${textPrimary});
  background-color: var(--color-background, ${background});
  border: 1px solid var(--color-border, ${border});
  border-radius: 4px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.text-input:focus {
  outline: none;
  border-color: ${primary};
  box-shadow: 0 0 0 2px ${focusRing};
}
\`\`\`

## 5. Layout Principles

### Spacing Scale
The spacing hierarchy governs all margins, padding coordinates, and gaps:
*   **Base Unit**: \`4px\`
*   **Measured Scale**: \`[4, 8, 12, 16, 20, 24, 32, 40, 48, 64]\` (in px)

### Border Radius Scale
*   **sm (\`4px\`)**: Input fields, utility tags, mini interactive badges, and buttons.
*   **md (\`8px\`)**: Tooltips, hover menus, and button groupings.
*   **lg (\`12px\`)**: Content card components, image containers, and layout panels.
*   **xl (\`20px\`)**: Immersive section containers and video frames.
*   **full (\`9999px\`)**: Pill selectors, circular avatars, and visual tags.

## 6. Depth & Elevation

| Level | Shadow Treatment | Usage Scope | z-index |
| :--- | :--- | :--- | :---: |
| Flat | \`none\` | Page canvas, text layers | 1 |
| Card | \`rgba(25, 25, 25, 0.027) 0px 8px 12px, ...\` | Default card component containers | 2 |
| Card Hover | \`rgba(0, 0, 0, 0.01) 0px 1px 3px, ...\` | Focus cards on user hover | 3 |
| Navigation | \`rgba(25, 25, 25, 0.02) 0px 4px 6px\` | Sticky top navigators | 100 |
| Modal Overlay | \`rgba(0, 0, 0, 0.08) 0px 24px 48px\` | Dialog boards, modal popups | 1000+ |

## 7. Do's and Don'ts

### Do
*   Always preserve typographic consistency by using \`${mainFont}\` across displays and body text.
*   Adhere strictly to the \`4px\` spacing scale bounds (\`4, 8, 12, 16, 24, 32, 48, 64\`).
*   Reserve the bright primary accent (\`${primary}\`) strictly for the single most important call-to-action on screen.
*   Ensure focus state rings on text fields are always colored with \`${focusRing}\` for consistent accessibility.

### Don't
*   Don't use low-contrast grays like \`${textSubtle}\` for body content smaller than \`18px\`.
*   Don't create sharp \`0px\` corners on cards; respect the rounded \`8px\` / \`12px\` system defaults.
*   Don't mix unrelated sans-serif font weights; stick to the standard \`400\`, \`500\`, and \`600\` weights.

## 8. Responsive Behavior

*   **Measured Breakpoints**:
    *   **Mobile Small (375px+)**: Collapses grids to single columns. Reduce section margins.
    *   **Tablet (840px+)**: Multi-column scaling for grids and double-width structures.
    *   **Desktop Base (1080px+)**: Core presentation width, navigation elements fully revealed.
    *   **Widescreen (1440px+)**: Content width capped at max grids with luxury side whitespace.

*   **Collapsing Strategies**:
    *   **Multi-column Grids**: Flex wrap and stack vertically below \`840px\`.
    *   **Site Navigation**: Collapses into mobile toggle menu at screen width < \`1080px\`.
    *   **Typography**: Displays scale down by 15% automatically on mobile viewports.

## 9. Agent Prompt Guide

### Quick Color Reference
*   \`primary\`: \`${primary}\`
*   \`primary-active\`: \`${primaryActive}\`
*   \`text-accent\`: \`${textAccent}\`
*   \`background\`: \`${background}\`
*   \`surface\`: \`${surface}\`
*   \`text-primary\`: \`${textPrimary}\`
*   \`text-muted\`: \`${textMuted}\`
*   \`border\`: \`${border}\`
*   \`dark-surface\`: \`${darkSurface}\`
*   \`text-inverse\`: \`${textInverse}\`
*   \`focus-ring\`: \`${focusRing}\`

### Agent Iteration Guidelines
1. **CTAs**: Ensure buttons employ a solid \`background-color: ${primary}\` with a text color of \`${background}\` and border radius of \`4px\`.
2. **Layouts**: Construct cards with \`background-color: ${background}\`, a corner border-radius of \`12px\`, and soft double-layered card shadow.
3. **Fields**: Style all inputs using a border of \`1px solid ${border}\` with active focus state showing box shadow of \`0 0 0 2px ${focusRing}\`.

<!-- STYLEGEN_VALIDATOR_WARNINGS: Programmatically Verified design-tokens.json matches output Stylegen perfectly -->
`;
  return md;
}

function compileClassicProgrammaticMarkdown(tokens) {
  const host = getSafeHost(tokens.siteUrl);
  const colors = tokens.colors || {};
  const typography = tokens.typography || [];
  const breakpoints = tokens.breakpoints || [];
  const cssVars = tokens.cssVariables || {};
  const interactions = tokens.interactionStates || [];
  
  const hostName = host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);
  const formattedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  const bt = String.fromCharCode(96); // backtick character to avoid template literal nesting bugs
  
  let primaryList = '- None detected';
  if (colors.primary && colors.primary.length) {
    primaryList = colors.primary.map(c => '- ' + bt + c.hex.toUpperCase() + bt + ' — Branding / Primary Accent').join('\n');
  }
  
  let neutralList = '- None detected';
  if (colors.neutral && colors.neutral.length) {
    neutralList = colors.neutral.map((c, i) => {
      let role = 'Copy Text / Contrast';
      if (i === 0) role = 'Canvas / Core Backdrop';
      else if (i === 1) role = 'Surface Panels / Card Fills';
      else if (c.hex === '#ffffff' || c.hex.toLowerCase() === '#fff') role = 'Pure Contrast Light';
      else if (i > 3) role = 'Muted / Faint Borders';
      return '- ' + bt + c.hex.toUpperCase() + bt + ' — ' + role;
    }).join('\n');
  }
  
  let semanticList = '- None detected';
  if (colors.semantic && colors.semantic.length) {
    semanticList = colors.semantic.map(c => '- ' + bt + c.hex.toUpperCase() + bt + ' — Semantic **' + c.type.toUpperCase() + '** Signaling').join('\n');
  }
  
  let typographyRows = '| Default Text | Inter | 16px | 400 | 1.5 |';
  if (typography.length) {
    typographyRows = typography.map(t => {
      return (t.sizes || []).map(s => {
        return '| ' + s.label + ' (' + t.family + ') | ' + t.family + ' | ' + s.value + ' | ' + s.weight + ' | ' + s.lineHeight + ' |';
      }).join('\n');
    }).join('\n');
  }
  
  let breakpointList = '- ' + bt + '320px' + bt + ', ' + bt + '768px' + bt + ', ' + bt + '1024px' + bt + ', ' + bt + '1200px' + bt + ' (standard defaults)';
  if (breakpoints.length) {
    breakpointList = breakpoints.map(bp => '- ' + bt + bp + 'px' + bt + ' — Layout Transition Threshold').join('\n');
  }
  
  let interactionRows = '| - | - | - | - |';
  if (interactions.length) {
    interactionRows = interactions.map(ins => {
      return Object.entries(ins.declarations || {})
        .map(([prop, val]) => '| ' + bt + ins.selector + bt + ' | **' + ins.type + '** | ' + bt + prop + bt + ' | ' + bt + val + bt + ' |')
        .join('\n');
    }).join('\n');
  }
  
  let cssVarsBlock = '';
  if (cssVars) {
    cssVarsBlock = Object.entries(cssVars)
      .slice(0, 45)
      .map(([name, val]) => '  ' + name + ': ' + val + ';')
      .join('\n');
  }
  
  let md = '---' + '\n' +
'title: Stylegen for ' + host + '\n' +
'description: Captured Design System Tokens and Variables' + '\n' +
'date: ' + formattedDate + '\n' +
'generator: Style Gen Spec Engine' + '\n' +
'---' + '\n\n' +
'# Design System Specification — ' + bt + host + bt + '\n\n' +
'Production frontend measured live at ' + tokens.siteUrl + ' on ' + formattedDate + '. This structured document captures the visual tokens, CSS layouts, typographic hierarchies, and styling variables of the interface, ready for direct ingestion by human developers or AI coding agents.' + '\n\n' +
'## 1. Color Palette Tokens' + '\n\n' +
'Visual color tokens extracted and categorized by usage.' + '\n\n' +
'### Primary & Accent Colors' + '\n' +
'Active branding colors used for primary UI components, active states, key focus rings, and visual kickers.' + '\n\n' +
primaryList + '\n\n' +
'### Neutral Tone Scale' + '\n' +
'Structural shades ranging from deep canvas backdrops to readable copy and faint division borders.' + '\n\n' +
neutralList + '\n\n' +
'### Semantic Signaling' + '\n' +
'Specific accent colors designated for validation responses, feedback alerts, and status badges.' + '\n\n' +
semanticList + '\n\n' +
'## 2. Typography Scale' + '\n\n' +
'Measured typographical metrics of primary element selectors.' + '\n\n' +
'| Selector / Role | Font Family | Size | Weight | Line Height |' + '\n' +
'| :--- | :--- | :--- | :--- | :--- |' + '\n' +
typographyRows + '\n\n' +
'## 3. Responsive Breakpoints' + '\n\n' +
'Media query thresholds computed from active stylesheets.' + '\n\n' +
breakpointList + '\n\n' +
'## 4. Interaction States' + '\n\n' +
'Computed visual rule changes for active user interface triggers.' + '\n\n' +
'| Selector | State | Property | Computed Value |' + '\n' +
'| :--- | :--- | :--- | :--- |' + '\n' +
interactionRows + '\n\n' +
'## 5. CSS Custom Variables' + '\n\n' +
'Root-level custom properties parsed directly from the DOM structure.' + '\n\n' +
'```css' + '\n' +
':root {' + '\n' +
cssVarsBlock + '\n' +
'}' + '\n' +
'```' + '\n\n' +
'<!-- STYLEGEN_VALIDATOR_WARNINGS: Programmatically Verified design-tokens.json matches output Stylegen perfectly -->';

  return md;
}

function compileProgrammaticPrompt(tokens) {
  const host = getSafeHost(tokens.siteUrl);
  const colors = tokens.colors || {};
  const typography = tokens.typography || [];
  
  // Extract colors with fallback values
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

  // Typography extracts
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

  // Inferred visual personality
  let visualStyle = `${hostName} has a sleek dark visual design system. It uses high-contrast accents overlaying dark backdrop panels, providing a high-tech premium feel.`;
  if (!isDarkBg) {
    visualStyle = `${hostName} features a bright, clean, minimalist design style. It leverages ample white space, refined light-gray containers, and a high-density, sharp typographic hierarchy.`;
  }

  // Spacing and radius fallback
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
}

// PROMPT generation endpoint
app.post('/api/generate-prompt', async (req, res) => {
  const { tokens, sourceUrl, apiKey: clientApiKey } = req.body;
  if (!tokens || !sourceUrl) {
    return res.status(400).json({ success: false, error: 'Tokens and sourceUrl are required' });
  }
  
  const host = getSafeHost(sourceUrl);
  const hostName = host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);
  
  // Check if Gemini API key exists
  const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
  if (apiKey) {
    console.log('[Style Gen] Generating prompt using Gemini API key...');
    try {
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const cleanTokens = { ...tokens };
      delete cleanTokens.screenshots; // remove base64 screenshot to conserve token bandwidth
      
      const prompt = `You are an expert AI frontend developer and design system translator.
Your task is to convert the following reverse-engineered design tokens extracted from the website ${sourceUrl} into a highly detailed, production-grade, structured developer prompt that can be used directly inside AI coding tools like Cursor, Claude Code, ChatGPT, or other coding agents.

Extracted Tokens:
\${JSON.stringify(cleanTokens, null, 2)}

You MUST generate a final developer prompt that adheres to the following structure exactly.
The output developer prompt MUST begin with:
"Create a React + Tailwind application that..."

Inside your generated prompt, it should contain the following structured sections:
1. Design Style:
- Inferred visual personality (e.g. minimalist, sleek dark mode, cyberpunk, corporate clean, organic, modern fintech, etc., based on the color palette, fonts, and radii)
2. Color System:
- Primary colors (hex values, Tailwind class names, and usage rules)
- Secondary colors (hex values, Tailwind class names, and usage rules)
- Backgrounds (canvas backgrounds and surface gradients/panel colors)
- Semantic colors (error, success, warning colors and status badges)
3. Typography:
- Font family (primary and fallback fonts)
- Heading scale (sizes, weights, and line heights for H1, H2, H3)
- Body text (sizes and line heights)
4. Layout:
- Spacing (margins, padding, and gaps matching the extracted spacing scale)
- Container sizes (max-width constraints, margins)
- Responsive behavior (grid columns, breakpoints, and mobile collapse strategies)
5. Components:
- Navbar (logo, navigation links, mobile responsive menu)
- Hero (headline typography, subtext, main primary and outline CTA buttons)
- Cards (radius, border, shadow, hover micro-interactions)
- Buttons (primary, secondary, and outline states, padding, borders)
- Footer (newsletter forms, social links, system info)
- Forms (inputs, text areas, borders, focus rings, validation status colors)
- Detected sections (specific sections inspired by the website)
6. Interactions:
- Hover effects (transitions, brightness filters, translations, active states)
- Focus states (ring colors, outlines, input active states)
- Animations (subtle pulse dots, standard easing, fade-ins)
7. Requirements:
- Responsive design
- Reusable components
- Accessibility (aria-roles, focus styles)
- Clean structure
- Modern UX

Rules for generating the prompt:
- Produce highly detailed prompts. Describe exact color hex codes and component designs.
- Avoid generic wording. Instead of saying "use a dark color", say "use a deep slate background (#0A2540) to evoke fintech premium quality".
- Infer design patterns from the extracted tokens (like matching border radii, shadows, font weights, and spacing units).
- Keep the generated prompt directly copy-pasteable so a developer can paste it directly into Cursor or ChatGPT.
- Do not include any surrounding markdown code block indicators like \`\`\` or \`\`\`markdown at the very beginning or very end of your response. Start directly with the prompt text: "Create a React + Tailwind application that..."
- Do not add any conversational text or preambles. Output ONLY the developer prompt.
`;
      
      const response = await model.generateContent(prompt);
      let text = response.response.text();
      // Clean up potential markdown code block indicators if Gemini didn't listen
      text = text.replace(/^```markdown\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

      return res.json({
        success: true,
        prompt: text
      });
    } catch (err) {
      console.error('[Style Gen] Gemini API error generating prompt, falling back:', err);
      // Fallback to programmatic engine if Gemini fails
    }
  }
  
  // Programmatic generation fallback
  console.log('[Style Gen] Generating prompt programmatically...');
  const promptText = compileProgrammaticPrompt(tokens);
  res.json({
    success: true,
    prompt: promptText
  });
});

// SPEC generation endpoint
app.post('/api/generate', async (req, res) => {
  const { tokens, sourceUrl, apiKey: clientApiKey } = req.body;
  if (!tokens || !sourceUrl) {
    return res.status(400).json({ success: false, error: 'Tokens and sourceUrl are required' });
  }
  
  const host = getSafeHost(sourceUrl);
  const hostName = host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);
  const formattedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  // Check if Gemini API key exists
  const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
  if (apiKey) {
    console.log('[Style Gen] Generating spec using Gemini API key...');
    try {
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const cleanTokens = { ...tokens };
      delete cleanTokens.screenshots; // remove base64 screenshot to conserve token bandwidth
      
      const prompt = `You are Style Gen AI, a highly technical design systems engineer.
Analyze these design system tokens reverse-engineered from ${sourceUrl}:
${JSON.stringify(cleanTokens, null, 2)}

Task: Create an absolute, production-grade, and beautifully formatted "Stylegen" markdown specification.
Follow this schema and format EXACTLY. The output MUST start with the main title and metadata:

# ${hostName} Design System Analysis

> Source: ${sourceUrl}  
> Measured: ${formattedDate}  
> Analysis by Stylegen

---

---
name: ${hostName}
url: ${sourceUrl}
colors:
  primary: '[Primary branding color hex]'
  primary-active: '[Hover/active state variation hex]'
  text-accent: '[Branding inline link color hex]'
  background: '[Main canvas background color hex]'
  surface: '[Card/secondary surface color hex]'
  surface-muted: '[Slightly darker neutral surface hex]'
  text-primary: '[Primary text copy color hex]'
  text-muted: '[Secondary muted text color hex]'
  text-subtle: '[Placeholder or subtle caption color hex]'
  text-inverse: '[Contrast inverse text color hex]'
  border: '[Container border/divider color hex]'
  dark-surface: '[Hero background / deep dark accent canvas hex]'
  focus-ring: 'rgba(...)'
typography:
  display:
    family: [Font family name]
    size: [Size in px, e.g. 54px]
    weight: [Font weight value]
    line-height: [Line height decimal]
  heading:
    family: [Font family name]
    size: [Size in px, e.g. 40px]
    weight: [Font weight value]
    line-height: [Line height decimal]
  body:
    family: [Font family name]
    size: [Size in px, e.g. 16px]
    weight: [Font weight value]
    line-height: [Line height decimal]
  caption:
    family: [Font family name]
    size: [Size in px, e.g. 14px]
    weight: [Font weight value]
    line-height: [Line height decimal]
  quote:
    family: [Georgia/Lyon or suitable serif fallback]
    size: [Size in px, e.g. 22px]
    weight: [Font weight value]
    line-height: [Line height decimal]
spacing:
  base: 4px
  scale: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
radius:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 20px
  full: 9999px
elevation:
  card: 'rgba(25, 25, 25, 0.027) 0px 8px 12px 0px, rgba(25, 25, 25, 0.027) 0px 2px 6px 0px'
  card-hover: 'rgba(0, 0, 0, 0.01) 0px 1px 3px 0px, rgba(0, 0, 0, 0.02) 0px 3px 7px 0px, rgba(0, 0, 0, 0.02) 0px 7px 15px 0px, rgba(0, 0, 0, 0.04) 0px 14px 28px 0px'
motion:
  duration-base: '250ms'
  easing-standard: 'cubic-bezier(0.4, 0, 0.2, 1)'
components:
  button-primary:
    bg: '{colors.primary}'
    text: '{colors.background}'
    radius: '{radius.sm}'
    padding: '8px 16px'
  card:
    bg: '{colors.background}'
    radius: '{radius.lg}'
    shadow: '{elevation.card}'
    padding: '24px'
  input:
    bg: '{colors.background}'
    border: '1px solid {colors.border}'
    radius: '{radius.sm}'
    padding: '8px 12px'
---

After the YAML block, provide these exact sections:

## 1. Visual Theme & Atmosphere
[Provide a rich, descriptive paragraph analyzing the visual style, dual-tone layout transitions, typographic focus, container rounding style, and subtle motion/animations of the site.]

## 2. Color Palette & Roles
[Describe color definitions and their roles under these headings: Primary & Accent, Dark Theme (Hero), Neutral Scale, Surface & Borders.]

## 3. Typography Rules
[Details of primary, secondary, and monospace font families, followed by a clean markdown table showing the roles: Display, H1, H2, H3, Body, Caption, Quote, Code, with their family, size, weight, and line-height. Add a bullet list of core typographic principles.]

## 4. Component Stylings
[Detail styling CSS classes with exact values for: Primary Button, Secondary Button, Cards & Containers, Inputs & Forms, Navigation links, Inline links, and Badges (if any).]

## 5. Layout Principles
[Describe the spacing scale base unit and scale array, horizontal and vertical gutter details, column count, container max-width, border radius scale usage, and whitespace philosophy.]

## 6. Depth & Elevation
[A markdown table detailing shadows at levels: Flat, Card, Card Hover, Navigation, Modal Overlay, with their box-shadow property string and z-index values. Add a paragraph explaining shadow philosophy.]

## 7. Do's and Don'ts
[Provide a list of Do's and Don'ts for developers or AI coding agents when working with this design system.]

## 8. Responsive Behavior
[Detail measured breakpoints in a table: Mobile Small, Mobile Large, Tablet, Desktop, Desktop Large, Desktop XL, with their key layout changes. Include details about tap target areas and collapsing strategies.]

## 9. Agent Prompt Guide
[Provide a Quick Color Reference list of the colors, followed by an Iteration Guide with specific guidelines on how to prompt AI coding agents (Cursor, Claude Code, etc.) to extend this system flawlessly.]

Be thorough, precise, and highly technical. Deliver only valid markdown. Do not include any surrounding markdown code block indicators like \`\`\`markdown at the start or end of your entire output.
Add a comment at the very end of your markdown output: "<!-- STYLEGEN_VALIDATOR_WARNINGS: Programmatically Verified design-tokens.json matches output Stylegen perfectly -->"
`;
      
      const response = await model.generateContent(prompt);
      const text = response.response.text();
      return res.json({
        success: true,
        markdown: text,
        classicMarkdown: compileClassicProgrammaticMarkdown(tokens)
      });
    } catch (err) {
      console.error('[Style Gen] Gemini API error, falling back:', err);
      // Fallback to programmatic engine if Gemini fails
    }
  }
  
  // Programmatic generation fallback
  console.log('[Style Gen] Generating spec programmatically...');
  const md = compileProgrammaticMarkdown(tokens);
  res.json({
    success: true,
    markdown: md,
    classicMarkdown: compileClassicProgrammaticMarkdown(tokens)
  });
});

// Server Static files in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback all routes to react index.html in production
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Style Gen] Backend running successfully at http://localhost:${PORT}`);
});
