# WaterParty Design System

> Codified patterns for consistent UI across the WaterParty app.
> Last updated: June 11, 2026

---

## 1. 🎨 Color Tokens

### Brand Colors (from `@theme` in `index.css`)
```
brand-primary:   #FF3B5C  (pink-red)    → accent, active states, primary CTA
brand-secondary: #7042F8  (purple)       → gradients, secondary accents
brand-accent:    #00D2FF  (cyan)         → decorative borders, info, highlights
```

### Surface Colors (themeable via CSS variables)
```
bg-base:     #090A10  (.light: #F5F5F7)  → main app background
bg-card:     #14151E  (.light: #FFFFFF)   → card backgrounds
bg-overlay:  #0C0D14  (.light: #F0F0F2)  → overlay backgrounds
bg-elevated: #1A1B26  (.light: #FFFFFF)   → elevated surfaces (modals)
bg-auth:     #08090E  (.light: #F0F0F2)   → auth page background
```

### Text Colors (themeable via CSS variables)
```
text-primary:   rgba(255,255,255, 0.95)   → primary body text
text-secondary: rgba(255,255,255, 0.70)   → secondary body text
text-muted:     rgba(255,255,255, 0.50)   → muted/helper text
text-faint:     rgba(255,255,255, 0.30)   → placeholders, hints
```

### Status Colors (use raw Tailwind, NOT theme tokens)
```
Error:   text-red-400 / bg-red-500/10 / border-red-500/20
Success: text-emerald-400 / bg-emerald-500/10 / border-emerald-500/20
Warning: text-yellow-400 / bg-yellow-500/10 / border-yellow-500/20
Info:    text-brand-accent / bg-brand-accent/10 / border-brand-accent/20
```

### Social Platform Colors (defined in `SocialIcons.tsx`)
```
Instagram:  text-pink-500 (hex: #E4405F)
X/Twitter:  text-blue-400 (hex: #1DA1F2)
Facebook:   text-blue-600 (hex: #1877F2)
VK:         text-blue-500 (hex: #4A76A8)
WhatsApp:   text-green-500 (hex: #25D366)
Telegram:   text-blue-500 (hex: #0088CC)
```

**❗ Rule**: Always use `SocialIcons` component colors for social platform icons. Do NOT inline raw colors.

---

## 2. 📐 Layout Patterns

### Page Shell
```tsx
<div className="h-full flex flex-col bg-overlay">
  {/* Header — sticky top bar */}
  <header className="px-4 py-4 flex items-center gap-3 border-b border-border-default bg-card shrink-0">
    <button onClick={...} className="w-10 h-10 flex items-center justify-center rounded-xl bg-glass text-text-muted active:scale-95 transition-all">
      <ChevronLeft size={20} />
    </button>
    <h1 className="text-tiny font-black uppercase tracking-[0.2em]">PAGE TITLE</h1>
  </header>

  {/* Content — scrollable body */}
  <div className="flex-1 overflow-y-auto px-4 py-6">
    {/* page content */}
  </div>
</div>
```

### Profile Section Cards
```tsx
<div className="flex flex-col gap-2 w-full">
  {/* Each item is a full-width row with icon + label + value */}
  <div className="flex items-center gap-2.5 w-full">
    <Icon size={14} className="shrink-0" />
    <span className="text-xs font-bold">Label:</span>
    <span className="text-xs text-text-secondary">Value</span>
  </div>
</div>
```

### Social Links (Profile, UserProfileCard, DmChatPage)
```tsx
// Use flex-col with w-full items — consistent across ALL profile components
<div className="flex flex-col gap-2 w-full">
  <a href={link} target="_blank" rel="noopener noreferrer"
     onClick={(e) => { e.stopPropagation(); }}
     className="flex items-center gap-2.5 w-full bg-glass rounded-xl px-3 py-2.5 hover:bg-glass-hover transition-colors active:scale-[0.98]">
    <SocialIcon size={14} className="shrink-0 [color] text-text-primary" />
    <span className="text-xs font-bold text-text-secondary truncate">@{handle}</span>
  </a>
</div>
```

### Work & Education Cards
```tsx
// Use flex-col with w-full items — consistent across ALL profile components
<div className="flex flex-col gap-2 w-full">
  <div className="flex items-center gap-2.5 w-full">
    <Icon size={14} className="shrink-0 text-text-muted" />
    <div className="flex flex-col">
      <span className="text-xs font-bold">Job Title</span>
      <span className="text-nano text-text-muted">Company</span>
    </div>
  </div>
</div>
```

### Message Bubbles
```tsx
// My messages → right aligned (flex-row-reverse + justify-start)
// Other messages → left aligned (flex-row + justify-start)
<div className={cn("flex gap-3 mb-6 w-full max-w-[85%]",
  isMe ? "flex-row-reverse ml-auto" : "flex-row")}>

  {/* Bubble content */}
  <div className={cn("rounded-2xl px-3.5 py-2.5 max-w-[280px]",
    isMe
      ? "bg-gradient-to-r from-brand-primary to-brand-secondary"
      : "bg-card border border-border-default")}>
    <p className="text-tiny font-semibold leading-relaxed">{message}</p>
  </div>
</div>
```

---

## 3. 🔘 Button Styles

### Primary Action (Brand Gradient)
```tsx
<button className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary
  text-text-primary text-xs font-black uppercase tracking-widest
  shadow-lg shadow-brand-secondary/20 active:scale-95 transition-transform
  flex items-center justify-center gap-2">
  ACTION TEXT
</button>
```

### Secondary Action (Glass)
```tsx
<button className="w-full py-3 rounded-xl bg-glass text-text-primary text-xs font-black
  uppercase tracking-widest hover:bg-glass-hover active:scale-95 transition-all
  flex items-center justify-center gap-2 border border-border-default">
  ACTION TEXT
</button>
```

### Destructive Action (Red)
```tsx
<button className="w-full py-4 rounded-xl border border-red-500/30 bg-red-500/10
  text-red-400 text-xs font-black uppercase tracking-widest
  hover:bg-red-500/20 active:scale-95 transition-all
  flex items-center justify-center gap-2">
  DELETE / REPORT
</button>
```

### Icon Button (Back, Close)
```tsx
<button className="w-10 h-10 flex items-center justify-center rounded-xl
  bg-glass text-text-muted active:scale-95 transition-all">
  <Icon size={20} />
</button>
```

### Action Button Sizing
- **Standard width**: `w-full` within a `max-w-sm` container (384px)
- **Full-width** (when spanning the page): `w-full` without `max-w-sm`
- **Icon-only**: `w-10 h-10` with `rounded-xl`

---

## 4. 📝 Form Inputs

### Text Input
```tsx
<input type="text" placeholder="PLACEHOLDER"
  className="w-full bg-glass hover:bg-glass border border-border-default rounded-xl
    py-2 px-3 text-tiny font-bold placeholder:text-text-faint
    outline-none focus:border-brand-accent focus:bg-glass-hover transition-all" />
```

### Select Dropdown
```tsx
<select className="w-full bg-glass border border-border-default rounded-xl py-2.5 px-3
  text-tiny font-bold text-text-primary outline-none
  focus:border-brand-accent focus:bg-glass-hover transition-all appearance-none">
  <option value="" disabled>SELECT OPTION</option>
  <option value="val">Option</option>
</select>
```

### Error State
```tsx
// Add to input: focus:border-red-500/50
// Add error message below:
{error && <p className="text-nano font-bold text-red-400 mt-1">{error}</p>}
```

---

## 5. 🔄 Loading & Empty States

### Loading Spinner
```tsx
<div className="flex-1 flex items-center justify-center">
  <div className="flex flex-col items-center gap-3">
    <div className="w-8 h-8 rounded-full border-2 border-brand-accent/30 border-t-brand-accent animate-spin" />
    <p className="text-tiny font-bold text-text-faint uppercase tracking-widest animate-pulse">Loading...</p>
  </div>
</div>
```

### Empty State
```tsx
<div className="flex-1 flex flex-col items-center justify-center py-20 px-10 text-center">
  <div className="w-24 h-24 rounded-4xl bg-card border border-border-default
    flex items-center justify-center mb-8 shadow-2xl">
    <Icon size={40} className="text-text-faint" />
  </div>
  <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-2">No items yet</h3>
  <p className="text-tiny text-text-muted max-w-xs">Helper description text</p>
</div>
```

---

## 6. 🧩 Component-Specific Patterns

### Bottom Nav
- Fixed at bottom, 4 tabs: Swipe (Layers), Chats (MessageSquare), Party (PartyPopper), Profile (User)
- Active state: `text-brand-primary`
- Hidden on `/chat/*` and `/admin` routes
- Safe-area-aware padding via `env(safe-area-inset-bottom)`

### Photo Carousel (PhotoCarousel component)
- Aspect ratio controlled via container height
- Navigation via swipe + arrow buttons + dots
- Overlays: gradient fades on top/bottom edges

### Chat Messages
- Date separators: centered text with `text-nano font-bold text-text-faint`
- Photo messages: rounded-2xl with max-height, no pointer on sent
- Video messages: thumbnail with play icon overlay, rounded-2xl

### Error/Success Messages (Toast — useToast hook)
- Positioned at bottom of screen
- Auto-dismiss after configurable duration
- Types: success (`bg-emerald-500/90`), error (`bg-red-600/90`), info (`bg-brand-accent/90`)

---

## 7. ✅ Component Consistency Checklist

When adding or modifying a UI component, verify:

- [ ] Uses theme tokens (`text-text-primary`, `bg-card`, etc.) instead of raw colors (except status/social colors)
- [ ] Social icons use `SocialIcons` component colors, not inline `text-*` classes
- [ ] Message bubbles follow the left/right alignment pattern
- [ ] Profile sections (Work & Education, Social Links) use the same `flex-col gap-2 w-full` pattern
- [ ] Action buttons use standard sizing (max-w-sm for constrained, w-full for full-width)
- [ ] Form inputs all use the same `bg-glass border-border-default rounded-xl py-2 px-3` base
- [ ] Page shells follow the `flex flex-col bg-overlay` → header → content pattern
- [ ] Loading/empty states follow standard patterns above

---

## 8. ⚠️ Common Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---|---|
| `text-pink-500` directly on a social icon | Use `SocialIcons` component which defines correct colors |
| `className="flex"` for message alignment | Use `flex-row-reverse ml-auto` for sent, `flex-row` for received |
| `grid grid-cols-2` for social links in sidebars | Use `flex flex-col gap-2 w-full` (consistent with ProfilePage) |
| Raw `bg-[#HEX]` when a theme token exists | Use `bg-card`, `bg-base`, etc. |
| `border-red-500` for non-error borders | Use `border-border-default` or `border-border-subtle` |
| Inline SVG icons for social platforms | Import from `SocialIcons.tsx` (single source of truth for colors) |
