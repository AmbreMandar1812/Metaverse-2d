export type Space = {
  id: string;
  name: string;
  thumbnail: string | null;
  dimensions: string;
  creatorId: string;
};

export type Element = {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  static: boolean;
};

export type SpaceElement = {
  id: string;
  element: Element;
  x: number;
  y: number;
};

export type SpaceDetails = Space & {
  dimensions: string;
  elements: SpaceElement[];
};
