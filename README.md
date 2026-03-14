# StableLauncher

**StableLauncher** is a high-performance, modern Minecraft launcher built with Electron, Vite, and Vue 3. It features an AI-powered "Mod Shield" for security, smart JVM optimization, and a sleek, customizable interface.

![StableLauncher Logo](resources/icon.png)

> [!IMPORTANT]
> **StableLauncher only supports Windows.**

## ✨ Features

- **🛡️ AI Mod Shield**: Scans mod folders for suspicious patterns and cross-references with Modrinth/CurseForge to ensure safety.
- **⚡ Smart JVM Optimization**: Analyzes your hardware to automatically set the best memory allocation and garbage collection flags.
- **🎨 Premium UI**: A modern, glassmorphic design with smooth animations and dynamic themes.
- **☁️ Multi-Instance Management**: Easily create and manage multiple Minecraft installations.
- **🔗 Integrated Browser**: Browse and install mods directly from Modrinth within the launcher.
- **📡 Discord RPC**: Share your game status with friends automatically.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)
- [Java 8/17/21](https://adoptium.net/) (depending on the Minecraft version you play)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/SamObviously/StableLauncher.git
   cd StableLauncher
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

### Building for Production

To create a standalone executable for Windows:
```bash
npm run build:win
```
The output will be in the `dist` folder.

## 🛠️ Tech Stack

- **Framework**: Electron + Vite
- **Frontend**: Vue 3 + Tailwind CSS
- **Icons**: Lucide Vue Next
- **Styling**: Vanilla CSS + Glassmorphism
- **API Integrations**: Modrinth, CurseForge (via custom handlers)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---
Created with ❤️ by **SamObviously**
**Note: this is my first Github project, please support!**
