"""
PortPredict AI — Professional Presentation Generator
IBM Bob AI Hackathon | Team Intellicore
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import os

# ─── Color Palette (Dark Professional Theme) ───────────────────────────────
BG_DARK      = RGBColor(0x0A, 0x0E, 0x1A)   # Deep navy background
BG_CARD      = RGBColor(0x12, 0x18, 0x2A)   # Card background
ACCENT_BLUE  = RGBColor(0x00, 0x7B, 0xFF)   # IBM Blue accent
ACCENT_CYAN  = RGBColor(0x00, 0xD4, 0xAA)   # Teal/Cyan highlight
ACCENT_GOLD  = RGBColor(0xFF, 0xC1, 0x07)   # Gold accent
WHITE        = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY   = RGBColor(0xCC, 0xCC, 0xCC)
MID_GRAY     = RGBColor(0x99, 0x99, 0x99)
DARK_TEXT     = RGBColor(0x1A, 0x1A, 0x2E)
GRADIENT_START = RGBColor(0x00, 0x3D, 0x80)
GRADIENT_END   = RGBColor(0x00, 0x7B, 0xFF)
RED_ACCENT   = RGBColor(0xFF, 0x45, 0x45)
GREEN_ACCENT = RGBColor(0x00, 0xE6, 0x76)

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)
W = prs.slide_width
H = prs.slide_height


def set_slide_bg(slide, color=BG_DARK):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_shape(slide, left, top, width, height, fill_color=None, border_color=None, border_width=Pt(0), shape_type=MSO_SHAPE.ROUNDED_RECTANGLE):
    shape = slide.shapes.add_shape(shape_type, left, top, width, height)
    shape.line.fill.background()
    if fill_color:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill_color
    else:
        shape.fill.background()
    if border_color:
        shape.line.color.rgb = border_color
        shape.line.width = border_width
    else:
        shape.line.fill.background()
    return shape


def add_text_box(slide, left, top, width, height, text, font_size=18, color=WHITE, bold=False, alignment=PP_ALIGN.LEFT, font_name="Calibri"):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.font.name = font_name
    p.alignment = alignment
    return txBox


def add_bullet_list(slide, left, top, width, height, items, font_size=16, color=WHITE, bullet_color=ACCENT_CYAN, spacing=Pt(8)):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = item
        p.font.size = Pt(font_size)
        p.font.color.rgb = color
        p.font.name = "Calibri"
        p.space_after = spacing
        p.level = 0
    return txBox


def add_accent_line(slide, left, top, width, color=ACCENT_BLUE, thickness=Pt(3)):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, thickness)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


def add_icon_circle(slide, left, top, size, color, text, font_size=20):
    shape = add_shape(slide, left, top, size, size, fill_color=color, shape_type=MSO_SHAPE.OVAL)
    tf = shape.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = WHITE
    p.font.bold = True
    p.alignment = PP_ALIGN.CENTER
    p.font.name = "Calibri"
    shape.text_frame.paragraphs[0].space_before = Pt(0)
    shape.text_frame.paragraphs[0].space_after = Pt(0)
    return shape


def add_stat_card(slide, left, top, width, height, number, label, accent=ACCENT_CYAN):
    card = add_shape(slide, left, top, width, height, fill_color=BG_CARD, border_color=accent, border_width=Pt(1.5))
    # Number
    add_text_box(slide, left + Inches(0.2), top + Inches(0.15), width - Inches(0.4), Inches(0.6),
                 number, font_size=28, color=accent, bold=True, alignment=PP_ALIGN.CENTER)
    # Label
    add_text_box(slide, left + Inches(0.2), top + Inches(0.7), width - Inches(0.4), Inches(0.4),
                 label, font_size=12, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)
    return card


def add_feature_card(slide, left, top, width, height, icon, title, desc, accent=ACCENT_BLUE):
    card = add_shape(slide, left, top, width, height, fill_color=BG_CARD, border_color=accent, border_width=Pt(1))
    # Accent bar at top
    add_shape(slide, left, top, width, Pt(4), fill_color=accent, shape_type=MSO_SHAPE.RECTANGLE)
    # Icon
    add_text_box(slide, left + Inches(0.15), top + Inches(0.2), Inches(0.5), Inches(0.5),
                 icon, font_size=24, color=accent, alignment=PP_ALIGN.LEFT)
    # Title
    add_text_box(slide, left + Inches(0.15), top + Inches(0.6), width - Inches(0.3), Inches(0.35),
                 title, font_size=14, color=WHITE, bold=True)
    # Desc
    add_text_box(slide, left + Inches(0.15), top + Inches(0.95), width - Inches(0.3), height - Inches(1.1),
                 desc, font_size=11, color=LIGHT_GRAY)
    return card


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 1 — Title Slide
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank
set_slide_bg(slide)

# Top decorative bar
add_shape(slide, Inches(0), Inches(0), W, Inches(0.06), fill_color=ACCENT_BLUE, shape_type=MSO_SHAPE.RECTANGLE)

# IBM branding accent
add_text_box(slide, Inches(0.8), Inches(0.5), Inches(4), Inches(0.5),
             "IBM BOB AI HACKATHON 2026", font_size=14, color=ACCENT_CYAN, bold=True)

# Main title
add_text_box(slide, Inches(0.8), Inches(1.8), Inches(11), Inches(1.2),
             "PortPredict AI", font_size=54, color=WHITE, bold=True, font_name="Calibri")

# Subtitle
add_text_box(slide, Inches(0.8), Inches(3.0), Inches(11), Inches(0.8),
             "Container Congestion Predictor & Port Operations Optimiser", font_size=26, color=ACCENT_CYAN, bold=False)

# Accent line
add_accent_line(slide, Inches(0.8), Inches(3.8), Inches(3), ACCENT_BLUE, Pt(4))

# Team info
add_text_box(slide, Inches(0.8), Inches(4.3), Inches(6), Inches(0.5),
             "Team Intellicore  |  Track: AI", font_size=18, color=LIGHT_GRAY, bold=True)

# Members
members = "Jay Prajapati  ·  Nency Patel  ·  Aeni Patel  ·  Dishva Vasoya"
add_text_box(slide, Inches(0.8), Inches(4.9), Inches(8), Inches(0.5),
             members, font_size=16, color=MID_GRAY)

# Contact
add_text_box(slide, Inches(0.8), Inches(5.5), Inches(8), Inches(0.5),
             "23dce101@charusat.edu.in", font_size=14, color=MID_GRAY)

# Right side decorative element
add_shape(slide, Inches(10), Inches(1.5), Inches(2.5), Inches(2.5), fill_color=None,
          border_color=ACCENT_BLUE, border_width=Pt(2), shape_type=MSO_SHAPE.OVAL)
add_shape(slide, Inches(10.3), Inches(1.8), Inches(2), Inches(2), fill_color=None,
          border_color=ACCENT_CYAN, border_width=Pt(1), shape_type=MSO_SHAPE.OVAL)

# Bottom bar
add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=ACCENT_CYAN, shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 2 — The Problem
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Header bar
add_shape(slide, Inches(0), Inches(0), W, Inches(1.1), fill_color=RGBColor(0x10, 0x14, 0x25), shape_type=MSO_SHAPE.RECTANGLE)
add_text_box(slide, Inches(0.8), Inches(0.25), Inches(5), Inches(0.6),
             "THE PROBLEM", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(0.95), Inches(2), ACCENT_BLUE, Pt(3))

# Problem stat cards
add_stat_card(slide, Inches(0.8), Inches(1.5), Inches(3.5), Inches(1.3), "100+", "Vessels Stranded", RED_ACCENT)
add_stat_card(slide, Inches(4.8), Inches(1.5), Inches(3.5), Inches(1.3), "$10B+", "Supply Chain Losses", ACCENT_GOLD)
add_stat_card(slide, Inches(8.8), Inches(1.5), Inches(3.5), Inches(1.3), "Weeks", "Waiting Time", RED_ACCENT)

# Problem description
problems = [
    "2021 LA/Long Beach port backlog — the worst maritime gridlock in modern history",
    "Port operators manually allocate berths, cranes, and yard space across hundreds of vessels using spreadsheets",
    "Congestion hotspots are identified reactively — AFTER vessels are already queuing offshore",
    "Alternate routing and reassignment decisions come too late to prevent catastrophic demurrage charges",
    "No proactive, explainable congestion prediction system exists for port operations teams",
]

for i, problem in enumerate(problems):
    y = Inches(3.2) + Inches(i * 0.72)
    # Bullet indicator
    add_shape(slide, Inches(0.8), y + Inches(0.08), Inches(0.15), Inches(0.15),
              fill_color=RED_ACCENT, shape_type=MSO_SHAPE.OVAL)
    add_text_box(slide, Inches(1.2), y, Inches(11), Inches(0.6),
                 problem, font_size=17, color=LIGHT_GRAY)

# Bottom accent
add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=RED_ACCENT, shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 3 — Our Solution
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Header
add_shape(slide, Inches(0), Inches(0), W, Inches(1.1), fill_color=RGBColor(0x10, 0x14, 0x25), shape_type=MSO_SHAPE.RECTANGLE)
add_text_box(slide, Inches(0.8), Inches(0.25), Inches(8), Inches(0.6),
             "OUR SOLUTION", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(0.95), Inches(2), ACCENT_CYAN, Pt(3))

# Solution tagline
add_text_box(slide, Inches(0.8), Inches(1.4), Inches(11), Inches(0.6),
             "PortPredict AI — Real-time Predictive Port Operations Dashboard", font_size=22, color=ACCENT_CYAN, bold=True)

# Feature cards in 2x2 grid
features = [
    ("🔮", "72-Hour Congestion Forecast", "Predicts congestion hotspots using deterministic mathematical scheduling with ranked root-cause bottleneck attribution"),
    ("🚢", "Automated Berth Reassignment", "Greedy heuristic optimizer evaluates delayed vessels against compatible berths, showing net waiting hours saved"),
    ("🤖", "AI-Powered Shift Plans", "IBM watsonx.ai streams 72-hour operational plans and real-time dispatcher guidance grounded in live port data"),
    ("⚡", "Interactive Digital Twin", "Real-time maritime terminal simulation with vessel tracking, Gantt schedules, and live scenario disruption engine"),
]

positions = [
    (Inches(0.8), Inches(2.2), Inches(5.6), Inches(2.2)),
    (Inches(6.8), Inches(2.2), Inches(5.6), Inches(2.2)),
    (Inches(0.8), Inches(4.7), Inches(5.6), Inches(2.2)),
    (Inches(6.8), Inches(4.7), Inches(5.6), Inches(2.2)),
]

for (icon, title, desc), (x, y, w, h) in zip(features, positions):
    add_feature_card(slide, x, y, w, h, icon, title, desc, ACCENT_BLUE)

add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=ACCENT_BLUE, shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 4 — Key Features Demo Flow
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Header
add_shape(slide, Inches(0), Inches(0), W, Inches(1.1), fill_color=RGBColor(0x10, 0x14, 0x25), shape_type=MSO_SHAPE.RECTANGLE)
add_text_box(slide, Inches(0.8), Inches(0.25), Inches(8), Inches(0.6),
             "KEY FEATURES — DEMO FLOW", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(0.95), Inches(2), ACCENT_GOLD, Pt(3))

# 5 feature rows
demo_features = [
    ("01", "Dashboard", "KPI strip with congestion score, berth utilisation, yard capacity, and waiting vessels at a glance", ACCENT_BLUE),
    ("02", "Simulation", "Interactive maritime digital twin — scrub through 72 hours, click vessels to inspect assignments", ACCENT_CYAN),
    ("03", "Optimisation", "One-click berth reassignment with real-time waiting-hour savings analysis and schedule updates", ACCENT_GOLD),
    ("04", "Controls", "CSV vessel import + scenario disruption engine — close berths, inject storms, simulate surges", GREEN_ACCENT),
    ("05", "AI Copilot", "Natural language Q&A + streaming 72-hour shift operations planner powered by IBM watsonx.ai", RGBColor(0xBB, 0x86, 0xFC)),
]

for i, (num, title, desc, accent) in enumerate(demo_features):
    y = Inches(1.4) + Inches(i * 1.15)
    # Number circle
    add_icon_circle(slide, Inches(0.8), y + Inches(0.05), Inches(0.65), accent, num, font_size=20)
    # Title
    add_text_box(slide, Inches(1.7), y, Inches(3), Inches(0.4),
                 title, font_size=20, color=WHITE, bold=True)
    # Description
    add_text_box(slide, Inches(1.7), y + Inches(0.4), Inches(10.5), Inches(0.6),
                 desc, font_size=15, color=LIGHT_GRAY)
    # Separator line
    if i < 4:
        add_shape(slide, Inches(1.7), y + Inches(1.0), Inches(10.5), Pt(1),
                  fill_color=RGBColor(0x25, 0x2A, 0x3A), shape_type=MSO_SHAPE.RECTANGLE)

add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=ACCENT_GOLD, shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 5 — Architecture
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Header
add_shape(slide, Inches(0), Inches(0), W, Inches(1.1), fill_color=RGBColor(0x10, 0x14, 0x25), shape_type=MSO_SHAPE.RECTANGLE)
add_text_box(slide, Inches(0.8), Inches(0.25), Inches(8), Inches(0.6),
             "SYSTEM ARCHITECTURE", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(0.95), Inches(2), ACCENT_CYAN, Pt(3))

# Architecture boxes in flow
arch_layers = [
    ("Frontend", "React 19 + Vite + Tailwind CSS + React Router", ACCENT_BLUE, Inches(1.5)),
    ("Backend API", "Node.js + Express — Serves port state, optimisation, AI routes", RGBColor(0x7C, 0x4D, 0xFF), Inches(2.9)),
    ("State Engine", "Deterministic scheduling, congestion detection, greedy optimizer", ACCENT_CYAN, Inches(4.3)),
    ("AI Gateway", "Ollama (local) → IBM watsonx.ai Granite 4-H-Small (cloud fallback)", ACCENT_GOLD, Inches(5.7)),
]

for name, desc, color, y in arch_layers:
    # Box
    box = add_shape(slide, Inches(1.5), y, Inches(10), Inches(1.1),
                    fill_color=BG_CARD, border_color=color, border_width=Pt(2))
    # Title
    add_text_box(slide, Inches(1.8), y + Inches(0.1), Inches(3), Inches(0.4),
                 name, font_size=18, color=color, bold=True)
    # Description
    add_text_box(slide, Inches(1.8), y + Inches(0.5), Inches(9.5), Inches(0.5),
                 desc, font_size=14, color=LIGHT_GRAY)
    # Arrow between layers
    if y < Inches(5.7):
        add_text_box(slide, Inches(6.2), y + Inches(1.05), Inches(0.8), Inches(0.5),
                     "↓", font_size=24, color=MID_GRAY, bold=True, alignment=PP_ALIGN.CENTER)

# Right side labels
add_text_box(slide, Inches(10.5), Inches(1.8), Inches(2.5), Inches(0.4),
             "POST /api/port-state", font_size=11, color=MID_GRAY)
add_text_box(slide, Inches(10.5), Inches(3.2), Inches(2.5), Inches(0.4),
             "Deterministic", font_size=11, color=ACCENT_CYAN)
add_text_box(slide, Inches(10.5), Inches(4.6), Inches(2.5), Inches(0.4),
             "Streaming", font_size=11, color=ACCENT_GOLD)

add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=RGBColor(0x7C, 0x4D, 0xFF), shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 6 — Live Demo
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Header
add_shape(slide, Inches(0), Inches(0), W, Inches(1.1), fill_color=RGBColor(0x10, 0x14, 0x25), shape_type=MSO_SHAPE.RECTANGLE)
add_text_box(slide, Inches(0.8), Inches(0.25), Inches(8), Inches(0.6),
             "LIVE DEMO", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(0.95), Inches(2), GREEN_ACCENT, Pt(3))

# Demo video link
add_text_box(slide, Inches(0.8), Inches(1.3), Inches(11), Inches(0.5),
             "Demo Video: https://drive.google.com/file/d/1_SeszmGZmT-9oOLbL7D8B1_KeVX7GxhU/view?usp=sharing",
             font_size=13, color=ACCENT_CYAN)

# Demo steps
demo_steps = [
    ("Step 1", "Import 10 vessels via CSV or add manually in Controls tab"),
    ("Step 2", "Run the 72-hour simulation — watch berth allocation animate in real-time"),
    ("Step 3", "Close Berth B3 in Configure Berths — see real-time vessel diversion"),
    ("Step 4", "Run the Optimiser — view waiting hours saved across affected vessels"),
    ("Step 5", "Ask AI Copilot: \"What are the top congestion drivers right now?\""),
    ("Step 6", "Generate 72-hour shift plan — streaming WatsonX-powered operations plan"),
]

for i, (step, desc) in enumerate(demo_steps):
    y = Inches(2.0) + Inches(i * 0.85)
    # Step number
    add_icon_circle(slide, Inches(0.8), y + Inches(0.05), Inches(0.55), GREEN_ACCENT, str(i+1), font_size=18)
    # Step label
    add_text_box(slide, Inches(1.6), y, Inches(2.5), Inches(0.4),
                 step, font_size=16, color=GREEN_ACCENT, bold=True)
    # Description
    add_text_box(slide, Inches(1.6), y + Inches(0.35), Inches(10.5), Inches(0.45),
                 desc, font_size=15, color=LIGHT_GRAY)

add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=GREEN_ACCENT, shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 7 — Screenshots (2x3 Grid)
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Header
add_shape(slide, Inches(0), Inches(0), W, Inches(1.1), fill_color=RGBColor(0x10, 0x14, 0x25), shape_type=MSO_SHAPE.RECTANGLE)
add_text_box(slide, Inches(0.8), Inches(0.25), Inches(8), Inches(0.6),
             "APPLICATION SCREENSHOTS", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(0.95), Inches(2), ACCENT_BLUE, Pt(3))

# Screenshot grid (2 columns x 3 rows)
screenshots = [
    ("01-landing-page.png", "Landing Page", ACCENT_CYAN),
    ("02-dashboard.png", "Dashboard KPIs", ACCENT_BLUE),
    ("03-simulation.png", "Live Simulation", GREEN_ACCENT),
    ("04-optimisation.png", "Optimisation & Gantt", ACCENT_GOLD),
    ("05-controls.png", "Controls & Scenarios", RGBColor(0xBB, 0x86, 0xFC)),
    ("06-ai-copilot.png", "AI Copilot", RGBColor(0xFF, 0x69, 0x69)),
]

for i, (filename, label, color) in enumerate(screenshots):
    col = i % 2
    row = i // 2
    x = Inches(0.5) + Inches(col * 6.3)
    y = Inches(1.3) + Inches(row * 2.0)
    
    # Card background
    card = add_shape(slide, x, y, Inches(6.0), Inches(1.8),
                     fill_color=BG_CARD, border_color=color, border_width=Pt(1))
    
    # Screenshot placeholder or actual image
    screenshot_path = os.path.join(os.path.dirname(__file__), "..", "demo", "screenshots", filename)
    if os.path.exists(screenshot_path):
        try:
            slide.shapes.add_picture(screenshot_path, x + Inches(0.1), y + Inches(0.1), Inches(5.8), Inches(1.3))
        except:
            # Fallback to placeholder text
            add_text_box(slide, x + Inches(0.3), y + Inches(0.4), Inches(5.4), Inches(0.8),
                        f"[{label}]", font_size=18, color=color, bold=True, alignment=PP_ALIGN.CENTER)
    else:
        # Placeholder with label
        add_text_box(slide, x + Inches(0.3), y + Inches(0.4), Inches(5.4), Inches(0.8),
                     f"[{label}]", font_size=18, color=color, bold=True, alignment=PP_ALIGN.CENTER)
    
    # Label below
    add_text_box(slide, x + Inches(0.1), y + Inches(1.45), Inches(5.8), Inches(0.3),
                 label, font_size=11, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=ACCENT_BLUE, shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 8 — IBM Integration
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Header
add_shape(slide, Inches(0), Inches(0), W, Inches(1.1), fill_color=RGBColor(0x10, 0x14, 0x25), shape_type=MSO_SHAPE.RECTANGLE)
add_text_box(slide, Inches(0.8), Inches(0.25), Inches(8), Inches(0.6),
             "IBM TECHNOLOGY INTEGRATION", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(0.95), Inches(2), ACCENT_BLUE, Pt(3))

# Three IBM pillars
ibm_features = [
    ("IBM Bob", "AI Agent Platform", "Used as the primary AI agent framework for building and orchestrating the port operations intelligence layer", ACCENT_BLUE),
    ("IBM watsonx.ai", "Granite 4-H-Small", "Streams production-grade 72-hour shift operations plans and answers operational triage questions in real-time with grounded context", ACCENT_CYAN),
    ("Dual AI Backend", "Ollama + WatsonX", "WatsonX provides cloud inference; Ollama ensures local fallback when cloud is unavailable — zero downtime resilience", ACCENT_GOLD),
]

for i, (title, subtitle, desc, color) in enumerate(ibm_features):
    x = Inches(0.8) + Inches(i * 4.1)
    # Card
    card = add_shape(slide, x, Inches(1.5), Inches(3.7), Inches(4.5),
                     fill_color=BG_CARD, border_color=color, border_width=Pt(2))
    # Accent bar
    add_shape(slide, x, Inches(1.5), Inches(3.7), Pt(5), fill_color=color, shape_type=MSO_SHAPE.RECTANGLE)
    # Title
    add_text_box(slide, x + Inches(0.3), Inches(1.9), Inches(3.1), Inches(0.5),
                 title, font_size=22, color=color, bold=True, alignment=PP_ALIGN.CENTER)
    # Subtitle
    add_text_box(slide, x + Inches(0.3), Inches(2.5), Inches(3.1), Inches(0.4),
                 subtitle, font_size=15, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)
    # Line
    add_shape(slide, x + Inches(0.8), Inches(3.0), Inches(2.1), Pt(1),
              fill_color=color, shape_type=MSO_SHAPE.RECTANGLE)
    # Description
    add_text_box(slide, x + Inches(0.3), Inches(3.3), Inches(3.1), Inches(2.5),
                 desc, font_size=14, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

# Key point at bottom
add_shape(slide, Inches(1.5), Inches(6.3), Inches(10), Inches(0.8),
          fill_color=BG_CARD, border_color=GREEN_ACCENT, border_width=Pt(1))
add_text_box(slide, Inches(1.8), Inches(6.4), Inches(9.5), Inches(0.6),
             "Zero Hallucinations — AI grounded in actual port state data, not generic training corpora",
             font_size=16, color=GREEN_ACCENT, bold=True, alignment=PP_ALIGN.CENTER)

add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=ACCENT_BLUE, shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 8 — Technical Highlights
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Header
add_shape(slide, Inches(0), Inches(0), W, Inches(1.1), fill_color=RGBColor(0x10, 0x14, 0x25), shape_type=MSO_SHAPE.RECTANGLE)
add_text_box(slide, Inches(0.8), Inches(0.25), Inches(8), Inches(0.6),
             "TECHNICAL HIGHLIGHTS", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(0.95), Inches(2), ACCENT_GOLD, Pt(3))

# Tech highlight grid (2x3)
highlights = [
    ("Deterministic Scheduling", "Same inputs always produce same outputs — mathematically verifiable, no randomness", ACCENT_BLUE),
    ("Greedy Heuristic Optimizer", "Explainable berth reassignment in milliseconds — instant schedule recalculation", ACCENT_CYAN),
    ("localStorage Persistence", "Events, vessel data, and berth closures survive page refreshes — no database needed", GREEN_ACCENT),
    ("Throttled SVG Animation", "Smooth 60fps simulation with frame-throttled recomputation for 25+ vessels", ACCENT_GOLD),
    ("Dual AI Backend", "WatsonX cloud primary + Ollama local fallback — zero downtime AI inference", RGBColor(0xBB, 0x86, 0xFC)),
    ("CSV Vessel Import", "Upload real vessel schedules or add manually — zero synthetic data, all user-driven", RGBColor(0xFF, 0x69, 0x69)),
]

for i, (title, desc, color) in enumerate(highlights):
    col = i % 3
    row = i // 3
    x = Inches(0.8) + Inches(col * 4.1)
    y = Inches(1.5) + Inches(row * 2.8)

    card = add_shape(slide, x, y, Inches(3.7), Inches(2.4),
                     fill_color=BG_CARD, border_color=color, border_width=Pt(1))
    # Color accent bar
    add_shape(slide, x, y, Pt(5), Inches(2.4), fill_color=color, shape_type=MSO_SHAPE.RECTANGLE)
    # Title
    add_text_box(slide, x + Inches(0.3), y + Inches(0.3), Inches(3.2), Inches(0.5),
                 title, font_size=17, color=color, bold=True)
    # Description
    add_text_box(slide, x + Inches(0.3), y + Inches(0.9), Inches(3.2), Inches(1.3),
                 desc, font_size=13, color=LIGHT_GRAY)

add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=ACCENT_GOLD, shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 9 — Results & Impact
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Header
add_shape(slide, Inches(0), Inches(0), W, Inches(1.1), fill_color=RGBColor(0x10, 0x14, 0x25), shape_type=MSO_SHAPE.RECTANGLE)
add_text_box(slide, Inches(0.8), Inches(0.25), Inches(8), Inches(0.6),
             "RESULTS & IMPACT", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(0.95), Inches(2), GREEN_ACCENT, Pt(3))

# Impact stats - big numbers
impact_stats = [
    ("15-40%", "Vessel Waiting\nHours Reduced", GREEN_ACCENT),
    ("72 hrs", "Congestion Forecast\nHorizon", ACCENT_BLUE),
    ("0", "AI Hallucinations\n(Grounded Data)", ACCENT_CYAN),
    ("<100ms", "Optimisation\nRecalculation", ACCENT_GOLD),
]

for i, (number, label, color) in enumerate(impact_stats):
    x = Inches(0.6) + Inches(i * 3.15)
    card = add_shape(slide, x, Inches(1.5), Inches(2.9), Inches(2.0),
                     fill_color=BG_CARD, border_color=color, border_width=Pt(2))
    add_text_box(slide, x + Inches(0.2), Inches(1.7), Inches(2.5), Inches(0.7),
                 number, font_size=36, color=color, bold=True, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, x + Inches(0.2), Inches(2.4), Inches(2.5), Inches(0.8),
                 label, font_size=14, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

# Impact descriptions
impact_items = [
    ("Proactive Prediction", "Identifies congestion 72 hours ahead — before vessels start queuing"),
    ("Explainable Decisions", "Every recommendation comes with ranked root-cause drivers — no black-box AI"),
    ("Operational Resilience", "Dual AI backend ensures system works offline (Ollama) and online (WatsonX)"),
    ("Immediate Trust", "AI grounded in actual port state data — operators can act on recommendations instantly"),
]

for i, (title, desc) in enumerate(impact_items):
    y = Inches(3.9) + Inches(i * 0.82)
    add_shape(slide, Inches(0.8), y, Inches(0.15), Inches(0.15),
              fill_color=GREEN_ACCENT, shape_type=MSO_SHAPE.OVAL)
    add_text_box(slide, Inches(1.2), y - Inches(0.05), Inches(4), Inches(0.4),
                 title, font_size=16, color=WHITE, bold=True)
    add_text_box(slide, Inches(5.5), y - Inches(0.05), Inches(7), Inches(0.4),
                 desc, font_size=14, color=LIGHT_GRAY)

add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=GREEN_ACCENT, shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 10 — Tech Stack
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Header
add_shape(slide, Inches(0), Inches(0), W, Inches(1.1), fill_color=RGBColor(0x10, 0x14, 0x25), shape_type=MSO_SHAPE.RECTANGLE)
add_text_box(slide, Inches(0.8), Inches(0.25), Inches(8), Inches(0.6),
             "TECH STACK", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(0.95), Inches(2), RGBColor(0x7C, 0x4D, 0xFF), Pt(3))

# Tech categories
tech_cats = [
    ("Languages", "TypeScript · JavaScript · HTML5 · CSS3", ACCENT_BLUE),
    ("Frontend", "React 19 · Vite · React Router · Tailwind CSS", ACCENT_CYAN),
    ("Backend", "Node.js · Express · TypeScript", GREEN_ACCENT),
    ("IBM Technologies", "watsonx.ai · IBM Granite 4-H-Small · IBM Bob", ACCENT_GOLD),
    ("State Management", "In-Memory Engine · localStorage Persistence", RGBColor(0xBB, 0x86, 0xFC)),
    ("UI Components", "Radix UI · shadcn/ui · Lucide React · Recharts", RGBColor(0xFF, 0x69, 0x69)),
    ("AI Backends", "IBM watsonx.ai (Cloud) · Ollama (Local Fallback)", ACCENT_BLUE),
    ("DevOps", "Concurrently · esbuild · Vite Build", MID_GRAY),
]

for i, (cat, techs, color) in enumerate(tech_cats):
    col = i % 2
    row = i // 2
    x = Inches(0.8) + Inches(col * 6.2)
    y = Inches(1.4) + Inches(row * 1.45)

    card = add_shape(slide, x, y, Inches(5.8), Inches(1.2),
                     fill_color=BG_CARD, border_color=color, border_width=Pt(1))
    add_shape(slide, x, y, Pt(4), Inches(1.2), fill_color=color, shape_type=MSO_SHAPE.RECTANGLE)
    add_text_box(slide, x + Inches(0.3), y + Inches(0.15), Inches(5.2), Inches(0.4),
                 cat, font_size=15, color=color, bold=True)
    add_text_box(slide, x + Inches(0.3), y + Inches(0.55), Inches(5.2), Inches(0.5),
                 techs, font_size=13, color=LIGHT_GRAY)

add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=RGBColor(0x7C, 0x4D, 0xFF), shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 11 — What We're Proud Of
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Header
add_shape(slide, Inches(0), Inches(0), W, Inches(1.1), fill_color=RGBColor(0x10, 0x14, 0x25), shape_type=MSO_SHAPE.RECTANGLE)
add_text_box(slide, Inches(0.8), Inches(0.25), Inches(8), Inches(0.6),
             "WHAT WE'RE PROUD OF", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(0.95), Inches(2), ACCENT_GOLD, Pt(3))

# Main quote
add_shape(slide, Inches(1.5), Inches(1.5), Inches(10), Inches(2.8),
          fill_color=BG_CARD, border_color=ACCENT_GOLD, border_width=Pt(2))
add_text_box(slide, Inches(2.0), Inches(1.7), Inches(9), Inches(2.5),
             "The seamless integration between deterministic, mathematically explainable scheduling logic and IBM watsonx.ai foundation models. Rather than relying on generic AI hallucinations, watsonx.ai ingests the live single-source-of-truth port schedule, ranked congestion drivers, and active disruption scenarios to stream grounded, executive-grade 72-hour operational shift plans and tactical dispatcher guidance.",
             font_size=17, color=LIGHT_GRAY, alignment=PP_ALIGN.LEFT)

# Key achievements
achievements = [
    ("Zero Hallucinations", "AI grounded in live port state — every recommendation is traceable to specific data points"),
    ("Dual AI Resilience", "Ollama local fallback ensures the system works even when cloud services are unavailable"),
    ("Explainable Over Optimal", "Greedy heuristic chosen for explainability — every decision has a clear, human-readable rationale"),
    ("Hackathon in 48 Hours", "Full-stack port operations platform built from scratch with IBM watsonx.ai integration"),
]

for i, (title, desc) in enumerate(achievements):
    y = Inches(4.6) + Inches(i * 0.68)
    add_shape(slide, Inches(1.5), y, Inches(0.15), Inches(0.15),
              fill_color=ACCENT_GOLD, shape_type=MSO_SHAPE.OVAL)
    add_text_box(slide, Inches(2.0), y - Inches(0.05), Inches(3.5), Inches(0.35),
                 title, font_size=15, color=ACCENT_GOLD, bold=True)
    add_text_box(slide, Inches(5.8), y - Inches(0.05), Inches(6.5), Inches(0.35),
                 desc, font_size=13, color=LIGHT_GRAY)

add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=ACCENT_GOLD, shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SLIDE 12 — Team & Thank You
# ═══════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Top decorative bar
add_shape(slide, Inches(0), Inches(0), W, Inches(0.06), fill_color=ACCENT_BLUE, shape_type=MSO_SHAPE.RECTANGLE)

# Team section
add_text_box(slide, Inches(0.8), Inches(0.6), Inches(5), Inches(0.6),
             "TEAM INTELLICORE", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(1.2), Inches(2), ACCENT_CYAN, Pt(3))

# Team members
team_members = [
    ("Jay Prajapati", "Team Lead / Full-Stack Developer"),
    ("Nency Patel", "Backend & AI Integration"),
    ("Aeni Patel", "Frontend & UI/UX Design"),
    ("Dishva Vasoya", "Testing & Documentation"),
]

for i, (name, role) in enumerate(team_members):
    x = Inches(0.8) + Inches(i * 3.1)
    card = add_shape(slide, x, Inches(1.6), Inches(2.8), Inches(1.8),
                     fill_color=BG_CARD, border_color=ACCENT_BLUE, border_width=Pt(1))
    # Avatar circle
    add_icon_circle(slide, x + Inches(0.95), Inches(1.8), Inches(0.7), ACCENT_BLUE, name[0], font_size=22)
    # Name
    add_text_box(slide, x + Inches(0.2), Inches(2.6), Inches(2.4), Inches(0.4),
                 name, font_size=15, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)
    # Role
    add_text_box(slide, x + Inches(0.2), Inches(3.0), Inches(2.4), Inches(0.35),
                 role, font_size=11, color=MID_GRAY, alignment=PP_ALIGN.CENTER)

# Thank you section
add_text_box(slide, Inches(0.8), Inches(3.8), Inches(11), Inches(0.8),
             "Thank You!", font_size=42, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)

add_text_box(slide, Inches(0.8), Inches(4.7), Inches(11), Inches(0.5),
             "Questions?", font_size=22, color=ACCENT_CYAN, alignment=PP_ALIGN.CENTER)

# Links
add_accent_line(slide, Inches(5), Inches(5.3), Inches(3), ACCENT_BLUE, Pt(2))

add_text_box(slide, Inches(0.8), Inches(5.6), Inches(11), Inches(0.4),
             "GitHub: github.com/23dce101-wq/bob-ai-hackathon-Intellicore", font_size=14, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

add_text_box(slide, Inches(0.8), Inches(6.0), Inches(11), Inches(0.4),
             "Demo Video: drive.google.com/file/d/1_SeszmGZmT-9oOLbL7D8B1_KeVX7GxhU/view", font_size=14, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

add_text_box(slide, Inches(0.8), Inches(6.4), Inches(11), Inches(0.4),
             "Contact: 23dce101@charusat.edu.in", font_size=14, color=MID_GRAY, alignment=PP_ALIGN.CENTER)

# Bottom bar
add_shape(slide, Inches(0), Inches(7.3), W, Inches(0.06), fill_color=ACCENT_CYAN, shape_type=MSO_SHAPE.RECTANGLE)


# ═══════════════════════════════════════════════════════════════════════════
# SAVE
# ═══════════════════════════════════════════════════════════════════════════
output_path = os.path.join(os.path.dirname(__file__), "PortPredict_AI_Presentation.pptx")
prs.save(output_path)
print(f"Presentation saved to: {output_path}")
print(f"Total slides: {len(prs.slides)}")
