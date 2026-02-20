# Fishing Book v2.1 Wireframes (界面原型)

## 1. 书库列表 (Library List)
### 1.1 布局与样式
- **左侧侧边栏** (Library Sidebar):
  - 宽度: 200px - 300px (可调整)
  - 风格: 极简，类似 IDE 文件浏览器 (`Project Explorer` / `Solution Explorer`).
  - 内容: 单一列表，垂直排列。
- **列表项 (Book Item)**:
  - 格式: `[图标] 书名 (进度)`
  - 图标: 伪装成文件图标 (TXT, EPUB, JAVA, LOG).
  - 书名: 截断显示，支持右键重命名伪装。
  - 进度: 右对齐，显示百分比 (`12%`) 或页码 (`P.123`).
  - 选中态: 高亮背景色 (跟随 IDE 主题色).

### 1.2 顶部操作栏 (Library Toolbar)
- **位置**: 侧边栏顶部。
- **按钮**:
  - `+` (Add): 打开文件选择器，添加本地书籍。
  - `R` (Refresh): 刷新列表 (用于手动同步进度或重新加载文件).
  - `S` (Settings): 齿轮图标，打开设置面板。

### 1.3 底部状态栏 (Status Bar)
- **位置**: 侧边栏底部。
- **内容**:
  - `Total: N books`: 总书数。
  - `Reading: X`: 当前正在阅读的书名简写。

## 2. 交互流程 (Interaction Flow)
### 2.1 添加书籍 (Adding Books)
1. 点击 `+` 按钮 -> 打开系统文件选择器。
2. 选择一个或多个文件 -> 确认。
3. 书库列表刷新，新书出现在顶部。
4. 默认选中第一本新书，并自动打开阅读。

### 2.2 阅读书籍 (Reading Books)
1. 在书库列表中双击某书 -> 右侧阅读区域加载内容。
2. 阅读区域滚动 -> 书库列表中该书的进度实时更新 (每翻一页或滚动一定距离)。
3. 切换到另一本书 -> 当前书进度保存 -> 新书加载 -> 新书进度恢复。

### 2.3 管理书籍 (Managing Books)
- **右键菜单**:
  - `Open`: 打开阅读。
  - `Rename (Alias)`: 设置伪装书名 (如把《斗破苍穹》改为 `UserAuthService.java`).
  - `Remove from Library`: 移除记录 (保留本地文件).
  - `Show in Explorer`: 在系统资源管理器中定位文件。

## 3. 视觉风格 (Visual Style)
- **暗黑模式 (Dark Mode)**:
  - 背景: `#1E1E1E` (VS Code Dark).
  - 字体: `#D4D4D4` (VS Code Default Text).
  - 选中背景: `#264F78` (VS Code Selection).
- **明亮模式 (Light Mode)**:
  - 背景: `#FFFFFF` (VS Code Light).
  - 字体: `#333333`.
  - 选中背景: `#E8E8E8`.
- **伪装性**: 必须看起来像一个普通的文本编辑器侧边栏。
