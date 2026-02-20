# Fishing Book v2.1 PRD Outline

## 1. 版本概述 (Version Overview)
v2.1 版本主要聚焦于 **书库管理 (Library Management)** 功能的引入。
在此之前，用户每次阅读都需要手动打开文件，无法方便地管理多本书籍或快速切换。
本版本旨在提供一个轻量级、扁平化的单一书库，帮助用户沉淀本地书籍，并直观地查看阅读进度，同时保持 v1.0 的极简与隐蔽风格。

## 2. 核心特性 (Core Features)
- **单一书库 (Single Library)**: 无文件夹、无分类的扁平化书籍列表。
- **本地导入 (Local Import)**: 支持将本地 `.txt`, `.epub` 文件添加到书库。
- **进度展示 (Progress Display)**: 在书库列表中显示每本书的阅读进度（百分比）。
- **隐蔽 UI (Stealth UI)**: 书库界面沿用 IDE 风格（如项目文件列表），避免突兀。

## 3. 文档结构 (Documentation Structure)
- **01-personas.md**: 用户画像 (新增 "囤书党" 角色)
- **02-user-stories.md**: 用户故事 (围绕书库管理与快速切换)
- **03-wireframes.md**: 界面原型 (书库列表页、添加书籍交互)
- **04-feature-spec.md**: 功能详述 (数据存储、列表逻辑、进度计算)
- **05-api-events.md**: 埋点与事件 (书库行为追踪)
- **06-release-plan.md**: 发布计划 (开发、测试与上线时间表)
