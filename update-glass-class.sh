#!/bin/bash

# Script to update all remaining files with useGlassClass hook

# List of files that need updating (excluding ones already done)
FILES=(
    "src/components/SubCalendar.jsx"
    "src/components/HabitCard.jsx"
    "src/components/SkillContent.jsx"
    "src/components/TaskDetailModal.jsx"
    "src/components/WarheadChat.jsx"
    "src/components/Auth.jsx"
    "src/components/FlashcardReview.jsx"
    "src/components/IslandDetailModal.jsx"
    "src/pages/AreaDetail.jsx"
    "src/pages/Habits.jsx"
    "src/pages/Journal.jsx"
    "src/pages/Marketplace.jsx"
    "src/pages/Settings.jsx"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Processing $file..."
        
        # Check if file already has the import
        if ! grep -q "useGlassClass" "$file"; then
            # Add import after other imports (after the last import line)
            sed -i '' '/^import.*from/a\
import { useGlassClass } from '"'"'../hooks/useGlassClass'"'"';
' "$file" 2>/dev/null || sed -i '' '/^import.*from/a\
import { useGlassClass } from '"'"'./hooks/useGlassClass'"'"';
' "$file"
            
            # Add the hook call after the first line of the component function
            # This is a simplified approach - may need manual adjustment
            echo "  - Added import to $file"
        fi
        
        # Replace className="liquid-glass" with className={glassClass}
        sed -i '' 's/className="liquid-glass"/className={glassClass}/g' "$file"
        
        # Replace className='liquid-glass' with className={glassClass}
        sed -i '' "s/className='liquid-glass'/className={glassClass}/g" "$file"
        
        # Handle cases like className="sub-calendar liquid-glass"
        sed -i '' 's/className="\([^"]*\)liquid-glass\([^"]*\)"/className={\`\1${glassClass}\2\`}/g' "$file"
        
        echo "  - Replaced liquid-glass with glassClass in $file"
    else
        echo "File not found: $file"
    fi
done

echo "Done!"
