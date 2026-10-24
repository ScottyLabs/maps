import { env } from "@/env.ts";
import { type User, useSession } from "@/lib/authClient.ts";

const DEV_USER: User = {
  id: 0,
  name: "Dev User",
  andrewId: "dev",
  oidcSubject: "dev-user",
  groups: [],
};

const useUser = (): User | null => {
  const { data } = useSession();

  if (env.ignoreLogin) {
    return DEV_USER;
  }

  return data;
};

export { useUser };
