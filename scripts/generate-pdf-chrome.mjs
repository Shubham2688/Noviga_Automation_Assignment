import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const html = path.join(root, 'docs', 'project-guide.html')
const pdf = path.join(root, 'docs', 'Timeline-Dashboard-Project-Guide.pdf')

const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
]

const browser = chromePaths.find((p) => {
  try {
    execSync(`if exist "${p}" (exit 0) else (exit 1)`, { shell: 'cmd.exe' })
    return true
  } catch {
    return false
  }
})

if (!browser) {
  console.error('Chrome or Edge not found. Open docs/project-guide.html in browser → Print → Save as PDF')
  process.exit(1)
}

execSync(
  `"${browser}" --headless=new --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${pdf}" "${html}"`,
  { stdio: 'inherit' },
)

console.log('\nPDF saved:', pdf)
