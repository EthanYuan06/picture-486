package com.yuluo.picture486ddd.shared.manager.upload;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.date.DateUtil;
import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.NumberUtil;
import cn.hutool.core.util.RandomUtil;
import com.qcloud.cos.model.PutObjectResult;
import com.qcloud.cos.model.ciModel.persistence.CIObject;
import com.qcloud.cos.model.ciModel.persistence.ImageInfo;
import com.qcloud.cos.model.ciModel.persistence.ProcessResults;
import com.yuluo.picture486ddd.infrastructure.config.CosClientConfig;
import com.yuluo.picture486ddd.infrastructure.exception.BusinessException;
import com.yuluo.picture486ddd.infrastructure.exception.ErrorCode;
import com.yuluo.picture486ddd.infrastructure.exception.ThrowUtils;
import com.yuluo.picture486ddd.infrastructure.api.CosManager;
import com.yuluo.picture486ddd.interfaces.dto.picture.PictureUploadResult;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;

import java.io.File;
import java.io.IOException;
import java.util.Date;
import java.util.List;

@Slf4j
public abstract class PictureUploadTemplate {
    @Resource
    protected CosManager cosManager;

    @Resource
    protected CosClientConfig cosClientConfig;

    /**
     * 模板方法，定义上传流程
     *
     * @param inputSource 文件源
     * @param uploadPathPrefix 上传路径前缀
     * @return 图片信息
     */
    public final PictureUploadResult uploadPicture(Object inputSource, String uploadPathPrefix){
        //校验图片
        validPicture(inputSource);
        //构建图片上传地址
        String uuid = RandomUtil.randomString(16);
        String originFilename = getOriginalFilename(inputSource);
        String uploadFileName = String.format("%s_%s.%s", DateUtil.formatDate(new Date()), uuid, FileUtil.getSuffix(originFilename));
        String uploadPath = String.format("%s/%s", uploadPathPrefix, uploadFileName);
        //上传图片操作
        File file = null;
        try {
            // 创建临时文件
            file = File.createTempFile(uploadPath, null);
            // 处理文件来源（本地或 URL）
            processFile(inputSource, file);
            // 上传图片到对象存储(带图片处理:生成webp)
            PutObjectResult putObjectResult = cosManager.putPictureObject(uploadPath, file);
            ImageInfo imageInfo = putObjectResult.getCiUploadResult().getOriginalInfo().getImageInfo();
            ProcessResults processResults = putObjectResult.getCiUploadResult().getProcessResults();
            List<CIObject> objectList = processResults.getObjectList();
            if (CollUtil.isNotEmpty(objectList)) {
                //获取webp图和缩略图
                //没有进行缩略处理时返回webp图
                CIObject thumbnailCiObject = objectList.get(0);
                //objectList大于1，说明存在webp图和缩略图
                if (objectList.size() > 1) {
                    thumbnailCiObject = objectList.get(1);
                }
                // 封装返回原图、缩略图结果
                return buildResult(imageInfo, originFilename, file, thumbnailCiObject, uploadPath);
            }
            // 只封装原图返回结果
            return buildResult(imageInfo, originFilename, file, uploadPath);
        } catch (Exception e) {
            log.error("图片上传到对象存储失败", e);
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "上传失败");
        }
        finally {
            deleteTempFile(file);
        }
    }

    /**
     * 模板方法：上传原始图片(不进行图片处理,不生成webp)
     * 用于上传到临时目录,等待审核通过后再正式处理
     *
     * @param inputSource 文件源
     * @param uploadPathPrefix 上传路径前缀
     * @return 图片信息(不包含thumbnailUrl)
     */
    public final PictureUploadResult uploadPictureRaw(Object inputSource, String uploadPathPrefix){
        //校验图片
        validPicture(inputSource);
        //构建图片上传地址
        String uuid = RandomUtil.randomString(16);
        String originFilename = getOriginalFilename(inputSource);
        String uploadFileName = String.format("%s_%s.%s", DateUtil.formatDate(new Date()), uuid, FileUtil.getSuffix(originFilename));
        String uploadPath = String.format("%s/%s", uploadPathPrefix, uploadFileName);
        //上传图片操作
        File file = null;
        try {
            // 创建临时文件
            file = File.createTempFile(uploadPath, null);
            // 处理文件来源（本地或 URL）
            processFile(inputSource, file);
            
            // 上传图片到对象存储(使用带图片处理的接口获取元数据,但不保存处理结果)
            PutObjectResult putObjectResult = cosManager.putPictureObject(uploadPath, file);
            ImageInfo imageInfo = putObjectResult.getCiUploadResult().getOriginalInfo().getImageInfo();
            
            log.info("临时上传提取图片元数据成功 - width: {}, height: {}, format: {}", 
                    imageInfo.getWidth(), imageInfo.getHeight(), imageInfo.getFormat());
            
            // 封装返回结果(包含完整的图片元数据)
            PictureUploadResult result = new PictureUploadResult();
            buildOriginalPic(imageInfo, originFilename, file, uploadPath, result);
            // 注意: 不设置thumbnailUrl,等审核通过后再填充
            
            return result;
        } catch (Exception e) {
            log.error("图片上传到对象存储失败", e);
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "上传失败");
        }
        finally {
            deleteTempFile(file);
        }
    }



    /**
     * 校验输入源
     * @param inputSource 输入源
     */
    protected abstract void validPicture(Object inputSource);

    /**
     * 处理文件来源
     * @param inputSource 文件源
     * */
    protected abstract void processFile(Object inputSource, File file) throws IOException, Exception;

    /**
     * 获取原始文件名
     * @param inputSource 文件源
     * @return 原始文件名
     */
    protected abstract String getOriginalFilename(Object inputSource);

    /**
     * 封装返回结果
     * @param imageInfo 图片信息
     * @param originFilename 原始文件名
     * @param file  图片文件
     * @param thumbnailCiObject 缩略图
     * @param uploadPath 上传路径
     * @return 原图url、信息及缩略图url
     */
    private PictureUploadResult buildResult(ImageInfo imageInfo, String originFilename, File file,CIObject thumbnailCiObject, String uploadPath) {
        PictureUploadResult pictureUploadResult = new PictureUploadResult();
        buildOriginalPic(imageInfo, originFilename, file, uploadPath, pictureUploadResult);
        //设置缩略图url
        pictureUploadResult.setThumbnailUrl(cosClientConfig.getHost() + "/" + thumbnailCiObject.getKey());
        return pictureUploadResult;
    }

    /**
     * 封装返回结果
     * @param imageInfo 图片信息
     * @param originFilename 原文件名
     * @param file 文件
     * @param uploadPath 上传路径
     * @return 原图url及信息
     */
    private PictureUploadResult buildResult(ImageInfo imageInfo, String originFilename, File file, String uploadPath) {
        PictureUploadResult pictureUploadResult = new PictureUploadResult();
        buildOriginalPic(imageInfo, originFilename, file, uploadPath, pictureUploadResult);
        return pictureUploadResult;
    }

    /**
     * 删除临时文件
     */
    public void deleteTempFile(File file) {
        if (file == null) {
            return;
        }
        boolean deleteResult = file.delete();
        if (!deleteResult) {
            log.error("file delete error, filepath = {}", file.getAbsolutePath());
        }
    }

    /**
     * 设置原图信息
     * @param imageInfo 图片信息
     * @param originFilename 原始文件名
     * @param file  文件
     * @param uploadPath 上传路径
     * @param pictureUploadResult 图片信息
     */
    private void buildOriginalPic(ImageInfo imageInfo, String originFilename, File file, String uploadPath, PictureUploadResult pictureUploadResult) {
        int picWidth = imageInfo.getWidth();
        int picHeight = imageInfo.getHeight();
        //计算图片比例
        double picScale = NumberUtil.round(picWidth * 1.0 / picHeight, 2).doubleValue();
        //设置属性
        pictureUploadResult.setPicName(FileUtil.mainName(originFilename));
        pictureUploadResult.setPicSize(FileUtil.size(file));
        pictureUploadResult.setPicWidth(picWidth);
        pictureUploadResult.setPicHeight(picHeight);
        pictureUploadResult.setPicScale(picScale);
        pictureUploadResult.setPicFormat(imageInfo.getFormat());
        pictureUploadResult.setUrl(cosClientConfig.getHost() + "/" + uploadPath);
    }
}
