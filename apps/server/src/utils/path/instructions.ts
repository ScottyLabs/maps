import type { GeoNode, Instruction } from "../../../../../packages/common/src/index.ts";
import { calculateAngle } from "../../../../../packages/common/src/index.ts";

export const PLACEHOLDER_INSTRUCTION_DISTANCE = 42;

export function generateInstructions(path: GeoNode[]): Instruction[] {
  const instructions: Instruction[] = [];

  for (let i = 0; i < path.length - 2; i++) {
    const first = path[i];
    const second = path[i + 1];
    const third = path[i + 2];

    const angle = calculateAngle(first.pos, second.pos, third.pos);

    if (Math.abs(angle) >= 30 && Math.abs(angle) <= 150) {
      const action = angle < 0 ? "Left" : "Right";
      instructions.push({
        action,
        distance: PLACEHOLDER_INSTRUCTION_DISTANCE,
        nodeId: second.id,
      });
    }
  }

  return instructions;
}
