package com.yuluo.picture486ddd.application.service.impl;

import cn.hutool.core.collection.CollUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.yuluo.picture486ddd.domain.message.service.MessageDomainService;

import com.yuluo.picture486ddd.shared.manager.auth.SpaceUserAuthManager;
import com.yuluo.picture486ddd.shared.manager.auth.StpKit;
import com.yuluo.picture486ddd.shared.manager.auth.model.SpaceUserPermissionConstant;
import com.yuluo.picture486ddd.domain.space.entity.Space;
import com.yuluo.picture486ddd.domain.space.service.SpaceDomainService;
import com.yuluo.picture486ddd.application.service.PictureApplicationService;
import com.yuluo.picture486ddd.application.service.UserApplicationService;
import com.yuluo.picture486ddd.domain.picture.entity.Picture;

import com.yuluo.picture486ddd.domain.picture.service.PictureDomainService;
import com.yuluo.picture486ddd.domain.user.entity.User;
import com.yuluo.picture486ddd.infrastructure.common.DeleteRequest;
import com.yuluo.picture486ddd.infrastructure.exception.ErrorCode;
import com.yuluo.picture486ddd.infrastructure.exception.ThrowUtils;
import com.yuluo.picture486ddd.infrastructure.mapper.PictureMapper;
import com.yuluo.picture486ddd.interfaces.dto.picture.*;
import com.yuluo.picture486ddd.interfaces.vo.picture.PictureVo;

import com.yuluo.picture486ddd.interfaces.vo.user.UserVo;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

/**
 * @author 东山羽洛
 */
@Service
@Slf4j
public class PictureApplicationServiceImpl extends ServiceImpl<PictureMapper, Picture>
    implements PictureApplicationService {

    @Resource
    private PictureDomainService pictureDomainService;

    @Resource
    private MessageDomainService messageDomainService;

    @Resource
    private UserApplicationService userApplicationService;

    @Resource
    private SpaceDomainService spaceDomainService;

    @Resource
    private SpaceUserAuthManager spaceUserAuthManager;

    @Override
    public PictureVo uploadPicture(Object inputSource, PictureUploadRequest pictureUploadRequest, HttpServletRequest request) {
        //用户校验
        User loginUser = userApplicationService.getLoginUser(request);
        return pictureDomainService.uploadPicture(inputSource, pictureUploadRequest, loginUser);
    }

    @Override
    public QueryWrapper<Picture> getQueryWrapper(PictureQueryRequest pictureQueryRequest) {
        return pictureDomainService.getQueryWrapper(pictureQueryRequest);
    }

    @Override
    public PictureVo getPictureVo(long id, HttpServletRequest request) {
        //查询数据库
        Picture picture = pictureDomainService.getById(id);
        ThrowUtils.throwIf(picture == null, ErrorCode.NOT_FOUND_ERROR);
        //相册权限校验
        Long spaceId = picture.getSpaceId();
        Space space = null;
        if (spaceId != null){
            boolean hasPermission = StpKit.SPACE.hasPermission(SpaceUserPermissionConstant.PICTURE_VIEW);
            ThrowUtils.throwIf(!hasPermission, ErrorCode.NO_AUTH_ERROR);
            space = spaceDomainService.getById(spaceId);
            ThrowUtils.throwIf(space == null, ErrorCode.NOT_FOUND_ERROR, "相册不存在");
            User loginUser = userApplicationService.getLoginUser(request);
            this.checkPictureAuth(loginUser, picture);
        }
        User loginUser = userApplicationService.getLoginUser(request);
        PictureVo pictureVo = pictureDomainService.getPictureVo(picture, request);
        //获取权限列表
        List<String> permissionList = spaceUserAuthManager.getPermissionList(space, loginUser);
        pictureVo.setPermissionList(permissionList);
        //关联用户查询信息
        Long userId = picture.getUserId();
        if(userId != null && userId > 0){
            User user = userApplicationService.getUser(userId);
            UserVo userVo = userApplicationService.getUserVo(user);
            pictureVo.setUser(userVo);
        }
        return pictureVo;
    }

    @Override
    public Page<PictureVo> getPictureVoPage(Page<Picture> picturePage, HttpServletRequest request) {
        //获取图片列表
        List<Picture> pictureList = picturePage.getRecords();
        Page<PictureVo> pictureVoPage = new Page<>(picturePage.getCurrent(), picturePage.getSize(), picturePage.getTotal());
        if (CollUtil.isEmpty(pictureList)){
            return pictureVoPage;
        }
        //从图片列表中获取每个图片对象，转换为Vo脱敏，再统一封装到新的列表
        List<PictureVo> pictureVoList = pictureList.stream().map(PictureVo::objToVo).toList();
        //关联查询用户信息（去重，使用Set集合）
        //从图片列表中提取所有不重复的用户ID
        Set<Long> userIdSet = pictureList.stream().map(Picture::getUserId).collect(Collectors.toSet());
        //批量获取用户信息，并按用户ID进行分组
        Map<Long, List<User>> userIdUserListMap = userApplicationService.listByIds(userIdSet).stream().collect(Collectors.groupingBy(User::getId));
        //填充信息
        pictureVoList.forEach(pictureVo -> {
            Long userId = pictureVo.getUserId();
            User user = null;
            if(userIdUserListMap.containsKey(userId)){
                user = userIdUserListMap.get(userId).get(0);
            }
            pictureVo.setUser(userApplicationService.getUserVo(user));
        });
        pictureVoPage.setRecords(pictureVoList);
        return pictureVoPage;
    }

    @Override
    public void validPicture(Picture picture) {
        pictureDomainService.validPicture(picture);
    }

    @Override
    public void doPictureReview(PictureReviewRequest pictureReviewRequest, User loginUser) {
       pictureDomainService.doPictureReview(pictureReviewRequest, loginUser);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void doPictureReviewByBatch(PictureReviewByBatchRequest pictureReviewByBatchRequest, User loginUser) {
        pictureDomainService.doPictureReviewByBatch(pictureReviewByBatchRequest, loginUser);
    }

    @Override
    public void fillReviewPictureParams(Picture picture, User loginUser){
        pictureDomainService.fillReviewPictureParams(picture, loginUser);
    }

    /**
     * 删除存储桶图片
     * @param oldPicture 旧图片信息
     */
    @Async
    @Override
    public void clearPictureFile(Picture oldPicture) {
        pictureDomainService.clearPictureFile(oldPicture);
    }

    @Override
    public void checkPictureAuth(User loginUser, Picture picture) {
        pictureDomainService.checkPictureAuth(loginUser, picture);
    }

    @Override
    public void deletePicture(DeleteRequest deleteRequest, HttpServletRequest request) {
        User loginUser = userApplicationService.getLoginUser(request);
        pictureDomainService.deletePicture(deleteRequest.getId(), loginUser);
    }

    @Override
    public void editPicture(PictureEditRequest pictureEditRequest, User loginUser){
       pictureDomainService.editPicture(pictureEditRequest, loginUser);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void editPictures(PictureEditByBatchRequest pictureEditByBatchRequest, User loginUser) {
        pictureDomainService.editPictures(pictureEditByBatchRequest, loginUser);
    }

    @Override
    public List<PictureVo> uploadPictures(MultipartFile[] multipartFiles, PictureUploadRequest pictureUploadRequest, User loginUser) {
        return pictureDomainService.uploadPictures(multipartFiles, pictureUploadRequest, loginUser);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean deletePictures(List<Long> pictureIds, User loginUser) {
        return pictureDomainService.deletePictures(pictureIds, loginUser);
    }

    @Override
    public List<Long> getPictureIds(Long spaceId) {
        return pictureDomainService.getPictureIds(spaceId);
    }

    @Override
    public void uploadCover(MultipartFile file, HttpServletRequest request, Long id) {
        // 获取登录用户
        User loginUser = userApplicationService.getLoginUser(request);
        pictureDomainService.uploadCover(file, id, loginUser);
    }

    @Override
    public void updatePicture(Picture picture, HttpServletRequest request) {
        //补充审核参数
        User loginUser = userApplicationService.getLoginUser(request);
        pictureDomainService.fillReviewPictureParams(picture, loginUser);
        pictureDomainService.updatePicture(picture, request);
    }

    @Override
    public Picture getPictureById(long id) {
        return pictureDomainService.getPictureById(id);
    }

}




















