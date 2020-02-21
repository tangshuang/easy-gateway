const Core = require('./core.js')
const { asyncEach, asyncMap } = require('asw')

class GateWay extends Core {
  init(rules) {
    this._rules = rules || []
  }
  async auth(req, res) {
    const results = await asyncMap(this._rules, async (rule) => {
      const { auth } = rule
      return await auth(req, res)
    })
    if (results.some(item => !item)) {
      throw new Error('Auth Fail!')
    }
  }
  request(req) {
    this._rules.forEach((rule) => {
      const { request } = rule
      request(req)
    })
  }
  response(res) {
    this._rules.forEach((rule) => {
      const { response } = rule
      response(res)
    })
  }
  async rewrite(req) {
    await asyncEach(this._rules, async (rule) => {
      const { rewrite } = rule
      await rewrite(req)
    })
  }
  async retarget(req) {
    await asyncEach(this._rules, async (rule) => {
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