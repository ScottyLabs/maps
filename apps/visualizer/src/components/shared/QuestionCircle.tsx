import { FaRegQuestionCircle } from "react-icons/fa";
import { twMerge } from "tailwind-merge";

interface Props {
  url: string;
  style?: string;
}

const QuestionCircle = ({ url, style }: Props) => {
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <FaRegQuestionCircle
        className={twMerge("cursor-pointer rounded-full text-2xl hover:text-blue-600", style)}
      />
    </a>
  );
};

export default QuestionCircle;
