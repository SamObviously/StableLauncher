const { Client } = require('minecraft-launcher-core')
const launcher = new Client()

const forgeWrapperArgs = [
  '-Dforgewrapper.librariesDir=C:\\Users\\erdon\\AppData\\Roaming\\.minecraft\\libraries',
  '-Dforgewrapper.installerJar=C:\\Users\\erdon\\AppData\\Roaming\\.minecraft\\libraries\\net\\minecraftforge\\forge\\1.21.11-61.1.0\\forge-1.21.11-61.1.0-installer.jar',
  '-Dforgewrapper.minecraft=C:\\Users\\erdon\\AppData\\Roaming\\.minecraft\\versions\\1.21.11\\1.21.11.jar'
]

let jvmArgs = '-XX:+UseG1GC'
const existingArgs = jvmArgs.split(' ').filter((a) => a.trim() !== '')
jvmArgs = [...forgeWrapperArgs, ...existingArgs].join(' ')

console.log('FINAL JVM ARGS STRING:', jvmArgs)
const parsedCustomArgs = jvmArgs.split(' ').filter((a) => a.trim() !== '')
console.log('PARSED CUSTOM ARGS ARRAY:', parsedCustomArgs)

const opts = {
  clientPackage: null,
  authorization: {
    access_token: '0',
    client_token: '0',
    uuid: '0',
    name: 'Player',
    user_properties: '{}',
    meta: { type: 'mojang' }
  },
  root: 'C:\\Users\\erdon\\AppData\\Roaming\\.minecraft',
  version: {
    number: '1.21.11',
    type: 'release',
    custom: 'net.minecraftforge-61.1.0'
  },
  memory: { max: '2G', min: '1G' },
  javaPath: 'java',
  customArgs: parsedCustomArgs,
  overrides: {
    gameDirectory: 'C:\\Users\\erdon\\AppData\\Roaming\\.minecraft\\instances\\default'
  }
}

launcher.on('debug', (e) => console.log(e))
launcher
  .launch(opts)
  .then(() => console.log('started'))
  .catch((e) => console.error(e))
