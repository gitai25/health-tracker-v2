# Health Tracker - VPS 部署指南

## 快速部署

### 1. 上传代码到 VPS

```bash
# 方式1: Git 克隆
git clone https://github.com/your-repo/health-tracker-v2.git
cd health-tracker-v2

# 方式2: SCP 上传
scp -r health-tracker-v2 user@your-vps:/home/user/
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
nano .env.local
```

必须配置：
```bash
AUTH_PASSWORD=你的访问密码
AUTH_SECRET=随机字符串至少32位
OURA_ACCESS_TOKEN=你的Oura Token
WHOOP_ACCESS_TOKEN=你的Whoop Token
```

### 3. 部署

```bash
chmod +x deploy/deploy.sh
bash deploy/deploy.sh
```

### 4. 配置 Nginx

```bash
# 复制配置
sudo cp deploy/nginx.conf /etc/nginx/sites-available/health-tracker

# 修改域名
sudo nano /etc/nginx/sites-available/health-tracker

# 启用
sudo ln -s /etc/nginx/sites-available/health-tracker /etc/nginx/sites-enabled/

# 测试并重载
sudo nginx -t && sudo systemctl reload nginx
```

### 5. (可选) 配置 HTTPS

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs health-tracker

# 重启
pm2 restart health-tracker

# 停止
pm2 stop health-tracker
```

---

## 访问

- 打开 `http://your-vps-ip:3000` 或配置的域名
- 输入 `AUTH_PASSWORD` 中设置的密码登录
