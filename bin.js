#!/usr/bin/env node

const path = require('path')
const { Command } = require('commander')
const shell = require('shelljs')
const fs = require('fs')
const dotenv = require('dotenv')
const { createRandomStr, createRandomNum } = require('./core/utils.js')

const cwd = process.cwd()
const dirname = path.basename(cwd)
const exe = path.join(__dirname, 'exe.js')

const pm2_cwd = path.join(cwd, 'node_modules/.bin/pm2')
const pm2_local = path.join(__dirname, 'node_modules/.bin/pm2')
const pm2_global = path.join(__dirname, '../node_modules/.bin/pm2')
const pm2 = fs.existsSync(pm2_cwd) ? `"${pm2_cwd}"`
  : fs.existsSync(pm2_local) ? `"${pm2_local}"`
  : fs.existsSync(pm2_global) ? `"${pm2_global}"`
  : 'npx pm2'

const pkg = require('./package.json')

const program = new Command()

program
  // https://github.com/tj/commander.js/pull/1102
   .storeOptionsAsProperties(false)
   .passCommandToAction(false)

program
  .name(pkg.name)
  .version(pkg.version)

program
  .command('start')
  .option('--name [name]', 'use this name to setup a deamon server')
  .option('--script [script]', 'the js file to run which modify GateWay.')
  .option('--host [host]', 'which host to serve up a proxy server, default is 127.0.0.1')
  .option('--port [port]', 'which port to serve up for your proxy server')
  .option('--target [target]', 'proxy target, i.e. http://my-target.web.com:1080')
  .option('--base [base]', 'the static files to serve up')
  .option('--token [token]', 'use should bring the token when visit your proxy server')
  .option('--cookies [cookies]', 'cookies which will be appended with original cookies')
  .option('--proxyHeaders [proxyHeaders]', 'headers to be send by proxier to target, i.e. --headers=Token:xxx,Auth:xxx')
  .option('--headers [headers]', 'headers to be send to client by http response, i.e. --headers=Access-Control-Allow-Origin:*')
  .option('--proxy [proxy]', 'proxy, i.e. /api->https://localhost:8080;;/auth.token->http://some.com;;/some/subapi->http://any.com/any')
  .option('--debug [debug]')
  .action((options) => {
    const params = {}

    // load .egwrc file content firstly
    const configfile = path.join(cwd, '.egwrc')
    if (fs.existsSync(configfile)) {
      const config = dotenv.parse(fs.readFileSync(configfile))
      Object.assign(params, config)
    }
    // use options to override
    Object.assign(params, options)

    const {
      name,
      host = '0.0.0.0',
      token = '',
      headers = '',
      proxyHeaders = '',
      cookies = '',
      port = createRandomNum(10000, 20000), // default random port
      target,
      script,
      debug,
      proxy,
      secure,
    } = params

    let {
      base,
    } = params

    if (!target && !base) {
      base = '.'
    }

    let sh = `node "${exe}"`

    // use pm2 to start a given deamon server
    if (name) {
      sh = `${pm2} start "${exe}" --name="${name}"`
    }
    if (name && debug) {
      sh += ' --no-daemon'
    }
    if (name) {
      sh += ' --'
    }

    sh += ` --host="${host}" --port="${port}"`

    if (target) {
      sh += ` --target="${target}"`
    }

    if (base) {
      sh += ` --base="${base}"`
    }

    if (token) {
      if (token === true || token === 'true') {
        // create a random token
        const randomStr = createRandomStr()
        sh += ` --token="${randomStr}"`
      }
      else {
        sh += ` --token="${token}"`
      }
    }

    if (proxyHeaders) {
      sh += ` --proxyHeaders="${proxyHeaders}"`
    }

    if (headers) {
      sh += ` --headers="${headers}"`
    }

    if (cookies) {
      sh += ` --cookies="${cookies}"`
    }

    if (script) {
      const file = path.resolve(cwd, script)
      sh += ` --script="${file}"`
    }

    if (proxy) {
      sh += ` --proxy="${proxy}"`
    }

    if (secure === 'false') {
      sh += ` --secure=false`
    }

    if (debug) {
      sh += ` --debug`
    }

    console.log(sh)

    // stop previous server at the begin
    if (name) {
      shell.exec(`${pm2} stop ${name}`)
    }

    shell.exec(sh)
  })

program
  .command('stop')
  .option('--name [name]')
  .action((options) => {
    const params = {}

    // load .egwrc file content firstly
    const configfile = path.join(cwd, '.egwrc')
    if (fs.existsSync(configfile)) {
      const config = dotenv.parse(fs.readFileSync(configfile))
      Object.assign(params, config)
    }
    // use options to override
    Object.assign(params, options)

    const { name = dirname } = params
    shell.exec(`${pm2} delete ${name}`)
  })

program
  .command('on')
  .action(() => {
    const run = (configfile) => {
      const config = dotenv.parse(fs.readFileSync(configfile))
      const {
        name,
        host = '0.0.0.0',
        token = '',
        headers = '',
        cookies = '',
        port,
        target,
        base,
        script,
      } = config

      if (!name) {
        console.error(`[name] is undefined, [${configfile}] will not be used.`)
        return
      }

      if (!port) {
        console.error(`[port] is undefined, [${configfile}] will not be used.`)
        return
      }

      if (!target && !base) {
        console.error(`[target] and [base] are both undefined, [${configfile}] will not be used.`)
        return
      }

      let sh = `${pm2} start "${exe}" --name="${name}"`
      sh += ' --'
      sh += ` --host="${host}" --port="${port}"`

      if (target) {
        sh += ` --target="${target}"`
      }

      if (base) {
        sh += ` --base="${base}"`
      }

      if (token) {
        sh += ` --token="${token}"`
      }

      if (proxyHeaders) {
        sh += ` --proxyHeaders=${proxyHeaders}`
      }

      if (headers) {
        sh += ` --headers="${headers}"`
      }

      if (cookies) {
        sh += ` --cookies="${cookies}"`
      }

      if (script) {
        const file = path.resolve(cwd, script)
        sh += ` --script="${file}"`
      }

      console.log(sh)
      shell.exec(sh)
    }

    let configdir = path.join(cwd, '.egwrc')

    // use .egwrc dir
    if (fs.existsSync(configdir)) {
      const stat = fs.statSync(configdir)
      if (!stat.isDirectory()) {
        console.error(`${configdir} is not a directory.`)
        process.exit(1)
      }
    }
    // use current dir
    else {
      configdir = cwd
    }

    const files = fs.readdirSync(configdir)
    files.forEach((filename) => {
      if (filename.split('.').pop() !== 'egwrc') {
        return
      }
      const configfile = path.join(configdir, filename)
      run(configfile)
    })
  })

program
  .command('off')
  .action(() => {
    const bye = (configfile) => {
      const config = dotenv.parse(fs.readFileSync(configfile))
      const {
        name,
      } = config

      if (!name) {
        console.error(`[name] is undefined, [${configfile}] will not be used.`)
        return
      }

      shell.exec(`${pm2} delete ${name}`)
    }

    let configdir = path.join(cwd, '.egwrc')

    // use .egwrc dir
    if (fs.existsSync(configdir)) {
      const stat = fs.statSync(configdir)
      if (!stat.isDirectory()) {
        console.error(`[${configdir}] is not a directory.`)
        process.exit(1)
      }
    }
    // use current dir
    else {
      configdir = cwd
    }

    const files = fs.readdirSync(configdir)
    files.forEach((filename) => {
      if (filename.split('.').pop() !== 'egwrc') {
        return
      }
      const configfile = path.join(configdir, filename)
      bye(configfile)
    })
  })

program
  .parse(process.argv)
