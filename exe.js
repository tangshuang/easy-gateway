const Proxier = require('./core/proxier.js')
const GateWay = require('./core/gateway.js')

const args = require('process.args')(1)
const Cookie = require('cookie')
const fs = require('fs')

const {
  script,
  host,
  port,
  target,
  token,
  headers = '',
  cookies = '',
} = args

const tokenKey = 'EGW-Token-' + port
const tokenValue = token

let gateway = new GateWay()

if (tokenValue) {
  gateway.use({
    async auth(req, res) {
      const { cookies, headers, query } = req
      const { [tokenKey]: cookieToken } = cookies
      const { [tokenKey]: headerToken } = headers
      const { token: queryToken } = query

      if (queryToken) {
        if (queryToken !== tokenValue) {
          res.clearCookie(tokenKey)
          throw new Error('query?token does not match token.')
        }
      }
      else if (cookieToken) {
        if (cookieToken !== tokenValue) {
          res.clearCookie(tokenKey)
          throw new Error('cookies.token does not match token.')
        }
      }
      else if (headerToken) {
        if (cookieToken !== tokenValue) {
          throw new Error('headers.token does not match token.')
        }
      }
      else {
        throw new Error('did not recieve token.')
      }
    },
    response(proxyRes) {
      const tokenCookie = Cookie.serialize(tokenKey, tokenValue, {
        httpOnly: true,
        maxAge: 3600*12,
      })
      proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'] || []
      proxyRes.headers['set-cookie'].push(tokenCookie)
    },
  })
}

if (cookies) {
  gateway.use({
    request(proxyReq, req, res) {
      const originalCookies = req.headers.cookie
      const newCookies = (originalCookies ? originalCookies + '; ' : '') + cookies
      proxyReq.setHeader('Cookie', newCookies)
    },
  })
}

// headers comes later after cookies, so that, dev can override Cookie by using `headers="Cookie: a=1; b=2"`
if (headers) {
  const items = headers.split(';;').filter(item => !!item)
  gateway.use({
    request(req) {
      items.forEach((item) => {
        const [key, ...values] = item.split(':')
        const value = values.join(':') // the value may contain :, i.e. "Some: this is the value: 1;;"
        if (key && value) {
          req.setHeader(key.trim(), value.trim())
        }
      })
    },
  })
}

if (script && fs.existsSync(script)) {
  const callback = require(script)
  const output = callback.call(gateway, args)
  // replace original gateway instance
  if (output instanceof GateWay) {
    gateway = output
  }
}

const proxier = new Proxier({
  host,
  port,
  target,
  gateway,
})
proxier.start()
