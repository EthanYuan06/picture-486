
import type { User } from '../types';

export enum SpaceRole {
  VIEWER = 'viewer',
  EDITOR = 'editor',
  ADMIN = 'admin',
}

export interface SpaceUser {
  id: string;
  spaceId: string;
  userId: string;
  spaceRole: string;
  createTime: string;
  updateTime?: string;
  user?: User;
}

export interface SpaceUserAddRequest {
  spaceId: string;
  userId: string;
  spaceRole: string;
}

export interface SpaceUserQueryRequest {
  spaceId: string;
  userId?: string;
}

export interface SpaceUserEditRequest {
  id: string;
  spaceRole: string;
}
