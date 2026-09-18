-- ============================================================
-- 多级缓存性能测试 - 测试数据准备脚本
-- ============================================================
-- 用途：插入 2000 条公共图库测试数据，用于压测 L1/L2/DB 三层缓存性能
-- 执行前：确保已备份数据库或在测试环境执行
-- 执行后：运行 jmeter/cache_perf_test.py 进行压测
-- ============================================================

-- MySQL 8+ 递归 CTE 默认深度 1000，需要调大
SET SESSION cte_max_recursion_depth = 5000;

-- ============================================================
-- 第一步：查看现有用户 ID（用于分配 userId）
-- ============================================================
-- SELECT id, userAccount, userName, userRole FROM user WHERE isDelete = 0 LIMIT 20;

-- ============================================================
-- 第二步：插入 2000 条测试图片数据
-- ============================================================
INSERT INTO picture (
    url, thumbnailUrl, name, introduction, category, tags,
    picSize, picWidth, picHeight, picScale, picFormat,
    userId, spaceId, reviewStatus, reviewMessage, isDelete, is_vectorized
)
WITH RECURSIVE seq AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM seq WHERE n < 2000
)
SELECT
    -- 图片 URL（使用你提供的真实 COS 地址，所有记录相同）
    'https://yuluo-picture-1383397986.cos.ap-guangzhou.myqcloud.com/public/2028102956163760129/2026-03-01_GzqL2BklN8kekA26.jpg' AS url,
    'https://yuluo-picture-1383397986.cos.ap-guangzhou.myqcloud.com/public/2028102956163760129/2026-03-01_GzqL2BklN8kekA26.webp' AS thumbnailUrl,

    -- 名称：带序号，避免完全相同导致索引/排序走捷径
    CONCAT('压测图片_', LPAD(n, 4, '0')) AS name,

    -- 简介：带序号 + 足够长度，让 JSON 序列化更真实
    CONCAT('这是第', n, '张压测图片的简介，用于验证 Caffeine L1 + Redis L2 多级缓存架构在高并发分页查询场景下的性能表现。图片内容为动漫风格壁纸，适合前端展示和检索测试。') AS introduction,

    -- 分类：5 种轮询，命中 idx_category 索引
    ELT((n MOD 5) + 1, '素材', '二次元', '回忆', '旅游', '模板') AS category,

    -- 标签：4 种组合轮询
    CASE (n MOD 4)
        WHEN 0 THEN '["动漫","壁纸"]'
        WHEN 1 THEN '["风景","日本旅行"]'
        WHEN 2 THEN '["表情","二次元"]'
        ELSE '["壁纸","素材"]'
    END AS tags,

    -- 图片元信息：轻微变化，避免完全一致
    170000 + (n MOD 50) * 1000 AS picSize,
    1920 AS picWidth,
    1280 AS picHeight,
    1.5 AS picScale,
    'jpg' AS picFormat,

    -- userId：10 个不同用户轮询（验证 N+1 优化的批量查询路径）
    -- 注意：如果 user 表中没有 id=1~10 的用户，VO 中 user 字段会是 null，不影响压测
    (n MOD 10) + 1 AS userId,

    -- spaceId=NULL 表示公共图库，与测试脚本查询条件匹配
    NULL AS spaceId,

    -- 审核状态：1=通过（必须过审才会被 /list/page/vo 查到）
    1 AS reviewStatus,
    '通过' AS reviewMessage,

    -- 逻辑删除：0=未删除
    0 AS isDelete,

    -- 向量化标记：0=未向量化（避免被 AI 定时任务扫到）
    0 AS is_vectorized
FROM seq;

-- ============================================================
-- 第三步：验证插入结果
-- ============================================================
SELECT COUNT(*) AS total_test_rows FROM picture WHERE name LIKE '压测图片\_%';
SELECT COUNT(*) AS total_public_passed FROM picture WHERE spaceId IS NULL AND reviewStatus = 1 AND isDelete = 0;

-- ============================================================
-- 清理脚本（测试完成后执行）
-- ============================================================
DELETE FROM picture WHERE name LIKE '压测图片\_%';

