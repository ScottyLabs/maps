interface Props {
  code: string;
}

/**
 * The roundel displaying a building's code.
 */
const Roundel = ({ code }: Props) => (
  <div className="flex size-10 items-center justify-center rounded-full border border-white bg-[#4b5563] text-center font-medium font-mono text-white">
    {code}
  </div>
);

export { Roundel };
