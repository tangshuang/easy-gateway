const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const cookieParser = require('cookie-parser')

const Core = require('./core.js')
const GateWay = require('./gateway.js')

class Proxier extends Core {
  init(options) {
    const { target, headers, timeout, gateway = new GateWay() } = options

    const app = express()
    const proxy = createProxyMiddleware({
      target,
      headers,
      timeout,
      changeOrigin: true,
      secure: false,
      async pathRewrite(path, req) {
        await gateway.rewrite(req)
      },
      async router(req) {
        await gateway.retarget(req)
      },
      onProxyReq(proxyReq, req, res) {
        gateway.request(proxyReq)
      },
      onProxyRes(proxyRes, req, res) {
        gateway.response(proxyRes)
      },
    })

    app.use(cookieParser())
    app.use(async function(req, res, next) {
      const notallowed = () => {
        res.status(401)
        res.end('Not Allowed!')
      }
      try {
        const auth = await gateway.auth(req)
        if (auth) {
          next()
        }
        else {
          notallowed()
        }
      }
      catch (e) {
        notallowed()
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