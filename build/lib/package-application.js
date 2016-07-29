'use strict'

const assert = require('assert')
const fs = require('fs-extra')
const path = require('path')
const electronPackager = require('electron-packager')
const includePathInPackagedApp = require('./include-path-in-packaged-app')
const getLicenseText = require('./get-license-text')

const CONFIG = require('../config')

module.exports = async function () {
  console.log(`Running electron-packager on ${CONFIG.intermediateAppPath}`)
  const packagedAppPath = await runPackager({
    'app-version': CONFIG.getAppVersion(),
    'arch': process.arch,
    'asar': {unpack: buildAsarUnpackGlobExpression()},
    'build-version': CONFIG.getAppVersion(),
    'download': {cache: CONFIG.cachePath},
    'dir': CONFIG.intermediateAppPath,
    'icon': path.join(CONFIG.repositoryRootPath, 'resources', 'app-icons', CONFIG.getChannel(), 'atom.icns'),
    'out': CONFIG.buildOutputPath,
    'overwrite': true,
    'platform': process.platform,
    'version': CONFIG.appMetadata.electronVersion
  })
  let bundledResourcesPath
  if (process.platform === 'darwin') {
    bundledResourcesPath = path.join(packagedAppPath, 'Atom.app', 'Contents', 'Resources')
  } else {
    throw new Error('TODO: handle this case!')
  }

  await copyNonASARResources(bundledResourcesPath)
  console.log(`Application bundle created on ${packagedAppPath}`)
}

async function copyNonASARResources (bundledResourcesPath) {
  const bundledShellCommandsPath = path.join(bundledResourcesPath, 'app')
  console.log(`Copying shell commands to ${bundledShellCommandsPath}...`)
  fs.copySync(
    path.join(CONFIG.repositoryRootPath, 'apm', 'node_modules', 'atom-package-manager'),
    path.join(bundledShellCommandsPath, 'apm'),
    {filter: includePathInPackagedApp}
  )
  if (process.platform !== 'win32') {
    // Existing symlinks on user systems point to an outdated path, so just symlink it to the real location of the apm binary.
    // TODO: Change command installer to point to appropriate path and remove this fallback after a few releases.
    fs.symlinkSync(path.join('..', '..', 'bin', 'apm'), path.join(bundledShellCommandsPath, 'apm', 'node_modules', '.bin', 'apm'))
    fs.copySync(path.join(CONFIG.repositoryRootPath, 'atom.sh'), path.join(bundledShellCommandsPath, 'atom.sh'))
  }
  if (process.platform === 'darwin') {
    fs.copySync(path.join(CONFIG.repositoryRootPath, 'resources', 'mac', 'file.icns'), path.join(bundledResourcesPath, 'file.icns'))
  }

  console.log(`Writing LICENSE.md to ${bundledResourcesPath}...`)
  fs.writeFileSync(path.join(bundledResourcesPath, 'LICENSE.md'), await getLicenseText())
}

function buildAsarUnpackGlobExpression () {
  const unpack = [
    '*.node',
    'ctags-config',
    'ctags-darwin',
    'ctags-linux',
    'ctags-win32.exe',
    path.join('**', 'node_modules', 'spellchecker', '**'),
    path.join('**', 'resources', 'atom.png')
  ]

  return `{${unpack.join(',')}}`
}

function runPackager (options) {
  return new Promise((resolve, reject) => {
    electronPackager(options, (err, packagedAppPaths) => {
      if (err) {
        reject(err)
        throw new Error(err)
      } else {
        assert(packagedAppPaths.length === 1, 'Generated more than one electron application!')
        resolve(packagedAppPaths[0])
      }
    })
  })
}