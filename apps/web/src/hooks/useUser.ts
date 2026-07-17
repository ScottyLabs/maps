import { env } from "@/env.ts";
import { useSession } from "@/lib/authClient.ts";

const useUser = () => {
  const { data } = useSession();

  if (env.VITE_IGNORE_LOGIN) {
    return { id: "dev-user", name: "Dev User", email: "dev@localhost" };
  }

  if (data?.user) {
    return data.user;
  }

  return null;
};

export { useUser };
