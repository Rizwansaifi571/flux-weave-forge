# Jarvis AI-First Task Management - Implementation Plan

## Vision
Transform the tasks page from a form-based manual interface into an **AI-first command center** where users interact primarily through natural language commands.

---

## Phase 1: AI Command Panel & Infrastructure

### 1.1 AI Command Prompt Interface
- **Location**: Top of tasks page (before current form)
- **Component**: Large, prominent text input
- **UI**: 
  - "Ask Jarvis" label with sparkle icon
  - Textarea-style input for multi-line commands
  - [Generate Plan] CTA button
  - Suggested quick commands below
- **Actions**: Accept natural language input like:
  - "Complete 25 DSA videos in 10 days"
  - "Build Employee Management System"
  - "Plan my week"
  - "Reschedule overdue tasks"

### 1.2 AI Integrations & Tool Setup
- Create Groq/Claude integration for natural language processing
- Implement tool-calling architecture:
  - `create_task()` - Create individual tasks
  - `create_project()` - Create project with milestones
  - `batch_create_tasks()` - Create multiple tasks
  - `reschedule_tasks()` - Intelligent rescheduling
  - `analyze_productivity()` - Generate insights
  - `prioritize_tasks()` - Smart prioritization
  - `get_user_preferences()` - Personalization (study time, capacity, etc.)

### 1.3 Backend API Endpoints
- `POST /api/ai/parse-command` - Parse natural language to structured plan
- `POST /api/ai/execute-plan` - Execute generated plan (create tasks/projects)
- `POST /api/ai/reschedule` - Intelligent rescheduling
- `POST /api/ai/analyze` - Generate productivity insights

---

## Phase 2: Core AI Workflows

### 2.1 Goal → Project → Tasks Flow
**When user says**: "Complete Striver DSA Sheet in 3 months"

**AI Flow**:
1. Extract goal, duration, category
2. Estimate workload (based on similar historical tasks)
3. Create project
4. Generate milestones (monthly/weekly breakdowns)
5. Create granular tasks with smart scheduling
6. Add revision sessions
7. Balance workload (prevent burnout)
8. Present plan for confirmation

**Output to User**:
```
📊 Generated Plan

Project: Striver DSA Sheet (90 days)

Week 1-2: Arrays & Strings (8 tasks)
Week 3-4: Graphs (12 tasks)
...
Final Week: Revision + Practice (5 tasks)

Total: 87 tasks scheduled
Estimated commitment: 2-3 hours/day

[Confirm & Generate] [Adjust Plan] [Cancel]
```

### 2.2 Smart Rescheduling
**When user says**: "I couldn't study yesterday"

**AI Flow**:
1. Detect missed tasks
2. Analyze remaining capacity
3. Redistribute missed work across next N days
4. Preserve original deadlines if possible
5. Alert on critical tasks

**Output**: Single-click reschedule confirmation

### 2.3 Break Down Tasks
**When user says**: "Build an Employee Management System"

**AI Flow**:
1. Decompose into phases (Setup → DB → Auth → Features → Testing → Deploy)
2. Create subtasks with dependencies
3. Assign effort estimates
4. Schedule intelligently

### 2.4 Daily/Weekly Planning
**When user says**: "I have 3 hours today" or "Plan my week"

**AI Flow**:
1. Analyze priority, deadlines, completion rate
2. Select optimal tasks for time slot
3. Consider user's productive hours
4. Balance across categories

---

## Phase 3: AI Quick Actions UI

### 3.1 Quick Action Buttons
Add prominent button row:
```
✨ Plan My Day
✨ Plan My Week
✨ Reschedule Tasks
✨ Break Down Goal
✨ Prioritize Next
✨ Productivity Report
```

Each triggers a pre-configured AI workflow with minimal user input.

### 3.2 AI Coach Card
Replace generic motivation with actionable insights:
```
🤖 AI Coach

✅ 83% of planned work completed this week
🕘 Most productive: 8 PM - 11 PM
⚠️  Weak area: Theory Revision

💡 Suggestion:
Schedule CN before DSA tonight.
You completed 4/5 CN tasks last week.
```

---

## Phase 4: Personalization & Memory

### 4.1 User Profile (stored in DB)
- Preferred study times
- Daily capacity (hours available)
- Categories/priorities
- Learning style (theory → practice, or vice versa)
- Historical completion rate
- Weak areas

### 4.2 AI Context Window
AI remembers:
- Current active projects
- Historical task patterns
- Completion rates by category
- Time-of-day productivity
- Previous goals and outcomes

---

## Phase 5: UI/UX Transformation

### Current vs. New Layout

**Current** (Form-Based):
- Add Task form (takes up space)
- Manual fields
- No AI assistance

**New** (AI-First):
```
┌─────────────────────────────────┐
│  Ask Jarvis  ✨                 │
│  "Finish DSA in 90 days"       │
│  [Generate Plan]               │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Quick Actions                  │
│ ✨ Plan Day  ✨ Reschedule etc │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Today's Mission (AI Selected)  │
│  1. Binary Search (45 min)      │
│  2. Graph Theory Revision...    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  AI Coach                       │
│  83% completion this week...    │
└─────────────────────────────────┘

[Task List - Existing]
```

---

## Implementation Order

### Sprint 1: Foundation
1. Create `AiCommandPanel` component
2. Setup Groq/Claude integration
3. Implement `/api/ai/parse-command` endpoint
4. Create `create_task()` & `create_project()` tools
5. Basic natural language parsing

### Sprint 2: Core Workflows
1. Implement goal → project → tasks flow
2. Smart scheduling algorithm
3. Batch task creation
4. Visual plan confirmation UI

### Sprint 3: Advanced Features
1. Rescheduling logic
2. Quick action buttons
3. AI Coach insights
4. Productivity analytics

### Sprint 4: Personalization
1. User preference system
2. Context-aware recommendations
3. Historical analysis

---

## Technical Decisions

### AI Model Choice
- **Groq**: Fast, cost-effective, good for real-time commands
- **Claude**: Better reasoning, good for complex breakdowns
- **Hybrid**: Use Groq for parsing, Claude for planning

### Architecture
```
User Input
    ↓
[AI Parser] → Extract intent, params
    ↓
[Plan Generator] → Create structured plan
    ↓
[Confirmation UI] → Show plan to user
    ↓
[Executor] → Create tasks/projects
```

### Database Additions
- `user_preferences` table
- `ai_generated_plans` table (audit trail)
- `task_templates` table (for common patterns)

---

## Success Metrics

✅ User completes complex goals with minimal form interaction
✅ Average task creation time drops from 2-3 min to <30 sec
✅ Users interact with AI commands 3+ times per session
✅ 70%+ plan acceptance rate
✅ Task completion rate increases due to smarter scheduling

---

## Files to Create/Modify

### New Components
- `src/components/AiCommandPanel.tsx` - Main AI input
- `src/components/AiQuickActions.tsx` - Action buttons
- `src/components/AiCoachCard.tsx` - Insights display
- `src/components/PlanConfirmation.tsx` - Plan preview modal

### New Pages/Routes
- `/src/routes/ai-tools.tsx` - Advanced AI features

### New API
- `src/api/ai/parse-command.ts`
- `src/api/ai/execute-plan.ts`
- `src/api/ai/reschedule.ts`
- `src/api/ai/analyze.ts`

### Modified Files
- `src/routes/tasks.tsx` - Refactor with new layout
- `src/lib/store.ts` - Add project management, batch operations
- `package.json` - Add Groq/Claude SDK

---

## Next Steps

1. **Approve plan** - Confirm direction
2. **Setup AI integration** - Groq/Claude keys
3. **Create components** - Start with AiCommandPanel
4. **Implement first workflow** - Goal → Tasks
5. **Iterate** - Add quick actions, insights, etc.
