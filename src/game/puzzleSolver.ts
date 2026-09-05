import { PathArrow, Direction, EscapeResult, Point } from './arrowTypes';

export function getDirectionDelta(direction: Direction): { dx: number; dy: number } {
  switch (direction) {
    case 'UP':
      return { dx: 0, dy: -1 };
    case 'DOWN':
      return { dx: 0, dy: 1 };
    case 'LEFT':
      return { dx: -1, dy: 0 };
    case 'RIGHT':
      return { dx: 1, dy: 0 };
  }
}

/**
 * Expands a polyline into all integer grid points it occupies.
 */
export function getArrowOccupiedPoints(arrow: PathArrow): Point[] {
  const points = arrow.points;
  if (points.length === 0) return [];

  const occupied: Point[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const dx = Math.sign(p2.x - p1.x);
    const dy = Math.sign(p2.y - p1.y);

    let curX = p1.x;
    let curY = p1.y;

    const key1 = `${curX},${curY}`;
    if (!visited.has(key1)) {
      visited.add(key1);
      occupied.push({ x: curX, y: curY });
    }

    while (curX !== p2.x || curY !== p2.y) {
      curX += dx;
      curY += dy;
      const key = `${curX},${curY}`;
      if (!visited.has(key)) {
        visited.add(key);
        occupied.push({ x: curX, y: curY });
      }
    }
  }

  return occupied;
}

/**
 * Builds a fast spatial map: `x,y` -> arrowId
 */
export function buildSpatialOccupancy(
  arrows: PathArrow[],
  ignoredArrowId?: string
): Map<string, string> {
  const map = new Map<string, string>();

  for (const arrow of arrows) {
    if (arrow.escaped || arrow.id === ignoredArrowId) continue;
    const occupied = getArrowOccupiedPoints(arrow);
    for (const pt of occupied) {
      map.set(`${pt.x},${pt.y}`, arrow.id);
    }
  }

  return map;
}

/**
 * Checks if a path arrow can escape in its arrowhead direction.
 * Only the pointing arrow (arrowhead) determines the direction of movement and obstruction check:
 * Traces a ray starting directly from the pointing arrowhead towards the board boundary.
 * If any unescaped arrow obstructs the arrowhead's forward path, escape is blocked.
 */
export function canPathArrowEscape(
  arrow: PathArrow,
  arrows: PathArrow[],
  gridWidth: number,
  gridHeight: number
): EscapeResult {
  if (arrow.escaped) {
    return { success: false, arrowId: arrow.id };
  }

  const occupancy = buildSpatialOccupancy(arrows, arrow.id);
  const { dx, dy } = getDirectionDelta(arrow.direction);
  const headPoint = arrow.points[arrow.points.length - 1];

  if (!headPoint) {
    return { success: false, arrowId: arrow.id };
  }

  // Trace ray strictly forward from the pointing arrow tip
  let curX = headPoint.x + dx;
  let curY = headPoint.y + dy;

  while (curX >= 0 && curX <= gridWidth && curY >= 0 && curY <= gridHeight) {
    const blockerId = occupancy.get(`${curX},${curY}`);
    if (blockerId && blockerId !== arrow.id) {
      return {
        success: false,
        arrowId: arrow.id,
        blockerId,
      };
    }
    curX += dx;
    curY += dy;
  }

  return { success: true, arrowId: arrow.id };
}

/**
 * Fast check if an arrow can escape against a given occupancy map.
 */
function canArrowEscapeWithMap(
  arrow: PathArrow,
  occupancy: Map<string, string>,
  gridWidth: number,
  gridHeight: number
): boolean {
  const { dx, dy } = getDirectionDelta(arrow.direction);
  const headPoint = arrow.points[arrow.points.length - 1];
  if (!headPoint) return false;

  let curX = headPoint.x + dx;
  let curY = headPoint.y + dy;

  while (curX >= 0 && curX <= gridWidth && curY >= 0 && curY <= gridHeight) {
    const blockerId = occupancy.get(`${curX},${curY}`);
    if (blockerId && blockerId !== arrow.id) {
      return false;
    }
    curX += dx;
    curY += dy;
  }
  return true;
}

/**
 * Gets all arrows currently eligible to escape.
 */
export function getAvailablePathEscapes(
  arrows: PathArrow[],
  gridWidth: number,
  gridHeight: number
): PathArrow[] {
  const available: PathArrow[] = [];
  const occupancy = buildSpatialOccupancy(arrows);
  for (const arrow of arrows) {
    if (!arrow.escaped) {
      if (canArrowEscapeWithMap(arrow, occupancy, gridWidth, gridHeight)) {
        available.push(arrow);
      }
    }
  }
  return available;
}

export interface SolveResult {
  isSolvable: boolean;
  solutionOrder: string[];
  totalSteps: number;
}

/**
 * Simulates solving the puzzle step by step to verify 100% solvability in sub-millisecond time.
 */
export function solvePathPuzzle(
  arrows: PathArrow[],
  gridWidth: number,
  gridHeight: number
): SolveResult {
  const simArrows: PathArrow[] = arrows.map(a => ({ ...a, escaped: false }));
  const total = simArrows.length;
  const solutionOrder: string[] = [];

  // Pre-calculate occupied points for each arrow
  const arrowPointsMap = new Map<string, Point[]>();
  const occupancy = new Map<string, string>();

  for (const arrow of simArrows) {
    const pts = getArrowOccupiedPoints(arrow);
    arrowPointsMap.set(arrow.id, pts);
    for (const pt of pts) {
      occupancy.set(`${pt.x},${pt.y}`, arrow.id);
    }
  }

  const unescapedSet = new Set<PathArrow>(simArrows);

  while (solutionOrder.length < total) {
    let nextEscapable: PathArrow | null = null;

    for (const arrow of unescapedSet) {
      if (canArrowEscapeWithMap(arrow, occupancy, gridWidth, gridHeight)) {
        nextEscapable = arrow;
        break;
      }
    }

    if (!nextEscapable) {
      return {
        isSolvable: false,
        solutionOrder: [],
        totalSteps: solutionOrder.length,
      };
    }

    // Mark escaped and remove from occupancy map
    nextEscapable.escaped = true;
    unescapedSet.delete(nextEscapable);
    solutionOrder.push(nextEscapable.id);

    const pts = arrowPointsMap.get(nextEscapable.id) || [];
    for (const pt of pts) {
      occupancy.delete(`${pt.x},${pt.y}`);
    }
  }

  return {
    isSolvable: true,
    solutionOrder,
    totalSteps: solutionOrder.length,
  };
}
