# 🏗️ StableLauncher Build Guide

> [!IMPORTANT]
> **StableLauncher currently only supports the Windows Operating System.** Support for macOS and Linux is not currently implemented.

This manual will guide you through building StableLauncher from source and packaging it into an executable.


## 1. Prerequisites

Before you begin, ensure your system has the following environments installed:

- **Node.js**: [LTS Version (v18+)](https://nodejs.org/)
- **npm**: Usually comes installed with Node.js
- **Java**: A Java Runtime Environment required to run Minecraft (if you need to test the launcher)

## 2. Setup

If you haven't cloned the repository yet:

```bash
git clone https://github.com/SamObviously/StableLauncher.git
cd StableLauncher
```

Install all project dependencies:

```bash
npm install
```

## 3. Development Mode

To start the launcher in development mode (live preview changes):

```bash
npm run dev
```

## 4. Build & Package

### Build Windows Version (.exe)
This is the most common build command, which generates an installer and a portable folder for Windows.

```bash
npm run build:win
```

### Building for Other Platforms
- **macOS / Linux**: Not supported at this time.


## 5. Output Location

After building, you can find the generated files in the following directories:

- **`dist/`**: Contains the final `.exe` installer.
- **`out/`**: Contains the compiled intermediate JavaScript code.

## 6. Troubleshooting

- **Dependency Errors**: If `npm install` fails, try deleting the `node_modules` folder and `package-lock.json`, then reinstall.
- **TypeScript Errors**: Run `npm run typecheck` to check for type issues in the code.
- **Permission Issues**: When building on Windows, ensure you run the terminal as a normal user or administrator and avoid operating in restricted or protected folders.

---
SamObviously - *StableLauncher Development Guy*
