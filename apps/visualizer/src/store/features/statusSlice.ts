import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type LoadingStatus = "Loaded" | "Loading" | "Failed";
export const LOADED: LoadingStatus = "Loaded";
export const LOADING: LoadingStatus = "Loading";
export const FAILED_LOAD: LoadingStatus = "Failed";

interface StatusState {
  loadingStatus: LoadingStatus;
  loadingText: string;
  shortcutsDisabled: boolean;
}

const initialState: StatusState = {
  loadingStatus: LOADED,
  loadingText: "",
  shortcutsDisabled: false,
};

const statusSlice = createSlice({
  name: "status",
  initialState,
  reducers: {
    startLoading(state, action: PayloadAction<string>) {
      state.loadingStatus = LOADING;
      state.loadingText = action.payload;
    },
    finishLoading(state) {
      state.loadingStatus = LOADED;
      state.loadingText = "";
    },
    failedLoading(state, action: PayloadAction<string>) {
      state.loadingStatus = FAILED_LOAD;
      state.loadingText = action.payload;
    },

    setShortcutsDisabled(state, action: PayloadAction<boolean>) {
      state.shortcutsDisabled = action.payload;
    },
  },
});

export const { startLoading, finishLoading, failedLoading, setShortcutsDisabled } =
  statusSlice.actions;
export default statusSlice.reducer;
