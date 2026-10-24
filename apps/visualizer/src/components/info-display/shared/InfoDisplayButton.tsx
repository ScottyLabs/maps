import { twMerge } from "tailwind-merge";

interface Props {
  text: string;
  handleClick: () => void;
  style?: string;
}

const InfoDisplayButton = ({ text, handleClick, style }: Props) => {
  return (
    <div>
      <button
        type="button"
        className={twMerge("rounded bg-slate-500 px-2 py-1 text-sm hover:bg-slate-700", style)}
        onClick={handleClick}
      >
        {text}
      </button>
    </div>
  );
};

export default InfoDisplayButton;
