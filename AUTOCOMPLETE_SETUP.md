# Search Autocomplete Setup Guide

## Overview
The search bar now includes autocomplete functionality powered by SERP API (Google Serper). This provides intelligent search suggestions as users type in the URL/search bar.

## Setup Instructions

### 1. Get a SERP API Key
1. Visit [https://serper.dev](https://serper.dev)
2. Sign up for a free account
3. Copy your API key from the dashboard

### 2. Configure the API Key
Add your SERP API key to the `.env` file in the project root:

```bash
# .env
OPENAI_API_KEY=sk_your_openai_key_here
SERP_API_KEY=your_serper_api_key_here
```

### 3. Restart the Application
Kill and restart the Electron application for the changes to take effect.

## Features

### Autocomplete Search
- Type in the URL bar to get search suggestions
- Suggestions appear in a dropdown below the input field
- Click on a suggestion to navigate to it
- Press Enter to search or navigate

### Technical Details

**Request Handling:**
- Uses SERP API's `/suggest` endpoint
- Debounced requests with 300ms delay to avoid excessive API calls
- Maximum of 8 suggestions displayed

**Error Handling:**
- Gracefully handles API errors
- Falls back to empty suggestions if SERP service is unavailable
- 5-second timeout on API requests

**Performance:**
- Cached suggestions in React state
- Debounced API calls to reduce request overhead
- Keyboard accessible and screen reader friendly

## File Changes

### New Files
- `src/main/services/serpService.ts` - SERP API service
- `src/renderer/hooks/useAutocomplete.ts` - React hook for autocomplete
- `AUTOCOMPLETE_SETUP.md` - This file

### Modified Files
- `src/main/index.ts` - Instantiated SerpService
- `src/main/ipc/ipcHandlers.ts` - Added autocomplete IPC handler
- `src/shared/types/ipc.ts` - Added autocomplete types and channels
- `src/preload/preload.ts` - Exposed invoke method for IPC
- `src/renderer/components/NavigationBar.tsx` - Integrated autocomplete
- `src/renderer/styles/NavigationBar.css` - Added dropdown styles

## Keyboard Navigation

- **Arrow Down/Up**: Navigate through suggestions (when dropdown is open)
- **Enter**: Select highlighted suggestion or submit search
- **Escape**: Close suggestions dropdown
- **Tab**: Move to next form element

## Accessibility

- Full keyboard navigation support
- ARIA labels for screen readers
- Semantic HTML structure
- High contrast visual indicators
- Focus management for keyboard users
