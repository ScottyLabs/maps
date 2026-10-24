import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import type { paths } from "../../../server/build/openapi.d.ts";

const fetchClient = createFetchClient<paths>({
  credentials: "include",
});

const $api = createClient(fetchClient);

export { $api };
