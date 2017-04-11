const fs = require('fs')
const restify = require('restify')
const thenifyAll = require('thenify-all')
const redis = require('redis')
const ENV = require('./.env')

const server = restify.createServer({
  certificate: fs.readFileSync(ENV.CERT),
  key: fs.readFileSync(ENV.KEY),
  name: 'Quotes'
})

const r = redis.createClient()

server.use(restify.queryParser())
server.use(restify.gzipResponse())
server.use(restify.bodyParser())

server.get('/quotes', getQuotes)
server.post('/quotes', postQuote)

server.listen(8080)

function getQuotes (req, res, next) {
  r.lrange('quotes', 0, -1, (err, ids) => {
    if (err) return console.error(err)

    Promise
      .all(ids.map(toPromiseOfQuote))
      .then(values => res.end(JSON.stringify(values)))
      .catch(redis.print)
  })
  
  next()
}

function toPromiseOfQuote (id) {
  return new Promise((resolve, reject) => {
    r.hgetall(`quote:${id}`, (err, res) => {
      if (err) return reject(err)
      resolve(res)
    })
  })
}

function postQuote (req, res, next) {
  const {body, author} = req.body
  const invalid = (!body || !author)

  if (invalid) {
    return res.end(400)
  }

  const time = Date.now()

  r.incr('next_quote_id', (err, nextId) => {
    r.lpush('quotes', nextId)
    r.hmset(`quote:${nextId}`, [
      'time', time, 
      'body', body, 
      'author', author
    ])
  })

  next()
}