# Gameplay Adjustments - v4.2.3

## Changes Made

### 1. Combo Bonus Starts from 5 Matches ✅

**Previous Behavior:**
- Combo bonus started from 2nd match
- Formula: `(combo - 1) × 10`
- Match 1: 50 points (base)
- Match 2: 60 points (50 + 10 bonus)
- Match 3: 70 points (50 + 20 bonus)
- Match 4: 80 points (50 + 30 bonus)

**New Behavior:**
- Combo bonus starts from 5th match
- Formula: `combo >= 5 ? (combo - 4) × 10 : 0`
- Match 1: 50 points (base, no bonus)
- Match 2: 50 points (base, no bonus)
- Match 3: 50 points (base, no bonus)
- Match 4: 50 points (base, no bonus)
- Match 5: 60 points (50 + 10 bonus) 🔥
- Match 6: 70 points (50 + 20 bonus) 🔥
- Match 7: 80 points (50 + 30 bonus) 🔥

**Impact:**
- Rewards consistent performance
- Makes combo achievement more significant
- Players need to maintain 5+ consecutive matches for bonus

**File Modified:** `js/game-model.js` (line 269)

---

### 2. New Cards Appear at Matched Card Positions ✅

**Previous Behavior:**
- New cards always added to end of list
- Left column: New card appears at bottom
- Right column: New card appears at bottom
- Visual: Cards jump around as matches happen

**New Behavior:**
- New cards inserted exactly where matched cards were removed
- Left column: New card replaces matched card's position
- Right column: New card replaces matched card's position
- Visual: Cards stay in relative positions, feels more stable

**Example Flow:**

**Before Match:**
```
Left Column          Right Column
┌──────────┐        ┌──────────┐
│ Card A   │ ← 0    │ Card 1   │ ← 0
├──────────┤        ├──────────┤
│ Card B   │ ← 1    │ Card 2   │ ← 1  ← Match these!
├──────────┤        ├──────────┤
│ Card C   │ ← 2    │ Card 3   │ ← 2
├──────────┤        ├──────────┤
│ Card D   │ ← 3    │ Card 4   │ ← 3
└──────────┘        └──────────┘
```

**After Match (OLD - append to end):**
```
Left Column          Right Column
┌──────────┐        ┌──────────┐
│ Card A   │ ← 0    │ Card 1   │ ← 0
├──────────┤        ├──────────┤
│ Card C   │ ← 1    │ Card 3   │ ← 1
├──────────┤        ├──────────┤
│ Card D   │ ← 2    │ Card 4   │ ← 2
├──────────┤        ├──────────┤
│ NEW E    │ ← 3    │ NEW 5    │ ← 3  ← Added at end
└──────────┘        └──────────┘
```

**After Match (NEW - insert at position):**
```
Left Column          Right Column
┌──────────┐        ┌──────────┐
│ Card A   │ ← 0    │ Card 1   │ ← 0
├──────────┤        ├──────────┤
│ NEW E    │ ← 1    │ NEW 5    │ ← 1  ← Inserted at position 1
├──────────┤        ├──────────┤
│ Card C   │ ← 2    │ Card 3   │ ← 2
├──────────┤        ├──────────┤
│ Card D   │ ← 3    │ Card 4   │ ← 3
└──────────┘        └──────────┘
```

**Impact:**
- More intuitive - cards don't jump to bottom
- Easier to track - user knows where new card will appear
- Better UX - less visual disruption

---

## Implementation Details

### Combo Bonus Change

**File:** `js/game-model.js`

**Old Code (lines 268-270):**
```javascript
const baseScore = this.SCORE_CORRECT;
const comboBonus = Math.max(0, (this.combo - 1) * this.COMBO_BONUS);
this.score += baseScore + comboBonus;
```

**New Code (lines 268-270):**
```javascript
const baseScore = this.SCORE_CORRECT;
// Бонус комбо начинается с 5 совпадений
const comboBonus = this.combo >= 5 ? (this.combo - 4) * this.COMBO_BONUS : 0;
this.score += baseScore + comboBonus;
```

---

### Position Tracking

**File:** `js/game-model.js`

**Added in applyMatch() (lines 258-263):**
```javascript
// Сохраняем позиции карточек для вставки новых на их место
const leftIndex = this.boardCards.left.findIndex(c => c.id === cardId1 || c.id === cardId2);
const rightIndex = this.boardCards.right.findIndex(c => c.id === cardId1 || c.id === cardId2);

this.lastMatchedPositions = {
    left: leftIndex >= 0 ? leftIndex : null,
    right: rightIndex >= 0 ? rightIndex : null
};
```

**How It Works:**
1. When cards match, find their indices in left/right arrays
2. Store these indices in `lastMatchedPositions`
3. Remove cards from arrays
4. When refilling, use saved positions for insertion

---

### Card Insertion at Position

**File:** `js/game-model.js` - refillBoard()

**Old Code:**
```javascript
if (this.poolCards.left.length > 0) {
    const card = this.poolCards.left.shift();
    card.state = 'active';
    this.boardCards.left.push(card);  // ← Always append
    newCards.push(card);
}
```

**New Code:**
```javascript
if (this.poolCards.left.length > 0) {
    const card = this.poolCards.left.shift();
    card.state = 'active';
    
    // Вставляем на позицию удалённой карточки или в конец
    const insertIndex = this.lastMatchedPositions?.left ?? this.boardCards.left.length;
    this.boardCards.left.splice(insertIndex, 0, card);  // ← Insert at position
    newCards.push({...card, insertIndex, side: 'left'});  // ← Pass position to view
}
```

**Key Points:**
- Uses `splice(index, 0, card)` to insert at specific position
- Falls back to `length` (append) if no position saved
- Passes `insertIndex` to view for DOM insertion
- Clears `lastMatchedPositions` after use

---

### DOM Insertion at Position

**File:** `js/game-view.js` - addNewCards()

**Old Code:**
```javascript
if (container) {
    container.appendChild(el);  // ← Always append to end
    setTimeout(() => el.classList.remove('card-new'), 500);
}
```

**New Code:**
```javascript
if (container) {
    // Вставляем карточку на позицию, где была удалённая карточка
    if (cardData.insertIndex !== undefined && cardData.insertIndex < container.children.length) {
        // Вставляем перед существующей карточкой на этой позиции
        container.insertBefore(el, container.children[cardData.insertIndex]);
    } else {
        // Если позиция не указана или за пределами, добавляем в конец
        container.appendChild(el);
    }
    
    setTimeout(() => el.classList.remove('card-new'), 500);
}
```

**How It Works:**
- `insertBefore(newElement, referenceElement)` inserts before reference
- Uses `container.children[insertIndex]` as reference point
- Falls back to `appendChild` if index invalid

---

## Testing Instructions

### Test 1: Combo Bonus Threshold

1. **Start game** and match 4 cards
2. **Check score:**
   - Match 1: Should be 50
   - Match 2: Should be 100 (50+50, no bonus yet)
   - Match 3: Should be 150 (50+50+50, no bonus yet)
   - Match 4: Should be 200 (50+50+50+50, no bonus yet)

3. **Match 5th card**
   - Score should be 260 (200 + 50 + 10 bonus) 🔥
   - Console should show: "combo: 5"

4. **Match 6th card**
   - Score should be 330 (260 + 50 + 20 bonus) 🔥
   - Console should show: "combo: 6"

**Expected:** No bonus for combos 1-4, bonus starts at combo 5

---

### Test 2: Card Position Persistence

1. **Start game** and note card positions:
   ```
   Position 0: Card A
   Position 1: Card B  ← We'll match this
   Position 2: Card C
   Position 3: Card D
   ```

2. **Match card at position 1**
   - Watch animation
   - Wait for new card to appear

3. **Check new card position:**
   - New card should appear at position 1 (where Card B was)
   - NOT at position 4 (bottom)
   - Cards below should stay in relative positions

**Expected:** New card appears exactly where matched card was removed

---

### Test 3: Visual Stability

1. **Play full game** (18 matches)
2. **Observe card movement:**
   - Cards should not "jump" to bottom after each match
   - New cards should slot into empty spaces
   - Overall layout should feel stable

**Expected:** Smooth, predictable card flow

---

## Console Output Changes

### Before (combo 2):
```
📊 Очки: +60, combo: 2, найдено: 2/18
```
Bonus applied at combo 2

### After (combo 2):
```
📊 Очки: +50, combo: 2, найдено: 2/18
```
No bonus yet

### After (combo 5):
```
📊 Очки: +60, combo: 5, найдено: 5/18
```
Bonus starts at combo 5 🔥

---

## Files Modified

1. ✅ `js/game-model.js` (3 changes)
   - Line 269: Combo bonus formula
   - Lines 258-263: Position tracking in applyMatch()
   - Lines 291-323: Position-based insertion in refillBoard()

2. ✅ `js/game-view.js` (1 change)
   - Lines 149-169: Position-based DOM insertion in addNewCards()

---

## Version

**Previous:** v4.2.2
**Current:** v4.2.3

---

## Summary

✅ Combo bonus now starts from 5th consecutive match (was 2nd)
✅ New cards appear at positions where matched cards were removed (was always at bottom)
✅ Better game balance and UX
✅ Syntax verified
✅ Ready for deployment
