# Hierarchy Backbone V2

## Overview
This is a clean architecture environment for rebuilding the core hierarchy structure of the application. It is logically isolated from the existing system and should not be connected to current features until explicitly requested.

## Architecture
- **Domain**: Contains the core entities and business rules (e.g., HierarchyNode, Area, Project, Task).
- **Application**: Contains use cases and service logic for manipulating the hierarchy.
- **Infrastructure**: Contains data persistence logic, state management adapters, and external service integrations.

## Core Hierarchy Principles
1. **Strict Tree Structure**: Every node (except Life Areas) must have exactly one parent.
2. **Type-Safe Relations**: Nodes follow a strict inheritance path:
    - **Life Area** (Root)
    - **Skill** (Parent: Life Area)
    - **Objective** (Parent: Skill)
    - **Stage** (Parent: Objective)
    - **Task** (Parent: Stage)
    - **Session** (Parent: Task)
3. **Validation**: The `HierarchyService` enforces these relations upon creation or movement.
4. **Atomic Operations**: Hierarchy mutations should be atomic to prevent orphan nodes.

## Structural Testing UI
A minimal UI for testing this backbone is available at `/backbone-tester`. 
It allows for:
- Creating nodes at every level (Life Area → Session).
- Toggling completion for Tasks and Sessions.
- Viewing roll-up progress calculation for parent nodes.
- Validating relational rules (errors will pop up if rules are violated).



