'use strict'

let a = (cb) => {
  console.log('l', cb.length)
  return cb(null, [1, 2])
}

a((err, [res, failed]) => {
  console.log(res)
})