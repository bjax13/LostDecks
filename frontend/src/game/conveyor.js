/**
 * Conveyor belt movement for a square grid board.
 * Standard belts push a robot one tile in the belt direction; express belts push two tiles.
 * Pushes stop at the board edge (partial movement is allowed).
 */

/** @typedef {'north' | 'east' | 'south' | 'west'} ConveyorDirection */
/** @typedef {'standard' | 'express'} ConveyorKind */

/** @typedef {{ x: number; y: number }} GridPosition */
/** @typedef {{ width: number; height: number }} BoardSize */
/** @typedef {{ kind: ConveyorKind; direction: ConveyorDirection }} ConveyorBelt */

export const CONVEYOR_STANDARD = "standard";
export const CONVEYOR_EXPRESS = "express";

const DELTA = /** @type {Record<ConveyorDirection, { dx: number; dy: number }>} */ ({
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
});

/**
 * Number of grid steps the belt moves the robot during the conveyor register phase.
 * @param {ConveyorKind} kind
 * @returns {number}
 */
export function conveyorStepCount(kind) {
  return kind === CONVEYOR_EXPRESS ? 2 : 1;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {BoardSize} boardSize
 * @returns {boolean}
 */
function isInsideBoard(x, y, boardSize) {
  return x >= 0 && y >= 0 && x < boardSize.width && y < boardSize.height;
}

/**
 * New position after the belt push. The robot is assumed to be standing on the belt tile
 * before this runs (same as classic register-phase resolution).
 *
 * @param {GridPosition} position
 * @param {ConveyorBelt} belt
 * @param {BoardSize} boardSize
 * @returns {GridPosition}
 */
export function applyConveyorPush(position, belt, boardSize) {
  const delta = DELTA[belt.direction];
  if (!delta) {
    return { ...position };
  }

  const steps = conveyorStepCount(belt.kind);
  let { x, y } = position;

  for (let i = 0; i < steps; i++) {
    const nextX = x + delta.dx;
    const nextY = y + delta.dy;
    if (!isInsideBoard(nextX, nextY, boardSize)) {
      break;
    }
    x = nextX;
    y = nextY;
  }

  return { x, y };
}
