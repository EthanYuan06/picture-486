FROM python:3.14

WORKDIR /app

# 使用国内镜像源, 避免 pypi.org 在国内下载缓慢
ENV UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple

# 安装uv
RUN --mount=type=cache,target=/root/.cache/pip pip install -i ${UV_INDEX_URL}  uv

# 复制依赖文件
COPY pyproject.toml uv.lock ./

# 同步依赖到 .venv 虚拟环境
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev
RUN /app/.venv/bin/python -c "import glob, pathlib, shutil, site; sp = pathlib.Path(site.getsitepackages()[0]); shutil.rmtree(sp / 'redis', ignore_errors=True); [shutil.rmtree(pathlib.Path(p), ignore_errors=True) for p in glob.glob(str(sp / 'redis-*.dist-info'))]"
RUN /app/.venv/bin/python -m ensurepip --upgrade
RUN /app/.venv/bin/python -m pip install --no-cache-dir -i ${UV_INDEX_URL} --force-reinstall redis==6.4.0

# 关键：把虚拟环境加入PATH
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app"

# 复制业务代码
COPY . .

# 暴露端口
EXPOSE 8024

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8024"]
