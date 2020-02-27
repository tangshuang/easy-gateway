const express = require('express')
const cookieParser = require('cookie-parser')
const path = require('path')

const Core = require('./core.js')
const GateWay = require('./gateway.js')

class Server extends Core {
  init(options) {
    const { target, gateway = new GateWay() } = options

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
    app.use(async function(req, res, next) {
      try {
        await gateway.serve(req, res, next)
      }
      catch (e) {
        console.error(e)
        res.status(500)
        res.end(e instanceof Error ? e.message : 'Server Error!')
      }
    })
    app.use(express.static(path.resolve(process.cwd(), target)))

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

module.exports = Server
