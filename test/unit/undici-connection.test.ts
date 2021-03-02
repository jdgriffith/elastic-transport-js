/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { test } from 'tap'
import { URL } from 'url'
import * as http from 'http'
import buffer from 'buffer'
import { gzipSync, deflateSync } from 'zlib'
import { Readable } from 'stream'
import intoStream from 'into-stream'
import AbortController from 'node-abort-controller'
import { buildServer } from '../utils'
import { UndiciConnection, errors, ConnectionOptions } from '../../'

const {
  ConfigurationError,
  TimeoutError,
  RequestAbortedError,
  ConnectionError
} = errors

test('Basic (http)', async t => {
  t.plan(3)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    t.match(req.headers, {
      'x-custom-test': /true/,
      connection: /keep-alive/
    })
    res.end('ok')
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`)
  })
  const res = await connection.request({
    path: '/hello',
    method: 'GET',
    headers: {
      'X-Custom-Test': 'true'
    }
  })
  t.match(res.headers, { connection: /keep-alive/ })
  t.strictEqual(res.body, 'ok')
  server.stop()
})

test('Basic (https)', async t => {
  t.plan(3)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    t.match(req.headers, {
      'x-custom-test': /true/,
      connection: /keep-alive/
    })
    res.end('ok')
  }

  const [{ port }, server] = await buildServer(handler, { secure: true })
  const connection = new UndiciConnection({
    url: new URL(`https://localhost:${port}`)
  })
  const res = await connection.request({
    path: '/hello',
    method: 'GET',
    headers: {
      'X-Custom-Test': 'true'
    }
  })
  t.match(res.headers, { connection: /keep-alive/ })
  t.strictEqual(res.body, 'ok')
  server.stop()
})

test('Basic (https with ssl agent)', async t => {
  t.plan(3)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    t.match(req.headers, {
      'x-custom-test': /true/,
      connection: /keep-alive/
    })
    res.end('ok')
  }

  const [{ port, key, cert }, server] = await buildServer(handler, { secure: true })
  const connection = new UndiciConnection({
    url: new URL(`https://localhost:${port}`),
    ssl: { key, cert }
  })
  const res = await connection.request({
    path: '/hello',
    method: 'GET',
    headers: {
      'X-Custom-Test': 'true'
    }
  })
  t.match(res.headers, { connection: /keep-alive/ })
  t.strictEqual(res.body, 'ok')
  server.stop()
})

test('Timeout support / 1', async t => {
  t.plan(1)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    setTimeout(() => res.end('ok'), 100)
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`),
    timeout: 50
  })

  try {
    await connection.request({
      path: '/hello',
      method: 'GET'
    })
  } catch (err) {
    t.true(err instanceof TimeoutError)
  }
  server.stop()
})

test('Timeout support / 2', async t => {
  t.plan(2)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    // @ts-expect-error
    res.writeHead(200, { 'content-type': 'text/plain' })
    setTimeout(() => res.end('ok'), 100)
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`),
    timeout: 50
  })
  try {
    await connection.request({
      path: '/hello',
      method: 'GET'
    })
  } catch (err) {
    t.ok(err instanceof TimeoutError)
    t.is(err.message, 'Request timed out')
  }
  server.stop()
})

test('Timeout support / 3', async t => {
  t.plan(2)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    setTimeout(() => res.end('ok'), 100)
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`),
    timeout: 200
  })
  try {
    await connection.request({
      path: '/hello',
      method: 'GET',
      timeout: 50
    })
  } catch (err) {
    t.ok(err instanceof TimeoutError)
    t.is(err.message, 'Request timed out')
  }
  server.stop()
})

test('Timeout support / 4', async t => {
  t.plan(2)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    setTimeout(() => res.end('ok'), 100)
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`),
    timeout: 200
  })
  const abortController = new AbortController()
  try {
    await connection.request({
      path: '/hello',
      method: 'GET',
      abortController,
      timeout: 50
    })
  } catch (err) {
    t.ok(err instanceof TimeoutError)
    t.is(err.message, 'Request timed out')
  }
  server.stop()
})

test('Timeout support / 5', async t => {
  t.plan(1)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    res.end('ok')
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`)
  })
  const res = await connection.request({
    path: '/hello',
    method: 'GET',
    timeout: 50
  })
  t.strictEqual(res.body, 'ok')
  server.stop()
})

test('Should concatenate the querystring', async t => {
  t.plan(1)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    t.strictEqual(req.url, '/hello?hello=world&you_know=for%20search')
    res.end('ok')
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`)
  })

  await connection.request({
    path: '/hello',
    method: 'GET',
    querystring: 'hello=world&you_know=for%20search'
  })
  server.stop()
})

test('Body request', async t => {
  t.plan(1)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    let payload = ''
    req.setEncoding('utf8')
    req.on('data', chunk => { payload += chunk })
    req.on('error', t.fail)
    req.on('end', () => {
      t.strictEqual(payload, 'hello')
      res.end('ok')
    })
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`)
  })

  await connection.request({
    path: '/hello',
    method: 'POST',
    body: 'hello'
  })
  server.stop()
})

test('Send body as buffer', async t => {
  t.plan(1)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    let payload = ''
    req.setEncoding('utf8')
    req.on('data', chunk => { payload += chunk })
    req.on('error', t.fail)
    req.on('end', () => {
      t.strictEqual(payload, 'hello')
      res.end('ok')
    })
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`)
  })

  await connection.request({
    path: '/hello',
    method: 'POST',
    body: Buffer.from('hello')
  })
  server.stop()
})

test('Send body as stream', async t => {
  t.plan(1)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    let payload = ''
    req.setEncoding('utf8')
    req.on('data', chunk => { payload += chunk })
    req.on('error', t.fail)
    req.on('end', () => {
      t.strictEqual(payload, 'hello')
      res.end('ok')
    })
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`)
  })

  await connection.request({
    path: '/hello',
    method: 'POST',
    // @ts-ignore
    body: intoStream('hello')
  })
  server.stop()
})

test('Should not close a connection if there are open requests', async t => {
  t.plan(1)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    setTimeout(() => res.end('ok'), 100)
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`)
  })

  setImmediate(() => connection.close())
  const res = await connection.request({
    path: '/hello',
    method: 'GET'
  })
  t.strictEqual(res.body, 'ok')

  server.stop()
})

test('Url with auth', async t => {
  t.plan(1)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    t.strictEqual(req.headers.authorization, 'Basic Zm9vOmJhcg==')
    res.end('ok')
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`),
    auth: { username: 'foo', password: 'bar' }
  })

  await connection.request({
    path: '/hello',
    method: 'GET'
  })

  server.stop()
})

test('Custom headers for connection', async t => {
  t.plan(2)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    t.match(req.headers, {
      'x-custom-test': /true/,
      'x-foo': /bar/
    })
    res.end('ok')
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`),
    headers: { 'x-foo': 'bar' }
  })

  await connection.request({
    path: '/hello',
    method: 'GET',
    headers: {
      'X-Custom-Test': 'true'
    }
  })

  // should not update the default
  t.deepEqual(connection.headers, { 'x-foo': 'bar' })
  server.stop()
})

// // TODO: add a check that the response is not decompressed
// test('asStream set to true', t => {
//   t.plan(2)

//   function handler (req, res) {
//     res.end('ok')
//   }

//   buildServer(handler, ({ port }, server) => {
//     const connection = new Connection({
//       url: new URL(`http://localhost:${port}`)
//     })
//     connection.request({
//       path: '/hello',
//       method: 'GET',
//       asStream: true
//     }, (err, res) => {
//       t.error(err)

//       let payload = ''
//       res.setEncoding('utf8')
//       res.on('data', chunk => { payload += chunk })
//       res.on('error', err => t.fail(err))
//       res.on('end', () => {
//         t.strictEqual(payload, 'ok')
//         server.stop()
//       })
//     })
//   })
// })

// // https://github.com/nodejs/node/commit/b961d9fd83
test('Should disallow two-byte characters in URL path', async t => {
  t.plan(1)

  const connection = new UndiciConnection({
    url: new URL('http://localhost:9200')
  })
  try {
    await connection.request({
      path: '/thisisinvalid\uffe2',
      method: 'GET'
    })
  } catch (err) {
    t.strictEqual(
      err.message,
      'ERR_UNESCAPED_CHARACTERS: /thisisinvalid\uffe2'
    )
  }
})

test('Abort a request syncronously', async t => {
  t.plan(1)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    t.fail('The server should not be contacted')
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`),
    headers: { 'x-foo': 'bar' }
  })

  const controller = new AbortController()
  connection.request({
    path: '/hello',
    method: 'GET',
    abortController: controller
  }).catch(err => {
    t.ok(err instanceof RequestAbortedError)
    server.stop()
  })

  controller.abort()
  await connection.close()
})

test('Abort a request asyncronously', async t => {
  t.plan(1)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    // might be called or not
    res.end('ok')
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`),
    headers: { 'x-foo': 'bar' }
  })

  const controller = new AbortController()
  setImmediate(() => controller.abort())
  try {
    await connection.request({
      path: '/hello',
      method: 'GET',
      abortController: controller
    })
  } catch (err) {
    t.ok(err instanceof RequestAbortedError)
  }

  await connection.close()
  server.stop()
})

test('Abort with a slow body', async t => {
  t.plan(1)

  const controller = new AbortController()
  const connection = new UndiciConnection({
    url: new URL('https://localhost:9200')
  })

  const slowBody = new Readable({
    read (size: number) {
      setTimeout(() => {
        this.push('{"size":1, "query":{"match_all":{}}}')
        this.push(null) // EOF
      }, 1000).unref()
    }
  })

  setImmediate(() => controller.abort())
  try {
    await connection.request({
      method: 'GET',
      path: '/',
      // @ts-ignore
      body: slowBody,
      abortController: controller
    })
  } catch (err) {
    t.ok(err instanceof RequestAbortedError)
  }
})

// The nodejs http agent will try to wait for the whole
// body to arrive before closing the request, so this
// test might take some time.
test('Bad content length', async t => {
  t.plan(2)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    const body = JSON.stringify({ hello: 'world' })
    res.setHeader('Content-Type', 'application/json;utf=8')
    res.setHeader('Content-Length', body.length + '')
    res.end(body.slice(0, -5))
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`)
  })
  try {
    await connection.request({
      path: '/hello',
      method: 'GET'
    })
  } catch (err) {
    t.ok(err instanceof ConnectionError)
    t.is(err.message, 'other side closed')
  }
  server.stop()
})

test('Socket destryed while reading the body', async t => {
  t.plan(2)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    const body = JSON.stringify({ hello: 'world' })
    res.setHeader('Content-Type', 'application/json;utf=8')
    res.setHeader('Content-Length', body.length + '')
    res.write(body.slice(0, -5))
    setTimeout(() => {
      res.socket?.destroy()
    }, 500)
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`)
  })
  try {
    await connection.request({
      path: '/hello',
      method: 'GET'
    })
  } catch (err) {
    t.ok(err instanceof ConnectionError)
    t.is(err.message, 'other side closed')
  }
  server.stop()
})

test('Content length too big (buffer)', async t => {
  t.plan(2)

  class MyConnection extends UndiciConnection {
    constructor (opts: ConnectionOptions) {
      super(opts)
      this.pool = {
        // @ts-expect-error
        request () {
          const stream = intoStream(JSON.stringify({ hello: 'world' }))
          const statusCode = 200
          const headers = {
            'content-type': 'application/json;utf=8',
            'content-encoding': 'gzip',
            'content-length': buffer.constants.MAX_LENGTH + 10,
            connection: 'keep-alive',
            date: new Date().toISOString()
          }
          return { body: stream, statusCode, headers }
        }
      }
    }
  }

  const connection = new MyConnection({
    url: new URL('http://localhost:9200')
  })

  try {
    await connection.request({
      method: 'GET',
      path: '/'
    })
  } catch (err) {
    t.ok(err instanceof RequestAbortedError)
    t.is(err.message, `The content length (${buffer.constants.MAX_LENGTH + 10}) is bigger than the maximum allowed buffer (${buffer.constants.MAX_LENGTH})`)
  }
})

test('Content length too big (string)', async t => {
  t.plan(2)

  class MyConnection extends UndiciConnection {
    constructor (opts: ConnectionOptions) {
      super(opts)
      this.pool = {
        // @ts-expect-error
        request () {
          const stream = intoStream(JSON.stringify({ hello: 'world' }))
          const statusCode = 200
          const headers = {
            'content-type': 'application/json;utf=8',
            'content-encoding': 'gzip',
            'content-length': buffer.constants.MAX_STRING_LENGTH + 10,
            connection: 'keep-alive',
            date: new Date().toISOString()
          }
          return { body: stream, statusCode, headers }
        }
      }
    }
  }

  const connection = new MyConnection({
    url: new URL('http://localhost:9200')
  })

  try {
    await connection.request({
      method: 'GET',
      path: '/'
    })
  } catch (err) {
    t.ok(err instanceof RequestAbortedError)
    t.is(err.message, `The content length (${buffer.constants.MAX_STRING_LENGTH + 10}) is bigger than the maximum allowed string (${buffer.constants.MAX_STRING_LENGTH})`)
  }
})

test('Compressed responsed should return a buffer as body (gzip)', async t => {
  t.plan(2)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    t.match(req.headers, {
      'accept-encoding': /gzip,deflate/
    })

    const body = gzipSync(JSON.stringify({ hello: 'world' }))
    res.setHeader('Content-Type', 'application/json;utf=8')
    res.setHeader('Content-Encoding', 'gzip')
    res.setHeader('Content-Length', Buffer.byteLength(body))
    res.end(body)
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`)
  })
  const res = await connection.request({
    path: '/hello',
    method: 'GET',
    headers: {
      'accept-encoding': 'gzip,deflate'
    }
  })
  t.true(res.body instanceof Buffer)
  server.stop()
})

test('Compressed responsed should return a buffer as body (deflate)', async t => {
  t.plan(2)

  function handler (req: http.IncomingMessage, res: http.OutgoingMessage) {
    t.match(req.headers, {
      'accept-encoding': /gzip,deflate/
    })

    const body = deflateSync(JSON.stringify({ hello: 'world' }))
    res.setHeader('Content-Type', 'application/json;utf=8')
    res.setHeader('Content-Encoding', 'deflate')
    res.setHeader('Content-Length', Buffer.byteLength(body))
    res.end(body)
  }

  const [{ port }, server] = await buildServer(handler)
  const connection = new UndiciConnection({
    url: new URL(`http://localhost:${port}`)
  })
  const res = await connection.request({
    path: '/hello',
    method: 'GET',
    headers: {
      'accept-encoding': 'gzip,deflate'
    }
  })
  t.true(res.body instanceof Buffer)
  server.stop()
})

test('Connection error', async t => {
  t.plan(1)

  const connection = new UndiciConnection({
    url: new URL('http://foo.bar')
  })

  try {
    await connection.request({
      path: '/',
      method: 'GET'
    })
  } catch (err) {
    t.true(err instanceof ConnectionError)
  }
})

test('Throw if detects http agent options', async t => {
  t.plan(3)

  try {
    new UndiciConnection({
      url: new URL('http://localhost:9200'),
      agent: {
        keepAlive: false
      }
    })
  } catch (err) {
    t.true(err instanceof ConfigurationError)
  }

  try {
    new UndiciConnection({
      url: new URL('http://localhost:9200'),
      agent: () => new http.Agent()
    })
  } catch (err) {
    t.true(err instanceof ConfigurationError)
  }

  try {
    new UndiciConnection({
      url: new URL('http://localhost:9200'),
      agent: false
    })
  } catch (err) {
    t.true(err instanceof ConfigurationError)
  }
})

test('Throw if detects proxy option', async t => {
  t.plan(1)

  try {
    new UndiciConnection({
      url: new URL('http://localhost:9200'),
      proxy: new URL('http://localhost:9201')
    })
  } catch (err) {
    t.true(err instanceof ConfigurationError)
  }
})