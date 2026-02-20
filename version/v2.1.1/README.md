# FishingBook v2.1.1

简洁、高效的开发者读书/日志阅读器。本版本在 v2.1.0 的基础上，增强了阅读体验的个性化定制能力。

## 本次更新（v2.1.1）

- **个性化阅读设置**
  - **字体大小自定义**：支持 12px - 64px 范围内的无级调节，提供滑块与数值输入框双向同步控制。
  - **字体颜色自定义**：
    - 提供 5 种预设阅读色（经典灰、纯白、浅灰、米黄、护眼绿）。
    - **新增调色板**：支持调用系统取色器选择任意颜色，满足深色/浅色背景下的多样化需求。
  - **设置持久化**：自动保存用户的字体与颜色偏好，重启应用后自动恢复。

- **基础功能回顾（v2.1.0）**
  - **书库管理**：支持添加 .txt/.log/.md 文件，自动记录阅读进度。
  - **窗口交互**：自定义无边框窗口，支持四边/四角拖拽缩放、置顶、最大化/恢复。
  - **性能优化**：拖拽缩放时自动隐藏内容层，提升流畅度。
  - **编码支持**：自动检测常见文件编码，避免乱码。

## 安装与运行

### 直接使用（Windows）

前往 GitHub Releases 下载 Windows 二进制文件：

- **安装包**：`fishingbook.2.1.1-win-x64-nsis.exe`（推荐，含快捷方式与卸载）
- **绿色版**：`fishingbook.2.1.1-win-x64-portable.exe`（单文件，即点即用）

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
