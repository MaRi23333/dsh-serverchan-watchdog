import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const candidates = [
  join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  join(dirname(dirname(process.execPath)), 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
]
const npmCli = candidates.find(existsSync)
const spawned = npmCli === undefined
  ? spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' })
  : spawnSync(process.execPath,
    [npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: root, encoding: 'utf8' })

if (spawned.status !== 0) {
  process.stderr.write(spawned.stderr ?? '')
  process.exit(spawned.status ?? 1)
}

const [result] = JSON.parse(spawned.stdout)
const files = result.files.map(file => file.path).sort()
const expected = [
  'LICENSE',
  'README.en.md',
  'README.md',
  'assets/readme/hero.svg',
  'assets/readme/settings.png',
  'cordis.patch.yml',
  'lib/client.js',
  'lib/index.js',
  'package.json',
].sort()

if (JSON.stringify(files) !== JSON.stringify(expected)) {
  console.error('pack contents mismatch')
  console.error('got:     ', files.join(', '))
  console.error('expected:', expected.join(', '))
  process.exit(1)
}

console.log(`pack whitelist OK (${files.length} files, ${result.size} bytes)`)
