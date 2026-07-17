import type { SerializedError } from "@reduxjs/toolkit";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import ErrorDisplay from "./ErrorDisplay.tsx";

interface Props {
  error: FetchBaseQueryError | SerializedError;
}

// TODO: improve error handling by following https://redux-toolkit.js.org/rtk-query/usage-with-typescript#error-result-example
const ErrorHandler = ({ error }: Props) => {
  console.error(error);
  return <ErrorDisplay errorText="Query Error" />;
};

export default ErrorHandler;
