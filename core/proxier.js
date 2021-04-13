const express = require('express')
const { HttpProxyMiddleware } = require('http-proxy-middleware/dist/http-proxy-middleware.js')
const { createProxyMiddleware } = require('http-proxy-middleware')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const fs = require('fs')
const fallback = require('express-history-api-fallback')
const path = require('path')
const URL = require('url')

const UNAVAILABLE = 'http://127.0.0.1:65530'
const Core = require('./core.js')
const GateWay = require('./gateway.js')

class Proxier extends Core {
  init(options) {
    const {
      host,
      port,
      base,
      gateway = new GateWay(),
      target = UNAVAILABLE,
      proxy,
      ...others
    } = options

    this.host = host
    this.port = port
    this.base = base
    this.target = target

    const app = express()

    app.use(cors())
    app.use(cookieParser())
    app.use(async function(req, res, next) {
      try {
        await gateway.auth(req, res)
        next()
      }
      catch (e) {
        console.error(e)
        res.status(401)
        res.end(e instanceof Error ? e.message : 'Not Allowed!')
      }
    })

    // base is string or array
    if (base && base.length > 0) {
      const files = Array.isArray(base) ? base : [base]
      files.forEach((file) => {
        app.use(express.static(file))
      })
    }

    // proxy is set like ['/api->http://localhost:8080', '/download->http://localhost:8080']
    if (Array.isArray(proxy)) {
      proxy.forEach((item) => {
        const [from, to] = item.trim().split('->').map(item => item.trim())
        const url = URL.parse(to)
        const { origin } = url
        const uri = to.replace(origin, '')
        const config = {
          changeOrigin: true,
          ...others,
          target: origin,
        }
        if (uri && uri !== from) {
          config.pathRewrite = {
            [`^${from}`]: uri,
          }
        }
        app.use(from, createProxyMiddleware(config))
      })
    }

    app.use(async function(req, res, next) {
      try {
        const end = await gateway.serve(req, res)
        if (!end) {
          next()
        }
      }
      catch (e) {
        console.error(e)
        res.status(500)
        res.end(e instanceof Error ? e.message : 'Server Error!')
      }
    })

    if (base && base.length > 0 && Array.isArray(proxy)) {
      // 404 fallback to index.html
      // notice, only when pass `base` without target will work
      const dir = Array.isArray(base) ? base[0] : base
      const index = path.join(dir, 'index.html')
      if (fs.existsSync(index)) {
        app.use(fallback(index))
      }
    }
    else {
      // we should must serve up a proxy middleware server,
      // or when we push some gateway rules, we will lose the proxy feature
      // if a dev did not pass target, use a unavailable localhost address instead
      const proxyObj = new HttpProxyMiddleware({
        changeOrigin: true,
        ...others,
        target,
        async pathRewrite(path, req) {
          return await gateway.rewrite(req, path) || path
        },
        async router(req) {
          return await gateway.retarget(req, target) || target
        },
        onProxyReq(proxyReq, req, res) {
          gateway.request(proxyReq, req, res)
        },
        onProxyRes(proxyRes, req, res) {
          gateway.response(proxyRes, req, res)
        },
        onError(err, req, res) {
          if (target === UNAVAILABLE) {
            res.status(404).end('Not Found!')
          }
        },
      })

      const { middleware, logError, proxy } = proxyObj

      // override logError, so that it will not throw error when proxy to UNAVAILABLE
      proxy.removeListener('error', logError)
      proxy.on('error', (err, req, res) => {
        if (err.code === 'ECONNREFUSED' && target === UNAVAILABLE) {
          return
        }
        logError(err, req, res)
      })

      app.use(middleware)
    }

    this.options = options
    this.gateway = gateway
    this.app = app
  }
  start() {
    const { port, host, base, target } = this
    this.httpServer = this.app.listen(port, host)
    console.log(`Server up at ${host}:${port}, proxy to ${target}, base in ${base}`)
  }
  stop() {
    this.httpServer.close()
  }
}

module.exports = Proxier
