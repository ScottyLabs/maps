import { useEffect, useState } from "react";
import { FaCheck, FaPencilAlt } from "react-icons/fa";

import { setShortcutsDisabled } from "../../../store/features/statusSlice.ts";
import { useAppDispatch } from "../../../store/hooks.ts";

interface Props {
  property: string;
  value: string | undefined;
  handleSave: (editedValue: string | undefined) => void;
}

const EditCell = ({ property, value, handleSave }: Props) => {
  const dispatch = useAppDispatch();

  const [isEditing, setIsEditing] = useState(false);

  const [editedValue, setEditedValue] = useState<string | undefined>(value);

  // the component doesn't unmount when directly clicking between rooms thus we need this useEffect to have the correct default editedValue
  useEffect(() => {
    setEditedValue(value);
  }, [value]);

  const renderValueCell = () => {
    if (isEditing) {
      return (
        <div className="my-1 flex justify-between">
          <input
            id={property}
            className="flex h-7 w-full rounded border border-gray-300 bg-white px-1 py-0.5"
            type="text"
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setIsEditing(false);
                handleSave(editedValue);
                dispatch(setShortcutsDisabled(false));
              }
            }}
            onBlur={() => {
              setEditedValue(value);
              dispatch(setShortcutsDisabled(false));
              setIsEditing(false);
            }}
          />
          <FaCheck
            className="ml-2 flex cursor-pointer text-2xl text-white hover:text-gray-400"
            onMouseDown={() => {
              setIsEditing(false);
              handleSave(editedValue);
              dispatch(setShortcutsDisabled(false));
            }}
          />
        </div>
      );
    }

    return (
      <div className="flex justify-between">
        <div className="h-7 truncate text-lg text-white">{value}</div>
        <FaPencilAlt
          className="mt-1 ml-2 flex-none cursor-pointer text-right text-white hover:text-gray-400"
          onClick={() => {
            setIsEditing(true);
            dispatch(setShortcutsDisabled(true));
          }}
        />
      </div>
    );
  };

  return (
    <td className="border border-white px-4 text-black">{renderValueCell()}</td>
  );
};

export default EditCell;
