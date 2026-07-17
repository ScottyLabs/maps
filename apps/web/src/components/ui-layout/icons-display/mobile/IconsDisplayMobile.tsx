import { MdLogin, MdLogout } from "react-icons/md";
import { useLocationParams } from "@/hooks/useLocationParams.ts";
import { useNavPaths } from "@/hooks/useNavigationParams.ts";
import { useUser } from "@/hooks/useUser.ts";
import { signIn, signOut } from "@/lib/authClient.ts";
import { useBoundStore } from "@/store/index.ts";

const IconsDisplayMobile = () => {
  const isSearchOpen = useBoundStore((state) => state.isSearchOpen);
  const { isCardOpen } = useLocationParams();
  const { isNavOpen } = useNavPaths();
  const user = useUser();

  if (isSearchOpen || isCardOpen || isNavOpen) {
    return;
  }

  const Icon = user ? MdLogout : MdLogin;
  const label = user ? "Sign out" : "Sign in";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="btn-shadow-dark fixed bottom-8 left-5 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-background-brand-primary-enabled text-white"
      onClick={user ? signOut : signIn}
    >
      <Icon size={28} />
    </button>
  );
};

export { IconsDisplayMobile };
