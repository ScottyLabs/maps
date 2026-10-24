import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { Edit, EditPair } from "./historyTypes.ts";

const MAX_UNDO_LIMIT = 50;

interface HistoryState {
  batchIds: string[];
  editHistory: Edit[];
  reversedEditHistory: Edit[];
  editIndex: number; // index of the edit to undo
}

const initialState: HistoryState = {
  batchIds: [],
  editHistory: [],
  reversedEditHistory: [],
  editIndex: -1,
};

const getUpdatedHistory = <E>(history: E[], edit: E, index: number) => {
  const updatedHistory = [...history.slice(0, index + 1), edit];
  // Trim the history arrays to maintain the maximum undo limit
  return updatedHistory.slice(-MAX_UNDO_LIMIT);
};

const historySlice = createSlice({
  name: "history",
  initialState,
  reducers: {
    setEditIndex(state, action: PayloadAction<number>) {
      state.editIndex = action.payload;
    },

    addEditToHistory(state, action: PayloadAction<EditPair>) {
      const { batchId, edit, reverseEdit } = action.payload;

      // Update the history arrays with the new edit
      state.batchIds = getUpdatedHistory(state.batchIds, batchId, state.editIndex + 1);

      state.editHistory = getUpdatedHistory(state.editHistory, edit, state.editIndex + 1);

      state.reversedEditHistory = getUpdatedHistory(
        state.reversedEditHistory,
        reverseEdit,
        state.editIndex + 1,
      );

      // Update the edit index
      state.editIndex = state.editHistory.length - 1;
    },
  },
});

export const { setEditIndex, addEditToHistory } = historySlice.actions;
export default historySlice.reducer;
