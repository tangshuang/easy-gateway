const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const cookieParser = require('cookie-parser')

const Core = require('./core.js')
const GateWay = require('./gateway.js')

class Proxier extends Core {
  init(options) {
    const { target, base, gateway = new GateWay(), ...others } = options

    const app = express()

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

    if (target) {
      const proxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        ...others,
        async pathRewrite(path, req) {
          return await gateway.rewrite(req, path)
        },
        async router(req) {
          return await gateway.retarget(req, target)
        },
        onProxyReq(proxyReq, req, res) {
          gateway.request(proxyReq, req, res)
        },
        onProxyRes(proxyRes, req, res) {
          gateway.response(proxyRes, req, res)
        },
      })
      app.use(proxy)
    }

    this.options = options
    this.gateway = gateway
    this.app = app
  }
  start() {
    const { port, host } = this.options
    this.httpServer = this.app.listen(port, host)
  }
  stop() {
    this.httpServer.close()
  }
}

module.exports = Proxier
