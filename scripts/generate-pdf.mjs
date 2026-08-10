import puppeteer from 'puppeteer'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const htmlPath = path.join(root, 'docs', 'project-guide.html')
const pdfPath = path.join(root, 'docs', 'Timeline-Dashboard-Project-Guide.pdf')

const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' })
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
})
await browser.close()
console.log('PDF saved to:', pdfPath)
