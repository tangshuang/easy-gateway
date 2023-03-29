# Easy-GateWay

A library to create proxy servers very easily.

## Install

```
npm i -g easy-gateway
```

## CLI

```
egw start --target=[target]
```

Params:

- name: optional, when set, it will be deamon server's name, should be unique, if not set, just run in cli
- host: which ip to bind, 127.0.0.1 or 0.0.0.0 (default) or others
- port: which port to serve (default random between 10000 and 20000)
- target: which target url to proxy to
- base: which dirs/files to serve up as static content base
- token: if set, you should given token to access this server
- cookies: if set, the request to target will keep this cookie (original cookie as well)
- proxy: if set, the rules will be used as proxy, i.e. /api->http://localhost:9999/api;;/doc->/docs, notice use `->` to point source and target
- proxyHeaders: if set, http request HEADERS send by proxier will be set
- headers: if set, http response HEADERS will be set
- debug: if set, you can see the log in console
- script: a js file to operate gateway

The `token` is special, when you pass token, your target site will be must visited with a auth token.
`token` can also be `{token_key}:{token_value}` to match `?{token_key}={token_value}`.
You can visit with 1/ query string `?{token_key}={token_value}`, 2/ cookie `{token_key}={token_value}`, 3/ http headers `"{token_key}": "{token_value}"`.
`{token_key}` is default if not passed as `token` when use query string, as `EGW-TOKEN-{PORT}` when use cookie, as `EGW-TOKEN` when use headers.
When you visit visit with query string, cookie will be set too, so you can visit again without query string with cookie.

If you want to maintain this params, you can create a `.egwrc` file in your dir, and put this params in it, like:

```
## .egwrc
name=my-proxy-server
port=3000
target=https://www.google.com
```

And then, you will be able to not pass the params, only run `egw start`.

```
egw stop
```

Params:

- name: the server to stop, use current dirname as default

```
egw on
```

Setup domean all `.egwrc` files which contains `name` in `.egwrc` directory.


```
egw off
```

Down all `.egwrc` files which contains `name` in `.egwrc` directory.

## API

The `script` param allow you to define your own gateway:

```js
module.exports = function(args) {
  this.use({
    request(proxyReq, req, res) {},
  })
}
```

The function should return an instance of `GateWay`.

**GateWay**

```js
const { GateWay } = require('easy-gateway')

module.exports = function() {
  const gateway = new GateWay()
  gateway.use({
    // ...
  })
  return gateway
}
```

You can use the following methods:

- use(rule) add a new rule into gateway
- clear() clear all rules
- each(fn)

A rule is an object:

```js
const rule = {
  async auth(req, res) {},
  request(req) {},
  response(res) {},
  async rewrite(req) {},
  async retarget(req) {},
  async serve(req, res) {},
}
```

[read more](https://www.tangshuang.net/7537.html)
