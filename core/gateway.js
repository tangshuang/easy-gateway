const Core = require('./core.js')
const { asyncEach, asyncMap } = require('asw')

class GateWay extends Core {
  init(rules) {
    this._rules = rules || []
  }
  async auth(req, res) {
    const rules = this._rules.filter(item => item.auth)
    const results = await asyncMap(rules, async (rule) => {
      const { auth } = rule
      return await auth(req, res)
    })
    return !results.some(item => !item)
  }
  request(req) {
    const rules = this._rules.filter(item => item.request)
    rules.forEach((rule) => {
      const { request } = rule
      request(req)
    })
  }
  response(res) {
    const rules = this._rules.filter(item => item.response)
    rules.forEach((rule) => {
      const { response } = rule
      response(res)
    })
  }
  async rewrite(req) {
    const rules = this._rules.filter(item => item.rewrite)
    await asyncEach(rules, async (rule) => {
      const { rewrite } = rule
      await rewrite(req)
    })
  }
  async retarget(req) {
    const rules = this._rules.filter(item => item.retarget)
    await asyncEach(rules, async (rule) => {
      const { retarget } = rule
      await retarget(req)
    })
  }

  setRule(rule) {
    this._rules.push(rule)
    return this
  }
}

module.exports = GateWay