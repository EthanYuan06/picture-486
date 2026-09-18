package com.yuluo.picture486ddd.interfaces.dto.picture;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * AI审核回调请求DTO
 * AI模块审核完成后回调后端的数据格式
 */
@Data
public class AiReviewCallbackRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 图片ID
     */
    private Long pictureId;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 审核状态: 1-通过 2-拒绝 3-存疑
     */
    private Integer reviewStatus;

    /**
     * 审核备注
     */
    private String reviewMessage;

    // ========== 以下智能字段均为必填(项目规范) ==========

    /**
     * 图片名称(智能生成)
     */
    private String name;

    /**
     * 图片简介(50-500字)
     */
    private String introduction;

    /**
     * 图片分类
     */
    private String category;

    /**
     * 标签列表(3-10个关键词)
     */
    private List<String> tags;

    /**
     * 审核时间戳
     */
    private Long reviewTimestamp;
}
