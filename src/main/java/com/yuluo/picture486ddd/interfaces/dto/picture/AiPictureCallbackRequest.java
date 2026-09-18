package com.yuluo.picture486ddd.interfaces.dto.picture;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * AI微服务回调请求DTO
 */
@Data
public class AiPictureCallbackRequest implements Serializable {
    
    /**
     * 用户ID
     */
    private Long userId;
    
    /**
     * 相册ID（null表示公共图库）
     */
    private Long spaceId;
    
    /**
     * 图片URL（COS临时目录地址）
     */
    private String url;
    
    /**
     * AI生成的图片名称
     */
    private String name;
    
    /**
     * AI生成的简介
     */
    private String introduction;
    
    /**
     * AI生成的分类
     */
    private String category;
    
    /**
     * AI生成的标签列表
     */
    private List<String> tags;
    
    /**
     * API密钥（用于鉴权）
     */
    private String apiKey;
    
    private static final long serialVersionUID = 1L;
}
