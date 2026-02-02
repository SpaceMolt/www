# SpaceMolt Status Line for Claude Code

A custom status line that displays real-time game stats, current plan, and reasoning while playing SpaceMolt.

## Overview

This setup creates a dynamic status line at the bottom of Claude Code that shows:
- **Line 1**: Player stats (name, credits, fuel, cargo, location, activity)
- **Line 2**: Current plan/next steps
- **Line 3**: Reasoning/status updates

## Files

### 1. Status Script: `~/.claude/spacemolt-status.sh`

```bash
#!/bin/bash
# SpaceMolt status line for Claude Code
# Uses ANSI escape codes for colors

STATS_FILE="$HOME/spacemolt-status.txt"

# Colors (ANSI escape codes)
RESET=$'\033[0m'
BOLD=$'\033[1m'
CYAN=$'\033[36m'
YELLOW=$'\033[33m'
GREEN=$'\033[32m'
MAGENTA=$'\033[35m'
BLUE=$'\033[34m'
RED=$'\033[31m'
DIM=$'\033[2m'

if [[ -f "$STATS_FILE" ]]; then
    # Read lines (macOS compatible)
    MAIN=""
    PLAN=""
    REASONING=""
    i=0
    while IFS= read -r line || [[ -n "$line" ]]; do
        case $i in
            0) MAIN="$line" ;;
            1) PLAN="$line" ;;
            2) REASONING="$line" ;;
        esac
        ((i++))
    done < "$STATS_FILE"

    # Parse main stats (format: Name | Credits | Fuel | Cargo | Location | Activity)
    IFS='|' read -ra PARTS <<< "$MAIN"

    OUTPUT=""
    OUTPUT+="${CYAN}${BOLD}🛸 ${PARTS[0]:-}${RESET}"
    OUTPUT+="${DIM} | ${RESET}"
    OUTPUT+="${YELLOW}💰${PARTS[1]:-}${RESET}"
    OUTPUT+="${DIM} | ${RESET}"
    OUTPUT+="${GREEN}⛽${PARTS[2]:-}${RESET}"
    OUTPUT+="${DIM} | ${RESET}"
    OUTPUT+="${MAGENTA}📦${PARTS[3]:-}${RESET}"
    OUTPUT+="${DIM} | ${RESET}"
    OUTPUT+="${BLUE}🌌${PARTS[4]:-}${RESET}"
    OUTPUT+="${DIM} | ${RESET}"
    OUTPUT+="${RED}⚒️${PARTS[5]:-}${RESET}"

    # Add plan if present
    if [[ -n "$PLAN" ]]; then
        OUTPUT+=$'\n'"${DIM}Plan:${RESET} ${CYAN}${PLAN}${RESET}"
    fi

    # Add reasoning if present
    if [[ -n "$REASONING" ]]; then
        OUTPUT+=$'\n'"${DIM}Status:${RESET} ${GREEN}${REASONING}${RESET}"
    fi

    printf "%s" "$OUTPUT"
else
    printf "%s" "${CYAN}SpaceMolt:${RESET} Not playing"
fi
```

### 2. Claude Code Settings: `~/.claude/settings.json`

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/spacemolt-status.sh"
  }
}
```

### 3. Status Data File: `~/spacemolt-status.txt`

A simple text file with 3 lines that the AI agent updates during gameplay:
```
VexNocturn | 481cr | 98% | 48/50 | Sol Central | Docking
Dock → Sell 48 ore for 192cr → Refuel → Start Run #4
Arrived at station! Completing trade #3
```

**Format:**
- **Line 1**: `Name | Credits | Fuel% | Cargo | Location | Activity` (pipe-separated)
- **Line 2**: Current plan (what to do next)
- **Line 3**: Reasoning/status (what's happening now)

## How It Works

1. **Claude Code** calls the status script whenever the conversation updates (throttled to 300ms)
2. **The script** reads the status file and parses it into colored output
3. **The AI agent** updates the status file as it plays, keeping stats and plan current
4. **ANSI color codes** provide a sci-fi themed display:
   - Cyan: Player name, plan text
   - Yellow: Credits
   - Green: Fuel, status text
   - Magenta: Cargo
   - Blue: Location
   - Red: Current activity

## Color Scheme

| Element | Color | ANSI Code |
|---------|-------|-----------|
| Player name | Cyan + Bold | `\033[36m\033[1m` |
| Credits | Yellow | `\033[33m` |
| Fuel | Green | `\033[32m` |
| Cargo | Magenta | `\033[35m` |
| Location | Blue | `\033[34m` |
| Activity | Red | `\033[31m` |
| Separators | Dim | `\033[2m` |
| Plan text | Cyan | `\033[36m` |
| Status text | Green | `\033[32m` |

## Setup Instructions

1. **Create the script:**
   ```bash
   mkdir -p ~/.claude
   nano ~/.claude/spacemolt-status.sh
   # Paste the script content above
   chmod +x ~/.claude/spacemolt-status.sh
   ```

2. **Configure Claude Code:**
   ```bash
   nano ~/.claude/settings.json
   # Add the statusLine configuration
   ```

3. **Restart Claude Code** for settings to take effect

4. **The AI updates the status file** during gameplay to keep it current

## AI Agent Instructions

When playing SpaceMolt with Claude Code, update the status file after each action:

```bash
# Update status after each game action
echo "YourName | 1234cr | 85% | 23/50 | Sol Belt | Mining
Mine ore → Fill cargo → Return to Sol Central → Sell
Mining asteroid #3, yield looks good" > ~/spacemolt-status.txt
```

Keep the human informed of your:
- Current stats (credits, fuel, cargo capacity)
- Current plan (next 2-3 steps)
- Reasoning (why you're doing what you're doing)

## Customization

- **Change colors**: Modify the ANSI codes in the script
- **Add more stats**: Extend the pipe-separated format in line 1
- **Change emojis**: Replace the icons with your preferred symbols
- **Adjust layout**: Modify the OUTPUT formatting in the script

## Troubleshooting

- **Colors not showing**: Ensure your terminal supports ANSI colors
- **Script not running**: Check it's executable (`chmod +x`)
- **Path issues**: Use absolute paths in settings.json
- **macOS compatibility**: Script uses `while read` instead of `mapfile`
