const Proxier = require('./core/proxier.js')
const GateWay = require('./core/gateway.js')

const args = require('process.args')(1)
const fs = require('fs')
const path = require('path')
const { tryParseJson } = require('./core/utils')

const cwd = process.cwd()

const {
  script,
  host,
  port,
  target,
  base = '',
  token = '',
  headers: resHeaders = '',
  proxyHeaders = '',
  proxyCookies = '',
  debug = false,
  proxy,
  secure,
  cors,
} = args

// allow set --token=tokenKey:tokenValue
const [tokenKey, tokenValue] = (token.indexOf(':') > 0 ? token.split(':') : ['token', token])

const HEADER_TOKEN_KEY = 'EGW-TOKEN'
// cookie token name should must appendding with -[port], because different port use same cookie
const COOKIE_TOKEN_KEY = HEADER_TOKEN_KEY + '-' + port

let gateway = new GateWay()
if (script && fs.existsSync(script)) {
  const ext = script.split('.').pop()
  if (ext === 'json') {
    const rules = require(script)
    gateway.parse(rules)
  }
  else {
    const callback = require(script)
    const output = callback.call(gateway, args)
    // replace original gateway instance
    if (output instanceof GateWay) {
      gateway = output
    }
  }
}

if (tokenValue) {
  gateway.use({
    async auth(req, res) {
      const { cookies, query } = req
      const queryToken = query[tokenKey]
      const cookieToken = cookies[COOKIE_TOKEN_KEY]
      // we must use req.get to get header to ignore case-insensitive problem
      const headerToken = req.get(HEADER_TOKEN_KEY)

      if (queryToken) {
        if (queryToken !== tokenValue) {
          res.clearCookie(COOKIE_TOKEN_KEY)
          throw new Error('query?token does not match token.')
        }
        // make query token to be cookie token, so that user can visit without query string any more
        res.cookie(COOKIE_TOKEN_KEY, tokenValue, {
          httpOnly: true,
          maxAge: 1000*3600*24,
        })
      }
      else if (cookieToken) {
        if (cookieToken !== tokenValue) {
          res.clearCookie(COOKIE_TOKEN_KEY)
          throw new Error(`cookies[${COOKIE_TOKEN_KEY}] does not match token.`)
        }
      }
      else if (headerToken) {
        if (headerToken !== tokenValue) {
          throw new Error(`HEADERS[${HEADER_TOKEN_KEY}] does not match token.`)
        }
        // when use headers, we do not need to set cookie
      }
      else {
        throw new Error('Did not recieve token.')
      }
    },
  })
}

// headers comes later after cookies, so that, dev can override Cookie by using `headers="Cookie: a=1; b=2"`
if (proxyHeaders) {
  const items = proxyHeaders.split(';;').filter(Boolean)
  gateway.use({
    request(proxyReq) {
      items.forEach((item) => {
        const [key, ...values] = item.split(':')
        const value = values.join(':') // the value may contain :, i.e. "Some: this is the value: 1;;"
        if (key && value) {
          proxyReq.setHeader(key.trim(), tryParseJson(value.trim()))
        }
      })
    },
  })
}

if (proxyCookies) {
  gateway.use({
    request(proxyReq, req) {
      const originalCookies = req.headers.cookie
      const newCookies = (originalCookies ? originalCookies + '; ' : '') + proxyCookies
      proxyReq.setHeader('Cookie', newCookies)
    },
  })
}

let headers = null
if (resHeaders) {
  const items = resHeaders.split(';;').filter(Boolean)
  const obj = {}
  items.forEach((item) => {
    const [key, ...values] = item.split(':')
    const value = values.join(':') // the value may contain :, i.e. "Some: this is the value: 1;;"
    if (key && value) {
      obj[key.trim()] = tryParseJson(value.trim())
    }
  })
  if (items.length) {
    headers = obj
  }
}
if (cors) {
  headers = headers || {}
  headers['Access-Control-Allow-Origin'] = '*'
  headers['Access-Control-Allow-Headers'] = '*'
  headers['Access-Control-Allow-Methods'] = '*'
  headers['Access-Control-Allow-Credentials'] = 'true'
}

const files = base.split(';;').filter(Boolean).map(item => path.resolve(cwd, item))
const proxier = new Proxier({
  host,
  port,
  target,
  base: files,
  gateway,
  logLevel: debug && 'info',
  proxy: proxy && proxy.split(';;'),
  secure: secure,
  headers,
})
proxier.start()
