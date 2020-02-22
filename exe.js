const Proxier = require('./core/proxier.js')
const args = require('process.args')(1)
const Cookie = require('cookie')

const { host, port, target, token, headers = '', cookies = '' } = args

const tokenKey = 'EGW-Token-' + port
const tokenValue = token

const proxier = new Proxier({
  host,
  port: +port,
  target,
})

if (tokenValue) {
  proxier.gateway.setRule({
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

if (headers) {
  const items = headers.split(',')
  proxier.gateway.setRule({
    request(req) {
      items.forEach((item) => {
        const [key, value] = item.split(':')
        if (key && value) {
          req.setHeader(key, value)
        }
      })
    },
  })
}

if (cookies) {
  proxier.gateway.setRule({
    request(proxyReq, req, res) {
      const originalCookies = req.headers.cookie
      const newCookies = (originalCookies ? originalCookies + '; ' : '') + cookies
      proxyReq.setHeader('Cookie', newCookies)
    },
  })
}

proxier.start()