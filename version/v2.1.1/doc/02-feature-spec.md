# Fishing Book v2.1.1 功能规格书 (Feature Spec)

## 1. 概览
v2.1.1 在 v2.1.0 基础上增加字体大小和颜色的自定义功能。该功能将作为阅读体验增强的一部分，允许用户在阅读界面直接调整显示效果。

## 2. 功能详细设计
### 2.1 字体设置面板 (Font Settings Panel)
- **入口**：在主界面顶部工具栏（Header）的右侧（现有窗口控制按钮左侧）增加一个“设置”或“Aa”图标按钮。
- **交互**：点击图标后，弹出一个浮动的小面板（Popup），再次点击或点击外部区域关闭。
- **面板内容**：
    - **字体大小 (Font Size)**：
        - 一个滑块（Slider）或 +/- 按钮。
        - 范围：12px 至 32px，步长 1px。
        - **数值输入框**：允许用户直接输入具体数值，输入后自动同步滑块并应用。
    - **字体颜色 (Font Color)**：
        - 预设颜色块（例如：白色、亮灰、米黄、护眼绿）。
        - **自定义调色板**：增加一个带有“+”号或取色图标的按钮，点击后调用系统原生调色板 (`<input type="color">`)，允许用户选择任意颜色并应用。
    - **重置按钮**：恢复默认设置。

### 2.2 状态持久化 (Persistence)
- **存储**：利用现有的 `userData` 存储机制（`config.json` 或类似），新增 `preferences` 字段。
- **结构**：
  ```json
  {
    "preferences": {
      "fontSize": 16,
      "fontColor": "#cccccc"
    }
  }
  ```
- **加载**：应用启动时读取配置，并应用到 `content-area`。

### 2.3 视觉与交互反馈
- 调整大小时，内容区域的文字实时变化。
- 调整颜色时，内容区域的文字颜色实时变化。
- 面板样式需保持与 VS Code 风格一致（深色背景，边框，阴影）。

## 3. UI 原型设计思路 (UI Design Concept)
### 3.1 Header 布局变更
- 原有：[Library] ... [Minimize][Maximize][Close]
- 新增：[Library] ... [**Settings/Aa**] [Minimize][Maximize][Close]

### 3.2 设置面板样式
- 绝对定位，位于 Settings 按钮下方。
- 背景色：`#252526` (VS Code 侧边栏色) 或 `#333333`。
- 边框：`1px solid #454545`。
- 阴影：`0 2px 8px rgba(0, 0, 0, 0.5)`。
- 控件：
    - Label: `font-size: 12px; color: #cccccc;`
    - Slider: 标准 HTML range input，样式定制为深色。
    - Color: 圆形色块或 input[type=color]。

## 4. 技术实现 (Technical Implementation)
- **Renderer Process**:
    - 增加 `toggleSettings()` 函数控制面板显示/隐藏。
    - 监听 Slider `input` 事件 -> 更新 `document.body.style.fontSize` 或特定容器样式。
    - 监听 Color `change` 事件 -> 更新 `color` 样式。
    - 使用 `window.api.data.save` 保存配置。
- **CSS**:
    - 使用 CSS 变量 `--main-font-size` 和 `--main-font-color` 管理样式，方便统一调整。
    - `#content-area { font-size: var(--main-font-size); color: var(--main-font-color); }`

## 5. 测试计划 (Test Plan)
1.  **功能测试**：
    - 验证点击设置按钮能否正确展开/收起面板。
    - 验证滑动滑块，字体大小是否实时变化。
    - 验证选择颜色，字体颜色是否实时变化。
    - 验证重置按钮是否恢复默认。
2.  **持久化测试**：
    - 调整设置后关闭应用，重新打开，验证设置是否保留。
3.  **兼容性测试**：
    - 验证在不同分辨率下面板位置是否正确。
    - 验证极大/极小字体下布局是否正常（自动换行）。
