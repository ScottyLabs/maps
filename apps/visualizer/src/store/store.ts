import { configureStore } from "@reduxjs/toolkit";

import { apiSlice } from "./api/apiSlice.ts";
import dataSlice from "./features/dataSlice.ts";
import floorSlice from "./features/floorSlice.ts";
import historySlice from "./features/history/historySlice.ts";
import liveCursorSlice from "./features/liveCursor/liveCursorSlice.ts";
import modeSlice from "./features/modeSlice.ts";
import mouseEventSlice from "./features/mouseEventSlice.ts";
import polygonSlice from "./features/polygonSlice.ts";
import statusSlice from "./features/statusSlice.ts";
import uiSlice from "./features/uiSlice.ts";
// import usersSlice from './features/usersSlice';
import visibilitySlice from "./features/visibilitySlice.ts";
import { listenerMiddleware } from "./middleware/listenerMiddleware.ts";
import { webSocketMiddleware } from "./middleware/webSocketMiddleware.ts";

export const store = configureStore({
  reducer: {
    mode: modeSlice,
    mouseEvent: mouseEventSlice,
    ui: uiSlice,
    status: statusSlice,
    data: dataSlice,
    visibility: visibilitySlice,
    floor: floorSlice,
    liveCursor: liveCursorSlice,
    history: historySlice,
    polygon: polygonSlice,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .prepend(listenerMiddleware.middleware)
      .concat(webSocketMiddleware)
      .concat(apiSlice.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
