export interface LevelConfig {
  level: number;
  gridSize: number;
  arrowCount: number;
  minObstructions: number;
  targetDifficulty: number; // 1 - 100
}

export function getLevelConfig(level: number): LevelConfig {
  let gridSize: number;
  let arrowCount: number;
  let minObstructions: number;
  let targetDifficulty: number;

  if (level <= 3) {
    // Level 1-3: High 32x18 Landscape
    gridSize = 32;
    arrowCount = 65 + level * 3;
    minObstructions = 20 + level * 5;
    targetDifficulty = 85 + level * 2;
  } else if (level <= 8) {
    // Level 4-8: Extreme 34x20 Landscape
    gridSize = 34;
    arrowCount = 75 + (level - 3) * 2;
    minObstructions = 35 + (level - 3) * 4;
    targetDifficulty = 92 + (level - 3);
  } else {
    // Level 9+: Master 36x21 Landscape
    gridSize = 36;
    arrowCount = 86 + Math.min(20, (level - 8));
    minObstructions = 50;
    targetDifficulty = 100;
  }

  return {
    level,
    gridSize,
    arrowCount,
    minObstructions,
    targetDifficulty,
  };
}
