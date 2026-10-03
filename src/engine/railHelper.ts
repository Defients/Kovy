import type { Vec2, HabitatRail } from "@/store/types";
import { distance } from "@/lib/utils";

/**
 * Find the nearest point on any rail to the given position.
 * Returns the rail, segment index, and the projected point.
 */
export function findNearestRailPoint(
  pos: Vec2,
  rails: HabitatRail[]
): { rail: HabitatRail; segmentIndex: number; point: Vec2; dist: number } | null {
  if (rails.length === 0) return null;

  let best: { rail: HabitatRail; segmentIndex: number; point: Vec2; dist: number } | null = null;

  for (const rail of rails) {
    if (rail.points.length < 2) continue;
    for (let i = 0; i < rail.points.length - 1; i++) {
      const proj = projectOntoSegment(pos, rail.points[i], rail.points[i + 1]);
      const d = distance(pos.x, pos.y, proj.x, proj.y);
      if (!best || d < best.dist) {
        best = { rail, segmentIndex: i, point: proj, dist: d };
      }
    }
  }

  return best;
}

/**
 * Given a position on a rail (identified by segment index),
 * return a point further along the rail by `advance` pixels.
 */
export function advanceAlongRail(
  rail: HabitatRail,
  segmentIndex: number,
  currentPoint: Vec2,
  advance: number
): Vec2 {
  if (rail.points.length < 2) return currentPoint;

  let remaining = advance;
  let seg = segmentIndex;
  let pos = { ...currentPoint };

  while (remaining > 0 && seg < rail.points.length - 1) {
    const target = rail.points[seg + 1];
    const d = distance(pos.x, pos.y, target.x, target.y);

    if (d <= remaining) {
      // Move to next segment
      remaining -= d;
      pos = { ...target };
      seg++;
    } else {
      // Partial move within this segment
      const t = remaining / d;
      pos = {
        x: pos.x + (target.x - pos.x) * t,
        y: pos.y + (target.y - pos.y) * t,
      };
      remaining = 0;
    }
  }

  return pos;
}

/**
 * Pick a random point along any rail in the list.
 */
export function randomPointOnRails(rails: HabitatRail[]): Vec2 | null {
  const validRails = rails.filter((r) => r.points.length >= 2);
  if (validRails.length === 0) return null;

  const rail = validRails[Math.floor(Math.random() * validRails.length)];
  const segIdx = Math.floor(Math.random() * (rail.points.length - 1));
  const t = Math.random();
  const a = rail.points[segIdx];
  const b = rail.points[segIdx + 1];

  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * Sample a short path along the nearest rail from a starting position.
 * Returns an array of waypoints for rail-glide movement.
 * `steps` controls how many intermediate points; `stepDist` is pixels per step.
 */
export function sampleRailPath(
  pos: Vec2,
  rails: HabitatRail[],
  steps: number = 3,
  stepDist: number = 80
): Vec2[] {
  const nearest = findNearestRailPoint(pos, rails);
  if (!nearest || nearest.dist > 200) return []; // too far from any rail

  const waypoints: Vec2[] = [];
  let currentPoint = nearest.point;
  let segIdx = nearest.segmentIndex;

  for (let i = 0; i < steps; i++) {
    const next = advanceAlongRail(nearest.rail, segIdx, currentPoint, stepDist);
    waypoints.push(next);
    // Update segment index for next advance
    const d = distance(currentPoint.x, currentPoint.y, next.x, next.y);
    if (d < 1) break; // reached end of rail
    currentPoint = next;
    // Find which segment we're now on
    for (let s = segIdx; s < nearest.rail.points.length - 1; s++) {
      const segEnd = nearest.rail.points[s + 1];
      if (distance(next.x, next.y, segEnd.x, segEnd.y) < stepDist) {
        segIdx = s;
        break;
      }
    }
  }

  return waypoints;
}

/**
 * Find a point on the nearest rail segment to pos, with the distance.
 * Useful for checking if Kovy is near a rail for route influence.
 */
export function nearestRailDistance(pos: Vec2, rails: HabitatRail[]): number {
  const result = findNearestRailPoint(pos, rails);
  return result ? result.dist : Infinity;
}

/** Project point P onto line segment AB, returning the closest point on AB. */
function projectOntoSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return { ...a };

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    x: a.x + t * dx,
    y: a.y + t * dy,
  };
}
