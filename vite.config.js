import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { handleGenerate } from './server/generate.js'
import { handlePreviewApi } from './server/preview.js'
import { handleRpc } from './server/rpc.js'
import { burnsWithSites } from './server/history.js'
import { listRecords, saveRecord } from './server/data.js'
import { cleanSlug, listSites, publishPage, readJson, readSiteHtml } from './server/sites.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'preview-api',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const path = req.url?.split('?')[0]
            if (path === '/api/data') {
              handleData(req, res).catch((error) => {
                if (res.headersSent || res.writableEnded) return
                res.statusCode = error?.status || 502
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'The record was not saved.' }))
              })
              return
            }
            if (path === '/api/history') {
              handleHistory(req, res).catch((error) => {
                if (res.headersSent || res.writableEnded) return
                res.statusCode = 502
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'The history did not load.' }))
              })
              return
            }
            if (path === '/api/publish') {
              handlePublish(req, res).catch((error) => {
                if (res.headersSent || res.writableEnded) return
                res.statusCode = error?.status || 502
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'The page did not go live.' }))
              })
              return
            }
            if (path === '/api/site') {
              handleSite(req, res).catch((error) => {
                if (res.headersSent || res.writableEnded) return
                res.statusCode = 502
                res.setHeader('Content-Type', 'text/html; charset=utf-8')
                res.end(error instanceof Error ? error.message : 'The page did not open.')
              })
              return
            }
            if (path === '/api/rpc') {
              handleRpc(req, res).catch((error) => {
                if (res.headersSent || res.writableEnded) return
                res.statusCode = 502
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'The network did not answer.' }))
              })
              return
            }
            if (path === '/api/generate') {
              if (req.method !== 'POST') {
                res.statusCode = 405
                res.end('POST a prompt.')
                return
              }
              handleGenerate(req, res, env.XAI_API_KEY).catch((error) => {
                const message = error instanceof Error && error.message
                  ? error.message
                  : 'The page did not get written.'
                console.error('generate:', message)
                if (res.headersSent || res.writableEnded) return
                res.statusCode = error?.status || 502
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: message }))
              })
              return
            }
            if (path !== '/api/can-frame' && path !== '/api/capture' && path !== '/api/warm' && path !== '/api/frame') {
              next()
              return
            }
            handlePreviewApi(req, res).catch((error) => {
              if (res.headersSent) return
              res.statusCode = 502
              res.end(error instanceof Error ? error.message : 'The page did not open.')
            })
          })
        },
      },
    ],
  }
})

async function handleData(req, res) {
  const url = new URL(req.url, 'http://localhost')
  if (req.method === 'GET') {
    const records = await listRecords(url.searchParams.get('slug'), url.searchParams.get('collection'))
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ records }))
    return
  }
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Send or read a record.' }))
    return
  }
  const body = await readJson(req, 20_000)
  const record = await saveRecord(body.slug, body.collection, body.record)
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ record }))
}

async function handlePublish(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'POST the page.' }))
    return
  }
  const page = await publishPage(await readJson(req))
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(page))
}

async function handleHistory(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'GET the history.' }))
    return
  }
  const sites = await listSites().catch(() => [])
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({
    sites,
    burns: burnsWithSites(sites, []),
    burnsReady: true,
  }))
}

async function handleSite(req, res) {
  const slug = cleanSlug(new URL(req.url, 'http://localhost').searchParams.get('slug'))
  const html = slug ? await readSiteHtml(slug) : ''
  res.statusCode = html ? 200 : 404
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html || 'This site is not published.')
}
