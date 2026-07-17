import { useEffect, useState } from "react";
import Select, { type SingleValue } from "react-select";

import { setShortcutsDisabled } from "../../../store/features/statusSlice.ts";
import { useAppDispatch } from "../../../store/hooks.ts";

interface Props {
  value: string | undefined;
  typeList: readonly string[];
  handleChange: (
    newValue: SingleValue<{
      value: string | undefined;
      label: string | undefined;
    }>,
  ) => void;
}

const SelectTypeCell = ({ value, typeList, handleChange }: Props) => {
  const dispatch = useAppDispatch();

  const options = typeList.map((type) => ({ value: type, label: type }));
  const [valueColor, setValueColor] = useState("black");
  const [selectedOption, setSelectedOption] = useState({
    value: value,
    label: value,
  });

  // update selected option when value changes (from undo/redo)
  useEffect(() => {
    setSelectedOption({ value: value, label: value });
  }, [value]);

  return (
    <td className="border border-white px-4 py-2 text-black">
      <Select
        value={selectedOption}
        onChange={handleChange}
        options={options}
        onFocus={() => {
          dispatch(setShortcutsDisabled(true));
          setValueColor("gray");
        }}
        onBlur={() => {
          dispatch(setShortcutsDisabled(false));
          setValueColor("black");
        }}
        blurInputOnSelect
        styles={{
          control: (provided) => ({
            ...provided,
            minHeight: "30px",
          }),
          valueContainer: (provided) => ({
            ...provided,
            height: "30px",
            padding: "0 6px",
          }),
          indicatorsContainer: (provided) => ({
            ...provided,
            height: "30px",
          }),
          singleValue: (provided) => ({
            ...provided,
            color: valueColor,
          }),
        }}
        className="text-left"
      />
    </td>
  );
};

export default SelectTypeCell;
