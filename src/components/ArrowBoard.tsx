import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { PathArrow, Direction, Point } from '../game/arrowTypes';
import { canPathArrowEscape, getAvailablePathEscapes } from '../game/puzzleSolver';
import { sound } from '../game/audioEngine';
import { Lightbulb, RotateCcw } from 'lucide-react';

interface ArrowBoardProps {
  gridWidth: number;
  gridHeight: number;
  arrows: PathArrow[];
  onArrowEscaped: (arrowId: string, remainingCount: number, moveCount: number) => void;
  onPuzzleCleared: (moveCount: number, completionTimeSeconds: number) => void;
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
  roundStartTime,
  disabled = false,
  remoteEscapeEvent = null,
}) => {
  const [boardArrows, setBoardArrows] = useState<PathArrow[]>(initialArrows);
  const [blockedArrowId, setBlockedArrowId] = useState<string | null>(null);
  const [highlightBlockerId, setHighlightBlockerId] = useState<string | null>(null);
  const [hintArrowId, setHintArrowId] = useState<string | null>(null);
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
      setBoardArrows(prevArrows =>
        prevArrows.map(a => (a.id === arrowId ? { ...a, escaped: true } : a))
      );
      setEscapingArrowIds(prevMap => {
        const nextMap = new Map(prevMap);
        nextMap.delete(arrowId);
        return nextMap;
      });
    }, 300);
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
          }, 300);
        } else {
          // Blocked!
          sound.playInvalidMove();
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

  // Reset current board
  const handleResetBoard = () => {
    if (disabled) return;
    sound.playArrowSwipe();
    setBoardArrows(initialArrows.map(a => ({ ...a, escaped: false })));
    setEscapingArrowIds(new Map());
    setHintArrowId(null);
  };

  // Convert logical grid coordinates to SVG viewBox units
  // Logical: x in [0, gridWidth], y in [0, gridHeight]
  // SVG units: padding 40, cell size 28
  const PADDING = 30;
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

  // Render arrowhead polygon at head point
  const renderArrowHead = (headPoint: Point, direction: Direction, isBlocked: boolean, isHint: boolean, isBlocker: boolean) => {
    const x = toSvgX(headPoint.x);
    const y = toSvgY(headPoint.y);
    const headSize = 13;

    let pointsStr = '';
    switch (direction) {
      case 'UP':
        pointsStr = `${x},${y - headSize} ${x - headSize * 0.8},${y + headSize * 0.4} ${x + headSize * 0.8},${y + headSize * 0.4}`;
        break;
      case 'DOWN':
        pointsStr = `${x},${y + headSize} ${x - headSize * 0.8},${y - headSize * 0.4} ${x + headSize * 0.8},${y - headSize * 0.4}`;
        break;
      case 'LEFT':
        pointsStr = `${x - headSize},${y} ${x + headSize * 0.4},${y - headSize * 0.8} ${x + headSize * 0.4},${y + headSize * 0.8}`;
        break;
      case 'RIGHT':
        pointsStr = `${x + headSize},${y} ${x - headSize * 0.4},${y - headSize * 0.8} ${x - headSize * 0.4},${y + headSize * 0.8}`;
        break;
    }

    const fill = isBlocked ? '#f43f5e' : isBlocker ? '#f59e0b' : isHint ? '#00f2fe' : '#111827';

    return <polygon points={pointsStr} fill={fill} className="transition-colors duration-150" />;
  };

  const remainingCount = boardArrows.filter(a => !a.escaped).length;

  return (
    <div className="flex flex-col items-center justify-center select-none w-full max-w-lg mx-auto">
      {/* Maze Canvas Card (White Clean Minimalist Style from Reference Image) */}
      <div className="relative bg-white rounded-3xl p-4 sm:p-6 shadow-2xl border-4 border-slate-200/80 w-full max-w-[min(94vw,70vh,460px)] flex flex-col items-center justify-center overflow-hidden">
        {/* SVG Maze Render Area */}
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-[58vh] touch-none select-none cursor-pointer filter drop-shadow-sm"
          style={{ shapeRendering: 'geometricPrecision' }}
        >
          {boardArrows.map(arrow => {
            if (arrow.escaped) return null;

            const isEscaping = escapingArrowIds.has(arrow.id);
            const escapeDir = escapingArrowIds.get(arrow.id);
            const isBlocked = blockedArrowId === arrow.id;
            const isBlocker = highlightBlockerId === arrow.id;
            const isHint = hintArrowId === arrow.id;

            const headPoint = arrow.points[arrow.points.length - 1];
            const pathData = makePathData(arrow.points);

            // Escape translate style
            let transform = '';
            if (isEscaping && escapeDir) {
              if (escapeDir === 'UP') transform = 'translateY(-1200px)';
              if (escapeDir === 'DOWN') transform = 'translateY(1200px)';
              if (escapeDir === 'LEFT') transform = 'translateX(-1200px)';
              if (escapeDir === 'RIGHT') transform = 'translateX(1200px)';
            }

            const strokeColor = isBlocked
              ? '#f43f5e'
              : isBlocker
              ? '#f59e0b'
              : isHint
              ? '#00f2fe'
              : '#111827';

            return (
              <g
                key={arrow.id}
                onClick={() => attemptEscape(arrow)}
                className={`transition-all duration-300 group ${
                  isBlocked ? 'animate-shake' : ''
                }`}
                style={{
                  transform,
                  transition: isEscaping
                    ? 'transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity 0.3s ease-out'
                    : 'none',
                  opacity: isEscaping ? 0 : 1,
                }}
              >
                {/* Invisible wide hit area for easy tapping on mobile */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={24}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="cursor-pointer"
                />

                {/* Visible thick arrow body line */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-colors duration-150 cursor-pointer"
                />

                {/* Arrowhead tip at end */}
                {headPoint && renderArrowHead(headPoint, arrow.direction, isBlocked, isHint, isBlocker)}
              </g>
            );
          })}
        </svg>

        {/* In-Game Bottom Utilities matching screenshot (Hint & Reset) */}
        <div className="flex items-center justify-between w-full mt-4 pt-3 border-t border-slate-100">
          <button
            onClick={handleHint}
            disabled={disabled || remainingCount === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-40"
            title="Get Hint"
          >
            <Lightbulb className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span>HINT</span>
          </button>

          <div className="font-mono text-xs font-bold text-slate-500">
            <span className="text-slate-900 text-base">{remainingCount}</span> ARROWS LEFT
          </div>

          <button
            onClick={handleResetBoard}
            disabled={disabled}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-40"
            title="Reset Board"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
