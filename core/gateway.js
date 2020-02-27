const Core = require('./core.js')
const { asyncEach, asyncMap, asyncIterate } = require('asw')

class GateWay extends Core {
  init(rules) {
    this._rules = rules || []
  }
  async auth(req, res) {
    const rules = this._rules.filter(item => item.auth)
    await asyncMap(rules, async (rule) => {
      const { auth } = rule
      await auth(req, res)
    })
  }
  request(proxyReq, req, res) {
    const rules = this._rules.filter(item => item.request)
    rules.forEach((rule) => {
      const { request } = rule
      request(proxyReq, req, res)
    })
  }
  response(proxyRes, req, res) {
    const rules = this._rules.filter(item => item.response)
    rules.forEach((rule) => {
      const { response } = rule
      response(proxyRes, req, res)
    })
  }
  async rewrite(req, path) {
    const rules = this._rules.filter(item => item.rewrite)
    const newPath = await asyncIterate(rules, async (rule, i, next, stop, complete) => {
      const { rewrite } = rule
      const result = await rewrite(req, path)
      if (result) {
        complete(result)
      }
      else {
        next()
      }
    })
    return newPath
  }
  async retarget(req, target) {
    const rules = this._rules.filter(item => item.retarget)
    const newTarget = await asyncIterate(rules, async (rule, i, next, stop, complete) => {
      const { retarget } = rule
      const result = await retarget(req, target)
      if (result) {
        complete(result)
      }
      else {
        next()
      }
    })
    return newTarget
  }
  async serve(req, res, next) {
    const rules = this._rules.filter(item => item.serve)

    const end = await asyncIterate(rules, async (rule, i, next, stop, complete) => {
      const { serve } = rule
      const result = await serve(req, res)
      if (result) {
        complete(1)
      }
      else {
        next()
      }
    })

    if (!end) {
      next()
    }
  }

  use(rule) {
    this._rules.push(rule)
    return this
  }

  clear() {
    this._rules = []
    return this
  }

  each(fn) {
    this._rules.forEach(fn)
    return this
  }
}

module.exports = GateWay
