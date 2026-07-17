import { FAILED_LOAD, LOADING } from "../../store/features/statusSlice.ts";
import { useAppSelector } from "../../store/hooks.ts";
import Loader from "../shared/Loader.tsx";

const LoadingText = () => {
  const loadingStatus = useAppSelector((state) => state.status.loadingStatus);
  const loadingText = useAppSelector((state) => state.status.loadingText);

  if (loadingStatus === LOADING) {
    return <Loader loadingText={loadingText} />;
  }

  if (loadingStatus === FAILED_LOAD) {
    return (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2">
        <p className="text-nowrap text-3xl text-red-500">{loadingText}</p>
      </div>
    );
  }
};

export default LoadingText;
