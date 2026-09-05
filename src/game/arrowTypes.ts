export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface Point {
  x: number;
  y: number;
}

export interface PathArrow {
  id: string;
  points: Point[]; // Sequence of orthogonal polyline vertices [p0, p1, ..., pHead]
  direction: Direction; // Facing direction of the arrowhead at points[points.length - 1]
  escaped: boolean;
  color?: string;
}

export interface Puzzle {
  id: string;
  level: number;
  gridWidth: number; // e.g. 12 - 16
  gridHeight: number; // e.g. 16 - 22
  arrows: PathArrow[];
  difficulty: number; // 1 - 100
  solution: string[]; // Ordered list of arrow IDs
  createdAt: number;
}

export interface EscapeResult {
  success: boolean;
  arrowId: string;
  blockerId?: string;
}

export interface PlayerScoreBreakdown {
  baseScore: number;
  speedBonus: number;
  moveBonus: number;
  totalRoundScore: number;
}
