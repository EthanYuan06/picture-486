export enum PictureReviewStatus {
  REVIEWING = 0,
  PASS = 1,
  REJECT = 2,
}

export interface Picture {
  id: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
  introduction?: string;
  tags?: string[] | string;
  category?: string;
  picSize?: number;
  picWidth?: number;
  picHeight?: number;
  picFormat?: string;
  userId: string;
  spaceId?: string;
  reviewStatus: PictureReviewStatus;
  reviewMessage?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewTime?: string;
  createTime: string;
  editTime?: string;
  updateTime?: string;
  user?: {
    id: string;
    userName: string;
    userAvatar?: string;
  };
}

export interface PictureQueryRequest {
  current?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: string;
  searchText?: string;
  reviewStatus?: number;
  category?: string;
  tags?: string[];
  spaceId?: string;
  nullSpaceId?: boolean;
  userId?: string;
}

export interface PictureReviewSingleRequest {
  id: string;
  reviewStatus: PictureReviewStatus;
  reviewMessage?: string;
}

export interface PictureReviewBatchRequest {
  idList: string[];
  reviewStatus: PictureReviewStatus;
  reviewMessage?: string;
}

export interface PictureDeleteRequest {
  id: string;
}

export interface PictureDeleteBatchRequest {
  ids: string[];
}

export interface PictureEditRequest {
  id: string;
  spaceId?: string;
  name?: string;
  introduction?: string;
  category?: string;
  tags?: string[];
}

export interface PictureEditBatchRequest {
  pictureIdList: string[];
  spaceId?: string;
  category?: string;
  tags?: string[];
  nameRule?: string;
}

export interface Page<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}
