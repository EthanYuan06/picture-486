package com.yuluo.picture486ddd.domain.picture.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.yuluo.picture486ddd.domain.picture.entity.Picture;

import com.baomidou.mybatisplus.extension.service.IService;
import com.yuluo.picture486ddd.domain.user.entity.User;
import com.yuluo.picture486ddd.interfaces.vo.picture.PictureVo;
import com.yuluo.picture486ddd.interfaces.dto.picture.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * @author 东山羽洛
 */
public interface PictureDomainService extends IService<Picture> {
    /**
     * 上传图片
     * @param inputSource 输入源
     * @param pictureUploadRequest 图片上传请求
     * @param loginUser 登录用户（判断权限用）
     * @return 图片信息
     */
    PictureVo uploadPicture(Object inputSource, PictureUploadRequest pictureUploadRequest, User loginUser);

    /**
     * 获取查询条件
     *
     * @param pictureQueryRequest 查询条件
     * @return 查询条件
     */
    QueryWrapper<Picture> getQueryWrapper(PictureQueryRequest pictureQueryRequest);

    /**
     * 获取单个图片信息
     *
     * @param picture 图片
     * @param request 请求
     * @return 图片信息
     */
    PictureVo getPictureVo(Picture picture, HttpServletRequest request);

    /**
     * 获取图片分页列表
     *
     * @param picturePage 图片分页
     * @param request 请求
     * @return 图片列表
     */
    Page<PictureVo> getPictureVoPage(Page<Picture> picturePage, HttpServletRequest request);

    /**
     * 图片数据校验
     * 用于更新和修改图片时判断
     * @param picture 图片信息
     */
    void validPicture(Picture picture);

    /**
     * 图片审核
     *
     * @param pictureReviewRequest 图片审核请求
     * @param loginUser 登录用户
     */
    void doPictureReview(PictureReviewRequest pictureReviewRequest, User loginUser);

    /**
     * 批量图片审核
     *
     * @param pictureReviewByBatchRequest 图片批量审核请求
     * @param loginUser                   登录用户
     */
    void doPictureReviewByBatch(PictureReviewByBatchRequest pictureReviewByBatchRequest, User loginUser);

    /**
     * 填充图片审核参数
     *
     * @param picture 图片信息
     * @param loginUser 登录用户
     */
    void fillReviewPictureParams(Picture picture, User loginUser);

    /**
     * 清理图片文件
     *
     * @param oldPicture 旧图片信息
     */
    void clearPictureFile(Picture oldPicture);

    /**
     * 校验图片权限
     *
     * @param picture 图片信息
     * @param loginUser 登录用户
     */
    void checkPictureAuth(User loginUser, Picture picture);

    /**
     * 删除图片
     *
     * @param pictureId 图片ID
     * @param loginUser 登录用户
     */
    void deletePicture(long pictureId, User loginUser);

    /**
     * 修改图片
     *
     * @param pictureEditRequest 图片修改请求
     * @param loginUser 登录用户
     */
    void editPicture(PictureEditRequest pictureEditRequest, User loginUser);

    /**
     * 批量编辑图片
     *
     * @param pictureEditByBatchRequest 图片批量修改请求
     * @param loginUser 登录用户
     */
    void editPictures(PictureEditByBatchRequest pictureEditByBatchRequest, User loginUser);

    /**
     * 批量上传图片
     *
     * @param multipartFiles 图片文件
     * @param pictureUploadRequest 图片上传请求
     * @param loginUser 登录用户
     * @return 图片信息
     */
    List<PictureVo> uploadPictures(MultipartFile[] multipartFiles, PictureUploadRequest pictureUploadRequest, User loginUser);

    /**
     * 批量删除图片
     *
     * @param pictureIds 图片ID列表
     * @param loginUser 登录用户
     * @return 是否删除成功
     */
    Boolean deletePictures(List<Long> pictureIds, User loginUser);

    /**
     * 获取图片ID列表
     *
     * @param spaceId 空间ID
     * @return 图片ID列表
     */
    List<Long> getPictureIds(Long spaceId);

    /**
     * 上传相册封面
     *
     * @param file 图片文件
     * @param id 图片ID
     * @param loginUser 登录用户
     */
    void uploadCover(MultipartFile file, Long id, User loginUser);

    void updatePicture(Picture picture, HttpServletRequest request);

    Picture getPictureById(long id);
}
