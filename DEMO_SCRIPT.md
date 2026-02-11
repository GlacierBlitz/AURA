# AURA Demo Script

## Overview
This demo showcases AURA's intent-driven accessibility features across two scenarios:
1. **YouTube Navigation** - Video search, playback, and control
2. **Wikipedia Research** - Content exploration with accessibility enhancements

**Duration:** ~8-10 minutes  
**Key Features Demonstrated:** Voice input, natural language commands, accessibility controls, AI-powered navigation

---

## Setup & Introduction (1 minute)

### Opening
> "Today I'm demonstrating AURA - an intent-driven accessible browser that lets users control websites through natural language and voice commands. AURA is designed accessibility-first, using AI to understand user intent and execute actions automatically."

### Launch AURA
1. **Start the application**
   ```bash
   npm start
   ```

2. **Point out the interface**
   - Split layout: website viewer + AI assistant chat panel
   - Voice input button with microphone icon
   - Notice the hint: "💡 Tip: Hold Space for voice input"

> "The interface is clean and accessible - users can interact through typing OR voice commands using the spacebar for push-to-talk."

---

## Scenario 1: YouTube Video Experience (4-5 minutes)

### 1.1 Navigate to YouTube
**Type in chat panel:**
```
Go to YouTube
```

> "Notice how AURA understands the intent and navigates directly to YouTube.com"

*Wait for page to load*

### 1.2 Search for Content (Voice Demo)
**Hold Spacebar and speak:**
```
Search for "accessibility in web design tutorials"
```

> "I'm using voice input here - holding spacebar activates push-to-talk. AURA uses OpenAI Whisper for accurate speech recognition."

*Wait for search to execute*

### 1.3 Select and Play Video
**Type in chat panel:**
```
Click on the first video result
```

*Wait for video to load*

**Voice command (Hold Spacebar):**
```
Play the video
```

> "AURA can control video playback through natural language - no need to find specific buttons."

### 1.4 Video Control Demo
**Type in chat panel:**
```
Pause the video
```

*Pause for effect*

**Voice command (Hold Spacebar):**
```
Skip forward 30 seconds
```

**Type in chat panel:**
```
Turn on captions
```

> "These commands work because AURA extracts the page's accessibility structure and maps user intent to the correct actions."

### 1.5 Navigation Demo
**Voice command (Hold Spacebar):**
```
Go to the trending page
```

*Wait for navigation*

**Type in chat panel:**
```
Scroll down to see more videos
```

---

## Scenario 2: Wikipedia Research with Accessibility (4-5 minutes)

### 2.1 Navigate to Wikipedia
**Type in chat panel:**
```
Go to Wikipedia
```

### 2.2 Search for Topic
**Voice command (Hold Spacebar):**
```
Search for "artificial intelligence"
```

*Wait for search and page load*

### 2.3 Content Exploration
**Type in chat panel:**
```
Scroll to the history section
```

**Voice command (Hold Spacebar):**
```
Read me the first paragraph of the history section
```

> "AURA can extract and summarize content, making it easier for users with different accessibility needs."

### 2.4 Accessibility Features Demo

#### Enable High Contrast
**Type in chat panel:**
```
Turn on high contrast mode
```

> "Watch how the page becomes more accessible for users with visual impairments."

#### Increase Font Size
**Voice command (Hold Spacebar):**
```
Make the text larger
```

#### Navigate Accessibility Panel
**Type in chat panel:**
```
Open accessibility settings
```

*Show the accessibility panel*

> "Users can adjust font sizes, contrast, and other settings through natural language commands."

### 2.5 Advanced Navigation
**Type in chat panel:**
```
Find the section about machine learning
```

**Voice command (Hold Spacebar):**
```
Click on the machine learning link
```

*Wait for page navigation*

**Type in chat panel:**
```
Go back to the previous page
```

---

## Key Features Highlight (1 minute)

### Demonstrate Multi-Modal Input
> "AURA supports multiple interaction methods:"

1. **Text Commands** *(type in chat)*: `Click the subscribe button`
2. **Voice Commands** *(hold spacebar)*: "Scroll to the top"
3. **Button Click**: *(click microphone icon)* "Search for tutorials"

### Show Accessibility Integration
> "Every command works through AURA's accessibility-first approach:"
- Extracts semantic page structure
- Maps natural language to precise actions
- Works with screen readers and keyboard navigation
- Provides voice feedback for all actions

### Security & Safety
> "AURA includes safety features:"
- Content sanitization to prevent prompt injection
- User confirmation for sensitive actions
- Action validation before execution

---

## Closing Demo (30 seconds)

### Final Commands
**Voice command (Hold Spacebar):**
```
Go to the AURA homepage
```

**Type in chat panel:**
```
Thank you for watching the demo
```

### Closing Statement
> "AURA bridges the gap between user intent and web interaction, making the internet more accessible through AI-powered natural language control. Whether you prefer typing or voice commands, AURA adapts to your needs while maintaining strong accessibility standards."

---

## Demo Tips & Troubleshooting

### If Commands Don't Work:
1. **Rephrase more specifically**: "Click the red subscribe button" instead of "subscribe"
2. **Break into steps**: "Click search box" → "Type cat videos" → "Press enter"
3. **Use visible labels**: Commands work best with text that's actually visible on screen

### Voice Input Tips:
- Hold Spacebar firmly - release when done speaking
- Speak clearly and at normal pace
- Voice works anywhere in the app when not typing in text fields

### Best Demo Practices:
- **Narrate Actions**: Explain what AURA is processing
- **Show Both Input Methods**: Mix typing and voice throughout
- **Highlight Accessibility**: Emphasize how it helps different user needs
- **Handle Failures Gracefully**: If something doesn't work, show how to rephrase

### Backup Commands (if primary fails):
- YouTube: "Click on videos tab" / "Go to YouTube home"
- Wikipedia: "Click on main page" / "Search in the search box"
- General: "Scroll up" / "Go back" / "Click the first link"

---

## Technical Notes

**System Requirements:**
- OpenAI API key configured
- Microphone permissions granted
- Stable internet connection

**Voice Features:**
- Uses OpenAI Whisper for transcription
- Push-to-talk with Spacebar
- Smart input detection (doesn't activate while typing)

**Accessibility Standards:**
- WCAG 2.1 Level AA compliant
- Screen reader compatible
- Full keyboard navigation support
- Configurable accessibility settings