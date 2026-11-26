package com.yuluo.picture486ddd.infrastructure.config;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.io.StringReader;

/**
 * Redisson 配置类
 * 只使用 Redisson 核心包提供分布式锁（RedissonClient），不引入 redisson-spring-boot-starter：
 * starter 会自动注册 RedissonConnectionFactory 顶掉 Lettuce 成为 spring-data-redis 默认连接工厂，
 * 而 Redisson 3.23.5 的 spring-data 适配层与 Spring Data Redis 3.5 存在 pExpire 默认方法互递归问题，
 * 任何 expire(Duration) 调用都会抛 StackOverflowError（Sa-Token 写会话即触发，导致登录 500）。
 * 配置内容复用各环境 application-{profile}.yml 中的 spring.redisson.config。
 */
@Configuration
public class RedissonConfig {

    @Value("${spring.redisson.config}")
    private String redissonConfig;

    @Bean(destroyMethod = "shutdown")
    public RedissonClient redissonClient() throws IOException {
        Config config = Config.fromYAML(new StringReader(redissonConfig));
        return Redisson.create(config);
    }
}
