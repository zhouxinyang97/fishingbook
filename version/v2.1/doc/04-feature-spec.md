# Fishing Book v2.1 Feature Specification (功能详述)

## 1. 书库数据模型 (Library Data Model)
### 1.1 数据结构 (JSON Schema)
书库信息将存储在本地 JSON 文件中（如 `library.json`），包含以下字段：

```json
{
  "version": "2.1",
  "last_opened_book_id": "book_uuid_1",
  "books": [
    {
      "id": "uuid_v4",          // 唯一标识符
      "title": "Clean Code",    // 书名 (默认文件名，可重命名)
      "file_path": "/path/to/Clean Code.txt", // 绝对路径
      "file_type": "txt",       // 文件类型 (txt, epub)
      "encoding": "UTF-8",      // 自动检测的编码
      "added_at": 1698765432,   // 添加时间戳
      "progress": {
        "percentage": 15.5,     // 阅读进度百分比 (0-100)
        "current_page": 123,    // 当前页码 (可选)
        "total_pages": 800,     // 总页数 (可选)
        "last_read_at": 1698770000 // 上次阅读时间
      },
      "alias": "UserAuthService.java" // 伪装名称 (可选)
    }
  ]
}
```

### 1.2 数据存储 (Storage)
- **位置**: 用户配置目录下 (e.g., `~/.fishing_book/library.json`).
- **读写策略**:
  - 启动时加载整个 JSON 到内存。
  - 添加/删除书籍时立即写入文件。
  - 阅读进度更新采用 **Debounce (防抖)** 策略：每 5 秒或切换书籍/关闭应用时写入一次，避免频繁 IO。

## 2. 核心逻辑 (Core Logic)
### 2.1 添加书籍 (Add Book)
1. **输入**: 文件路径列表。
2. **校验**:
   - 文件是否存在？
   - 格式是否支持 (txt, epub)？
   - 是否已存在于库中 (根据 `file_path` 判断)？
3. **处理**:
   - 若存在：更新 `last_read_at`，不重复添加。
   - 若不存在：生成 UUID，提取文件名作为 `title`，检测编码，初始化 `progress` 为 0。
4. **输出**: 更新后的书籍列表，触发 `LIBRARY_UPDATED` 事件。

### 2.2 移除书籍 (Remove Book)
1. **输入**: 书籍 ID。
2. **处理**: 从 `books` 数组中移除对应项。
3. **副作用**: 如果移除的是当前正在阅读的书，清空阅读区域或自动打开上一本书。
4. **输出**: 更新后的书籍列表，触发 `LIBRARY_UPDATED` 事件。

### 2.3 阅读进度同步 (Sync Progress)
1. **触发时机**:
   - 翻页/滚动停止。
   - 窗口关闭。
   - 切换书籍。
2. **处理**:
   - 计算当前视口顶部的字符偏移量或页码。
   - 计算百分比 = `current_offset / total_length * 100`.
   - 更新内存中的 `book` 对象。
   - 触发 `PROGRESS_UPDATED` 事件 (用于刷新 UI)。
   - 异步写入 `library.json`。

## 3. 异常处理 (Error Handling)
- **文件丢失**: 打开书籍时检测文件是否存在。若不存在，弹出提示“文件已移动或删除”，并询问是否从库中移除。
- **编码错误**: 打开书籍时若乱码，提供手动选择编码 (UTF-8, GBK, ISO-8859-1) 的选项，并保存选择到 `encoding` 字段。
- **JSON 损坏**: 启动时若 `library.json` 解析失败，备份原文件为 `library.json.bak` 并创建新的空库。

## 4. 窗口管理 (Window Management)
### 4.1 窗口缩放 (Window Resizing)
- **功能**: 用户可以通过拖拽窗口的四个边缘（上、下、左、右）以及四个角落（左上、右上、左下、右下）来调整窗口大小。
- **限制**: 最小尺寸为 400x300，最大尺寸受限于屏幕分辨率。
- **实现**:
  - 在窗口边缘和角落增加不可见的 `resize-handle` 区域 (top, bottom, left, right, corner-br, corner-tl, corner-tr, corner-bl)。
  - 使用 IPC 通信获取初始窗口位置 (`getBounds`)，并根据鼠标位移计算新的 `x, y, width, height`。
  - 考虑到无边框窗口 (Frameless Window)，需要在 CSS 中定义可拖拽区域 (`-webkit-app-region: drag`) 和不可拖拽区域 (`no-drag`)。

### 4.2 性能优化 (Performance Optimization)
- **拖拽覆盖层 (Resize Overlay)**:
  - 为了解决无边框窗口自定义缩放时的卡顿和鼠标脱离问题，在开始拖拽时显示一个全屏透明覆盖层 (`#resize-overlay`)。
  - 该覆盖层负责捕获所有鼠标事件，确保拖拽过程流畅。
- **DOM 隐藏策略 (DOM Hiding)**:
  - 在拖拽过程中，暂时隐藏重型内容区域 (`#content-area`)，只保留窗口框架。
  - 拖拽结束后，恢复内容显示并根据百分比还原滚动位置。
  - 此策略显著减少了浏览器在每一帧重排 (Reflow) 大量文本的开销。
