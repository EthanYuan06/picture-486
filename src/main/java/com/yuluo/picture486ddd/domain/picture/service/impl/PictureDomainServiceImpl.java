package com.yuluo.picture486ddd.domain.picture.service.impl;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.ObjUtil;
import cn.hutool.core.util.RandomUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.yuluo.picture486ddd.domain.picture.repository.PictureRepository;
import com.yuluo.picture486ddd.domain.picture.service.PictureDomainService;

import com.yuluo.picture486ddd.application.service.UserApplicationService;
import com.yuluo.picture486ddd.infrastructure.exception.BusinessException;
import com.yuluo.picture486ddd.infrastructure.exception.ErrorCode;
import com.yuluo.picture486ddd.infrastructure.exception.ThrowUtils;
import com.yuluo.picture486ddd.infrastructure.api.CosManager;

import com.yuluo.picture486ddd.shared.manager.upload.FilePictureUpload;
import com.yuluo.picture486ddd.shared.manager.upload.PictureUploadTemplate;
import com.yuluo.picture486ddd.shared.manager.upload.UrlPictureUpload;
import com.yuluo.picture486ddd.domain.picture.entity.Picture;
import com.yuluo.picture486ddd.domain.space.entity.Space;
import com.yuluo.picture486ddd.domain.user.entity.User;

import com.yuluo.picture486ddd.domain.picture.valueobject.PictureReviewStatusEnum;
import com.yuluo.picture486ddd.interfaces.vo.picture.PictureVo;
import com.yuluo.picture486ddd.interfaces.dto.picture.*;
import com.yuluo.picture486ddd.interfaces.vo.user.UserVo;
import com.yuluo.picture486ddd.infrastructure.mapper.PictureMapper;
import com.yuluo.picture486ddd.domain.space.service.SpaceDomainService;
import com.yuluo.picture486ddd.domain.message.service.MessageDomainService;
import com.yuluo.picture486ddd.infrastructure.utils.PictureUtil;
import com.yuluo.picture486ddd.infrastructure.websocket.WebSocketServer;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.beans.BeanUtils;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * @author 东山羽洛
 */
@Service
@Slf4j
public class PictureDomainServiceImpl extends ServiceImpl<PictureMapper, Picture>
    implements PictureDomainService {
    @Resource
    private FilePictureUpload filePictureUpload;

    @Resource
    private UrlPictureUpload urlPictureUpload;

    @Resource
    private UserApplicationService userApplicationService;

    @Resource
    private CosManager cosManager;

    @Resource
    private SpaceDomainService spaceDomainService;

    @Resource
    private TransactionTemplate transactionTemplate;

    @Resource
    private MessageDomainService messageDomainService;

    @Resource
    private PictureRepository pictureRepository;

    @Resource
    private StringRedisTemplate stringRedisTemplate;

    @Override
    public PictureVo uploadPicture(Object inputSource, PictureUploadRequest pictureUploadRequest, User loginUser) {
        //校验参数
        if (inputSource == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "图片为空");
        }
        //校验是否是支持的图片格式
        ThrowUtils.throwIf(!PictureUtil.isAllowedImageFormat(inputSource), ErrorCode.PARAMS_ERROR, "图片格式不支持");
        ThrowUtils.throwIf(loginUser == null, ErrorCode.NO_AUTH_ERROR);
        //校验相册是否存在
        Long spaceId = pictureUploadRequest.getSpaceId();
        if (spaceId != null) {
            Space space = spaceDomainService.getById(spaceId);
            ThrowUtils.throwIf(space == null, ErrorCode.NOT_FOUND_ERROR, "相册不存在");
            //必须是相册创建人才能上传
//            if (!loginUser.getId().equals(space.getUserId())) {
//                throw new BusinessException(ErrorCode.NO_AUTH_ERROR, "无权限操作该相册");
//            }
            //校验额度
            if (space.getTotalCount() >= space.getMaxCount()){
                throw new BusinessException(ErrorCode.OPERATION_ERROR, "超出最大图片存储数量");
            }
            //校验容量
            if (space.getTotalSize() >= space.getMaxSize()){
                throw new BusinessException(ErrorCode.OPERATION_ERROR, "相册剩余容量不足");
            }
        }
        //判断是新增还是删除
        Long pictureId;
        pictureId = pictureUploadRequest.getId();
        //若更新，则判断图片是否存在
        if (pictureId != null) {
            Picture oldPicture = this.getById(pictureId);
            ThrowUtils.throwIf(oldPicture == null, ErrorCode.NOT_FOUND_ERROR, "图片不存在");
            //仅本人或管理员可编辑
            if (!oldPicture.getUserId().equals(loginUser.getId()) && !User.isAdmin(loginUser)) {
                throw new BusinessException(ErrorCode.NO_AUTH_ERROR, "无权限操作该图片");
            }
            //校验相册是否一致
            //未传递spaceId，则复用原有图片的spaceId
            if (spaceId == null) {
                if (oldPicture.getSpaceId() != null) {
                    spaceId = oldPicture.getSpaceId();
                }
            } else {
                //若传递spaceId，则校验spaceId是否与图片的spaceId一致
                if (ObjUtil.notEqual(spaceId, oldPicture.getSpaceId())) {
                    throw new BusinessException(ErrorCode.PARAMS_ERROR, "相册id不一致");
                }
            }
        }
            //上传图片
            //划分公共图库和私有相册
            String uploadPathPrefix;
            if (spaceId != null){
                uploadPathPrefix = String.format("space/%s", spaceId);
            }else{
                uploadPathPrefix = String.format("public/%s", loginUser.getId());
            }
            //根据inputSource区分上传方式
            PictureUploadTemplate pictureUploadTemplate = filePictureUpload;
            if (inputSource instanceof String) {
                pictureUploadTemplate = urlPictureUpload;
            }
            PictureUploadResult pictureUploadResult = pictureUploadTemplate.uploadPicture(inputSource, uploadPathPrefix);
            //构造要入库的图片信息
            Picture picture = new Picture();
            picture.setUrl(pictureUploadResult.getUrl());
            picture.setThumbnailUrl(pictureUploadResult.getThumbnailUrl());
            picture.setName(pictureUploadResult.getPicName());
            picture.setPicSize(pictureUploadResult.getPicSize());
            picture.setPicWidth(pictureUploadResult.getPicWidth());
            picture.setPicHeight(pictureUploadResult.getPicHeight());
            picture.setPicScale(pictureUploadResult.getPicScale());
            picture.setPicFormat(pictureUploadResult.getPicFormat());
            picture.setUserId(loginUser.getId());
            picture.setSpaceId(spaceId);
            //填充审核参数
            this.fillReviewPictureParams(picture, loginUser);
            //如果pictureId不为空，表示更新，否则是新增
            //若更新，则补充id和编辑时间
            if (pictureId != null) {
                picture.setId(pictureId);
                picture.setEditTime(new Date());
            }
            //开启事务
            Long finalSpaceId = spaceId;
            transactionTemplate.execute(status -> {
                //插入数据
                boolean result = this.saveOrUpdate(picture);
                ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR, "图片上传失败");
                if (finalSpaceId != null) {
                    //更新相册剩余额度
                    boolean update = spaceDomainService.lambdaUpdate()
                            .eq(Space::getId, finalSpaceId)
                            .setSql("totalSize = totalSize + " + picture.getPicSize())
                            .setSql("totalCount = totalCount + 1")
                            .update();
                    ThrowUtils.throwIf(!update, ErrorCode.OPERATION_ERROR, "图片额度更新失败");
                }
                return picture;
            });
            return PictureVo.objToVo(picture);
        }

    @Override
    public QueryWrapper<Picture> getQueryWrapper(PictureQueryRequest pictureQueryRequest) {
        //创建查询条件
        QueryWrapper<Picture> queryWrapper = new QueryWrapper<>();
        if (pictureQueryRequest == null) {
            return queryWrapper;
        }
        //从对象中获取参数
        Long id = pictureQueryRequest.getId();
        String name = pictureQueryRequest.getName();
        String introduction = pictureQueryRequest.getIntroduction();
        String category = pictureQueryRequest.getCategory();
        List<String> tags = pictureQueryRequest.getTags();
        Long picSize = pictureQueryRequest.getPicSize();
        Integer picWidth = pictureQueryRequest.getPicWidth();
        Integer picHeight = pictureQueryRequest.getPicHeight();
        Double picScale = pictureQueryRequest.getPicScale();
        String picFormat = pictureQueryRequest.getPicFormat();
        String searchText = pictureQueryRequest.getSearchText();
        Long userId = pictureQueryRequest.getUserId();
        Long spaceId = pictureQueryRequest.getSpaceId();
        boolean nullSpaceId = pictureQueryRequest.isNullSpaceId();
        Integer reviewStatus = pictureQueryRequest.getReviewStatus();
        String reviewMessage = pictureQueryRequest.getReviewMessage();
        Long reviewerId = pictureQueryRequest.getReviewerId();
        Date createTimeStart = pictureQueryRequest.getCreateTimeStart();
        Date createTimeEnd = pictureQueryRequest.getCreateTimeEnd();
        Date editTimeStart = pictureQueryRequest.getEditTimeStart();
        Date editTimeEnd = pictureQueryRequest.getEditTimeEnd();
        String sortField = pictureQueryRequest.getSortField();
        String sortOrder = pictureQueryRequest.getSortOrder();

        //从多字段中搜索，支持同时从name和introduction中检索
        if(StrUtil.isNotBlank(searchText)){
            //拼接查询条件
            queryWrapper.and(qw ->
                    qw.like("name", searchText)
                    .or()
                    .like("introduction", searchText));
        }
        //定义查询条件
        queryWrapper.eq(ObjUtil.isNotEmpty(id), "id", id);
        queryWrapper.eq(ObjUtil.isNotEmpty(userId), "userId", userId);
        queryWrapper.eq(ObjUtil.isNotEmpty(spaceId), "spaceId", spaceId);
        queryWrapper.isNull(nullSpaceId, "spaceId");
        queryWrapper.like(StrUtil.isNotBlank(name), "name", name);
        queryWrapper.like(StrUtil.isNotBlank(introduction), "introduction", introduction);
        queryWrapper.like(StrUtil.isNotBlank(picFormat), "picFormat", picFormat);
        queryWrapper.like(StrUtil.isNotBlank(reviewMessage), "reviewMessage", reviewMessage);
        queryWrapper.eq(StrUtil.isNotBlank(category), "category", category);
        queryWrapper.eq(ObjUtil.isNotEmpty(picWidth), "picWidth", picWidth);
        queryWrapper.eq(ObjUtil.isNotEmpty(picHeight), "picHeight", picHeight);
        queryWrapper.eq(ObjUtil.isNotEmpty(picSize), "picSize", picSize);
        queryWrapper.eq(ObjUtil.isNotEmpty(picScale), "picScale", picScale);
        // 只有当审核状态不为空且不是"全部"状态时，才添加审核状态查询条件
        if (reviewStatus != null) {
            queryWrapper.eq("reviewStatus", reviewStatus);
        }
        queryWrapper.eq(ObjUtil.isNotEmpty(reviewerId), "reviewerId", reviewerId);
        //JSON数组查询
        /*
        and (tag like "%\"Java\"%" and like "%\"Python\"%")
         */
        if (CollUtil.isNotEmpty(tags)){
            for (String tag : tags){
                queryWrapper.like("tags", "\"" + tag + "\"");//转义格式
            }
        }
        //>= createTimeStart
        queryWrapper.ge(ObjUtil.isNotEmpty(createTimeStart), "createTime", createTimeStart);
        //< createTimeEnd
        queryWrapper.le(ObjUtil.isNotEmpty(createTimeEnd), "createTime", createTimeEnd);
        //>= editTimeStart
        queryWrapper.ge(ObjUtil.isNotEmpty(editTimeStart), "editTime", editTimeStart);
        //< editTimeEnd
        queryWrapper.le(ObjUtil.isNotEmpty(editTimeEnd), "editTime", editTimeEnd);

        //排序
        queryWrapper.orderBy(StrUtil.isNotEmpty(sortField), sortOrder.equals("asc"), sortField);
        return queryWrapper;
    }

    @Override
    public PictureVo getPictureVo(Picture picture, HttpServletRequest request) {
        //picture对象转换为Vo
        PictureVo pictureVo = PictureVo.objToVo(picture);
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
    public void doPictureReview(PictureReviewRequest pictureReviewRequest, User loginUser) {
        //1.校验参数
        Long id = pictureReviewRequest.getId();
        Integer reviewStatus = pictureReviewRequest.getReviewStatus();
        PictureReviewStatusEnum reviewStatusEnum = PictureReviewStatusEnum.getEnumByValue(reviewStatus);
        if (id == null || reviewStatus == null || PictureReviewStatusEnum.REVIEWING.equals(reviewStatusEnum)){
            throw new BusinessException(ErrorCode.PARAMS_ERROR);
        }
        //2.判断图片是否存在
        Picture oldPicture = this.getById(id);
        ThrowUtils.throwIf(oldPicture == null, ErrorCode.NOT_FOUND_ERROR);
        //3.判断图片是否重复审核
        if (oldPicture.getReviewStatus().equals(reviewStatus)){
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "请勿重复审核");
        }
        //4.操作数据库更新审核状态
        Picture updatePicture = new Picture();
        BeanUtils.copyProperties(pictureReviewRequest, updatePicture);
        updatePicture.setReviewStatus(reviewStatus);
        updatePicture.setReviewerId(loginUser.getId());
        updatePicture.setReviewTime(new Date());
        boolean result = this.updateById(updatePicture);
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR, "操作失败");
        
        // 写入站内消息
        if (oldPicture.getUserId() != null) {
            PictureReviewStatusEnum statusEnum = PictureReviewStatusEnum.getEnumByValue(reviewStatus);
            String reviewMsg = ObjUtil.defaultIfNull(pictureReviewRequest.getReviewMessage(), "无");
            String title = "图片审核" + statusEnum.getText();
            String message = String.format("您的图片（ID: %d）审核状态已更新为：%s，备注：%s",
                    id,
                    statusEnum.getText(),
                    reviewMsg);
            messageDomainService.sendMessage(oldPicture.getUserId(), title, message);
        } else {
            log.warn("图片ID: {} 的userId为空，无法发送审核通知", id);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void doPictureReviewByBatch(PictureReviewByBatchRequest pictureReviewByBatchRequest, User loginUser) {
        //1.校验参数
        List<Long> idList = pictureReviewByBatchRequest.getIdList();
        Integer reviewStatus = pictureReviewByBatchRequest.getReviewStatus();
        String reviewMessage = pictureReviewByBatchRequest.getReviewMessage();
        if (CollUtil.isEmpty(idList) || reviewStatus == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR);
        }
        // 校验审核状态是否合法
        PictureReviewStatusEnum reviewStatusEnum = PictureReviewStatusEnum.getEnumByValue(reviewStatus);
        if (reviewStatusEnum == null || PictureReviewStatusEnum.REVIEWING.equals(reviewStatusEnum)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "审核状态不合法");
        }
        //2.批量判断图片是否存在
        List<Picture> oldPictureList = this.listByIds(idList);
        ThrowUtils.throwIf(oldPictureList.size() != idList.size(), ErrorCode.NOT_FOUND_ERROR, "当前选中图片存在不合法的数据");
        //3.批量判断图片是否重复审核，该操作通过筛选目标审核参数与当前审核参数不同的图片对象，保留了未重复审核的图片
        List<Picture> reviewPictureList = oldPictureList.stream().
                filter(picture -> !picture.getReviewStatus().equals(reviewStatus)).toList();
        ThrowUtils.throwIf(reviewPictureList.isEmpty(), ErrorCode.OPERATION_ERROR, "当前选中图片均重复审核");
        //4.批量操作数据库更新审核状态
        List<Picture> updatePictureList = reviewPictureList.stream().map(picture -> {
            Picture updatePicture = new Picture();
            updatePicture.setId(picture.getId());
            updatePicture.setReviewStatus(reviewStatus);
            updatePicture.setReviewerId(loginUser.getId());
            updatePicture.setReviewMessage(reviewMessage);
            updatePicture.setReviewTime(new Date());
            return updatePicture;
        }).toList();
        boolean result = this.updateBatchById(updatePictureList);
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR, "批量审核失败");
        // 写入站内消息
        String reviewMsg = ObjUtil.defaultIfNull(reviewMessage, "无");
        for (Picture picture : reviewPictureList) {
            if (picture.getUserId() != null) {
                String title = "图片审核" + reviewStatusEnum.getText();
                String message = String.format("您的图片（ID: %d）审核状态已更新为：%s，备注：%s",
                        picture.getId(),
                        reviewStatusEnum.getText(),
                        reviewMsg);
                messageDomainService.sendMessage(picture.getUserId(), title, message);
            } else {
                log.warn("图片ID: {} 的userId为空，无法发送审核通知", picture.getId());
            }
        }
    }

    @Override
    public void fillReviewPictureParams(Picture picture, User loginUser){
        if (User.isAdmin(loginUser)){
            //管理员自动过审
            picture.setReviewStatus(PictureReviewStatusEnum.PASS.getValue());
            picture.setReviewTime(new Date());
            picture.setReviewerId(loginUser.getId());
            picture.setReviewMessage("管理员自动过审");
        }else {
            //普通用户创建或编辑图片，只更改字段为“待审核”
            picture.setReviewStatus(PictureReviewStatusEnum.REVIEWING.getValue());
        }
    }

    /**
     * 删除存储桶图片
     * @param oldPicture 旧图片信息
     */
    @Async
    @Override
    public void clearPictureFile(Picture oldPicture) {
        //判断图片是否被多条记录使用
        String pictureUrl = oldPicture.getUrl();
        Long count = this.lambdaQuery()
                .eq(Picture::getUrl, pictureUrl)
                .count();
        //若被多条记录使用，不清理，可以允许等到最后一处引用删除
        if(count > 1){
            log.info("图片被多条记录使用，不进行清理");
            return;
        }
        try {
            cosManager.deleteObject(oldPicture.getUrl());
            // 删除webp格式图片
            String webpUrl = oldPicture.getUrl();
            if (!webpUrl.endsWith(".webp")) {
                // 获取文件名（不含扩展名）
                int lastDotIndex = webpUrl.lastIndexOf(".");
                if (lastDotIndex != -1) {
                    webpUrl = webpUrl.substring(0, lastDotIndex) + ".webp";
                    try {
                        cosManager.deleteObject(webpUrl);
                    } catch (Exception e) {
                        log.error("删除webp图片文件失败: url={}, 错误信息={}", webpUrl, e.getMessage(), e);
                    }
                }
            }
        } catch (Exception e) {
            log.error("删除图片文件失败: url={}, 错误信息={}", pictureUrl, e.getMessage(), e);
        }
        //清理缩略图
        String thumbnailUrl = oldPicture.getThumbnailUrl();
        if(StrUtil.isNotBlank(thumbnailUrl)){
            try {
                cosManager.deleteObject(thumbnailUrl);
            } catch (Exception e) {
                log.error("删除缩略图文件失败: url={}, 错误信息={}", thumbnailUrl, e.getMessage(), e);
            }
        }
    }

    @Override
    public void checkPictureAuth(User loginUser, Picture picture) {
        Long spaceId = picture.getSpaceId();
        if (spaceId == null){
            //公共图库，仅本人和管理员可删除
            if (!User.isAdmin(loginUser) && !loginUser.getId().equals(picture.getUserId())){
                throw new BusinessException(ErrorCode.NO_AUTH_ERROR);
            }
        }else {
            //私有图库，仅相册管理员可删除
            if (!picture.getUserId().equals(loginUser.getId())){
                throw new BusinessException(ErrorCode.NO_AUTH_ERROR);
            }
        }
    }

    @Override
    public void deletePicture(long pictureId, User loginUser) {
        ThrowUtils.throwIf(pictureId <= 0, ErrorCode.PARAMS_ERROR);
        ThrowUtils.throwIf(loginUser == null, ErrorCode.NO_AUTH_ERROR);
        //判断图片是否存在
        Picture oldPicture = this.getById(pictureId);
        ThrowUtils.throwIf(oldPicture == null, ErrorCode.NOT_FOUND_ERROR);
        //已使用注解鉴权
//        checkPictureAuth(loginUser, oldPicture);
        //开启事务
        Long spaceId = oldPicture.getSpaceId();
        transactionTemplate.execute(status -> {
            //操作数据库删除图片
            boolean result = this.removeById(oldPicture);
            ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR, "图片删除失败");
            if (spaceId != null) {
                //更新相册剩余额度
                boolean update = spaceDomainService.lambdaUpdate()
                        .eq(Space::getId, oldPicture.getSpaceId())
                        .setSql("totalSize = totalSize - " + oldPicture.getPicSize())
                        .setSql("totalCount = totalCount - 1")
                        .update();
                ThrowUtils.throwIf(!update, ErrorCode.OPERATION_ERROR, "图片额度更新失败");
            }
            return true;
        });
        //删除存储桶图片
        this.clearPictureFile(oldPicture);
    }

    @Override
    public void editPicture(PictureEditRequest pictureEditRequest, User loginUser){
        //实体类和DTO进行转换
        Picture picture = new Picture();
        BeanUtils.copyProperties(pictureEditRequest, picture);
        //list转换为string
        picture.setTags(JSONUtil.toJsonStr(pictureEditRequest.getTags()));
        //设置编辑时间
        picture.setEditTime(new Date());
        //设置相册id
        picture.setSpaceId(pictureEditRequest.getSpaceId());
        //数据校验
        this.validPicture(picture);
        //判断图片是否存在
        Long id = pictureEditRequest.getId();
        Picture oldPicture = this.getById(id);
        ThrowUtils.throwIf(oldPicture == null, ErrorCode.NOT_FOUND_ERROR);
        //已使用注解鉴权
//        checkPictureAuth(loginUser, oldPicture);
        //补充审核参数
        this.fillReviewPictureParams(oldPicture, loginUser);
        //操作数据库
        boolean result = this.updateById(picture);
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void editPictures(PictureEditByBatchRequest pictureEditByBatchRequest, User loginUser) {
        //获取属性值
        List<Long> pictureIdList = pictureEditByBatchRequest.getPictureIdList();
        Long spaceId = pictureEditByBatchRequest.getSpaceId();
        String category = pictureEditByBatchRequest.getCategory();
        List<String> tags = pictureEditByBatchRequest.getTags();

        //1.校验参数
        ThrowUtils.throwIf(spaceId == null || pictureIdList.isEmpty(), ErrorCode.PARAMS_ERROR);
        ThrowUtils.throwIf(loginUser == null, ErrorCode.NO_AUTH_ERROR);

        //2.校验相册权限
        Space space = spaceDomainService.getById(spaceId);
        ThrowUtils.throwIf(space == null, ErrorCode.NOT_FOUND_ERROR, "相册不存在");
        //非相册创建人不允许操作
        if (!loginUser.getId().equals(space.getUserId())){
            throw new BusinessException(ErrorCode.NO_AUTH_ERROR, "无权限操作该相册");
        }
        //3.查询指定图片，仅选择需要的字段
        List<Picture> pictureList = this.lambdaQuery()
                .select(Picture::getId, Picture::getSpaceId)//仅查询已选择图片和所属相册
                .eq(Picture::getSpaceId, spaceId)//确保所选的图片属于当前操作的相册
                .in(Picture::getId, pictureIdList)//只从已选择的图片中获取需要更新的图片
                .list();
        if (pictureList.isEmpty()){
            return;
        }
        //4.更新分类和标签
        pictureList.forEach(picture -> {
            if (StrUtil.isNotBlank(category)) {
                picture.setCategory(category);
            }
            if (CollUtil.isNotEmpty(tags)) {
                picture.setTags(JSONUtil.toJsonStr(tags));
            }
        });
        //批量重命名
        String nameRule = pictureEditByBatchRequest.getNameRule();
        Picture.fillPictureWithNameRule(pictureList, nameRule);
        //5.批量更新数据库
        boolean result = this.updateBatchById(pictureList);
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR, "批量更新图片失败");
    }

    @Override
    public List<PictureVo> uploadPictures(MultipartFile[] multipartFiles, PictureUploadRequest pictureUploadRequest, User loginUser) {
        //校验参数
        if (multipartFiles == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "图片为空");
        }
        ThrowUtils.throwIf(loginUser == null, ErrorCode.NO_AUTH_ERROR);
        //校验相册是否存在
        Long spaceId = pictureUploadRequest.getSpaceId();
        if (spaceId != null) {
            Space space = spaceDomainService.getById(spaceId);
            ThrowUtils.throwIf(space == null, ErrorCode.NOT_FOUND_ERROR, "相册不存在");
            //必须是相册创建人才能上传
            if (!loginUser.getId().equals(space.getUserId())) {
                throw new BusinessException(ErrorCode.NO_AUTH_ERROR, "无权限操作该相册");
            }
            //校验额度
            if (space.getTotalCount() + multipartFiles.length > space.getMaxCount()){
                throw new BusinessException(ErrorCode.OPERATION_ERROR, "超出最大图片存储数量");
            }
            //校验容量
            if (space.getTotalSize() + PictureUtil.calculateTotalSize(multipartFiles) >= space.getMaxSize()){
                throw new BusinessException(ErrorCode.OPERATION_ERROR, "相册剩余容量不足");
            }
        }
        // 存储成功上传的图片信息
        List<PictureVo> pictureVos = new ArrayList<>();
        // 逐个处理上传的文件，循环调用单次上传图片方法
        for (MultipartFile multipartFile : multipartFiles) {
            try {
                PictureVo pictureVo = this.uploadPicture(multipartFile, pictureUploadRequest, loginUser);
                pictureVos.add(pictureVo);
            } catch (Exception e) {
                log.error("批量上传中单个文件上传失败: ", e);
                throw new BusinessException(ErrorCode.OPERATION_ERROR, "批量上传失败");
            }
        }
        return pictureVos;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean deletePictures(List<Long> pictureIds, User loginUser) {
//        //删除计时开始
//        long startTime = System.currentTimeMillis();
//        log.info("开始批量删除图片，图片数量: {}", pictureIds.size());
        if (pictureIds.isEmpty()) {
            return true; // 无图片可删，返回成功
        }
        //根据第一张图片获取相册信息
        Picture picture = this.getById(pictureIds.get(0));
        ThrowUtils.throwIf(picture == null, ErrorCode.NOT_FOUND_ERROR, "图片不存在");
        
        Space space = null;
        if (picture.getSpaceId() != null) {
            // 私有相册中的图片
            space = spaceDomainService.getById(picture.getSpaceId());
            ThrowUtils.throwIf(space == null, ErrorCode.NOT_FOUND_ERROR, "相册不存在");
            
            //校验权限：只有相册创建人才能删除
            if (!loginUser.getId().equals(space.getUserId())){
                throw new BusinessException(ErrorCode.NO_AUTH_ERROR, "无权限操作该相册");
            }
        } else {
            // 公共图库中的图片，只有管理员可以批量删除
            if (!User.isAdmin(loginUser)){
                throw new BusinessException(ErrorCode.NO_AUTH_ERROR, "无图片批量删除权限");
            }
        }
        
        //查询所有要删除的图片信息
        List<Picture> picturesToDelete = this.listByIds(pictureIds);
        
        // 检查是否所有图片都在同一个相册中（如果在相册中）
        if (space != null) {
            //为了保证线程安全，这里不使用lambda表达式，因为lambda要求space不会被重新赋值，即space是有效final变量
            for (Picture p : picturesToDelete) {
                if (!space.getId().equals(p.getSpaceId())) {
                    throw new BusinessException(ErrorCode.PARAMS_ERROR, "所选图片不在同一相册中");
                }
            }
        }
        
        //执行删除操作
        boolean result = this.removeByIds(pictureIds);//这里不用removeBatchByIds，因为只是小数据量删除（< 100 条）
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR, "图片批量删除失败");

        //更新相册额度
        if (space != null) {
            //获取每个待删除图片的体积，并求和
            long totalSize = picturesToDelete.stream()
                    .mapToLong(Picture::getPicSize)
                    .sum();
            int totalCount = picturesToDelete.size();
            
            Space updateSpace = new Space();
            updateSpace.setId(space.getId());
            updateSpace.setTotalSize(space.getTotalSize() - totalSize);
            updateSpace.setTotalCount(space.getTotalCount() - totalCount);
            boolean updateResult = spaceDomainService.updateById(updateSpace);
            ThrowUtils.throwIf(!updateResult, ErrorCode.OPERATION_ERROR, "更新相册额度失败");
        }
        //异步删除存储桶中的实际文件
        picturesToDelete.forEach(this::clearPictureFile);
//        //批量删除计时结束
//        long endTime = System.currentTimeMillis();
//        log.info("批量删除图片完成，图片数量: {}，耗时: {} ms", pictureIds.size(), (endTime - startTime));
        return true;
    }

    @Override
    public List<Long> getPictureIds(Long spaceId) {
        //校验参数
        ThrowUtils.throwIf(spaceId == null, ErrorCode.PARAMS_ERROR, "相册ID不能为空");
        //根据相册ID查询所有相关图片，并收集这些图片的ID到列表中，即指定空间下所有的图片ID
        return lambdaQuery().eq(Picture::getSpaceId, spaceId).list().stream()
                .map(Picture::getId)
                .toList();
    }

    @Override
    public void uploadCover(MultipartFile file, Long id, User loginUser) {

        // 校验相册文件是否超过限制：大小不超过15MB
        ThrowUtils.throwIf(file.getSize() > 15 * 1024 * 1024, ErrorCode.PARAMS_ERROR, "封面图片过大，请重新上传");

        // 校验相册是否存在及权限
        Space oldSpace = spaceDomainService.getById(id);
        ThrowUtils.throwIf(oldSpace == null, ErrorCode.NOT_FOUND_ERROR, "相册不存在");
        spaceDomainService.checkSpaceAuth(oldSpace, loginUser);

        // 构建上传路径前缀，指定存储桶中的存储路径为 cover 目录
        String uploadPathPrefix = String.format("cover/%s", loginUser.getId());
        // 使用文件上传处理器
        PictureUploadResult uploadResult = filePictureUpload.uploadPicture(file, uploadPathPrefix);
        // 只更新封面URL字段
        String spaceCover = uploadResult.getUrl();
        Space space = new Space();
        space.setId(id);
        space.setSpaceCover(spaceCover);
        boolean result = spaceDomainService.updateById(space);
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR, "封面上传失败");
    }

    @Override
    public void updatePicture(Picture picture, HttpServletRequest request) {
        //操作数据库更新图片信息
        boolean result = pictureRepository.updateById(picture);
        ThrowUtils.throwIf(!result, ErrorCode.OPERATION_ERROR);
    }

    @Override
    public Picture getPictureById(long id) {
        //查询数据库
        Picture picture = pictureRepository.getById(id);
        ThrowUtils.throwIf(picture == null, ErrorCode.NOT_FOUND_ERROR);
        return picture;
    }

    @Override
    public void validPicture(Picture picture) {
        Picture.validPicture(picture);
    }

    private void deleteTempFile(File file) {
        if (file == null) {
            return;
        }
        boolean deleted = file.delete();
        if (!deleted) {
            log.error("file delete error, filepath = {}", file.getAbsolutePath());
        }
    }

}




















