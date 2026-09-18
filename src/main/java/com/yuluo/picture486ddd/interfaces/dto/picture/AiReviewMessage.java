package com.yuluo.picture486ddd.interfaces.dto.picture;

import lombok.Data;

import java.io.Serializable;

/**
 * AI审核消息DTO
 * 用于发送图片审核任务到RabbitMQ队列
 */
@Data
public class AiReviewMessage implements Serializable {

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
     * 图片URL(COS临时目录)
     */
    private String url;

    /**
     * API Key(用于AI鉴权)
     */
    private String apiKey;

    /**
     * 消息时间戳
     */
    private Long timestamp;
}
