import { describe, it, expect } from 'vitest';
import { generatePuzzle, getMazeConfig } from '../src/game/puzzleGenerator';
import { solvePathPuzzle, canPathArrowEscape } from '../src/game/puzzleSolver';
import { PathArrow } from '../src/game/arrowTypes';
import { calculateRoundScore } from '../src/game/scoring';

describe('AS Arrow - Polyline Labyrinth Puzzle Engine', () => {
  it('should generate solvable polyline labyrinth puzzles across levels', () => {
    const testLevels = [1, 2, 3, 5, 8, 12];
    for (const level of testLevels) {
      const puzzle = generatePuzzle(level);
      expect(puzzle).toBeDefined();
      expect(puzzle.level).toBe(level);
      expect(puzzle.arrows.length).toBeGreaterThanOrEqual(70);

      // Verify solvePathPuzzle confirms solvability
      const solveResult = solvePathPuzzle(puzzle.arrows, puzzle.gridWidth, puzzle.gridHeight);
      expect(solveResult.isSolvable).toBe(true);
      expect(solveResult.solutionOrder.length).toBe(puzzle.arrows.length);

      // Verify arrows exist across all rows and columns
      const coveredRows = new Set<number>();
      const coveredCols = new Set<number>();
      for (const arrow of puzzle.arrows) {
        for (const pt of arrow.points) {
          coveredRows.add(pt.y);
          coveredCols.add(pt.x);
        }
      }

      for (let r = 0; r <= puzzle.gridHeight; r++) {
        expect(coveredRows.has(r)).toBe(true);
      }
      for (let c = 0; c <= puzzle.gridWidth; c++) {
        expect(coveredCols.has(c)).toBe(true);
      }
    }
  });

  it('should scale labyrinth dimensions and arrow counts with level', () => {
    const l1 = getMazeConfig(1);
    const l5 = getMazeConfig(5);
    const l10 = getMazeConfig(10);
    const l20 = getMazeConfig(20);

    expect(l1.width).toBeLessThanOrEqual(l5.width);
    expect(l5.width).toBeLessThanOrEqual(l10.width);
    expect(l1.targetArrowCount).toBeLessThan(l5.targetArrowCount);
    expect(l5.targetArrowCount).toBeLessThan(l10.targetArrowCount);
    expect(l10.targetArrowCount).toBeLessThanOrEqual(l20.targetArrowCount);
  });

  it('should detect unobstructed escape for free path arrow', () => {
    const arrows: PathArrow[] = [
      { id: '1', points: [{ x: 5, y: 5 }, { x: 5, y: 2 }], direction: 'UP', escaped: false },
    ];
    const res = canPathArrowEscape(arrows[0], arrows, 10, 10);
    expect(res.success).toBe(true);
  });

  it('should detect blocked path arrow when another arrow is in its exit trajectory', () => {
    const arrows: PathArrow[] = [
      { id: 'blocker', points: [{ x: 2, y: 2 }, { x: 8, y: 2 }], direction: 'RIGHT', escaped: false },
      { id: 'blocked', points: [{ x: 5, y: 6 }, { x: 5, y: 4 }], direction: 'UP', escaped: false },
    ];

    const resBlocked = canPathArrowEscape(arrows[1], arrows, 10, 10);
    expect(resBlocked.success).toBe(false);
    expect(resBlocked.blockerId).toBe('blocker');

    // Once blocker escapes, blocked arrow can escape
    arrows[0].escaped = true;
    const resAfter = canPathArrowEscape(arrows[1], arrows, 10, 10);
    expect(resAfter.success).toBe(true);
  });

  it('should calculate round scores accurately', () => {
    const score = calculateRoundScore(40, 12, 15);
    expect(score.baseScore).toBe(4000);
    expect(score.speedBonus).toBe(760);
    expect(score.moveBonus).toBe(425);
    expect(score.totalRoundScore).toBe(5185);
  });
});
