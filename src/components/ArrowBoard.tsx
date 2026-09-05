import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { PathArrow, Direction, Point } from '../game/arrowTypes';
import { canPathArrowEscape, getAvailablePathEscapes, getDirectionDelta } from '../game/puzzleSolver';
import { sound } from '../game/audioEngine';
import { Lightbulb, RotateCcw } from 'lucide-react';

interface ArrowBoardProps {
  gridWidth: number;
  gridHeight: number;
  arrows: PathArrow[];
  onArrowEscaped: (arrowId: string, remainingCount: number, moveCount: number) => void;
  onPuzzleCleared: (moveCount: number, completionTimeSeconds: number) => void;
  onBlockedMove?: () => void;
  roundStartTime: number | null;
  disabled?: boolean;
  remoteEscapeEvent?: { arrowId: string; playerName?: string } | null;
}

export const ArrowBoard: React.FC<ArrowBoardProps> = ({
  gridWidth,
  gridHeight,
  arrows: initialArrows,
  onArrowEscaped,
  onPuzzleCleared,
  onBlockedMove,
  roundStartTime,
  disabled = false,
  remoteEscapeEvent = null,
}) => {
  const [boardArrows, setBoardArrows] = useState<PathArrow[]>(initialArrows);
  const [blockedArrowId, setBlockedArrowId] = useState<string | null>(null);
  const [highlightBlockerId, setHighlightBlockerId] = useState<string | null>(null);
  const [hintArrowId, setHintArrowId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [escapingArrowIds, setEscapingArrowIds] = useState<Map<string, Direction>>(new Map());
  const [, setMoveCount] = useState<number>(0);

  const isClearingRef = useRef<boolean>(false);

  // Handle remote arrow escape from other player in real-time
  useEffect(() => {
    if (!remoteEscapeEvent) return;
    const { arrowId } = remoteEscapeEvent;

    const arrowToEscape = boardArrows.find(a => a.id === arrowId && !a.escaped);
    if (!arrowToEscape || escapingArrowIds.has(arrowId)) return;

    sound.playArrowEscape(boardArrows.filter(a => a.escaped).length);
    
    // Mark as logically escaped immediately so subsequent moves are not blocked
    setBoardArrows(prevArrows =>
      prevArrows.map(a => (a.id === arrowId ? { ...a, escaped: true } : a))
    );
    setEscapingArrowIds(prevMap => new Map(prevMap).set(arrowId, arrowToEscape.direction));

    setTimeout(() => {
      setEscapingArrowIds(prevMap => {
        const nextMap = new Map(prevMap);
        nextMap.delete(arrowId);
        return nextMap;
      });

      // Check remaining
      const remaining = boardArrows.filter(a => a.id !== arrowId && !a.escaped).length;
      if (remaining === 0 && !isClearingRef.current) {
        isClearingRef.current = true;
        sound.playRoundComplete();
        try {
          confetti({
            particleCount: 90,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#000000', '#a855f7', '#c084fc', '#ffffff', '#71717a'],
          });
        } catch {
          // Ignore
        }
      }
    }, 260);
  }, [remoteEscapeEvent, boardArrows, escapingArrowIds]);

  // Sync board arrows when new puzzle arrives
  useEffect(() => {
    setBoardArrows(initialArrows.map(a => ({ ...a, escaped: false })));
    setEscapingArrowIds(new Map());
    setMoveCount(0);
    setBlockedArrowId(null);
    setHighlightBlockerId(null);
    setHintArrowId(null);
    isClearingRef.current = false;
  }, [initialArrows]);

  // Handle arrow click / escape attempt
  const attemptEscape = useCallback(
    (arrow: PathArrow) => {
      if (disabled || arrow.escaped || escapingArrowIds.has(arrow.id) || isClearingRef.current) {
        return;
      }

      setHintArrowId(null);

      setMoveCount(prev => {
        const nextMoves = prev + 1;
        const result = canPathArrowEscape(arrow, boardArrows, gridWidth, gridHeight);

        if (result.success) {
          // Success!
          const currentEscapedCount = boardArrows.filter(a => a.escaped).length;
          sound.playArrowEscape(currentEscapedCount);

          // Mark as escaped immediately in state so subsequent clicks never get blocked
          setBoardArrows(prevArrows =>
            prevArrows.map(a => (a.id === arrow.id ? { ...a, escaped: true } : a))
          );
          setEscapingArrowIds(prevMap => new Map(prevMap).set(arrow.id, arrow.direction));

          const remaining = boardArrows.filter(a => a.id !== arrow.id && !a.escaped).length;
          onArrowEscaped(arrow.id, remaining, nextMoves);

          setTimeout(() => {
            setEscapingArrowIds(prevMap => {
              const nextMap = new Map(prevMap);
              nextMap.delete(arrow.id);
              return nextMap;
            });

            // Check if all cleared
            if (remaining === 0 && !isClearingRef.current) {
              isClearingRef.current = true;
              sound.playRoundComplete();

              try {
                confetti({
                  particleCount: 90,
                  spread: 80,
                  origin: { y: 0.6 },
                  colors: ['#000000', '#a855f7', '#c084fc', '#ffffff', '#71717a'],
                });
              } catch {
                // Ignore
              }

              const elapsed = roundStartTime ? Math.max(0.1, (Date.now() - roundStartTime) / 1000) : 0;
              onPuzzleCleared(nextMoves, Number(elapsed.toFixed(2)));
            }
          }, 260);
        } else {
          // Blocked!
          sound.playInvalidMove();
          onBlockedMove?.();
          setBlockedArrowId(arrow.id);
          if (result.blockerId) {
            setHighlightBlockerId(result.blockerId);
          }

          setTimeout(() => {
            setBlockedArrowId(null);
            setHighlightBlockerId(null);
          }, 220);
        }

        return nextMoves;
      });
    },
    [disabled, escapingArrowIds, boardArrows, gridWidth, gridHeight, onArrowEscaped, onPuzzleCleared, onBlockedMove, roundStartTime]
  );

  // Trigger Hint: highlights an arrow that is currently free to escape
  const handleHint = () => {
    if (disabled) return;
    const available = getAvailablePathEscapes(boardArrows, gridWidth, gridHeight);
    if (available.length > 0) {
      sound.playCountdownTick(false);
      setHintArrowId(available[0].id);
      setTimeout(() => setHintArrowId(null), 3000);
    }
  };

  // Toggle Grid
  const handleToggleGrid = () => {
    sound.playArrowSwipe();
    setShowGrid(prev => !prev);
  };

  // Reset current board
  const handleResetBoard = () => {
    if (disabled) return;
    sound.playArrowSwipe();
    setBoardArrows(initialArrows.map(a => ({ ...a, escaped: false })));
    setEscapingArrowIds(new Map());
    setHintArrowId(null);
  };

  // Logical to SVG units
  const PADDING = 24;
  const CELL_SIZE = 26;
  const svgWidth = gridWidth * CELL_SIZE + PADDING * 2;
  const svgHeight = gridHeight * CELL_SIZE + PADDING * 2;

  const toSvgX = (x: number) => PADDING + x * CELL_SIZE;
  const toSvgY = (y: number) => PADDING + y * CELL_SIZE;

  // Build SVG path string from points
  const makePathData = (points: Point[]) => {
    if (points.length === 0) return '';
    let d = `M ${toSvgX(points[0].x)} ${toSvgY(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${toSvgX(points[i].x)} ${toSvgY(points[i].y)}`;
    }
    return d;
  };

  // Render arrowhead polygon at head point (sleek refined proportion)
  const renderArrowHead = (
    headPoint: Point,
    direction: Direction,
    isBlocked: boolean,
    isHint: boolean,
    isBlocker: boolean,
    isEscaping: boolean
  ) => {
    const x = toSvgX(headPoint.x);
    const y = toSvgY(headPoint.y);
    const headSize = 10;

    let pointsStr = '';
    switch (direction) {
      case 'UP':
        pointsStr = `${x},${y - headSize} ${x - headSize * 0.75},${y + headSize * 0.45} ${x + headSize * 0.75},${y + headSize * 0.45}`;
        break;
      case 'DOWN':
        pointsStr = `${x},${y + headSize} ${x - headSize * 0.75},${y - headSize * 0.45} ${x + headSize * 0.75},${y - headSize * 0.45}`;
        break;
      case 'LEFT':
        pointsStr = `${x - headSize},${y} ${x + headSize * 0.45},${y - headSize * 0.75} ${x + headSize * 0.45},${y + headSize * 0.75}`;
        break;
      case 'RIGHT':
        pointsStr = `${x + headSize},${y} ${x - headSize * 0.45},${y - headSize * 0.75} ${x - headSize * 0.45},${y + headSize * 0.75}`;
        break;
    }

    const fill = isBlocked ? '#f43f5e' : isBlocker ? '#f59e0b' : isHint ? '#c084fc' : isEscaping ? '#a855f7' : '#09090b';

    return <polygon points={pointsStr} fill={fill} className="transition-colors duration-150" />;
  };

  const remainingCount = boardArrows.filter(a => !a.escaped).length;

  // Helper to compute extended path that continues along grid in exit direction
  const makeExtendedPathData = (points: Point[], direction: Direction) => {
    if (points.length === 0) return { pathData: '', headEnd: points[0] || { x: 0, y: 0 } };
    const head = points[points.length - 1];
    const { dx, dy } = getDirectionDelta(direction);
    
    // Extend far out of the board along the grid
    const exitLen = Math.max(gridWidth, gridHeight) + 4;
    const endX = head.x + dx * exitLen;
    const endY = head.y + dy * exitLen;

    let d = `M ${toSvgX(points[0].x)} ${toSvgY(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${toSvgX(points[i].x)} ${toSvgY(points[i].y)}`;
    }
    // Add forward exit line
    d += ` L ${toSvgX(endX)} ${toSvgY(endY)}`;

    return { pathData: d, headEnd: { x: endX, y: endY } };
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full max-h-full select-none overflow-hidden">
      {/* Inline styles for custom animations */}
      <style>{`
        @keyframes slitherAlongGrid {
          0% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          60% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -1200;
            opacity: 0;
          }
        }
        .slithering-arrow {
          stroke-dasharray: 600 1800;
          animation: slitherAlongGrid 0.26s cubic-bezier(0.15, 0.85, 0.35, 1) forwards;
        }
      `}</style>

      {/* Maze Canvas Card (White Clean Minimalist Style) */}
      <div className="relative bg-white rounded-3xl p-2 sm:p-3.5 shadow-xl border-2 border-zinc-200 w-full max-w-[min(98vw,880px)] max-h-[calc(100vh-130px)] flex flex-col items-center justify-between overflow-hidden">
        {/* SVG Maze Render Area */}
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="flex-1 min-h-0 w-full h-auto max-h-[calc(100vh-200px)] touch-none select-none cursor-pointer filter drop-shadow-sm"
          style={{ shapeRendering: 'geometricPrecision' }}
        >
          {/* Background Grid Lines when showGrid is enabled */}
          {showGrid && (
            <g className="transition-opacity duration-300 pointer-events-none">
              {/* Vertical Grid Lines */}
              {Array.from({ length: gridWidth + 1 }).map((_, col) => (
                <line
                  key={`v-${col}`}
                  x1={toSvgX(col)}
                  y1={PADDING * 0.5}
                  x2={toSvgX(col)}
                  y2={svgHeight - PADDING * 0.5}
                  stroke="#e4e4e7"
                  strokeWidth="1.2"
                  strokeOpacity="0.9"
                />
              ))}
              {/* Horizontal Grid Lines */}
              {Array.from({ length: gridHeight + 1 }).map((_, row) => (
                <line
                  key={`h-${row}`}
                  x1={PADDING * 0.5}
                  y1={toSvgY(row)}
                  x2={svgWidth - PADDING * 0.5}
                  y2={toSvgY(row)}
                  stroke="#e4e4e7"
                  strokeWidth="1.2"
                  strokeOpacity="0.9"
                />
              ))}
            </g>
          )}

          {/* Escaped Arrows Dotted Footprint / Trail */}
          {boardArrows.filter(a => a.escaped).map(arrow => {
            const dottedPath = makePathData(arrow.points);
            return (
              <g key={`dotted-${arrow.id}`} className="pointer-events-none transition-opacity duration-300">
                {/* Dotted path trail */}
                <path
                  d={dottedPath}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth={2.4}
                  strokeDasharray="3 5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.4}
                />
                {/* Dotted circle at each waypoint along the cleared arrow */}
                {arrow.points.map((pt, pIdx) => (
                  <circle
                    key={`dot-${arrow.id}-${pIdx}`}
                    cx={toSvgX(pt.x)}
                    cy={toSvgY(pt.y)}
                    r={2.2}
                    fill="#a855f7"
                    fillOpacity={0.5}
                  />
                ))}
              </g>
            );
          })}

          {/* Polyline Path Arrows */}
          {boardArrows.map(arrow => {
            const isEscaping = escapingArrowIds.has(arrow.id);
            if (arrow.escaped && !isEscaping) return null;

            const escapeDir = escapingArrowIds.get(arrow.id);
            const isBlocked = blockedArrowId === arrow.id;
            const isBlocker = highlightBlockerId === arrow.id;
            const isHint = hintArrowId === arrow.id;

            const headPoint = arrow.points[arrow.points.length - 1];
            
            // If escaping, use extended path along grid line
            const pathData = isEscaping
              ? makeExtendedPathData(arrow.points, arrow.direction).pathData
              : makePathData(arrow.points);

            // Calculate arrowhead exit translation vector along grid
            let headTransform = '';
            if (isEscaping && escapeDir) {
              const { dx, dy } = getDirectionDelta(escapeDir);
              const travelDist = (Math.max(gridWidth, gridHeight) + 4) * CELL_SIZE;
              headTransform = `translate(${dx * travelDist}px, ${dy * travelDist}px)`;
            }

            const strokeColor = isBlocked
              ? '#f43f5e'
              : isBlocker
              ? '#f59e0b'
              : isHint
              ? '#c084fc'
              : isEscaping
              ? '#a855f7'
              : '#09090b';

            return (
              <g
                key={arrow.id}
                onClick={() => attemptEscape(arrow)}
                className={`group ${isBlocked ? 'animate-shake' : ''}`}
                style={{
                  filter: isEscaping ? 'drop-shadow(0 0 8px rgba(168,85,247,0.9))' : undefined,
                }}
              >
                {/* Invisible wide hit area for easy tapping on mobile */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={20}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="cursor-pointer"
                />

                {/* Visible sleek arrow body line slithering along grid path */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isEscaping ? 4.2 : 3.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-colors duration-150 cursor-pointer ${
                    isEscaping ? 'slithering-arrow' : ''
                  }`}
                />

                {/* Arrowhead tip leading the motion along grid */}
                {headPoint && (
                  <g
                    style={{
                      transform: headTransform,
                      transition: isEscaping
                        ? 'transform 0.26s cubic-bezier(0.15, 0.85, 0.35, 1), opacity 0.26s ease-in'
                        : 'none',
                      opacity: isEscaping ? 0.3 : 1,
                    }}
                  >
                    {renderArrowHead(headPoint, arrow.direction, isBlocked, isHint, isBlocker, isEscaping)}
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* In-Game Bottom Utilities */}
        <div className="flex items-center justify-between w-full mt-2 pt-2 border-t border-zinc-100 shrink-0">
          <div className="flex items-center gap-2">
            {/* Reset Button */}
            <button
              onClick={handleResetBoard}
              disabled={disabled}
              className="p-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              title="Reset Board"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Hint Button styled in black & purple */}
            <button
              onClick={handleHint}
              disabled={disabled || remainingCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-zinc-900 hover:bg-black text-white font-semibold text-xs border border-purple-500/40 shadow-md shadow-purple-950/30 transition-all active:scale-95 disabled:opacity-40 cursor-pointer group"
              title="Get Hint"
            >
              <Lightbulb className="w-3.5 h-3.5 text-purple-400 fill-purple-400 group-hover:rotate-12 transition-transform" />
              <span className="tracking-wide">Hint</span>
            </button>
          </div>

          {/* Grid Toggle Button */}
          <button
            onClick={handleToggleGrid}
            className={`flex items-center justify-center w-8 h-8 rounded-2xl border font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer ${
              showGrid
                ? 'bg-purple-50 border-purple-200 text-purple-700'
                : 'bg-zinc-100 border-zinc-200 text-zinc-400 hover:text-zinc-600'
            }`}
            title={showGrid ? 'Hide Grid' : 'Show Grid'}
          >
            <span className="text-sm font-bold font-mono">#</span>
          </button>
        </div>
      </div>
    </div>
  );
};
