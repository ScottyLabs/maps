import type { PoiType } from "@cmumaps/common";
import { FaPhoneAlt, FaPrint } from "react-icons/fa";
import { GiVendingMachine } from "react-icons/gi";
import { MdLocalDrink, MdMonitorHeart, MdPedalBike, MdWc, MdQuestionMark } from "react-icons/md";

interface PoiTypeStyle {
  background: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const DEFAULT_STYLE: PoiTypeStyle = {
  background: "#9ca3af",
  Icon: MdQuestionMark,
};

const STYLES: Record<Exclude<PoiType, "">, PoiTypeStyle> = {
  "Vending Machine": { background: "#dc2626", Icon: GiVendingMachine },
  "Water Fountain": { background: "#2563eb", Icon: MdLocalDrink },
  Printer: { background: "#7c3aed", Icon: FaPrint },
  AED: { background: "#16a34a", Icon: MdMonitorHeart },
  "Bike Rack": { background: "#0891b2", Icon: MdPedalBike },
  Restroom: { background: "#ca8a04", Icon: MdWc },
  "Emergency Phone": { background: "#ea580c", Icon: FaPhoneAlt },
};

export const getPoiTypeStyle = (type: PoiType): PoiTypeStyle =>
  type ? STYLES[type] : DEFAULT_STYLE;
