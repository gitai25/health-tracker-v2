#!/bin/bash
# Health Tracker VPS 部署脚本
# 使用: bash deploy.sh

set -e

echo "===== Health Tracker 部署脚本 ====="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    sudo npm install -g pm2
fi

# 安装依赖
echo "安装依赖..."
npm install

# 检查 .env.local
if [ ! -f .env.local ]; then
    echo ""
    echo "⚠️  请先配置 .env.local 文件:"
    echo "   cp .env.example .env.local"
    echo "   nano .env.local"
    echo ""
    exit 1
fi

# 构建
echo "构建项目..."
npm run build

# 启动/重启 PM2
echo "启动服务..."
pm2 delete health-tracker 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "✅ 部署完成!"
echo ""
echo "查看状态: pm2 status"
echo "查看日志: pm2 logs health-tracker"
echo ""
echo "下一步: 配置 Nginx 反向代理 (参考 deploy/nginx.conf)"
