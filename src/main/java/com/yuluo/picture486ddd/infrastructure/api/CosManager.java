package com.yuluo.picture486ddd.infrastructure.api;

import cn.hutool.core.io.FileUtil;
import com.qcloud.cos.COSClient;
import com.qcloud.cos.model.COSObject;
import com.qcloud.cos.model.GetObjectRequest;
import com.qcloud.cos.model.PutObjectRequest;
import com.qcloud.cos.model.PutObjectResult;
import com.qcloud.cos.model.ciModel.persistence.PicOperations;
import com.yuluo.picture486ddd.infrastructure.config.CosClientConfig;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

@Component
@Slf4j
public class CosManager {

    @Resource
    private CosClientConfig cosClientConfig;

    @Resource
    private COSClient cosClient;

    /**
     * 上传对象（返回图片信息）
     * 上传时将图片转换为webp格式，以相对质量85保存
     * 
     * @param key  唯一键
     * @param file 文件
     */
    public PutObjectResult putPictureObject(String key, File file) {
        PutObjectRequest putObjectRequest = new PutObjectRequest(cosClientConfig.getBucket(), key,
                file);
        // 对图片进行处理（获取基本信息也被视作为一种处理）
        PicOperations picOperations = new PicOperations();
        // 1 表示返回原图信息
        picOperations.setIsPicInfo(1);
        List<PicOperations.Rule> rules = new ArrayList<>();
        // 图片压缩（转成 webp 格式）
        String webpKey = FileUtil.mainName(key) + ".webp";
        PicOperations.Rule compressRule = new PicOperations.Rule();
        compressRule.setRule("imageMogr2/format/webp/rquality/85");
        compressRule.setBucket(cosClientConfig.getBucket());
        compressRule.setFileId(webpKey);
        rules.add(compressRule);
        // 缩略图处理，只处理大于20kB的图片
//        if (file.length() > 2 * 1024) {
//            PicOperations.Rule thumbnailRule = new PicOperations.Rule();
//            thumbnailRule.setBucket(cosClientConfig.getBucket());
//            String thumbnailKey = FileUtil.mainName(key) + "_thumbnail." + FileUtil.getSuffix(key);
//            thumbnailRule.setFileId(thumbnailKey);
//            // 缩放规则（如果大于原图宽高，则不处理，此操作不会影响前端图片比例）
//            thumbnailRule.setRule(String.format("imageMogr2/thumbnail/%sx%s>", 300, 300));
//            rules.add(thumbnailRule);
//        }
        // 构造处理参数
        picOperations.setRules(rules);
        putObjectRequest.setPicOperations(picOperations);
        return cosClient.putObject(putObjectRequest);
    }

    /**
     * 上传原始对象，不做图片处理
     *
     * @param key  唯一键
     * @param file 文件
     */
    public PutObjectResult putObject(String key, File file) {
        PutObjectRequest putObjectRequest = new PutObjectRequest(cosClientConfig.getBucket(), key, file);
        return cosClient.putObject(putObjectRequest);
    }

    /**
     * 下载对象
     *
     * @param key 唯一键
     */
    public COSObject getPictureObject(String key) {
        GetObjectRequest getObjectRequest = new GetObjectRequest(cosClientConfig.getBucket(), key);
        return cosClient.getObject(getObjectRequest);
    }

    /**
     * 删除对象
     *
     * @param key 唯一键
     */
    public void deleteObject(String key) {
        try {
            // 从完整URL中提取对象key
            String objectKey = key;
            if (key.startsWith("http")) {
                // 提取路径部分作为对象key
                objectKey = key.substring(key.indexOf("/", 8) + 1); // 跳过 "https://"
            }
            cosClient.deleteObject(cosClientConfig.getBucket(), objectKey);
        } catch (Exception e) {
            throw new RuntimeException("删除COS对象失败: " + key, e);
        }
    }

    /**
     * 移动文件(下载+重新上传触发图片处理)
     * 从源位置下载文件,重新上传到目标位置并触发COS图片处理(生成webp)
     *
     * @param sourceUrl 源文件URL或key
     * @param targetPrefix 目标目录前缀(如: space/123 或 public/456)
     * @return 目标文件的完整URL(原图)
     */
    public String moveFile(String sourceUrl, String targetPrefix) {
        File tempFile = null;
        try {
            // 1. 从URL提取源key和文件名
            String sourceKey = sourceUrl;
            if (sourceUrl.startsWith("http")) {
                sourceKey = sourceUrl.substring(sourceUrl.indexOf("/", 8) + 1);
            }
            
            // 提取文件名(保留原始文件名)
            String fileName = sourceKey.substring(sourceKey.lastIndexOf("/") + 1);
            
            // 2. 构建目标key
            String targetKey = targetPrefix + "/" + fileName;
            
            log.info("开始移动COS文件(下载+重新上传) - sourceKey: {}, targetKey: {}", sourceKey, targetKey);
            
            // 3. 下载源文件到临时文件
            GetObjectRequest getObjectRequest = new GetObjectRequest(cosClientConfig.getBucket(), sourceKey);
            COSObject cosObject = cosClient.getObject(getObjectRequest);
            
            // 创建临时文件
            tempFile = File.createTempFile("cos_move_", "_" + fileName);
            // 下载文件内容
            java.io.InputStream inputStream = cosObject.getObjectContent();
            FileUtil.writeFromStream(inputStream, tempFile);
            
            log.info("源文件下载成功 - sourceKey: {}, tempFile: {}", sourceKey, tempFile.getAbsolutePath());
            
            // 4. 重新上传到目标位置(触发图片处理生成webp)
            this.putPictureObject(targetKey, tempFile);
            
            log.info("文件重新上传成功(已触发图片处理) - targetKey: {}", targetKey);
            
            // 5. 删除源文件
            cosClient.deleteObject(cosClientConfig.getBucket(), sourceKey);
            
            log.info("源文件删除成功 - sourceKey: {}", sourceKey);
            
            // 6. 返回目标文件的完整URL(原图)
            String targetUrl = cosClientConfig.getHost() + "/" + targetKey;
            return targetUrl;
            
        } catch (Exception e) {
            log.error("移动COS文件失败 - sourceUrl: {}, targetPrefix: {}", sourceUrl, targetPrefix, e);
            throw new RuntimeException("移动COS文件失败: " + sourceUrl, e);
        } finally {
            // 清理临时文件
            if (tempFile != null && tempFile.exists()) {
                try {
                    FileUtil.del(tempFile);
                    log.debug("临时文件已清理 - tempFile: {}", tempFile.getAbsolutePath());
                } catch (Exception e) {
                    log.warn("清理临时文件失败 - tempFile: {}", tempFile.getAbsolutePath(), e);
                }
            }
        }
    }
}
