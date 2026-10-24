interface Props {
  lowerHeight: number;
}

const AboutMenu = ({ lowerHeight }: Props) => (
  <div
    className="btn-shadow-dark fixed inset-x-5 z-50 overflow-auto rounded-lg bg-white shadow-lg"
    style={{ bottom: lowerHeight }}
  >
    <div className="w-full py-2 text-center font-bold text-xl">About CMU Maps</div>
    <div className="flex w-full justify-center py-2 text-lg">
      <a
        href="https://docs.google.com/document/d/1jZeIij72ovf3K2J1J57rlD4pz3xnca3BfPedg9Ff1sc/edit?tab=t.0#heading=h.ec0fj4jqvpj"
        className="text-primary-blue underline"
        target="_blank"
        rel="noreferrer"
      >
        Feedback Form
      </a>
    </div>
  </div>
);

export { AboutMenu };
