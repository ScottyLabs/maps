import { addListener, createListenerMiddleware } from "@reduxjs/toolkit";

import { setModeListener } from "../features/modeSlice.ts";
import type { AppDispatch, RootState } from "../store.ts";

export const listenerMiddleware = createListenerMiddleware();

export const startAppListening = listenerMiddleware.startListening.withTypes<
  RootState,
  AppDispatch
>();
export type AppStartListening = typeof startAppListening;

export const addAppListener = addListener.withTypes<RootState, AppDispatch>();
export type AppAddListener = typeof addAppListener;

setModeListener(startAppListening);
