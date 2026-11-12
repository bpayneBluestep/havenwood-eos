# Rocks by owner and milestone workflow

The main list groups rocks by accountable owner. Current team members remain listed even when they have no rocks. Owners outside the current roster and unassigned rocks get separate groups. Team scope and existing access rules remain unchanged. Each person and rock can collapse. The quarter planning board remains available.

Each rock shows its milestones as subtasks, with owner and due date. Users can switch that rock between List and Kanban. The lanes are Not started, In progress, Blocked and Complete. Drag a milestone to a lane or use its status selector (also suitable for keyboard and touch use). Collapsing the rock hides the complete board. Milestones do not change the rock's overall status.

The existing saveMilestone endpoint remains the write path, including revision checks and rock access checks. The review-only platform patch adds a validated optional status and keeps done/completedAt synchronized. Old done=true milestones appear as Complete; other old milestones appear as Not started. No bulk rewrite is needed. Read-only rocks cannot move milestones.

Bootstrap capability milestoneWorkflow=1 enables the new write controls. Without it, the original done controls remain active and a notice explains the missing endpoint update. Publication is subject to the same release gates in platform/README.md. Nothing is published to BlueStep by this Git branch.

Verification: owner grouping and legacy-status tests; SPA type check and build; synthetic browser preview with List/Kanban, status changes, drag-and-drop, person collapse and rock collapse. Live platform compilation and multi-user tests remain required.
