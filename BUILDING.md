# 🏗️ StableLauncher 构建教学 (Build Guide)

本手册将引导你如何从源代码构建 StableLauncher，并打包为可执行文件。

## 1. 准备工作 (Prerequisites)

在开始之前，请确保你的系统已安装以下环境：

- **Node.js**: [LTS 版本 (v18+)](https://nodejs.org/)
- **npm**: 通常随 Node.js 一起安装
- **Java**: 运行 Minecraft 所需的 Java 运行环境 (如果你需要测试运行)

## 2. 克隆与安装 (Setup)

如果你还没有克隆仓库：

```bash
git clone https://github.com/SamObviously/samlauncher-sl.git
cd samlauncher-sl
```

安装所有项目依赖：

```bash
npm install
```

## 3. 开发模式 (Development)

要在开发环境下启动启动器（实时预览修改）：

```bash
npm run dev
```

## 4. 构建与打包 (Build & Package)

### 构建 Windows 版本 (.exe)
这是最常用的构建命令，它会生成适合 Windows 的安装程序和绿色版文件夹。

```bash
npm run build:win
```

### 其他平台的构建
如果要为其他平台打包（需要相应的操作系统环境）：

- **macOS**: `npm run build:mac`
- **Linux**: `npm run build:linux`

## 5. 输出位置 (Output)

构建完成后，你可以在以下目录找到生成的文件：

- **`dist/`**: 包含最终的 `.exe` 安装程序。
- **`out/`**: 包含编译后的中间 JavaScript 代码。

## 6. 常见问题排查 (Troubleshooting)

- **依赖报错**: 如果 `npm install` 失败，请尝试删除 `node_modules` 文件夹和 `package-lock.json` 后重新安装。
- **TypeScript 错误**: 运行 `npm run typecheck` 来检查代码中的类型问题。
- **权限问题**: 在 Windows 上构建时，请确保以普通用户或管理员身份运行终端，不要在受限的受保护文件夹中操作。

---
SamObviously - *StableLauncher Development Team*
