interface Props {
  isOn: boolean;
  handleToggle: () => void;
}

const ToggleSwitch = ({ isOn, handleToggle }: Props) => {
  return (
    <button
      type="button"
      className={`h-8 w-14 cursor-pointer rounded-full ${isOn ? "bg-blue-500" : "bg-gray-300"}`}
      onClick={handleToggle}
    >
      <div
        className={`m-1 h-6 w-6 rounded-full bg-white shadow duration-200 ease-in ${
          isOn ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
};

export default ToggleSwitch;
