# 🎨 UI/UX TASK: Dashboard Improvements (Period Selector + Target Speedometer)

**Date:** 2026-01-08  
**From:** UI System / Consistency  
**To:** Code Writer  
**Priority:** Medium  
**Status:** READY FOR IMPLEMENTATION  

---

## 📋 User Request

> "Target секцию надо улучшить. спидометр должен быть хорошо прорисован и визуально лучше выглядеть. 
> секуция выбора периода должна показывать что-то типа Showing period. Должны быть небольшие значки полей. 
> Попробуй сделать выбор периодов как это реализовано в Shopify"

**Приложены скриншоты Shopify** с примером дизайна period selector.

---

## ✅ STATUS CHECK

**PeriodSelector:** ✅ Частично готов (основная структура есть, но нужна доработка)  
**TargetSpeedometer:** ❌ Нужна полная переработка  

---

## 🎯 TASK 1: Period Selector (Shopify-style)

### Current State
- Простой `<select>` элемент
- Нет визуального контекста выбранного диапазона
- Нет иконок

### Desired State (Shopify-style)

```
┌─────────────────────────────────────────────────┐
│ 📅  Showing: 1 Dec 2024 - 30 Dec 2024    ▼     │
└─────────────────────────────────────────────────┘
```

При клике открывается dropdown:

```
┌─────────────────────────────────────────────────┐
│ ✓  This Month                                   │
│    Last Month                                   │
│    Last 3 Months                                │
│    Last 6 Months                                │
│ ────────────────────────────────────────────── │
│    CUSTOM RANGE                                 │
│    [DateRangePicker Component]                  │
└─────────────────────────────────────────────────┘
```

### Implementation Details

#### File: `components/dashboard/PeriodSelector.tsx`

**Changes needed:**

1. **Add Props:**
```typescript
interface PeriodSelectorProps {
  value: PeriodType;
  onChange: (period: PeriodType, startDate?: string, endDate?: string) => void;
  className?: string;
  startDate?: string;  // ADD THIS
  endDate?: string;    // ADD THIS
}
```

2. **Button Structure (replace select):**
```tsx
<button className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 ...">
  {/* Calendar Icon */}
  <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
  
  {/* Label */}
  <span className="text-gray-600 text-xs">Showing:</span>
  
  {/* Date Range */}
  <span className="font-semibold text-gray-900">
    {startDate && endDate 
      ? `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`
      : getPeriodLabel(value)
    }
  </span>
  
  {/* Arrow */}
  <svg className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
</button>
```

3. **Add Date Formatter:**
```typescript
const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};
```

4. **Dropdown Menu:**
```tsx
{isOpen && (
  <div className="absolute right-0 top-full mt-2 z-50 min-w-[280px] rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden animate-fadeInSlideDown">
    <div className="py-1">
      {/* Predefined periods with checkmarks */}
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => handlePeriodChange(period.value)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
            value === period.value
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          {value === period.value && (
            <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          <span className={value === period.value ? "" : "ml-7"}>{period.label}</span>
        </button>
      ))}
      
      {/* Separator */}
      <div className="border-t border-gray-200 my-1"></div>
      
      {/* Custom Range */}
      <div className="px-4 py-3">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Custom Range</div>
        <DateRangePicker
          label=""
          from={customStart}
          to={customEnd}
          onChange={handleCustomDatesChange}
        />
      </div>
    </div>
  </div>
)}
```

5. **Add State & Refs:**
```typescript
const [isOpen, setIsOpen] = useState(false);
const dropdownRef = useRef<HTMLDivElement>(null);

// Close dropdown when clicking outside
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);
```

6. **Update handlePeriodChange:**
```typescript
const handlePeriodChange = (period: PeriodType) => {
  if (period === "custom") return; // Keep open for custom
  
  // ... calculate dates ...
  
  onChange(period, formatDate(calculatedStartDate), formatDate(calculatedEndDate));
  setIsOpen(false); // Close after selection
};
```

#### File: `app/dashboard/page.tsx`

**Changes needed:**
```tsx
<PeriodSelector
  value={period}
  onChange={handlePeriodChange}
  startDate={periodStart}  // ADD THIS
  endDate={periodEnd}      // ADD THIS
/>
```

---

## 🎯 TASK 2: Target Speedometer (Professional Redesign)

### Current State
- Size: 200px
- Simple colored segments (4 colors)
- Basic needle without effects
- Text stars (★)
- No tick marks

### Desired State

**Visual mockup:**
```
┌────────────────────────────────────────────────┐
│ 📊 Monthly Target                              │
│                                                │
│            0%    25%   50%   75%   100%        │
│              ╱─────────────────╲               │
│            ╱    ━━━━━━━━━      ╲              │
│          ╱    ━━━━━━━━━━━━━     ╲            │
│        ╱    ━━━━━━━━━━━━━━━━━    ╲          │
│       │    ━━━━━━━━━━━━━━━━━━━    │         │
│       │         ╱                  │         │
│       │        ╱ (needle)          │         │
│       │       ●                    │         │
│        ╲                          ╱          │
│          ╲                      ╱            │
│            ╲──────────────────╱              │
│                                                │
│                  24.7%                         │
│          €8,900 of €36,000                    │
│          €27,100 remaining                    │
│                                                │
│          ★ ★ ★ ☆ ☆                            │
│                                                │
│          Keep pushing forward!                 │
└────────────────────────────────────────────────┘
```

### Implementation Details

#### File: `components/dashboard/TargetSpeedometer.tsx`

**Complete rewrite needed. Key changes:**

1. **Increase Size:**
```typescript
const size = 280; // was 200
const centerY = size / 2 + 20; // offset down for better balance
const radius = 100; // was 80
const strokeWidth = 24; // was 10
```

2. **Change to Semicircle (180°):**
```typescript
const startAngle = 180; // left
const endAngle = 360;   // right
const angleRange = 180;
const currentAngle = startAngle + (clampedPercentage / 100) * angleRange;
```

3. **Add Tick Marks:**
```typescript
// Generate tick marks (11 marks: 0%, 10%, 20%...100%)
const tickMarks = [];
for (let i = 0; i <= 10; i++) {
  const angle = startAngle + (i / 10) * angleRange;
  const innerRadius = radius - strokeWidth / 2 - 8;
  const outerRadius = radius - strokeWidth / 2 + (i % 2 === 0 ? 8 : 4); // Major/minor ticks
  
  const x1 = centerX + innerRadius * Math.cos(toRadians(angle));
  const y1 = centerY - innerRadius * Math.sin(toRadians(angle));
  const x2 = centerX + outerRadius * Math.cos(toRadians(angle));
  const y2 = centerY - outerRadius * Math.sin(toRadians(angle));
  
  tickMarks.push(
    <line
      key={i}
      x1={x1} y1={y1}
      x2={x2} y2={y2}
      stroke="#9ca3af"
      strokeWidth={i % 2 === 0 ? 2 : 1}
      strokeLinecap="round"
    />
  );
  
  // Add percentage labels at major ticks (0%, 20%, 40%...)
  if (i % 2 === 0) {
    const labelRadius = radius - strokeWidth / 2 + 22;
    const labelX = centerX + labelRadius * Math.cos(toRadians(angle));
    const labelY = centerY - labelRadius * Math.sin(toRadians(angle));
    tickMarks.push(
      <text
        key={`label-${i}`}
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-[10px] font-medium fill-gray-500"
      >
        {i * 10}%
      </text>
    );
  }
}
```

4. **Add SVG Gradients:**
```tsx
<defs>
  <linearGradient id="speedometerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stopColor={gradientStart} />
    <stop offset="100%" stopColor={gradientEnd} />
  </linearGradient>
</defs>
```

5. **Add Glow Filter for Needle:**
```tsx
<filter id="needleGlow" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
  <feMerge>
    <feMergeNode in="coloredBlur"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>
```

6. **Add Shadow Filter:**
```tsx
<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
  <feOffset dx="0" dy="2" result="offsetblur"/>
  <feComponentTransfer>
    <feFuncA type="linear" slope="0.2"/>
  </feComponentTransfer>
  <feMerge>
    <feMergeNode/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>
```

7. **Improve Color Gradation (5 levels):**
```typescript
const getGradientColors = (pct: number): [string, string] => {
  if (pct < 25) return ["#dc2626", "#ef4444"];   // red-600 → red-500
  if (pct < 50) return ["#ea580c", "#f97316"];   // orange-600 → orange-500
  if (pct < 75) return ["#ca8a04", "#eab308"];   // yellow-600 → yellow-500
  if (pct < 90) return ["#65a30d", "#84cc16"];   // lime-600 → lime-500
  return ["#059669", "#10b981"];                 // emerald-600 → emerald-500
};
```

8. **Arc Path Helper:**
```typescript
const describeArc = (
  x: number, y: number, r: number,
  startAngleDeg: number, endAngleDeg: number
) => {
  const start = toRadians(startAngleDeg);
  const end = toRadians(endAngleDeg);
  const startX = x + r * Math.cos(start);
  const startY = y - r * Math.sin(start);
  const endX = x + r * Math.cos(end);
  const endY = y - r * Math.sin(end);
  const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0;
  return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
};
```

9. **SVG Structure:**
```tsx
<svg width={size} height={size * 0.65} className="overflow-visible">
  <defs>
    {/* Gradients and filters here */}
  </defs>

  {/* Background arc (gray) */}
  <path
    d={describeArc(centerX, centerY, radius, startAngle, endAngle)}
    fill="none"
    stroke="#e5e7eb"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    filter="url(#shadow)"
  />

  {/* Progress arc with gradient */}
  <path
    d={describeArc(centerX, centerY, radius, startAngle, currentAngle)}
    fill="none"
    stroke="url(#speedometerGradient)"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    style={{
      transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
    }}
  />

  {/* Tick marks */}
  {tickMarks}

  {/* Center circle (base of needle) */}
  <circle cx={centerX} cy={centerY} r="12" fill="white" stroke="#e5e7eb" strokeWidth="2" />
  <circle cx={centerX} cy={centerY} r="8" fill={color} />

  {/* Needle with glow */}
  <line
    x1={centerX} y1={centerY}
    x2={needleX} y2={needleY}
    stroke={color}
    strokeWidth="4"
    strokeLinecap="round"
    filter="url(#needleGlow)"
    style={{
      transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
    }}
  />
</svg>
```

10. **Info Section Below Speedometer:**
```tsx
<div className="mt-6 w-full space-y-4">
  {/* Percentage */}
  <div className="text-center">
    <div className="text-4xl font-bold text-gray-900 mb-1">
      {percentage.toFixed(1)}%
    </div>
    <div className="text-sm text-gray-600">
      <span className="font-semibold text-gray-900">€{current.toLocaleString()}</span>
      {" "}of{" "}
      <span className="font-semibold text-gray-900">€{target.toLocaleString()}</span>
    </div>
    <div className="text-xs text-gray-500 mt-1">
      €{(target - current).toLocaleString()} remaining
    </div>
  </div>

  {/* Rating Stars */}
  <div className="flex items-center justify-center gap-1 py-2 border-t border-gray-100">
    {[1, 2, 3, 4, 5].map((star) => (
      <svg
        key={star}
        className={`h-5 w-5 ${star <= rating ? "text-yellow-400" : "text-gray-300"}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>

  {/* Message */}
  <p className="text-center text-sm text-gray-600 italic">{message}</p>
</div>
```

11. **Update Card Styles:**
```tsx
<div className="rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] border border-gray-100/50">
  {/* Header with icon */}
  <div className="flex items-center gap-2 mb-4">
    <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
    <h3 className="text-lg font-semibold text-gray-900">Monthly Target</h3>
  </div>
  
  {/* Speedometer content */}
</div>
```

---

## 🎨 Design System Compliance

### Colors
- **Gray scale:** gray-50, gray-100, gray-200, gray-300, gray-400, gray-500, gray-600, gray-900
- **Blue (active):** blue-50, blue-600, blue-700
- **Progress colors:**
  - Red: red-600 (#dc2626) → red-500 (#ef4444)
  - Orange: orange-600 (#ea580c) → orange-500 (#f97316)
  - Yellow: yellow-600 (#ca8a04) → yellow-500 (#eab308)
  - Lime: lime-600 (#65a30d) → lime-500 (#84cc16)
  - Emerald: emerald-600 (#059669) → emerald-500 (#10b981)

### Spacing
- Padding: `p-6`, `px-4`, `py-2`, `py-2.5`, `py-3`
- Gap: `gap-1`, `gap-2`, `gap-3`
- Margin: `mt-2`, `mt-4`, `mt-6`, `mb-1`, `mb-2`, `mb-4`

### Typography
- Headers: `text-lg font-semibold`
- Body: `text-sm`, `text-xs`
- Bold: `font-semibold`, `font-bold`
- Labels: `text-4xl font-bold` (percentage)
- Small text: `text-[10px]`

### Borders & Shadows
- Border radius: `rounded-lg`, `rounded-xl`, `rounded-2xl`
- Borders: `border border-gray-100/50`, `border-gray-200`, `border-gray-300`
- Shadows: `shadow-sm`, `shadow-lg`, `shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)]`

### Transitions
- Duration: `0.8s` (speedometer needle), `300ms` (hover)
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (smooth)
- Properties: `all`, `colors`, `transform`

### Accessibility
- Focus states: `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`
- Hover states: `hover:bg-gray-50`, `hover:border-gray-400`
- Semantic HTML: `<button>`, proper SVG `aria-hidden` or `role`
- Color contrast: WCAG AA compliant

---

## 📦 Dependencies

All required dependencies already exist:
- ✅ `@/components/DateRangePicker`
- ✅ Animation `fadeInSlideDown` in `app/globals.css`
- ✅ Tailwind CSS
- ✅ React hooks (useState, useEffect, useRef)

---

## 🧪 Testing Requirements

After implementation, QA should verify:

1. **PeriodSelector:**
   - ✅ Button shows "Showing:" label with date range
   - ✅ Calendar icon appears
   - ✅ Dropdown opens/closes on click
   - ✅ Dropdown closes when clicking outside
   - ✅ Checkmark appears on selected period
   - ✅ Hover effects work
   - ✅ Custom range DateRangePicker works
   - ✅ Date format is correct (1 Dec 2024)
   - ✅ Keyboard navigation (Tab, Enter, Esc)

2. **TargetSpeedometer:**
   - ✅ Speedometer is 280px (larger than before)
   - ✅ Tick marks appear (0%, 10%...100%)
   - ✅ Percentage labels show at major ticks
   - ✅ Gradient applies to progress arc
   - ✅ Needle has glow effect
   - ✅ Needle animates smoothly (0.8s)
   - ✅ Colors change based on percentage
   - ✅ Percentage shows with 1 decimal (24.7%)
   - ✅ Remaining amount calculates correctly
   - ✅ Stars render as SVG (not text)
   - ✅ Card has modern styling (backdrop-blur, shadows)

---

## 📝 Acceptance Criteria

- [ ] PeriodSelector matches Shopify design
- [ ] TargetSpeedometer is visually impressive
- [ ] No console errors or warnings
- [ ] No linter errors
- [ ] Responsive on mobile/tablet/desktop
- [ ] Smooth animations (60fps)
- [ ] Accessibility (WCAG AA)
- [ ] Code is clean and maintainable

---

## 🚀 Ready for Code Writer

**Estimated time:** 2-3 hours

**Files to modify:**
1. `components/dashboard/PeriodSelector.tsx` (~200 lines)
2. `components/dashboard/TargetSpeedometer.tsx` (~280 lines)
3. `app/dashboard/page.tsx` (minor update - add props)

**Next steps:**
1. Runner assigns task to Code Writer
2. Code Writer implements changes
3. Code Writer commits with descriptive message
4. Runner assigns to QA for testing
5. QA verifies all acceptance criteria
6. QA assigns SCORE (target: 9/10)

---

**Created by:** UI System / Consistency  
**For:** Code Writer  
**Approved by:** [Awaiting Runner approval]
