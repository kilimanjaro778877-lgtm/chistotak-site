"""
FINAL color fix: everything → strict BLACK + GOLD only
Background: #0a0a0b | Cards: #111113 | Gold: #d4a017 | Text: #f5f0e0
"""
import os, re, glob

BASE = r"C:\Users\Admin\chistotak-site"

REPLACEMENTS = [
    # ── BACKGROUNDS ──────────────────────────────────────────────────────
    # White/light backgrounds → dark
    ("background:#ffffff",          "background:#111113"),
    ("background: #ffffff",         "background: #111113"),
    ("background-color:#ffffff",    "background-color:#0a0a0b"),
    ("background-color: #ffffff",   "background-color:#0a0a0b"),
    ("background:#f8fafc",          "background:#111113"),
    ("background:#f1f5f9",          "background:#1a1a1d"),
    ("background:#f9fafb",          "background:#111113"),
    ("background: white",           "background: #111113"),
    ("background:white",            "background:#111113"),
    ("bg-white",                    "bg-zinc-900"),
    ("bg-gray-50",                  "bg-zinc-900"),
    ("bg-gray-100",                 "bg-zinc-800"),
    # Section backgrounds
    ("section--tint",               "section--dark"),
    ("background: var(--bg-soft)",  "background: var(--bg-soft)"),

    # ── BLUE COLORS → GOLD ───────────────────────────────────────────────
    ("rgba(102,128,255",            "rgba(212,160,23"),
    ("rgba(51,85,255",              "rgba(212,160,23"),
    ("rgba(100,51,255",             "rgba(180,130,10"),
    ("#3355ff",                     "#d4a017"),
    ("#0022dd",                     "#92690a"),
    ("#0011ee",                     "#78540a"),
    ("#6680ff",                     "#d4a017"),
    ("#99aaff",                     "#d4a017"),
    ("#b3bbff",                     "#f0c040"),
    ("#2AABEE",                     "#d4a017"),

    # ── REMAINING GREEN → GOLD ───────────────────────────────────────────
    ("#22c55e",   "#d4a017"),
    ("#16a34a",   "#b7860b"),
    ("#15803d",   "#92690a"),
    ("#166534",   "#78540a"),
    ("#4ade80",   "#fbbf24"),
    ("#86efac",   "#fde68a"),
    ("#dcfce7",   "#fef3c7"),
    ("#bbf7d0",   "#fde68a"),
    ("#052e16",   "#4a3205"),
    ("rgba(34,197,94",   "rgba(212,160,23"),
    ("rgba(22,163,74",   "rgba(180,130,10"),
    ("rgba(22,101,52",   "rgba(120,84,10"),
    ("rgba(5,46,22",     "rgba(74,50,5"),

    # ── TEXT COLORS ───────────────────────────────────────────────────────
    # Light text on dark bg
    ("text-gray-900",    "text-zinc-100"),
    ("text-gray-800",    "text-zinc-200"),
    ("text-gray-700",    "text-zinc-300"),
    ("text-gray-600",    "text-zinc-400"),
    ("text-gray-500",    "text-zinc-500"),
    ("text-gray-400",    "text-zinc-600"),
    ("color:#111827",    "color:#f5f0e0"),
    ("color: #111827",   "color: #f5f0e0"),
    ("color:#374151",    "color:#c8b87a"),
    ("color: #374151",   "color: #c8b87a"),

    # ── BORDERS ───────────────────────────────────────────────────────────
    ("border-gray-200",  "border-zinc-700"),
    ("border-gray-100",  "border-zinc-800"),
    ("border-gray-300",  "border-zinc-600"),
    ("#e5e7eb",          "#2a2a2e"),
    ("#e2e8f0",          "#2a2a2e"),

    # ── CARD/SECTION STYLES ───────────────────────────────────────────────
    # Service cards white bg
    ("background:#ffffff;border:1px solid #2a2a2e",
     "background:#111113;border:1px solid #2a2a2e"),
    ("background: #ffffff; border: 1px solid",
     "background: #111113; border: 1px solid"),
    # feat-card
    ("background:#ffffff;border:1px solid",
     "background:#111113;border:1px solid"),
    # form bg
    ("bg-white border border-gray-200 rounded-3xl",
     "bg-zinc-900 border border-zinc-700 rounded-3xl"),
    ("bg-gray-50 border border-gray-200",
     "bg-zinc-900 border border-zinc-700"),

    # ── INPUT FIELDS ──────────────────────────────────────────────────────
    ("bg-white border border-gray-200 focus:border-green-400",
     "bg-zinc-800 border border-zinc-600 focus:border-yellow-500"),
    ("bg-white border border-gray-300 focus:border-green-400",
     "bg-zinc-800 border border-zinc-600 focus:border-yellow-500"),

    # ── BODY ──────────────────────────────────────────────────────────────
    ("background-color:#f8fafc",  "background-color:#0a0a0b"),
    ("background-color: #f8fafc", "background-color:#0a0a0b"),
    ("background-color:#f1f5f9",  "background-color:#111113"),
    # Dot pattern
    ("rgba(34,197,94,0.04) 1px",  "rgba(212,160,23,0.04) 1px"),
    ("rgba(212,160,23,0.04) 1px,transparent 1px",
     "rgba(212,160,23,0.04) 1px,transparent 1px"),

    # ── HEADER/FOOTER ─────────────────────────────────────────────────────
    ("bg-white/95 backdrop-blur-lg border-b border-gray-200",
     "bg-zinc-950/95 backdrop-blur-lg border-b border-zinc-800"),
    ("bg-white border-t border-gray-200",
     "bg-zinc-950 border-t border-zinc-800"),
    ("bg-white/98",  "bg-zinc-950/98"),

    # ── TAILWIND CONFIG ───────────────────────────────────────────────────
    ("900:'#0a0a0b',800:'#121214',700:'#1a1a1d',600:'#262629'",
     "900:'#0a0a0b',800:'#111113',700:'#1a1a1d',600:'#2a2a2e'"),
    # ink palette in configs
    ("900:'#ffffff',800:'#f8fafc',700:'#f1f5f9',600:'#e2e8f0',500:'#cbd5e1'",
     "900:'#0a0a0b',800:'#111113',700:'#1a1a1d',600:'#2a2a2e',500:'#3a3a3f'"),
    ("900: '#ffffff', 800: '#f8fafc', 700: '#f1f5f9', 600: '#e2e8f0', 500: '#cbd5e1'",
     "900: '#0a0a0b', 800: '#111113', 700: '#1a1a1d', 600: '#2a2a2e', 500: '#3a3a3f'"),
    # gold palette
    ("50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#4ade80',400:'#22c55e',500:'#16a34a',600:'#15803d',700:'#166534'",
     "50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fbbf24',400:'#d4a017',500:'#b7860b',600:'#92690a',700:'#78540a'"),
    ("50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#4ade80',400:'#d4a017',500:'#b7860b',600:'#92690a',700:'#78540a'",
     "50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fbbf24',400:'#d4a017',500:'#b7860b',600:'#92690a',700:'#78540a'"),

    # ── SPECIAL ───────────────────────────────────────────────────────────
    # gradient-bg section
    ("rgba(102,128,255,0.18), transparent",  "rgba(212,160,23,0.08), transparent"),
    ("rgba(102,128,255,0.08), transparent",  "rgba(212,160,23,0.04), transparent"),
    # shadow green
    ("shadow-green-500/10",  "shadow-yellow-500/10"),
    ("shadow-green-500/30",  "shadow-yellow-500/30"),
    ("shadow-green-100",     "shadow-yellow-900"),
    # Tailwind utility classes
    ("text-green-600",  "text-yellow-500"),
    ("text-green-700",  "text-yellow-600"),
    ("bg-green-50",    "bg-zinc-900"),
    ("border-green-200", "border-yellow-800"),
    ("ring-green-400",   "ring-yellow-500"),
    # gold-gradient-text
    ("linear-gradient(135deg,#fbbf24 0%,#d4a017 50%,#b7860b 100%)",
     "linear-gradient(135deg,#fde68a 0%,#d4a017 50%,#92690a 100%)"),
    ("linear-gradient(135deg, #fbbf24 0%, #d4a017 50%, #b7860b 100%)",
     "linear-gradient(135deg, #fde68a 0%, #d4a017 50%, #92690a 100%)"),
]

# Also add CSS overrides directly to every file
EXTRA_CSS = """
    /* ЧистоТак — dark theme override */
    body { background-color: #0a0a0b !important; color: #f5f0e0 !important; }
    .bg-white, .bg-gray-50, [class*="bg-white"] { background-color: #111113 !important; }
    .text-gray-900, .text-gray-800, .text-gray-700 { color: #f5f0e0 !important; }
    .text-gray-500, .text-gray-400 { color: #a09070 !important; }
    .border-gray-200, .border-gray-100 { border-color: #2a2a2e !important; }
    input, select, textarea { background-color: #1a1a1d !important; color: #f5f0e0 !important; border-color: #3a3a3f !important; }
"""

total = 0
for path in glob.glob(BASE + "/**/*.html", recursive=True):
    with open(path, encoding='utf-8') as f:
        html = f.read()
    new = html

    for old, nw in REPLACEMENTS:
        new = new.replace(old, nw)

    # Inject extra CSS before </style>
    if EXTRA_CSS.strip() not in new and '</style>' in new:
        new = new.replace('</style>', EXTRA_CSS + '\n  </style>', 1)

    if new != html:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new)
        total += 1
        print(f"FIXED: {os.path.relpath(path, BASE)}")

print(f"\nDone — {total} files.")
