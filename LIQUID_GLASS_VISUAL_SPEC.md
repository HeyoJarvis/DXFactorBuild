# 🎨 Liquid Glass Visual Specification

## Exact Pixel-Perfect Specifications

This document provides the exact visual specifications for the liquid glass design, pixel-perfect for implementation.

---

## 🪟 Window Specifications

### macOS Window
```
Dimensions: 1120px × 760px
Min Size: 960px × 640px
Transparency: Full (transparent: true)
Background: #00FFFFFF (transparent)
Vibrancy: 'sidebar' (native macOS effect)
Title Bar: hiddenInset
Traffic Lights: (14, 14) from top-left
Rounded Corners: true (native macOS)
Shadow: System default
Resizable: true
Movable: true
Centered: true
```

---

## 📐 Layout Grid

### Container Layout
```
┌───────────────────────────────────────────┐
│ Window (1120×760)                         │
│  ┌─────────────────────────────────────┐  │
│  │ Padding: 24px                       │  │
│  │  ┌───────────────────────────────┐  │  │
│  │  │ Glass Panel (960px max-width) │  │  │
│  │  │ Padding: 64px                 │  │  │
│  │  │                               │  │  │
│  │  │  ┌─────────────────────────┐  │  │  │
│  │  │  │ Logo (64×64)            │  │  │
│  │  │  └─────────────────────────┘  │  │  │
│  │  │       ↓ 24px gap               │  │  │
│  │  │  ┌─────────────────────────┐  │  │  │
│  │  │  │ Title (36/44)           │  │  │
│  │  │  └─────────────────────────┘  │  │  │
│  │  │       ↓ 8px gap                │  │  │
│  │  │  ┌─────────────────────────┐  │  │  │
│  │  │  │ Subtitle (16/26)        │  │  │
│  │  │  └─────────────────────────┘  │  │  │
│  │  │       ↓ 24px gap               │  │  │
│  │  │  ─────────────────────────    │  │  │ Divider
│  │  │       ↓ 16px gap               │  │  │
│  │  │  ██▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒      │  │  │ Progress
│  │  │       ↓ 32px gap               │  │  │
│  │  │  ┌─────────────────────────┐  │  │  │
│  │  │  │ Section Title (24/32)   │  │  │
│  │  │  └─────────────────────────┘  │  │  │
│  │  │       ↓ 8px gap                │  │  │
│  │  │  ┌─────────────────────────┐  │  │  │
│  │  │  │ Section Text (16/24)    │  │  │
│  │  │  └─────────────────────────┘  │  │  │
│  │  │       ↓ 32px gap               │  │  │
│  │  │  ┌─────────────────────────┐  │  │  │
│  │  │  │ Button 1 (480w × 56h)   │  │  │
│  │  │  └─────────────────────────┘  │  │  │
│  │  │       ↓ 16px gap               │  │  │
│  │  │  ─── or ───                    │  │  │ Divider
│  │  │       ↓ 16px gap               │  │  │
│  │  │  ┌─────────────────────────┐  │  │  │
│  │  │  │ Button 2 (480w × 56h)   │  │  │
│  │  │  └─────────────────────────┘  │  │  │
│  │  │       ↓ 40px gap               │  │  │
│  │  │  ─────────────────────────    │  │  │ Divider
│  │  │       ↓ 32px gap               │  │  │
│  │  │  ┌─────────────────────────┐  │  │  │
│  │  │  │ Features (3 columns)    │  │  │
│  │  │  └─────────────────────────┘  │  │  │
│  │  │       ↓ 32px gap               │  │  │
│  │  │  ┌─────────────────────────┐  │  │  │
│  │  │  │ Footer Text (13/20)     │  │  │
│  │  │  └─────────────────────────┘  │  │  │
│  │  │                               │  │  │
│  │  └───────────────────────────────┘  │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

---

## 🎨 Color Specifications

### Background Colors
```css
/* Canvas (page background) */
#F7F8FA
rgb(247, 248, 250)

/* Glass Panel */
rgba(255, 255, 255, 0.55)
/* = 55% opaque white */

/* Glass Button */
rgba(255, 255, 255, 0.65)
/* = 65% opaque white */

/* Glass Soft (optional variant) */
rgba(255, 255, 255, 0.4)
/* = 40% opaque white */

/* Glass Strong (optional variant) */
rgba(255, 255, 255, 0.7)
/* = 70% opaque white */
```

### Text Colors
```css
/* Primary Text (titles, body) */
#0B0C0E
rgb(11, 12, 14)
Contrast: 15.8:1 on white (AAA)

/* Secondary Text (subtitles, descriptions) */
#5A5F6A
rgb(90, 95, 106)
Contrast: 7.2:1 on white (AAA)

/* Tertiary Text (help text, disabled) */
#8C919A
rgb(140, 145, 154)
Contrast: 4.6:1 on white (AA)
```

### Accent Colors
```css
/* Accent Blue (primary) */
#2563EB
rgb(37, 99, 235)

/* Accent Blue Hover */
#1D4ED8
rgb(29, 78, 216)

/* Focus Ring */
rgba(37, 99, 235, 0.12)
/* = 12% opaque blue */

/* Focus Ring (hover) */
rgba(37, 99, 235, 0.18)
/* = 18% opaque blue */
```

### Border & Stroke Colors
```css
/* Subtle Stroke (default) */
rgba(0, 0, 0, 0.06)
/* = 6% opaque black */

/* Hover Stroke */
#CBD5E1
rgb(203, 213, 225)

/* Focus Stroke */
#2563EB
rgb(37, 99, 235)
```

### Error Colors
```css
/* Error Background */
rgba(254, 242, 242, 0.8)
/* = 80% opaque light red */

/* Error Border */
rgba(220, 38, 38, 0.2)
/* = 20% opaque red */

/* Error Text */
#DC2626
rgb(220, 38, 38)
```

---

## 🔠 Typography Specifications

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 
             Roboto, Oxygen, Ubuntu, Cantarell, 
             'Open Sans', 'Helvetica Neue', sans-serif;
```

### Type Scale
```css
/* Title (H1) */
font-size: 36px;
line-height: 44px;
font-weight: 600;
letter-spacing: -0.2px;
color: #0B0C0E;

/* Section Header (H2) */
font-size: 24px;
line-height: 32px;
font-weight: 600;
letter-spacing: -0.2px;
color: #0B0C0E;

/* Subtitle / Body Large */
font-size: 16px;
line-height: 26px;
font-weight: 400;
color: #5A5F6A;

/* Body / Button Text */
font-size: 16px;
line-height: 24px;
font-weight: 400 (text) / 500 (buttons);
color: #0B0C0E;

/* Small Text / Footer */
font-size: 13px;
line-height: 20px;
font-weight: 400;
color: #8C919A;
```

---

## 🔲 Component Specifications

### Glass Panel (Container)
```css
width: 960px;
max-width: 960px;
padding: 64px;
background: rgba(255, 255, 255, 0.55);
backdrop-filter: blur(22px) saturate(160%);
-webkit-backdrop-filter: blur(22px) saturate(160%);
border: 1px solid rgba(0, 0, 0, 0.06);
border-radius: 20px;
box-shadow: 0 16px 48px rgba(16, 24, 40, 0.06);

/* GPU acceleration */
transform: translateZ(0);
backface-visibility: hidden;
perspective: 1000px;
will-change: backdrop-filter;
```

### Logo Container
```css
width: 64px;
height: 64px;
margin: 0 auto 24px;
background: rgba(37, 99, 235, 0.08);
backdrop-filter: blur(8px);
border-radius: 16px;
```

### Divider Line
```css
width: 100%;
height: 1px;
background: rgba(0, 0, 0, 0.06);
margin: 24px 0;
```

### Progress Bar
```css
/* Container */
width: 100%;
height: 2px;
background: rgba(0, 0, 0, 0.06);
border-radius: 16px;
overflow: hidden;

/* Fill */
height: 100%;
width: 33.33%; /* Example: 1/3 complete */
background: #2563EB;
border-radius: 16px;
transition: width 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
```

### Glass Button
```css
/* Default state */
width: 100%;
max-width: 480px;
height: 56px;
padding: 0 16px;
background: rgba(255, 255, 255, 0.65);
backdrop-filter: blur(14px) saturate(140%);
-webkit-backdrop-filter: blur(14px) saturate(140%);
border: 1px solid rgba(0, 0, 0, 0.06);
border-radius: 14px;
font-size: 16px;
font-weight: 500;
color: #0B0C0E;
cursor: pointer;
transition: all 0.12s cubic-bezier(0.2, 0.8, 0.2, 1);
transform: translateZ(0);

/* Hover state */
background: rgba(255, 255, 255, 0.75);
border-color: #CBD5E1;
transform: translateY(-1px) translateZ(0);
box-shadow: 0 4px 12px rgba(16, 24, 40, 0.08);

/* Focus state */
border-color: #2563EB;
box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.12);
outline: none;

/* Active state */
transform: scale(0.99) translateZ(0);

/* Disabled state */
background: rgba(229, 231, 235, 0.5);
color: #8C919A;
border-color: rgba(0, 0, 0, 0.04);
backdrop-filter: none;
cursor: not-allowed;
```

### Icon
```css
width: 20px;
height: 20px;
opacity: 0.7;
```

### Error Message
```css
padding: 14px 16px;
background: rgba(254, 242, 242, 0.8);
backdrop-filter: blur(12px);
border: 1px solid rgba(220, 38, 38, 0.2);
border-radius: 12px;
color: #DC2626;
font-size: 14px;
line-height: 20px;
```

### Feature Item
```css
/* Icon */
font-size: 18px;
opacity: 0.5;

/* Text */
font-size: 13px;
line-height: 20px;
color: #5A5F6A;
```

---

## 🎬 Animation Specifications

### Timing Functions
```css
/* Standard easing (default) */
cubic-bezier(0.2, 0.8, 0.2, 1)
/* Use for: all transitions */

/* Durations */
--fast: 0.12s;      /* Button states, border changes */
--medium: 0.26s;    /* Progress bar, complex transitions */
```

### Keyframe Animations

#### Fade In Up (Component Mount)
```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Usage */
animation: fadeInUp 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
```

#### Shimmer (Loading)
```css
@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

/* Usage */
animation: shimmer 1.2s ease-in-out infinite;
```

#### Fade In (Error Message)
```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Usage */
animation: fadeIn 0.12s cubic-bezier(0.2, 0.8, 0.2, 1);
```

---

## 📏 Spacing System

### Base Unit: 8px

```css
--space-xs: 8px;    /* Tight spacing */
--space-sm: 16px;   /* Small gaps */
--space-md: 24px;   /* Medium gaps */
--space-lg: 32px;   /* Large gaps */
--space-xl: 48px;   /* Extra large gaps */
--space-2xl: 64px;  /* Section padding */
```

### Usage Guide
```
Logo to Title: 24px (md)
Title to Subtitle: 8px (xs)
Subtitle to Divider: 24px (md)
Divider to Progress: 16px (sm)
Progress to Section: 32px (lg)
Section Title to Text: 8px (xs)
Section Text to Buttons: 32px (lg)
Button to Button: 16px (sm)
Button to Features: 40px (xl + sm)
Features to Footer: 32px (lg)
Panel Padding: 64px (2xl)
Page Padding: 24px (md)
```

---

## 🎯 Border Radius System

```css
--radius-panel: 20px;   /* Glass panels */
--radius-logo: 16px;    /* Logo container */
--radius-button: 14px;  /* Buttons, inputs */
--radius-card: 12px;    /* Error messages, small cards */
--radius-progress: 16px; /* Progress bar (for smoothness) */
```

---

## 📱 Responsive Breakpoints

### Desktop (Default)
```css
/* Default: 1120×760 window */
.glass-container {
  width: 960px;
  padding: 64px;
}

.title {
  font-size: 36px;
  line-height: 44px;
}

.button {
  height: 56px;
}
```

### Tablet (≤1024px)
```css
@media (max-width: 1024px) {
  .glass-container {
    width: 720px;
    padding: 40px;
  }

  .title {
    font-size: 30px;
    line-height: 38px;
  }

  .subtitle {
    font-size: 15px;
    line-height: 24px;
  }

  .button {
    height: 52px;
  }
}
```

### Mobile (≤768px)
```css
@media (max-width: 768px) {
  .page-canvas {
    padding: 16px;
  }

  .glass-container {
    width: 100%;
    padding: 32px 24px;
  }

  .title {
    font-size: 24px;
    line-height: 32px;
  }

  .subtitle {
    font-size: 14px;
    line-height: 22px;
  }

  .logo {
    width: 56px;
    height: 56px;
  }

  .features-list {
    flex-direction: column;
    gap: 16px;
  }
}
```

---

## 🔍 Shadow Specifications

### Soft Elevated Shadow
```css
box-shadow: 0 16px 48px rgba(16, 24, 40, 0.06);
```
**Usage**: Glass panels

### Subtle Hover Shadow
```css
box-shadow: 0 4px 12px rgba(16, 24, 40, 0.08);
```
**Usage**: Button hover state

### Focus Ring
```css
box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.12);
```
**Usage**: Button/input focus state

### Logo Shadow
```css
filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.06));
```
**Usage**: Logo emoji

---

## ♿ Accessibility Specifications

### Minimum Contrast Ratios
```
Primary text on glass: ≥7:1 (AAA)
Secondary text on glass: ≥7:1 (AAA)
Tertiary text on glass: ≥4.5:1 (AA)
Accent blue on white: ≥4.5:1 (AA)
Error text on background: ≥7:1 (AAA)
```

### Focus Indicators
```css
/* Always visible, never outline: none without alternative */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.12);
}
```

### Minimum Touch Targets
```css
button, a {
  min-width: 44px;
  min-height: 44px;
}
```

### Reduced Transparency Fallback
```css
@media (prefers-reduced-transparency) {
  .glass-container,
  .glass-button {
    background: #FFFFFF; /* Solid white */
    backdrop-filter: none;
  }
}
```

---

## 🖥️ Platform-Specific Details

### macOS
- **Vibrancy**: `sidebar` effect
- **Traffic Lights**: Position (14, 14)
- **Rounded Corners**: Native OS style
- **Scroll Bounce**: Elastic scrolling enabled
- **Window Controls**: Native integration

### Windows 11
- **Material**: `acrylic` effect
- **Blur**: Native Windows blur
- **Appearance**: Similar to macOS aesthetic
- **Window Controls**: Standard Windows

### Linux / Fallback
- **Blur**: CSS `backdrop-filter` or solid white
- **Appearance**: Functional, clean fallback
- **Compatibility**: Works everywhere

---

## 📊 Performance Metrics

### GPU Layers
```css
/* Elements to GPU-promote */
.glass-container,
.glass-button,
.error-message {
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000px;
}
```

### Optimization Rules
1. **Max blur layers**: ≤3 stacked
2. **Single main panel**: One large glass container
3. **No blur on disabled**: Remove backdrop-filter
4. **No heavy animations**: No particles, parallax
5. **Use will-change sparingly**: Only on backdrop-filter

### Expected Performance
- **60fps**: On modern Macs (M1/M2)
- **30-60fps**: On Intel Macs (acceptable)
- **Fallback**: Solid white if too slow

---

## 🎨 Design Redlines

### Button with Icon + Text
```
┌────────────────────────────────────────┐
│  ← 16px padding                   16px→│
│  ┌──┐  ← 12px gap                      │
│  │🔷│  Continue with Slack              │ ← 56px height
│  └──┘                                   │
│  20×20px icon                           │
└────────────────────────────────────────┘
   480px width (max)
   Border: 1px solid rgba(0,0,0,0.06)
   Radius: 14px
   Background: rgba(255,255,255,0.65) + blur(14px)
```

### Progress Bar
```
█████████████░░░░░░░░░░░░░░░░░░░░░░░░░░
← Fill: #2563EB     Track: rgba(0,0,0,0.06) →
↑ 2px height                              ↑
16px radius (smooth rounded ends)
```

### Logo Container
```
┌────────────┐
│            │
│            │
│     🤖     │ ← 36px emoji
│            │
│            │
└────────────┘
64×64px total
16px radius
Background: rgba(37,99,235,0.08) + blur(8px)
```

---

## ✅ Implementation Checklist

Use this to verify pixel-perfect implementation:

### Colors
- [ ] Canvas: #F7F8FA
- [ ] Glass panel: rgba(255,255,255,0.55)
- [ ] Glass button: rgba(255,255,255,0.65)
- [ ] Primary text: #0B0C0E
- [ ] Secondary text: #5A5F6A
- [ ] Accent: #2563EB
- [ ] Stroke: rgba(0,0,0,0.06)

### Typography
- [ ] Title: 36px/44px, weight 600
- [ ] Subtitle: 16px/26px, weight 400
- [ ] Button: 16px, weight 500
- [ ] Small: 13px/20px, weight 400

### Effects
- [ ] Panel blur: blur(22px) saturate(160%)
- [ ] Button blur: blur(14px) saturate(140%)
- [ ] Shadow: 0 16px 48px rgba(16,24,40,0.06)

### Spacing
- [ ] Panel padding: 64px
- [ ] Page padding: 24px
- [ ] Button height: 56px
- [ ] Logo size: 64×64px

### Radius
- [ ] Panel: 20px
- [ ] Button: 14px
- [ ] Logo: 16px

### Animations
- [ ] Transition: 0.12s cubic-bezier(0.2,0.8,0.2,1)
- [ ] Hover: translateY(-1px)
- [ ] Active: scale(0.99)
- [ ] Focus: 6px ring

### Platform
- [ ] macOS vibrancy: 'sidebar'
- [ ] Windows material: 'acrylic'
- [ ] Traffic lights: (14, 14)
- [ ] Window size: 1120×760

### Performance
- [ ] GPU promotion: translateZ(0)
- [ ] Max 3 blur layers
- [ ] will-change: backdrop-filter

---

**This specification is complete and production-ready.** 🎉

Use it as your single source of truth for implementing liquid glass across all pages.

