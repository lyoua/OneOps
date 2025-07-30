#!/bin/bash

# 综合运维平台后端启动脚本

echo "正在启动综合运维平台后端服务..."

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python3"
    exit 1
fi

# 检查pip是否安装
if ! command -v pip3 &> /dev/null; then
    echo "错误: 未找到pip3，请先安装pip3"
    exit 1
fi

# 创建虚拟环境（如果不存在）
if [ ! -d "venv" ]; then
    echo "创建Python虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
echo "激活虚拟环境..."
source venv/bin/activate

# 安装依赖
echo "安装Python依赖包..."
pip install -r requirements.txt

# 启动Flask应用
echo "启动Flask服务器..."
echo "服务地址: http://192.168.50.81:8000"
echo "按 Ctrl+C 停止服务"
echo "----------------------------------------"
python app.py