/*
  # dev agenda

  + a metadataserver that emits 'pair' and 'unpair' events
  + a mediadataserver that dis/connects peers according to the events above
  + a simple client api

  app has 3 data layers:
  + dynamic mediadata
  + dynamic metadata
  + static user data
*/

const { createServer } = require('http')
const { parse } = require('url')

const WebSocketServer = require('websocket-stream').Server
const streamSet = require('stream-set')

const levelup = require('levelup')
const memdown = require('memdown')
const enc = require('encoding-down')

const outbound = require('./lib/outbound.js')
const valid = require('./lib/valid.js')

const { isTruthyString } = require('./lib/is.js')
const { createForward, createSendForceCall } = require('./lib/notify.js')

const {
  createMetaWhoami,
  createLogin,
  createLogoff,
  createStatus,
  createCall,
  createAccept,
  createReject,
  createRegisterUser,
  createAddPeers,
  createDeletePeers,
  createPeers
} = require('./lib/handlers.js')

const debug = require('debug')('user-media-plug:index')

const PORT = process.env.PORT || 10000
const HOST = process.env.HOST || 'localhost'

const db = levelup(enc(memdown('./users.db'), { valueEncoding: 'json' }))
const active_meta_streams = streamSet()
const active_media_streams = streamSet()
const online_users = new Set()
const logged_in_users = new Set()

const http_server = createServer()
const WEBSOCKET_SERVER_OPTS = { perMessageDeflate: false, noServer: true }
const meta_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)
const media_server = new WebSocketServer(WEBSOCKET_SERVER_OPTS)

const forward = createForward(active_meta_streams)
const sendForceCall = createSendForceCall(active_meta_streams)

const metaWhoami = createMetaWhoami(active_meta_streams)
const login = createLogin(db, online_users, logged_in_users)
const logoff = createLogoff(db, online_users, logged_in_users)
const registerUser = createRegisterUser(db)
const addPeers = createAddPeers(db)
const deletePeers = createDeletePeers(db)
const status = createStatus(db, online_users, active_meta_streams, forward)
const call = createCall(online_users, forward)
const accept = createAccept(meta_server, forward, sendForceCall)
const reject = createReject(forward)
const peers = createPeers(db, online_users)

const handleError = err => err && debug(`unhandled error: ${err.message}`)

const _handleUpgrade = (websocket_server, req, socket, head) => {
  websocket_server.handleUpgrade(req, socket, head, ws => {
    websocket_server.emit('connection', ws, req)
  })
}

const handleUpgrade = (req, socket, head) => {
  debug('::handleUpgrade::')
  switch (parse(req.url).pathname) {
    case '/meta': _handleUpgrade(meta_server, req, socket, head); break
    case '/media': _handleUpgrade(media_server, req, socket, head); break
    default:
      debug(`invalid path on req.url: ${req.url}`)
      socket.destroy()
  }
}

function handleMetadata (data) { // this === websocket meta_stream
  debug(`handleMetadata data: ${data}`)
  var metadata
  try {
    metadata = JSON.parse(data)
  } catch (err) {
    return handleError(err)
  }

  if (!isTruthyString(this.whoami) && metadata.type !== 'whoami') {
    this.write(outbound.res(metadata.type, metadata.tx, false))
    return debug('ignoring metadata from unidentified stream')
  } else if (metadata.type !== 'whoami' && metadata.user !== this.whoami) {
    this.write(outbound.res(metadata.type, metadata.tx, false))
    return debug(`ignoring metadata due to inconsistent user identifier; ` +
                 `metadata.user: ${JSON.stringify(metadata.user)}; ` +
                 `meta_stream.whoami: ${JSON.stringify(this.whoami)}`)
  } else if (![ 'reg-user', 'whoami', 'login' ].includes(metadata.type) &&
             !logged_in_users.has(metadata.user)) {
    this.write(outbound.res(metadata.type, metadata.tx, false))
    return debug(`ignoring metadata bc ${metadata.user} is not logged in; ` +
                 `metadata: ${JSON.stringify(metadata)}`)
  }

  switch (metadata.type) {
    case 'whoami': metaWhoami(metadata, this, handleError); break
    case 'login': login(metadata, this, cb); break
    case 'logoff': logoff(metadata, this, cb); break
    case 'reg-user': registerUser(metadata, this, handleError); break
    case 'add-peers': addPeers(metadata, this, handleError); break
    case 'del-peers': deletePeers(metadata, this, handleError); break
    case 'status': status(metadata, this, handleError); break
    case 'call': call(metadata, this, handleError); break
    case 'accept': accept(metadata, this, handleError); break
    case 'reject': reject(metadata, this, handleError); break
    case 'peers': peers(metadata, this, handleError); break
    case 'peers-online': peers(metadata, this, handleError); break
    default: debug(`invalid metadata.type: ${metadata.type}`)
  }
}

meta_server.on('pair', (a, b) => debug('pair:', a, b))

meta_server.on('stream', (meta_stream, req) => {
  debug('::meta_server.on("stream")::')
  meta_stream.on('data', handleMetadata)
  meta_stream.on('error', handleError)
})

media_server.on('stream', (stream, req) => {
  debug('::media_server.on("stream")::')
  // ...
})

http_server.on('upgrade', handleUpgrade)

http_server.on('error', handleError)
meta_server.on('error', handleError)
media_server.on('error', handleError)

http_server.on('listening', () => debug(`http_server live @ ${HOST}:${PORT}`))
http_server.listen(PORT, HOST)
