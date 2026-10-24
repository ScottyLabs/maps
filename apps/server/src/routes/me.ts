import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/middleware.ts";

export const meRoute = new Elysia().use(authPlugin).get(
  "/me",
  ({ user }) => ({
    andrewId: user.andrewId,
    groups: user.groups,
    id: user.userId,
    name: user.name,
    oidcSubject: user.subject,
  }),
  {
    auth: "user",
    response: {
      200: t.Object({
        id: t.Union([t.Integer(), t.Null()]),
        name: t.String(),
        andrewId: t.String(),
        oidcSubject: t.String(),
        groups: t.Array(t.String()),
      }),
      401: t.Object({ error: t.String() }),
      403: t.Object({ error: t.String() }),
    },
  },
);
