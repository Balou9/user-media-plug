const tape = require('tape')

const { createServer } = require('http')
const { PassThrough } = require('stream')

const websocket = require('websocket-stream')
const WebSocketServer = websocket.Server
const streamSet = require('stream-set')
const jsonStream = require('duplex-json-stream')
const hashtagStreamSet = require('hashtag-stream-set')

const levelup = require('levelup')
const memdown = require('memdown')
const enc = require('encoding-down')

const valid = require('./lib/valid.js')

const { createForward, createSendForceCall } = require('./lib/notify.js')

const { // TODO: all "pending"
  createHandleUpgrade,
  createHandleMetastream,
  createHandleMetadata,
  createMetaWhoami,
  createRegisterUser, // pending
  createAddPeers,     // pending
  createDeletePeers,  // pending
  createGetPeers,
  createLogin,
  createLogout,
  createStatus,
  createCall,
  createAccept,
  createReject,
  createUnpair,
  createHandlePair,
  willDeleteMediastreams
} = require('./lib/handlers.js')

tape('handleUpgrade - pass', t => {
  const http_server = createServer()
  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)
  const media_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)

  const handleUpgrade = createHandleUpgrade(meta_server, media_server)

  http_server.on('upgrade', handleUpgrade)
  http_server.listen(10000, 'localhost')

  const a_ws = websocket('ws://localhost:10000/meta')
  const b_ws = websocket('ws://localhost:10000/media')

  a_ws.on('error', t.end)
  b_ws.on('error', t.end)

  setTimeout(() => {
    t.pass('connections upgraded from http to ws without errors')
    a_ws.destroy()
    b_ws.destroy()
    http_server.close(t.end)
  }, 250)
})

tape('handleUpgrade - fail - switch fallthru', t => {
  const http_server = createServer()
  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)
  const media_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)

  const handleUpgrade = createHandleUpgrade(meta_server, media_server)

  http_server.on('upgrade', handleUpgrade)
  http_server.listen(10000, 'localhost')

  const a_ws = websocket('ws://localhost:10000/')
  const b_ws = websocket('ws://localhost:10000/noop')

  a_ws.on('error', err => t.ok(err, 'got a\'s connection error'))
  b_ws.on('error', err => t.ok(err, 'got b\'s connection error'))

  setTimeout(() => http_server.close(t.end), 250)
})

tape('handleMetastream', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
  const active_meta_streams = streamSet()
  const active_media_streams = hashtagStreamSet(willDeleteMediastreams)
  const logged_in_users = new Set()

  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)

  const forward = createForward(active_meta_streams)
  const sendForceCall = createSendForceCall(active_meta_streams)

  const handleMetastream = createHandleMetastream(createHandleMetadata({
    metaWhoami: createMetaWhoami(active_meta_streams),
    registerUser: createRegisterUser(db),
    addPeers: createAddPeers(db),
    deletePeers: createDeletePeers(db),
    getPeers: createGetPeers(db),
    login: createLogin(db, logged_in_users),
    logout: createLogout(logged_in_users),
    status: createStatus(db, active_meta_streams, forward),
    call: createCall(forward),
    accept: createAccept(meta_server, forward, sendForceCall),
    reject: createReject(forward),
    unpair: createUnpair(active_media_streams)
  }, logged_in_users))

  handleMetastream(new PassThrough(), null)
  t.pass('handleMetastream so simple, hardly testable, asserting no errs')
  t.end()
})

tape('handleMetadata - fail pt1', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
  const active_meta_streams = streamSet()
  const active_media_streams = hashtagStreamSet(willDeleteMediastreams)
  const logged_in_users = new Set()

  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)

  const forward = createForward(active_meta_streams)
  const sendForceCall = createSendForceCall(active_meta_streams)

  const handleMetadata = createHandleMetadata({
    metaWhoami: createMetaWhoami(active_meta_streams),
    registerUser: createRegisterUser(db),
    addPeers: createAddPeers(db),
    deletePeers: createDeletePeers(db),
    getPeers: createGetPeers(db),
    login: createLogin(db, logged_in_users),
    logout: createLogout(logged_in_users),
    status: createStatus(db, active_meta_streams, forward),
    call: createCall(forward),
    accept: createAccept(meta_server, forward, sendForceCall),
    reject: createReject(forward),
    unpair: createUnpair(active_media_streams)
  }, logged_in_users)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'login', user: 'chiefbiiko', password: 'abc', tx }

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...bc "whoami" must be the inital msg sent thru a socket')
    t.equal(res.tx, tx, 'transaction identifiers equal')
    t.end()
  })

  handleMetadata(meta_stream, metadata, err => {
    if (err) t.end(err)
  })
})

tape('handleMetadata - fail pt2', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
  const active_meta_streams = streamSet()
  const active_media_streams = hashtagStreamSet(willDeleteMediastreams)
  const logged_in_users = new Set()

  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)

  const forward = createForward(active_meta_streams)
  const sendForceCall = createSendForceCall(active_meta_streams)

  const handleMetadata = createHandleMetadata({
    metaWhoami: createMetaWhoami(active_meta_streams),
    registerUser: createRegisterUser(db),
    addPeers: createAddPeers(db),
    deletePeers: createDeletePeers(db),
    getPeers: createGetPeers(db),
    login: createLogin(db, logged_in_users),
    logout: createLogout(logged_in_users),
    status: createStatus(db, active_meta_streams, forward),
    call: createCall(forward),
    accept: createAccept(meta_server, forward, sendForceCall),
    reject: createReject(forward),
    unpair: createUnpair(active_media_streams)
  }, logged_in_users)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'login', user: 'chiefbiiko', password: 'abc', tx }

  meta_stream.whoami = 'noop'

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...bc meta_stream.whoami !== metadata.user')
    t.equal(res.tx, tx, 'transaction identifiers equal')
    t.end()
  })

  handleMetadata(meta_stream, metadata, err => {
    if (err) t.end(err)
  })
})

tape('handleMetadata - fail pt3', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
  const active_meta_streams = streamSet()
  const active_media_streams = hashtagStreamSet(willDeleteMediastreams)
  const logged_in_users = new Set()

  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)

  const forward = createForward(active_meta_streams)
  const sendForceCall = createSendForceCall(active_meta_streams)

  const handleMetadata = createHandleMetadata({
    metaWhoami: createMetaWhoami(active_meta_streams),
    registerUser: createRegisterUser(db),
    addPeers: createAddPeers(db),
    deletePeers: createDeletePeers(db),
    getPeers: createGetPeers(db),
    login: createLogin(db, logged_in_users),
    logout: createLogout(logged_in_users),
    status: createStatus(db, active_meta_streams, forward),
    call: createCall(forward),
    accept: createAccept(meta_server, forward, sendForceCall),
    reject: createReject(forward),
    unpair: createUnpair(active_media_streams)
  }, logged_in_users)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'peers', user: 'chiefbiiko', tx }

  meta_stream.whoami = 'chiefbiiko'

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...bc metadata.user is not logged in')
    t.equal(res.tx, tx, 'transaction identifiers equal')
    t.end()
  })

  handleMetadata(meta_stream, metadata, err => {
    if (err) t.end(err)
  })
})

tape('handleMetadata - switch fallthru', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
  const active_meta_streams = streamSet()
  const active_media_streams = hashtagStreamSet(willDeleteMediastreams)
  const logged_in_users = new Set()

  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)

  const forward = createForward(active_meta_streams)
  const sendForceCall = createSendForceCall(active_meta_streams)

  const handleMetadata = createHandleMetadata({
    metaWhoami: createMetaWhoami(active_meta_streams),
    registerUser: createRegisterUser(db),
    addPeers: createAddPeers(db),
    deletePeers: createDeletePeers(db),
    getPeers: createGetPeers(db),
    login: createLogin(db, logged_in_users),
    logout: createLogout(logged_in_users),
    status: createStatus(db, active_meta_streams, forward),
    call: createCall(forward),
    accept: createAccept(meta_server, forward, sendForceCall),
    reject: createReject(forward),
    unpair: createUnpair(active_media_streams)
  }, logged_in_users)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'unknown', user: 'chiefbiiko', tx }

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...bc of an unknown metadata.type')
    t.equal(res.tx, tx, 'transaction identifiers equal')
    t.end()
  })

  handleMetadata(meta_stream, metadata, err => {
    if (err) t.end(err)
  })
})

tape('metaWhoami - pass', t => {
  const active_meta_streams = streamSet()
  const metaWhoami = createMetaWhoami(active_meta_streams)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'WHOAMI', user: 'chiefbiiko', tx }

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.true(res.ok, 'response status ok')
    t.equal(res.tx, tx, 'transaction identifiers equal')
    t.end()
  })

  metaWhoami(meta_stream, metadata, err => {
    if (err) t.end(err)
  })
})

tape('metaWhoami - fail pt1', t => {
  const active_meta_streams = streamSet()

  const metaWhoami = createMetaWhoami(active_meta_streams)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'WHOAMI', user: 'chiefbiiko', tx }

  const peer_stream = jsonStream(new PassThrough())
  peer_stream.whoami = 'chiefbiiko'
  active_meta_streams.add(peer_stream)

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...bc the sent whoami identifier (user) already exists')
    t.equal(res.tx, tx, 'transaction identifiers equal')
  })

  metaWhoami(meta_stream, metadata, err => {
    t.true(err.message.includes('excess'), 'excess whoami')
    t.end()
  })
})

tape('metaWhoami - fail pt2', t => {
  const active_meta_streams = streamSet()

  const metaWhoami = createMetaWhoami(active_meta_streams)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'metaWhoami', user: 'chiefbiiko', tx }

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...invalid schema')
    t.equal(res.tx, tx, 'transaction identifiers equal')
  })

  metaWhoami(meta_stream, metadata, err => {
    t.true(err.message.startsWith('invalid schema'), 'invalid schema err')
    t.end()
  })
})

tape('login - pass', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
  const logged_in_users = new Set()

  const login = createLogin(db, logged_in_users)

  db.put('chiefbiiko', { password: 'abc', peers: [] }, err => {
    if (err) t.end(err)

    const tx = Math.random()
    const meta_stream = jsonStream(new PassThrough())
    const metadata = { type: 'LOGIN', user: 'chiefbiiko', password: 'abc', tx }

    meta_stream.once('data', res => {
      t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
      t.true(res.ok, 'response status ok')
      t.equal(res.tx, tx, 'transaction identifiers equal')
      t.end()
    })

    login(meta_stream, metadata, err => {
      if (err) t.end(err)
    })
  })
})

tape('login - fail pt1', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
  const logged_in_users = new Set()

  const login = createLogin(db, logged_in_users)

  db.put('chiefbiiko', { password: 'abc', peers: [] }, err => {
    if (err) t.end(err)

    const tx = Math.random()
    const meta_stream = jsonStream(new PassThrough())
    const metadata = { type: 'LOGIN', user: 'chiefbiiko', password: 'abz', tx }

    meta_stream.once('data', res => {
      t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
      t.false(res.ok, 'response status not ok...')
      t.comment('...wrong password')
      t.equal(res.tx, tx, 'transaction identifiers equal')
    })

    login(meta_stream, metadata, err => {
      t.true(err.message.startsWith('invalid password'), 'invlid password')
      t.end()
    })
  })
})

tape('login - fail pt2', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
  const logged_in_users = new Set()

  const login = createLogin(db, logged_in_users)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { msg: 'LOGIN', user: 'chiefbiiko', password: 'abc', tx }

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...invalid schema')
    t.equal(res.tx, tx, 'transaction identifiers equal')
  })

  login(meta_stream, metadata, err => {
    t.true(/invalid schema [A-Z]{1,2}/i.test(err.message), 'cb err')
    t.end()
  })
})

tape('logout - pass', t => {
  const logged_in_users = new Set()

  const logout = createLogout(logged_in_users)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'LOGOUT', user: 'chiefbiiko', tx }

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.true(res.ok, 'response status ok')
    t.equal(res.tx, tx, 'transaction identifiers equal')
    t.end()
  })

  logout(meta_stream, metadata, err => {
    if (err) t.end(err)
  })
})

tape('logout - fail', t => {
  const logged_in_users = new Set()

  const logout = createLogout(logged_in_users)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'LOGOUT', username: 'chiefbiiko', tx }

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...invalid schema')
    t.equal(res.tx, tx, 'transaction identifiers equal')
  })

  logout(meta_stream, metadata, err => {
    t.true(err.message.startsWith('invalid schema'), 'invalid schema err')
    t.end()
  })
})

tape('status - pass', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
  const active_meta_streams = streamSet()

  const forward = createForward(active_meta_streams)
  const status = createStatus(db, active_meta_streams, forward)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const peer_stream = jsonStream(new PassThrough())
  const metadata = { type: 'STATUS', user: 'chiefbiiko', status: 'cool', tx }

  peer_stream.whoami = 'noop'
  active_meta_streams.add(peer_stream)

  db.put('chiefbiiko', { peers: [ 'noop' ], status: 'none' }, err => {
    if (err) t.end(err)

    var pending = 2

    meta_stream.once('data', res => {
      t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
      t.true(res.ok, 'response status ok')
      t.equal(res.tx, tx, 'transaction identifiers equal')
      if (!--pending) t.end()
    })

    peer_stream.once('data', notif => {
      t.same(notif, metadata, 'forwarded metadata to peer noop')
      t.equal(notif.status, 'cool', 'got the status update in a notification')
      if (!--pending) t.end()
    })

    status(meta_stream, metadata, err => {
      if (err) t.end(err)
    })
  })
})

tape('status - fail pt1', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
  const active_meta_streams = streamSet()

  const forward = createForward(active_meta_streams)
  const status = createStatus(db, active_meta_streams, forward)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const peer_stream = jsonStream(new PassThrough())
  const metadata = { type: 'STATUS', user: 'chiefbiiko', status: '', tx }

  peer_stream.whoami = 'noop'
  active_meta_streams.add(peer_stream)

  db.put('chiefbiiko', { peers: [ 'noop' ], status: 'none' }, err => {
    if (err) t.end(err)

    meta_stream.once('data', res => {
      t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
      t.false(res.ok, 'response status not ok...')
      t.comment('...invalid schema')
      t.equal(res.tx, tx, 'transaction identifiers equal')
    })

    status(meta_stream, metadata, err => {
      t.true(err.message.startsWith('invalid schema'), 'invalid schema err')
      t.end()
    })
  })
})

tape('status - fail pt2', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
  const active_meta_streams = streamSet()

  const forward = createForward(active_meta_streams)
  const status = createStatus(db, active_meta_streams, forward)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const peer_stream = jsonStream(new PassThrough())
  const metadata = { type: 'STATUS', user: 'biiko', status: 'boss', tx }

  peer_stream.whoami = 'noop'
  active_meta_streams.add(peer_stream)

  db.put('chiefbiiko', { peers: [ 'noop' ], status: 'none' }, err => {
    if (err) t.end(err)

    meta_stream.once('data', res => {
      t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
      t.false(res.ok, 'response status not ok...')
      t.comment('...bc of a db error (notFound)')
      t.equal(res.tx, tx, 'transaction identifiers equal')
    })

    status(meta_stream, metadata, err => {
      t.ok(err.notFound, 'db triggered cb err not found')
      t.end()
    })
  })
})

tape('call - pass', t => {
  const active_meta_streams = streamSet()

  const forward = createForward(active_meta_streams)
  const call = createCall(forward)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const peer_stream = jsonStream(new PassThrough())
  const metadata = { type: 'CALL', user: 'chiefbiiko', peer: 'noop', tx }

  peer_stream.whoami = 'noop'
  active_meta_streams.add(peer_stream)

  var pending = 2

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.true(res.ok, 'response status ok')
    t.equal(res.tx, tx, 'transaction identifiers equal')
    if (!--pending) t.end()
  })

  peer_stream.once('data', notif => {
    t.same(notif, metadata, 'forwarded metadata to peer noop')
    t.equal(notif.tx, tx, 'transaction identifiers equal')
    if (!--pending) t.end()
  })

  call(meta_stream, metadata, err => {
    if (err) t.end(err)
  })
})

tape('call - fail pt1', t => {
  const active_meta_streams = streamSet()

  const forward = createForward(active_meta_streams)
  const call = createCall(forward)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'CALLING', user: 'chiefbiiko', peer: 'noop', tx }

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...invalid schema')
    t.equal(res.tx, tx, 'transaction identifiers equal')
  })

  call(meta_stream, metadata, err => {
    t.true(err.message.startsWith('invalid schema'), 'invalid schema err')
    t.end()
  })
})

tape('call - fail pt2', t => {
  const active_meta_streams = streamSet()

  const forward = createForward(active_meta_streams)
  const call = createCall(forward)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const peer_stream = jsonStream(new PassThrough())
  const metadata = { type: 'CALL', user: 'chiefbiiko', peer: 'poop', tx }

  peer_stream.whoami = 'noop'
  active_meta_streams.add(peer_stream)

  var pending = 2

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...bc of an inactive/unknown receiver')
    t.equal(res.tx, tx, 'transaction identifiers equal')
  })

  peer_stream.once('data', notif => {
    t.fail('should be unreachable')
  })

  call(meta_stream, metadata, err => {
    t.true(err.message.includes('can\'t forward'))
    t.end()
  })
})

tape('accept - pass', t => {
  const active_meta_streams = streamSet()

  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)

  const forward = createForward(active_meta_streams)
  const sendForceCall = createSendForceCall(active_meta_streams)
  const accept = createAccept(meta_server, forward, sendForceCall)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const peer_stream = jsonStream(new PassThrough())
  const metadata = { type: 'ACCEPT', user: 'chiefbiiko', peer: 'noop', tx }

  meta_stream.whoami = 'chiefbiiko'
  peer_stream.whoami = 'noop'
  active_meta_streams.add(meta_stream)
  active_meta_streams.add(peer_stream)

  var pending = 2

  meta_stream.on('data', msg => {
    switch (msg.type) {
      case 'FORCE_CALL':
        t.true(valid.schema_FORCE_CALL(msg), 'valid schema F 4 force-call msg')
        t.equal(msg.peer, 'noop', 'peer noop')
        break
      case 'RES':
        t.true(valid.schema_RESPONSE(msg), 'response is valid schema R')
        t.true(msg.ok, 'response status ok')
        t.equal(msg.tx, tx, 'transaction identifiers equal')
        if (!--pending) t.end()
        break
      default:
        t.fail('should be unreachable')
    }
  })

  peer_stream.on('data', notif => {
    switch (notif.type) {
      case 'FORCE_CALL':
        t.true(valid.schema_FORCE_CALL(notif), 'valid schema F 4 force-call msg')
        t.equal(notif.peer, 'chiefbiiko', 'peer chiefbiiko')
        break
      case 'ACCEPT':
        t.true(valid.schema_CALL_ACCEPT_REJECT(notif), 'response is valid schema C')
        t.equal(notif.tx, tx, 'transaction identifiers equal')
        if (!--pending) t.end()
        break
      default:
        t.fail('should be unreachable')
    }
  })

  meta_server.once('pair', (a, b) => {
    const peers = [ a, b ]
    t.true(peers.includes('chiefbiiko'), 'one peer')
    t.true(peers.includes('noop'), 'two peer')
  })

  accept(meta_stream, metadata, err => {
    if (err) t.end(err)
  })
})

tape('accept - fail pt1', t => {
  const active_meta_streams = streamSet()

  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)

  const forward = createForward(active_meta_streams)
  const sendForceCall = createSendForceCall(active_meta_streams)
  const accept = createAccept(meta_server, forward, sendForceCall)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const peer_stream = jsonStream(new PassThrough())
  const metadata = { type: 'ACCEPTING', user: 'chiefbiiko', peer: 'noop', tx }

  meta_stream.on('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...invalid schema')
    t.equal(res.tx, tx, 'transaction identifiers equal')
  })

  accept(meta_stream, metadata, err => {
    t.true(err.message.startsWith('invalid schema'), 'invalid schema err')
    t.end()
  })
})

tape('accept - fail pt2', t => {
  const active_meta_streams = streamSet()

  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)

  const forward = createForward(active_meta_streams)
  const sendForceCall = createSendForceCall(active_meta_streams)
  const accept = createAccept(meta_server, forward, sendForceCall)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'ACCEPT', user: 'chiefbiiko', peer: 'poop', tx }

  meta_stream.whoami = 'chiefbiiko'
  active_meta_streams.add(meta_stream)

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok')
    t.comment('...bc of an inactive/unknown receiver')
    t.equal(res.tx, tx, 'transaction identifiers equal')
  })

  accept(meta_stream, metadata, err => {
    t.true(err.message.includes('can\'t forward'))
    t.end()
  })
})

tape('reject - pass', t => {
  const active_meta_streams = streamSet()

  const forward = createForward(active_meta_streams)
  const reject = createReject(forward)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const peer_stream = jsonStream(new PassThrough())
  const metadata = { type: 'REJECT', user: 'chiefbiiko', peer: 'noop', tx }

  peer_stream.whoami = 'noop'
  active_meta_streams.add(peer_stream)

  var pending = 2

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.true(res.ok, 'response status ok')
    t.equal(res.tx, tx, 'transaction identifiers equal')
    if (!--pending) t.end()
  })

  peer_stream.once('data', notif => {
    t.same(notif, metadata, 'forwarded metadata to peer noop')
    t.equal(notif.tx, tx, 'transaction identifiers equal')
    if (!--pending) t.end()
  })

  reject(meta_stream, metadata, err => {
    if (err) t.end(err)
  })
})

tape('reject - fail pt1', t => {
  const active_meta_streams = streamSet()

  const forward = createForward(active_meta_streams)
  const reject = createReject(forward)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'CALLING', user: 'chiefbiiko', peer: 'noop', tx }

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...invalid schema')
    t.equal(res.tx, tx, 'transaction identifiers equal')
  })

  reject(meta_stream, metadata, err => {
    t.true(err.message.startsWith('invalid schema'), 'invalid schema err')
    t.end()
  })
})

tape('reject - fail pt2', t => {
  const active_meta_streams = streamSet()

  const forward = createForward(active_meta_streams)
  const reject = createReject(forward)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const peer_stream = jsonStream(new PassThrough())
  const metadata = { type: 'CALL', user: 'chiefbiiko', peer: 'poop', tx }

  peer_stream.whoami = 'noop'
  active_meta_streams.add(peer_stream)

  var pending = 2

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...bc of an inactive/unknown receiver')
    t.equal(res.tx, tx, 'transaction identifiers equal')
  })

  peer_stream.once('data', notif => {
    t.fail('should be unreachable')
  })

  reject(meta_stream, metadata, err => {
    t.true(err.message.includes('can\'t forward'))
    t.end()
  })
})

tape('getPeers - pass', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))

  const getPeers = createGetPeers(db)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'GET_PEERS', user: 'chiefbiiko', tx }

  db.put('chiefbiiko', { peers: [ 'noop', 'og' ], status: 'offline' }, err => {
    if (err) t.end(err)
    db.put('noop', { peers: [], status: 'online' }, err => {
      if (err) t.end(err)
      db.put('og', { peers: [], status: 'busy' }, err => {
        if (err) t.end(err)

        const expected = [
          { peer: 'noop', status: 'online' },
          { peer: 'og', status: 'busy' }
        ]

        meta_stream.once('data', res => {
          t.true(valid.schema_RESPONSE_PEERS(res), 'response is valid schema RP')
          t.true(res.ok, 'response status ok')
          t.true(Array.isArray(res.peers), 'peer array')
          t.same(res.peers, expected, 'peer n status')
          t.equal(res.tx, tx, 'transaction identifiers equal')
          t.end()
        })

        getPeers(meta_stream, metadata, err => {
          if (err) t.end(err)
        })
      })
    })
  })
})

tape('getPeers - fail pt1', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))

  const getPeers = createGetPeers(db)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'GET_PEERS', username: 'chiefbiiko', tx }

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...invalid schema')
    t.equal(res.tx, tx, 'transaction identifiers equal')
  })

  getPeers(meta_stream, metadata, err => {
    t.true(err.message.startsWith('invalid schema'), 'invalid schema err')
    t.end()
  })
})

tape('getPeers - fail pt2', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))

  const getPeers = createGetPeers(db)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'GET_PEERS', user: 'chiefbiiko', tx }

  meta_stream.once('data', res => {
    t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
    t.false(res.ok, 'response status not ok...')
    t.comment('...bc of a db error (notFound)')
    t.equal(res.tx, tx, 'transaction identifiers equal')
  })

  getPeers(meta_stream, metadata, err => {
    t.ok(err.notFound, 'db triggered cb err not found')
    t.end()
  })
})

tape('getPeers - fail pt3', t => {
  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))

  const getPeers = createGetPeers(db)

  const tx = Math.random()
  const meta_stream = jsonStream(new PassThrough())
  const metadata = { type: 'GET_PEERS', user: 'chiefbiiko', tx }

  db.put('chiefbiiko', { peers: [ 'noop', 'og' ], status: 'offline' }, err => {
    if (err) t.end(err)
    db.put('noop', { peers: [], status: 'online' }, err => {
      if (err) t.end(err)
      db.put('og_maco', { peers: [], status: 'busy' }, err => {
        if (err) t.end(err)

        const expected = [
          { peer: 'noop', status: 'online' },
          { peer: 'og', status: 'busy' }
        ]

        meta_stream.once('data', res => {
          t.true(valid.schema_RESPONSE(res), 'response is valid schema R')
          t.false(res.ok, 'response status not ok...')
          t.comment('...bc of a db error (notFound)')
          t.equal(res.tx, tx, 'transaction identifiers equal')
        })

        getPeers(meta_stream, metadata, err => {
          t.ok(err.notFound, 'db triggered cb err not found')
          t.end()
        })
      })
    })
  })
})

tape('handlePair - pass', t => {
  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)
  const media_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)
  const http_server = createServer()

  const active_media_streams = hashtagStreamSet(willDeleteMediastreams)

  const handlePair = createHandlePair(media_server, active_media_streams)

  const a = 'chiefbiiko'
  const b = 'noop'
  const a_info = JSON.stringify({ user: a, peer: b })
  const b_info = JSON.stringify({ user: b, peer: a })

  const a_ws = websocket('ws://localhost:10000/media')
  const b_ws = websocket('ws://localhost:10000/media')

  const shutdown = () => {
    a_ws.destroy()
    b_ws.destroy()
    http_server.close(t.end)
  }

  var pending = 2

  a_ws.on('error', t.end)
  b_ws.on('error', t.end)

  a_ws.on('data', chunk => {
    t.equal(chunk.toString(), 'noop', 'chiefbiiko got peer data')
    if (!--pending) shutdown()
  })

  b_ws.on('data', chunk => {
    t.equal(chunk.toString(), 'chiefbiiko', 'noop got peer data')
    if (!--pending) shutdown()
  })

  http_server.on('upgrade', createHandleUpgrade(meta_server, media_server))
  http_server.listen(10000, 'localhost')

  handlePair(a, b)

  a_ws.write(a_info, err => {
    if (err) t.end(err)
    a_ws.write('chiefbiiko', err => err && t.end(err))
  })

  b_ws.write(b_info, err => {
    if (err) t.end(err)
    b_ws.write('noop', err => err && t.end(err))
  })
})

tape('handlePair - fail pt1 - invalid schema', t => {
  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)
  const media_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)
  const http_server = createServer()

  const active_media_streams = hashtagStreamSet(willDeleteMediastreams)

  const handlePair = createHandlePair(media_server, active_media_streams)

  const a = 'chiefbiiko'
  const b = 'noop'
  const a_info = JSON.stringify({ username: a, peer: b })
  const b_info = JSON.stringify({ user: b, peername: a })

  const a_ws = websocket('ws://localhost:10000/media')
  const b_ws = websocket('ws://localhost:10000/media')

  a_ws.on('error', t.end)
  b_ws.on('error', t.end)

  a_ws.on('data', chunk => t.fail('should be unreachable'))
  b_ws.on('data', chunk => t.fail('should be unreachable'))

  http_server.on('upgrade', createHandleUpgrade(meta_server, media_server))
  http_server.listen(10000, 'localhost')

  handlePair(a, b)

  setTimeout(() => {
    t.pass('did not get any unintended fails so far')
    a_ws.destroy()
    b_ws.destroy()
    http_server.close(t.end)
  }, 500)

  a_ws.write(a_info, err => err && t.end(err))
  b_ws.write(b_info, err => err && t.end(err))
})

tape('handlePair - fail pt2 - no pair', t => {
  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)
  const media_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)
  const http_server = createServer()

  const active_media_streams = hashtagStreamSet(willDeleteMediastreams)

  const handlePair = createHandlePair(media_server, active_media_streams)

  const a = 'chiefbiiko'
  const b = 'noop'
  const a_info = JSON.stringify({ user: a, peer: b })
  const b_info = JSON.stringify({ user: b, peer: a })

  const a_ws = websocket('ws://localhost:10000/media')
  const b_ws = websocket('ws://localhost:10000/media')

  a_ws.on('error', t.end)
  b_ws.on('error', t.end)

  a_ws.on('data', chunk => t.fail('should be unreachable'))
  b_ws.on('data', chunk => t.fail('should be unreachable'))

  http_server.on('upgrade', createHandleUpgrade(meta_server, media_server))
  http_server.listen(10000, 'localhost')

  handlePair(a, 'oj pic')

  setTimeout(() => {
    t.pass('did not get any unintended fails so far')
    a_ws.destroy()
    b_ws.destroy()
    http_server.close(t.end)
  }, 500)

  a_ws.write(a_info, err => err && t.end(err))
  b_ws.write(b_info, err => err && t.end(err))
})

tape('unpair - pass', t => {
  t.comment('this test case establishes a media con between 2 peers, ' +
            'with one of them sending an unpair msg after some data has ' +
            'been exchanged. after an ok response for the unpair msg no more' +
            'data should become readable on any of the websockets...')

  const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
  const active_meta_streams = streamSet()
  const active_media_streams = hashtagStreamSet(willDeleteMediastreams)
  const logged_in_users = new Set()

  const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
  const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)
  const media_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)
  const http_server = createServer()

  const forward = createForward(active_meta_streams)
  const sendForceCall = createSendForceCall(active_meta_streams)

  const handlePair = createHandlePair(media_server, active_media_streams)
  const handleMetadata = createHandleMetadata({
    metaWhoami: createMetaWhoami(active_meta_streams),
    registerUser: createRegisterUser(db),
    addPeers: createAddPeers(db),
    deletePeers: createDeletePeers(db),
    getPeers: createGetPeers(db),
    login: createLogin(db, logged_in_users),
    logout: createLogout(logged_in_users),
    status: createStatus(db, active_meta_streams, forward),
    call: createCall(forward),
    accept: createAccept(meta_server, forward, sendForceCall),
    reject: createReject(forward),
    unpair: createUnpair(active_media_streams)
  }, logged_in_users)

  http_server.on('upgrade', createHandleUpgrade(meta_server, media_server))
  http_server.listen(10000, 'localhost')

  const a = 'chiefbiiko'
  const b = 'noop'
  const a_info = JSON.stringify({ user: a, peer: b })
  const b_info = JSON.stringify({ user: b, peer: a })

  const a_ws = websocket('ws://localhost:10000/media')
  const b_ws = websocket('ws://localhost:10000/media')

  const done = () => {
    const meta_stream = jsonStream(new PassThrough())

    const WHOAMI_MSG = {
      type: 'WHOAMI',
      user: 'chiefbiiko',
      tx: Math.random()
    }
    const LOGIN_MSG = {
      type: 'LOGIN',
      user: 'chiefbiiko',
      password: 'abc',
      tx: Math.random()
    }

    const tx = Math.random()
    const UNPAIR_MSG = {
      type: 'UNPAIR',
      user: 'chiefbiiko',
      peer: 'noop',
      tx
    }

    meta_stream.on('data', res => {
      switch (res.for)  {
        case 'WHOAMI':
          t.true(valid.schema_RESPONSE(res), 'res is valid schema RESPONSE')
          t.true(res.ok, 'res status ok')
          break
        case 'LOGIN':
          t.true(valid.schema_RESPONSE(res), 'res is valid schema RESPONSE')
          t.true(res.ok, 'res status ok')
          break
        case 'UNPAIR':
          t.true(valid.schema_RESPONSE(res), 'res is valid schema RESPONSE')
          t.true(res.ok, 'res status ok')
          t.equal(res.tx, tx, 'transaction identifiers equal')
          a_ws.on('data', _ => t.fail('media_stream unstopped'))
          b_ws.on('data', _ => t.fail('media_stream unstopped'))
          setTimeout(() => {
            http_server.close()
            t.end()
          }, 750)
          break
        default: t.fail('should be unreachable')
      }
    })

    handleMetadata(meta_stream, WHOAMI_MSG)
    setTimeout(() => {
      handleMetadata(meta_stream, LOGIN_MSG)
      setTimeout(() => {
        handleMetadata(meta_stream, UNPAIR_MSG)
      }, 250)
    }, 250)
  }

  db.put('chiefbiiko', { password: 'abc', peers: [], status: 'busy' }, err => {
    if (err) t.end(err)

    var data_pending = 10
    var a_interval, b_interval

    a_ws.once('error', err => {
      clearInterval(a_interval)
      clearInterval(b_interval)
      t.equal(err.message, 'write after end', 'write after end err')
      a_ws.on('error', t.end)
    })

    b_ws.once('error', err => {
      clearInterval(a_interval)
      clearInterval(b_interval)
      t.equal(err.message, 'write after end', 'write after end err')
      b_ws.on('error', t.end)
    })

    a_ws.on('data', chunk => {
      t.equal(chunk.toString(), 'noop', 'chiefbiiko got peer data')
      if (!--data_pending) done()
    })

    b_ws.on('data', chunk => {
      t.equal(chunk.toString(), 'chiefbiiko', 'noop got peer data')
      if (!--data_pending) done()
    })

    handlePair(a, b)

    a_ws.write(a_info, err => {
      if (err) t.end(err)
      a_interval = setInterval(() => a_ws.write('chiefbiiko'), 250).unref()
    })

    b_ws.write(b_info, err => {
      if (err) t.end(err)
      b_interval = setInterval(() => b_ws.write('noop'), 250).unref()
    })
  })
})

tape('willDeleteMediastreams', t => {
  const fading_streams = [ new PassThrough(), new PassThrough() ]
  willDeleteMediastreams('#alice-bob', fading_streams, () => {
    t.true(fading_streams.every(stream => stream.destroyed), 'streams dead')
    t.end()
  })
})

/* TODO:
  + write tests for all remaining handlers (./lib/handlers/*)
  + keep test coverage high -> test metadata validation if blocks,
    run into db errors where possible; fx: trigger a notFound err
  + do not share instances across test cases; see above
  + add comments to responses that are not ok
  + remove unused variables if you find some
  + ...

  @Balou: you can start by testing ./lib/handlers::registerUser|addPeers|deletePeers
  @Biiko: test all remaining handlers
*/
