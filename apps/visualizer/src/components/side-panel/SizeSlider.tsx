import { setNodeSize } from "../../store/features/uiSlice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";

interface Props {
  text: string;
}

const NodeSizeSlider = ({ text }: Props) => {
  const dispatch = useAppDispatch();
  const nodeSize = useAppSelector((state) => state.ui.nodeSize);

  return (
    <div className="w-48">
      <input
        type="range"
        min="1"
        max="12"
        step=".5"
        value={nodeSize}
        onChange={(e) =>
          dispatch(setNodeSize(Number.parseFloat(e.target.value)))
        }
        className="h-2 w-full cursor-pointer rounded-lg bg-blue-400"
      />
      <div className="text-center text-sm">
        {text} Size: {nodeSize}
      </div>
    </div>
  );
};

export default NodeSizeSlider;
