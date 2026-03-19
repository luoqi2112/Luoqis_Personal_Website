# Start Page

个人导航主页，纯原生 HTML/CSS/JavaScript 实现，无需构建工具，适合部署到 GitHub Pages。

## 快速开始

1. **本地预览**：使用 VS Code Live Server 或其他静态服务器打开 `index.html`
2. **部署**：将仓库推送到 GitHub，启用 GitHub Pages 即可

> 注意：直接双击打开 `index.html` 可能因浏览器安全限制无法加载配置文件，建议使用本地服务器预览。

## 配置说明

所有配置集中在 `data/config.json`：

| 配置项           | 说明                       |
| ---------------- | -------------------------- |
| `site`           | 网站标题、副标题、链接     |
| `profile`        | 个人信息、头像、爱好标签   |
| `wallpapers`     | 背景壁纸（支持图片和视频） |
| `search.engines` | 搜索引擎列表               |
| `profiles`       | 账号入口（GitHub、邮箱等） |
| `collections`    | 收藏夹分类                 |

### 更换头像

修改 `profile.avatarSrc` 路径，或直接替换 `assets/touxiang.jpg`。

### 更换壁纸

1. 将图片/视频放入 `assets/wallpapers/`
2. 在 `wallpapers.items` 中添加配置：
   ```json
   { "type": "image", "src": "assets/wallpapers/xxx.jpg", "credit": "描述" }
   { "type": "video", "src": "assets/wallpapers/xxx.mp4", "poster": "封面图路径", "credit": "描述" }
   ```

## 主要功能

- **壁纸轮播**：支持图片和视频，可手动切换
- **多引擎搜索**：Google、Bing、DuckDuckGo
- **站内搜索**：搜索账号、收藏、相册
- **Todo 待办**：本地存储，快速添加
- **相册展示**：瀑布流布局

## 目录结构

```
├── index.html          # 页面入口
├── styles.css          # 样式
├── data/config.json    # 主配置文件
├── assets/             # 静态资源
│   ├── wallpapers/     # 壁纸
│   └── photos/         # 相册照片
└── scripts/            # JavaScript 模块
```
