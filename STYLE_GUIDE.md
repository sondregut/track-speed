# Track Speed Style Guide

This is the single source of truth for all visual styling in the app. **All colors, typography, spacing, and component styles MUST reference this guide.**

## Color Palette

### Primary Colors (Blue)
Used for primary actions, links, and brand identity.

| Token | Hex | Usage |
|-------|-----|-------|
| `primary.50` | `#EFF6FF` | Backgrounds, hover states |
| `primary.100` | `#DBEAFE` | Light backgrounds |
| `primary.200` | `#BFDBFE` | Borders, dividers |
| `primary.300` | `#93C5FD` | Disabled states |
| `primary.400` | `#60A5FA` | Secondary text, icons |
| `primary.500` | `#3B82F6` | **Primary brand color** |
| `primary.600` | `#2563EB` | Hover state |
| `primary.700` | `#1D4ED8` | Active/pressed state |
| `primary.800` | `#1E40AF` | Dark variant |
| `primary.900` | `#1E3A8A` | Darkest variant |

### Gray Scale
Used for backgrounds, text, borders, and neutral elements.

| Token | Hex | Usage |
|-------|-----|-------|
| `gray.50` | `#F8FAFC` | Light backgrounds |
| `gray.100` | `#F1F5F9` | Subtle backgrounds |
| `gray.200` | `#E2E8F0` | Borders, dividers |
| `gray.300` | `#CBD5E1` | Disabled text |
| `gray.400` | `#94A3B8` | Placeholder text, muted |
| `gray.500` | `#64748B` | Secondary text |
| `gray.600` | `#475569` | Body text (light mode) |
| `gray.700` | `#334155` | Borders (dark mode) |
| `gray.800` | `#1E293B` | Card backgrounds |
| `gray.900` | `#0F172A` | **Main app background** |
| `gray.950` | `#020617` | Darkest black |

### Semantic Colors

#### Success (Green)
| Token | Hex | Usage |
|-------|-----|-------|
| `success.500` | `#22C55E` | Success messages, positive |
| `success.600` | `#16A34A` | Success hover |

#### Warning (Amber)
| Token | Hex | Usage |
|-------|-----|-------|
| `warning.500` | `#F59E0B` | Warning messages |
| `warning.600` | `#D97706` | Warning hover |

#### Error (Red)
| Token | Hex | Usage |
|-------|-----|-------|
| `error.500` | `#EF4444` | Error messages, destructive |
| `error.600` | `#DC2626` | Error hover |

### Timing-Specific Colors
These colors are specifically for the timing interface.

| Token | Hex | Usage |
|-------|-----|-------|
| `timing.ready` | `#22C55E` | Ready state (green) |
| `timing.active` | `#F59E0B` | Timer running (amber) |
| `timing.stopped` | `#EF4444` | Timer stopped (red) |
| `timing.gate` | `#F59E0B` | Virtual gate line |

### Base Colors
| Token | Hex |
|-------|-----|
| `white` | `#FFFFFF` |
| `black` | `#000000` |

---

## Typography

### Font Family
- **Primary**: System default (San Francisco on iOS, Roboto on Android)
- **Monospace**: For timer displays - use `fontVariant: ['tabular-nums']`

### Font Sizes
| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `xs` | 12px | 16px | Captions, badges |
| `sm` | 14px | 20px | Secondary text, labels |
| `base` | 16px | 24px | Body text |
| `lg` | 18px | 28px | Subtitles |
| `xl` | 20px | 28px | Section headers |
| `2xl` | 24px | 32px | Page titles |
| `3xl` | 30px | 36px | Large titles |
| `4xl` | 36px | 40px | Hero text |
| `5xl` | 48px | 1 | Display text |
| `6xl` | 60px | 1 | Large display |
| `7xl` | 72px | 1 | Timer display |

### Font Weights
| Token | Weight | Usage |
|-------|--------|-------|
| `normal` | 400 | Body text |
| `medium` | 500 | Labels, emphasized |
| `semibold` | 600 | Subheadings |
| `bold` | 700 | Headings, buttons |
| `extrabold` | 800 | Hero text |

### Text Colors
| Usage | Light Mode | Dark Mode |
|-------|------------|-----------|
| Primary text | `gray.900` | `white` |
| Secondary text | `gray.600` | `gray.400` |
| Muted text | `gray.400` | `gray.500` |
| Placeholder | `gray.400` | `gray.500` |

---

## Spacing

Use consistent spacing values throughout the app.

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight spacing |
| `sm` | 8px | Small gaps |
| `md` | 16px | Standard spacing |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Large gaps |
| `2xl` | 48px | Page padding |
| `3xl` | 64px | Hero spacing |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `none` | 0px | No rounding |
| `sm` | 4px | Subtle rounding |
| `md` | 8px | Buttons, inputs |
| `lg` | 12px | Cards |
| `xl` | 16px | Large cards |
| `2xl` | 24px | Modals |
| `full` | 9999px | Circular elements |

---

## Shadows

### Dark Mode Shadows
Since we use dark mode, shadows need higher opacity.

| Token | Shadow | Usage |
|-------|--------|-------|
| `sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle elevation |
| `md` | `0 4px 6px rgba(0,0,0,0.4)` | Cards |
| `lg` | `0 10px 15px rgba(0,0,0,0.5)` | Modals, dropdowns |
| `xl` | `0 20px 25px rgba(0,0,0,0.6)` | Popovers |

---

## Component Styles

### Buttons

#### Primary Button
```
background: primary.500
text: white
borderRadius: md (8px)
paddingVertical: sm (8px)
paddingHorizontal: lg (24px)
fontSize: base (16px)
fontWeight: semibold (600)
```

#### Secondary Button
```
background: gray.700
text: white
```

#### Outline Button
```
background: transparent
border: 1px primary.500
text: primary.500
```

#### Ghost Button
```
background: transparent
text: primary.500
```

### Cards
```
background: gray.800
borderRadius: lg (12px)
padding: md (16px)
```

### Timer Display
```
fontSize: 7xl (72px) - large
fontSize: 5xl (48px) - medium
fontSize: 3xl (30px) - small
fontWeight: bold (700)
fontVariant: tabular-nums
color: Based on state (ready/active/stopped)
```

### Start Button (Circle)
```
size: 120px x 120px
borderRadius: full (60px)
background: timing color based on state
fontSize: xl (20px)
fontWeight: bold (700)
letterSpacing: 2px
shadow: lg
```

---

## Dark Mode First

This app is **dark mode by default** for optimal outdoor visibility. All designs should prioritize dark mode.

- Background: `gray.900` (#0F172A)
- Card background: `gray.800` (#1E293B)
- Primary text: `white` (#FFFFFF)
- Secondary text: `gray.400` (#94A3B8)

---

## Implementation

All style values are defined in:
```
src/constants/theme.ts
```

**NEVER hardcode colors or sizes directly in components.** Always import from theme:

```typescript
import { colors, spacing, typography, borderRadius } from '../constants/theme';

// Correct
style={{ backgroundColor: colors.gray[800] }}

// WRONG - never do this
style={{ backgroundColor: '#1E293B' }}
```

---

## Accessibility

- Minimum touch target: 44x44 points
- Color contrast ratio: 4.5:1 for normal text, 3:1 for large text
- All interactive elements must have visual feedback
- Timer text should be highly readable in bright sunlight
