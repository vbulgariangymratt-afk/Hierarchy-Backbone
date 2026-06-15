# Habits in Backbone: Architectural & Functional Specification

This document serves as the ground-truth reference for how the habit system functions inside Backbone, covering definitions, progression logic, state machine behavior, and the underlying mathematical rules.

---

## 1. Core Paradigm: Habits vs. Activities

In Backbone, **Habits** and **Activities** represent two distinct layers of user engagement and growth tracking:

### Habits
* **Hierarchical Location**: Exist at the **Skill Level** (linked to one or more Skill nodes).
* **Nature of Action**: Long-term behavioral routines built around consistency and incremental evolution.
* **Progression Mechanics**: Structured phase levels, strict consistency rules, and friction tracking.
* **Growth Feedback**: Accumulates **Aura Points** (`auraPerSkill`) to level up skills.

### Activities / Tasks
* **Hierarchical Location**: Exist at the **Task Level** (daily checklist items).
* **Nature of Action**: Ad-hoc, repeated, or unlimited actions that do not follow a progression curve.
* **Progression Mechanics**: Simple checkboxes with count-based tracking (completed/uncompleted).
* **Growth Feedback**: Contributes to daily productivity scores or task completion logs.

---

## 2. The If-Then Framework & Ease of Completion

Backbone habits are modeled on classic behavioral design principles to combat executive dysfunction:

* **The Trigger-Action Loop**: Every habit is structured as an **"If [Trigger] $\rightarrow$ Then [Action]"** association. 
  * `ifTrigger` defines the situational anchor (e.g., *"If I sit down at my desk..."*).
  * The phase description defines the action (e.g., *"Then I write one line of code"*).
* **Ease of Completion / MVE (Minimum Viable Effort)**: Initial phases (Phase 1) start extremely small. By requiring minimal cognitive load and effort, the user builds the neuromuscular pathway first before scaling up.

---

## 3. Habit States: Active, Awake, and Sleeping

Habits exist in a state machine managed by lifecycle services:

* **Active (`isActive: true`)**: The habit is enabled overall and tracked. If `isActive: false`, the habit is fully archived/disabled.
* **Sleeping State (`status: 'SLEEPING'`, `isSleeping: true`, or `sleepUntil`)**: 
  * A user can temporarily "sleep" a habit or its parent skill for a duration of days or indefinitely.
  * While **Sleeping**, the habit is temporarily paused and excluded from the Launchpad, daily pools, and active schedules.
* **Awake (Active and NOT Sleeping)**: 
  * The habit is in rotation. The system presents it to the user based on their current energy levels and schedule.
  * Sleeping habits automatically **Wake Up** once the `sleepUntil` timestamp has passed, or when the user manually wakes them.

---

## 4. The 3-Gate Progression & Evolution System

To advance a habit to the next phase, the user must meet all criteria for three separate gates evaluated by the `habitService`:

### Gate 1: Cumulative Phase Thresholds (Total Volume)
The user must accumulate enough completions in the current phase to unlock an upgrade.
* **The Progression Curve**: Starts at **8** completions for Phase 1 and increases linearly by **2** for each subsequent phase:
  * **Phase 1 (Level 0)**: 8 completions
  * **Phase 2 (Level 1)**: 10 completions
  * **Phase 3 (Level 2)**: 12 completions
  * **Phase 4 (Level 3)**: 14 completions
  * **Phase 5 (Level 4)**: 16 completions
  * **Phase 6+ (Level 5+)**: Unlimited open-ended phases, continuing to increment by `+2` completions per phase.
* **Post-Cap Phases**: From Phase 5 (Level 4) onwards, evolution transitions to custom manual variations. The user is required to write their own tiny evolution description in the UI rather than relying on automatic increments.

### Gate 2: Stability (The 8/12 Rule)
To prevent "burst" completions from triggering premature difficulty scaling, the system checks recent consistency:
* **The Rule**: The habit must be completed on at least **8 distinct days within a rolling 12-day window**.

### Gate 3: Friction Index
Subjective resistance is rated upon completion: **Light (1)**, **Medium (2)**, or **Heavy (3)**.
* **Friction Average**: The mean friction of the last **8 completions** must be **$\le 2.0$** (representing a light-to-moderate experience).
* **Recent Heavy Block**: If any of the last **3 completions** are rated **Heavy**, evolution is blocked until stability is regained.

---

## 5. De-escalation & Burnout Protection

* **Phase Reduction**: If a habit starts generating severe friction ($\ge 3$ consecutive completions rated **Heavy**), the system flags a suggestion to downgrade the phase to rebuild foundational stability.
* **Burnout Protection (Recovery Mode)**: If any skill linked to a habit is nested under a parent Objective node with `burnoutRisk: true`, the system pauses evolution capabilities until Recovery Mode is deactivated.
