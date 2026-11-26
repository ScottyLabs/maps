import { useSession } from "@/lib/authClient.ts";

const useUser = () => useSession().data;

export { useUser };
