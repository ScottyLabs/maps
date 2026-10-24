import type { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { toast } from "react-toastify";

const isFetchError = (e: unknown): e is { error: FetchBaseQueryError } =>
  typeof e === "object" &&
  e !== null &&
  "error" in e &&
  typeof e.error === "object" &&
  e.error !== null &&
  "status" in e.error;

// the api answers with `{ error: string }` bodies
const errorMessage = (data: unknown): string | undefined => {
  if (typeof data === "string") {
    return data;
  }
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error;
  }
};

// error handling for queryFulfilled
export const handleQueryError = async (
  queryFulfilled: unknown,
  undo: () => void,
  successMessage?: string,
) => {
  try {
    await queryFulfilled;
    if (successMessage) {
      toast.success(successMessage);
    }
  } catch (e) {
    const error = isFetchError(e) ? e.error : undefined;
    const message = error && "data" in error ? errorMessage(error.data) : undefined;

    if (error?.status === 401) {
      toast.error(message ?? "You are signed out! Sign in again to edit.");
    } else if (error?.status === 403) {
      toast.error(message ?? "You are not authorized to edit!");
    } else {
      toast.error(
        message
          ? `Failed to save! ${message}`
          : "Failed to save! Check the Console for detailed error.",
      );
    }
    undo();
    console.error(e);
  }
};
