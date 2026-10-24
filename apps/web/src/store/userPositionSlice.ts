import type { StateCreator } from "zustand";

export interface UserPositionSlice {
  userPosition: GeolocationPosition | null;
  setUserPosition: (userPosition: GeolocationPosition | null) => void;
}

export const createUserPositionSlice: StateCreator<UserPositionSlice> = (set) => ({
  userPosition: null,
  setUserPosition: (userPosition: GeolocationPosition | null) => set({ userPosition }),
});
