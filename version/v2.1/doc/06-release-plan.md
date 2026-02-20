# Fishing Book v2.1 Release Plan (发布计划)

## 1. 阶段目标 (Phase Goals)
- **v2.1.0 (MVP)**:
  - 核心功能：书库列表、添加本地 TXT/EPUB、进度保存与恢复。
  - 交互体验：双击打开书籍，拖拽添加文件。
  - UI 风格：隐蔽式侧边栏，支持 Dark/Light 主题。
  - **预计耗时**: 2周 (10个工作日)。

## 2. 详细时间表 (Detailed Timeline)

### 第一周 (Week 1): 核心数据与 UI 搭建
- **Day 1-2**:
  - 设计 `LibraryManager` 类，定义 JSON 数据结构。
  - 实现 `LibraryStore` (Load/Save JSON) 逻辑。
  - 完成 `addBook(filePath)` 和 `removeBook(bookId)` 核心逻辑测试。
- **Day 3-5**:
  - 开发侧边栏 UI (`LibraryView`)，使用 ListView/TableView 组件。
  - 实现拖拽文件到侧边栏 (`DragAndDrop`) 功能。
  - 集成 `LibraryManager` 到 `MainWindow`，支持列表刷新。

### 第二周 (Week 2): 阅读进度与交互优化
- **Day 6-7**:
  - 修改 `ReaderView`，使其能够接收 `bookId` 并加载内容。
  - 实现阅读进度监听 (`ScrollEvent` -> `updateProgress`)。
  - 实现书库列表中的进度条 (`ProgressBar`) 或百分比显示。
- **Day 8**:
  - 实现双击列表项打开书籍 (`MouseDoubleClick`).
  - 处理文件丢失、编码错误等异常情况 (`ErrorHandling`).
- **Day 9**:
  - 隐蔽性优化：调整侧边栏宽度、颜色，使其更像 IDE 文件树。
  - 添加右键菜单 (`ContextMenu`): 重命名伪装、移除。
- **Day 10**:
  - 全面测试 (集成测试、边界测试)。
  - 编写 v2.1 版本发布说明 (Release Notes)。
  - 打包发布 (Release Build)。

## 3. 风险评估 (Risk Assessment)
- **风险 1**: 大文件 (100MB+) 加载卡顿。
  - **对策**: 采用流式读取或分块加载，仅读取当前视口内容。
- **风险 2**: 频繁写入 JSON 导致 IO 性能问题。
  - **对策**: 严格执行 Debounce (防抖) 策略，仅在关键节点写入。
- **风险 3**: 编码识别错误导致乱码。
  - **对策**: 引入成熟的编码检测库 (如 `chardet`)，并提供手动修正入口。

## 4. 人员分工 (Roles)
- **后端 (Core Logic)**: 1人 (负责数据存储、文件 IO)。
- **前端 (UI/UX)**: 1人 (负责界面绘制、交互逻辑)。
- **测试 (QA)**: 1人 (兼职，负责回归测试)。
