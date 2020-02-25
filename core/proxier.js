const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const cookieParser = require('cookie-parser')

const Core = require('./core.js')
const GateWay = require('./gateway.js')

class Proxier extends Core {
  init(options) {
    const { target, headers, gateway = new GateWay(), ...others } = options

    const app = express()
    const proxy = createProxyMiddleware({
      target,
      headers,
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
    app.use(proxy)

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
