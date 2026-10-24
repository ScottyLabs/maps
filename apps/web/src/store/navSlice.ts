import type { StateCreator } from "zustand";
import type { Instruction, NavPaths, NavPathType } from "@/types/navTypes.ts";

export interface NavSlice {
  isNavigating: boolean;
  navPaths: NavPaths;
  navInstructionIndex: number;
  navInstructions?: Instruction[];
  selectedPath: NavPathType;
  setNavInstructionIndex: (index: number) => void;
  setNavInstructions: (instructions: Instruction[]) => void;
  setNavPaths: (path: NavPaths) => void;
  setSelectedPath: (path: NavPathType) => void;
  startNav: () => void;
  endNav: () => void;
}

export const createNavSlice: StateCreator<NavSlice> = (set) => ({
  isNavigating: false,
  navPaths: {},
  navInstructionIndex: 0,
  navInstructions: undefined,
  selectedPath: "Fastest",
  setNavInstructionIndex: (index: number) => set({ navInstructionIndex: index }),
  setNavInstructions: (instructions: Instruction[]) => set({ navInstructions: instructions }),
  setNavPaths: (path: NavPaths) => set({ navPaths: path }),
  setSelectedPath: (path: NavPathType) => set({ selectedPath: path }),
  startNav: () => set({ isNavigating: true }),
  endNav: () => set({ isNavigating: false, navInstructionIndex: 0 }),
});
