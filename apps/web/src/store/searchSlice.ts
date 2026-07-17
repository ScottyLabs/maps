import type { StateCreator } from "zustand";
import type { SearchTarget } from "@/types/searchTypes.ts";

export interface SearchSlice {
  isSearchOpen: boolean;
  showSearch: () => void;
  hideSearch: () => void;

  searchTarget?: SearchTarget;
  setSearchTarget: (target?: SearchTarget) => void;
}

export const createSearchSlice: StateCreator<SearchSlice> = (set) => ({
  isSearchOpen: false,
  showSearch: () => set({ isSearchOpen: true }),
  hideSearch: () => set({ isSearchOpen: false }),

  searchTarget: undefined,
  setSearchTarget: (target) => set({ searchTarget: target }),
});
