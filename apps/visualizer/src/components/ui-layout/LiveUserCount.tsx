import { CiUser } from "react-icons/ci";

import { useAppSelector } from "../../store/hooks.ts";

const LiveUserCount = () => {
  const users = useAppSelector((state) => state.liveCursor.liveUsers);

  return (
    <div className="absolute top-16 bottom-0">
      <div className="sticky top-4 m-2">
        <div className="flex items-center">
          <CiUser fill="blue" />
          {Object.keys(users).length}
        </div>
      </div>
    </div>
  );
};

export default LiveUserCount;
