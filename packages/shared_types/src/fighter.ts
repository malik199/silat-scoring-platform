export interface Fighter {
  id: string;
  name: string;
  /** "red" | "blue" corner designation */
  corner: "red" | "blue";
  weightClass: string;
  clubName: string;
}
