import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import ErrorDisplay from "./components/shared/ErrorDisplay.tsx";
import Loader from "./components/shared/Loader.tsx";

export const LOGIN_URL = "/api/auth/login";
export const LOGOUT_URL = "/api/auth/logout";

export interface SessionUser {
  id: number;
  name: string;
  andrewId: string;
  oidcSubject: string;
  groups: string[];
}

type Session = { status: "authenticated"; user: SessionUser } | { status: "unauthenticated" };

// cached so strict mode's double effect only hits /api/me once
let sessionPromise: Promise<Session> | undefined;

const SessionContext = createContext<SessionUser | null>(null);

export const useSession = (): SessionUser => {
  const user = useContext(SessionContext);
  if (!user) {
    throw new Error("useSession must be used inside RequireAuth");
  }
  return user;
};

interface Props {
  children: ReactNode;
}

// gates the app on a server session; anonymous visitors go to OIDC login
const RequireAuth = ({ children }: Props) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    sessionPromise ??= fetch("/api/me", { credentials: "include" }).then(
      async (response): Promise<Session> => {
        if (response.status === 401) {
          return { status: "unauthenticated" };
        }
        if (!response.ok) {
          throw new Error(`GET /api/me responded with ${response.status}`);
        }
        return { status: "authenticated", user: await response.json() };
      },
    );
    sessionPromise.then(
      (session) => {
        if (cancelled) {
          return;
        }
        if (session.status === "unauthenticated") {
          // no setUser: the loader stays up while the browser navigates
          globalThis.location.href = LOGIN_URL;
          return;
        }
        setUser(session.user);
      },
      (error) => {
        console.error(error);
        if (!cancelled) {
          setFailed(true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return <ErrorDisplay errorText="Failed to load your session" />;
  }

  if (!user) {
    return <Loader loadingText="Signing in" />;
  }

  return <SessionContext value={user}>{children}</SessionContext>;
};

export default RequireAuth;
