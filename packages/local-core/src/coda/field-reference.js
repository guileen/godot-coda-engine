const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerpPoint = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function clearance(point, obstacle) { return distance(point, obstacle) - obstacle.radius; }

function segmentClear(a, b, obstacles, margin = 0) {
  for (let index = 0; index <= 16; index += 1) {
    const point = lerpPoint(a, b, index / 16);
    if (obstacles.some((obstacle) => clearance(point, obstacle) < margin)) return false;
  }
  return true;
}

export function detectFieldStagnation(trace, { progress_epsilon = 0.01, speed_epsilon = 0.005, dwell_ticks = 8 } = {}) {
  if (!Array.isArray(trace) || trace.length < dwell_ticks + 1) return { stagnant: false, reason: "insufficient_trace" };
  const window = trace.slice(-dwell_ticks - 1);
  const progress = distance(window[0], window.at(-1));
  const speed = Math.max(...window.slice(1).map((state) => Math.hypot(state.vx ?? 0, state.vy ?? 0)));
  const stagnant = progress <= progress_epsilon && speed <= speed_epsilon;
  return { stagnant, reason: stagnant ? "progress_and_speed_below_threshold" : "moving", progress, max_speed: speed, dwell_ticks };
}

export function selectFiniteEscapeWaypoint({ start, target, obstacles = [], margin = 0.05 } = {}) {
  const candidates = [];
  for (const obstacle of obstacles) {
    const radius = obstacle.radius + margin;
    const offset = radius * 1.5;
    candidates.push(
      [{ x: obstacle.x - offset, y: obstacle.y + offset }, { x: obstacle.x + offset, y: obstacle.y + offset }],
      [{ x: obstacle.x - offset, y: obstacle.y - offset }, { x: obstacle.x + offset, y: obstacle.y - offset }],
      [{ x: obstacle.x - offset, y: obstacle.y - offset }, { x: obstacle.x - offset, y: obstacle.y + offset }],
      [{ x: obstacle.x + offset, y: obstacle.y - offset }, { x: obstacle.x + offset, y: obstacle.y + offset }]
    );
  }
  const safe = candidates.map((waypoints) => [start, ...waypoints, target]).filter((path) => path.slice(0, -1).every((point, index) => segmentClear(point, path[index + 1], obstacles, margin)));
  safe.sort((left, right) => {
    const pathCost = (path) => path.slice(0, -1).reduce((total, point, index) => total + distance(point, path[index + 1]), 0);
    const leftCost = pathCost(left);
    const rightCost = pathCost(right);
    return leftCost - rightCost || left[1].x - right[1].x || left[1].y - right[1].y;
  });
  if (!safe[0]) return { ok: false, reason: "NO_SAFE_ESCAPE_WAYPOINT" };
  const path = safe[0];
  return { ok: true, waypoint: path[1], path, clearance: Math.min(...path.flatMap((point) => obstacles.map((obstacle) => clearance(point, obstacle)))) };
}

export function runFieldWithFiniteFallback({ start, target, obstacles = [], trace = [], max_steps = 120, margin = 0.05 } = {}) {
  const stagnation = detectFieldStagnation(trace);
  if (!stagnation.stagnant && distance(start, target) <= margin) return { outcome: "execute", mode: "field", path: [start, target], stagnation };
  if (!stagnation.stagnant && trace.length < max_steps) return { outcome: "continue", mode: "field", path: trace, stagnation };
  const escape = selectFiniteEscapeWaypoint({ start, target, obstacles, margin });
  if (!escape.ok) return { outcome: "reject", mode: "fallback", reason: escape.reason, stagnation };
  return { outcome: "fallback", mode: "finite", path: escape.path, waypoint: escape.waypoint, stagnation, execution_authority: "candidate_only" };
}
