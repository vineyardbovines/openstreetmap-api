export type OverpassElement = OverpassNode | OverpassWay | OverpassRelation;

export enum OverpassElementType {
  Node = "node",
  Way = "way",
  Relation = "relation",
}

interface BaseElement {
  type: OverpassElementType | `${OverpassElementType}`;
  id: number;
}

export interface OverpassOSMElement extends BaseElement {
  type: OverpassElementType.Node | OverpassElementType.Way | OverpassElementType.Relation;
  timestamp?: string;
  version?: string;
  changeset?: string;
  user?: string;
  uid?: string;
  tags?: Record<string, string>;
}

export interface OverpassNode extends OverpassOSMElement {
  type: OverpassElementType.Node;
  lat: number;
  lon: number;
}

export interface OverpassWay extends OverpassOSMElement {
  type: OverpassElementType.Way;
  nodes: number[];
  center?: OverpassPoint;
  bounds?: OverpassBbox;
  geometry?: OverpassPoint[];
}

export interface OverpassRelation extends OverpassOSMElement {
  type: OverpassElementType.Relation;
  members: OverpassRelationMember[];
  center?: OverpassPoint;
  bounds?: OverpassBbox;
  geometry?: OverpassPoint[];
}

export interface OverpassRelationMember {
  type: OverpassElementType.Node | OverpassElementType.Way | OverpassElementType.Relation;
  ref: number;
  role: string;
  lat?: number;
  lon?: number;
  geometry?: OverpassPoint[];
}

interface OverpassPoint {
  lat: number;
  lon: number;
}

interface OverpassBbox {
  minlat: number;
  minlon: number;
  maxlat: number;
  maxlon: number;
}
