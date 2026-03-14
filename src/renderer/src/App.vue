<script setup lang="ts">
import { ref, onMounted, watch, toRaw, nextTick, computed } from 'vue'
import {
  Settings,
  Play,
  Download,
  User,
  X,
  Plus,
  Gamepad2,
  LogOut,
  HardDrive,
  Cpu,
  Edit3,
  Check,
  Terminal,
  ChevronRight,
  Globe,
  Server,
  Palette,
  Sparkles,
  List,
  Folder,
  Database,
  PackageOpen,
  MessageSquare,
  Send,
  Coffee,
  ShieldAlert,
  ShieldCheck,
  Home,
  History,
  Sliders
} from 'lucide-vue-next'
import * as skinview3d from 'skinview3d'

// Local Assets
import mossBlock from './assets/images/Mossblock.png'
import netherrackBlock from './assets/images/Netherrackblock.png'
import endStoneBlock from './assets/images/Endstoneblock.png'
import quartzBlock from './assets/images/Quartzblock.png'
import obsidianBlock from './assets/images/Obsidianblock.png'
import logoPremium from './assets/images/logo_premium.png'

interface McVersion {
  id: string
  type: string
  url: string
  time: string
  releaseTime: string
}

interface SamInstance {
  id: string
  name: string
  version: string
  modloader: string
  customJavaPath?: string
  jvmArgs?: string
  memoryMax?: string
  memoryMin?: string
  playtime?: number
}

const formatPlaytime = (ms: number | undefined) => {
  if (!ms) return ''
  const totalMins = Math.floor(ms / 60000)
  if (totalMins < 60) return `${totalMins}m`
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${h}h ${m}m`
}

interface AiMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface AiSession {
  id: string
  title: string
  messages: AiMessage[]
  timestamp: number
}

interface AiSettings {
  temperature: number
  maxTokens: number
  systemPrompt: string
}

interface ModResult {
  id: string
  project_id: string
  title: string
  description: string
  author: string
  icon_url: string
  categories: string[]
  gallery: string[]
  versions: string[]
  source: string
}

interface ModVersion {
  id: string
  name: string
  game_versions: string[]
  loaders: string[]
  files: { url: string; filename: string }[]
  date_published?: string
}

const username = ref('Player')
const versionsData = ref<McVersion[]>([])
const status = ref('Ready to explore')
const progress = ref(0)
const isLaunching = ref(false)
const isLoadingVersions = ref(true)
// Running instance tracking
const runningInstanceId = ref<string | null>(null)
const forgeProgress = ref(0)
const forgeStatus = ref('')
const mcProgress = ref(0)
const mcStatus = ref('')
const installStage = ref<'idle' | 'forge' | 'mc'>('idle')
// Config & Auth
const userConfig = ref<Record<string, any>>({})
const authData = ref<{ uuid: string; name: string; accessToken: string } | null>(null)

// AI Crash Analyzer state (already defined below is better, but I'll consolidate here)
const showCrashModal = ref(false)
const isAnalyzingCrash = ref(false)
const crashAnalysisResult = ref('')
const crashingInstanceId = ref<string | null>(null)

// Instances
const instances = ref<SamInstance[]>([])
const selectedInstance = ref<string | null>(null)
const selectedInstanceData = computed(() => instances.value.find(i => i.id === selectedInstance.value))
const activeTab = ref('instances') // 'instances', 'settings', or 'downloads'
const settingsTab = ref('general') // 'general', 'java', 'theme', 'about'
const editingInstanceId = ref<string | null>(null)
const jvmArgs = ref<string>('-XX:+UseG1GC')

// New Feature States
const isAiModShieldEnabled = ref(false)
const systemStats = ref({ 
  cpu: 0, 
  ramUsage: 0, 
  ramTotal: 1, 
  gpu: 0, 
  gpuModel: '', 
  vramUsed: 0, 
  vramTotal: 1, 
  javaMem: 0 
})
const sessionPlaytime = ref(0)
let playtimeTimerInterval: NodeJS.Timeout | null = null


const isCopilotOpen = ref(false)
const aiInput = ref('')
const isAiTyping = ref(false)

// AI Expansion State
const aiSessions = ref<AiSession[]>([])
const currentSessionId = ref<string | null>(null)
const isAiHistoryOpen = ref(false)
const isAiSettingsOpen = ref(false)
const isCompatibilityMode = ref(false)
const lastLaunchOpts = ref<any>(null)
const actualLaunchCommand = ref('')
const aiSettings = ref<AiSettings>({
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: "You are a hardcore Minecraft Master and expert JVM tuner. You know almost EVERYTHING about Minecraft (DonutsMP, BetterMC, mod versions, server setups). If a user reports EXCEPTION_ACCESS_VIOLATION (0xc0000005), it is usually due to graphics drivers, Discord Overlay, or incompatible JVM flags like AlwaysPreTouch. Suggest updating drivers or simplifying JVM arguments. INTERNET ACCESS: You have access to real-time web info. NEVER claim to be offline if information is provided below. Use the provided search results to answer precisely and skip greetings."
});

// Computed current messages
const aiMessages = computed(() => {
  const session = aiSessions.value.find(s => s.id === currentSessionId.value)
  return session ? session.messages : []
})

const saveAiData = (): void => {
  localStorage.setItem('sl_ai_sessions', JSON.stringify(aiSessions.value))
  localStorage.setItem('sl_ai_current_session', currentSessionId.value || '')
  localStorage.setItem('sl_ai_settings', JSON.stringify(aiSettings.value))
}

const createNewAiSession = (): void => {
  const newId = Date.now().toString()
  aiSessions.value.unshift({
    id: newId,
    title: 'New Chat',
    messages: [
      { role: 'assistant', content: 'Hello! I am your local AI Assistant. How can I help you today?' }
    ],
    timestamp: Date.now()
  })
  currentSessionId.value = newId
  saveAiData()
}

const deleteAiSession = (id: string): void => {
  aiSessions.value = aiSessions.value.filter(s => s.id !== id)
  if (currentSessionId.value === id) {
    currentSessionId.value = aiSessions.value.length > 0 ? aiSessions.value[0].id : null
    if (!currentSessionId.value) createNewAiSession()
  }
  saveAiData()
}

const switchAiSession = (id: string): void => {
  currentSessionId.value = id
  isAiHistoryOpen.value = false
  saveAiData()
}

// Instance Detail Panel
const isDetailPanelOpen = ref(false)
const detailInstance = ref<SamInstance | null>(null)
const detailTab = ref('worlds') // worlds, servers, java, mods, textures, shaders
const detailWorlds = ref<string[]>([])
const detailResourcepacks = ref<string[]>([])
const detailShaderpacks = ref<string[]>([])
const detailServers = ref<{ exists: boolean }>({ exists: false })

// Mod management state
const isModModalOpen = ref(false)
const inspectingInstance = ref<SamInstance | null>(null)
const instanceMods = ref<string[]>([])
const modVersionModalOpen = ref(false)
const modVersions = ref<ModVersion[]>([])
const isLoadingModVersions = ref(false)
const selectedModVersion = ref<ModVersion | null>(null)
const selectedModForVersionSelection = ref<ModResult | null>(null)

const modResults = ref<ModResult[]>([])

// Mod browser state
const isModBrowserOpen = ref(false)
const modQuery = ref('')
const isSearchingMods = ref(false)
const downloadSource = ref('modrinth') // 'modrinth', 'curseforge'
const downloadProjectType = ref('mod') // 'mod', 'resourcepack', 'shader'
const instanceModsForCompat = ref<string[]>([]) // cached mods for compatibility check
const modSort = ref('relevance')
const modCategory = ref('')

const SHADER_MODS = ['iris', 'optifine', 'oculus', 'optifabric', 'sodium'] // known shader-capable mods

const hasShaderMod = computed(() => {
  return instanceModsForCompat.value.some((mod) =>
    SHADER_MODS.some((s) => mod.toLowerCase().includes(s))
  )
})

const isCompatible = computed((): boolean => {
  if (!selectedModVersion.value || !selectedInstance.value) return true
  const inst = instances.value.find((i) => i.id === selectedInstance.value)
  if (!inst) return true

  const versionMatch = selectedModVersion.value.game_versions.includes(inst.version)

  if (downloadProjectType.value === 'shader') {
    // Shaders need: MC version match + a shader mod installed
    return versionMatch && hasShaderMod.value
  } else if (downloadProjectType.value === 'resourcepack') {
    // Resource packs need: MC version match only
    return versionMatch
  } else {
    // Mods need: loader match + MC version match
    const loaderMatch =
      selectedModVersion.value.loaders.includes(inst.modloader) ||
      selectedModVersion.value.loaders.includes('vanilla')
    return loaderMatch && versionMatch
  }
})

const compatMessage = computed(() => {
  if (!selectedModVersion.value || !selectedInstance.value) return ''
  const inst = instances.value.find((i) => i.id === selectedInstance.value)
  if (!inst) return ''

  const versionMatch = selectedModVersion.value.game_versions.includes(inst.version)

  if (isCompatible.value) {
    if (downloadProjectType.value === 'shader') {
      return 'Shader mod detected and MC version matches.'
    } else if (downloadProjectType.value === 'resourcepack') {
      return 'MC version matches your instance.'
    }
    return 'This version matches your instance perfectly.'
  }

  const warnings: string[] = []
  if (!versionMatch)
    warnings.push(
      `MC version mismatch (needs ${selectedModVersion.value.game_versions.slice(0, 3).join(', ')})`
    )
  if (downloadProjectType.value === 'shader' && !hasShaderMod.value) {
    warnings.push('No shader mod (Iris/OptiFine) found in your mods folder!')
  }
  if (downloadProjectType.value === 'mod') {
    const loaderMatch = selectedModVersion.value.loaders.includes(inst.modloader)
    if (!loaderMatch)
      warnings.push(`Loader mismatch (needs ${selectedModVersion.value.loaders.join('/')})`)
  }
  return warnings.join(' • ') || 'Unknown compatibility issue.'
})

// Logs & Console
const logs = ref<string[]>([])
const isConsoleOpen = ref(false)
const consoleEl = ref<HTMLElement | null>(null)
const skinFileInput = ref<HTMLInputElement | null>(null)
const customAvatarData = ref<string | null>(null)
const skinViewerEl = ref<HTMLCanvasElement | null>(null)
let skinViewer: skinview3d.SkinViewer | null = null

// Ambient Soundscape (Custom Music Player)
const isMusicPlaying = ref(false)
const isMusicMenuOpen = ref(false)
const musicList = ref<{ name: string; path: string }[]>([])
let currentAudio: HTMLAudioElement | null = null
const currentAudioName = ref('')

const loadMusicList = async (): Promise<void> => {
  const res = await window.electron.ipcRenderer.invoke('list-music')
  if (res.success) {
    musicList.value = res.files
  }
}

const addMusic = async (): Promise<void> => {
  const res = await window.electron.ipcRenderer.invoke('add-music')
  if (res.success) {
    await loadMusicList()
    status.value = 'Music added successfully'
  }
}

const openMusicFolder = (): void => {
  window.electron.ipcRenderer.invoke('open-music-folder')
}

const playRandomMusic = (): void => {
  if (musicList.value.length === 0) return
  const randomSong = musicList.value[Math.floor(Math.random() * musicList.value.length)]

  if (currentAudio) {
    currentAudio.pause()
  }

  currentAudio = new Audio(randomSong.path)
  currentAudio.volume = 0.5
  currentAudio
    .play()
    .then(() => {
      isMusicPlaying.value = true
      currentAudioName.value = randomSong.name
      status.value = `Playing: ${randomSong.name}`
    })
    .catch((e) => {
      console.error('Failed to play sound:', e)
      isMusicPlaying.value = false
      status.value = 'Failed to play music'
    })

  currentAudio.onended = () => {
    playRandomMusic()
  }
}

const aiStatus = ref<{ isInstalled: boolean; isRunning: boolean }>({
  isInstalled: false,
  isRunning: false
})
const aiDownloadProgress = ref<{
  name: string
  loaded: number
  total: number
  percent: number
} | null>(null)
const showAiDownloadModal = ref(false)

const openLink = (url: string): void => {
  window.electron.ipcRenderer.invoke('open-external', url)
}

const checkAiStatus = async (): Promise<void> => {
  const res = await window.electron.ipcRenderer.invoke('check-ai-status')
  if (res.success) {
    aiStatus.value = { isInstalled: res.isInstalled, isRunning: res.isRunning }
  }
}

const toggleCopilot = async (): Promise<void> => {
  await checkAiStatus()
  if (!aiStatus.value.isInstalled) {
    showAiDownloadModal.value = true
    return
  }

  if (!aiStatus.value.isRunning) {
    status.value = 'Starting AI Engine...'
    await window.electron.ipcRenderer.invoke('start-ai-engine')
    await new Promise((r) => setTimeout(r, 2000)) // Give server time to bind port
    await checkAiStatus()
  }

  isCopilotOpen.value = !isCopilotOpen.value

  if (isCopilotOpen.value) {
    const savedSessions = localStorage.getItem('sl_ai_sessions')
    const savedCurrent = localStorage.getItem('sl_ai_current_session')
    const savedSettings = localStorage.getItem('sl_ai_settings')

    if (savedSessions) aiSessions.value = JSON.parse(savedSessions)
    if (savedSettings) aiSettings.value = JSON.parse(savedSettings)

    if (aiSessions.value.length === 0) {
      createNewAiSession()
    } else {
      currentSessionId.value = savedCurrent && aiSessions.value.find(s => s.id === savedCurrent) 
        ? savedCurrent 
        : aiSessions.value[0].id
    }
  }
}

const downloadAiEngine = async (): Promise<void> => {
  showAiDownloadModal.value = false
  aiDownloadProgress.value = { name: 'Initializing', loaded: 0, total: 100, percent: 0 }

  window.electron.ipcRenderer.on('ai-download-progress', (_event: unknown, progress: { name: string; loaded: number; total: number; percent: number }) => {
    aiDownloadProgress.value = progress
  })

  status.value = 'Downloading offline AI models...'
  const res = await window.electron.ipcRenderer.invoke('download-ai-engine')
  window.electron.ipcRenderer.removeAllListeners('ai-download-progress')
  aiDownloadProgress.value = null

  if (res.success) {
    status.value = 'AI Engine installed! Relauching for final initialization...'
    await checkAiStatus()
    if (confirm('AI Engine downloaded successfully. Restarting the launcher to fully initialize. Click OK to restart.')) {
      window.electron.ipcRenderer.invoke('relaunch-app')
    } else {
      status.value = 'Download complete. Please restart the launcher manually to use AI features.'
    }
  } else {
    status.value = 'AI Download failed: ' + res.error
  }
}

const sendAiMessage = async (): Promise<void> => {
  if (!aiInput.value.trim() || isAiTyping.value) return

  const userMsg = aiInput.value.trim()
  aiInput.value = ''
  
  let session = aiSessions.value.find(s => s.id === currentSessionId.value)
  if (!session) {
    createNewAiSession()
    session = aiSessions.value[0]
  }

  // Auto-rename "New Chat" on first message
  if (session.title === 'New Chat' && session.messages.length <= 1) {
    session.title = userMsg.substring(0, 20) + (userMsg.length > 20 ? '...' : '')
  }

  session.messages.push({ role: 'user', content: userMsg })
  isAiTyping.value = true

  try {
    const aiContext = [...session.messages]
    session.messages.push({ role: 'assistant', content: '' })

    const specs = await window.electron.ipcRenderer.invoke('get-system-specs')
    let systemPrompt = aiSettings.value.systemPrompt
    systemPrompt += `\n\nUser Hardware Context: ${specs.platform}, ${specs.cores} CPU cores, ${specs.ramTotal} RAM.`

    const payload = {
      model: 'model.gguf',
      messages: [{ role: 'system', content: systemPrompt }, ...aiContext],
      stream: true,
      options: {
        temperature: aiSettings.value.temperature,
        num_predict: aiSettings.value.maxTokens
      }
    }

    const response = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) throw new Error('AI Server is not reachable.')
    if (!response.body) throw new Error('No response body.')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter((line) => line.trim() !== '')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6)
          if (jsonStr.trim() === '[DONE]') break
          try {
            const data = JSON.parse(jsonStr)
            const content = data.choices[0]?.delta?.content || ''
            aiMessages.value[aiMessages.value.length - 1].content += content

            // Auto-scroll logic (scroll to bottom)
            const chatContainer = document.getElementById('ai-chat-container')
            if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight
          } catch (error: unknown) {
            // Ignore parse errors for streaming chunks
          }
        }
      }
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    aiMessages.value.push({ role: 'assistant', content: `[Error: ${errorMsg}]` })
  } finally {
    isAiTyping.value = false
  }
}

const isOptimizingJvm = ref(false)
const optimizeJvmArgs = async (): Promise<void> => {
  isOptimizingJvm.value = true
  status.value = 'Analyzing your hardware...'

  try {
    const specs = await window.electron.ipcRenderer.invoke('get-system-specs')
    const cores = specs.cores || 4
    const ramGB = parseInt(specs.ramTotal) || 8

    // [V1.6.3] Expert-curated JVM presets based on hardware — no more unreliable AI generation
    // Memory (-Xmx/-Xms) is controlled by the Max Memory dropdown, NOT here
    let optimized: string

    if (cores >= 8 && ramGB >= 16) {
      // High-end system: Use ZGC for ultra-low pause times
      optimized = '-XX:+UseZGC -XX:+ZGenerational -XX:+DisableExplicitGC -XX:+PerfDisableSharedMem -XX:+ParallelRefProcEnabled'
    } else if (cores >= 4) {
      // Mid-range system: Tuned G1GC
      optimized = '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1'
    } else {
      // Low-end system: Simple G1GC with conservative settings
      optimized = '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+DisableExplicitGC -XX:G1HeapRegionSize=4M'
    }

    jvmArgs.value = optimized
    status.value = `✅ Optimized your java arguments based on your computer specs!`
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    status.value = 'Optimization failed: ' + errorMsg
  } finally {
    isOptimizingJvm.value = false
  }
}

const resetJvmArgs = (): void => {
  jvmArgs.value = '-XX:+UseG1GC'
  status.value = 'JVM Arguments reset to safe defaults'
}

const analyzeCrash = async (): Promise<void> => {
  if (!crashingInstanceId.value) return
  
  await checkAiStatus()
  if (!aiStatus.value.isInstalled) {
    alert("Please download the AI engine first using the Copilot button in the bottom right.")
    return
  }
  
  if (!aiStatus.value.isRunning) {
    status.value = 'Starting AI Engine for analysis...'
    await window.electron.ipcRenderer.invoke('start-ai-engine')
    await new Promise(r => setTimeout(r, 2000))
    await checkAiStatus()
  }

  isAnalyzingCrash.value = true
  crashAnalysisResult.value = 'AI is reading logs and analyzing the root cause...'
  
  try {
    const logRes = await window.electron.ipcRenderer.invoke('fetch-latest-log', crashingInstanceId.value, customGamePath.value)
    let logContent = logRes.log
    
    if (!logRes.success) {
      logContent = `[SYSTEM ERROR]: Log failed to generate. This typically means the game crashed instantly (exit code 1) due to invalid Java version (need Java 21) or an EXCEPTION_ACCESS_VIOLATION (0xc0000005). Access violations are often caused by graphics driver conflicts or Discord Overlay.`
    }
    
    const prompt = `Minecraft instance "${crashingInstanceId.value}" failed to start. Based on the log below, explain the likely cause and provide 2-3 actionable steps to fix it. If the log indicates a 0xc0000005 error or says "Log failed to generate", explicitly tell the user to: 1. Try enabling "Deep Compatibility Mode" in the Java Settings. 2. Use the "Copy Command" button and run it in PowerShell to see the raw Java error. Be concise and helpful.\n\nLOG:\n${logContent}`
    
    const payload = {
      model: "model.gguf",
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      options: {
        temperature: 0.7,
        seed: Math.floor(Math.random() * 10000)
      }
    }
    
    const response = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) throw new Error('AI Engine unreachable')
    
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No streaming body')
    
    crashAnalysisResult.value = ''
    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const content = line.slice(6).trim()
          if (content === '[DONE]') break
          try {
            const parsed = JSON.parse(content)
            const text = parsed.choices[0]?.delta?.content || ''
            crashAnalysisResult.value += text
          } catch (error: unknown) { /* ignore */ }
        }
      }
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    crashAnalysisResult.value = 'Analysis failed: ' + errorMsg
  } finally {
    isAnalyzingCrash.value = false
  }
}

const copyLaunchCommand = async (): Promise<void> => {
  console.log('[DEBUG] Copy Command clicked. actualLaunchCommand:', actualLaunchCommand.value)
  
  let cmdToCopy = actualLaunchCommand.value || ''
  
  // Fallback Reconstruction if capture failed
  if (!cmdToCopy && lastLaunchOpts.value) {
    const opts = lastLaunchOpts.value
    const javaPath = customJavaPath.value || 'java'
    const memory = `-Xmx${opts.memoryMax || memoryMax.value} -Xms${opts.memoryMin || memoryMin.value}`
    const jvm = opts.jvmArgs || jvmArgs.value
    const comp = opts.compatibilityMode ? '-Xshare:off -Dsun.java2d.d3d=false -XX:-TieredCompilation' : ''
    
    // Include modloader and instance info for better diagnostics
    const instInfo = instances.value.find(i => i.id === opts.instanceId)
    const loader = instInfo ? instInfo.modloader : 'unknown'
    const ver = instInfo ? instInfo.version : 'unknown'
    
    cmdToCopy = `[RECONSTRUCTED - v1.6.3] ${javaPath} ${memory} ${jvm} ${comp} [Modloader: ${loader}, MC: ${ver}] (Crash occurred before Java output the command)`
    console.log('[DEBUG] Using reconstructed fallback:', cmdToCopy)
  }

  if (cmdToCopy) {
    try {
      await navigator.clipboard.writeText(cmdToCopy)
      status.value = 'Launch command copied!'
      alert('⚠️ VER 1.6.3: The command has been copied.\n\nNOTE: If it says [RECONSTRUCTED], it means the game crashed BEFORE Java could output its command string. This usually means a Forge installer or asset error.')
    } catch {
      status.value = 'Failed to copy command.'
    }
  } else {
    status.value = 'Waiting for game to start...'
    alert('VER 1.6.3: Please try launching the game first.')
  }
}

const toggleMusic = async (): Promise<void> => {
  if (isMusicPlaying.value) {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }
    isMusicPlaying.value = false
    currentAudioName.value = ''
    status.value = 'Music stopped'
  } else {
    if (musicList.value.length === 0) {
      status.value = 'Loading music list...'
      await loadMusicList()
    }

    if (musicList.value.length === 0) {
      status.value = 'No music found!'
      return
    }

    playRandomMusic()
  }
}

const openModVersionSelection = async (mod: ModResult): Promise<void> => {
  selectedModForVersionSelection.value = mod
  modVersionModalOpen.value = true
  isLoadingModVersions.value = true
  modVersions.value = []
  selectedModVersion.value = null

  try {
    const res = await window.electron.ipcRenderer.invoke(
      'get-mod-versions',
      mod.project_id,
      mod.source || 'modrinth'
    )
    modVersions.value = res
    if (res.length > 0) selectedModVersion.value = res[0]

    // Auto-select first instance for convenience
    if (instances.value.length > 0) {
      selectedInstance.value = instances.value[0].id
      // Fetch mods for compatibility check (shader detection)
      const mods = await window.electron.ipcRenderer.invoke('list-mods', {
        instanceId: instances.value[0].id,
        customGamePath: customGamePath.value
      })
      instanceModsForCompat.value = mods || []
    }
  } catch (e) {
    console.error('Failed to get mod versions', e)
  } finally {
    isLoadingModVersions.value = false
  }
}

const onInstanceSelect = async (instId: string): Promise<void> => {
  selectedInstance.value = instId
  const mods = await window.electron.ipcRenderer.invoke('list-mods', {
    instanceId: instId,
    customGamePath: customGamePath.value
  })
  instanceModsForCompat.value = mods || []
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
const autoSearch = (): void => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!modQuery.value || modQuery.value.length < 2) return
  searchTimer = setTimeout(() => {
    searchMods()
  }, 400)
}

const searchMods = async (): Promise<void> => {
  if (!modQuery.value) return
  isSearchingMods.value = true
  status.value = `Searching ${downloadSource.value === 'curseforge' ? 'CurseForge' : 'Modrinth'}: ${modQuery.value}...`
  try {
    const res = await window.electron.ipcRenderer.invoke(
      'search-mods',
      modQuery.value,
      downloadProjectType.value,
      downloadSource.value,
      modSort.value,
      modCategory.value
    )
    if (res.success) {
      modResults.value = res.hits
      status.value = `Found ${res.hits.length} results`
    } else {
      status.value = 'Search failed: ' + res.error
    }
  } catch (e) {
    console.error('Mod search failed', e)
  } finally {
    isSearchingMods.value = false
  }
}

const downloadMod = async (version: ModVersion): Promise<void> => {
  if (downloadProjectType.value === 'modpack') {
    status.value = `Downloading modpack: ${version.name}...`
    const file = version.files[0]
    const res = await window.electron.ipcRenderer.invoke('download-modpack-from-url', {
      url: file.url,
      filename: file.filename
    })
    if (res.success) {
      instances.value.unshift(res.instance)
      await saveInstances()
      status.value = 'Modpack Installed & Instance Created!'
      modVersionModalOpen.value = false
      isModBrowserOpen.value = false
    } else {
      status.value = `Error: ${res.error}`
    }
    return
  }

  if (!selectedInstance.value) return
  status.value = `Installing mod version: ${version.name}...`
  try {
    const latest = version
    const file = latest.files.find((f) => f.url.includes(latest.id) || f.url !== '') || latest.files[0]

    // Compatibility Guard
    const instance = instances.value.find((i) => i.id === selectedInstance.value)
    if (instance) {
      const isLoaderMatch =
        latest.loaders.includes(instance.modloader) || latest.loaders.includes('vanilla')
      const isVersionMatch = latest.game_versions.includes(instance.version)

      if (!isLoaderMatch || !isVersionMatch) {
        if (
          !confirm(
            `Warning: This mod is for ${latest.loaders.join(', ')} and MC ${latest.game_versions.join(', ')}. Your instance is ${instance.modloader} on ${instance.version}. Continue anyway?`
          )
        ) {
          return
        }
      }
    }

    await window.electron.ipcRenderer.invoke('download-mod', {
      url: file.url,
      filename: file.filename,
      instanceId: selectedInstance.value,
      folderType:
        downloadProjectType.value === 'resourcepack'
          ? 'resourcepacks'
          : downloadProjectType.value === 'shader'
            ? 'shaderpacks'
            : downloadProjectType.value === 'modpack'
              ? ''
              : 'mods'
    })

    status.value = `Successfully installed mod!`
    modVersionModalOpen.value = false
  } catch (e) {
    status.value = `Failed to install mod`
    console.error(e)
  }
}

// New Instance Modal
const isNewInstanceModalOpen = ref(false)
const newInstanceImportMode = ref<null | 'manual'>(null)
const newInstanceName = ref('')
const newInstanceVersion = ref('')
const newInstanceModloader = ref('vanilla')

// Instance Detail Panel Functions
const openDetailPanel = async (inst: SamInstance): Promise<void> => {
  detailInstance.value = inst
  detailTab.value = 'worlds'
  isDetailPanelOpen.value = true

  // Load all instance data in parallel
  const [worlds, mods, rps, shaders, servers] = await Promise.all([
    window.electron.ipcRenderer.invoke('list-worlds', {
      instanceId: inst.id,
      customGamePath: customGamePath.value
    }),
    window.electron.ipcRenderer.invoke('list-mods', {
      instanceId: inst.id,
      customGamePath: customGamePath.value
    }),
    window.electron.ipcRenderer.invoke('list-resourcepacks', {
      instanceId: inst.id,
      customGamePath: customGamePath.value
    }),
    window.electron.ipcRenderer.invoke('list-shaderpacks', {
      instanceId: inst.id,
      customGamePath: customGamePath.value
    }),
    window.electron.ipcRenderer.invoke('list-servers', {
      instanceId: inst.id,
      customGamePath: customGamePath.value
    })
  ])
  detailWorlds.value = worlds
  instanceMods.value = mods
  detailResourcepacks.value = rps
  detailShaderpacks.value = shaders
  detailServers.value = servers
}

const saveInstanceSettings = async (): Promise<void> => {
  if (!detailInstance.value) return
  const inst = instances.value.find((i) => i.id === detailInstance.value?.id)
  if (inst) {
    inst.jvmArgs = detailInstance.value.jvmArgs
    inst.memoryMax = detailInstance.value.memoryMax
    inst.memoryMin = detailInstance.value.memoryMin
    saveInstances()
    status.value = 'Instance settings saved!'
  }
}

// Global Settings
const memoryMax = ref('4G')
const memoryMin = ref('2G')
const authType = ref('offline')
const windowWidth = ref(854)
const windowHeight = ref(480)
const fullscreen = ref(false)
const customJavaPath = ref('')
const customGamePath = ref('')
const currentTheme = ref('overworld')

const themes = {
  overworld: { name: 'Overworld', primary: '#a6e3a1', secondary: '#40a02b', bg: mossBlock },
  nether: { name: 'Nether', primary: '#f38ba8', secondary: '#d20f39', bg: netherrackBlock },
  end: { name: 'The End', primary: '#f9e2af', secondary: '#df8e1d', bg: endStoneBlock },
  quartz: { name: 'Quartz', primary: '#e0e0e0', secondary: '#a0a0a0', bg: quartzBlock },
  obsidian: { name: 'Obsidian', primary: '#cba6f7', secondary: '#1e1e2e', bg: obsidianBlock }
}

const selectTheme = (theme: string): void => {
  currentTheme.value = theme
  saveConfig()
}

const hexToRgb = (hex: string): string => {
  if (!hex || hex.length < 7) return '34 197 94'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

const primaryColor = computed((): string => themes[currentTheme.value]?.primary || '#a6e3a1')
const backgroundStyle = computed(() => ({
  backgroundImage: `url(${themes[currentTheme.value].bg})`,
  backgroundSize: '128px'
}))

// Mod Browser Enhancements Section Deleted (Consolidated to Line 24/62)
const fetchVersions = async () => {
  try {
    const res = await window.electron.ipcRenderer.invoke('fetch-versions')
    if (res.success && res.versions) {
      versionsData.value = res.versions.slice(0, 100)
    } else {
      status.value = 'Failed to load versions from Mojang.'
    }
  } catch (e: unknown) {
    status.value = 'Network error loading versions.'
  } finally {
    isLoadingVersions.value = false
  }
}

const loadData = async () => {
  userConfig.value = await window.electron.ipcRenderer.invoke('get-config')
  instances.value = await window.electron.ipcRenderer.invoke('get-instances')

  if (userConfig.value) {
    authType.value = (userConfig.value.authType as string) || 'offline'
    username.value = (userConfig.value.username as string) || 'Player'
    memoryMax.value = (userConfig.value.memoryMax as string) || '4G'
    memoryMin.value = (userConfig.value.memoryMin as string) || '2G'
    windowWidth.value = (userConfig.value.windowWidth as number) || 854
    windowHeight.value = (userConfig.value.windowHeight as number) || 480
    fullscreen.value = (userConfig.value.fullscreen as boolean) || false
    customJavaPath.value = (userConfig.value.customJavaPath as string) || ''
    customGamePath.value = (userConfig.value.customGamePath as string) || ''
    jvmArgs.value = (userConfig.value.jvmArgs as string) || '-XX:+UseG1GC'
    authData.value = userConfig.value.authData as any

    // Safety guard for theme simplification
    const savedTheme = userConfig.value.currentTheme as string
    const validThemes = Object.keys(themes)
    currentTheme.value = validThemes.includes(savedTheme) ? savedTheme : 'overworld'
  }
}

const saveConfig = async () => {
  await window.electron.ipcRenderer.invoke('save-config', {
    authType: authType.value,
    username: username.value,
    memoryMax: memoryMax.value,
    memoryMin: memoryMin.value,
    windowWidth: windowWidth.value,
    windowHeight: windowHeight.value,
    fullscreen: fullscreen.value,
    customJavaPath: customJavaPath.value,
    customGamePath: customGamePath.value,
    jvmArgs: jvmArgs.value,
    authData: authData.value,
    currentTheme: currentTheme.value
  })
}

const saveInstances = async () => {
  await window.electron.ipcRenderer.invoke(
    'save-instances',
    JSON.parse(JSON.stringify(instances.value))
  )
}

const handleSkinUpload = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const reader = new FileReader()
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string
      await processMinecraftSkin(dataUrl)
    }
    reader.readAsDataURL(target.files[0])
  }
}

const processMinecraftSkin = (dataUrl: string) => {
  return new Promise<void>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    // Safety timeout
    const timeout = setTimeout(() => {
      console.warn('Skin processing timed out')
      resolve()
    }, 5000)

    img.onload = () => {
      clearTimeout(timeout)
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve()
        return
      }

      ctx.imageSmoothingEnabled = false

      // Face (8,8 -> 16,16)
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 64, 64)
      // Hat (40,8 -> 48,16)
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 64, 64)

      customAvatarData.value = canvas.toDataURL()
      localStorage.setItem('customAvatar', customAvatarData.value)

      // Update 3D Viewer
      if (skinViewer) {
        skinViewer.loadSkin(dataUrl)
      }

      resolve()
    }
    img.onerror = () => {
      clearTimeout(timeout)
      console.error('Failed to load skin for processing')
      resolve() // Resolve anyway to unblock the UI
    }

    img.src = dataUrl
  })
}

const initSkinViewer = () => {
  if (!skinViewerEl.value) return
  skinViewer = new skinview3d.SkinViewer({
    canvas: skinViewerEl.value,
    width: 150,
    height: 180
  })

  skinViewer.autoRotate = true
  skinViewer.animation = new skinview3d.WalkingAnimation()

  const skin = customAvatarData.value || 'https://mc-heads.net/skin/steve'
  skinViewer.loadSkin(skin)
}

// Lifecycle handlers Consolidated in single block below

const handleLogin = async (): Promise<void> => {
  status.value = 'Waiting for Microsoft login...'
  progress.value = 10
  const res = await window.electron.ipcRenderer.invoke('login-microsoft')
  if (res.success && res.auth) {
    authData.value = res.auth
    authType.value = 'microsoft'
    status.value = `Welcome ${res.auth.name}!`
    saveConfig()
    await refreshPremiumSkin()
  } else {
    status.value = 'Login failed: ' + res.error
  }
  progress.value = 0
}

const handleLogout = async (): Promise<void> => {
  authData.value = null
  authType.value = 'offline'
  customAvatarData.value = null
  localStorage.removeItem('customAvatar')
  saveConfig()
}

const refreshPremiumSkin = async (): Promise<void> => {
  const name = authData.value?.name || username.value || 'Steve'
  status.value = `Crawling skin via rescue-sync: ${name}...`
  try {
    const res = await window.electron.ipcRenderer.invoke('fetch-skin', name)
    if (res.success && res.data) {
      await processMinecraftSkin(res.data)
      status.value = 'Skin synced via NameMC mirror!'
    } else {
      status.value = 'Skin sync failed: ' + (res.error || 'Mirrors failed')
    }
  } catch (e) {
    status.value = 'Sync error'
    console.error(e)
  }
}

// Auto-save settings whenever any setting changes
watch(
  [
    memoryMax,
    memoryMin,
    authType,
    windowWidth,
    windowHeight,
    fullscreen,
    customJavaPath,
    customGamePath,
    jvmArgs,
    currentTheme,
    username
  ],
  () => {
    saveConfig()
  },
  { deep: true }
)

const backupWorld = async (inst: SamInstance): Promise<void> => {
  status.value = `Backing up world: ${inst.name}...`
  const res = await window.electron.ipcRenderer.invoke('backup-instance-world', {
    instanceId: inst.id,
    customGamePath: customGamePath.value
  })
  if (res.success) {
    status.value = 'Backup created in /backups!'
  } else {
    status.value = 'Backup failed: ' + res.error
  }
}

const openNewInstanceModal = (): void => {
  newInstanceImportMode.value = null // Reset import mode
  if (runningInstanceId.value) {
    alert('⚠️ Cannot create a new instance while a game is running. Kill the game first.')
    return
  }
  newInstanceName.value = ''
  newInstanceVersion.value = versionsData.value.length > 0 ? versionsData.value[0].id : ''
  newInstanceModloader.value = 'vanilla'
  isNewInstanceModalOpen.value = true
}

const createInstance = (): void => {
  if (!newInstanceName.value || !newInstanceVersion.value) return
  const inst = {
    id: Date.now().toString(),
    name: newInstanceName.value,
    version: newInstanceVersion.value,
    modloader: newInstanceModloader.value
  }
  instances.value.unshift(inst)
  saveInstances()
  isNewInstanceModalOpen.value = false
}

const launchInstance = async (inst: SamInstance): Promise<void> => {
  if (authType.value === 'offline' && !username.value) return

  isLaunching.value = true
  actualLaunchCommand.value = '' // Clear old command
  // [V1.6.3] Clear old crash analysis on each new launch
  crashAnalysisResult.value = ''
  isAnalyzingCrash.value = false
  status.value = `Preparing ${inst.name}...`
  progress.value = 5

  // [V1.6.3] Force-strip AlwaysPreTouch — confirmed cause of 0xc0000005 on some Windows systems
  let safeJvmArgs = (inst.jvmArgs || jvmArgs.value || '')
    .replace(/-XX:\+AlwaysPreTouch/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // AI MOD SHIELD Scan
  if (isAiModShieldEnabled.value) {
    status.value = 'AI Shield: Scanning mods...'
    const scanRes = await window.electron.ipcRenderer.invoke('scan-mods', { instanceId: inst.id })
    if (scanRes.success && scanRes.issues && scanRes.issues.length > 0) {
      const hasCritical = scanRes.issues.some((i: any) => i.severity === 'critical')
      
      let message = '🛡️ AI MOD SHIELD REPORT\n\n'
      scanRes.issues.forEach((i: any) => {
        const icon = i.severity === 'critical' ? '🛑' : i.severity === 'high' ? '⚠️' : 'ℹ️'
        message += `${icon} [${i.severity.toUpperCase()}] ${i.file}\n`
        message += `   Issue: ${i.type}\n`
        if (i.details) message += `   Details: ${i.details}\n`
        message += '\n'
      })

      if (hasCritical) {
        alert(message + 'CRITICAL ISSUES DETECTED. Launch blocked for your safety.')
        status.value = 'Launch blocked by AI Shield'
        isLaunching.value = false
        return
      }

      const proceed = confirm(message + 'Do you want to proceed despite these warnings?')
      if (!proceed) {
        status.value = 'Launch aborted by user'
        isLaunching.value = false
        return
      }
    }
  }

  try {
    const res = await window.electron.ipcRenderer.invoke('launch-minecraft', {
      username: username.value || 'Player',
      version: inst.version,
      memoryMax: inst.memoryMax || memoryMax.value,
      memoryMin: inst.memoryMin || memoryMin.value,
      authData: authData.value ? JSON.parse(JSON.stringify(toRaw(authData.value))) : null,
      windowWidth: windowWidth.value,
      windowHeight: windowHeight.value,
      fullscreen: fullscreen.value,
      customJavaPath: customJavaPath.value,
      customGamePath: customGamePath.value,
      modloader: inst.modloader,
      instanceId: inst.id,
      jvmArgs: safeJvmArgs,
      compatibilityMode: isCompatibilityMode.value
    })

    lastLaunchOpts.value = {
      instanceId: inst.id,
      jvmArgs: inst.jvmArgs || jvmArgs.value,
      compatibilityMode: isCompatibilityMode.value
    }

    if (res.success) {
      status.value = 'Game is running!'
      runningInstanceId.value = inst.id
      // Open Hover Bar Window
      window.electron.ipcRenderer.invoke('open-hover-bar')
      // isLaunching resets when game-close fires
    } else {
      status.value = 'Error: ' + res.error
      isLaunching.value = false
      installStage.value = 'idle'
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    status.value = 'Failed: ' + errorMsg
    isLaunching.value = false
    installStage.value = 'idle'
  }
}

const killInstance = async (): Promise<void> => {
  await window.electron.ipcRenderer.invoke('kill-minecraft')
  window.electron.ipcRenderer.invoke('close-hover-bar')
  runningInstanceId.value = null
  isLaunching.value = false
  installStage.value = 'idle'
  forgeProgress.value = 0
  mcProgress.value = 0
  status.value = 'Game killed'
  setTimeout(() => {
    status.value = ''
  }, 2000)
}

const deleteInstance = async (id: string): Promise<void> => {
  if (!confirm('Are you sure you want to delete this instance?')) return
  instances.value = instances.value.filter((i) => i.id !== id)
  await saveInstances()
}

const startRenameInstance = (id: string) => {
  editingInstanceId.value = id
}

const saveInstanceName = async () => {
  editingInstanceId.value = null
  await saveInstances()
}

const openFolder = async (inst: SamInstance, type: string): Promise<void> => {
  await window.electron.ipcRenderer.invoke('open-instance-folder', {
    instanceId: inst.id,
    customGamePath: customGamePath.value,
    folderType: type
  })
}

const toggleConsole = () => {
  isConsoleOpen.value = !isConsoleOpen.value
}

const clearLogs = () => {
  logs.value = []
}

// Note: openInstanceSettings was unused and removed

// NOTE: launch-progress is now handled in onMounted with stage support

window.electron.ipcRenderer.on('game-log', (_event: unknown, data: string) => {
  logs.value.push(data)
  if (logs.value.length > 1000) logs.value.shift()
  if (isConsoleOpen.value) {
    nextTick(() => {
      if (consoleEl.value) consoleEl.value.scrollTop = consoleEl.value.scrollHeight
    })
  }
})

window.electron.ipcRenderer.on('installer-log', (_event: unknown, data: string) => {
  logs.value.push(`[INSTALLER] ${data}`)
  if (logs.value.length > 1000) logs.value.shift()
  if (isConsoleOpen.value) {
    nextTick(() => {
      if (consoleEl.value) consoleEl.value.scrollTop = consoleEl.value.scrollHeight
    })
  }
})

watch(
  [
    memoryMax,
    memoryMin,
    authType,
    windowWidth,
    windowHeight,
    fullscreen,
    customJavaPath,
    customGamePath,
    username
  ],
  () => {
    saveConfig()
  }
)

// Java & Folder Helpers
const detectJava = async () => {
  const found = await window.electron.ipcRenderer.invoke('detect-java')
  if (found && found.length > 0) {
    // Show all detected installations and validate current path
    const currentPath = customJavaPath.value?.trim()
    let message = `✅ Detected ${found.length} Java installation(s):\n\n`
    found.forEach((p: string, i: number) => {
      message += `${i + 1}. ${p}\n`
    })
    if (currentPath) {
      const isValid = found.some((p: string) => p.toLowerCase() === currentPath.toLowerCase())
      if (isValid) {
        message += `\n✅ Your current Java path is VALID and matches a detected installation.`
      } else {
        message += `\n⚠️ Your current Java path (${currentPath}) was NOT found in detected installations. It may still work if manually installed.`
      }
    } else {
      message += `\nℹ️ No custom Java path is set. The launcher will auto-detect based on Minecraft version.`
    }
    alert(message)
    status.value = `Detected ${found.length} Java installation(s).`
  } else {
    alert('❌ No Java installations (Java 8/17/21) found on your system.\n\nPlease install Java or use the Browse button to manually select javaw.exe.')
    status.value = 'No Java found. Please browse manually.'
  }
}

const browseJava = async () => {
  const selectedPath = await window.electron.ipcRenderer.invoke('browse-file', {
    title: 'Select javaw.exe',
    extensions: ['exe']
  })
  if (selectedPath) customJavaPath.value = selectedPath
}

const browseGamePath = async () => {
  const res = await window.electron.ipcRenderer.invoke('browse-folder')
  if (res.success && res.path) {
    customGamePath.value = res.path
  }
}

const importModpack = async () => {
  const res = await window.electron.ipcRenderer.invoke('browse-file', {
    title: 'Select Modpack (.zip or .mrpack)',
    extensions: ['zip', 'mrpack']
  })
  if (res) {
    status.value = 'Installing Modpack...'
    isLaunching.value = true
    const result = await window.electron.ipcRenderer.invoke('install-modpack', res)
    isLaunching.value = false
    if (result.success) {
      instances.value.push(result.instance)
      await saveInstances()
      status.value = 'Modpack Installed!'
      setTimeout(() => (status.value = ''), 3000)
    } else {
      status.value = `Error: ${result.error}`
    }
  }
}

// Persistence & Auto-scroll for AI Chat
watch(aiMessages, (newVal) => {
  localStorage.setItem('aiMessages', JSON.stringify(newVal))
  nextTick(() => {
    const container = document.getElementById('ai-chat-container')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}, { deep: true })

const manualScanMods = async () => {
  if (!selectedInstance.value) return
  status.value = 'AI Shield: Scanning mods folder...'
  const res = await window.electron.ipcRenderer.invoke('scan-mods', selectedInstance.value)
  if (res.success) {
    if (res.suspicious.length === 0) {
      status.value = 'AI Shield: All mods look safe.'
      alert('AI Shield: All mods look safe.')
    } else {
      status.value = `AI Shield: Found ${res.suspicious.length} suspicious mods!`
      alert(`AI Shield Warning: Found ${res.suspicious.length} potential issues!\n\n${res.suspicious.map(m => `- ${m.file}: ${m.reason}`).join('\n')}`)
    }
  } else {
    status.value = 'AI Shield: Scan failed.'
  }
}

onMounted(async () => {
  await loadData()
  fetchVersions()
  loadMusicList()
  checkAiStatus()
  
  // Load AI Data
  const savedSessions = localStorage.getItem('sl_ai_sessions')
  const savedCurrent = localStorage.getItem('sl_ai_current_session')
  const savedSettings = localStorage.getItem('sl_ai_settings')

  if (savedSessions) aiSessions.value = JSON.parse(savedSessions)
  if (savedSettings) aiSettings.value = JSON.parse(savedSettings)
  if (savedCurrent) currentSessionId.value = savedCurrent

  if (aiSessions.value.length === 0) {
    createNewAiSession()
  }

  customAvatarData.value = localStorage.getItem('customAvatar')
  initSkinViewer()

  window.electron.ipcRenderer.on('final-launch-command', (_: any, cmd: string) => {
    console.log('[DEBUG Renderer] Received final-launch-command:', cmd)
    actualLaunchCommand.value = cmd
  })

  // Listen for system stats for the Hover Bar
  window.electron.ipcRenderer.on('system-stats', (_: any, stats: any) => {
    systemStats.value = stats
  })

  // Listen for stage-aware progress events from main
    window.electron.ipcRenderer.on('installer-log', (_event: any, msg: string) => {
      logs.value.push(`[INSTALLER] ${msg}`)
      nextTick(() => {
        if (consoleEl.value) {
          consoleEl.value.scrollTop = consoleEl.value.scrollHeight
        }
      })
    })

    window.electron.ipcRenderer.on('launch-progress', (_event: any, data: any) => {
    if (data.stage === 'forge') {
      installStage.value = 'forge'
      forgeProgress.value = data.progress ?? forgeProgress.value
      forgeStatus.value = data.status || ''
    } else if (data.stage === 'mc') {
      installStage.value = 'mc'
      mcProgress.value = data.progress ?? mcProgress.value
      mcStatus.value = data.status || ''
    } else {
      // Generic (auth, etc.)
      status.value = data.status || status.value
      progress.value = data.progress ?? progress.value
    }
  })

  // Game started — mark instance as running
  window.electron.ipcRenderer.on('game-started', (_: any, { instanceId }: any) => {
    runningInstanceId.value = instanceId
    sessionPlaytime.value = 0
    if (playtimeTimerInterval) clearInterval(playtimeTimerInterval)
    playtimeTimerInterval = setInterval(() => {
      sessionPlaytime.value += 1
    }, 1000)
  })

  // Game closed — reset all running state
  window.electron.ipcRenderer.on('game-close', (_: any, { instanceId, code, playtimeMs }: any) => {
    window.electron.ipcRenderer.invoke('close-hover-bar')
    if (playtimeTimerInterval) {
      clearInterval(playtimeTimerInterval)
      playtimeTimerInterval = null
    }
    if (runningInstanceId.value === instanceId) {
      runningInstanceId.value = null
    }
    const inst = instances.value.find((i) => i.id === instanceId)
    if (inst && playtimeMs) {
      inst.playtime = (inst.playtime || 0) + playtimeMs
    }
    isLaunching.value = false
    installStage.value = 'idle'
    forgeProgress.value = 0
    forgeStatus.value = ''
    mcProgress.value = 0
    mcStatus.value = ''
    status.value = ''
    progress.value = 0

    // Trigger AI Crash Analyzer if exit code is non-zero
    if (code !== 0 && code !== undefined) {
      crashingInstanceId.value = instanceId
      crashAnalysisResult.value = '' // Clear previous analysis
      showCrashModal.value = true
    }
  })

  // @ts-ignore (exposed for template/dev context)
  window.backupWorld = (instId: string) => {
    const inst = instances.value.find((i) => i.id === instId)
    if (inst) backupWorld(inst)
  }
})
</script>

<template>
  <div class="fixed inset-0 min-h-screen bg-gray-950 overflow-hidden font-sans text-gray-100 flex">
    <!-- Animated Blur Background -->
    <div
      class="absolute inset-0 bg-repeat opacity-40 mix-blend-screen pointer-events-none transition-all duration-1000 ease-in-out block-texture"
      :style="backgroundStyle"
    ></div>
    <div
      class="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-transparent backdrop-blur-[2px] pointer-events-none"
    ></div>

    <!-- Sidebar Layout -->
    <aside
      class="relative z-20 w-72 h-full flex flex-col bg-gray-900/60 backdrop-blur-xl border-r border-white/10 shadow-2xl transition-all"
    >
      <!-- Header / Logo -->
      <div class="px-6 py-8 flex items-center space-x-3">
        <div class="p-2.5 bg-primary/20 rounded-xl backdrop-blur-md border border-primary/30 shrink-0">
          <img :src="logoPremium" class="w-7 h-7 object-contain" />
        </div>
        <div class="min-w-0">
          <h1
            class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400 tracking-tight leading-none"
          >
            StableLauncher
          </h1>
          <p class="text-[0.7rem] font-bold text-primary/80 uppercase tracking-widest mt-2">
            v1.0.1(BETA)
          </p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-4 space-y-2 mt-4">
        <button
          :class="[
            'w-full flex items-center px-4 py-3.5 rounded-2xl transition-all font-semibold',
            activeTab === 'instances'
              ? 'bg-white/10 text-white shadow-inner border border-white/5'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          ]"
          @click="activeTab = 'instances'"
        >
          <HardDrive
            class="w-5 h-5 mr-3"
            :class="activeTab === 'instances' ? 'text-primary' : ''"
          />
          <span>Instances</span>
        </button>
        <button
          :class="[
            'w-full flex items-center px-4 py-3.5 rounded-2xl transition-all font-semibold',
            activeTab === 'settings'
              ? 'bg-white/10 text-white shadow-inner border border-white/5'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          ]"
          @click="activeTab = 'settings'"
        >
          <Settings class="w-5 h-5 mr-3" :class="activeTab === 'settings' ? 'text-primary' : ''" />
          <span>Global Settings</span>
        </button>

        <div class="pt-4 border-t border-white/5 mt-4 space-y-2">
          <p class="px-4 text-[0.6rem] font-black text-gray-500 uppercase tracking-widest mb-2">
            v1.0.1(BETA)
          </p>

          <button
            class="w-full flex items-center px-4 py-3.5 rounded-2xl transition-all font-semibold text-gray-400 hover:text-white hover:bg-white/5"
            @click="activeTab = 'downloads'"
          >
            <Download class="w-5 h-5 mr-3 text-primary" />
            <span>Downloads</span>
          </button>

          <div class="relative flex w-full space-x-2">
            <button
              :class="[
                'flex-1 flex items-center px-4 py-3.5 rounded-2xl transition-all font-semibold overflow-hidden',
                isMusicPlaying
                  ? 'bg-primary/10 text-primary'
                  : 'bg-gray-800 border-white/5 text-gray-400 hover:text-white hover:bg-white/5'
              ]"
              @click="toggleMusic"
            >
              <Play
                class="w-5 h-5 mr-3 shrink-0"
                :class="isMusicPlaying ? 'text-primary' : ''"
              />
              <span class="truncate whitespace-nowrap">{{
                isMusicPlaying ? currentAudioName || 'Playing Music' : 'Play Music'
              }}</span>
            </button>

            <button
              class="px-4 py-3.5 rounded-2xl transition-all bg-gray-800 border-[1px] border-white/5 text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-center shrink-0"
              title="Playlist"
              @click="isMusicMenuOpen = !isMusicMenuOpen"
            >
              <List class="w-5 h-5" />
            </button>

            <!-- Playlist Popover -->
            <div
              v-if="isMusicMenuOpen"
              class="absolute bottom-full right-0 mb-3 w-64 bg-gray-900 border border-white/10 rounded-2xl shadow-xl shadow-black/50 overflow-hidden z-50 flex flex-col"
            >
              <div
                class="p-3 border-b border-white/10 flex justify-between items-center bg-gray-800/50"
              >
                <span class="text-xs font-bold text-gray-300 uppercase tracking-widest"
                  >Local Playlist</span
                >
                <span class="text-[0.65rem] text-primary font-bold"
                  >{{ musicList.length }} tracks</span
                >
              </div>

              <div class="max-h-48 overflow-y-auto p-2 space-y-1">
                <div v-if="musicList.length === 0" class="p-4 text-center text-xs text-gray-500">
                  No music found. Add some files!
                </div>
                <div
                  v-for="song in musicList"
                  :key="song.name"
                  class="text-[0.75rem] text-gray-400 p-2 rounded-xl hover:bg-white/5 truncate transition-colors flex items-center"
                  :class="{
                    'text-primary font-bold bg-primary/10': currentAudioName === song.name
                  }"
                >
                  <Play
                    v-if="currentAudioName === song.name"
                    class="w-3 h-3 mr-2"
                  />
                  <span class="truncate whitespace-nowrap">{{ song.name }}</span>
                </div>
              </div>

              <div class="p-2 border-t border-white/10 bg-gray-800/50 flex space-x-2">
                <button
                  class="flex-1 py-2 rounded-xl bg-primary/20 text-primary text-[0.65rem] font-bold uppercase tracking-widest hover:bg-primary/30 transition-all flex items-center justify-center"
                  @click="addMusic"
                >
                  <Plus class="w-3 h-3 mr-1" /> Add
                </button>
                <button
                  class="flex-1 py-2 rounded-xl bg-white/5 text-gray-300 text-[0.65rem] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center"
                  @click="openMusicFolder"
                >
                  <Folder class="w-3 h-3 mr-1" /> Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <!-- Profile Area -->
      <div class="px-4 mt-auto mb-6">
        <div
          class="p-6 rounded-3xl bg-gray-800/50 border border-white/5 backdrop-blur-md flex flex-col items-center group relative overflow-hidden"
        >
          <!-- 3D Skin Viewer Container -->
          <div
            class="relative w-full h-40 flex justify-center items-center cursor-pointer group/avatar"
            @click="skinFileInput?.click()"
          >
            <canvas ref="skinViewerEl" class="skin-canvas"></canvas>

            <div
              class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-2xl"
            >
              <Plus class="w-6 h-6 text-white" />
            </div>
          </div>
          <input
            ref="skinFileInput"
            type="file"
            class="hidden"
            accept="image/png"
            @change="handleSkinUpload"
          />

          <div class="w-full mt-4 flex items-center justify-between">
            <div class="overflow-hidden">
              <p class="text-sm font-bold text-white truncate w-24">
                {{ authData?.name || username || 'Steve' }}
              </p>
              <p
                class="text-[0.6rem] font-bold uppercase tracking-wider"
                :class="authData ? 'text-primary' : 'text-gray-500'"
              >
                {{ authData ? 'Premium' : 'Offline' }}
              </p>
            </div>

            <button
              :title="authData ? 'Sync with Microsoft/NameMC' : 'Fetch skin from NameMC'"
              class="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-all mr-2"
              @click="refreshPremiumSkin()"
            >
              <Cpu class="w-4 h-4 animate-pulse" />
            </button>

            <button
              :title="authData ? 'Logout' : 'Login with Microsoft'"
              :class="[
                'p-2 rounded-xl transition-all',
                authData
                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                  : 'bg-[#00a4ef]/10 hover:bg-[#00a4ef]/20 text-[#00a4ef]'
              ]"
              @click="authData ? handleLogout() : handleLogin()"
            >
              <LogOut v-if="authData" class="w-4 h-4" />
              <User v-else class="w-4 h-4" />
            </button>
          </div>

          <!-- Offline Name Input (Hidden for Premium) -->
          <div
            v-if="!authData"
            class="w-full mt-4 flex space-x-2 animate-in fade-in slide-in-from-bottom-1 duration-300"
          >
            <input
              v-model="username"
              type="text"
              class="flex-1 bg-gray-900/80 border border-gray-700/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-medium"
              placeholder="Username"
            />
            <button
              class="px-2 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl border border-primary/20 transition-all"
              title="Fetch Skin"
              @click="refreshPremiumSkin"
            >
              <Check class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Branding Footer -->
      <div class="mt-4 px-6 py-4 border-t border-white/5 bg-black/10">
        <p
          class="text-[0.6rem] font-bold text-gray-500 uppercase tracking-[0.2em] text-center opacity-60"
        >
          made by Discord-SamObviously
        </p>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
      <!-- Title Bar & Status -->
      <div
        class="h-24 px-10 flex items-center justify-between flex-shrink-0 bg-gradient-to-b from-gray-950/50 to-transparent"
      >
        <h2 class="text-3xl font-bold tracking-tight">
          {{
            activeTab === 'instances'
              ? 'My Instances'
              : activeTab === 'downloads'
                ? 'Downloads'
                : 'Settings'
          }}
        </h2>

        <div class="flex items-center space-x-6">
          <!-- Console Toggle Button -->
          <button
            :class="[
              'p-2 rounded-xl transition-all flex items-center space-x-2',
              isConsoleOpen
                ? 'bg-primary text-gray-900 shadow-lg shadow-primary/20'
                : 'bg-gray-800 text-gray-400 hover:text-white border border-white/5'
            ]"
            @click="toggleConsole"
          >
            <Terminal class="w-5 h-5" />
            <span class="text-sm font-bold">Console</span>
          </button>

          <!-- Progress Bars (Forge + MC) + Kill -->
          <Transition name="fade">
            <div
              v-if="isLaunching || installStage !== 'idle' || runningInstanceId"
              class="flex items-center gap-3"
            >
              <!-- Kill Button -->
              <button
                v-if="runningInstanceId"
                class="px-3 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-red-600/30 flex items-center gap-1.5"
                @click="killInstance"
              >
                ⏹ Kill
              </button>

              <!-- Dual Progress bars -->
              <div
                class="w-60 bg-gray-900/60 p-3 rounded-xl border border-gray-800 backdrop-blur-md flex flex-col gap-2"
              >
                <!-- Forge bar -->
                <div v-if="installStage === 'forge' || forgeProgress > 0">
                  <div class="flex justify-between text-[10px] font-semibold text-gray-300 mb-1">
                    <span class="truncate pr-2">🔧 {{ forgeStatus || 'Forge' }}</span>
                    <span class="text-orange-400">{{ Math.round(forgeProgress) }}%</span>
                  </div>
                  <div class="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-orange-500 transition-all duration-300 ease-out"
                      :style="{ width: `${forgeProgress}%` }"
                    ></div>
                  </div>
                </div>
                <!-- MC bar -->
                <div v-if="installStage === 'mc' || mcProgress > 0 || runningInstanceId">
                  <div class="flex justify-between text-[10px] font-semibold text-gray-300 mb-1">
                    <span class="truncate pr-2">{{
                      runningInstanceId && installStage === 'idle'
                        ? '🎮 Running'
                        : `⬇️ ${mcStatus || 'Minecraft'}`
                    }}</span>
                    <span class="text-primary">{{
                      runningInstanceId && installStage === 'idle'
                        ? '✓'
                        : `${Math.round(mcProgress)}%`
                    }}</span>
                  </div>
                  <div class="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-primary transition-all duration-300 ease-out"
                      :style="{
                        width:
                          runningInstanceId && installStage === 'idle' ? '100%' : `${mcProgress}%`
                      }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Scroller Content -->
      <div class="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar">
        <div v-if="activeTab === 'instances'" class="space-y-6">
          <div class="flex items-center space-x-4">
            <button
              class="flex flex-col items-center justify-center sm:w-48 sm:h-56 bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/20 hover:border-primary/50 rounded-3xl transition-all group p-6"
              @click="openNewInstanceModal"
            >
              <div
                class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 text-primary transition-colors mb-4 border border-primary/20"
              >
                <Plus class="w-6 h-6" />
              </div>
              <span class="font-bold">New Instance</span>
            </button>

            <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <!-- Instance Cards -->
              <div
                v-for="inst in instances"
                :key="inst.id"
                class="relative group flex flex-col bg-gray-800/40 backdrop-blur-xl border border-white/5 hover:border-gray-600 rounded-3xl overflow-hidden shadow-xl transition-all hover:scale-[1.02]"
              >
                <!-- Delete Button (Top Right of Card) -->
                <button
                  class="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 text-gray-400 hover:text-red-400 hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all z-20 w-8 h-8 flex items-center justify-center cursor-pointer"
                  @click.prevent.stop="deleteInstance(inst.id)"
                >
                  <X class="w-4 h-4" />
                </button>

                <!-- Running Overlay (Specific to this instance) -->
                <Transition name="fade">
                  <div
                    v-if="runningInstanceId === inst.id"
                    class="absolute inset-0 bg-primary/20 backdrop-blur-md flex flex-col items-center justify-center space-y-4 z-20 border-2 border-primary/50"
                  >
                    <div class="relative">
                      <div class="w-16 h-16 border-4 border-primary/20 rounded-full animate-spin border-t-primary"></div>
                      <div class="absolute inset-0 flex items-center justify-center">
                        <Gamepad2 class="w-6 h-6 text-white animate-pulse" />
                      </div>
                    </div>
                  </div>
                </Transition>

                <div
                  class="h-24 bg-gradient-to-br from-primary/30 to-gray-900 border-b border-white/5 p-5 relative overflow-hidden group/header"
                >
                  <!-- Header Play Overlay -->
                  <div class="absolute inset-0 bg-gray-950/80 backdrop-blur-md opacity-0 group-hover/header:opacity-100 transition-all flex items-center justify-center z-10">
                    <button
                      class="px-5 py-2.5 bg-primary text-gray-950 font-black uppercase tracking-widest text-[0.65rem] rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center"
                      @click.stop="launchInstance(inst)"
                    >
                      <Play class="w-3.5 h-3.5 mr-2 fill-gray-950" /> Launch
                    </button>
                  </div>

                  <div class="absolute -bottom-4 -right-4 text-primary/10 pointer-events-none">
                    <Gamepad2 class="w-24 h-24" />
                  </div>
                  <div
                    v-if="editingInstanceId === inst.id"
                    class="relative z-0 flex items-center pr-6"
                  >
                    <input
                      v-model="inst.name"
                      type="text"
                      class="w-full bg-gray-900 border border-primary/50 rounded-lg px-2 py-1 text-white focus:outline-none text-xl font-bold"
                      @blur="saveInstanceName"
                      @keyup.enter="saveInstanceName"
                    />
                    <button
                      class="ml-2 p-1 text-primary hover:text-primary"
                      @click.stop="saveInstanceName"
                    >
                      <Check class="w-5 h-5" />
                    </button>
                  </div>
                  <div v-else class="relative z-0 flex items-center justify-between pr-6">
                    <h3 class="text-xl font-bold truncate">{{ inst.name }}</h3>
                    <button
                      class="p-1 text-gray-400 hover:text-primary opacity-0 group-hover/header:opacity-100 transition-opacity"
                      @click.prevent.stop="startRenameInstance(inst.id)"
                    >
                      <Edit3 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="flex items-center text-xs text-gray-400 mb-1 font-medium">
                        <Download class="w-3 h-3 mr-1.5 text-primary" />
                        <span class="text-[0.65rem] overflow-hidden truncate">{{
                          inst.version
                        }}</span>
                      </div>
                      <div class="flex items-center text-xs text-gray-400 font-medium capitalize">
                        <Cpu class="w-3 h-3 mr-1.5 text-primary" />
                        <span class="text-[0.65rem] overflow-hidden truncate">{{
                          inst.modloader
                        }}</span>
                      </div>
                    </div>

                    <button
                      title="Manage Instance"
                      class="p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-all border border-primary/20 hover:border-primary/40"
                      @click.stop="openDetailPanel(inst)"
                    >
                      <ChevronRight class="w-4 h-4" />
                    </button>
                  </div>

                  <!-- Play / Kill button (per instance) -->
                </div>
                <!-- Playtime Hover UI -->
                <div v-if="inst.playtime" class="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-1.5 rounded-lg flex items-center shadow-xl z-30 pointer-events-none">
                  <Clock class="w-3.5 h-3.5 text-primary mr-1.5" />
                  <span class="text-[0.7rem] font-bold text-gray-300">{{ formatPlaytime(inst.playtime) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'settings'" class="h-full flex space-x-6 w-full max-w-6xl mx-auto">
          <!-- Settings Sidebar -->
          <div class="w-64 shrink-0 space-y-2 py-6">
            <h2 class="text-2xl font-black text-white mb-6 uppercase tracking-widest px-4">Settings</h2>
            <button
              v-for="tab in [
                { id: 'general', label: 'General', icon: Home },
                { id: 'java', label: 'Java', icon: Cpu },
                { id: 'theme', label: 'Appearance', icon: Palette },
                { id: 'about', label: 'About', icon: Coffee }
              ]"
              :key="tab.id"
              class="w-full text-left px-5 py-3.5 rounded-2xl transition-all font-bold flex items-center space-x-3"
              :class="settingsTab === tab.id ? 'bg-primary/20 text-primary border border-primary/30 shadow-lg shadow-primary/10' : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'"
              @click="settingsTab = tab.id"
            >
              <component :is="tab.icon" class="w-5 h-5" />
              <span>{{ tab.label }}</span>
            </button>
          </div>

          <!-- Settings Content -->
          <div class="flex-1 bg-gray-800/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 overflow-y-auto custom-scrollbar my-6 relative">
            
            <!-- General Tab -->
            <div v-if="settingsTab === 'general'" class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 class="text-2xl font-bold mb-6 border-b border-white/5 pb-4 text-white">General</h3>
              
              <div class="space-y-8">
                <!-- User Interface Section -->
                <div class="bg-gray-900/40 border border-white/5 rounded-2xl p-6">
                  <h4 class="text-lg font-bold text-gray-300 mb-6 flex items-center"><Home class="w-4 h-4 mr-2 text-primary"/> User Interface</h4>
                  <label class="flex items-center space-x-3 cursor-pointer">
                    <input
                      v-model="fullscreen"
                      type="checkbox"
                      class="w-5 h-5 rounded border-gray-700 bg-gray-900 text-primary focus:ring-primary"
                    />
                    <span class="font-semibold text-gray-300">Start in Fullscreen mode</span>
                  </label>
                  
                  <div class="grid grid-cols-2 gap-6 mt-6">
                    <div>
                      <label class="block text-sm font-semibold text-gray-400 mb-2">Window Width</label>
                      <input
                        v-model="windowWidth"
                        type="number"
                        class="w-full bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-semibold text-gray-400 mb-2">Window Height</label>
                      <input
                        v-model="windowHeight"
                        type="number"
                        class="w-full bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                      />
                    </div>
                  </div>
                </div>

                <!-- Folders Section -->
                <div class="bg-gray-900/40 border border-white/5 rounded-2xl p-6">
                  <h4 class="text-lg font-bold text-gray-300 mb-6 flex items-center"><FolderOpen class="w-4 h-4 mr-2 text-primary"/> Folders</h4>
                  <div>
                    <label class="block text-sm font-semibold text-gray-400 mb-2">Global Override Directory</label>
                    <div class="flex space-x-2">
                      <input
                        v-model="customGamePath"
                        type="text"
                        placeholder="Default: OS specific .minecraft folder"
                        class="flex-1 bg-gray-900/50 text-white backdrop-blur-md border border-gray-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder-gray-600"
                        @click="browseGamePath"
                      />
                      <button
                        class="px-6 py-2 bg-gray-700/50 hover:bg-gray-600 text-white rounded-xl font-bold transition-colors"
                        @click="browseGamePath"
                      >Browse</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Java Tab -->
            <div v-if="settingsTab === 'java'" class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 class="text-2xl font-bold mb-6 border-b border-white/5 pb-4 text-white">Java</h3>
              
              <div class="space-y-8">
                <!-- Java Installation -->
                <div class="bg-gray-900/40 border border-white/5 rounded-2xl p-6">
                  <h4 class="text-lg font-bold text-gray-300 mb-6 flex items-center"><Cpu class="w-4 h-4 mr-2 text-primary"/> Java Installation</h4>
                  <div>
                    <label class="block text-sm font-semibold text-gray-400 mb-2">Java Executable Path</label>
                    <div class="flex space-x-2">
                      <input
                        v-model="customJavaPath"
                        type="text"
                        placeholder="Auto-detect based on Minecraft version"
                        class="flex-1 bg-gray-900/50 text-white backdrop-blur-md border border-gray-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder-gray-600"
                      />
                      <button 
                        class="px-6 py-2 bg-gray-700/50 hover:bg-gray-600 text-white rounded-xl font-bold transition-colors"
                        @click="detectJava"
                      >Detect</button>
                      <button 
                        class="px-6 py-2 bg-gray-700/50 hover:bg-gray-600 text-white rounded-xl font-bold transition-colors"
                        @click="browseJava"
                      >Browse</button>
                    </div>
                  </div>
                </div>

                <!-- Memory -->
                <div class="bg-gray-900/40 border border-white/5 rounded-2xl p-6">
                  <h4 class="text-lg font-bold text-gray-300 mb-6 flex items-center"><HardDrive class="w-4 h-4 mr-2 text-primary"/> Memory</h4>
                  <div class="grid grid-cols-2 gap-6">
                    <div>
                      <label class="block text-sm font-semibold text-gray-400 mb-2">Minimum Memory Usage (-Xms)</label>
                      <select
                        v-model="memoryMin"
                        class="w-full bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white font-bold"
                      >
                        <option value="512M">512 MiB</option>
                        <option value="1G">1024 MiB (1 GB)</option>
                        <option value="2G">2048 MiB (2 GB)</option>
                        <option value="4G">4096 MiB (4 GB)</option>
                        <option value="8G">8192 MiB (8 GB)</option>
                        <option value="12G">12288 MiB (12 GB)</option>
                        <option value="16G">16384 MiB (16 GB)</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm font-semibold text-gray-400 mb-2">Maximum Memory Usage (-Xmx)</label>
                      <select
                        v-model="memoryMax"
                        class="w-full bg-gray-900/50 backdrop-blur-md border border-primary/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white font-bold"
                      >
                        <option value="2G">2048 MiB (2 GB)</option>
                        <option value="4G">4096 MiB (4 GB)</option>
                        <option value="8G">8192 MiB (8 GB)</option>
                        <option value="12G">12288 MiB (12 GB)</option>
                        <option value="16G">16384 MiB (16 GB)</option>
                        <option value="24G">24576 MiB (24 GB)</option>
                        <option value="32G">32768 MiB (32 GB)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- AI Mod Shield Security -->
                <div class="bg-gray-900/40 border border-white/5 rounded-2xl p-6">
                  <h4 class="text-lg font-bold text-gray-300 mb-6 flex items-center"><ShieldCheck class="w-4 h-4 mr-2 text-primary"/> AI Security</h4>
                  <div class="flex items-center justify-between p-5 bg-primary/5 border border-primary/20 rounded-2xl group/shield">
                    <div class="flex items-center space-x-4">
                      <div class="p-3 bg-primary/20 rounded-xl text-primary group-hover/shield:scale-110 transition-transform">
                        <Lock class="w-6 h-6" />
                      </div>
                      <div>
                        <p class="text-base font-bold text-white flex items-center">
                          AI MOD SHIELD
                          <span class="ml-2 px-2 py-0.5 bg-primary/30 text-[0.6rem] rounded text-primary border border-primary/20 uppercase">Beta</span>
                        </p>
                        <p class="text-[0.75rem] text-gray-500 font-medium leading-relaxed max-w-[400px]">
                          Scans your mods folder for suspicious patterns and mismatches with Modrinth/CurseForge. Warns before launch.
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center space-x-3">
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" v-model="isAiModShieldEnabled" class="sr-only peer" />
                        <div class="w-14 h-8 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Java Arguments -->
                <div class="bg-gray-900/40 border border-white/5 rounded-2xl p-6">
                  <h4 class="text-lg font-bold text-gray-300 mb-6 flex items-center"><Terminal class="w-4 h-4 mr-2 text-primary"/> Java Arguments</h4>
                  <div class="flex items-center justify-between mb-4">
                    <label class="block text-sm font-semibold text-gray-400">Custom JVM Arguments</label>
                    <div class="flex items-center space-x-3">
                      <button
                        :disabled="isOptimizingJvm"
                        class="group flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-md hover:bg-primary/20 text-primary transition-all shadow-[0_8px_32px_rgba(0,0,0,0.37)] border border-white/20 disabled:opacity-50 hover:border-primary/50 hover:shadow-primary/30"
                        title="Click here to let AI analyze your hardware and allocate the perfect Java memory & arguments."
                        @click="optimizeJvmArgs"
                      >
                        <Sparkles class="w-4 h-4 text-primary group-hover:scale-110 transition-transform" :class="{ 'animate-pulse text-yellow-400': isOptimizingJvm }" />
                        <span class="text-sm font-black tracking-wide text-white drop-shadow-[0_0_5px_v-bind(primaryColor)]">{{ isOptimizingJvm ? 'Analyzing...' : 'Smart Optimize' }}</span>
                      </button>
                      <button
                        class="text-xs font-bold text-gray-500 hover:text-primary uppercase tracking-wider transition-colors px-2"
                        @click="resetJvmArgs"
                      >
                        Restore Defaults
                      </button>
                    </div>
                  </div>
                  <textarea
                    v-model="jvmArgs"
                    rows="3"
                    placeholder="-XX:+UseG1GC ..."
                    :disabled="isOptimizingJvm"
                    class="w-full bg-gray-900/50 text-white backdrop-blur-md border border-gray-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder-gray-600 font-mono text-sm disabled:opacity-50 resize-y"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- Appearance Tab -->
            <div v-if="settingsTab === 'theme'" class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 class="text-2xl font-bold mb-6 border-b border-white/5 pb-4 text-white">Appearance</h3>
              
              <div class="bg-gray-900/40 border border-white/5 rounded-2xl p-6">
                <h4 class="text-lg font-bold text-gray-300 mb-6 flex items-center"><Palette class="w-4 h-4 mr-2 text-primary"/> Launcher Theme</h4>
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <button
                    v-for="(theme, name) in themes"
                    :key="name"
                    :class="[
                      'p-4 rounded-2xl border transition-all text-left flex flex-col items-center space-y-3 group/theme',
                      currentTheme === name
                        ? 'bg-primary/20 border-primary shadow-lg shadow-primary/10'
                        : 'bg-gray-900/50 border-white/5 text-gray-400 hover:border-white/20 hover:bg-white/5'
                    ]"
                    @click="selectTheme(name)"
                  >
                    <div
                      class="w-full h-20 rounded-xl shrink-0 shadow-sm bg-repeat transition-transform group-hover/theme:scale-105"
                      :style="{
                        backgroundColor: theme.primary,
                        backgroundImage: `url(${theme.bg})`,
                        backgroundSize: '32px',
                        imageRendering: 'pixelated'
                      }"
                    ></div>
                    <span
                      :class="[
                        'font-bold text-[0.75rem] uppercase tracking-widest truncate transition-colors',
                        currentTheme === name ? 'text-primary' : 'group-hover:text-white'
                      ]"
                    >
                      {{ theme.name }}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <!-- About Tab -->
            <div v-if="settingsTab === 'about'" class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 class="text-2xl font-bold mb-6 border-b border-white/5 pb-4 text-white">About & Support</h3>
              
              <div class="bg-gradient-to-br from-orange-500/10 to-orange-600/5 backdrop-blur-xl border border-orange-500/20 rounded-3xl p-8 relative overflow-hidden">
                <div class="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
                  <Coffee class="w-64 h-64 text-orange-500" />
                </div>
                <div class="flex flex-col space-y-6 relative z-10">
                  <div class="flex items-center space-x-4">
                    <div class="p-4 bg-orange-500/20 rounded-2xl text-orange-400">
                      <Coffee class="w-10 h-10" />
                    </div>
                    <div>
                      <h3 class="text-2xl font-black text-white">Support Stable Launcher</h3>
                      <p class="text-gray-400 mt-2 text-sm leading-relaxed max-w-md">Building and maintaining modern tools takes time and coffee. If you enjoy the sleek interface, AI optimization, and blazing fast speeds, consider supporting the development!</p>
                    </div>
                  </div>
                  <div>
                    <button
                      class="px-8 py-4 bg-orange-500 hover:bg-orange-400 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-orange-500/20 active:scale-95 flex items-center"
                      @click="openLink('https://www.buymeacoffee.com/samobviously')"
                    >
                      <Coffee class="w-5 h-5 mr-2" /> Buy me a coffee!
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>

        <!-- Downloads Tab -->
        <div v-if="activeTab === 'downloads'" class="space-y-6">
          <!-- Source & Category Selector -->
          <div class="flex flex-col space-y-4 mb-6">
            <!-- Source Toggle -->
            <div class="flex items-center space-x-2">
              <button
                :class="[
                  'px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border flex items-center',
                  downloadSource === 'modrinth'
                    ? 'bg-[#00AF5C]/20 border-[#00AF5C] text-[#00AF5C]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                ]"
                @click="
                  downloadSource = 'modrinth';
                  modResults = [];
                  downloadProjectType = 'mod'
                "
              >
                Modrinth
              </button>
              <button
                :class="[
                  'px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border flex items-center',
                  downloadSource === 'curseforge'
                    ? 'bg-[#F16436]/20 border-[#F16436] text-[#F16436]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                ]"
                @click="
                  downloadSource = 'curseforge';
                  modResults = [];
                  downloadProjectType = 'mod'
                "
              >
                CurseForge
              </button>
            </div>

            <!-- Category Selector -->
            <div class="flex items-center space-x-3 flex-wrap gap-y-2">
              <button
                v-for="cat in [
                  { label: 'Mods', value: 'mod' },
                  { label: 'Resource Packs', value: 'resourcepack' },
                  { label: 'Shaders', value: 'shader' },
                  { label: 'Modpacks', value: 'modpack' }
                ].filter(
                  (c) => downloadSource === 'modrinth' || ['mod', 'modpack'].includes(c.value)
                )"
                :key="cat.value"
                :class="[
                  'px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all border',
                  downloadProjectType === cat.value
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                ]"
                @click="
                  downloadProjectType = cat.value;
                  modResults = []
                "
              >
                {{ cat.label }}
              </button>
            </div>
          </div>

          <!-- Search Bar -->
          <div class="flex space-x-3">
            <input
              v-model="modQuery"
              type="text"
              :placeholder="`Search ${downloadProjectType === 'mod' ? 'mods' : downloadProjectType === 'resourcepack' ? 'resource packs' : downloadProjectType === 'shader' ? 'shaders' : 'modpacks'} on Modrinth...`"
              class="flex-1 bg-gray-800/60 border border-white/10 rounded-2xl px-6 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
              @input="autoSearch"
              @keyup.enter="searchMods"
            />
            <button
              :disabled="isSearchingMods"
              class="px-6 py-3.5 bg-primary text-white font-bold rounded-2xl transition-all hover:bg-primary/80 disabled:opacity-50"
              @click="searchMods"
            >
              {{ isSearchingMods ? 'Searching...' : 'Search' }}
            </button>
          </div>

          <!-- Results Grid -->
          <div v-if="modResults.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              v-for="mod in modResults"
              :key="mod.id"
              class="bg-gray-800/40 border border-white/5 rounded-2xl p-4 hover:border-primary/30 transition-all flex space-x-4 cursor-pointer group/card"
              @click="openModVersionSelection(mod)"
            >
              <img
                v-if="mod.icon_url"
                :src="mod.icon_url"
                class="w-14 h-14 rounded-xl object-cover shrink-0 bg-gray-700"
              />
              <div
                v-else
                class="w-14 h-14 rounded-xl bg-gray-700 shrink-0 flex items-center justify-center"
              >
                <Coffee class="w-6 h-6 text-gray-500" />
              </div>
              <div class="flex-1 min-w-0">
                <h4
                  class="text-sm font-bold text-white truncate group-hover/card:text-primary transition-colors"
                >
                  {{ mod.title }}
                </h4>
                <p class="text-[0.65rem] text-gray-400 line-clamp-2 mt-1">{{ mod.description }}</p>
                <p class="text-[0.55rem] text-gray-500 mt-1 uppercase tracking-wider font-bold">
                  by {{ mod.author }}
                </p>
              </div>
            </div>
          </div>
          <div
            v-else-if="!isSearchingMods && modQuery"
            class="py-12 flex flex-col items-center text-gray-600"
          >
            <Download class="w-12 h-12 opacity-10 mb-3" />
            <p class="font-medium italic">No results. Try a different search term.</p>
          </div>
        </div>
      </div>
    </main>

    <!-- Instance Detail Panel Modal -->
    <Transition name="zoom">
      <div
        v-if="isDetailPanelOpen && detailInstance"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/80 backdrop-blur-md"
          @click="isDetailPanelOpen = false"
        ></div>

        <div
          class="relative bg-gray-900 border border-white/10 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex max-h-[85vh]"
        >
          <!-- Left Sidebar -->
          <div
            class="w-16 bg-black/30 border-r border-white/5 flex flex-col items-center py-6 space-y-2 shrink-0"
          >
            <button
              :class="[
                'p-3 rounded-xl transition-all',
                detailTab === 'worlds'
                  ? 'bg-primary/20 text-primary'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              ]"
              title="Worlds"
              @click="detailTab = 'worlds'"
            >
              <Globe class="w-5 h-5" />
            </button>
            <button
              :class="[
                'p-3 rounded-xl transition-all',
                detailTab === 'servers'
                  ? 'bg-primary/20 text-primary'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              ]"
              title="Servers"
              @click="detailTab = 'servers'"
            >
              <Server class="w-5 h-5" />
            </button>
            <button
              :class="[
                'p-3 rounded-xl transition-all',
                detailTab === 'java'
                  ? 'bg-primary/20 text-primary'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              ]"
              title="Java Settings"
              @click="detailTab = 'java'"
            >
              <Cpu class="w-5 h-5" />
            </button>
            <div class="w-8 border-t border-white/10 my-2"></div>
            <button
              :class="[
                'p-3 rounded-xl transition-all',
                detailTab === 'mods'
                  ? 'bg-primary/20 text-primary'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              ]"
              title="Mods"
              @click="detailTab = 'mods'"
            >
              <Coffee class="w-5 h-5" />
            </button>
            <button
              :class="[
                'p-3 rounded-xl transition-all',
                detailTab === 'textures'
                  ? 'bg-primary/20 text-primary'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              ]"
              title="Resource Packs"
              @click="detailTab = 'textures'"
            >
              <Palette class="w-5 h-5" />
            </button>
            <button
              :class="[
                'p-3 rounded-xl transition-all',
                detailTab === 'shaders'
                  ? 'bg-primary/20 text-primary'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              ]"
              title="Shaders"
              @click="detailTab = 'shaders'"
            >
              <Sparkles class="w-5 h-5" />
            </button>
          </div>

          <!-- Right Content -->
          <div class="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
              <div>
                <h2 class="text-2xl font-bold text-white">{{ detailInstance.name }}</h2>
                <p class="text-[0.6rem] text-gray-500 font-black uppercase tracking-widest mt-1">
                  {{ detailInstance.modloader }} • {{ detailInstance.version }}
                </p>
              </div>
              <button
                class="p-2 text-gray-500 hover:text-white transition-colors bg-white/5 rounded-full"
                @click="isDetailPanelOpen = false"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <!-- Worlds Tab -->
            <div v-if="detailTab === 'worlds'" class="space-y-3">
              <div class="flex items-center justify-between mb-4">
                <p class="text-xs font-black text-gray-500 uppercase tracking-widest">
                  Saved Worlds
                </p>
                <button
                  class="text-xs font-bold text-primary hover:underline"
                  @click="openFolder(detailInstance, 'saves')"
                >
                  Open Folder
                </button>
              </div>
              <div
                v-if="detailWorlds.length === 0"
                class="py-12 flex flex-col items-center text-gray-600 bg-black/20 rounded-2xl border border-dashed border-white/5"
              >
                <Globe class="w-12 h-12 opacity-10 mb-3" />
                <p class="font-medium italic">No worlds found. Play the game to create one!</p>
              </div>
              <div
                v-for="world in detailWorlds"
                :key="world"
                class="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center space-x-3"
              >
                <Globe class="w-5 h-5 text-primary shrink-0" />
                <span class="text-sm font-medium text-gray-300">{{ world }}</span>
              </div>
            </div>

            <!-- Servers Tab -->
            <div v-if="detailTab === 'servers'" class="space-y-3">
              <p class="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Servers</p>
              <div
                class="py-12 flex flex-col items-center text-gray-600 bg-black/20 rounded-2xl border border-dashed border-white/5"
              >
                <Server class="w-12 h-12 opacity-10 mb-3" />
                <p class="font-medium italic">
                  {{
                    detailServers.exists
                      ? 'servers.dat found. Server list is managed in-game.'
                      : 'No servers.dat found. Add servers in-game.'
                  }}
                </p>
              </div>
            </div>

            <!-- Java Settings Tab -->
            <div v-if="detailTab === 'java'" class="space-y-6">
              <p class="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">
                Instance Java Settings
              </p>
              <div class="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-5">
                <div>
                  <label class="block text-sm font-semibold text-gray-400 mb-2">Max Memory</label>
                  <select
                    v-model="detailInstance.memoryMax"
                    class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Use Global Default</option>
                    <option value="2G">2 GB</option>
                    <option value="4G">4 GB</option>
                    <option value="8G">8 GB</option>
                    <option value="12G">12 GB</option>
                    <option value="16G">16 GB</option>
                  </select>
                </div>

                <div class="pt-2">
                  <div class="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                    <div class="flex items-center space-x-3">
                      <div class="p-2 bg-primary/20 rounded-xl text-primary">
                        <ShieldCheck class="w-5 h-5" />
                      </div>
                      <div>
                        <p class="text-sm font-bold text-white">Deep Compatibility Mode</p>
                        <p class="text-[0.65rem] text-gray-500 font-medium">Auto-disables hardware acceleration & sharing to fix 0xc0000005.</p>
                      </div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" v-model="isCompatibilityMode" class="sr-only peer" />
                      <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label class="block text-sm font-semibold text-gray-400">JVM Arguments</label>
                    <button
                      class="flex items-center space-x-1.5 px-3 py-1 bg-primary/10 hover:bg-primary/30 border border-primary/20 rounded-lg text-[0.6rem] font-black text-primary uppercase transition-all"
                      @click="optimizeJvmArgs"
                    >
                      <Sparkles class="w-3 h-3" />
                      <span>Smart Optimize</span>
                    </button>
                  </div>
                  <input
                    v-model="detailInstance.jvmArgs"
                    type="text"
                    placeholder="Use Global Default"
                    class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                  />
                </div>
                <button
                  class="w-full py-3 bg-primary text-white font-bold rounded-xl transition-all hover:bg-primary/80"
                  @click="saveInstanceSettings"
                >
                  Save Settings
                </button>
              </div>
            </div>

            <!-- Mods Tab -->
            <div v-if="detailTab === 'mods'" class="space-y-3">
              <div class="flex items-center justify-between mb-4">
                <p class="text-xs font-black text-gray-500 uppercase tracking-widest">
                  Installed Mods
                </p>
                <button
                  class="text-xs font-bold text-primary hover:underline"
                  @click="openFolder(detailInstance, 'mods')"
                >
                  Open Folder
                </button>
              </div>
              <div
                v-if="instanceMods.length === 0"
                class="py-12 flex flex-col items-center text-gray-600 bg-black/20 rounded-2xl border border-dashed border-white/5"
              >
                <Coffee class="w-12 h-12 opacity-10 mb-3" />
                <p class="font-medium italic">No mods installed.</p>
              </div>
              <div
                v-for="mod in instanceMods"
                :key="mod"
                class="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center space-x-3"
              >
                <div class="w-1.5 h-1.5 rounded-full bg-primary/50"></div>
                <span class="text-sm font-medium text-gray-300 truncate">{{ mod }}</span>
              </div>
            </div>

            <!-- Textures Tab -->
            <div v-if="detailTab === 'textures'" class="space-y-3">
              <div class="flex items-center justify-between mb-4">
                <p class="text-xs font-black text-gray-500 uppercase tracking-widest">
                  Resource Packs
                </p>
                <button
                  class="text-xs font-bold text-primary hover:underline"
                  @click="openFolder(detailInstance, 'resourcepacks')"
                >
                  Open Folder
                </button>
              </div>
              <div
                v-if="detailResourcepacks.length === 0"
                class="py-12 flex flex-col items-center text-gray-600 bg-black/20 rounded-2xl border border-dashed border-white/5"
              >
                <Palette class="w-12 h-12 opacity-10 mb-3" />
                <p class="font-medium italic">No resource packs installed.</p>
              </div>
              <div
                v-for="rp in detailResourcepacks"
                :key="rp"
                class="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center space-x-3"
              >
                <Palette class="w-4 h-4 text-primary shrink-0" />
                <span class="text-sm font-medium text-gray-300 truncate">{{ rp }}</span>
              </div>
            </div>

            <!-- Shaders Tab -->
            <div v-if="detailTab === 'shaders'" class="space-y-3">
              <div class="flex items-center justify-between mb-4">
                <p class="text-xs font-black text-gray-500 uppercase tracking-widest">
                  Shader Packs
                </p>
                <button
                  class="text-xs font-bold text-primary hover:underline"
                  @click="openFolder(detailInstance, 'shaderpacks')"
                >
                  Open Folder
                </button>
              </div>
              <div
                v-if="detailShaderpacks.length === 0"
                class="py-12 flex flex-col items-center text-gray-600 bg-black/20 rounded-2xl border border-dashed border-white/5"
              >
                <Sparkles class="w-12 h-12 opacity-10 mb-3" />
                <p class="font-medium italic">No shader packs installed.</p>
              </div>
              <div
                v-for="sp in detailShaderpacks"
                :key="sp"
                class="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center space-x-3"
              >
                <Sparkles class="w-4 h-4 text-primary shrink-0" />
                <span class="text-sm font-medium text-gray-300 truncate">{{ sp }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Log Console Drawer -->
    <Transition name="slide-up">
      <div
        v-if="isConsoleOpen"
        class="fixed bottom-0 left-0 right-0 h-1/3 z-40 bg-gray-950/95 backdrop-blur-2xl border-t border-white/10 flex flex-col shadow-2xl"
      >
        <div
          class="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-black/20"
        >
          <div class="flex items-center space-x-3">
            <Terminal class="w-4 h-4 text-primary" />
            <h3 class="text-xs font-bold uppercase tracking-widest text-gray-400">
              Game Output Console
            </h3>
          </div>
          <div class="flex items-center space-x-3">
            <button
              class="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all"
              title="Clear Logs"
              @click="clearLogs"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            <button
              class="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-all"
              @click="isConsoleOpen = false"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div
          ref="consoleEl"
          class="flex-1 overflow-y-auto p-6 font-mono text-[0.7rem] custom-scrollbar selection:bg-green-500/30"
        >
          <div
            v-if="logs.length === 0"
            class="h-full flex flex-col items-center justify-center text-gray-600 space-y-2 italic"
          >
            <Coffee class="w-8 h-8 opacity-20" />
            <p>Waiting for launch logs...</p>
          </div>

          <div
            v-for="(l, index) in logs"
            :key="index"
            class="py-0.5 border-b border-white/5 last:border-0"
          >
            <span class="text-gray-500 mr-2">[{{ index + 1 }}]</span>
            <span
              :class="{
                'text-red-400':
                  l.toLowerCase().includes('error') || l.toLowerCase().includes('critical'),
                'text-yellow-400': l.toLowerCase().includes('warn'),
                'text-primary':
                  l.toLowerCase().includes('info') &&
                  (l.toLowerCase().includes('success') || l.toLowerCase().includes('ready')),
                'text-gray-300':
                  !l.toLowerCase().includes('error') && !l.toLowerCase().includes('warn')
              }"
              >{{ l }}</span
            >
          </div>
        </div>
      </div>
    </Transition>

    <!-- Mod Browser Modal -->
    <div
      v-if="isModBrowserOpen"
      class="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 animate-in fade-in zoom-in duration-300"
    >
      <div
        class="absolute inset-0 bg-black/80 backdrop-blur-xl"
        @click="isModBrowserOpen = false"
      ></div>

      <div
        class="relative w-full max-w-4xl bg-gray-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div class="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div class="flex items-center space-x-4">
            <div class="p-3 rounded-2xl bg-primary text-black">
              <Download class="w-6 h-6" />
            </div>
            <div>
              <h2 class="text-2xl font-black text-white">Modrinth Browser</h2>
              <p class="text-sm text-gray-400 font-medium">Search and install mods directly</p>
            </div>
          </div>
          <button
            class="p-3 hover:bg-white/10 rounded-2xl transition-colors text-gray-400 hover:text-white"
            @click="isModBrowserOpen = false"
          >
            <X class="w-6 h-6" />
          </button>
        </div>

        <div class="p-8 space-y-6 flex-1 overflow-y-auto">
          <div class="flex flex-col space-y-4">
            <div class="flex space-x-4">
              <input
                v-model="modQuery"
                type="text"
                class="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-lg font-bold"
                placeholder="Search mods, packs, shaders..."
                @input="autoSearch"
                @keyup.enter="searchMods"
              />
              <button
                class="px-8 py-4 bg-primary hover:bg-primary/80 text-black font-black rounded-2xl transition-all shadow-lg active:scale-95 flex items-center space-x-2"
                @click="searchMods"
              >
                <Terminal v-if="isSearchingMods" class="w-5 h-5 animate-spin" />
                <span>Search</span>
              </button>
            </div>
            
            <div class="flex flex-wrap gap-4 items-center">
              <div class="flex items-center space-x-2">
                <span class="text-[0.6rem] font-bold text-gray-500 uppercase tracking-widest">Sort By:</span>
                <select v-model="modSort" class="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary/30" @change="searchMods">
                  <option value="relevance">Relevance</option>
                  <option value="downloads">Downloads</option>
                  <option value="follows">Follows</option>
                  <option value="newest">Newest</option>
                  <option value="updated">Updated</option>
                </select>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-[0.6rem] font-bold text-gray-500 uppercase tracking-widest">Category:</span>
                <select v-model="modCategory" class="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary/30" @change="searchMods">
                  <option value="">All Categories</option>
                  <option v-if="downloadSource === 'modrinth'" value="adventure">Adventure</option>
                  <option v-if="downloadSource === 'modrinth'" value="magic">Magic</option>
                  <option v-if="downloadSource === 'modrinth'" value="exploration">Exploration</option>
                  <option v-if="downloadSource === 'modrinth'" value="tech">Tech</option>
                  <option v-if="downloadSource === 'curseforge'" value="4471">Modpacks</option>
                  <option v-if="downloadSource === 'curseforge'" value="6">Mods</option>
                </select>
              </div>
            </div>
          </div>

          <div
            v-if="modResults.length === 0"
            class="h-64 flex flex-col items-center justify-center text-gray-500 space-y-4"
          >
            <Gamepad2 class="w-16 h-16 opacity-20" />
            <p class="font-bold">Enter a query to browse the mod universe</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="mod in modResults"
              :key="mod.id"
              class="p-4 rounded-3xl bg-white/5 border border-white/5 hover:border-green-500/30 transition-all group flex flex-col"
            >
              <div class="flex space-x-4">
                <img :src="mod.icon_url" class="w-16 h-16 rounded-2xl shadow-lg bg-gray-800" />
                <div class="flex-1 min-w-0">
                  <h3 class="font-bold text-white truncate text-lg">{{ mod.title }}</h3>
                  <p
                    class="text-[0.6rem] font-black uppercase text-gray-500 flex items-center mt-1"
                  >
                    <Check class="w-3 h-3 mr-1" />
                    {{ mod.author }}
                  </p>
                </div>
                <button
                  class="p-3 bg-primary text-black rounded-2xl transition-all shadow-lg active:scale-95 flex items-center self-start"
                  @click="openModVersionSelection(mod)"
                >
                  <Plus class="w-5 h-5" />
                </button>
              </div>

              <p class="text-xs text-gray-400 line-clamp-2 mt-3">{{ mod.description }}</p>

              <!-- Gallery Preview: Uses proxied base64 data -->
              <div
                v-if="mod.gallery?.length"
                class="mt-4 flex space-x-2 overflow-x-auto custom-scrollbar pb-2"
              >
                <img
                  v-for="img in mod.gallery"
                  :key="img"
                  :src="img"
                  class="h-20 rounded-xl bg-gray-800 object-cover min-w-[120px]"
                />
              </div>

              <div class="mt-auto pt-4 flex items-center space-x-2">
                <span
                  v-for="cat in mod.categories.slice(0, 3)"
                  :key="cat"
                  class="px-2 py-0.5 rounded-full bg-white/5 text-[0.5rem] font-bold text-gray-400 uppercase"
                >
                  {{ cat }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Elite Mod Version & Instance Selection Modal -->
    <div
      v-if="modVersionModalOpen"
      class="fixed inset-0 z-[110] flex items-center justify-center p-6"
    >
      <div
        class="absolute inset-0 bg-black/60 backdrop-blur-md"
        @click="modVersionModalOpen = false"
      ></div>
      <div
        class="relative w-full max-w-2xl bg-gray-900 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div class="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
          <div>
            <h2 class="text-xl font-black text-white px-2">
              {{ downloadProjectType === 'modpack' ? 'Modpack Deployment Portal' : 'Universal Installation Portal' }}
            </h2>
            <p class="text-[0.6rem] text-gray-500 font-bold uppercase tracking-widest mt-1 px-2">
              {{ downloadProjectType === 'modpack' ? 'Initialize New Automated Instance' : 'Select Version & Destination Instance' }}
            </p>
          </div>
          <button
            class="p-2 hover:bg-white/10 rounded-xl transition-colors"
            @click="modVersionModalOpen = false"
          >
            <X class="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div class="flex flex-1 min-h-0 overflow-hidden">
          <!-- Left: Version List -->
          <div :class="[downloadProjectType === 'modpack' ? 'w-full' : 'w-1/2', 'p-6 border-r border-white/5 overflow-y-auto custom-scrollbar space-y-3']">
            <p class="text-[0.6rem] font-black text-gray-500 uppercase tracking-widest mb-2">
              1. Select {{ downloadProjectType === 'modpack' ? 'Modpack' : 'Mod' }} Version
            </p>
            <div v-if="isLoadingModVersions" class="flex items-center justify-center py-12">
              <Terminal class="w-8 h-8 animate-spin text-primary" />
            </div>
            <div v-else-if="modVersions.length === 0" class="text-center py-12 text-gray-500">
              No compatible versions found.
            </div>
            <template v-else>
              <div
                v-for="v in modVersions.slice(0, 30)"
                :key="v.id"
                :class="[
                  'p-4 rounded-2xl transition-all cursor-pointer border flex flex-col space-y-2',
                  selectedModVersion?.id === v.id
                    ? 'bg-primary/10 border-primary/50 shadow-lg shadow-primary/5'
                    : 'bg-white/5 border-white/5 hover:border-white/20'
                ]"
                @click="selectedModVersion = v"
              >
                <div class="flex items-start justify-between">
                  <span class="font-bold text-white text-xs leading-tight">{{ v.name }}</span>
                  <div
                    v-if="selectedModVersion?.id === v.id"
                    class="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0 ml-2"
                  ></div>
                </div>
                
                <div class="flex flex-wrap gap-1.5">
                  <div class="flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-white/5 text-[0.6rem] font-black uppercase text-gray-500 border border-white/5">
                    <Database class="w-2.5 h-2.5" />
                    <span>{{ v.loaders.join(', ') }}</span>
                  </div>
                  <div class="flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[0.6rem] font-bold border border-primary/10">
                    <span>MC {{ v.game_versions[0] }}{{ v.game_versions.length > 1 ? '+' : '' }}</span>
                  </div>
                  <div v-if="v.date_published" class="text-[0.6rem] text-gray-600 font-medium self-center ml-auto">
                    {{ new Date(v.date_published).toLocaleDateString() }}
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Right: Instance Selection & Validation -->
          <div v-if="downloadProjectType !== 'modpack'" class="w-1/2 p-6 flex flex-col h-full min-h-0">
            <p
              class="text-[0.6rem] font-black text-gray-500 uppercase tracking-widest mb-4 shrink-0"
            >
              2. Select Destination
            </p>

            <!-- Scrollable Instance List -->
            <div class="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-6 pr-1">
              <div
                v-for="inst in instances"
                :key="inst.id"
                :class="[
                  'p-4 rounded-2xl transition-all cursor-pointer border flex justify-between items-center',
                  selectedInstance === inst.id
                    ? 'bg-primary/10 border-primary/50 shadow-lg shadow-primary/5'
                    : 'bg-white/5 border-white/5 hover:border-white/20'
                ]"
                @click="onInstanceSelect(inst.id)"
              >
                <div>
                  <p class="text-sm font-bold text-white">{{ inst.name }}</p>
                  <p class="text-[0.6rem] text-gray-500 font-black uppercase tracking-tighter">
                    {{ inst.modloader }} • {{ inst.version }}
                  </p>
                </div>
                <div v-if="selectedInstance === inst.id" class="p-1 bg-primary rounded-full">
                  <Check class="w-3 h-3 text-black font-black" />
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Common Footer: Compatibility & Install -->
        <div
          v-if="selectedModVersion && (selectedInstance || downloadProjectType === 'modpack')"
          class="shrink-0 p-6 border-t border-white/5 bg-gray-900/50 space-y-4"
        >
          <!-- Advanced Compatibility Engine -->
          <div
            v-if="downloadProjectType !== 'modpack'"
            :class="[
              'p-3 rounded-2xl border flex items-start space-x-3 transition-all',
              isCompatible ? 'bg-primary/5 border-primary/20' : 'bg-red-500/5 border-red-500/20'
            ]"
          >
            <ShieldAlert v-if="!isCompatible" class="w-6 h-6 text-red-500 shrink-0" />
            <ShieldCheck v-else class="w-6 h-6 text-primary shrink-0" />
            <div>
              <p
                :class="[
                  'text-[0.6rem] font-black uppercase tracking-widest',
                  isCompatible ? 'text-primary' : 'text-red-500'
                ]"
              >
                {{
                  isCompatible
                    ? downloadProjectType === 'shader'
                      ? 'Shader Ready'
                      : downloadProjectType === 'resourcepack'
                        ? 'Version Match'
                        : 'Compatible'
                    : 'Warning'
                }}
              </p>
              <p class="text-[0.55rem] text-gray-400 leading-tight mt-0.5">
                {{ compatMessage }}
              </p>
            </div>
          </div>

          <div v-else class="p-4 bg-primary/10 border border-primary/30 rounded-2xl flex items-center space-x-3">
            <PackageOpen class="w-6 h-6 text-primary shrink-0" />
            <div>
              <p class="text-[0.6rem] font-black uppercase tracking-widest text-primary">Automated Instance</p>
              <p class="text-[0.55rem] text-gray-400 leading-tight mt-0.5">A fresh instance will be created automatically.</p>
            </div>
          </div>

          <button
            :class="[
              'w-full py-3.5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 border-2 text-sm',
              (downloadProjectType === 'modpack' || isCompatible)
                ? 'bg-primary text-white border-primary/20 shadow-primary/30'
                : 'bg-red-500 text-white border-red-500/20 shadow-red-500/30'
            ]"
            @click="downloadMod(selectedModVersion)"
          >
            {{ downloadProjectType === 'modpack' ? 'Install & Create Instance' : (isCompatible ? 'Install Now' : 'Install (Override)') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Mod Manager Modal -->
    <Transition name="zoom">
      <div v-if="isModModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          class="absolute inset-0 bg-black/80 backdrop-blur-md"
          @click="isModModalOpen = false"
        ></div>

        <div
          class="relative bg-gray-900 border border-white/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        >
          <button
            class="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-white/5 rounded-full p-1.5"
            @click="isModModalOpen = false"
          >
            <X class="w-4 h-4" />
          </button>

          <h2 class="text-2xl font-bold mb-2 text-white flex items-center">
            <img :src="logoPremium" class="w-6 h-6 mr-3 object-contain" /> Instance Mods
          </h2>
          <p class="text-xs text-gray-500 mb-6 uppercase tracking-widest font-bold">
            Managing: {{ inspectingInstance?.name }}
          </p>

          <div class="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2 mb-6">
            <!-- Content for Mod Manager Modal (e.g., list of installed mods) -->
          </div>

          <div class="pt-4 border-t border-white/5 flex justify-between">
            <button
              v-if="inspectingInstance"
              class="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold rounded-2xl transition-all flex items-center justify-center space-x-2 border border-white/5 border-dashed"
              @click="openFolder(inspectingInstance, 'mods')"
            >
              <Folder class="w-4 h-4" />
              <span>Open Mods Folder</span>
            </button>
            <button
              class="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
              @click="isModModalOpen = false"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- New Instance Modal -->
    <Transition name="zoom">
      <div
        v-if="isNewInstanceModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-md"
          @click="isNewInstanceModalOpen = false"
        ></div>

        <div
          class="relative bg-gray-900 border border-gray-700/60 rounded-3xl p-8 max-w-sm w-full shadow-2xl"
        >
          <button
            class="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-gray-800/50 rounded-full p-1.5 hover:bg-gray-700"
            @click="isNewInstanceModalOpen = false"
          >
            <X class="w-4 h-4" />
          </button>

          <h2 class="text-2xl font-bold mb-6 text-white flex items-center">
            <Plus class="w-6 h-6 mr-2 text-primary" /> Create Instance
          </h2>

          <div v-if="!newInstanceImportMode" class="grid grid-cols-2 gap-4">
            <button
              class="flex flex-col items-center justify-center p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl transition-all group"
              @click="newInstanceImportMode = 'manual'"
            >
              <div class="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary mb-3 group-hover:scale-110 transition-transform">
                <Plus class="w-6 h-6" />
              </div>
              <span class="font-bold">Manual Creation</span>
              <span class="text-[10px] text-gray-500 mt-1">Select version & loader</span>
            </button>
            <button
              class="flex flex-col items-center justify-center p-6 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-3xl transition-all group"
              @click="importModpack(); isNewInstanceModalOpen = false;"
            >
              <div class="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary mb-3 group-hover:scale-110 transition-transform">
                <PackageOpen class="w-6 h-6" />
              </div>
              <span class="font-bold">Import Modpack</span>
              <span class="text-[10px] text-gray-500 mt-1">.zip / .mrpack file</span>
            </button>
          </div>

          <div v-if="newInstanceImportMode === 'manual'" class="space-y-5">
            <div>
              <label class="block text-sm font-semibold text-gray-400 mb-2">Instance Name</label>
              <input
                v-model="newInstanceName"
                type="text"
                placeholder="My Awesome Modpack"
                class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-400 mb-2">Game Version</label>
              <select
                v-model="newInstanceVersion"
                class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                :disabled="isLoadingVersions"
              >
                <option v-if="isLoadingVersions" value="">Loading...</option>
                <template v-else>
                  <option v-for="v in versionsData" :key="v.id" :value="v.id">
                    {{ v.id }}
                  </option>
                </template>
              </select>
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-400 mb-2">Modloader</label>
              <select
                v-model="newInstanceModloader"
                class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
              >
                <option value="vanilla">Vanilla</option>
                <option value="fabric">Fabric</option>
                <option value="quilt">Quilt</option>
                <option value="forge">Forge</option>
                <option value="neoforge">NeoForge</option>
                <option value="liteloader">LiteLoader</option>
              </select>
            </div>

            <div class="pt-4 flex justify-between items-center">
              <button
                class="px-5 py-2.5 text-gray-400 hover:text-white font-semibold transition-colors"
                @click="newInstanceImportMode = null"
              >
                Back
              </button>
              <button
                :disabled="!newInstanceName || !newInstanceVersion"
                :class="[
                  'px-8 py-2.5 font-bold rounded-xl transition-all shadow-lg',
                  newInstanceName && newInstanceVersion
                    ? 'bg-green-500 hover:bg-green-400 text-white shadow-green-500/30'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                ]"
                @click="createInstance"
              >
                {{ newInstanceName && newInstanceVersion ? '✓ Create Now' : 'Create' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <button
      class="fixed bottom-6 right-6 z-40 p-4 bg-primary text-white rounded-full shadow-lg shadow-primary/30 hover:scale-110 transition-transform flex items-center justify-center"
      @click="toggleCopilot"
    >
      <MessageSquare class="w-6 h-6" />
    </button>

    <!-- AI Copilot Download Modal -->
    <Transition name="zoom">
      <div v-if="showAiDownloadModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-md" @click="showAiDownloadModal = false"></div>
        <div class="relative bg-gray-900 border border-primary/40 rounded-3xl p-8 max-w-sm w-full shadow-[0_0_40px_-5px_var(--primary-accent)]">
          <button class="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-gray-800/50 rounded-full p-1.5 hover:bg-gray-700" @click="showAiDownloadModal = false">
            <X class="w-4 h-4" />
          </button>
          <div class="flex items-center space-x-3 mb-6">
            <div class="p-3 bg-primary/20 rounded-2xl text-primary">
              <MessageSquare class="w-8 h-8" />
            </div>
            <h2 class="text-2xl font-bold text-white">AI Engine Setup</h2>
          </div>
          <div v-if="!aiDownloadProgress">
            <p class="text-gray-300 text-sm mb-6 leading-relaxed">
              Experience the next generation of <strong>SL Launcher</strong>. By downloading the local AI Engine (~1.5GB), you unlock offline smart config, instantaneous crash analysis, and a built-in gaming Copilot.
            </p>
            <button class="w-full py-3.5 bg-primary text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-primary/50 text-center" @click="downloadAiEngine">
              Download Offline Model
            </button>
          </div>
          <div v-else class="space-y-4">
            <p class="text-sm font-bold text-white">{{ aiDownloadProgress.name }}</p>
            <div class="h-3 w-full bg-gray-800 rounded-full overflow-hidden">
              <div class="h-full bg-primary transition-all duration-300" :style="{ width: aiDownloadProgress.percent + '%' }"></div>
            </div>
            <p class="text-xs text-gray-400 text-right">
              {{ aiDownloadProgress.percent }}% ({{ Math.round(aiDownloadProgress.loaded / 1024 / 1024) }}MB / {{ Math.round(aiDownloadProgress.total / 1024 / 1024) }}MB)
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- AI Copilot Chat Interface -->
    <Transition name="slide-up">
      <div v-show="isCopilotOpen && aiStatus.isRunning" class="fixed bottom-24 right-6 w-96 h-[500px] z-40 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div class="p-4 border-b border-white/5 bg-gray-800/50 flex justify-between items-center shrink-0">
          <div class="flex items-center space-x-3">
            <img :src="logoPremium" class="w-5 h-5 object-contain" />
            <h3 class="font-bold text-white text-sm">SL Copilot</h3>
          </div>
          <div class="flex items-center space-x-1">
            <button class="p-1.5 text-gray-400 hover:text-primary transition-colors hover:bg-white/5 rounded-lg" title="History" @click="isAiHistoryOpen = !isAiHistoryOpen; isAiSettingsOpen = false">
              <History class="w-4 h-4" />
            </button>
            <button class="p-1.5 text-gray-400 hover:text-primary transition-colors hover:bg-white/5 rounded-lg" title="Settings" @click="isAiSettingsOpen = !isAiSettingsOpen; isAiHistoryOpen = false">
              <Sliders class="w-4 h-4" />
            </button>
            <button class="p-1.5 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg ml-1" @click="isCopilotOpen = false">
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div class="relative flex-1 flex flex-col min-h-0 overflow-hidden">
          <Transition name="fade">
            <div v-if="isAiHistoryOpen" class="absolute inset-0 z-10 bg-gray-900 flex flex-col">
              <div class="p-4 border-b border-white/5 flex justify-between items-center bg-gray-800/30">
                <span class="text-xs font-black uppercase tracking-widest text-gray-400">Chat History</span>
                <button class="flex items-center space-x-1 px-2.5 py-1 bg-primary/20 text-primary text-[0.65rem] font-bold rounded-lg hover:bg-primary/30 active:scale-95 transition-all" @click="createNewAiSession">
                  <PlusCircle class="w-3 h-3" />
                  <span>New Chat</span>
                </button>
              </div>
              <div class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                <div v-for="session in aiSessions" :key="session.id" :class="['group p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all border', currentSessionId === session.id ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-transparent hover:border-white/10']" @click="switchAiSession(session.id)">
                  <div class="flex items-center space-x-3 overflow-hidden">
                    <Clock class="w-4 h-4 text-gray-500 shrink-0" />
                    <span class="text-sm text-gray-200 truncate font-semibold">{{ session.title }}</span>
                  </div>
                  <button class="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0" @click.stop="deleteAiSession(session.id)">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </Transition>
          <Transition name="fade">
            <div v-if="isAiSettingsOpen" class="absolute inset-0 z-10 bg-gray-900 flex flex-col p-6 space-y-6 overflow-y-auto custom-scrollbar">
              <h4 class="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Model Settings</h4>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <label class="text-xs font-bold text-gray-300">Temperature (Creativity)</label>
                  <span class="text-xs font-black text-primary">{{ aiSettings.temperature }}</span>
                </div>
                <input v-model.number="aiSettings.temperature" type="range" min="0.1" max="1.5" step="0.1" class="w-full accent-primary bg-gray-800 h-1.5 rounded-full appearance-none cursor-pointer" @change="saveAiData" />
              </div>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <label class="text-xs font-bold text-gray-300">Max Tokens</label>
                  <span class="text-xs font-black text-primary">{{ aiSettings.maxTokens }}</span>
                </div>
                <input v-model.number="aiSettings.maxTokens" type="number" class="w-full bg-gray-800 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:border-primary/50 focus:outline-none" @change="saveAiData" />
              </div>
              <div class="space-y-3">
                <label class="text-xs font-bold text-gray-300">System Persona</label>
                <textarea v-model="aiSettings.systemPrompt" rows="4" class="w-full bg-gray-800 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none resize-none custom-scrollbar" @change="saveAiData"></textarea>
              </div>
              <button class="w-full py-3 bg-white/5 hover:bg-primary text-gray-400 hover:text-white font-bold rounded-2xl transition-all border border-white/5 hover:border-transparent text-xs" @click="isAiSettingsOpen = false">
                Save & Close
              </button>
            </div>
          </Transition>
          <div id="ai-chat-container" class="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4">
            <div v-for="(msg, idx) in aiMessages" :key="idx" :class="['max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed', msg.role === 'user' ? 'ml-auto bg-primary text-white rounded-br-none' : 'mr-auto bg-gray-800 text-gray-200 rounded-bl-none']">
              {{ msg.content }}
              <span v-if="msg.content === '' && isAiTyping && msg.role === 'assistant'" class="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-1 align-middle"></span>
            </div>
          </div>
          <div class="p-3 bg-gray-800/80 border-t border-white/5">
            <div class="relative">
              <input v-model="aiInput" type="text" placeholder="Ask Copilot anything..." :disabled="isAiTyping" class="w-full bg-gray-900 border border-gray-700 rounded-2xl py-3 pl-4 pr-12 text-white focus:outline-none focus:border-primary/50 text-sm disabled:opacity-50" @keyup.enter="sendAiMessage" />
              <button :disabled="!aiInput.trim() || isAiTyping" class="absolute right-2 top-1.5 p-1.5 text-primary hover:text-white disabled:text-gray-600 transition-colors bg-white/5 hover:bg-primary rounded-xl" @click="sendAiMessage">
                <Send class="w-5 h-5 shadow-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- AI Crash Analyzer Modal -->
    <Transition name="zoom">
      <div v-if="showCrashModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-xl" @click="showCrashModal = false"></div>
        <div class="relative bg-gray-900 border border-red-500/40 rounded-3xl p-8 max-w-lg w-full shadow-[0_0_50px_-5px_rgba(239,68,68,0.3)]">
          <div class="flex items-center space-x-3 mb-6">
            <div class="p-3 bg-red-500/20 rounded-2xl text-red-400">
              <ShieldAlert class="w-8 h-8" />
            </div>
            <div>
              <h2 class="text-2xl font-bold text-white leading-tight">Crash Detected</h2>
              <p class="text-sm text-gray-400">Instance: {{ crashingInstanceId }}</p>
            </div>
          </div>
          <div class="space-y-4">
            <p class="text-gray-300 text-sm leading-relaxed">
              Minecraft closed unexpectedly. The local AI can analyze the logs to find the root cause and suggest a fix.
            </p>
            <div v-if="crashAnalysisResult" class="p-4 bg-gray-800/80 rounded-2xl border border-white/5 max-h-60 overflow-y-auto custom-scrollbar">
              <div class="flex items-start space-x-3">
                <div v-if="isAnalyzingCrash" class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mt-1"></div>
                <div v-else class="p-1 bg-primary/20 rounded-lg text-primary mt-1">
                  <Sparkles class="w-4 h-4" />
                </div>
                <div class="flex-1">
                  <p class="text-sm font-bold text-primary mb-1">{{ isAnalyzingCrash ? 'Analyzing...' : 'AI Explanation' }}</p>
                  <p class="text-sm text-gray-200 whitespace-pre-wrap">{{ crashAnalysisResult }}</p>
                </div>
              </div>
            </div>
            <div class="flex flex-wrap gap-3">
              <button class="flex-1 min-w-[120px] py-3 bg-white/5 text-gray-300 font-bold rounded-2xl flex items-center justify-center space-x-2 border border-white/5 hover:bg-white/10 transition-all text-xs" @click="copyLaunchCommand">
                <Terminal class="w-4 h-4 shrink-0" />
                <span class="truncate">Copy Command</span>
              </button>
              <button class="flex-1 min-w-[120px] py-3 bg-white/5 text-gray-300 font-bold rounded-2xl flex items-center justify-center space-x-2 border border-white/5 hover:bg-white/10 transition-all text-xs" @click="isConsoleOpen = true; showCrashModal = false">
                <Terminal class="w-4 h-4 shrink-0" />
                <span class="truncate">Show Full Logs</span>
              </button>
              <button v-if="!crashAnalysisResult && !isAnalyzingCrash" class="flex-1 min-w-[120px] py-3 bg-primary text-white font-bold rounded-2xl flex items-center justify-center space-x-2 shadow-lg shadow-primary/30 text-xs" @click="analyzeCrash">
                <Sparkles class="w-4 h-4 shrink-0" />
                <span class="truncate">Analyze with AI</span>
              </button>
              <button class="flex-1 min-w-[120px] py-3 bg-gray-800 text-white font-bold rounded-2xl transition-all hover:bg-gray-700 text-xs" @click="showCrashModal = false">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
:root {
  /* Dynamic accents handled via backgroundStyle and other computed properties */
}

.text-primary {
  color: v-bind('primaryColor');
}
.bg-primary {
  background-color: v-bind('primaryColor');
}
.border-primary {
  border-color: v-bind('primaryColor');
}
.shadow-primary {
  box-shadow: 0 0 20px -5px v-bind('primaryColor');
}

.block-texture {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

/* Apply Theme Accents */
.theme-accent-text {
  color: v-bind('primaryColor');
}
.theme-accent-bg {
  background-color: v-bind('primaryColor');
}
.theme-accent-border {
  border-color: v-bind('primaryColor');
}
.theme-accent-glow {
  box-shadow: 0 0 20px -5px v-bind('primaryColor');
}

/* Existing Transitions & UI */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.zoom-enter-active,
.zoom-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.zoom-enter-from,
.zoom-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1),
    opacity 0.4s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar,
select::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track,
select::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb,
select::-webkit-scrollbar-thumb {
  background: #374151;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover,
select::-webkit-scrollbar-thumb:hover {
  background: #4b5563;
}
</style>
