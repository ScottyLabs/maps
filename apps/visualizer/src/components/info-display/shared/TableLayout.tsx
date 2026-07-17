import TableCell from "./TableCell.tsx";

// table layout for RoomInfoDisplay and PoiInfoDisplay
const TableLayout = (props: { children: React.ReactNode }) => {
  return (
    <table className="w-68 table-fixed">
      <thead>
        <tr>
          <TableCell text="Property" style="font-bold w-28" />
          <TableCell text="Value" style="font-bold" />
        </tr>
      </thead>
      <tbody>{props.children}</tbody>
    </table>
  );
};

export default TableLayout;
