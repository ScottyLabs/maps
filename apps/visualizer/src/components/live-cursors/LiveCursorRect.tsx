import type { PdfCoordinate } from "@cmumaps/common";
import type { LiveUser } from "@cmumaps/websocket";

import { useState } from "react";
import { Group, Rect, Text } from "react-konva";

interface CursorNameRectProps {
  user: LiveUser;
  cursorPos: PdfCoordinate;
  scale: number;
}

const CursorNameRect = ({ user, cursorPos, scale }: CursorNameRectProps) => {
  const [textWidth, setTextWidth] = useState(0);
  const [textHeight, setTextHeight] = useState(0);

  const nameOffset = { x: 10, y: 15 };
  const namePadding = 10;

  return (
    <Group x={cursorPos.x + nameOffset.x / scale} y={cursorPos.y + nameOffset.y / scale}>
      <Rect
        width={textWidth + namePadding / scale}
        height={textHeight + namePadding / scale}
        fill={user.color}
        cornerRadius={10 / scale}
      />
      <Text
        x={namePadding / scale / 2}
        y={namePadding / scale / 2}
        text={user.userName}
        fontSize={16 / scale}
        fill="white"
        ref={(node) => {
          if (node) {
            setTextWidth(node.width());
            setTextHeight(node.height());
          }
        }}
      />
    </Group>
  );
};

export default CursorNameRect;
