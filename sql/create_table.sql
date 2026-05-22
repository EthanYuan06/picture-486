-- 数据库创建
create database if not exists 486_picture;

-- 数据库选择
use 486_picture;

create table user
(
    id           bigint auto_increment comment 'id'
        primary key,
    userAccount  varchar(256)                           not null comment '账号',
    userEmail    varchar(36)                            not null comment '邮箱',
    userPassword varchar(512)                           not null comment '密码',
    userName     varchar(256)                           null comment '用户昵称',
    userAvatar   varchar(1024)                          null comment '用户头像',
    userProfile  varchar(512)                           null comment '用户简介',
    userRole     varchar(256) default 'user'            not null comment '用户角色：user/admin',
    createTime   datetime     default CURRENT_TIMESTAMP not null comment '创建时间',
    editTime     datetime default CURRENT_TIMESTAMP not null comment '编辑时间',
    updateTime   datetime     default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    isDelete     tinyint      default 0                 not null comment '是否删除',
    constraint uk_userAccount
        unique (userAccount)
)
    comment '用户' collate = utf8mb4_unicode_ci;

create index idx_userName
    on user (userName);

-- 图片表
create table if not exists picture
(
    id           bigint auto_increment comment 'id' primary key,
    url          varchar(512)                       not null comment '图片 url',
    thumbnailUrl varchar(512)                       null comment '缩略图 url',
    name         varchar(128)                       not null comment '图片名称',
    introduction varchar(512)                       null comment '简介',
    category     varchar(64)                        null comment '分类',
    tags         varchar(512)                      null comment '标签（JSON 数组）',
    picSize      bigint                             null comment '图片体积',
    picWidth     int                                null comment '图片宽度',
    picHeight    int                                null comment '图片高度',
    picScale     double                             null comment '图片宽高比例',
    picFormat    varchar(32)                        null comment '图片格式',
    userId       bigint                             not null comment '创建用户 id',
    spaceId      bigint                             null comment '空间 id（为空表示公共空间）',
    createTime   datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    editTime     datetime default CURRENT_TIMESTAMP not null comment '编辑时间',
    updateTime   datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    reviewStatus  int      default 0                 not null comment '审核状态：0-待审核; 1-通过; 2-拒绝',
    reviewMessage varchar(512)                       null comment '审核信息',
    reviewerId    bigint                             null comment '审核人 ID',
    reviewTime    datetime                           null comment '审核时间',
    isDelete     tinyint  default 0                 not null comment '是否删除',
    INDEX idx_name (name),                 -- 提升基于图片名称的查询性能
    INDEX idx_introduction (introduction), -- 用于模糊搜索图片简介
    INDEX idx_category (category),         -- 提升基于分类的查询性能
    INDEX idx_tags (tags),                 -- 提升基于标签的查询性能
    INDEX idx_userId (userId),              -- 提升基于用户 ID 的查询性能
    INDEX idx_reviewStatus (reviewStatus),  -- 提升基于审核状态的查询性能
    INDEX idx_spaceId (spaceId)             -- 提升基于空间 ID 的查询性能
) comment '图片' collate = utf8mb4_unicode_ci;

-- 空间表
create table if not exists space
(
    id         bigint auto_increment comment 'id' primary key,
    spaceName  varchar(128)                       null comment '空间名称',
    spaceDesc   varchar(512)                       null comment '空间描述',
    spaceLevel int      default 0                 null comment '空间级别：0-普通版 1-专业版 2-旗舰版',
    maxSize    bigint   default 0                 null comment '空间图片的最大总大小',
    maxCount   bigint   default 0                 null comment '空间图片的最大数量',
    totalSize  bigint   default 0                 null comment '当前空间下图片的总大小',
    totalCount bigint   default 0                 null comment '当前空间下的图片数量',
    userId     bigint                             not null comment '创建用户 id',
    spaceCover varchar(512)                      null comment '空间封面',
    createTime datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    editTime   datetime default CURRENT_TIMESTAMP not null comment '编辑时间',
    updateTime datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    isDelete   tinyint  default 0                 not null comment '是否删除',
    spaceType  int      default 0                 null comment '空间类型：0-个人空间 1-团队空间',
    -- 索引设计
    index idx_userId (userId),        -- 提升基于用户的查询效率
    index idx_spaceName (spaceName),  -- 提升基于空间名称的查询效率
    index idx_spaceLevel (spaceLevel) -- 提升按空间级别查询的效率
) comment '空间' collate = utf8mb4_unicode_ci;

-- 空间用户关联表
create table space_user
(
    id         bigint auto_increment comment 'id'
        primary key,
    spaceId    bigint                                 not null comment '空间 id',
    userId     bigint                                 not null comment '用户 id',
    spaceRole  varchar(128) default 'viewer'          null comment '空间角色：viewer/editor/admin',
    createTime datetime     default CURRENT_TIMESTAMP not null comment '创建时间',
    updateTime datetime     default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint uk_spaceId_userId
        unique (spaceId, userId)
)
    comment '空间用户关联' engine = InnoDB
                           collate = utf8mb4_unicode_ci;

create index idx_spaceId
    on space_user (spaceId);

create index idx_userId
    on space_user (userId);

-- 系统消息表
create table sys_message
(
    id            bigint auto_increment comment '主键ID'
        primary key,
    receiveUserId bigint                              not null comment '接收用户ID',
    title         varchar(255)                        not null comment '消息标题',
    content       varchar(1000)                       null comment '消息内容',
    type          tinyint   default 0                 not null comment '消息类型（0-系统通知 1-用户消息等）',
    status        tinyint   default 0                 not null comment '消息状态（0-未读 1-已读 2-已删除）',
    createTime    timestamp default CURRENT_TIMESTAMP null comment '创建时间',
    updateTime    timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP comment '更新时间',
    isDelete      tinyint   default 0                 not null comment '是否删除（0-未删除 1-已删除）'
)
    comment '系统消息表' collate = utf8mb4_unicode_ci;

create index idx_create_time
    on sys_message (createTime);

create index idx_receive_user_id
    on sys_message (receiveUserId);

create index idx_status
    on sys_message (status);

