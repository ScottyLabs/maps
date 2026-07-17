import type { ErrorCode } from "@cmumaps/common";
import { Slide, ToastContainer } from "react-toastify";

import useErrorToast from "../../hooks/useErrorToast.ts";

interface Props {
  errorCode?: ErrorCode;
}

const MyToastContainer = ({ errorCode }: Props) => {
  useErrorToast(errorCode);

  return (
    <ToastContainer
      position="top-right"
      autoClose={2000}
      hideProgressBar={true}
      closeOnClick
      theme="colored"
      transition={Slide}
      toastStyle={{
        maxWidth: "fit-content",
        paddingRight: "2rem",
      }}
    />
  );
};

export default MyToastContainer;
