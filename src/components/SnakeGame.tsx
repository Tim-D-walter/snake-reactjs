"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const GRID = 20;
const START_SPEED_MS = 200; // etwas schneller für direkteres Gefühl
// Wrap-Modus: an den Rändern erscheint die Schlange gegenüber wieder
const WRAP_EDGES = true; // etwas schneller für direkteres Gefühl

type Point = { x: number; y: number };
const eq = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

function randomCell(exclude: Point[]): Point {
    while (true) {
        const p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
        if (!exclude.some((e) => eq(e, p))) return p;
    }
}

export default function SnakeGame(): JSX.Element {
    const [snake, setSnake] = useState<Point[]>([
        { x: 8, y: 10 },
        { x: 7, y: 10 },
        { x: 6, y: 10 },
    ]);
    const [dir, setDir] = useState<Point>({ x: 1, y: 0 });
    const dirRef = useRef(dir);
    useEffect(() => {
        dirRef.current = dir;
    }, [dir]);

    const [food, setFood] = useState<Point>({ x: 12, y: 12 });
    const [running, setRunning] = useState(false);
    const [speed, setSpeed] = useState(START_SPEED_MS);
    const [score, setScore] = useState(0);
    const [best, setBest] = useState(0);
    const [gameOver, setGameOver] = useState(false);

    // Only keep the most recent input between ticks (improves responsiveness)
    const pendingDirRef = useRef<Point | null>(null);

    // randomize ONCE after mount to avoid SSR/client mismatch
    useEffect(() => {
        setFood(randomCell([{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }]));
    }, []);

    const reset = useCallback(() => {
        setSnake([{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }]);
        setDir({ x: 1, y: 0 });
        setFood({ x: 12, y: 12 });
        setRunning(false);
        setSpeed(START_SPEED_MS);
        setScore(0);
        setGameOver(false);
        pendingDirRef.current = null;
    }, []);

    // Ensure element has focus so WASD/Arrows are captured reliably
    const rootRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        rootRef.current?.focus();
    }, []);

    // Keyboard input — use e.code for layout-agnostic WASD (KeyW/KeyA/KeyS/KeyD)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const codeMap: Record<string, Point> = {
                ArrowUp: { x: 0, y: -1 },
                ArrowDown: { x: 0, y: 1 },
                ArrowLeft: { x: -1, y: 0 },
                ArrowRight: { x: 1, y: 0 },
                KeyW: { x: 0, y: -1 },
                KeyS: { x: 0, y: 1 },
                KeyA: { x: -1, y: 0 },
                KeyD: { x: 1, y: 0 },
            };
            const cand = codeMap[e.code] ?? codeMap[e.key as keyof typeof codeMap];
            if (!cand) return;

            // Disallow immediate reverse vs CURRENT direction (not previous frame)
            const cur = dirRef.current;
            if (snake.length > 1 && snake[0].x + cand.x === snake[1].x && snake[0].y + cand.y === snake[1].y) {
                e.preventDefault();
                return;
            }

            // keep only the latest input until next tick
            pendingDirRef.current = cand;
            e.preventDefault();
        };

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [snake]);

    // Space/Enter hotkey to start or restart after game over
    useEffect(() => {
        const onHotkey = (e: KeyboardEvent) => {
            if (e.code !== "Space" && e.code !== "Enter") return;
            if (!running) {
                if (gameOver) {
                    reset();
                }
                setRunning(true);
                e.preventDefault();
            }
        };
        window.addEventListener("keydown", onHotkey);
        return () => window.removeEventListener("keydown", onHotkey);
    }, [running, gameOver, reset]);

    // Game loop
    useEffect(() => {
        if (!running) return;
        const id = setInterval(() => {
            setSnake((prev) => {
                // apply latest pending direction if present and valid
                if (pendingDirRef.current) {
                    const cand = pendingDirRef.current;
                    if (!(prev.length > 1 && prev[0].x + cand.x === prev[1].x && prev[0].y + cand.y === prev[1].y)) {
                        setDir(cand);
                        pendingDirRef.current = null;
                    }
                }

                const nextDir = dirRef.current;
                // neuen Kopf berechnen (mit optionalem Wrap)
                let headX = prev[0].x + nextDir.x;
                let headY = prev[0].y + nextDir.y;
                if (WRAP_EDGES) {
                    headX = (headX % GRID + GRID) % GRID;
                    headY = (headY % GRID + GRID) % GRID;
                } else {
                    if (headX < 0 || headX >= GRID || headY < 0 || headY >= GRID) {
                        setRunning(false);
                        setBest((b) => Math.max(b, score));
                        setGameOver(true);
                        return prev;
                    }
                }
                const head = { x: headX, y: headY };

// self collision bleibt bestehen
                if (prev.some((p) => eq(p, head))) {
                    setRunning(false);
                    setBest((b) => Math.max(b, score));
                    setGameOver(true);
                    return prev;
                }

                const ate = eq(head, food);
                const nextSnake = [head, ...prev];
                if (!ate) nextSnake.pop();

                if (ate) {
                    setScore((s) => s + 1);
                    setSpeed((sp) => Math.max(60, Math.floor(sp * 0.98)));
                    setFood(randomCell(nextSnake));
                }
                return nextSnake;
            });
        }, speed);
        return () => clearInterval(id);
    }, [running, speed, food, score]);

    const cells = useMemo(() => {
        const set = new Set(snake.map((p) => `${p.x}:${p.y}`));
        return { isSnake: (x: number, y: number) => set.has(`${x}:${y}`) };
    }, [snake]);

    return (
        <div ref={rootRef} tabIndex={0} role="application" className="w-full max-w-3xl mx-auto outline-none">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-slate-800 text-lg font-semibold">Snake (Next.js / React)</h2>
                <div className="text-slate-600">
                    <span className="opacity-80">Score: </span>
                    <span className="font-semibold tabular-nums">{score}</span>
                    <span className="mx-2 opacity-40">•</span>
                    <span className="opacity-80">Best: </span>
                    <span className="font-semibold tabular-nums">{best}</span>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-1">
                    <div
                        className="relative rounded-2xl overflow-hidden border border-gray-300 bg-white"
                        style={{ width: "min(85vw, 640px)", aspectRatio: "1 / 1" }}
                    >
                        <div
                            className="absolute inset-0 grid"
                            style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)`, gridTemplateRows: `repeat(${GRID}, 1fr)` }}
                        >
                            {Array.from({ length: GRID * GRID }).map((_, i) => {
                                const x = i % GRID;
                                const y = Math.floor(i / GRID);
                                const isFood = food.x === x && food.y === y;
                                const isHead = snake[0].x === x && snake[0].y === y;
                                const isBody = !isHead && cells.isSnake(x, y);
                                return (
                                    <div key={i} className="border border-gray-200 relative">
                                        {isBody && <div className="absolute inset-1 rounded-lg bg-blue-500/80" />}
                                        {isHead && <div className="absolute inset-1 rounded-lg bg-blue-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />}
                                        {isFood && <div className="absolute inset-2 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.8)]" />}
                                    </div>
                                );
                            })}
                        </div>
                        {!running && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
                                <div className="text-center space-y-4">
                                    <div className="text-slate-100 text-xl font-semibold">{score === 0 ? "Ready? (Space/Enter)" : "Game Over (Space/Enter)"}</div>
                                    <div className="text-slate-300 text-sm">Controls: Arrow keys or WASD</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full md:w-56 space-y-3">
                    <button
                        className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2 text-slate-100 hover:bg-slate-700/70"
                        onClick={() => setRunning((r) => !r)}
                    >
                        {running ? "Stop" : "Start"}
                    </button>
                    <button
                        className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2 text-slate-100 hover:bg-slate-700/70"
                        onClick={reset}
                    >
                        Reset
                    </button>
                    <div className="pt-2 text-slate-300 text-sm leading-relaxed">
                        <p className="mb-2 font-medium text-slate-200">Tips</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Use Arrow keys or WASD</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
