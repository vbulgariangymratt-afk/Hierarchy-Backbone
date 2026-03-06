# Warhead AI Features

## Core Identity
- **Name**: Warhead
- **Role**: Performance Analyst & Pattern Hunter
- **Behavior**: Proactive. Finds hidden correlations in user data. Asks clarifying questions when data is ambiguous to identify root causes.

## Capabilities Breakdown

### 1. Pattern Recognition (The "Why")
Warhead must analyze historical data across all app modules to find correlations:
- **Inputs to Track**:
    - **Sleep**: Bedtime, wake time, duration.
    - **Health**: Meds taken, supplements, symptoms.
    - **Mental State**: Anxiety/Overthinking levels (sliders), Mood overview.
    - **Journal Entries**: Semantic analysis of text ("wrote about X").
    - **Habits & Tasks**: Completion rates, streaks, specific task types.
    - **Marketplace**: Purchase history (rewards/items).
- **Output Examples**:
    - "Every time you sleep past 10pm, task performance drops by 20%."
    - "Days you take 'Omega 3' correlate with higher reading habit completion."
    - " buying coffee boosts productivity for 1 day, but consecutive purchases reduce it."

### 2. Conversational Interface
- Warhead should have a chat/interaction mode.
- **Proactive Questioning**: "I noticed your anxiety was high yesterday. Did you skip your morning meditation?"
- **Goal**: Fill data gaps to confirm theories about performance drivers.

## Feasibility Notes
Implementing this requires two layers:
1.  **Data Aggregation Layer**: A system to flatten all app state (habits, journal, store) into a time-series format (Day-by-Day rows).
2.  **Analysis Engine**:
    - *Statistical* (Correlation algorithms) for simple number crunching.
    - *LLM Integration* (OpenAI/Claude API) for semantic reasoning ("Pattern in journal text") and conversational questioning.
