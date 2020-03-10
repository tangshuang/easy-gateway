const Core = require('./core.js')
const { asyncMap, asyncIterate } = require('asw')
const { createSafeExp, each, isObject } = require('ts-fns')
const Cookie = require('cookie')
const modifyProxyJson = require('node-http-proxy-json')
const ScopeX = require('scopex')
const express = require('express')
const path = require('path')
const finalhandler = require('finalhandler')

const cwd = process.cwd()

class GateWay extends Core {
  init(options = {}) {
    const { rules = [] } = options
    this.options = options
    this.rules = rules
  }
  async auth(req, res) {
    const rules = this.rules.filter(item => item.auth)
    await asyncMap(rules, async (rule) => {
      const { auth } = rule
      await auth(req, res)
    })
  }
  request(proxyReq, req, res) {
    const rules = this.rules.filter(item => item.request)
    rules.forEach((rule) => {
      const { request } = rule
      request(proxyReq, req, res)
    })
  }
  response(proxyRes, req, res) {
    const rules = this.rules.filter(item => item.response)
    rules.forEach((rule) => {
      const { response } = rule
      response(proxyRes, req, res)
    })
  }
  async rewrite(req, path) {
    const rules = this.rules.filter(item => item.rewrite)
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
    const rules = this.rules.filter(item => item.retarget)
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
  async serve(req, res) {
    const rules = this.rules.filter(item => item.serve)

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

    return end
  }

  use(rule) {
    this.rules.push(rule)
    return this
  }

  clear() {
    this.rules = []
    return this
  }

  each(fn) {
    this.rules.forEach(fn)
    return this
  }

  /**
   *
   * @param {json} json
   * @param {array} json.rules
   * [
   *   {
   *     ## http://old.com/api/xxx -> http://old.com/v2/api/xxx
   *     "route": "/api", ## can be string
   *     "rewrite": "/v2/api", ## contains host
   *     "request": {
   *       "headers": {},
   *       "cookies": ''
   *     },
   *     "response": {
   *       "headers": {},
   *       "cookies": {},
   *       "data": {}
   *     }
   *   },
   *   {
   *     ## http://old.com/api/projects/1/comments/1 -> http://new.com/v2/api/projects/1/comments/1
   *     "route": "/api/projects/{*}/comments/{*}", ## glob, {*} -> *
   *     "retarget": "http://xxx.com/v2"
   *   },
   *   {
   *     ## http://old.com/api/projects/1/comments/1 -> http://old.com/api/1/1
   *     "route": "[^\/api\/projects\/(.*?)\/comments\/(.*?)]", ## regexp
   *     "rewrite": "/v2/api/{1}/{2}"
   *   },
   *   {
   *     "route": "/docs",
   *     ## relative to cwd
   *     "rebase": "../../docs"
   *   }
   * ]
   */
  parse(json) {
    const { rules } = json
    const match = (url, route) => {
      if (route.substr(0, 1) === '[' && route.substr(-1) === ']') {
        const exp = route.substr(1, route.length - 2)
        const reg = new RegExp(exp)
        return reg.test(url)
      }
      else {
        const exp = createSafeExp(route)
        const expstr = '^' + exp.replace(/\\\*/g, '.*?')
        const reg = new RegExp(expstr)
        return reg.test(url)
      }
    }

    this.clear()
    rules.forEach((rule) => {
      if (rule && typeof rule === 'object' && !Array.isArray(rule)) {
        const { route, rewrite, retarget, request, response, rebase } = rule
        if (!route) {
          return
        }

        const rule = {}

        if (rewrite) {
          rule.rewrite = (req) => {
            const { originalUrl } = req
            if (match(originalUrl, route)) {
              return rewrite
            }
          }
        }

        if (retarget) {
          rule.retarget = (req) => {
            const { originalUrl } = req
            if (match(originalUrl, route)) {
              return retarget
            }
          }
        }

        if (request) {
          rule.request = (proxyReq, req) => {
            const { originalUrl } = req
            if (!match(originalUrl, route)) {
              return
            }

            if (cookies) {
              const originalCookies = req.headers.cookie
              const newCookies = (originalCookies ? originalCookies + '; ' : '') + cookies
              proxyReq.setHeader('Cookie', newCookies)
            }

            const { headers = {}, cookies = '' } = request
            each(headers, (value, key) => {
              proxyReq.setHeader(key, value)
            })
          }
        }

        if (response) {
          rule.response = (proxyRes, req, res) => {
            const { originalUrl } = req
            if (!match(originalUrl, route)) {
              return
            }

            const { headers = {}, cookies = {}, data } = request

            proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'] || []
            each(cookies, (value, key) => {
              const cookie = Cookie.serialize(key, value, {
                httpOnly: true,
                maxAge: 3600*12,
              })
              proxyRes.headers['set-cookie'].push(cookie)
            })

            each(headers, (value, key) => {
              proxyRes.headers[key] = value
            })

            // change the output json
            if (data && isObject(data)) {
              modifyProxyJson(res, proxyRes, (json) => {
                const scope = new ScopeX(json)
                const output = {}
                each(data, (exp, key) => {
                  const value = scope.parse(exp)
                  output[key] = value
                })
                return output
              })
            }
          }
        }

        if (rebase) {
          rule.serve = (req, res) => {
            const { originalUrl } = req
            if (!match(originalUrl, route)) {
              return false
            }

            const dir = path.resolve(cwd, rebase)
            express.static(dir)(req, res, finalhandler(req, res))
            return true
          }
        }

        this.use(rule)
      }
    })
  }
}

module.exports = GateWay
