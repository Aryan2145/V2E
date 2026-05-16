## DESIGN SYSTEM — MANDATORY RULES (Read before writing any UI code)

These rules override any default styling decisions. Follow them strictly on every component.

---

### COLORS

Background: #FFFFFF (pure white) — all page and card backgrounds
Primary: #2563EB (bright blue) — primary actions, active states, links
Primary Hover: #1D4ED8
Success: #16A34A (green)
Warning: #D97706 (amber)
Danger: #DC2626 (red)
Info: #0891B2 (cyan)

Text on white background:
- Headings: #0F172A (near black)
- Body text: #1E293B
- Secondary/helper text: #475569
- Disabled text: #94A3B8
- NEVER use anything lighter than #475569 for readable text on white

Text on dark/colored backgrounds:
- Always use #FFFFFF
- NEVER use off-white, light gray, or muted colors on dark bg

Borders: #E2E8F0 for cards/inputs — subtle but visible

---

### CONTRAST RULES — NON-NEGOTIABLE

- Text on white bg: minimum color #475569 (never lighter)
- White text on colored bg: background must be at least as dark as #2563EB
- Buttons MUST visually differ from their background at all times
- Input fields: white bg (#FFFFFF), border #CBD5E1, text #0F172A
- Placeholder text: #94A3B8 — acceptable only for placeholders, never body text
- Never place gray text on gray background
- Never place light text on light background
- Test every text-background combination mentally: would a person squint to read this? If yes, fix it.

---

### BUTTONS — STRICT RULES

Primary Button:
- bg: #2563EB, text: #FFFFFF, hover bg: #1D4ED8
- border-radius: 8px, padding: 10px 20px, font-weight: 600

Secondary Button:
- bg: #FFFFFF, text: #2563EB, border: 2px solid #2563EB
- hover: bg #EFF6FF

Danger Button:
- bg: #DC2626, text: #FFFFFF, hover: #B91C1C

Disabled Button:
- bg: #E2E8F0, text: #94A3B8, cursor: not-allowed

Ghost/Icon Button:
- bg: transparent, hover bg: #F1F5F9
- icon color: #475569, hover icon: #0F172A

NEVER make a button the same color as the page or card background.
NEVER use opacity to style a disabled button — use the explicit disabled colors above.

---

### INPUTS & FORMS

- Input bg: #FFFFFF
- Input border: 1px solid #CBD5E1
- Input border on focus: 2px solid #2563EB, outline: none
- Input text: #0F172A
- Input placeholder: #94A3B8
- Label: #374151, font-weight: 500, font-size: 14px
- Error state border: #DC2626, error message text: #DC2626
- Helper text: #64748B

Password fields:
- Always include an eye toggle icon on the right side (inside the input)
- Eye open icon = password visible, Eye closed icon = password hidden
- Use lucide-react icons: Eye and EyeOff
- Icon color: #94A3B8, hover: #475569

---

### CARDS & SURFACES

- Card bg: #FFFFFF
- Card border: 1px solid #E2E8F0
- Card border-radius: 12px
- Card shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)
- Card padding: 24px
- Section headers inside cards: #0F172A, font-weight: 600

---

### SIDEBAR / NAVIGATION

- Sidebar bg: #0F172A (dark navy)
- Sidebar text: #CBD5E1
- Sidebar active item bg: #2563EB, text: #FFFFFF
- Sidebar hover item bg: #1E293B, text: #F1F5F9
- Sidebar icon color matches text color
- Logo area bg: #0F172A
- Dividers: #1E293B

---

### TYPOGRAPHY

Font: Inter (import from Google Fonts)

- Page title (H1): 28px, font-weight: 700, color: #0F172A
- Section title (H2): 22px, font-weight: 600, color: #0F172A
- Card title (H3): 18px, font-weight: 600, color: #0F172A
- Body: 15px, font-weight: 400, color: #1E293B
- Small/helper: 13px, color: #475569
- Label: 14px, font-weight: 500, color: #374151
- Link: color #2563EB, hover underline

---

### STATUS BADGES & TAGS

Active: bg #DCFCE7, text #16A34A, border: 1px solid #BBF7D0
Inactive: bg #FEE2E2, text #DC2626, border: 1px solid #FECACA
Pending: bg #FEF9C3, text #CA8A04, border: 1px solid #FDE68A
Info: bg #E0F2FE, text #0369A1, border: 1px solid #BAE6FD

Font-weight: 500, font-size: 12px, border-radius: 999px, padding: 2px 10px

---

### MOBILE — MANDATORY (build desktop and mobile together)

Breakpoints:
- Mobile: < 768px
- Tablet: 768px – 1024px
- Desktop: > 1024px

Mobile rules:
- Sidebar collapses to a bottom tab bar or hamburger drawer on mobile
- All grid layouts (2-col, 3-col) collapse to single column on mobile
- Cards go full width on mobile
- Tables become scrollable horizontally or convert to card-list layout
- Font sizes reduce by 1–2px on mobile (H1: 22px, body: 14px)
- Buttons go full width on mobile forms
- Touch targets minimum 44x44px
- Padding on mobile: 16px horizontal page padding
- Modals go full screen on mobile
- Inputs: font-size minimum 16px (prevents iOS zoom)

---

### GENERAL RULES

- No gray-on-gray anywhere
- No white text on white or near-white backgrounds
- No colored text on same-family colored background (e.g. blue text on light blue bg is allowed only if contrast ratio passes)
- Vibrant accent colors for highlights, not for large surfaces
- Icons always paired with sufficient contrast to their background
- Loading skeletons: bg #F1F5F9 with shimmer animation
- Empty states: use an icon + heading (#0F172A) + subtext (#475569) + action button
- Toasts: success green, error red, warning amber — always with white text
