package com.yuluo.picture486ddd.interfaces.controller;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.yuluo.picture486ddd.application.service.PictureApplicationService;
import com.yuluo.picture486ddd.infrastructure.annotation.AuthCheck;
import com.yuluo.picture486ddd.infrastructure.common.BaseResponse;
import com.yuluo.picture486ddd.infrastructure.common.DeleteRequest;
import com.yuluo.picture486ddd.infrastructure.common.ResultUtils;
import com.yuluo.picture486ddd.domain.user.constant.UserConstant;
import com.yuluo.picture486ddd.infrastructure.exception.BusinessException;
import com.yuluo.picture486ddd.infrastructure.exception.ErrorCode;
import com.yuluo.picture486ddd.infrastructure.exception.ThrowUtils;
import com.yuluo.picture486ddd.shared.manager.auth.StpKit;
import com.yuluo.picture486ddd.shared.manager.auth.annotation.SaSpaceCheckPermission;
import com.yuluo.picture486ddd.shared.manager.auth.model.SpaceUserPermissionConstant;
import com.yuluo.picture486ddd.domain.picture.entity.Picture;
import com.yuluo.picture486ddd.domain.space.entity.Space;
import com.yuluo.picture486ddd.domain.user.entity.User;
import com.yuluo.picture486ddd.domain.picture.valueobject.PictureReviewStatusEnum;
import com.yuluo.picture486ddd.interfaces.assembler.PictureAssembler;
import com.yuluo.picture486ddd.interfaces.vo.picture.PictureTagCategory;
import com.yuluo.picture486ddd.interfaces.vo.picture.PictureVo;

import com.yuluo.picture486ddd.domain.picture.service.PictureDomainService;
import com.yuluo.picture486ddd.domain.space.service.SpaceDomainService;
import com.yuluo.picture486ddd.application.service.UserApplicationService;
import com.yuluo.picture486ddd.infrastructure.utils.PictureUtil;
import com.yuluo.picture486ddd.interfaces.dto.picture.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.util.DigestUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;


@RestController
@RequestMapping("/picture")
@Tag(name = "图片模块")
@Slf4j
public class PictureController {
    @Resource
    private PictureApplicationService pictureApplicationService;

    @Resource
    private PictureDomainService pictureDomainService;

    @Resource
    private UserApplicationService userApplicationService;

    @Resource
    private StringRedisTemplate stringRedisTemplate;

    @Resource
    private SpaceDomainService spaceDomainService;

    @PostMapping("/upload")
    @Operation(summary = "上传图片")
    @SaSpaceCheckPermission(value = SpaceUserPermissionConstant.PICTURE_UPLOAD)
    public BaseResponse<PictureVo> uploadPicture(
            @RequestPart("file") MultipartFile multipartFile, PictureUploadRequest pictureUploadRequest, HttpServletRequest request) {
        PictureVo pictureVo = pictureApplicationService.uploadPicture(multipartFile, pictureUploadRequest, request);
        //清除缓存
        clearCache("listPage");
        clearCache("listPageVo");
        return ResultUtils.success(pictureVo);
    }



    @PostMapping("/upload/cover")
    @Operation(summary = "上传相册封面")
    @SaSpaceCheckPermission(value = SpaceUserPermissionConstant.PICTURE_UPLOAD)
    public BaseResponse<Boolean> uploadCover(@RequestPart("file") MultipartFile file, HttpServletRequest request, @RequestParam("id") Long id) {
        pictureApplicationService.uploadCover(file, request, id);
        return ResultUtils.success(true);
    }


    @PostMapping("/delete")
    @Operation(summary = "删除图片")
    @SaSpaceCheckPermission(value = SpaceUserPermissionConstant.PICTURE_DELETE)
    public BaseResponse<Boolean> deletePicture(@RequestBody DeleteRequest deleteRequest, HttpServletRequest request) {
        pictureApplicationService.deletePicture(deleteRequest, request);
        //清除缓存
        clearCache("listPage");
        clearCache("listPageVo");
        return ResultUtils.success(true);
    }

    @PostMapping("/update")
    @Operation(summary = "【管理员】更新图片")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Boolean> updatePicture(@RequestBody PictureUpdateRequest pictureUpdateRequest, HttpServletRequest request) {
        //将实体类和DTO进行转换
        Picture picture = PictureAssembler.toPictureEntity(pictureUpdateRequest);
        //数据校验
        Picture.validPicture(picture);
        //list转换为string
        picture.setTags(JSONUtil.toJsonStr(pictureUpdateRequest.getTags()));
        pictureApplicationService.updatePicture(picture, request);
        //清除缓存
        clearCache("listPage");
        clearCache("listPageVo");
        return ResultUtils.success(true);
    }

    @GetMapping("/get")
    @Operation(summary = "【管理员】根据id获取图片")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Picture> getPictureById(long id) {
        return ResultUtils.success(pictureApplicationService.getPictureById(id));
    }

    @GetMapping("/get/vo")
    @Operation(summary = "根据id获取图片（脱敏）")
    public BaseResponse<PictureVo> getPictureVoById(long id, HttpServletRequest request) {
        return ResultUtils.success(pictureApplicationService.getPictureVo(id, request));
    }


    @PostMapping("/list/page")
    @Operation(summary = "【管理员】分页获取图片列表")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Page<Picture>> listPictureByPage(@RequestBody PictureQueryRequest pictureQueryRequest) {
        long current = pictureQueryRequest.getCurrent();
        long size = pictureQueryRequest.getPageSize();
        //公共图库
        Long spaceId = pictureQueryRequest.getSpaceId();
        if(spaceId == null){
            pictureQueryRequest.setNullSpaceId(true);
        }else {
            //私有相册
            //校验相册是否存在
            Space space = spaceDomainService.getById(spaceId);
            ThrowUtils.throwIf(space == null, ErrorCode.NOT_FOUND_ERROR, "相册不存在");
        }
        
        // 构建缓存key
        String queryConditionStr = JSONUtil.toJsonStr(pictureQueryRequest);
        String hashKey = DigestUtils.md5DigestAsHex(queryConditionStr.getBytes());
        String cacheKey = "listPage:" + hashKey;

        // 查询本地缓存
        String cachedValue = LOCAL_CACHE.getIfPresent(cacheKey);
        if (cachedValue != null) {
            // 缓存命中，返回结果
            Page<Picture> result = convertJsonToPicturePage(cachedValue);
            return ResultUtils.success(result);
        }

        // 查询分布式缓存
        ValueOperations<String, String> valueOps = stringRedisTemplate.opsForValue();
        cachedValue = valueOps.get(cacheKey);
        if (cachedValue != null) {
            // 缓存命中，返回结果
            Page<Picture> result = convertJsonToPicturePage(cachedValue);
            LOCAL_CACHE.put(cacheKey, cachedValue);
            return ResultUtils.success(result);
        }
        
        // 查询数据库
        Page<Picture> result = pictureDomainService.page(new Page<>(current, size),
                pictureDomainService.getQueryWrapper(pictureQueryRequest));
        
        // 更新本地缓存，设置随机过期时间1~3分钟
        String cacheValue = JSONUtil.toJsonStr(result);
        long localCacheTtl = ThreadLocalRandom.current().nextLong(1, 4); // 1-3分钟（不包含4）
        LOCAL_CACHE.put(cacheKey, cacheValue);

        // 更新Redis缓存，设置随机过期时间3~5分钟
        long redisCacheTtl = ThreadLocalRandom.current().nextLong(3, 6); // 3-5分钟（不包含6）
        valueOps.set(cacheKey, cacheValue, redisCacheTtl, TimeUnit.MINUTES);

        return ResultUtils.success(result);
    }

    @PostMapping("/list/page/vo")
    @Operation(summary = "分页获取图片列表")
    public BaseResponse<Page<PictureVo>> listPictureVoByPage(@RequestBody PictureQueryRequest pictureQueryRequest, HttpServletRequest request) {
        long current = pictureQueryRequest.getCurrent();
        long size = pictureQueryRequest.getPageSize();
        //限制爬虫
        ThrowUtils.throwIf(size > 20, ErrorCode.PARAMS_ERROR);
        //相册权限校验
        Long spaceId = pictureQueryRequest.getSpaceId();
        //公开图库
        if(spaceId == null){
            // 判断是否查询的是当前用户自己的图片（"我的发布"）
            User loginUser = userApplicationService.getLoginUser(request);
            // 只有当不是查询自己的图片时，才限制只查看已过审的数据
            if (loginUser == null || !loginUser.getId().equals(pictureQueryRequest.getUserId())) {
                pictureQueryRequest.setReviewStatus(PictureReviewStatusEnum.PASS.getValue());
            }
            pictureQueryRequest.setNullSpaceId(true);
        }else {
            boolean hasPermission = StpKit.SPACE.hasPermission(SpaceUserPermissionConstant.PICTURE_VIEW);
            ThrowUtils.throwIf(!hasPermission, ErrorCode.NO_AUTH_ERROR);
        }
        // 构建缓存key
        String queryConditionStr = JSONUtil.toJsonStr(pictureQueryRequest);
        String hashKey = DigestUtils.md5DigestAsHex(queryConditionStr.getBytes());
        String cacheKey = "listPageVo:" + hashKey;

        // 查询本地缓存
        String cachedValue = LOCAL_CACHE.getIfPresent(cacheKey);
        if (cachedValue != null) {
            // 缓存命中，进行反序列化处理后返回结果
            Page<Picture> result = convertJsonToPicturePage(cachedValue);
            return ResultUtils.success(pictureDomainService.getPictureVoPage(result, request));
        }

        // 查询分布式缓存
        ValueOperations<String, String> valueOps = stringRedisTemplate.opsForValue();
        cachedValue = valueOps.get(cacheKey);
        if (cachedValue != null) {
            // 缓存命中，返回结果
            Page<Picture> result = convertJsonToPicturePage(cachedValue);
            LOCAL_CACHE.put(cacheKey, cachedValue);
            return ResultUtils.success(pictureDomainService.getPictureVoPage(result, request));
        }

        // 查询数据库
        Page<Picture> result = pictureDomainService.page(new Page<>(current, size),
                pictureDomainService.getQueryWrapper(pictureQueryRequest));

        // 更新本地缓存，设置随机过期时间1~3分钟
        String cacheValue = JSONUtil.toJsonStr(result);
        long localCacheTtl = ThreadLocalRandom.current().nextLong(1, 4); // 1-3分钟（不包含4）
        LOCAL_CACHE.put(cacheKey, cacheValue);

        // 更新Redis缓存，设置随机过期时间3~5分钟
        long redisCacheTtl = ThreadLocalRandom.current().nextLong(3, 6); // 3-5分钟（不包含6）
        valueOps.set(cacheKey, cacheValue, redisCacheTtl, TimeUnit.MINUTES);
        return ResultUtils.success(pictureDomainService.getPictureVoPage(result, request));
    }




    @PostMapping("/edit")
    @Operation(summary = "编辑图片")
    @SaSpaceCheckPermission(value = SpaceUserPermissionConstant.PICTURE_EDIT)
    public BaseResponse<Boolean> editPicture(@RequestBody PictureEditRequest pictureEditRequest, HttpServletRequest request) {
        if (pictureEditRequest == null || pictureEditRequest.getId() <= 0){
            throw new BusinessException(ErrorCode.PARAMS_ERROR);
        }
        User loginUser = userApplicationService.getLoginUser(request);
        pictureDomainService.editPicture(pictureEditRequest, loginUser);
        //清除缓存
        clearCache("listPage");
        clearCache("listPageVo");
        return ResultUtils.success(true);
    }

    @PostMapping("/review")
    @Operation(summary = "【管理员】图片审核")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Boolean> doPictureReview(@RequestBody PictureReviewRequest pictureReviewRequest, HttpServletRequest request) {
        ThrowUtils.throwIf(pictureReviewRequest == null, ErrorCode.PARAMS_ERROR);
        User loginUser = userApplicationService.getLoginUser(request);
        pictureDomainService.doPictureReview(pictureReviewRequest, loginUser);
        //清除缓存
        clearCache("listPage");
        clearCache("listPageVo");
        return ResultUtils.success(true);
    }

    @PostMapping("/review/batch")
    @Operation(summary = "【管理员】图片批量审核")
    @AuthCheck(mustRole = UserConstant.ADMIN_ROLE)
    public BaseResponse<Boolean> doPictureReviewByBatch(@RequestBody PictureReviewByBatchRequest pictureReviewByBatchRequest, HttpServletRequest request) {
        ThrowUtils.throwIf(pictureReviewByBatchRequest == null, ErrorCode.PARAMS_ERROR);
        User loginUser = userApplicationService.getLoginUser(request);
        pictureDomainService.doPictureReviewByBatch(pictureReviewByBatchRequest, loginUser);
        //清除缓存
        clearCache("listPage");
        clearCache("listPageVo");
        return ResultUtils.success(true);
    }

    @PostMapping("/edit/batch")
    @Operation(summary = "批量编辑图片")
    @SaSpaceCheckPermission(value = SpaceUserPermissionConstant.PICTURE_EDIT)
    public BaseResponse<Boolean> editPictureByBatch(@RequestBody PictureEditByBatchRequest pictureEditByBatchRequest, HttpServletRequest request) {
        ThrowUtils.throwIf(pictureEditByBatchRequest == null, ErrorCode.PARAMS_ERROR);
        User loginUser = userApplicationService.getLoginUser(request);
        pictureDomainService.editPictures(pictureEditByBatchRequest, loginUser);
        //清除缓存
        clearCache("listPage");
        clearCache("listPageVo");
        return ResultUtils.success(true);
    }

    @PostMapping("/upload/batch")
    @Operation(summary = "批量上传图片")
    @SaSpaceCheckPermission(value = SpaceUserPermissionConstant.PICTURE_UPLOAD)
    public BaseResponse<List<PictureVo>> uploadPictureByBatch(
            @RequestPart("file") MultipartFile[] multipartFiles,
            PictureUploadRequest pictureUploadRequest,
            HttpServletRequest request) {
        //用户校验
        User loginUser = userApplicationService.getLoginUser(request);
        ThrowUtils.throwIf(loginUser == null, ErrorCode.NO_AUTH_ERROR);
        // 参数校验
        ThrowUtils.throwIf(multipartFiles == null || multipartFiles.length == 0, ErrorCode.PARAMS_ERROR, "未选择任何文件");
        ThrowUtils.throwIf(multipartFiles.length > 10, ErrorCode.PARAMS_ERROR, "单次上传文件数量不能超过10个");
        //格式校验，只上传符合后缀要求的图片
        MultipartFile[] AllowedMultipartFiles = PictureUtil.filterAllowedImages(multipartFiles);
        log.info("实际上传图片数量：{}", AllowedMultipartFiles.length);
        // 批量上传处理
        List<PictureVo> pictureVos = pictureDomainService.uploadPictures(AllowedMultipartFiles, pictureUploadRequest, loginUser);
        //清除缓存
        clearCache("listPage");
        clearCache("listPageVo");
        return ResultUtils.success(pictureVos);
    }

    @PostMapping("/delete/batch")
    @Operation(summary = "批量删除图片")
    @SaSpaceCheckPermission(value = SpaceUserPermissionConstant.PICTURE_DELETE)
    public BaseResponse<Boolean> deletePictureByBatch(@RequestBody DeleteRequest deleteRequest, HttpServletRequest request) {
        User loginUser = userApplicationService.getLoginUser(request);
        List<Long> PictureIds = deleteRequest.getIds();
        //参数校验
        ThrowUtils.throwIf(loginUser == null, ErrorCode.NO_AUTH_ERROR);
        // 双重判断ids是否传递，以及传递了是否为空列表
        if (PictureIds == null || PictureIds.isEmpty()){
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "未选择图片");
        }
        //批量删除图片
        Boolean result = pictureDomainService.deletePictures(PictureIds, loginUser);
        //清除缓存
        clearCache("listPage");
        clearCache("listPageVo");
        return ResultUtils.success(result);
    }
    @GetMapping("/tag_category")
    @Operation(summary = "标签和分类")
    public BaseResponse<PictureTagCategory> listPictureTagCategory() {
        PictureTagCategory pictureTagCategory = new PictureTagCategory();
        List<String> tagList = Arrays.asList("动漫", "日本旅行", "风景", "表情", "壁纸");
        List<String> categoryList = Arrays.asList("模板", "二次元", "回忆", "素材", "旅游");
        pictureTagCategory.setTagList(tagList);
        pictureTagCategory.setCategoryList(categoryList);
        return ResultUtils.success(pictureTagCategory);
    }

    /**
     * 缓存类型转换处理
     * @param cachedValue 缓存中的数据
     * @return Page<Picture> 对象
     */
    private static Page<Picture> convertJsonToPicturePage(String cachedValue) {
        Page<?> tempResult = JSONUtil.toBean(cachedValue, Page.class);
        // 创建一个新的Page<Picture>实例
        Page<Picture> result = new Page<>();
        result.setCurrent(tempResult.getCurrent());//设置当前页码
        result.setSize(tempResult.getSize());//设置每页记录数
        result.setTotal(tempResult.getTotal());//设置总记录数

        // 处理records列表中的JSONObject对象
        List<Picture> pictureRecords = new ArrayList<>();
        for (Object obj : tempResult.getRecords()) {
            if (obj instanceof JSONObject jsonObj) {
                //
                Picture picture = jsonObj.toBean(Picture.class);
                pictureRecords.add(picture);
            } else if (obj instanceof Picture) {
                pictureRecords.add((Picture) obj);
            }
        }
        result.setRecords(pictureRecords);
        return result;
    }

    private final Cache<String, String> LOCAL_CACHE =
            Caffeine.newBuilder().initialCapacity(1024)
                    .maximumSize(10000L)
                    // 缓存随机1~3分钟移除，防止集体过期
                    .expireAfterWrite(ThreadLocalRandom.current().nextLong(1, 4), TimeUnit.MINUTES)
                    .build();
    /**
     * 清除指定前缀的缓存
     *
     * @param keyPrefix 缓存键前缀
     */
    public void clearCache(String keyPrefix) {
        // 清除本地缓存
        LOCAL_CACHE.invalidateAll();
        // 清除Redis缓存中与指定前缀相关的缓存
        stringRedisTemplate.delete(stringRedisTemplate.keys(keyPrefix + "*"));
    }

    @PostMapping("/upload/dev")
    @Operation(summary = "【开发测试】上传图片-绕过鉴权")
    public BaseResponse<PictureVo> uploadPictureDev(
            @RequestPart("file") MultipartFile multipartFile,
            PictureUploadRequest pictureUploadRequest) {
        // 创建测试用户（固定用户ID，用于压测）
        User testUser = new User();
        testUser.setId(1L); // 使用固定测试用户ID，也可改为从请求参数传入
        testUser.setUserAccount("test_user");
        testUser.setUserName("测试用户");
        testUser.setUserRole("user");

        // 直接调用领域层服务，绕过应用层的鉴权逻辑
        PictureVo pictureVo = pictureDomainService.uploadPicture(multipartFile, pictureUploadRequest, testUser);

        // 清除缓存
        clearCache("listPage");
        clearCache("listPageVo");

        return ResultUtils.success(pictureVo);
    }
}
