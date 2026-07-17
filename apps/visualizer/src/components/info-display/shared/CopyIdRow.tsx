import { toast } from "react-toastify";

import TableCell from "./TableCell.tsx";

interface Props {
  text: string;
  id: string;
}

const CopyIdRow = ({ text, id }: Props) => {
  const copyId = () => {
    navigator.clipboard.writeText(id);
    toast.success("Copied!");
  };

  return (
    <tr>
      <TableCell text={text} />
      <td className="border px-4 py-2 text-sm">
        <button
          type="button"
          className="cursor-pointer border p-1 hover:bg-slate-700"
          onClick={copyId}
        >
          Copy {text}
        </button>
      </td>
    </tr>
  );
};

export default CopyIdRow;
