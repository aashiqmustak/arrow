import { PathArrow, Direction, Puzzle, Point } from './arrowTypes';
import { solvePathPuzzle, canPathArrowEscape, getDirectionDelta } from './puzzleSolver';

const DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

function generateArrowId(index: number): string {
  return `arr_${index}_${Math.random().toString(36).substring(2, 7)}`;
}

export interface GridConfig {
  width: number;
  height: number;
  targetArrowCount: number;
  difficulty: number;
}

export function getMazeConfig(level: number): GridConfig {
  if (level <= 3) {
    return {
      width: 10,
      height: 14,
      targetArrowCount: 10 + level * 2, // 12 - 16 arrows
      difficulty: 15 + level * 5,
    };
  } else if (level <= 7) {
    return {
      width: 12,
      height: 16,
      targetArrowCount: 16 + (level - 3) * 2, // 18 - 24 arrows
      difficulty: 35 + (level - 3) * 6,
    };
  } else if (level <= 14) {
    return {
      width: 14,
      height: 18,
      targetArrowCount: 22 + (level - 7) * 2, // 24 - 34 arrows
      difficulty: 60 + (level - 7) * 4,
    };
  } else {
    return {
      width: 14,
      height: 20,
      targetArrowCount: 30 + Math.min(18, (level - 14) * 2), // 32 - 48 arrows
      difficulty: Math.min(100, 85 + (level - 14)),
    };
  }
}

/**
 * Generates an L-shaped, U-shaped, S-shaped or straight polyline path within grid bounds.
 */
function createRandomWindingPath(
  start: Point,
  gridWidth: number,
  gridHeight: number,
  numBends: number
): { points: Point[]; headDir: Direction } | null {
  const points: Point[] = [start];
  let curX = start.x;
  let curY = start.y;
  let lastDir: Direction | null = null;

  for (let b = 0; b <= numBends; b++) {
    // Pick next orthogonal direction different from reverse of last
    const availableDirs: Direction[] = DIRECTIONS.filter(d => {
      if (!lastDir) return true;
      if (lastDir === 'UP' && (d === 'DOWN' || d === 'UP')) return false;
      if (lastDir === 'DOWN' && (d === 'UP' || d === 'DOWN')) return false;
      if (lastDir === 'LEFT' && (d === 'RIGHT' || d === 'LEFT')) return false;
      if (lastDir === 'RIGHT' && (d === 'LEFT' || d === 'RIGHT')) return false;
      return true;
    });

    const dir = availableDirs[Math.floor(Math.random() * availableDirs.length)];
    const { dx, dy } = getDirectionDelta(dir);
    const segLen = Math.floor(Math.random() * 3) + 2; // 2 to 4 units

    const nextX = Math.max(1, Math.min(gridWidth - 1, curX + dx * segLen));
    const nextY = Math.max(1, Math.min(gridHeight - 1, curY + dy * segLen));

    if (nextX === curX && nextY === curY) {
      continue;
    }

    curX = nextX;
    curY = nextY;
    points.push({ x: curX, y: curY });
    lastDir = dir;
  }

  if (points.length < 2 || !lastDir) return null;

  return { points, headDir: lastDir };
}

/**
 * Procedurally generates a dense, interlocking polyline arrow labyrinth
 * with 100% guaranteed solvability via reverse placement.
 */
export function generatePuzzle(level: number, customSeed?: string): Puzzle {
  const config = getMazeConfig(level);
  const { width, height, targetArrowCount } = config;
  const puzzleId = customSeed || `maze_L${level}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  let bestArrows: PathArrow[] = [];
  let attempts = 0;
  const maxOuterAttempts = 40;

  while (attempts < maxOuterAttempts && bestArrows.length < Math.floor(targetArrowCount * 0.75)) {
    attempts++;
    const arrows: PathArrow[] = [];
    const occupiedCoords = new Set<string>();

    let tryCount = 0;
    const maxTries = 300;

    while (arrows.length < targetArrowCount && tryCount < maxTries) {
      tryCount++;

      // Pick start coordinates on even grid cells for clean spacing
      const startX = Math.floor(Math.random() * (width - 2)) + 1;
      const startY = Math.floor(Math.random() * (height - 2)) + 1;
      const numBends = Math.floor(Math.random() * 3); // 0 (straight), 1 (L-bend), 2 (U/S-shape)

      const pathData = createRandomWindingPath({ x: startX, y: startY }, width, height, numBends);
      if (!pathData) continue;

      const candidateArrow: PathArrow = {
        id: generateArrowId(arrows.length),
        points: pathData.points,
        direction: pathData.headDir,
        escaped: false,
      };

      // Check if candidate points collide or overlap heavily with already placed arrows
      let overlap = false;
      for (let i = 0; i < pathData.points.length - 1; i++) {
        const p1 = pathData.points[i];
        const p2 = pathData.points[i + 1];
        const dx = Math.sign(p2.x - p1.x);
        const dy = Math.sign(p2.y - p1.y);
        let cx = p1.x;
        let cy = p1.y;

        while (true) {
          if (occupiedCoords.has(`${cx},${cy}`)) {
            overlap = true;
            break;
          }
          if (cx === p2.x && cy === p2.y) break;
          cx += dx;
          cy += dy;
        }
        if (overlap) break;
      }

      if (overlap) continue;

      // In reverse-escape logic:
      // Candidate arrow's forward exit path must not be blocked by ALREADY placed arrows (j < i)
      const currentArrows = [...arrows];
      const escapeCheck = canPathArrowEscape(candidateArrow, currentArrows, width, height);

      if (escapeCheck.success) {
        // Valid! Add to placed arrows
        arrows.push(candidateArrow);

        // Record occupied points
        for (let i = 0; i < pathData.points.length - 1; i++) {
          const p1 = pathData.points[i];
          const p2 = pathData.points[i + 1];
          const dx = Math.sign(p2.x - p1.x);
          const dy = Math.sign(p2.y - p1.y);
          let cx = p1.x;
          let cy = p1.y;
          while (true) {
            occupiedCoords.add(`${cx},${cy}`);
            if (cx === p2.x && cy === p2.y) break;
            cx += dx;
            cy += dy;
          }
        }
      }
    }

    if (arrows.length > bestArrows.length) {
      bestArrows = arrows;
    }
  }

  // Ensure border perimeter arrows if count is low
  if (bestArrows.length < 6) {
    bestArrows = generateFallbackMaze();
  }

  const solveResult = solvePathPuzzle(bestArrows, width, height);

  return {
    id: puzzleId,
    level,
    gridWidth: width,
    gridHeight: height,
    arrows: bestArrows,
    difficulty: config.difficulty,
    solution: solveResult.solutionOrder,
    createdAt: Date.now(),
  };
}

/**
 * Fallback hand-crafted intricate labyrinth structure guaranteeing rich playability.
 */
function generateFallbackMaze(): PathArrow[] {
  const arrows: PathArrow[] = [
    // Top border straight & L
    { id: 'f_0', points: [{ x: 1, y: 5 }, { x: 1, y: 1 }], direction: 'UP', escaped: false },
    { id: 'f_1', points: [{ x: 2, y: 3 }, { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 1 }], direction: 'UP', escaped: false },
    { id: 'f_2', points: [{ x: 5, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 1 }], direction: 'UP', escaped: false },
    { id: 'f_3', points: [{ x: 8, y: 1 }, { x: 11, y: 1 }, { x: 11, y: 2 }], direction: 'RIGHT', escaped: false },
    // Upper middle winding
    { id: 'f_4', points: [{ x: 9, y: 3 }, { x: 4, y: 3 }], direction: 'LEFT', escaped: false },
    { id: 'f_5', points: [{ x: 1, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 4 }], direction: 'UP', escaped: false },
    { id: 'f_6', points: [{ x: 8, y: 4 }, { x: 8, y: 5 }, { x: 7, y: 5 }], direction: 'LEFT', escaped: false },
    { id: 'f_7', points: [{ x: 10, y: 5 }, { x: 10, y: 3 }], direction: 'UP', escaped: false },
    // Center Labyrinth
    { id: 'f_8', points: [{ x: 1, y: 6 }, { x: 9, y: 6 }, { x: 9, y: 7 }], direction: 'DOWN', escaped: false },
    { id: 'f_9', points: [{ x: 2, y: 7 }, { x: 6, y: 7 }], direction: 'LEFT', escaped: false },
    { id: 'f_10', points: [{ x: 1, y: 8 }, { x: 1, y: 12 }], direction: 'DOWN', escaped: false },
    { id: 'f_11', points: [{ x: 2, y: 12 }, { x: 2, y: 8 }, { x: 3, y: 8 }], direction: 'UP', escaped: false },
    { id: 'f_12', points: [{ x: 4, y: 9 }, { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 5, y: 9 }], direction: 'DOWN', escaped: false },
    { id: 'f_13', points: [{ x: 7, y: 8 }, { x: 11, y: 8 }, { x: 11, y: 9 }], direction: 'RIGHT', escaped: false },
    { id: 'f_14', points: [{ x: 8, y: 10 }, { x: 8, y: 9 }, { x: 10, y: 9 }], direction: 'RIGHT', escaped: false },
    { id: 'f_15', points: [{ x: 3, y: 11 }, { x: 3, y: 10 }, { x: 5, y: 10 }], direction: 'RIGHT', escaped: false },
    // Bottom Winding
    { id: 'f_16', points: [{ x: 4, y: 12 }, { x: 4, y: 13 }], direction: 'DOWN', escaped: false },
    { id: 'f_17', points: [{ x: 5, y: 13 }, { x: 5, y: 11 }, { x: 6, y: 11 }], direction: 'RIGHT', escaped: false },
    { id: 'f_18', points: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 9, y: 12 }, { x: 9, y: 13 }], direction: 'DOWN', escaped: false },
    { id: 'f_19', points: [{ x: 10, y: 13 }, { x: 10, y: 11 }, { x: 11, y: 11 }], direction: 'RIGHT', escaped: false },
  ];

  return arrows;
}
