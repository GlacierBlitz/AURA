# Team Work Distribution (3 People)

## 🎯 Integration Timeline

```
Day 1-2: All work independently (starter files provided)
         ↓
Day 3:   Person 1 + Person 2 merge → Test basic actions
         ↓
Day 4:   Add Person 3's work → Full pipeline working
         ↓
Day 5:   Bug fixes, polish, demo prep
```

---

## 👤 Person 1: Action Execution + Validation (Backend Core)

### Your Files:
- ✅ `src/main/execution/actionValidator.ts` (created)
- ✅ `src/main/execution/actionExecutionEngine.ts` (created)
- ✅ `src/main/execution/cdpCommands.ts` (created)

### Your Tasks:
1. **ActionValidator** - Implement all validation rules:
   - Schema validation (V-001 through V-008): types, required fields, lengths, formats
   - Runtime validation (R-001 through R-006): element existence, visibility, interactability
   - Security validation (S-001 through S-004): cross-domain, sensitive fields, destructive actions

2. **CDP Commands** - Implement helper functions:
   - `queryElement()` - Check if element exists, visible, interactable
   - `clickElement()` - Execute click via CDP
   - `typeText()` - Type into input fields
   - `selectOption()` - Select dropdown options
   - `scroll()` - Scroll page or element
   - `navigateToUrl()` - Navigate to new URL
   - `waitForElement()` - Wait for element to appear
   - `waitForStabilization()` - Wait for page to settle

3. **ActionExecutionEngine** - Implement execution logic:
   - Execute all 11 action types (CLICK, TYPE, SELECT, SUBMIT, NAVIGATE, SCROLL, WAIT, EXTRACT, CHECK, HOVER, FOCUS)
   - Retry logic with exponential backoff (3 retries)
   - Timeout handling (10 seconds max per action)
   - Error handling and detailed result reporting

### Testing Strategy:
- Unit test each action type with mocked CDP
- Test validation rules (should reject invalid actions)
- Test retry logic (should retry on transient failures)

### Dependencies:
- You'll integrate with **Person 2's LLM output** (ActionDescriptor objects)
- Person 2 will call your `ActionExecutionEngine.executeAction()`

---

## 👤 Person 2: LLM Intent + Context Management (AI Brain)

### Your Files:
- ✅ `src/main/pipeline/contextManager.ts` (created)
- 📝 `src/main/llm/llmOrchestrator.ts` (extend existing)
- 📝 `src/main/llm/promptTemplates.ts` (extend existing)
- 📝 `src/main/pipeline/intentPipeline.ts` (extend existing)

### Your Tasks:
1. **ContextManager** - Implement conversation state:
   - Store last 5 conversation messages
   - Track total token usage (~8000 token budget for context)
   - Implement automatic summarization when approaching limits
   - Store page state snapshots (last 3 pages)
   - Provide formatted context for LLM prompts

2. **LLMOrchestrator** - Add new method `interpretIntent()`:
   - Accept user instruction + current page state + conversation history
   - Use GPT-4o function calling to generate structured `ActionPlanResponse`
   - Parse LLM response into `ActionDescriptor[]` array
   - Handle clarification requests (when LLM is unsure)
   - Handle multi-step plans (up to 20 steps per validation)

3. **Prompt Templates** - Create instruction interpretation prompts:
   - System prompt: Define AI assistant role
   - Include current page context (title, URL, available elements)
   - Include conversation history
   - Enforce structured output (JSON schema for actions)
   - Add examples of good action plans

4. **IntentPipeline** - Extend for user instructions:
   - Add new IPC handler for `user:submit-instruction`
   - Integrate ContextManager (add messages to history)
   - Call `llmOrchestrator.interpretIntent()`
   - Send action plan to **Person 1's ActionExecutionEngine** for execution
   - Send results back to renderer

### Testing Strategy:
- Test with simple instructions: "Click the login button"
- Test multi-step: "Search for TypeScript and open first result"
- Test clarification: "Click the button" (which button?)
- Test token budget: Long conversation should trigger summarization

### Dependencies:
- You'll call **Person 1's ActionExecutionEngine** to execute actions
- **Person 3's ConfirmationService** will intercept sensitive actions

---

## 👤 Person 3: Confirmation + Logging + UI Polish (Safety & UX)

### Your Files:
- ✅ `src/main/services/confirmationService.ts` (created)
- ✅ `src/main/services/actionLogger.ts` (created)
- ✅ `src/renderer/components/ConfirmationDialog.tsx` (created)
- ✅ `src/renderer/components/ConfirmationDialog.css` (created)
- ✅ `src/renderer/components/ActionLogViewer.tsx` (created)
- ✅ `src/renderer/components/ActionLogViewer.css` (created)
- 📝 `src/renderer/components/ChatPanel.tsx` (improve existing)

### Your Tasks:
1. **ConfirmationService** - Implement action safety:
   - Classify actions as `always`, `conditional`, or `never` needing confirmation
   - Detect sensitive fields (password, credit card, SSN)
   - Detect destructive actions (delete, remove, cancel account)
   - Detect cross-domain navigation
   - Generate human-readable confirmation messages
   - Handle IPC communication for confirmation requests/responses

2. **ActionLogger** - Implement audit trail:
   - Set up SQLite database with `better-sqlite3`
   - Create actions table schema (id, timestamp, instruction, action type, status, etc.)
   - Implement `logAction()` with sensitive data redaction
   - Redact passwords, credit cards, SSNs, partial email redaction
   - Implement `queryLog()` with filters (date range, action type, status)
   - Implement `exportToJson()` and `exportToCsv()`

3. **ConfirmationDialog** - Build confirmation UI:
   - Modal dialog with action description
   - Show consequences (warnings)
   - Confirm/Cancel/Modify buttons
   - Keyboard accessible (Escape to cancel, Tab navigation)
   - Integrate with TTS to read message aloud
   - Send IPC message with user's decision

4. **ActionLogViewer** - Build log viewer UI:
   - Fetch logs from main process via IPC
   - Display as table (timestamp, instruction, action type, status, duration)
   - Add filters (date range, action type, success/failed)
   - Add export buttons (JSON, CSV)
   - Pagination for large logs

5. **ChatPanel Improvements**:
   - Add message bubbles (user vs assistant)
   - Add loading states ("Thinking...", "Executing action...")
   - Add error message display
   - Add clarification option buttons (when LLM asks for clarification)
   - Improve styling and animations

### Testing Strategy:
- Test confirmation dialog shows for sensitive actions (password submit, cross-domain nav)
- Test log entries are created and queryable
- Test sensitive data is redacted (passwords show as ******, credit cards as **** **** **** ****)
- Test UI is keyboard accessible

### Dependencies:
- **Person 2's IntentPipeline** will call your `ConfirmationService.requiresConfirmation()`
- **Person 2's IntentPipeline** will call your `ActionLogger.logAction()` after each action

---

## 📦 Integration Checklist

### Day 3: Merge Person 1 + Person 2
- [ ] Person 2 can call `ActionExecutionEngine.executeAction()`
- [ ] Test: "Click the login button" → action executes successfully
- [ ] Test: Multi-step task → actions execute sequentially

### Day 4: Add Person 3
- [ ] ConfirmationService intercepts sensitive actions before execution
- [ ] ActionLogger records all actions to database
- [ ] UI shows confirmation dialog for sensitive actions
- [ ] UI shows action log viewer with history

### Day 5: Final Polish
- [ ] Test across multiple websites (Wikipedia, GitHub, Google)
- [ ] Fix any bugs discovered
- [ ] Polish UI/UX
- [ ] Prepare demo script

---

## 🚀 Getting Started

### Person 1:
```bash
git checkout -b feature/action-execution
# All starter files are created in src/main/execution/
# Start with actionValidator.ts (validate action schemas)
# Then cdpCommands.ts (implement CDP helpers)
# Finally actionExecutionEngine.ts (orchestrate execution)
```

### Person 2:
```bash
git checkout -b feature/llm-intent
# Start with contextManager.ts (conversation history)
# Then extend llmOrchestrator.ts (add interpretIntent method)
# Update promptTemplates.ts (add instruction prompts)
# Finally extend intentPipeline.ts (wire everything together)
```

### Person 3:
```bash
git checkout -b feature/confirmation-logging-ui
# Start with actionLogger.ts (SQLite setup)
# Then confirmationService.ts (classify actions)
# Then ConfirmationDialog.tsx (UI component)
# Finally ActionLogViewer.tsx (log display)
```

---

## 📞 Communication

Since you're working in parallel, coordinate on these points:

1. **IPC Channel Names** (freeze these now):
   - `user:submit-instruction` - User sends instruction
   - `pipeline:confirmation-required` - Need user confirmation
   - `user:confirmation-response` - User confirms/cancels
   - `pipeline:query-log` - Fetch action history
   - `pipeline:log-results` - Return log entries
   - `pipeline:export-log` - Export log as JSON/CSV

2. **Shared Types** (already defined in `src/shared/types/`):
   - `ActionDescriptor` - Action schema
   - `PageState` - Page structure
   - Don't modify these without team agreement!

3. **Integration Points**:
   - Person 2 calls Person 1's `executeAction()`
   - Person 2 calls Person 3's `requiresConfirmation()` before execution
   - Person 2 calls Person 3's `logAction()` after execution

---

Good luck! 🚀
