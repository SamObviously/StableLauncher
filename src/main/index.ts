/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type */
import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { Client, Authenticator } from 'minecraft-launcher-core'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import crypto from 'crypto'
import si from 'systeminformation'

let statsInterval: NodeJS.Timeout | null = null

async function getSystemStats(instanceProcess?: any) {
  const cpus = os.cpus()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem

  // CPU usage
  let totalIdle = 0
  let totalTick = 0
  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type]
    }
    totalIdle += cpu.times.idle
  })
  const cpuUsage = 1 - totalIdle / totalTick

  // GPU & VRAM
  let gpuUsage = 0
  let vramUsed = 0
  let vramTotal = 0
  let gpuModel = 'Unknown GPU'
  try {
    const gpuData = await si.graphics()
    const mainGpu = gpuData.controllers[0]
    if (mainGpu) {
      gpuUsage = mainGpu.utilizationGpu || 0
      vramUsed = (mainGpu.memoryUsed || 0) * 1024 * 1024
      vramTotal = (mainGpu.memoryTotal || 0) * 1024 * 1024
      gpuModel = mainGpu.model || 'Unknown GPU'
    }
  } catch (e) {
    /* ignore */
  }

  // Java Allocated Memory (if process provided)
  let javaMem = 0
  if (instanceProcess && instanceProcess.pid) {
    try {
      const procInfo = await si.processes()
      const mcProc = procInfo.list.find((p) => p.pid === instanceProcess.pid)
      if (mcProc) {
        javaMem = mcProc.memRss * 1024 // RSS in KB -> B
      }
    } catch (e) {
      /* ignore */
    }
  }

  return {
    cpu: Math.round(cpuUsage * 100),
    ramUsage: usedMem,
    ramTotal: totalMem,
    ramFree: freeMem,
    gpu: Math.round(gpuUsage),
    gpuModel,
    vramUsed,
    vramTotal,
    javaMem
  }
}

function startStatsBroadcasting(window: BrowserWindow, proc?: any) {
  if (statsInterval) clearInterval(statsInterval)
  statsInterval = setInterval(async () => {
    if (!window.isDestroyed()) {
      const stats = await getSystemStats(proc)
      window.webContents.send('system-stats', stats)
    }
  }, 1000)
}

function stopStatsBroadcasting() {
  if (statsInterval) {
    clearInterval(statsInterval)
    statsInterval = null
  }
}

import DiscordRPC from 'discord-rpc'
import { exec, spawn } from 'child_process'
import AdmZip from 'adm-zip'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Auth } = require('msmc')

const RPC_CLIENT_ID = '1348421876523171850'
let rpc: DiscordRPC.Client | null = null

function initRPC() {
  rpc = new DiscordRPC.Client({ transport: 'ipc' })
  rpc.on('ready', () => {
    rpc?.setActivity({
      details: 'Browsing Instances',
      state: 'StableLauncher Beta Version',
      largeImageKey: 'icon',
      largeImageText: 'StableLauncher',
      instance: false
    })
  })
  rpc.login({ clientId: RPC_CLIENT_ID }).catch(console.error)
}

function updateRPC(details: string, state: string) {
  try {
    rpc?.setActivity({
      details,
      state,
      largeImageKey: 'icon',
      largeImageText: 'SamLauncher',
      instance: false,
      startTimestamp: new Date()
    })
  } catch (e) {
    console.error('RPC Error:', e)
  }
}

const launcher = new Client()
const authManager = new Auth('select_account')

// The directory where Minecraft will be installed (default: ~/.minecraft or %appdata%/.minecraft)
const getMinecraftPath = () => {
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      '.minecraft'
    )
  } else if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'minecraft')
  } else {
    return path.join(os.homedir(), '.minecraft')
  }
}

// Global Config & Instances store
const userDataPath = app.getPath('userData')
const configPath = path.join(userDataPath, 'config.json')
const instancesPath = path.join(userDataPath, 'instances.json') // Array of instances

function readJSON(file: string, def: any = {}) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    }
  } catch (e) {
    console.error('Failed to read config file', e)
  }
  return def
}

function writeJSON(file: string, data: any) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('Failed to write config file', e)
  }
}

let userConfig = readJSON(configPath, {
  authType: 'offline',
  username: 'Player',
  memoryMax: '4G',
  memoryMin: '2G',
  windowWidth: 854,
  windowHeight: 480,
  fullscreen: false,
  authData: null // Stores MSMC token or Offline Auth Object
})

let appInstances = readJSON(instancesPath, [])

// === AI Engine Management ===
let aiProcess: any = null
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  initRPC()
  setupIpcHandlers()
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Config IPCs
  ipcMain.handle('get-config', () => userConfig)
  ipcMain.handle('save-config', (_, newConfig) => {
    userConfig = { ...userConfig, ...newConfig }
    writeJSON(configPath, userConfig)
    return { success: true }
  })

  // Instances IPCs
  ipcMain.handle('get-instances', () => appInstances)
  ipcMain.handle('save-instances', (_, newInstances) => {
    appInstances = newInstances
    writeJSON(instancesPath, appInstances)
    return { success: true }
  })

  // Microsoft Auth Process
  ipcMain.handle('login-microsoft', async () => {
    try {
      const xboxManager = await authManager.launch('electron')
      const token = await xboxManager.getMinecraft()

      const auth = {
        access_token: token.mclc().access_token,
        client_token: token.mclc().client_token,
        uuid: token.mclc().uuid,
        name: token.mclc().name,
        user_properties: token.mclc().user_properties,
        meta: {
          type: 'mojang',
          demo: false
        }
      }
      return { success: true, auth }
    } catch (err: any) {
      console.error('MSMC Error:', err)
      return { success: false, error: err.message }
    }
  })

  // Set up IPC handler to fetch Minecraft versions
  ipcMain.handle('fetch-versions', async () => {
    try {
      const response = await fetch(
        'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
      )
      const data = await response.json()
      // Filter out snapshots, only keep releases for simplicity
      // and only return versions >= 1.12.2 and <= 1.21.11 (or latest)
      const releases = data.versions.filter((v: any) => v.type === 'release')
      return { success: true, versions: releases }
    } catch (err: any) {
      console.error('Failed to fetch versions:', err)
      return { success: false, error: err.message }
    }
  })

  // Enhanced Java detection for Windows
  const getJavaPath = (versionStr: string): string => {
    const verParts = versionStr.split('.')
    const minor = parseInt(verParts[1]) || 0

    const possiblePaths: string[] = []

    if (process.platform === 'win32') {
      const progFiles = process.env.ProgramFiles || 'C:\\Program Files'
      const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'

      const commonRoots = [
        path.join(progFiles, 'Eclipse Adoptium'),
        path.join(progFiles, 'Java'),
        path.join(progFiles, 'Microsoft'),
        path.join(progFiles, 'Zulu'),
        path.join(progFiles, 'Amazon Corretto'),
        path.join(progFilesX86, 'Java')
      ]

      if (minor >= 21 || (minor === 20 && verParts[2] && parseInt(verParts[2]) >= 5)) {
        // 1.20.5+ and 1.21+ require Java 21
        commonRoots.forEach((root) => {
          if (fs.existsSync(root)) {
            const dirs = fs.readdirSync(root)
            const match = dirs.find(
              (d) => d.includes('21') || d.includes('jdk-21') || d.includes('jre-21')
            )
            if (match) possiblePaths.push(path.join(root, match, 'bin', 'java.exe'))
          }
        })
      } else if (minor >= 17) {
        // 1.17 through 1.20.4 should ideally use Java 17
        commonRoots.forEach((root) => {
          if (fs.existsSync(root)) {
            const dirs = fs.readdirSync(root)
            const match = dirs.find(
              (d) => d.includes('17') || d.includes('jdk-17') || d.includes('jre-17')
            )
            if (match) possiblePaths.push(path.join(root, match, 'bin', 'java.exe'))
          }
        })
      } else {
        // 1.16.5 and below require Java 8
        commonRoots.forEach((root) => {
          if (fs.existsSync(root)) {
            const dirs = fs.readdirSync(root)
            const match = dirs.find(
              (d) => d.includes('8') || d.includes('1.8') || d.includes('jre8')
            )
            if (match) possiblePaths.push(path.join(root, match, 'bin', 'java.exe'))
          }
        })
      }
    }

    // Check if any of these possible paths actually exist
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) return p
    }

    // Emergency rescue check: programmatically find anything that looks like java
    return 'java'
  }

  // Helper to install Fabric programmatically into the global .minecraft versions folder
  async function prepareFabric(versionStr: string, rootPath: string, event: any) {
    event.sender.send('launch-progress', { status: 'Fetching Fabric metadata...', progress: 10 })
    const loaderRes = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${versionStr}`)
    const loaders = await loaderRes.json()
    if (!loaders || loaders.length === 0)
      throw new Error(`No Fabric loader found for Minecraft ${versionStr}`)

    const loaderVersion = loaders[0].loader.version
    const profileName = `fabric-loader-${loaderVersion}-${versionStr}`

    const versionFolder = path.join(rootPath, 'versions', profileName)
    if (!fs.existsSync(versionFolder)) {
      event.sender.send('launch-progress', {
        status: 'Downloading Fabric profile...',
        progress: 15
      })
      const profileRes = await fetch(
        `https://meta.fabricmc.net/v2/versions/loader/${versionStr}/${loaderVersion}/profile/json`
      )
      const profileJson = await profileRes.text()
      fs.mkdirSync(versionFolder, { recursive: true })
      fs.writeFileSync(path.join(versionFolder, `${profileName}.json`), profileJson)
    }

    return profileName
  }

  // Prism-style Forge/NeoForge installer: uses meta.prismlauncher.org to download libs directly
  // No Java installer needed — much faster than the official Forge/NeoForge installer
  async function prepareModloader(
    versionStr: string,
    rootPath: string,
    modloader: string,
    event: any
  ) {
    if (modloader === 'vanilla') return undefined

    const uid = modloader === 'forge' ? 'net.minecraftforge' : 'net.neoforged'
    const loaderLabel = modloader === 'forge' ? 'Forge' : 'NeoForge'

    event.sender.send('launch-progress', {
      stage: 'forge',
      status: `Fetching ${loaderLabel} versions from Prism meta...`,
      progress: 10
    })

    event.sender.send('installer-log', `Fetching ${loaderLabel} versions from Prism meta...`)
    const indexRes = await fetch(`https://meta.prismlauncher.org/v1/${uid}/index.json`)
    if (!indexRes.ok)
      throw new Error(`Failed to fetch ${loaderLabel} index: HTTP ${indexRes.status}`)
    const index = await indexRes.json()

    // Find recommended, or latest version for this MC version
    const candidates = index.versions.filter((v: any) =>
      v.requires?.some((r: any) => r.uid === 'net.minecraft' && r.equals === versionStr)
    )
    if (candidates.length === 0) throw new Error(`No ${loaderLabel} available for MC ${versionStr}`)
    const recommended = candidates.find((v: any) => v.recommended) || candidates[0]
    const forgeVersion = recommended.version // e.g. "61.1.3" for Forge or "21.4.12" for NeoForge

    // 2. Check if this version profile already exists — skip full install if so
    const versionsDir = path.join(rootPath, 'versions')
    if (!fs.existsSync(versionsDir)) fs.mkdirSync(versionsDir, { recursive: true })
    const profileName = `${uid}-${forgeVersion}`
    const profileDir = path.join(versionsDir, profileName)
    const librariesDir = path.join(rootPath, 'libraries')
    if (!fs.existsSync(librariesDir)) fs.mkdirSync(librariesDir, { recursive: true })

    const profileJsonPath = path.join(profileDir, `${profileName}.json`)
    const installerJarForArgs = () => {
      try {
        return (
          fs
            .readdirSync(librariesDir, { recursive: true })
            .map((f) => path.join(librariesDir, f as string))
            .find((f) => f.includes(forgeVersion) && f.endsWith('-installer.jar')) || ''
        )
      } catch {
        return ''
      }
    }

    if (fs.existsSync(profileJsonPath)) {
      // Complete install found — build ForgeWrapper args from cached installer JAR
      const installerJar = installerJarForArgs()
      const fwArgs = installerJar
        ? [
            `-Dforgewrapper.librariesDir=${librariesDir}`,
            `-Dforgewrapper.installerJar=${installerJar}`,
            `-Dforgewrapper.minecraft=${path.join(rootPath, 'versions', versionStr, `${versionStr}.jar`)}`
          ]
        : []
      event.sender.send('launch-progress', {
        stage: 'forge',
        status: `${loaderLabel} ${forgeVersion} already installed`,
        progress: 100
      })
      return { profileName, forgeWrapperArgs: fwArgs }
    }

    // Directory exists but JSON is missing — partial/corrupted install, clean up and redo
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true })
      event.sender.send('launch-progress', {
        stage: 'forge',
        status: `Cleaning incomplete ${loaderLabel} install...`,
        progress: 12
      })
    }

    // 3. Fetch the version-specific JSON to get library list, mainClass, and args
    event.sender.send('installer-log', `Downloading ${loaderLabel} ${forgeVersion} metadata...`)
    const versionRes = await fetch(`https://meta.prismlauncher.org/v1/${uid}/${forgeVersion}.json`)
    if (!versionRes.ok) {
      event.sender.send('installer-log', `Error: Failed to fetch metadata for ${loaderLabel} ${forgeVersion}`)
      throw new Error(`Failed to fetch ${loaderLabel} version JSON: HTTP ${versionRes.status}`)
    }
    const versionJson = await versionRes.json()

    // 4. Download all libraries in parallel (Prism provides direct artifact URLs)

    // Pre-process libraries to ensure they all have a 'path' field (e.g. ForgeWrapper prism build omits it)
    const libs: any[] = (versionJson.libraries || []).map((lib: any) => {
      const artifact = lib.downloads?.artifact
      if (artifact && !artifact.path && lib.name) {
        const parts = lib.name.split(':')
        const [group, artId, ver, classifier] = parts
        const groupPath = group.replace(/\./g, '/')
        artifact.path = `${groupPath}/${artId}/${ver}/${artId}-${ver}${classifier ? '-' + classifier : ''}.jar`
      }
      return lib
    })

    let downloaded = 0
    const allFiles = libs.length + (versionJson.mavenFiles?.length || 0)

    await Promise.all(
      libs.map(async (lib: any) => {
        const artifact = lib.downloads?.artifact
        if (!artifact?.url || !artifact?.path) return

        const libPath = path.join(librariesDir, artifact.path.replace(/\//g, path.sep))
        if (fs.existsSync(libPath)) {
          downloaded++
          return
        }

        fs.mkdirSync(path.dirname(libPath), { recursive: true })
        const libRes = await fetch(artifact.url)
        if (!libRes.ok) {
          console.warn(
            `[Forge Meta] Failed to download lib ${artifact.path}: HTTP ${libRes.status}`
          )
          return
        }
        fs.writeFileSync(libPath, Buffer.from(await libRes.arrayBuffer()))
        downloaded++
        const pct = 20 + Math.round((downloaded / allFiles) * 70)
        event.sender.send('launch-progress', {
          stage: 'forge',
          status: `Downloading ${loaderLabel} libs... (${downloaded}/${allFiles})`,
          progress: pct
        })
      })
    )

    // 4b. Download mavenFiles — ForgeWrapper needs the installer JAR at runtime!
    const mavenFiles: any[] = versionJson.mavenFiles || []
    let installerJarPath = ''

    await Promise.all(
      mavenFiles.map(async (mf: any) => {
        const artifact = mf.downloads?.artifact
        if (!artifact?.url) return

        // Installer JAR may not have a 'path' — derive from Maven name
        let relPath = artifact.path
        if (!relPath) {
          // name is like "net.minecraftforge:forge:1.21.11-61.1.3:installer"
          const parts = mf.name.split(':')
          const [group, name, ver, classifier] = parts
          const groupPath = group.replace(/\./g, '/')
          relPath = `${groupPath}/${name}/${ver}/${name}-${ver}${classifier ? '-' + classifier : ''}.jar`
        }

        const mfPath = path.join(librariesDir, relPath.replace(/\//g, path.sep))
        if (mf.name.includes(':installer')) installerJarPath = mfPath

        if (!fs.existsSync(mfPath)) {
          fs.mkdirSync(path.dirname(mfPath), { recursive: true })
          const mfRes = await fetch(artifact.url)
          if (!mfRes.ok) {
            console.warn(
              `[Forge Meta] Failed to download maven file ${relPath}: HTTP ${mfRes.status}`
            )
            return
          }
          fs.writeFileSync(mfPath, Buffer.from(await mfRes.arrayBuffer()))
        }
      })
    )

    // 5. Build & write a minecraft-launcher-core compatible version JSON
    // Detect the correct mainClass:
    // - If ForgeWrapper is in the library list → it must be the main class
    // - Otherwise fall back to what the Prism JSON says, then vanilla
    const forgeWrapperLib = [...libs, ...mavenFiles].find((l: any) =>
      (l.name || '').includes('ForgeWrapper')
    )
    let mainClass =
      versionJson.mainClass || versionJson['+mainClass'] || 'net.minecraft.client.main.Main'
    if (forgeWrapperLib) {
      if (
        forgeWrapperLib.name.includes('prism-2024') ||
        forgeWrapperLib.name.includes('prism-2025')
      ) {
        mainClass = 'io.github.zekerzhayard.forgewrapper.installer.Main'
      } else {
        mainClass = 'io.github.zekerzhayard.ForgeWrapper.wrapper.Main'
      }
    }

    // If installer JAR not found in mavenFiles, download it directly from Forge Maven
    // (Forge 1.21.1+ omits mavenFiles from meta, needing manual download)
    if (!installerJarPath) {
      const installerRelPath = `net/minecraftforge/forge/${versionStr}-${forgeVersion}/forge-${versionStr}-${forgeVersion}-installer.jar`
      const installerLocalPath = path.join(librariesDir, installerRelPath.replace(/\//g, path.sep))
      if (!fs.existsSync(installerLocalPath)) {
        event.sender.send('launch-progress', {
          stage: 'forge',
          status: `Downloading installer JAR...`,
          progress: 95
        })
        const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${versionStr}-${forgeVersion}/forge-${versionStr}-${forgeVersion}-installer.jar`
        const installerRes = await fetch(installerUrl)
        if (installerRes.ok) {
          fs.mkdirSync(path.dirname(installerLocalPath), { recursive: true })
          fs.writeFileSync(installerLocalPath, Buffer.from(await installerRes.arrayBuffer()))
          installerJarPath = installerLocalPath
        } else {
          console.warn(`[Forge] Could not download installer JAR: HTTP ${installerRes.status}`)
        }
      } else {
        installerJarPath = installerLocalPath
      }
    }

    const profileJson = {
      id: profileName,
      type: 'release',
      inheritsFrom: versionStr,
      releaseTime: versionJson.releaseTime || new Date().toISOString(),
      time: new Date().toISOString(),
      mainClass,
      minecraftArguments: versionJson.minecraftArguments,
      arguments: versionJson.arguments,
      libraries: libs.map((lib: any) => ({
        name: lib.name,
        downloads: lib.downloads
      }))
    }

    fs.mkdirSync(profileDir, { recursive: true })
    fs.writeFileSync(
      path.join(profileDir, `${profileName}.json`),
      JSON.stringify(profileJson, null, 2)
    )

    event.sender.send('launch-progress', {
      stage: 'forge',
      status: `${loaderLabel} ${forgeVersion} installed!`,
      progress: 100
    })

    // Return ForgeWrapper JVM args that must be passed at launch time
    // Use quotes for paths in case they contain spaces
    const forgeWrapperArgs =
      forgeWrapperLib && installerJarPath
        ? [
            `-Dforgewrapper.librariesDir="${librariesDir}"`,
            `-Dforgewrapper.installerJar="${installerJarPath}"`,
            `-Dforgewrapper.minecraft="${path.join(rootPath, 'versions', versionStr, `${versionStr}.jar`)}"`
          ]
        : []

    console.log(
      `[Forge] mainClass=${mainClass}, installerJar=${installerJarPath}, fwArgs=${forgeWrapperArgs.length}`
    )

    return { profileName, forgeWrapperArgs }
  }

  // Track running game process so we can kill it
  let runningProcess: any = null
  let runningInstanceId: string | null = null

  // Kill the running game
  ipcMain.handle('kill-minecraft', async () => {
    if (runningProcess) {
      try {
        runningProcess.kill('SIGKILL')
      } catch {
        // Already dead
      }
      runningProcess = null
      runningInstanceId = null
      return { success: true }
    }
    return { success: false, error: 'No running instance' }
  })

  ipcMain.handle('get-running-instance', async () => runningInstanceId)

  // Set up the launch IPC handler
  ipcMain.handle(
    'launch-minecraft',
    async (
      event,
      {
        username,
        version,
        memoryMax = '4G',
        memoryMin = '2G',
        authData = null, // Can pass cached auth directly
        windowWidth = 854,
        windowHeight = 480,
        fullscreen = false,
        customJavaPath = '',
        customGamePath = '',
        modloader = 'vanilla',
        instanceId = 'default',
        jvmArgs = '-XX:+UseG1GC',
        compatibilityMode = false
      }
    ) => {
      try {
        let auth = authData

        // If no valid authData provided, fallback to offline
        if (!auth) {
          event.sender.send('launch-progress', {
            status: 'Authenticating Offline...',
            progress: 20
          })
          auth = await Authenticator.getAuth(username || 'Player')
        }

        const finalJavaPath = customJavaPath ? path.normalize(customJavaPath.trim()) : getJavaPath(version)
        const globalRoot = customGamePath ? path.normalize(customGamePath.trim()) : getMinecraftPath()

        console.log('[Launcher] Debug Environment:', {
          _JAVA_OPTIONS: process.env._JAVA_OPTIONS,
          JAVA_TOOL_OPTIONS: process.env.JAVA_TOOL_OPTIONS,
          customJavaPath,
          finalJavaPath,
          os: `${os.type()} ${os.release()}`,
          arch: os.arch()
        })

        // Isolate instances to root/instances/[id]
        const instanceDir = path.join(globalRoot, 'instances', instanceId)
        if (!fs.existsSync(instanceDir)) {
          fs.mkdirSync(instanceDir, { recursive: true })
        }

        // Handle Modloaders
        let customVersionName: string | undefined = undefined
        const forgePath: string | undefined = undefined
        let forgeJVMArgs: string[] = []

        if (modloader === 'fabric') {
          customVersionName = await prepareFabric(version, globalRoot, event)
        } else if (modloader === 'quilt') {
          // Quilt uses same meta structure as Fabric
          event.sender.send('launch-progress', {
            status: 'Fetching Quilt metadata...',
            progress: 10
          })
          const loaderRes = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${version}`)
          const loaders = await loaderRes.json()
          if (!loaders || loaders.length === 0)
            throw new Error(`No Quilt loader found for Minecraft ${version}`)
          const loaderVersion = loaders[0].loader.version
          const profileName = `quilt-loader-${loaderVersion}-${version}`
          const versionFolder = path.join(globalRoot, 'versions', profileName)
          if (!fs.existsSync(versionFolder)) {
            event.sender.send('launch-progress', {
              status: 'Downloading Quilt profile...',
              progress: 15
            })
            const profileRes = await fetch(
              `https://meta.quiltmc.org/v3/versions/loader/${version}/${loaderVersion}/profile/json`
            )
            const profileJson = await profileRes.text()
            fs.mkdirSync(versionFolder, { recursive: true })
            fs.writeFileSync(path.join(versionFolder, `${profileName}.json`), profileJson)
          }
          customVersionName = profileName
        } else if (modloader === 'forge' || modloader === 'neoforge') {
          const result = await prepareModloader(version, globalRoot, modloader, event)
          if (result && typeof result === 'object') {
            customVersionName = result.profileName
            // Inject ForgeWrapper JVM args so it can find the installer JAR at launch
            if (result.forgeWrapperArgs?.length) {
              forgeJVMArgs = result.forgeWrapperArgs
            }
          }
        }
        // liteloader: vanilla launch, mods go into $instanceDir/mods

        updateRPC(`Playing ${version}`, `${modloader.toUpperCase()} - ${instanceId}`)

        // 2. Configure Launcher
        const opts = {
          clientPackage: undefined,
          authorization: auth,
          root: globalRoot,
          version: {
            number: version,
            type: 'release',
            ...(customVersionName ? { custom: customVersionName } : {})
          },
          forge: forgePath,
          memory: {
            max: memoryMax,
            min: memoryMin
          },
          window: {
            width: parseInt(windowWidth) || 854,
            height: parseInt(windowHeight) || 480,
            fullscreen: Boolean(fullscreen)
          },
          ...(finalJavaPath !== 'java' ? { javaPath: finalJavaPath } : {}),
          customArgs: [
            ...forgeJVMArgs,
            ...jvmArgs
              .split(' ')
              .filter((a) => a.trim() !== '' && !a.startsWith('-Xmx') && !a.startsWith('-Xms')),
            ...(compatibilityMode ? ['-Xshare:off', '-Dsun.java2d.d3d=false', '-XX:-TieredCompilation'] : [])
          ],
          overrides: {
            gameDirectory: instanceDir // This forces saves/mods to be completely isolated!
          }
        }

        // 3. Setup event listeners to report progress back to UI
        // [MOD V1.6.3] We attach the debug listener BEFORE calling launch() 
        // to catch early Java outputs and the command string immediately.
        launcher.on('debug', (e) => {
          if (typeof e === 'string') {
            console.log('[MCLC Debug]', e)
            event.sender.send('game-log', e)

            // Catch the command strings. MCLC usually prints "[MCLC]: Command: java ..."
            // Aggressive capture: even if it doesn't say "Command:", if it starts with "java" and is long, it's the cmd.
            const lowerE = e.toLowerCase().trim()
            const isCommand = lowerE.startsWith('command:') || 
                            ((lowerE.startsWith('java') || lowerE.includes('javaw.exe')) && lowerE.includes('-cp') && e.length > 200)

            if (isCommand) {
              let cmd = e
              if (lowerE.includes('command:')) {
                const parts = e.split(/ommand:/i)
                cmd = parts[parts.length - 1].trim()
              }
              console.log('[DEBUG Backend] Captured Launch Command:', cmd.substring(0, 100) + '...')
              event.sender.send('final-launch-command', cmd)
            }
          }
        })

        launcher.on('data', (e) => {
          console.log('data', e)
          event.sender.send('game-log', e)
          event.sender.send('launch-progress', { status: 'Starting JVM...', progress: 100 })
        })

        launcher.on('progress', (e) => {
          if (e.total && e.total > 0) {
            const percent = (e.task / e.total) * 100
            event.sender.send('launch-progress', {
              stage: 'mc',
              status: `Downloading ${e.type}... (${e.task}/${e.total})`,
              progress: Math.floor(percent)
            })
          } else {
            event.sender.send('launch-progress', {
              stage: 'mc',
              status: `Downloading ${e.type}...`,
              progress: 0
            })
          }
        })

        // 4. Launch!
        event.sender.send('launch-progress', {
          stage: 'mc',
          status: 'Initializing...'
        })
        console.log('[Launcher] Starting with options:', JSON.stringify(opts, null, 2))
        const proc = await launcher.launch(opts)

        // Track process for Kill button
        runningProcess = proc
        runningInstanceId = instanceId
        mainWindow?.webContents.send('game-started', { instanceId })
        if (mainWindow) startStatsBroadcasting(mainWindow, proc)

        const startTime = Date.now()

        const handleGameExit = (code: number) => {
          const playtimeMs = Date.now() - startTime
          const instIndex = appInstances.findIndex((i: any) => i.id === instanceId)
          if (instIndex !== -1) {
            appInstances[instIndex].playtime = (appInstances[instIndex].playtime || 0) + playtimeMs
            writeJSON(instancesPath, appInstances)
          }
          runningProcess = null
          runningInstanceId = null
          stopStatsBroadcasting()
          mainWindow?.webContents.send('game-close', { instanceId, code, playtimeMs })
        }

        // When game exits, notify renderer
        if (proc && proc.on) {
          proc.on('close', (code: number) => handleGameExit(code))
          proc.on('error', () => handleGameExit(-1))
        }

        return { success: true }
      } catch (err: any) {
        console.error('Launch Error:', err)
        return { success: false, error: err.message || 'Unknown error occurred' }
      }
    }
  )
}

function setupIpcHandlers() {
  ipcMain.handle('get-ai-config', async () => {
    return {
      apiKey: process.env.VITE_AI_API_KEY || '',
      provider: 'openai'
    }
  })

  // AI MOD SHIELD: Scan mods folder with Advanced Logic & AI Analysis
  ipcMain.handle('scan-mods', async (_event, { instanceId }) => {
    try {
      const inst = appInstances.find((i: any) => i.id === instanceId)
      if (!inst) return { success: false, error: 'Instance not found' }

      const userConfig = readJSON(path.join(userDataPath, 'config.json')) || {}
      const root = userConfig.customGamePath || getMinecraftPath()
      const modsDir = path.join(root, 'instances', instanceId, 'mods')

      if (!fs.existsSync(modsDir)) return { success: true, issues: [] }

      const files = fs.readdirSync(modsDir).filter((f) => f.toLowerCase().endsWith('.jar'))
      const issues: any[] = []

      for (const file of files) {
        try {
          const filePath = path.join(modsDir, file)
          const stats = fs.statSync(filePath)
          if (stats.size > 150 * 1024 * 1024) continue // Skip huge jars

          // 1. Improved Filename Heuristics
          const criticalWords = ['infected', 'virus', 'malware', 'stealer', 'token', 'grabber']
          const suspiciousWords = ['hack', 'crack', 'cheat', 'nuker', 'bypass']

          const lowerFile = file.toLowerCase()
          if (criticalWords.some((w) => lowerFile.includes(w))) {
            issues.push({ file, type: 'CRITICAL: Known Malicious Pattern', severity: 'critical' })
            continue
          }
          if (suspiciousWords.some((w) => lowerFile.includes(w))) {
            issues.push({ file, type: 'Suspicious Filename', severity: 'high' })
          }

          // 2. Hash Matching via Modrinth (Primary)
          let foundOnModrinth = false
          try {
            const fileBuffer = fs.readFileSync(filePath)
            const hash = crypto.createHash('sha1').update(fileBuffer).digest('hex')

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000)
            const modRes = await fetch(`https://api.modrinth.com/v2/version_file/${hash}`, {
              headers: { 'User-Agent': 'StableLauncher/1.1.0' },
              signal: controller.signal
            })
            clearTimeout(timeoutId)

            if (modRes.ok) {
              foundOnModrinth = true
            }
          } catch (e) {
            console.warn(`Shield hash check skipped for ${file}:`, e instanceof Error ? e.message : e)
          }

          if (foundOnModrinth) continue

          // 3. Metadata Extraction & AI Analysis for Unknown Mods
          let description = ''
          let modName = ''
          try {
            const zip = new AdmZip(filePath)

            // Try to find mod metadata
            const fabricJson = zip.getEntry('fabric.mod.json')
            const mcmodInfo = zip.getEntry('mcmod.info')

            if (fabricJson) {
              const raw = zip.readAsText(fabricJson)
              try {
                const data = JSON.parse(raw)
                description = data.description || ''
                modName = data.name || data.id || ''
              } catch { /* malformed json */ }
            } else if (mcmodInfo) {
              const raw = zip.readAsText(mcmodInfo)
              try {
                const data = JSON.parse(raw)
                const info = Array.isArray(data) ? data[0] : data
                description = info?.description || ''
                modName = info?.name || info?.id || ''
              } catch { /* malformed json */ }
            }
          } catch (zipErr) {
            // If zip reading fails, it's either not a jar or corrupted/maliciously obfuscated
            issues.push({ file, type: 'Corrupted or Obfuscated JAR', severity: 'medium' })
            continue
          }

          if (description || modName) {
            // Check if AI Engine is available for "Smart Scan"
            const aiDir = path.join(userDataPath, 'ai')
            const hasModel = fs.existsSync(path.join(aiDir, 'model.gguf'))
            const isAIReady = hasModel && aiProcess !== null && !aiProcess.killed

            if (isAIReady) {
              try {
                const prompt = `Analyze this Minecraft mod info for malicious intent (stealing tokens, destroying files, etc).
Mod Name: ${modName}
Filename: ${file}
Description: ${description}
Respond with only a JSON: {"score": 0-10, "reason": "brief reason"}. Score 0 is safe, 10 is very dangerous.`

                const aiController = new AbortController()
                const aiTimeoutId = setTimeout(() => aiController.abort(), 15000)
                const aiRes = await fetch('http://127.0.0.1:11434/completion', {
                  method: 'POST',
                  body: JSON.stringify({ prompt, n_predict: 80 }),
                  headers: { 'Content-Type': 'application/json' },
                  signal: aiController.signal
                })
                clearTimeout(aiTimeoutId)

                if (aiRes.ok) {
                  const aiData: any = await aiRes.json()
                  const rawContent = aiData.content || ''
                  const jsonStart = rawContent.indexOf('{')
                  const jsonEnd = rawContent.lastIndexOf('}')
                  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                    try {
                      const analysis = JSON.parse(rawContent.substring(jsonStart, jsonEnd + 1))
                      const score = Number(analysis.score) || 0
                      if (score >= 7) {
                        issues.push({
                          file,
                          type: 'AI WARNING: Malicious Behavior Detected',
                          severity: 'high',
                          details: analysis.reason || 'High risk score from AI analysis'
                        })
                      } else if (score >= 4) {
                        issues.push({
                          file,
                          type: 'AI ADVISORY: Suspicious Content',
                          severity: 'medium',
                          details: analysis.reason || 'Moderate risk score from AI analysis'
                        })
                      }
                    } catch { /* AI returned invalid JSON, skip */ }
                  }
                }
              } catch (aiErr) {
                console.warn('AI Shield Scan skipped:', aiErr instanceof Error ? aiErr.message : aiErr)
              }
            } else {
              // No AI available — mild warning for unknown files
              const commonPrefixes = ['fabric-api', 'forge-', 'library', 'api', 'core', 'cloth-', 'architectury']
              if (!commonPrefixes.some((p) => lowerFile.startsWith(p))) {
                issues.push({
                  file,
                  type: 'Unknown Origin',
                  severity: 'low',
                  details: 'This mod is not in the Modrinth database. It might be safe, but use caution.'
                })
              }
            }
          } else {
            // No metadata at all — warn about unknown origin
            const commonPrefixes = ['fabric-api', 'forge-', 'library', 'api', 'core', 'cloth-', 'architectury']
            if (!commonPrefixes.some((p) => lowerFile.startsWith(p))) {
              issues.push({
                file,
                type: 'Unknown Origin (No Metadata)',
                severity: 'low',
                details: 'This mod has no metadata and is not in the Modrinth database.'
              })
            }
          }
        } catch (fileErr) {
          console.error(`Shield error processing ${file}:`, fileErr)
        }
      }

      return { success: true, issues }
    } catch (err: any) {
      console.error('AI Shield fatal error:', err)
      return { success: false, error: err.message }
    }
  })

  // Java & Path Helpers
  ipcMain.handle('detect-java', async () => {
    if (process.platform !== 'win32') return []
    const paths = [
      'C:\\Program Files\\Java',
      'C:\\Program Files (x86)\\Java',
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Adoptium'),
      path.join(process.env.APPDATA || '', '..', 'Local', 'Programs', 'Eclipse Foundation')
    ]
    const found: string[] = []
    for (const p of paths) {
      if (fs.existsSync(p)) {
        const sub = fs.readdirSync(p)
        for (const s of sub) {
          const exe = path.join(p, s, 'bin', 'javaw.exe')
          if (fs.existsSync(exe)) found.push(exe)
        }
      }
    }
    return found
  })

  ipcMain.handle('browse-file', async (_, { title, extensions }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title,
      properties: ['openFile'],
      filters: extensions ? [{ name: 'Allowed Files', extensions }] : []
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('browse-folder', async (_, { title }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title,
      properties: ['openDirectory']
    })
    return canceled ? null : filePaths[0]
  })


}

export function setupHandlers() {
  // Existing setup code...
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('get-minecraft-path', () => {
    return getMinecraftPath()
  })

  ipcMain.handle(
    'open-instance-folder',
    async (_event, { instanceId, customGamePath, folderType }) => {
      const root = customGamePath || getMinecraftPath()
      const folderPath = path.join(root, 'instances', instanceId, folderType || '')

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true })
      }

      await shell.openPath(folderPath)
      return true
    }
  )

  ipcMain.handle('list-mods', async (_event, { instanceId, customGamePath }) => {
    const root = customGamePath || getMinecraftPath()
    const modsFolder = path.join(root, 'instances', instanceId, 'mods')

    if (!fs.existsSync(modsFolder)) return []

    const files = fs.readdirSync(modsFolder)
    return files.filter((f) => f.endsWith('.jar'))
  })

  ipcMain.handle('list-worlds', async (_event, { instanceId, customGamePath }) => {
    const root = customGamePath || getMinecraftPath()
    const savesFolder = path.join(root, 'instances', instanceId, 'saves')
    if (!fs.existsSync(savesFolder)) return []
    return fs.readdirSync(savesFolder).filter((f) => {
      return fs.statSync(path.join(savesFolder, f)).isDirectory()
    })
  })

  ipcMain.handle('list-resourcepacks', async (_event, { instanceId, customGamePath }) => {
    const root = customGamePath || getMinecraftPath()
    const rpFolder = path.join(root, 'instances', instanceId, 'resourcepacks')
    if (!fs.existsSync(rpFolder)) return []
    return fs.readdirSync(rpFolder)
  })

  ipcMain.handle('list-shaderpacks', async (_event, { instanceId, customGamePath }) => {
    const root = customGamePath || getMinecraftPath()
    const shaderFolder = path.join(root, 'instances', instanceId, 'shaderpacks')
    if (!fs.existsSync(shaderFolder)) return []
    return fs.readdirSync(shaderFolder)
  })

  ipcMain.handle('list-servers', async (_event, { instanceId, customGamePath }) => {
    const root = customGamePath || getMinecraftPath()
    const serversDat = path.join(root, 'instances', instanceId, 'servers.dat')
    return { exists: fs.existsSync(serversDat) }
  })

  ipcMain.handle('download-mod', async (_event, { url, filename, instanceId, folderType }) => {
    const root = getMinecraftPath()
    const destFolder = path.join(root, 'instances', instanceId, folderType || 'mods')

    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true })
    }

    const filePath = path.join(destFolder, filename)
    const res = await fetch(url)
    const buffer = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(filePath, buffer)
    return true
  })

  ipcMain.handle('download-modpack-from-url', async (event, { url, filename }) => {
    try {
      const tempDir = path.join(os.tmpdir(), 'sam-launcher-temp')
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
      const filePath = path.join(tempDir, filename)

      event.sender.send('installer-log', `Downloading modpack from ${url}...`)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Download failed: ${res.statusText}`)
      const buffer = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync(filePath, buffer)

      // Use existing install-modpack logic
      // We manually invoke the handler logic here
      const result = await (ipcMain as any)._handlers['install-modpack'](event, filePath)
      
      // Cleanup temp file
      try { fs.unlinkSync(filePath) } catch(e) {}
      
      return result
    } catch (err: any) {
      console.error('Download Modpack Error:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('backup-instance-world', async (_event, { instanceId, customGamePath }) => {
    try {
      const root = customGamePath || getMinecraftPath()
      const instancePath = path.join(root, 'instances', instanceId)
      const savesPath = path.join(instancePath, 'saves')

      const backupsDir = path.join(getMinecraftPath(), 'backups')
      if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true })

      if (!fs.existsSync(savesPath)) {
        throw new Error('Saves folder not found in this instance.')
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupName = `backup-${instanceId}-${timestamp}.zip`
      const backupPath = path.join(backupsDir, backupName)

      // Use PowerShell to create zip on Windows
      // exec imported at top of file
      return new Promise((resolve) => {
        exec(
          `powershell -Command "Compress-Archive -Path '${savesPath}' -DestinationPath '${backupPath}' -Force"`,
          (error, _stdout, stderr) => {
            if (error) {
              console.error('Backup error:', stderr)
              resolve({ success: false, error: stderr || error.message })
            } else {
              resolve({ success: true, path: backupPath })
            }
          }
        )
      })
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Phase 13/14/15/16: Network Rescue & Image Proxy
  ipcMain.handle('search-mods', async (_, query, projectType, source = 'modrinth', sort = 'relevance', categoryId = '') => {
    try {
      if (source === 'curseforge') {
        const classId = projectType === 'modpack' ? 4471 : 6
        // Map sorts: 1=Featured, 2=Popularity, 3=LastUpdated, 4=Name, 5=Author, 6=TotalDownloads
        const sortMap: Record<string, number> = {
          relevance: 2,
          downloads: 6,
          updated: 3,
          newest: 3 // CF doesn't have a specific "newest" besides updated
        }
        const sField = sortMap[sort] || 2
        const categoryParam = categoryId ? `&categoryId=${categoryId}` : ''
        const url = `https://api.curse.tools/v1/cf/mods/search?gameId=432&classId=${classId}&searchFilter=${encodeURIComponent(query)}&sortField=${sField}&sortOrder=desc&pageSize=20${categoryParam}`
        const res = await fetch(url, {
          headers: {
            Accept: 'application/json'
          }
        })
        if (!res.ok) throw new Error(`CurseForge API status: ${res.status}`)
        const data = await res.json()

        const hits = await Promise.all(
          (data.data || []).map(async (h: any) => {
            let iconBase64 = ''
            if (h.logo?.thumbnailUrl) {
              try {
                const iRes = await fetch(h.logo.thumbnailUrl)
                if (iRes.ok) {
                  const iBuf = Buffer.from(await iRes.arrayBuffer())
                  iconBase64 = `data:image/png;base64,${iBuf.toString('base64')}`
                }
              } catch {
                /* ignore */
              }
            }

            return {
              id: h.id.toString(),
              project_id: h.id.toString(),
              title: h.name || 'Unknown Mod',
              description: h.summary || '',
              author: h.authors?.[0]?.name || 'Unknown',
              icon_url: iconBase64 || h.logo?.thumbnailUrl,
              categories: h.categories?.map((c: any) => c.name) || [],
              gallery: [],
              versions: [],
              source: 'curseforge'
            }
          })
        )
        return { success: true, hits }
      }

      const facets = projectType ? `&facets=[["project_type:${projectType}"]${categoryId ? `,["categories:${categoryId}"]` : ''}]` : ''
      const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=20&index=${sort}${facets}`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'SamLauncher/1.2.2 (discord-sam; stability-proxy)',
          Accept: 'application/json'
        }
      })

      if (!res.ok) throw new Error(`Modrinth API status: ${res.status}`)
      const data = await res.json()

      // PROXY IMAGES: Parallel base64 conversion for 100% display reliability
      const hits = await Promise.all(
        (data.hits || []).map(async (h: any) => {
          let iconBase64 = ''
          if (h.icon_url) {
            try {
              const iRes = await fetch(h.icon_url)
              if (iRes.ok) {
                const iBuf = Buffer.from(await iRes.arrayBuffer())
                iconBase64 = `data:image/png;base64,${iBuf.toString('base64')}`
              }
            } catch {
              /* ignore */
            }
          }

          const gallery = await Promise.all(
            (h.gallery || []).slice(0, 5).map(async (gUrl: string) => {
              try {
                const gRes = await fetch(gUrl)
                if (gRes.ok) {
                  const gBuf = Buffer.from(await gRes.arrayBuffer())
                  return `data:image/png;base64,${gBuf.toString('base64')}`
                }
              } catch {
                /* ignore */
              }
              return ''
            })
          )

          return {
            id: h.project_id || h.id,
            project_id: h.project_id || h.id,
            title: h.title || 'Unknown Mod',
            description: h.description || '',
            author: h.author || 'Unknown',
            icon_url: iconBase64 || h.icon_url,
            categories: h.categories || [],
            gallery: gallery.filter((g) => g !== ''),
            versions: h.versions || [],
            source: 'modrinth'
          }
        })
      )

      return { success: true, hits }
    } catch (err: any) {
      console.error('Main Mod Search Error:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('get-mod-versions', async (_, projectId, source = 'modrinth'): Promise<any> => {
    try {
      if (source === 'curseforge') {
        const res = await fetch(`https://api.curse.tools/v1/cf/mods/${projectId}/files`, {
          headers: {
            Accept: 'application/json'
          }
        })
        if (!res.ok) throw new Error(`Status: ${res.status}`)
        const data = await res.json()

        return (data.data || []).map((f: any) => {
          let downloadUrl = f.downloadUrl
          if (!downloadUrl) {
            downloadUrl = `https://edge.forgecdn.net/files/${String(f.id).substring(0, 4)}/${String(f.id).substring(4)}/${f.fileName}`
          }
          return {
            id: f.id.toString(),
            version_number: f.displayName,
            game_versions: f.gameVersions || [],
            loaders: (f.gameVersions || [])
              .map((v: string) => v.toLowerCase())
              .filter((v: string) => ['fabric', 'forge', 'neoforge', 'quilt'].includes(v)),
            files: [
              {
                url: downloadUrl,
                filename: f.fileName
              }
            ]
          }
        })
      }

      const res = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`, {
        headers: {
          'User-Agent': 'SamLauncher/1.2.3 (discord-sam; stability-proxy)',
          Accept: 'application/json'
        }
      })
      if (!res.ok) throw new Error(`Status: ${res.status}`)
      const versions = await res.json()
      
      // Return versions with additional metadata for display
      return versions.map((v: any) => ({
        ...v,
        loader: v.loaders?.[0] || 'unknown',
        date: v.date_published,
        mc_version: v.game_versions?.[0] || 'unknown'
      }))
    } catch (e) {
      console.error('Fetch Mod Versions Error:', e)
      return []
    }
  })

  ipcMain.handle('install-modpack', async (_event, filePath) => {
    try {
      const AdmZip = require('adm-zip')
      const zip = new AdmZip(filePath)
      const zipEntries = zip.getEntries()

      // Detect Modpack Type
      let type: 'curseforge' | 'modrinth' | 'unknown' = 'unknown'
      let manifest: any = null
      let name = path.basename(filePath, path.extname(filePath))

      if (zipEntries.find(e => e.entryName === 'manifest.json')) {
        type = 'curseforge'
        const content = zip.readAsText('manifest.json')
        manifest = JSON.parse(content)
        name = manifest.name || name
      } else if (zipEntries.find(e => e.entryName === 'modrinth.index.json')) {
        type = 'modrinth'
        const content = zip.readAsText('modrinth.index.json')
        manifest = JSON.parse(content)
        name = manifest.name || name
      }

      // Create Instance Folder
      const instanceId = `modpack-${Date.now()}`
      const root = getMinecraftPath()
      const instanceDir = path.join(root, 'instances', instanceId)
      if (!fs.existsSync(instanceDir)) fs.mkdirSync(instanceDir, { recursive: true })

      // Extract Override Files
      if (type === 'curseforge') {
        const overrides = zipEntries.filter(e => e.entryName.startsWith('overrides/'))
        for (const entry of overrides) {
          const relPath = entry.entryName.replace('overrides/', '')
          if (entry.isDirectory) continue
          const dest = path.join(instanceDir, relPath)
          fs.mkdirSync(path.dirname(dest), { recursive: true })
          fs.writeFileSync(dest, entry.getData())
        }
      } else if (type === 'modrinth') {
        const overrides = zipEntries.filter(e => e.entryName.startsWith('overrides/'))
        for (const entry of overrides) {
          const relPath = entry.entryName.replace('overrides/', '')
          if (entry.isDirectory) continue
          const dest = path.join(instanceDir, relPath)
          fs.mkdirSync(path.dirname(dest), { recursive: true })
          fs.writeFileSync(dest, entry.getData())
        }
      }

      // Register Instance
      const newInstance = {
        id: instanceId,
        name: name,
        version: manifest?.minecraft?.version || manifest?.game || '1.20.1',
        modloader: manifest?.minecraft?.modLoaders?.[0]?.id?.includes('fabric') ? 'fabric' : 'forge',
        icon: '📦',
        playtime: 0
      }

      appInstances.push(newInstance)
      writeJSON(instancesPath, appInstances)

      return { success: true, instance: newInstance }
    } catch (err: any) {
      console.error('Modpack Install Error:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('fetch-skin', async (_, username) => {
    const mirrors = [
      `https://mc-heads.net/skin/${username}`,
      `https://minotar.net/skin/${username}`,
      `https://crafatar.com/skins/${username}`
    ]
    for (const url of mirrors) {
      try {
        const res = await fetch(url)
        if (!res.ok) continue
        const buffer = Buffer.from(await res.arrayBuffer())
        // Convert to base64 to bypass CORS in renderer
        return { success: true, data: `data:image/png;base64,${buffer.toString('base64')}` }
      } catch {
        continue
      }
    }
    return { success: false, error: 'All mirrors failed' }
  })

  ipcMain.handle('list-music', async () => {
    try {
      const musicDir = path.join(userDataPath, 'music')
      if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true })

      const files = fs.readdirSync(musicDir).filter((f) => /\.(mp3|wav|ogg|flac)$/i.test(f))

      // If empty, download default Pigstep
      if (files.length === 0) {
        const pigstepPath = path.join(musicDir, 'Pigstep.mp3')
        if (!fs.existsSync(pigstepPath)) {
          const url = 'https://archive.org/download/minecraft-disc-pigstep/Pigstep.mp3'
          const res = await fetch(url)
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer())
            fs.writeFileSync(pigstepPath, buffer)
            files.push('Pigstep.mp3')
          }
        }
      }

      return {
        success: true,
        files: files.map((f) => ({ name: f, path: `file://${path.join(musicDir, f)}` }))
      }
    } catch (err: any) {
      return { success: false, error: err.message, files: [] }
    }
  })

  ipcMain.handle('add-music', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Add Music',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac'] }]
      })
      if (canceled || filePaths.length === 0) return { success: false, canceled: true }

      const musicDir = path.join(userDataPath, 'music')
      if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true })

      for (const file of filePaths) {
        fs.copyFileSync(file, path.join(musicDir, path.basename(file)))
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('open-music-folder', async () => {
    try {
      const musicDir = path.join(userDataPath, 'music')
      if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true })
      shell.openPath(musicDir)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('relaunch-app', () => {
    app.relaunch()
    app.exit(0)
  })

  createWindow()

  ipcMain.handle('check-ai-status', async () => {
    try {
      const aiDir = path.join(userDataPath, 'ai')
      const exeName = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
      const exePath = path.join(aiDir, exeName)
      const modelPath = path.join(aiDir, 'model.gguf')

      const isInstalled = fs.existsSync(exePath) && fs.existsSync(modelPath)
      const isRunning = aiProcess !== null && !aiProcess.killed

      return { success: true, isInstalled, isRunning }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('download-ai-engine', async (event) => {
    try {
      const aiDir = path.join(userDataPath, 'ai')
      if (!fs.existsSync(aiDir)) fs.mkdirSync(aiDir, { recursive: true })

      const exeName = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
      const exePath = path.join(aiDir, exeName)
      const modelPath = path.join(aiDir, 'model.gguf')

      // Simplified download for Windows (using a lightweight Qwen/Llama 1.5B quantized model)
      // Llama.cpp precompiled binary (Windows x64)
      const exeUrl =
        'https://github.com/ggml-org/llama.cpp/releases/download/b8262/llama-b8262-bin-win-cpu-x64.zip'

      // Qwen1.5-0.5B-Chat-GGUF (Extremely small and fast for copilot context - ~350MB)
      const modelUrl =
        'https://huggingface.co/Qwen/Qwen1.5-0.5B-Chat-GGUF/resolve/main/qwen1_5-0_5b-chat-q4_k_m.gguf?download=true'

      const downloadFileWithProgress = async (url: string, dest: string, name: string) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to fetch ${name}`)

        const total = Number(res.headers.get('content-length') || 0)
        let loaded = 0
        const writer = fs.createWriteStream(dest)

        const reader = res.body as unknown as NodeJS.ReadableStream
        if (reader) {
          for await (const chunk of reader) {
            loaded += chunk.length
            event.sender.send('ai-download-progress', {
              name,
              loaded,
              total,
              percent: Math.round((loaded / total) * 100)
            })
            writer.write(chunk)
          }
        }
        writer.end()
        return new Promise<void>((resolve) => writer.on('finish', () => resolve()))
      }

      if (!fs.existsSync(modelPath)) {
        await downloadFileWithProgress(modelUrl, modelPath, 'AI Model (Qwen 0.5B)')
      }

      // We need native extraction for the zip or direct exe, omitting extraction script verbosity for brevity.
      // To ensure this runs flawlessly for the USER test, we simulate downloading just the executable manually if zip extraction is complex.
      if (!fs.existsSync(exePath) && process.platform === 'win32') {
        // Using a direct curl to download an unzipped llama-server.exe from a trustworthy mirror or requiring the user to have it.
        // Wait, the ZIP file needs unzipping. Let's use PowerShell to unzip it.
        const zipPath = path.join(aiDir, 'llama.zip')
        await downloadFileWithProgress(exeUrl, zipPath, 'AI Engine (llama.cpp)')

        await new Promise<void>((resolve, reject) => {
          exec(
            `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${aiDir}' -Force"`,
            (err) => {
              if (err) return reject(err)

              // Move the extracted server exe to the root of /ai
              const extractedExe = path.join(aiDir, 'llama-server.exe')
              const nestedExe = path.join(aiDir, 'build', 'bin', 'llama-server.exe') // Typical structure

              if (fs.existsSync(nestedExe) && !fs.existsSync(extractedExe)) {
                fs.renameSync(nestedExe, extractedExe)
              }
              resolve()
            }
          )
        })
      }

      return { success: true }
    } catch (e: any) {
      console.error(e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('start-ai-engine', async () => {
    try {
      if (aiProcess !== null && !aiProcess.killed)
        return { success: true, message: 'Already running' }

      const aiDir = path.join(userDataPath, 'ai')
      const exeName = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
      const exePath = path.join(aiDir, exeName)
      const modelPath = path.join(aiDir, 'model.gguf')

      if (!fs.existsSync(exePath) || !fs.existsSync(modelPath)) {
        throw new Error('AI Engine or Model not found. Download them first.')
      }
      aiProcess = spawn(
        exePath,
        ['-m', modelPath, '--port', '11434', '-c', '2048', '--host', '127.0.0.1'],
        {
          cwd: aiDir,
          detached: true,
          stdio: 'ignore'
        }
      )
      aiProcess.unref()

      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('get-system-specs', async () => {
    return {
      success: true,
      cores: os.cpus().length,
      ramTotal: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'G',
      ramFree: Math.round(os.freemem() / 1024 / 1024 / 1024) + 'G',
      platform: os.platform()
    }
  })

  ipcMain.handle('search-web', async (_, query: string) => {
    try {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      if (!res.ok) throw new Error('Search request failed')
      
      const html = await res.text()
      const results: string[] = []
      const regex = /<a class="result__snippet[^>]*>(.*?)<\/a>/gi
      
      let match
      while ((match = regex.exec(html)) !== null && results.length < 3) {
        const cleanText = match[1].replace(/<[^>]+>/g, '').trim()
        if (cleanText) results.push(cleanText)
      }
      
      return { success: true, data: results }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('fetch-latest-log', async (_, instanceId, customGamePath, limit = 50) => {
    try {
      const mcPath = customGamePath || getMinecraftPath()
      const logPath = path.join(mcPath, 'instances', instanceId, 'logs', 'latest.log')
      if (!fs.existsSync(logPath)) return { success: false, error: 'Log file not found' }

      const logContent = fs.readFileSync(logPath, 'utf8')
      if (limit === 0) {
        return { success: true, log: logContent }
      }
      const lines = logContent.split('\n')
      const tail = lines.slice(-limit).join('\n')
      return { success: true, log: tail }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('open-link', async (_, url: string) => {
    shell.openExternal(url)
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (aiProcess && !aiProcess.killed) {
    aiProcess.kill('SIGTERM')
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
