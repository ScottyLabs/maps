import { setNodeSize } from "../../store/features/uiSlice.ts";
import { useAppDispatch, useAppSelector } from "../../store/hooks.ts";

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
        min="0.5"
        max="10"
        step=".1"
        value={nodeSize}
        onChange={(e) => dispatch(setNodeSize(Number.parseFloat(e.target.value)))}
        className="h-2 w-full cursor-pointer rounded-lg bg-blue-400"
      />
      <div className="text-center text-sm">
        {text} Size: {nodeSize}
      </div>
    </div>
  );
};

export default NodeSizeSlider;
