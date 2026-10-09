---
name: Danser Studio
description: A local osu!standard video studio with a vivid, musical vinyl stage.
colors:
  bg: "#17131c"
  panel: "#211b27"
  input: "#2b2331"
  line: "#443849"
  muted: "#b8a9bf"
  pink: "#ff66aa"
  cyan: "#58d7df"
  lime: "#82ddb4"
  text: "#f5edf4"
  purple: "#a88be8"
  primary-ink: "#331423"
  primary-hover: "#ff89bd"
  control-hover: "#49364a"
  field-hover: "#8b6f8e"
  selected: "#5b334d"
  selected-ink: "#ffe4f2"
  warning: "#ffb59d"
typography:
  display:
    fontFamily: "Comfortaa, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.35
  headline:
    fontFamily: "Exo 2, sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1.25
  title:
    fontFamily: "Exo 2, sans-serif"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: 1.25
  body:
    fontFamily: "Exo 2, sans-serif"
    lineHeight: 1.6
  label:
    fontFamily: "Exo 2, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  button:
    fontFamily: "Exo 2, sans-serif"
    fontSize: "14px"
    fontWeight: 800
  code:
    fontFamily: "Consolas, monospace"
    fontSize: "13px"
    lineHeight: 1.6
rounded:
  utility: "6px"
  field: "7px"
  nav: "8px"
  button: "9px"
  tab-group: "10px"
  container: "12px"
  dialog: "14px"
  circle: "50%"
spacing:
  inset: "4px"
  compact: "8px"
  control-gap: "12px"
  control-inset: "16px"
  section: "22px"
  rail-inset: "24px"
  mobile-stack: "28px"
components:
  button-primary:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.input}"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.control-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.utility}"
    padding: "8px 4px"
  input:
    backgroundColor: "{colors.input}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "9px 11px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.nav}"
    padding: "11px 19px"
  scenario-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.selected-ink}"
    rounded: "{rounded.field}"
    padding: "9px 7px"
  expanded-export:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.container}"
    padding: "20px"
  dialog:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "25px"
---

# Design System: Danser Studio

## Overview

**Creative North Star: "ORBIT — the musical vinyl stage"**

The interface puts the selected track at the center of a working music studio. Rounded, expressive lettering and vivid osu! pink bring the pleasure of a rhythm game; dark plum surfaces, readable controls, and compact metadata support concentration. The identity is contemporary rather than retro, with cyan, mint, and lavender adding variety without acidic color.

The recurring signature is a large procedural vinyl record with grooves, reflections, approach rings, and a tonearm. Actual map artwork supplies the image when available. Surrounding tools change with the selected section while the record and music controls persist. Working areas use open rails and separators instead of a repeated card or glass template. The user-approved direction combines ORBIT's central composition with HARD CUT's expressiveness.

**Key Characteristics:**
- A persistent circular music stage with tactile vinyl material.
- Vivid pink actions with cooler secondary accents on dark plum.
- Friendly rounded typography and compact, factual controls.
- Open working rails, restrained containers, and visible keyboard focus.
- Gentle continuous motion with an explicit animation switch and reduced-motion support.

## Colors

The palette uses luminous accents against warm plum neutrals; normative values live in the frontmatter and mirror the stylesheet.

### Primary
- **osu! Pink (`pink`)** marks primary actions, selected navigation, links, cursor controls, and playback affordances.
- **Rose Highlight (`primary-hover`)** lightens the primary action on hover; **Plum Ink (`primary-ink`)** keeps text dark on its pink fill.

### Secondary
- **Clear Cyan (`cyan`)** marks keyboard focus, the orbit dot, and the drag target state.
- **Mint (`lime`)** indicates readiness and completed jobs. The source token is named `lime`, although the rendered color is mint.

### Tertiary
- **Soft Lavender (`purple`)** accents supportive tips. It supplements pink rather than competing for primary action emphasis.
- **Warm Peach (`warning`)** marks warnings and destructive action text.

### Neutral
- **Night Plum (`bg`)** is the page ground; **Raised Plum (`panel`)** supports dialogs and expanded export controls.
- **Control Plum (`input`)** distinguishes editable controls; **Plum Divider (`line`)** separates tool groups.
- **Warm White (`text`)** carries content; **Lavender Gray (`muted`)** carries descriptions and secondary metadata.
- **Pressed Plum (`selected`)** and **Pink White (`selected-ink`)** identify selected scenario and scene controls.
- **Control Lift (`control-hover`)** and **Field Edge (`field-hover`)** reveal hover state without introducing a new visual surface.

**The Accent Meaning Rule.** Keep primary actions pink, keyboard focus cyan, and success mint. Cursor palettes may vary independently because they encode actual attempts.

## Typography

**Display Font:** Comfortaa, with sans-serif fallback. **Body Font:** Exo 2, with sans-serif fallback. **Code Font:** Consolas, with monospace fallback.

Both rounded families are self-hosted variable fonts with included SIL OFL licenses. Comfortaa gives the brand, record label, and track title their expressive round silhouette; Exo 2 carries dense working text, controls, and metadata. Source assets and licensing are recorded in `web/public/ASSETS.md`.

### Hierarchy
- **Display:** the track title uses the frontmatter desktop role above 960px and drops to 20px at widths up to 960px. The final desktop override sets 22px, including large desktops. Keep long titles wrapping rather than truncating their identity.
- **Headline:** section headings use the headline role; source page headings may reach 24px, while compact workflow headings use 17px.
- **Title:** short group headings use the title role; job titles use 14px to fit the working rail.
- **Body:** descriptive paragraphs use the body role; compact help text is commonly 12px and map descriptions 14px. There is no explicit global body font-size token.
- **Label:** field labels use the label role. Supporting metadata ranges from 10px to 12px.
- **Brand:** the Comfortaa wordmark is 25px, weight 700, with -0.03em tracking; its Exo 2 STUDIO suffix is 13px with 0.12em tracking.
- **Code:** logs and JSON use the code family; the editor uses the frontmatter code role.

**The Exact Track Rule.** Keep the real title, artist, difficulty, creator, and exact-map identity readable. Decorative lettering must never replace these data.

## Layout

The creation surface uses a three-column desktop composition: a source rail, flexible central stage, and scene rail. The default rail columns are `minmax(250px, 300px)` and `minmax(280px, 330px)` with a 3vw gap, 3.2vw horizontal page inset, and a 2000px container maximum. At widths of at least 1600px the rails become 300px and 350px. Up to 1200px they become 230px and 265px with 20px gaps and 24px page insets.

Above 960px the turntable is capped by `min(100%, 54vh, 680px)`, keeping the central focus compatible with a desktop 16:9 viewport. The disc occupies 88% of the square turntable. At widths up to 960px the scene rail moves below the two-column source-and-stage area. Up to 620px the surface becomes a vertical stack: stage, source, scene. Mobile uses 18px horizontal insets and 28px gaps; the turntable is capped at 430px.

The attempts list scrolls within 30vh on desktop and min(30vh, 280px) on mobile; player names, dates, mods, and expandable details remain accessible. Export is a compact lower dock with video name, recommended preset select, preview, and video action. Detailed export and engine configuration open below. Forms typically use paired columns with 12px gaps; dense settings become vertically arranged at narrower widths.

**Surface mode: Operate.** The creation, queue, and connection sections are working views. The persistent record anchors them; composition specifics are recorded here as implemented surface behavior, not as a requirement that every future screen repeat three columns.

## Elevation & Depth

Working rails and rows use tonal layering and fine separators. Shadows are concentrated on the physical record, its label and spindle, the tonearm, and transient notices. There is no repeated floating-card or translucent glass system. Original geometric stage artwork sits behind the interface, while radial grooves and conic reflections create the record's material.

### Shadow Vocabulary
- **Record body:** `0 28px 50px #0008, inset 0 0 0 3px #6a5667` grounds the disc.
- **Record label:** `0 2px 7px #0009, inset 0 0 0 1px #ffffff30` adds a tactile center.
- **Orbit dot:** `0 3px 12px #58d7df55` gives the cyan marker a small glow.
- **Notice:** `0 12px 40px #0006` separates temporary feedback from the work surface.

**The Material Rule.** Reserve pronounced reflections and physical shadows for the vinyl stage. Keep tools quiet enough to read beside it.

## Shapes

Circular geometry defines the record, approach rings, label, spindle, playback control, status dots, and brand icon. Rounded controls use the frontmatter radius roles, progressing from small utility buttons to fields, navigation, actions, export containers, and dialogs. Scene tabs have curved top corners and a straight baseline. Thin borders and open rows structure information; the upload target is a dashed rounded enclosure.

## Components

### Buttons

Confident, compact actions. Primary and secondary controls share the button role and gap of 8px. The secondary variant is filled control plum with a fine divider border, including buttons called "ghost" in the source. Hover moves enabled filled buttons upward by 1px over 0.15s and changes the fill. Text and icon actions stay quieter until hover. All keyboard focus uses a cyan 2px outline with 4px offset; disabled buttons use opacity 0.4 and a not-allowed cursor.

### Inputs / Fields

Dark, readable working fields. Inputs, selects, and textareas use the input role, a 1px divider border, and 14px type. Hover changes input/select edges to the field-hover color; focus retains the shared outline. Checkbox and range accents are pink. Field descriptions remain visible below their controls; native elements retain their appropriate interaction semantics.

### Navigation

Three labeled destinations share compact rounded tabs. The current page uses pink text, a translucent pink background, and a short pink underline beneath the header. At mobile widths navigation occupies a full row beneath the wordmark and language selector. Scenario controls use `aria-pressed` selected fills; scene controls sit against a ruled baseline.

### Containers and Rows

Workflow groups are predominantly open sections. Attempt rows and queue items use separators, readable names, and compact metadata. Expanded export uses the panel fill and container radius. Job details use a native dialog, bounded scrolling, a dark backdrop, and contained media. The upload target changes from plum to a cyan-edged dark teal during drag.

### Vinyl Stage and Music

The record is procedural CSS, with map artwork clipped under visible grooves; reflections stay layered over the spinning disc. Artwork is fetched for the exact selected map hash through the local media API. When artwork is missing, the material remains intact without a replacement track image. The title and metadata remain outside the spinning surface.

The disc rotates once every 24 seconds independently of audio playback. The Animation control pauses that rotation and saves its preference in the tab session. Reduced-motion preference removes animations and transitions. Rails enter with a small upward settling motion over 0.25s.

Music starts automatically when selecting a map, respecting the current volume and mute preferences. If browser policy blocks autoplay, the user can start it with the play button. Controls include play/pause, elapsed/duration, seeking, mute, and labeled volume; volume starts at 25% unless a tab-session preference exists. Changing the exact map resets loaded media and playback state. The stage remains mounted when switching the surrounding app section, so section navigation preserves its state. Audio controls disable or explain unavailable resources without inventing content.

### Export Dock

Recommended resolution/frame-rate presets remain a compact select. Detailed encoding controls remain separately expandable. Preview and full video actions are distinct, with actual prerequisites expressed beside the controls. Keep the stage and mode, cursor-color, and skin tools visually ahead of encoding detail.

## Do's and Don'ts

### Do:
- **Do** keep the persistent vinyl stage central to the studio identity while surrounding tools adapt to the selected section.
- **Do** use actual map artwork and metadata for the exact selected map version, retaining visible grooves over the artwork.
- **Do** preserve rounded expressive type, vivid pink actions, and cyan keyboard focus.
- **Do** keep replay names and dates accessible in compact scrolling rows.
- **Do** offer animation, volume, and mute controls and respect reduced-motion preference.
- **Do** keep export presets compact and advanced settings accessible separately.

### Don't:
- **Don't** introduce a retro, overly pastel, or acidic palette.
- **Don't** replace the working rails with a repeated card or glass template.
- **Don't** fabricate map art, replay results, players, dates, or readiness states.
- **Do** start music when a map is selected, respecting saved volume and mute; offer manual play when the browser blocks autoplay.
- **Don't** substitute another map version with the same title or hide its difficulty identity.
- **Don't** bundle local map media or rely on external font servers.

## Full HD workspace refinement

The primary viewport is fullscreen 1920 × 1080. On desktop (at least 1280 × 700), the app is a viewport-height workspace: export remains visible, rails scroll independently, and detailed export/engine editors open above the dock. The source and scene rails are 350px and 420px; the stage uses the remaining width. At smaller widths the existing stacked flow remains subordinate to this desktop composition. Queue uses a wide 650px job rail with its own scrolling and newest jobs first. Background circles belong to the turntable rather than fixed coordinates in the SVG. Body/input text is 16px with 14px compact help; Exo 2 is the interface face and Comfortaa remains in the wordmark. Replay search/filter and folder import controls are removed at the user request; replay details, selection and individual colors remain. Redundant palette/comparison tips are removed.

Music preview starts at the selected .osu PreviewTime (milliseconds). Missing, negative, malformed or out-of-track values fall back to 40% of the map end time, capped by audio duration; if map timing is unavailable, audio duration is used. Seeking occurs after audio metadata loads, before autoplay. This affects listening only, not video export.

Music seeking now lives in a thin cyan strip below the header, with elapsed/total time and a keyboard-accessible slider. Play/pause, mute and volume sit at the scene edge. The larger record uses wider, low-contrast groove bands and neutral reflections; its cyan paper label uses actual map artwork and artist metadata instead of product branding. Pink remains the primary action accent, while cyan identifies music controls. On narrow screens audio controls form a compact row above the record.
