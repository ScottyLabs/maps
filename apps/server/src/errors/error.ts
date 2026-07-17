import type { ErrorCode } from "../../../../packages/common/src/errorCode.ts";

export class BuildingError extends Error {
  public code: ErrorCode;
  public constructor(code: ErrorCode) {
    super(code);
    this.code = code;
  }
}
