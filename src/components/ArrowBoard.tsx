import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { PathArrow, Direction, Point } from '../game/arrowTypes';
import { canPathArrowEscape, getAvailablePathEscapes, getDirectionDelta } from '../game/puzzleSolver';
import { sound } from '../game/audioEngine';
import { Lightbulb, RotateCcw, Grid3X3 } from 'lucide-react';

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
    setEscapingArrowIds(prevMap => new Map(prevMap).set(arrowId, arrowToEscape.direction));

    setTimeout(() => {
      setBoardArrows(prevArrows => {
        const updated = prevArrows.map(a => (a.id === arrowId ? { ...a, escaped: true } : a));
        const remaining = updated.filter(a => !a.escaped).length;

        if (remaining === 0 && !isClearingRef.current) {
          isClearingRef.current = true;
          sound.playRoundComplete();
          try {
            confetti({
              particleCount: 90,
              spread: 80,
              origin: { y: 0.6 },
              colors: ['#000000', '#00f2fe', '#4facfe', '#10b981', '#f59e0b'],
            });
          } catch {
            // Ignore
          }
        }
        return updated;
      });

      setEscapingArrowIds(prevMap => {
        const nextMap = new Map(prevMap);
        nextMap.delete(arrowId);
        return nextMap;
      });
    }, 820);
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
          const escapedCount = boardArrows.filter(a => a.escaped).length;
          sound.playArrowEscape(escapedCount);

          // Mark escaping animation direction
          setEscapingArrowIds(prevMap => new Map(prevMap).set(arrow.id, arrow.direction));

          setTimeout(() => {
            setBoardArrows(prevArrows => {
              const updated = prevArrows.map(a =>
                a.id === arrow.id ? { ...a, escaped: true } : a
              );
              const remaining = updated.filter(a => !a.escaped).length;

              onArrowEscaped(arrow.id, remaining, nextMoves);

              // Check if all cleared
              if (remaining === 0 && !isClearingRef.current) {
                isClearingRef.current = true;
                sound.playRoundComplete();

                try {
                  confetti({
                    particleCount: 90,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#000000', '#00f2fe', '#4facfe', '#10b981', '#f59e0b'],
                  });
                } catch {
                  // Ignore
                }

                const elapsed = roundStartTime ? Math.max(0.1, (Date.now() - roundStartTime) / 1000) : 0;
                onPuzzleCleared(nextMoves, Number(elapsed.toFixed(2)));
              }

              return updated;
            });

            setEscapingArrowIds(prevMap => {
              const nextMap = new Map(prevMap);
              nextMap.delete(arrow.id);
              return nextMap;
            });
          }, 820);
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
          }, 450);
        }

        return nextMoves;
      });
    },
    [disabled, escapingArrowIds, boardArrows, gridWidth, gridHeight, onArrowEscaped, onPuzzleCleared, roundStartTime]
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
  const renderArrowHead = (headPoint: Point, direction: Direction, isBlocked: boolean, isHint: boolean, isBlocker: boolean) => {
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

    const fill = isBlocked ? '#f43f5e' : isBlocker ? '#f59e0b' : isHint ? '#00f2fe' : '#111827';

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
    const exitPoint: Point = {
      x: head.x + dx * exitLen,
      y: head.y + dy * exitLen,
    };

    let d = `M ${toSvgX(points[0].x)} ${toSvgY(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${toSvgX(points[i].x)} ${toSvgY(points[i].y)}`;
    }
    d += ` L ${toSvgX(exitPoint.x)} ${toSvgY(exitPoint.y)}`;

    return { pathData: d, headEnd: exitPoint };
  };

  return (
    <div className="flex flex-col items-center justify-center select-none w-full max-w-4xl mx-auto px-2">
      {/* Inline styles for slithering along grid animation */}
      <style>{`
        @keyframes slitherAlongGrid {
          0% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          75% {
            opacity: 0.9;
          }
          100% {
            stroke-dashoffset: -1200;
            opacity: 0;
          }
        }
        @keyframes arrowHeadSlide {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .slithering-arrow {
          stroke-dasharray: 600 1800;
          animation: slitherAlongGrid 0.82s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
        }
      `}</style>

      {/* Maze Canvas Card (White Clean Minimalist Style from Reference Image) */}
      <div className="relative bg-white rounded-3xl p-3 sm:p-5 shadow-2xl border-4 border-slate-200/80 w-full max-w-[min(96vw,880px)] flex flex-col items-center justify-center overflow-hidden">
        {/* SVG Maze Render Area */}
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-[66vh] touch-none select-none cursor-pointer filter drop-shadow-sm"
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
                  stroke="#e2e8f0"
                  strokeWidth="1.2"
                  strokeOpacity="0.85"
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
                  stroke="#e2e8f0"
                  strokeWidth="1.2"
                  strokeOpacity="0.85"
                />
              ))}
            </g>
          )}

          {/* Polyline Path Arrows */}
          {boardArrows.map(arrow => {
            if (arrow.escaped) return null;

            const isEscaping = escapingArrowIds.has(arrow.id);
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
              ? '#00f2fe'
              : isEscaping
              ? '#00f2fe'
              : '#111827';

            return (
              <g
                key={arrow.id}
                onClick={() => attemptEscape(arrow)}
                className={`group ${isBlocked ? 'animate-shake' : ''}`}
                style={{
                  filter: isEscaping ? 'drop-shadow(0 0 8px rgba(0,242,254,0.9))' : undefined,
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
                        ? 'transform 0.82s cubic-bezier(0.2, 0.7, 0.3, 1), opacity 0.82s ease-in'
                        : 'none',
                      opacity: isEscaping ? 0.3 : 1,
                    }}
                  >
                    {renderArrowHead(headPoint, arrow.direction, isBlocked, isHint, isBlocker || isEscaping)}
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* In-Game Bottom Utilities matching screenshot (Hint, Grid, and Reset) */}
        <div className="flex items-center justify-between w-full mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={handleHint}
              disabled={disabled || remainingCount === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              title="Get Hint"
            >
              <Lightbulb className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>HINT</span>
            </button>

            {/* Grid Toggle Button next to Hint */}
            <button
              onClick={handleToggleGrid}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer ${
                showGrid
                  ? 'bg-blue-50 border-blue-300 text-blue-600'
                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600'
              }`}
              title={showGrid ? 'Hide Grid' : 'Show Grid'}
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="hidden sm:inline">GRID</span>
            </button>
          </div>

          <button
            onClick={handleResetBoard}
            disabled={disabled}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
            title="Reset Board"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
