# FishingBook v2.1.0

简洁、高效的开发者读书/日志阅读器。本版本在保持 v1.0 极简风格的基础上，带来更顺畅的窗口交互与「书库」能力。

## 本次更新（v2.1.0）

- 书库管理
  - 支持添加本地 .txt/.log/.md 文件到单一书库
  - 列表显示「文件名 + 阅读进度」，点击切换阅读
  - 删除条目不影响原文件
- 阅读体验
  - 自动保存阅读进度（基于滚动位置，防抖写入）
  - 打开书籍时自动恢复到上次阅读位置
- 窗口与交互
  - 自定义窗口控制：置顶、最小化、最大化/恢复、关闭
  - 支持四边 + 四角拖拽缩放窗口
  - 拖拽缩放时启用覆盖层并临时隐藏重内容，显著提升顺滑度
  - 修复最大化后无法恢复到上一次大小的问题（记录 previousBounds 并在 unmaximize 后恢复）
  - 透明度滑块（右下角悬浮控制区）
- 文件编码与表现
  - 自动检测常见编码（UTF-8/GB18030/UTF-16 LE 等），避免乱码
  - 以类日志格式渲染内容（时间戳/颜色样式），保留原文可读性

## 安装与运行

### 直接使用（Windows）

前往 GitHub Releases 下载 Windows 二进制文件（命名示例）：

- 安装包：`fishingbook.2.1.0-win-x64-nsis.exe`
- 绿色版：`fishingbook.2.1.0-win-x64-portable.exe`

### 源码运行

```bash
git clone <your-repo-url>
cd fishing_book
npm ci
npm start
```

### 打包构建（Windows）

```bash
npm run dist:win
```

打包产物默认输出至 `dist/`，命名规则：`fishingbook.${version}-${os}-${arch}[-nsis|-portable].${ext}`。

## 调试说明（VS Code）

项目已提供 VS Code 调试配置：

- 主进程：`Electron: Main`
- 附加渲染进程：`Electron: Attach Renderer (9222)`
- 一键主+渲染：`Electron: Main + Renderer`

文件位置：`.vscode/launch.json`。

## 已知限制

- 当前发布仅提供 Windows 安装包与绿色版。如需其他平台支持（Linux/macOS），请在 Issue 中提出或提交 PR。

## 许可

ISC License。

---

感谢使用 FishingBook，欢迎反馈问题与建议。祝阅读愉快！
