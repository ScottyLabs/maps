import { useState } from "react";
import { IoIosArrowDown, IoIosArrowUp } from "react-icons/io";

interface Props {
  title: string | React.ReactElement;
  children: React.ReactElement;
}

const CollapsibleWrapper = ({ title, children }: Props) => {
  const [open, setOpen] = useState(false);

  const renderTrigger = () => (
    <div className="flex items-center justify-between rounded px-4 pt-2 pb-1">
      <h3>{title}</h3>
      <div>{open ? <IoIosArrowUp size={15} /> : <IoIosArrowDown size={15} />}</div>
    </div>
  );

  return (
    <div className="flex flex-col overflow-hidden rounded">
      <button
        type="button"
        className="flex cursor-pointer flex-col bg-white"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setOpen(!open);
          }
        }}
      >
        {renderTrigger()}
      </button>
      <div
        className={`overflow-hidden bg-white duration-500 ease-in-out ${
          open ? "flex h-full flex-col" : "h-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export { CollapsibleWrapper };
