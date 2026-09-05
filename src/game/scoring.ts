import { PlayerScoreBreakdown } from './arrowTypes';

export interface ScoringConfig {
  baseScoreMultiplier: number;
  maxSpeedBonus: number;
  speedDeductionPerSecond: number;
  maxMoveBonus: number;
  moveDeductionPerMove: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  baseScoreMultiplier: 100,
  maxSpeedBonus: 1000,
  speedDeductionPerSecond: 20,
  maxMoveBonus: 500,
  moveDeductionPerMove: 5,
};

/**
 * Computes authoritative round score breakdown.
 * Formula:
 * baseScore = difficulty * 100
 * speedBonus = max(0, 1000 - completionTime * 20)
 * moveBonus = max(0, 500 - moves * 5)
 * totalRoundScore = baseScore + speedBonus + moveBonus
 */
export function calculateRoundScore(
  difficulty: number,
  completionTimeSeconds: number,
  moves: number,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): PlayerScoreBreakdown {
  const baseScore = Math.round(difficulty * config.baseScoreMultiplier);
  const speedBonus = Math.max(
    0,
    Math.round(config.maxSpeedBonus - completionTimeSeconds * config.speedDeductionPerSecond)
  );
  const moveBonus = Math.max(
    0,
    Math.round(config.maxMoveBonus - moves * config.moveDeductionPerMove)
  );
  const totalRoundScore = baseScore + speedBonus + moveBonus;

  return {
    baseScore,
    speedBonus,
    moveBonus,
    totalRoundScore,
  };
}
