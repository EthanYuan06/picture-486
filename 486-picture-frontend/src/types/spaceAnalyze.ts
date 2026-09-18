export interface SpaceAnalyzeRequest {
  spaceId?: number | string;
  queryPublic?: boolean;
  queryAll?: boolean;
}

export interface SpaceUsageAnalyzeResponse {
  usedSize: number;
  maxSize?: number;
  sizeUsageRatio?: number;
  usedCount: number;
  maxCount?: number;
  countUsageRatio?: number;
  pendingCount?: string;
}

export interface SpaceCategoryAnalyzeResponse {
  category: string;
  count: number;
  totalSize: number;
}

export interface SpaceTagAnalyzeResponse {
  tag: string;
  count: number;
}

export interface SpaceSizeAnalyzeResponse {
  sizeRange: string;
  count: number;
}

export interface SpaceUserAnalyzeRequest extends SpaceAnalyzeRequest {
  userId?: number | string;
  timeDimension: 'day' | 'week' | 'month';
}

export interface SpaceUserAnalyzeResponse {
  period: string;
  count: number;
}
