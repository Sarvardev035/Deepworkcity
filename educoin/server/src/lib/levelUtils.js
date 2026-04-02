// Level thresholds: index = level - 1
// Level 1: 0, Level 2: 100, Level 3: 300, Level 4: 600, Level 5: 1000
// Each subsequent: Math.round(prev * 1.8)
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1800, 3240, 5832, 10498, 18896];

export const calculateLevel = (totalCoins) => {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalCoins >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
};

export const getLevelThreshold = (level) => {
  return LEVEL_THRESHOLDS[level - 1] ?? 0;
};

export const getNextLevelThreshold = (level) => {
  return LEVEL_THRESHOLDS[level] ?? null; // null = max level
};

export const calculateCoins = (durationMinutes, focusScore) => {
  const base = durationMinutes * 1;
  const focusBonus = base * (focusScore / 100);
  return Math.round(base + focusBonus);
};
