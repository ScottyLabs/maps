import { type ReactNode, useState } from "react";
import type { IconType } from "react-icons";
import { AiOutlineMacCommand } from "react-icons/ai";
import { MdOutlinePalette } from "react-icons/md";

import QuestionCircle from "../shared/QuestionCircle";

const HelpInfo = () => {
  const IconHelper = (IconComponent: IconType, renderText: () => ReactNode) => {
    const [showText, setShowText] = useState(false);

    return (
      <>
        <IconComponent
          className="rounded-full bg-gray-100 text-2xl"
          onMouseEnter={() => setShowText(true)}
          onMouseLeave={() => setShowText(false)}
        />
        {showText && (
          <div className="fixed right-4 bottom-9 rounded border border-gray-400 bg-slate-200 p-0.5">
            {renderText()}
          </div>
        )}
      </>
    );
  };

  const renderKeyboardShortcutText = () => (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="font-bold">Visibility</h1>
        <p>Press 'g' to toggle "Show Nodes" and "Show Edges".</p>
        <p>Press 'l' to toggle "Show Labels".</p>
        <p>Press 'p' to toggle "Show Polygons".</p>
      </div>
      <div>
        <h1 className="font-bold">Graph</h1>
        <p>Press 'n' to add a node.</p>
        <p>Press 'backspace' or 'delete' to delete a node.</p>
        <p>Press 'e' to add an edge by clicking.</p>
        <p>Press 'd' to delete a edge by clicking.</p>
        <p>Press 'w' to add a door node.</p>
      </div>
      <div>
        <h1 className="font-bold">Polygon</h1>
        <p>Press 'v' to add a vertex.</p>
        <p>Press 'd' to delete a vertex.</p>
      </div>
      <div>
        <h1 className="font-bold">General</h1>
        <p>Press 'q' to return to Graph Select mode.</p>
        <p>Press 'r' to refetch data.</p>
        <p>'ctrl + z' or 'cmd + z' to undo.</p>
        <p>'ctrl + shift + z' or 'cmd + shift + z' to redo.</p>
      </div>
    </div>
  );

  const renderColorInfoText = () => (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="font-bold">Nodes</h1>
        <p>
          <span className="text-blue-600">Blue</span>: default
        </p>
        <p>
          <span className="text-yellow-600">Yellow</span>: selected
        </p>
        <p>
          <span className="text-cyan-600">Cyan</span>: Point of Interest
        </p>
        <p>
          <span className="text-gray-600">Gray</span>: inaccessible
        </p>
        <p>
          <span className="text-lime-600">Lime</span>: the room type goes across
          floors
        </p>
        <p>
          <span className="text-red-600">Red</span>: doesn't have a room or a
          room polygon
        </p>
        <p className="text-pink-600">Pink:</p>
        <ul className="ml-5 list-disc">
          <li>doesn't have a room type </li>
          <li>
            the room type goes across floors and it doesn't have a neighbor to
            another floor (not including outside)
          </li>
          <li>
            the room type doesn't goes across floors and it does have a neighbor
            to another floor (not including outside)
          </li>
        </ul>
      </div>
      <div>
        <h1 className="font-bold">Edges</h1>
        <p>
          <span className="text-green-600">Green</span>: default
        </p>
        <p>
          <span className="text-orange-600">Orange</span>: selected
        </p>
      </div>
      <div>
        <h1 className="font-bold">Doors</h1>
        <p>
          <span className="text-purple-600">Purple</span>: connects exactly two
          rooms
        </p>
        <p>Black: connects no room</p>
        <p>
          <span className="text-red-600">Red</span>: connects one room or more
          than two rooms
        </p>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed right-20 bottom-2 z-50">
        <QuestionCircle
          url="https://docs.google.com/document/d/1-cCIbMQp5eLcjvXO46XwQY86PnqABLn0Ts0VEIpT6AM"
          style="bg-gray-100"
        />
      </div>
      <div className="fixed right-12 bottom-2 z-50">
        {IconHelper(AiOutlineMacCommand, renderKeyboardShortcutText)}
      </div>
      <div className="fixed right-4 bottom-2 z-50">
        {IconHelper(MdOutlinePalette, renderColorInfoText)}
      </div>
    </>
  );
};

export default HelpInfo;
