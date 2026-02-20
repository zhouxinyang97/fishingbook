# Fishing Book v2.1 API Events (埋点与事件)

## 1. 核心事件 (Core Events)

### 1.1 书库更新 (Library Update)
- **事件名**: `LIBRARY_UPDATED`
- **触发时机**:
  - 添加新书。
  - 移除书籍。
  - 重命名书籍。
  - 刷新列表。
- **数据 (Payload)**:
  - `total_books`: 当前书籍总数 (Int)
  - `added_book_id`: 新增书籍 ID (String, Optional)
  - `removed_book_id`: 移除书籍 ID (String, Optional)

### 1.2 阅读进度 (Reading Progress)
- **事件名**: `PROGRESS_UPDATED`
- **触发时机**:
  - 翻页结束。
  - 滚动停止 (debounce 500ms)。
  - 切换章节。
  - 关闭阅读窗口。
- **数据 (Payload)**:
  - `book_id`: 书籍 ID (String)
  - `percentage`: 当前进度百分比 (Float, 0.0 - 100.0)
  - `current_offset`: 当前字符偏移量 (Long)
  - `timestamp`: 事件发生时间 (Long)

### 1.3 打开书籍 (Open Book)
- **事件名**: `BOOK_OPENED`
- **触发时机**:
  - 用户双击列表项。
  - 启动应用恢复上次阅读。
- **数据 (Payload)**:
  - `book_id`: 书籍 ID (String)
  - `file_type`: 文件类型 (String, e.g., "txt", "epub")
  - `file_size`: 文件大小 (Bytes)
  - `encoding`: 文件编码 (String)

## 2. 埋点统计 (Analytics - Local Only)
*注：考虑到隐私和隐蔽性，所有埋点仅用于本地调试日志或可选的匿名统计，默认不上传。*

### 2.1 活跃度 (Engagement)
- **每日阅读时长**: 记录 `BOOK_OPENED` 到 `APP_CLOSED` 或 `BOSS_KEY_PRESSED` 的累计时长。
- **最常阅读书籍**: 统计 `BOOK_OPENED` 次数最多的 `book_id` (仅本地记录)。

### 2.2 异常监控 (Error Tracking)
- **文件加载失败**: `FILE_LOAD_ERROR`
  - `file_path`: 路径 (Hash 处理后)
  - `error_code`: 错误码 (e.g., `FILE_NOT_FOUND`, `PERMISSION_DENIED`)
- **编码识别失败**: `ENCODING_ERROR`
  - `file_path`: 路径 (Hash 处理后)
  - `detected_encoding`: 自动检测结果
