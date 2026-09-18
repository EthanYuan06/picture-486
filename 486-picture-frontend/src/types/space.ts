import { User } from '../types';

/**
 * 相册等级枚举
 * 0: 普通版
 * 1: 专业版
 * 2: 旗舰版
 */
export enum SpaceLevel {
  COMMON = 0,
  PROFESSIONAL = 1,
  FLAGSHIP = 2,
}

/**
 * 相册类型枚举
 * 0: 个人相册
 * 1: 多人相册
 */
export enum SpaceType {
  PRIVATE = 0,
  TEAM = 1,
}

export interface SpaceLevelOption {
  value: number;
  text: string;
  maxCount: number;
  maxSize: number;
}

/**
 * 相册视图对象
 */
export interface Space {
  id: string;
  spaceName: string;
  spaceCover?: string;
  spaceDesc?: string;
  spaceLevel: number;
  spaceType?: number;
  maxSize: number;
  maxCount: number;
  totalSize: number;
  totalCount: number;
  userId: number;
  createTime: string;
  editTime: string;
  updateTime: string;
  user?: User;
}

/**
 * 更新相册请求参数
 */
export interface SpaceUpdateRequest {
  id: string;
  spaceName?: string;
  spaceLevel?: number;
  spaceCover?: string;
  spaceDesc?: string;
  spaceType?: number;
}

/**
 * 创建相册请求参数
 */
export interface SpaceAddRequest {
  spaceName?: string;
  spaceLevel?: number;
  spaceType?: number;
}

/**
 * 查询相册请求参数
 */
export interface SpaceQueryRequest {
  current?: number;
  pageSize?: number;
  id?: string | number | null;
  spaceId?: string | number | null;
  userId?: string | number | null;
  spaceName?: string | null;
  spaceLevel?: number | null;
  spaceType?: number | null;
}

/**
 * 分页响应结构
 */
export interface Page<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}
