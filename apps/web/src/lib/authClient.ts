import { useQuery } from "@tanstack/react-query";

export interface User {
  id: number;
  name: string;
  andrewId: string;
  oidcSubject: string;
  groups: string[];
}

const POST_LOGIN_CALLBACK_URL_KEY = "postLoginCallbackURL";

const sanitizeCallbackUrl = (callbackUrl: string): string => {
  try {
    const parsedCallbackUrl = new URL(callbackUrl, window.location.origin);
    if (parsedCallbackUrl.origin !== window.location.origin) {
      return window.location.href;
    }
    return parsedCallbackUrl.toString();
  } catch {
    return window.location.href;
  }
};

const consumePostLoginCallbackUrl = (): string | null => {
  const postLoginCallbackUrl = sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY);
  if (!postLoginCallbackUrl) {
    return null;
  }

  sessionStorage.removeItem(POST_LOGIN_CALLBACK_URL_KEY);
  return postLoginCallbackUrl;
};

export const setPostLoginCallbackUrl = (callbackUrl: string) => {
  sessionStorage.setItem(POST_LOGIN_CALLBACK_URL_KEY, sanitizeCallbackUrl(callbackUrl));
};

export const clearPostLoginCallbackUrl = () => {
  sessionStorage.removeItem(POST_LOGIN_CALLBACK_URL_KEY);
};

export const signIn = () => {
  setPostLoginCallbackUrl(consumePostLoginCallbackUrl() ?? window.location.href);
  window.location.href = "/api/auth/login";
};

export const signOut = () => {
  window.location.href = "/api/auth/logout";
};

export const useSession = () => {
  const { data, isPending } = useQuery({
    queryKey: ["session"],
    queryFn: async (): Promise<User | null> => {
      const response = await fetch("/api/me", { credentials: "include" });
      if (response.status === 401) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to load session (${response.status})`);
      }
      return (await response.json()) as User;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return { data: data ?? null, isPending };
};
