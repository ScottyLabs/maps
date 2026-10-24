/** biome-ignore-all lint/style/useNamingConvention: Building code are in all caps */
const buildingCodeToShapeFillColor = {
  MOE: "#fde047",
  STE: "#307454",
  MUD: "#6900a9",
  MOR: "#FED97B",
  DON: "#0025a9",

  FBA: "#F28B5F",

  SCO: "#a90000",
  WEL: "#a90000",
  BOS: "#a90000",
  MCG: "#a90000",
  HEN: "#a90000",

  HAM: "#6C1515",
  ROS1: "#6C1515",
  ROS2: "#6C1515",
  ROS3: "#6C1515",
  SPT: "#6C1515",
  WOO: "#6C1515",
  MMA: "#6C1515",

  ROF: "#ae12bc",
  FCL: "#ae12bc",

  FAF: "#89177D",
  NVL: "#89177D",
  FIF: "#89177D",
  MC: "#89177D",
  HIL: "#89177D",
  CLY: "#89177D",

  WWG: "#2A2D4B",
  RES: "#2A2D4B",
};

export const getBuildingShapeFillColor = (buildingCode: string) =>
  buildingCodeToShapeFillColor[buildingCode as keyof typeof buildingCodeToShapeFillColor];
