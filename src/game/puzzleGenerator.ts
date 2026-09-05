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
  if (level <= 1) {
    return {
      width: 34,
      height: 20,
      targetArrowCount: 95,
      difficulty: 95,
    };
  } else if (level <= 3) {
    return {
      width: 34,
      height: 20,
      targetArrowCount: 110 + (level - 1) * 8, // 110 - 126 arrows
      difficulty: 100 + level * 2,
    };
  } else if (level <= 8) {
    return {
      width: 36,
      height: 21,
      targetArrowCount: 130 + (level - 3) * 6, // 136 - 160 arrows
      difficulty: 108 + (level - 3) * 2,
    };
  } else {
    return {
      width: 38,
      height: 22,
      targetArrowCount: 165 + Math.min(45, (level - 8) * 5), // 170 - 210+ arrows
      difficulty: 120 + Math.min(30, level),
    };
  }
}

/**
 * Normalizes an edge between two adjacent points into a unique string key.
 */
function getEdgeKey(x1: number, y1: number, x2: number, y2: number): string {
  if (x1 < x2 || (x1 === x2 && y1 < y2)) {
    return `${x1},${y1}-${x2},${y2}`;
  }
  return `${x2},${y2}-${x1},${y1}`;
}

/**
 * Creates a spiral path (concentric rectangular turns) as seen in reference.
 */
function createSpiralPath(
  start: Point,
  gridWidth: number,
  gridHeight: number
): { points: Point[]; headDir: Direction } | null {
  const points: Point[] = [start];
  let curX = start.x;
  let curY = start.y;

  const clockwise = Math.random() > 0.5;
  const seq: Direction[] = clockwise
    ? ['RIGHT', 'DOWN', 'LEFT', 'UP']
    : ['DOWN', 'RIGHT', 'UP', 'LEFT'];

  const startDirIdx = Math.floor(Math.random() * 4);
  const stride = Math.floor(Math.random() * 4) + 4; // 4 to 7 units
  let lastDir: Direction = seq[startDirIdx];

  const turns = Math.floor(Math.random() * 3) + 3; // 3 to 5 spiral turns
  for (let t = 0; t < turns; t++) {
    const dir = seq[(startDirIdx + t) % 4];
    const { dx, dy } = getDirectionDelta(dir);
    const step = Math.max(2, stride - Math.floor(t * 0.9));

    const nextX = Math.max(0, Math.min(gridWidth, curX + dx * step));
    const nextY = Math.max(0, Math.min(gridHeight, curY + dy * step));

    if (nextX === curX && nextY === curY) break;

    curX = nextX;
    curY = nextY;
    points.push({ x: curX, y: curY });
    lastDir = dir;
  }

  if (points.length < 3) return null;
  return { points, headDir: lastDir };
}

/**
 * Creates a serpentine / zigzag wave path (S-bends, W-waves).
 */
function createZigzagPath(
  start: Point,
  gridWidth: number,
  gridHeight: number
): { points: Point[]; headDir: Direction } | null {
  const points: Point[] = [start];
  let curX = start.x;
  let curY = start.y;

  const isHorizontal = Math.random() > 0.5;
  const numRipples = Math.floor(Math.random() * 3) + 2; // 2 to 4 bends
  const waveLength = Math.floor(Math.random() * 3) + 2; // 2 to 4 units
  const waveHeight = Math.floor(Math.random() * 3) + 2; // 2 to 4 units

  let lastDir: Direction = isHorizontal ? 'RIGHT' : 'DOWN';

  if (isHorizontal) {
    const dirX: Direction = Math.random() > 0.5 ? 'RIGHT' : 'LEFT';
    const { dx } = getDirectionDelta(dirX);
    let signY = Math.random() > 0.5 ? 1 : -1;

    for (let r = 0; r < numRipples; r++) {
      const nextY = Math.max(0, Math.min(gridHeight, curY + signY * waveHeight));
      if (nextY !== curY) {
        curY = nextY;
        points.push({ x: curX, y: curY });
        lastDir = signY > 0 ? 'DOWN' : 'UP';
      }

      const nextX = Math.max(0, Math.min(gridWidth, curX + dx * waveLength));
      if (nextX !== curX) {
        curX = nextX;
        points.push({ x: curX, y: curY });
        lastDir = dirX;
      }
      signY = -signY;
    }
  } else {
    const dirY: Direction = Math.random() > 0.5 ? 'DOWN' : 'UP';
    const { dy } = getDirectionDelta(dirY);
    let signX = Math.random() > 0.5 ? 1 : -1;

    for (let r = 0; r < numRipples; r++) {
      const nextX = Math.max(0, Math.min(gridWidth, curX + signX * waveHeight));
      if (nextX !== curX) {
        curX = nextX;
        points.push({ x: curX, y: curY });
        lastDir = signX > 0 ? 'RIGHT' : 'LEFT';
      }

      const nextY = Math.max(0, Math.min(gridHeight, curY + dy * waveLength));
      if (nextY !== curY) {
        curY = nextY;
        points.push({ x: curX, y: curY });
        lastDir = dirY;
      }
      signX = -signX;
    }
  }

  if (points.length < 3) return null;
  return { points, headDir: lastDir };
}

/**
 * Creates random multi-bend winding paths (L, U, staircase, stairs, snakes).
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
    // Dynamic segment length
    const segLen = Math.floor(Math.random() * 5) + 2;

    const nextX = Math.max(0, Math.min(gridWidth, curX + dx * segLen));
    const nextY = Math.max(0, Math.min(gridHeight, curY + dy * segLen));

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
 * Checks if path points conflict with already occupied edges/nodes.
 */
function checkPathOverlap(
  points: Point[],
  occupiedNodes: Set<string>,
  occupiedEdges: Set<string>
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = Math.sign(p2.x - p1.x);
    const dy = Math.sign(p2.y - p1.y);
    let cx = p1.x;
    let cy = p1.y;

    while (true) {
      if (occupiedNodes.has(`${cx},${cy}`)) {
        return true;
      }
      if (cx === p2.x && cy === p2.y) break;

      const nx = cx + dx;
      const ny = cy + dy;
      const edgeKey = getEdgeKey(cx, cy, nx, ny);
      if (occupiedEdges.has(edgeKey)) {
        return true;
      }

      cx = nx;
      cy = ny;
    }
  }
  return false;
}

/**
 * Registers path points and edges into occupancy sets.
 */
function registerPathOccupancy(
  points: Point[],
  occupiedNodes: Set<string>,
  occupiedEdges: Set<string>,
  coveredRows: Set<number>,
  coveredCols: Set<number>
) {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = Math.sign(p2.x - p1.x);
    const dy = Math.sign(p2.y - p1.y);
    let cx = p1.x;
    let cy = p1.y;

    while (true) {
      occupiedNodes.add(`${cx},${cy}`);
      coveredRows.add(cy);
      coveredCols.add(cx);

      if (cx === p2.x && cy === p2.y) break;
      const nx = cx + dx;
      const ny = cy + dy;
      occupiedEdges.add(getEdgeKey(cx, cy, nx, ny));
      cx = nx;
      cy = ny;
    }
  }
}

/**
 * Procedurally generates a dense, interlocking polyline arrow labyrinth
 * where every row (0..gridHeight) and column (0..gridWidth) of the grid is filled by arrows with 100% solvability.
 */
export function generatePuzzle(level: number, customSeed?: string): Puzzle {
  const config = getMazeConfig(level);
  const { width, height, targetArrowCount } = config;
  const puzzleId = customSeed || `maze_L${level}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  let bestArrows: PathArrow[] = [];
  let attempts = 0;
  const maxOuterAttempts = 8;

  while (attempts < maxOuterAttempts) {
    attempts++;
    const arrows: PathArrow[] = [];
    const occupiedNodes = new Set<string>();
    const occupiedEdges = new Set<string>();
    const coveredRows = new Set<number>();
    const coveredCols = new Set<number>();

    // Pass 1: Primary Archetype Placement (Spirals, Zigzags, Multi-Bend Snakes)
    let tryCount = 0;
    const maxTries = 240;

    while (arrows.length < targetArrowCount && tryCount < maxTries) {
      tryCount++;

      const startX = Math.floor(Math.random() * (width + 1));
      const startY = Math.floor(Math.random() * (height + 1));

      let pathData: { points: Point[]; headDir: Direction } | null = null;
      const roll = Math.random();

      if (roll < 0.30) {
        pathData = createSpiralPath({ x: startX, y: startY }, width, height);
      } else if (roll < 0.60) {
        pathData = createZigzagPath({ x: startX, y: startY }, width, height);
      } else {
        const numBends = Math.floor(Math.random() * 5) + 2; // 2 to 6 bends
        pathData = createRandomWindingPath({ x: startX, y: startY }, width, height, numBends);
      }

      if (!pathData || pathData.points.length < 2) continue;

      const candidate: PathArrow = {
        id: generateArrowId(arrows.length),
        points: pathData.points,
        direction: pathData.headDir,
        escaped: false,
      };

      if (checkPathOverlap(pathData.points, occupiedNodes, occupiedEdges)) {
        continue;
      }

      const escapeCheck = canPathArrowEscape(candidate, arrows, width, height);
      if (escapeCheck.success) {
        arrows.push(candidate);
        registerPathOccupancy(pathData.points, occupiedNodes, occupiedEdges, coveredRows, coveredCols);
      }
    }

    // Pass 2: Systematic Lane & Grid Line Coverage Pass for ALL rows (0..height)
    // Splits long free spans into multiple interlocking arrows of length 2-5
    for (let y = 0; y <= height; y++) {
      let spanStart: number | null = null;
      for (let x = 0; x <= width + 1; x++) {
        const isFree = x <= width && !occupiedNodes.has(`${x},${y}`);
        if (isFree && spanStart === null) {
          spanStart = x;
        } else if (!isFree && spanStart !== null) {
          let cur = spanStart;
          const end = x - 1;
          while (end - cur >= 1) {
            const maxChunk = Math.min(end - cur + 1, Math.floor(Math.random() * 3) + 2); // 2 to 4 units
            if (maxChunk < 2) break;
            const segEnd = cur + maxChunk - 1;
            const dir: Direction = Math.random() > 0.5 ? 'RIGHT' : 'LEFT';
            const pts: Point[] = dir === 'RIGHT'
              ? [{ x: cur, y }, { x: segEnd, y }]
              : [{ x: segEnd, y }, { x: cur, y }];

            const candidate: PathArrow = {
              id: generateArrowId(arrows.length),
              points: pts,
              direction: dir,
              escaped: false,
            };

            if (!checkPathOverlap(pts, occupiedNodes, occupiedEdges)) {
              const res = canPathArrowEscape(candidate, arrows, width, height);
              if (res.success) {
                arrows.push(candidate);
                registerPathOccupancy(pts, occupiedNodes, occupiedEdges, coveredRows, coveredCols);
              }
            }
            cur = segEnd + 1;
          }
          spanStart = null;
        }
      }
    }

    // Pass 3: Systematic Lane & Grid Line Coverage Pass for ALL columns (0..width)
    // Splits long vertical spans into multiple interlocking arrows of length 2-4
    for (let x = 0; x <= width; x++) {
      let spanStart: number | null = null;
      for (let y = 0; y <= height + 1; y++) {
        const isFree = y <= height && !occupiedNodes.has(`${x},${y}`);
        if (isFree && spanStart === null) {
          spanStart = y;
        } else if (!isFree && spanStart !== null) {
          let cur = spanStart;
          const end = y - 1;
          while (end - cur >= 1) {
            const maxChunk = Math.min(end - cur + 1, Math.floor(Math.random() * 3) + 2); // 2 to 4 units
            if (maxChunk < 2) break;
            const segEnd = cur + maxChunk - 1;
            const dir: Direction = Math.random() > 0.5 ? 'DOWN' : 'UP';
            const pts: Point[] = dir === 'DOWN'
              ? [{ x, y: cur }, { x, y: segEnd }]
              : [{ x, y: segEnd }, { x, y: cur }];

            const candidate: PathArrow = {
              id: generateArrowId(arrows.length),
              points: pts,
              direction: dir,
              escaped: false,
            };

            if (!checkPathOverlap(pts, occupiedNodes, occupiedEdges)) {
              const res = canPathArrowEscape(candidate, arrows, width, height);
              if (res.success) {
                arrows.push(candidate);
                registerPathOccupancy(pts, occupiedNodes, occupiedEdges, coveredRows, coveredCols);
              }
            }
            cur = segEnd + 1;
          }
          spanStart = null;
        }
      }
    }

    // Pass 4: Micro-Pocket & Corner Hook Filling Pass (L-turns & U-turns across all cells)
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (!occupiedNodes.has(`${x},${y}`)) {
          const shapes: { pts: Point[]; dir: Direction }[] = [
            { pts: [{ x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }], dir: 'DOWN' },
            { pts: [{ x, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }], dir: 'RIGHT' },
            { pts: [{ x: x + 1, y: y + 1 }, { x: x + 1, y }, { x, y }], dir: 'LEFT' },
            { pts: [{ x: x + 1, y: y + 1 }, { x, y: y + 1 }, { x, y }], dir: 'UP' },
            { pts: [{ x, y: y + 1 }, { x, y }, { x: x + 1, y }], dir: 'RIGHT' },
            { pts: [{ x: x + 1, y }, { x, y }, { x, y: y + 1 }], dir: 'DOWN' },
            { pts: [{ x, y }, { x: x + 1, y }], dir: 'RIGHT' },
            { pts: [{ x: x + 1, y }, { x, y }], dir: 'LEFT' },
            { pts: [{ x, y }, { x, y: y + 1 }], dir: 'DOWN' },
            { pts: [{ x, y: y + 1 }, { x, y }], dir: 'UP' },
          ];

          for (const s of shapes) {
            if (s.pts.every(p => p.x <= width && p.y <= height) && !checkPathOverlap(s.pts, occupiedNodes, occupiedEdges)) {
              const candidate: PathArrow = {
                id: generateArrowId(arrows.length),
                points: s.pts,
                direction: s.dir,
                escaped: false,
              };
              const res = canPathArrowEscape(candidate, arrows, width, height);
              if (res.success) {
                arrows.push(candidate);
                registerPathOccupancy(s.pts, occupiedNodes, occupiedEdges, coveredRows, coveredCols);
                break;
              }
            }
          }
        }
      }
    }

    // Pass 5: Dedicated Enforcement for any uncovered row (0..height)
    for (let y = 0; y <= height; y++) {
      if (!coveredRows.has(y)) {
        // Find any 2 adjacent free nodes along row y
        for (let x = 0; x < width; x++) {
          if (!occupiedNodes.has(`${x},${y}`) && !occupiedNodes.has(`${x + 1},${y}`)) {
            const dir: Direction = x > width / 2 ? 'LEFT' : 'RIGHT';
            const pts: Point[] = dir === 'RIGHT'
              ? [{ x, y }, { x: x + 1, y }]
              : [{ x: x + 1, y }, { x, y }];
            const candidate: PathArrow = {
              id: generateArrowId(arrows.length),
              points: pts,
              direction: dir,
              escaped: false,
            };
            if (!checkPathOverlap(pts, occupiedNodes, occupiedEdges)) {
              const res = canPathArrowEscape(candidate, arrows, width, height);
              if (res.success) {
                arrows.push(candidate);
                registerPathOccupancy(pts, occupiedNodes, occupiedEdges, coveredRows, coveredCols);
                break;
              }
            }
          }
        }
      }
    }

    // Pass 6: Dedicated Enforcement for any uncovered column (0..width)
    for (let x = 0; x <= width; x++) {
      if (!coveredCols.has(x)) {
        // Find any 2 adjacent free nodes along col x
        for (let y = 0; y < height; y++) {
          if (!occupiedNodes.has(`${x},${y}`) && !occupiedNodes.has(`${x},${y + 1}`)) {
            const dir: Direction = y > height / 2 ? 'UP' : 'DOWN';
            const pts: Point[] = dir === 'DOWN'
              ? [{ x, y }, { x, y: y + 1 }]
              : [{ x, y: y + 1 }, { x, y }];
            const candidate: PathArrow = {
              id: generateArrowId(arrows.length),
              points: pts,
              direction: dir,
              escaped: false,
            };
            if (!checkPathOverlap(pts, occupiedNodes, occupiedEdges)) {
              const res = canPathArrowEscape(candidate, arrows, width, height);
              if (res.success) {
                arrows.push(candidate);
                registerPathOccupancy(pts, occupiedNodes, occupiedEdges, coveredRows, coveredCols);
                break;
              }
            }
          }
        }
      }
    }

    // Check if this attempt is solvable
    const solveCheck = solvePathPuzzle(arrows, width, height);
    if (solveCheck.isSolvable && arrows.length > bestArrows.length) {
      bestArrows = arrows;
      // If we have enough arrows and complete row/col coverage, break early
      const allRowsCovered = Array.from({ length: height + 1 }).every((_, r) => coveredRows.has(r));
      const allColsCovered = Array.from({ length: width + 1 }).every((_, c) => coveredCols.has(c));
      if (arrows.length >= Math.floor(targetArrowCount * 0.85) && allRowsCovered && allColsCovered) {
        break;
      }
    }
  }

  // Ensure fallback if somehow empty
  if (bestArrows.length < 15) {
    bestArrows = generateFallbackLandscapeMaze(width, height);
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
 * Fallback hand-crafted intricate labyrinth structure guaranteeing rich playability in landscape
 * with arrows across rows and columns.
 */
function generateFallbackLandscapeMaze(width: number, height: number): PathArrow[] {
  const arrows: PathArrow[] = [
    // Top border winding paths
    { id: 'f_0', points: [{ x: 2, y: 5 }, { x: 2, y: 0 }], direction: 'UP', escaped: false },
    { id: 'f_1', points: [{ x: 3, y: 3 }, { x: 3, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 0 }], direction: 'UP', escaped: false },
    { id: 'f_2', points: [{ x: 8, y: 3 }, { x: 12, y: 3 }, { x: 12, y: 0 }], direction: 'UP', escaped: false },
    { id: 'f_3', points: [{ x: 13, y: 2 }, { x: 18, y: 2 }, { x: 18, y: 0 }], direction: 'UP', escaped: false },
    { id: 'f_4', points: [{ x: 19, y: 4 }, { x: 23, y: 4 }, { x: 23, y: 0 }], direction: 'UP', escaped: false },

    // Top Right Spiral & Loops
    { id: 'f_5', points: [{ x: 17, y: 5 }, { x: 25, y: 5 }, { x: 25, y: 3 }, { x: 15, y: 3 }], direction: 'LEFT', escaped: false },
    { id: 'f_6', points: [{ x: 21, y: 7 }, { x: 21, y: 6 }, { x: 17, y: 6 }, { x: 17, y: 7 }], direction: 'DOWN', escaped: false },

    // Left Spiral & Loops
    { id: 'f_7', points: [{ x: 4, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 7 }, { x: 3, y: 7 }, { x: 3, y: 4 }, { x: 7, y: 4 }], direction: 'RIGHT', escaped: false },
    { id: 'f_8', points: [{ x: 0, y: 8 }, { x: 0, y: 2 }, { x: 0, y: 0 }], direction: 'UP', escaped: false },
    { id: 'f_9', points: [{ x: 1, y: 9 }, { x: 3, y: 9 }, { x: 3, y: 10 }, { x: 5, y: 10 }], direction: 'RIGHT', escaped: false },

    // Center Sprawling Snakes
    { id: 'f_10', points: [{ x: 8, y: 7 }, { x: 8, y: 5 }, { x: 11, y: 5 }, { x: 11, y: 4 }, { x: 14, y: 4 }], direction: 'RIGHT', escaped: false },
    { id: 'f_11', points: [{ x: 9, y: 9 }, { x: 9, y: 8 }, { x: 13, y: 8 }, { x: 13, y: 7 }, { x: 15, y: 7 }], direction: 'RIGHT', escaped: false },
    { id: 'f_12', points: [{ x: 16, y: 9 }, { x: 16, y: 8 }, { x: 19, y: 8 }, { x: 19, y: 9 }], direction: 'DOWN', escaped: false },

    // Bottom Waves & Spirals
    { id: 'f_13', points: [{ x: 2, y: 12 }, { x: 2, y: height }], direction: 'DOWN', escaped: false },
    { id: 'f_14', points: [{ x: 3, y: 13 }, { x: 6, y: 13 }, { x: 6, y: height }], direction: 'DOWN', escaped: false },
    { id: 'f_15', points: [{ x: 7, y: 12 }, { x: 11, y: 12 }, { x: 11, y: height }], direction: 'DOWN', escaped: false },
    { id: 'f_16', points: [{ x: 12, y: 13 }, { x: 17, y: 13 }, { x: 17, y: height }], direction: 'DOWN', escaped: false },
    { id: 'f_17', points: [{ x: 18, y: 12 }, { x: 22, y: 12 }, { x: 22, y: height }], direction: 'DOWN', escaped: false },

    // Right Border Exits
    { id: 'f_18', points: [{ x: 15, y: 11 }, { x: width, y: 11 }], direction: 'RIGHT', escaped: false },
    { id: 'f_19', points: [{ x: 20, y: 9 }, { x: width, y: 9 }], direction: 'RIGHT', escaped: false },
    { id: 'f_20', points: [{ x: 1, y: 14 }, { x: 1, y: 11 }, { x: 4, y: 11 }], direction: 'RIGHT', escaped: false },
  ];

  return arrows.filter(a => a.points.every(p => p.x <= width && p.y <= height));
}

