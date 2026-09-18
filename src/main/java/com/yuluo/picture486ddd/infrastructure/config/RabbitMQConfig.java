package com.yuluo.picture486ddd.infrastructure.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ配置类
 * 用于AI图片审核消息队列
 */
@Configuration
public class RabbitMQConfig {

    // ==================== 交换机配置 ====================
    
    /**
     * AI审核交换机
     */
    public static final String AI_REVIEW_EXCHANGE = "ai-review-exchange";
    
    /**
     * 死信交换机
     */
    public static final String DLX_EXCHANGE = "dlx-exchange";

    // ==================== 队列配置 ====================
    
    /**
     * AI审核主队列
     */
    public static final String AI_REVIEW_QUEUE = "ai-review-queue";
    
    /**
     * 死信队列
     */
    public static final String DLX_QUEUE = "ai-review-dlx";

    // ==================== Routing Key配置 ====================
    
    /**
     * AI审核路由键
     */
    public static final String AI_REVIEW_ROUTING_KEY = "ai.review";
    
    /**
     * 死信路由键
     */
    public static final String DLX_ROUTING_KEY = "ai.review.dlx";

    // ==================== Bean定义 ====================
    
    /**
     * 创建AI审核交换机(Direct类型)
     */
    @Bean
    public DirectExchange aiReviewExchange() {
        return new DirectExchange(AI_REVIEW_EXCHANGE, true, false);
    }
    
    /**
     * 创建死信交换机(Direct类型)
     */
    @Bean
    public DirectExchange dlxExchange() {
        return new DirectExchange(DLX_EXCHANGE, true, false);
    }
    
    /**
     * 创建AI审核主队列
     * 配置:
     * - durable: true (持久化)
     * - x-dead-letter-exchange: 死信交换机
     * - x-dead-letter-routing-key: 死信路由键
     * - x-message-ttl: 30秒超时进死信
     */
    @Bean
    public Queue aiReviewQueue() {
        return QueueBuilder.durable(AI_REVIEW_QUEUE)
                .withArgument("x-dead-letter-exchange", DLX_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", DLX_ROUTING_KEY)
                .withArgument("x-message-ttl", 30000) // 30秒
                .build();
    }
    
    /**
     * 创建死信队列
     */
    @Bean
    public Queue dlxQueue() {
        return QueueBuilder.durable(DLX_QUEUE).build();
    }
    
    /**
     * 绑定AI审核队列到交换机
     */
    @Bean
    public Binding aiReviewBinding() {
        return BindingBuilder.bind(aiReviewQueue())
                .to(aiReviewExchange())
                .with(AI_REVIEW_ROUTING_KEY);
    }
    
    /**
     * 绑定死信队列到死信交换机
     */
    @Bean
    public Binding dlxBinding() {
        return BindingBuilder.bind(dlxQueue())
                .to(dlxExchange())
                .with(DLX_ROUTING_KEY);
    }

    // ==================== 消息转换器配置 ====================

    /**
     * 配置 RabbitMQ 消息转换器为 JSON 格式
     * 用于跨语言通信(Java -> Python),确保消息以 UTF-8 JSON 格式发送
     */
    @Bean
    public MessageConverter jsonMessageConverter() {
        ObjectMapper objectMapper = new ObjectMapper();
        // 注册 Java 8 时间模块(支持 LocalDateTime 等)
        objectMapper.registerModule(new JavaTimeModule());
        // 禁用将日期写为时间戳,使用 ISO-8601 格式
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        return new Jackson2JsonMessageConverter(objectMapper);
    }

    /**
     * 配置 RabbitTemplate 使用 JSON 转换器
     * 确保所有通过 RabbitTemplate 发送的消息都序列化为 JSON 格式
     */
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         MessageConverter messageConverter) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(messageConverter);
        return rabbitTemplate;
    }
}
