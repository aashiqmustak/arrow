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
    // Level 1-3: Easy 4x4
    gridSize = 4;
    arrowCount = 6 + level * 2; // 8, 10, 12
    minObstructions = Math.max(1, level);
    targetDifficulty = Math.min(25, 10 + level * 5);
  } else if (level <= 7) {
    // Level 4-7: Medium 5x5
    gridSize = 5;
    arrowCount = 12 + (level - 3) * 2; // 14, 16, 18, 20
    minObstructions = 2 + (level - 3);
    targetDifficulty = 25 + (level - 3) * 6; // 31, 37, 43, 49
  } else if (level <= 12) {
    // Level 8-12: Hard 6x6
    gridSize = 6;
    arrowCount = 20 + (level - 7) * 2; // 22, 24, 26, 28, 30
    minObstructions = 5 + (level - 7);
    targetDifficulty = 50 + (level - 7) * 4; // 54, 58, 62, 66, 70
  } else if (level <= 20) {
    // Level 13-20: Very Hard 7x7
    gridSize = 7;
    arrowCount = 28 + Math.min(14, (level - 12) * 2); // 30 - 42
    minObstructions = 9 + Math.min(6, level - 12);
    targetDifficulty = 72 + Math.min(18, (level - 12) * 2); // 74 - 90
  } else {
    // Level 20+: Extreme 8x8
    gridSize = 8;
    const extra = Math.min(16, (level - 20));
    arrowCount = 42 + extra; // 42 - 58
    minObstructions = 14 + Math.min(10, Math.floor(extra / 2));
    targetDifficulty = Math.min(100, 90 + Math.floor(extra * 0.7));
  }

  return {
    level,
    gridSize,
    arrowCount,
    minObstructions,
    targetDifficulty,
  };
}
