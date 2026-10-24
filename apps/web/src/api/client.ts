import createFetchClient from "openapi-fetch";
import { previewChanged, selectedRevision } from "../preview";
import createClient from "openapi-react-query";
import { env } from "@/env.ts";
import type { paths } from "../../../server/build/swagger.d.ts";

const fetchClient = createFetchClient<paths>({
  baseUrl: `${env.VITE_SERVER_URL}`,
  credentials: "include",
});

fetchClient.use({
  onRequest({ request }) {
    request.headers.set("X-Maps-Revision", selectedRevision());
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 409) {
      const data = await response.clone().json();
      if (data.code === "PREVIEW_CHANGED") previewChanged(data.preview);
    }
    return response;
  },
});

const $api = createClient(fetchClient);

export { $api };
