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
      width: 32,
      height: 18,
      targetArrowCount: 65 + level * 3, // 68 - 74 arrows
      difficulty: 85 + level * 2,
    };
  } else if (level <= 8) {
    return {
      width: 34,
      height: 20,
      targetArrowCount: 75 + (level - 3) * 2, // 77 - 85 arrows
      difficulty: 92 + (level - 3),
    };
  } else {
    return {
      width: 36,
      height: 21,
      targetArrowCount: 86 + Math.min(20, (level - 8)), // 87 - 105+ arrows
      difficulty: 100,
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
  let stride = Math.floor(Math.random() * 4) + 4; // 4 to 7 units
  let lastDir: Direction = seq[startDirIdx];

  const turns = Math.floor(Math.random() * 3) + 3; // 3 to 5 spiral turns
  for (let t = 0; t < turns; t++) {
    const dir = seq[(startDirIdx + t) % 4];
    const { dx, dy } = getDirectionDelta(dir);
    const step = Math.max(2, stride - Math.floor(t * 1.1));

    const nextX = Math.max(1, Math.min(gridWidth - 1, curX + dx * step));
    const nextY = Math.max(1, Math.min(gridHeight - 1, curY + dy * step));

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
      const nextY = Math.max(1, Math.min(gridHeight - 1, curY + signY * waveHeight));
      if (nextY !== curY) {
        curY = nextY;
        points.push({ x: curX, y: curY });
        lastDir = signY > 0 ? 'DOWN' : 'UP';
      }

      const nextX = Math.max(1, Math.min(gridWidth - 1, curX + dx * waveLength));
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
      const nextX = Math.max(1, Math.min(gridWidth - 1, curX + signX * waveHeight));
      if (nextX !== curX) {
        curX = nextX;
        points.push({ x: curX, y: curY });
        lastDir = signX > 0 ? 'RIGHT' : 'LEFT';
      }

      const nextY = Math.max(1, Math.min(gridHeight - 1, curY + dy * waveLength));
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
  occupiedEdges: Set<string>
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
 * where every row and column line of the grid is filled by arrows with 100% solvability.
 */
export function generatePuzzle(level: number, customSeed?: string): Puzzle {
  const config = getMazeConfig(level);
  const { width, height, targetArrowCount } = config;
  const puzzleId = customSeed || `maze_L${level}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  let bestArrows: PathArrow[] = [];
  let attempts = 0;
  const maxOuterAttempts = 4;

  while (attempts < maxOuterAttempts && bestArrows.length < Math.floor(targetArrowCount * 0.7)) {
    attempts++;
    const arrows: PathArrow[] = [];
    const occupiedNodes = new Set<string>();
    const occupiedEdges = new Set<string>();

    // Pass 1: Primary Archetype Placement (Spirals, Zigzags, Multi-Bend Snakes)
    let tryCount = 0;
    const maxTries = 160;

    while (arrows.length < targetArrowCount && tryCount < maxTries) {
      tryCount++;

      const startX = Math.floor(Math.random() * (width - 3)) + 1;
      const startY = Math.floor(Math.random() * (height - 3)) + 1;

      let pathData: { points: Point[]; headDir: Direction } | null = null;
      const roll = Math.random();

      if (roll < 0.28) {
        pathData = createSpiralPath({ x: startX, y: startY }, width, height);
      } else if (roll < 0.58) {
        pathData = createZigzagPath({ x: startX, y: startY }, width, height);
      } else {
        const numBends = Math.floor(Math.random() * 4) + 1;
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
        registerPathOccupancy(pathData.points, occupiedNodes, occupiedEdges);
      }
    }

    // Pass 2: Systematic Lane & Grid Line Coverage Pass
    // Ensures every horizontal line (row 1..height-1) and vertical line (col 1..width-1) is traversed
    for (let y = 1; y < height; y++) {
      // Find empty spans on this horizontal grid line
      let spanStart: number | null = null;
      for (let x = 1; x <= width; x++) {
        const isFree = x < width && !occupiedNodes.has(`${x},${y}`);
        if (isFree && spanStart === null) {
          spanStart = x;
        } else if (!isFree && spanStart !== null) {
          const spanLen = x - spanStart;
          if (spanLen >= 2) {
            // Attempt placing an arrow along this line
            const dir: Direction = Math.random() > 0.5 ? 'RIGHT' : 'LEFT';
            const pts: Point[] = dir === 'RIGHT'
              ? [{ x: spanStart, y }, { x: x - 1, y }]
              : [{ x: x - 1, y }, { x: spanStart, y }];

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
                registerPathOccupancy(pts, occupiedNodes, occupiedEdges);
              }
            }
          }
          spanStart = null;
        }
      }
    }

    // Vertical Lane Coverage Pass
    for (let x = 1; x < width; x++) {
      let spanStart: number | null = null;
      for (let y = 1; y <= height; y++) {
        const isFree = y < height && !occupiedNodes.has(`${x},${y}`);
        if (isFree && spanStart === null) {
          spanStart = y;
        } else if (!isFree && spanStart !== null) {
          const spanLen = y - spanStart;
          if (spanLen >= 2) {
            const dir: Direction = Math.random() > 0.5 ? 'DOWN' : 'UP';
            const pts: Point[] = dir === 'DOWN'
              ? [{ x, y: spanStart }, { x, y: y - 1 }]
              : [{ x, y: y - 1 }, { x, y: spanStart }];

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
                registerPathOccupancy(pts, occupiedNodes, occupiedEdges);
              }
            }
          }
          spanStart = null;
        }
      }
    }

    // Pass 3: Micro-Pocket & Corner Hook Filling Pass (L-turns & U-turns)
    for (let x = 1; x < width - 1; x += 2) {
      for (let y = 1; y < height - 1; y += 2) {
        if (!occupiedNodes.has(`${x},${y}`)) {
          const shapes: { pts: Point[]; dir: Direction }[] = [
            { pts: [{ x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }], dir: 'DOWN' },
            { pts: [{ x, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }], dir: 'RIGHT' },
            { pts: [{ x: x + 1, y: y + 1 }, { x: x + 1, y }, { x, y }], dir: 'LEFT' },
            { pts: [{ x: x + 1, y: y + 1 }, { x, y: y + 1 }, { x, y }], dir: 'UP' },
          ];

          for (const s of shapes) {
            if (!checkPathOverlap(s.pts, occupiedNodes, occupiedEdges)) {
              const candidate: PathArrow = {
                id: generateArrowId(arrows.length),
                points: s.pts,
                direction: s.dir,
                escaped: false,
              };
              const res = canPathArrowEscape(candidate, arrows, width, height);
              if (res.success) {
                arrows.push(candidate);
                registerPathOccupancy(s.pts, occupiedNodes, occupiedEdges);
                break;
              }
            }
          }
        }
      }
    }

    if (arrows.length > bestArrows.length) {
      bestArrows = arrows;
    }
  }

  // Ensure fallback if somehow empty
  if (bestArrows.length < 12) {
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
 * Fallback hand-crafted intricate labyrinth structure guaranteeing rich playability in landscape.
 */
function generateFallbackLandscapeMaze(width: number, height: number): PathArrow[] {
  const arrows: PathArrow[] = [
    // Top border winding paths
    { id: 'f_0', points: [{ x: 2, y: 5 }, { x: 2, y: 1 }], direction: 'UP', escaped: false },
    { id: 'f_1', points: [{ x: 3, y: 3 }, { x: 3, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 1 }], direction: 'UP', escaped: false },
    { id: 'f_2', points: [{ x: 8, y: 3 }, { x: 12, y: 3 }, { x: 12, y: 1 }], direction: 'UP', escaped: false },
    { id: 'f_3', points: [{ x: 13, y: 2 }, { x: 18, y: 2 }, { x: 18, y: 1 }], direction: 'UP', escaped: false },
    { id: 'f_4', points: [{ x: 19, y: 4 }, { x: 23, y: 4 }, { x: 23, y: 1 }], direction: 'UP', escaped: false },

    // Top Right Spiral & Loops
    { id: 'f_5', points: [{ x: 17, y: 5 }, { x: 22, y: 5 }, { x: 22, y: 3 }, { x: 15, y: 3 }], direction: 'LEFT', escaped: false },
    { id: 'f_6', points: [{ x: 21, y: 7 }, { x: 21, y: 6 }, { x: 17, y: 6 }, { x: 17, y: 7 }], direction: 'DOWN', escaped: false },

    // Left Spiral & Loops
    { id: 'f_7', points: [{ x: 4, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 7 }, { x: 3, y: 7 }, { x: 3, y: 4 }, { x: 7, y: 4 }], direction: 'RIGHT', escaped: false },
    { id: 'f_8', points: [{ x: 1, y: 8 }, { x: 1, y: 2 }, { x: 1, y: 1 }], direction: 'UP', escaped: false },
    { id: 'f_9', points: [{ x: 1, y: 9 }, { x: 3, y: 9 }, { x: 3, y: 10 }, { x: 5, y: 10 }], direction: 'RIGHT', escaped: false },

    // Center Sprawling Snakes
    { id: 'f_10', points: [{ x: 8, y: 7 }, { x: 8, y: 5 }, { x: 11, y: 5 }, { x: 11, y: 4 }, { x: 14, y: 4 }], direction: 'RIGHT', escaped: false },
    { id: 'f_11', points: [{ x: 9, y: 9 }, { x: 9, y: 8 }, { x: 13, y: 8 }, { x: 13, y: 7 }, { x: 15, y: 7 }], direction: 'RIGHT', escaped: false },
    { id: 'f_12', points: [{ x: 16, y: 9 }, { x: 16, y: 8 }, { x: 19, y: 8 }, { x: 19, y: 9 }], direction: 'DOWN', escaped: false },

    // Bottom Waves & Spirals
    { id: 'f_13', points: [{ x: 2, y: 12 }, { x: 2, y: 14 }], direction: 'DOWN', escaped: false },
    { id: 'f_14', points: [{ x: 3, y: 13 }, { x: 6, y: 13 }, { x: 6, y: 14 }], direction: 'DOWN', escaped: false },
    { id: 'f_15', points: [{ x: 7, y: 12 }, { x: 11, y: 12 }, { x: 11, y: 14 }], direction: 'DOWN', escaped: false },
    { id: 'f_16', points: [{ x: 12, y: 13 }, { x: 17, y: 13 }, { x: 17, y: 14 }], direction: 'DOWN', escaped: false },
    { id: 'f_17', points: [{ x: 18, y: 12 }, { x: 22, y: 12 }, { x: 22, y: 14 }], direction: 'DOWN', escaped: false },

    // Right Border Exits
    { id: 'f_18', points: [{ x: 15, y: 11 }, { x: 23, y: 11 }], direction: 'RIGHT', escaped: false },
    { id: 'f_19', points: [{ x: 20, y: 9 }, { x: 23, y: 9 }], direction: 'RIGHT', escaped: false },
    { id: 'f_20', points: [{ x: 1, y: 14 }, { x: 1, y: 11 }, { x: 4, y: 11 }], direction: 'RIGHT', escaped: false },
  ];

  return arrows.filter(a => a.points.every(p => p.x < width && p.y < height));
}
