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
  async rewrite(req) {
    const rules = this._rules.filter(item => item.rewrite)
    const path = await asyncIterate(rules, async (rule, i, next, stop, complete) => {
      const { rewrite } = rule
      const result = await rewrite(req)
      if (result) {
        complete(result)
      }
      else {
        next()
      }
    })
    return path
  }
  async retarget(req) {
    const rules = this._rules.filter(item => item.retarget)
    const target = await asyncIterate(rules, async (rule, i, next, stop, complete) => {
      const { retarget } = rule
      const result = await retarget(req)
      if (result) {
        complete(result)
      }
      else {
        next()
      }
    })
    return target
  }

  setRule(rule) {
    this._rules.push(rule)
    return this
  }
}

module.exports = GateWay