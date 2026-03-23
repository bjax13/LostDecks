import { describe, expect, it } from "vitest";
import {
  applyConveyorPush,
  CONVEYOR_EXPRESS,
  CONVEYOR_STANDARD,
  conveyorStepCount,
} from "./conveyor.js";

const board10 = { width: 10, height: 10 };

describe("conveyorStepCount", () => {
  it("returns 1 for standard belts", () => {
    expect(conveyorStepCount(CONVEYOR_STANDARD)).toBe(1);
  });

  it("returns 2 for express belts", () => {
    expect(conveyorStepCount(CONVEYOR_EXPRESS)).toBe(2);
  });
});

describe("applyConveyorPush", () => {
  it("moves one tile east on a standard belt", () => {
    expect(
      applyConveyorPush({ x: 3, y: 4 }, { kind: CONVEYOR_STANDARD, direction: "east" }, board10),
    ).toEqual({ x: 4, y: 4 });
  });

  it("moves two tiles east on an express belt", () => {
    expect(
      applyConveyorPush({ x: 3, y: 4 }, { kind: CONVEYOR_EXPRESS, direction: "east" }, board10),
    ).toEqual({ x: 5, y: 4 });
  });

  it("moves one tile north on a standard belt", () => {
    expect(
      applyConveyorPush({ x: 2, y: 2 }, { kind: CONVEYOR_STANDARD, direction: "north" }, board10),
    ).toEqual({ x: 2, y: 1 });
  });

  it("stops at the board edge on standard (cannot leave)", () => {
    expect(
      applyConveyorPush({ x: 9, y: 5 }, { kind: CONVEYOR_STANDARD, direction: "east" }, board10),
    ).toEqual({ x: 9, y: 5 });
  });

  it("allows partial express movement when only one step fits", () => {
    expect(
      applyConveyorPush({ x: 8, y: 5 }, { kind: CONVEYOR_EXPRESS, direction: "east" }, board10),
    ).toEqual({ x: 9, y: 5 });
  });

  it("returns the same position when direction is unknown", () => {
    const belt = { kind: CONVEYOR_STANDARD, direction: "up" };
    expect(applyConveyorPush({ x: 1, y: 1 }, belt, board10)).toEqual({ x: 1, y: 1 });
  });
});
