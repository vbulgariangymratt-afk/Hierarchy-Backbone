# Backbone Neuro-UI Design Guidelines & Rulebook

These rules are established to ensure Backbone's interface is accessible, cognitive-load-optimized, and specifically designed to support ADHD and neurodivergent users.

## 🚫 The "NEVER DO THIS" List (Brain-Breaking UI)

*   **No Pure Black on Pure White (`#000000` on `#FFFFFF`):** High contrast causes a "halation effect" (light bleeding into the dark) causing text to vibrate or blur.
    *   **Rule:** Use a soft charcoal (e.g., `#222222`) on a warm off-white or light grey background (e.g., `#F8F9FA`) to prevent ocular fatigue.
*   **No Red Warning Text, Flashing Alarms, or "Failed" Modals:** Red exclamation points or blunt "Failed" messages trigger emotional threat responses (RSD-hypervigilance).
    *   **Rule:** Use soft, cool colors (blues/greens) for informational feedback. Frame errors gently (e.g., "Let's try that again") and use tactile cues (irregular haptics) rather than visual alarms.
*   **No Italics or ALL CAPS:** Italics tilt letterforms and increase visual noise; ALL CAPS removes natural height variations used for quick word recognition.
    *   **Rule:** Use **bold** weight exclusively for emphasis.
*   **No Standard Loading Spinners for waits over 1 second:** Spinning wheels cause attention drift and user frustration.
    *   **Rule:** Use **Skeleton Screens** (wireframe placeholders of incoming content) to reduce perceived wait times by showing continuous progress.
*   **No Complex Swipe Gestures for Destructive Actions:** Swiping requires physical precision that drains executive resources.
    *   **Rule:** Use simple taps for critical and destructive actions.

## ⚡ Animation & Responsiveness Rules (Making it Feel "Alive")

*   **The 400-Millisecond "Visual Receipt":** Every button press must show immediate visual feedback (e.g., button shrinking slightly or a subtle color flash) within 0 to 400ms to prevent "rage tapping".
*   **Physics-Based Motion:** Use spring-based momentum (natural acceleration and deceleration) instead of jarring linear stops.
*   **Respect "Reduced Motion" Preferences:** Always support OS-level reduced motion settings, swapping decorative animations for simple fade transitions.
*   **The 10-Second "Delayed Undo" Snackbar:** Avoid interruptive "Are you sure?" confirmation dialogs. Perform actions instantly, but display a 10-second "Undo" snackbar at the bottom of the screen.

## 🧠 Core Principles & Typographic Engineering

### 1. Touch Targets & Spacing
*   **Large Touch Targets:** Critical interactive buttons must be at least 11x11 mm (or `72x72px` in CSS).
*   **Generous Spacing:** Maintain a minimum of `12dp` (or `12px` equivalent) of "dead space" between buttons to prevent accidental taps.

### 2. Tactile Scaffolding (Haptics)
*   **Button Press:** Subtle tap vibration.
*   **Task Completion:** Clean double-pulse vibration (dopamine hit).
*   **Errors/Slips:** Three irregular pulses.

### 3. Typography Rules
*   **Font Selection:**
    *   **Lexend:** Default for general UI.
    *   **Atkinson Hyperlegible:** Used in technical copy, analytics, or contract terms to prevent character-differentiation fatigue.
*   **Size & Spacing:** Minimum font size of `16px` with a line height of `1.5` to `1.6`.
*   **Line Length:** Max 70 to 80 characters per line.
*   **Strict Left-Alignment:** Never justify text (which creates distracting "rivers of white").
*   **Bionic Reading Support:** Maintain system integration that automatically bolds the first ~45% of words to act as a visual anchor.

## 🎞️ Framer Motion Golden Rules

These rules exist because animation bugs in this codebase have been diagnosed and fixed at cost. Do not repeat them.

### Sliding Pill / Indicator Animations (`layoutId`)
*   **Always wrap in `<LayoutGroup id="unique-id">`:** Any component that slides an element between positions using Framer Motion's `layoutId` (e.g. a pill, underline, or highlight) MUST be wrapped in a `LayoutGroup` with a unique `id` prop.
    *   **Why:** Without it, any `AnimatePresence` animation elsewhere on the page (e.g. a fading list, a route transition) can shift bounding rectangles mid-frame and cause the indicator to teleport instead of slide smoothly. The `LayoutGroup` isolates coordinate measurements to that component only.
    *   **The reusable component:** `src/components/ui/SegmentedControl.jsx` already implements this correctly. **Always use it** for segmented pill controls instead of re-implementing the pattern inline. Pass `layoutPrefix`, `options`, `value`, `onChange`, `buttonSize`, `fontSize`, and `activePadding` as props.
*   **Never give `layoutId` to both a container and its child simultaneously:** If a parent button has `layoutId` and the pill inside it also has `layoutId`, they compete for coordinate resolution and the pill will teleport on reverse-direction transitions.
*   **CSS transitions and Framer `layout` animations must not both own the same property:** If Framer is animating `width` via `layout`, remove `transition: width` from CSS, and vice versa. Two systems animating the same property simultaneously causes stretching and jitter.

## 🌿 Branch & Release Rules (Branch Policy)

*   **Default Progress Saves (Main Branch):** All regular work commits, daily progress saves, and draft code must be committed and pushed directly to the **`main`** branch.
*   **Production Updates (Production Branch):** Official releases and user-facing updates must only be pushed to the **`production`** branch.
*   **Release Requirements:** Publishing a production update strictly requires:
    1. Bumping the version identifier in `src-tauri/tauri.conf.json`.
    2. Merging code and pushing to the `production` branch.
    3. Creating and pushing a Git version tag matching the version string (e.g. `v0.2.0`).
