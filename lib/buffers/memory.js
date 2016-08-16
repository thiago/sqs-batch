'use strict'

const EventEmitter = require('events')

class Memory extends EventEmitter {
  constructor (options) {
    super()

    this.bufferSize = options.bufferSize
    this.bufferTimeout = options.bufferTimeout

    this.items = []
    this.timerId = null
  }

  _flush () {
    this._stopTimer()
    this.emit('flush', this.items)
    this.items = []
  }

  add (messages) {
    const currentSize = this.items.length

    if (Array.isArray(messages)) {
      const possibleSize = currentSize + messages.length

      // exceeded size
      if (possibleSize > this.bufferSize) {
        const available = this.bufferSize - currentSize
        const sliced = messages.slice(0, available)
        const remaining = messages.slice(available)

        Array.prototype.push.apply(this.items, sliced)
        this._flush()
        return this.add(remaining)
      }

      // completed size
      else if (possibleSize === this.bufferSize) {
        Array.prototype.push.apply(this.items, messages)
        this._flush()
      }

      // incomplete size
      else {
        this._startTimer()
        Array.prototype.push.apply(this.items, messages)
      }
    }
  }

  _startTimer () {
    if (!this.timerId) {
      this.timerId = setTimeout(this._flush, this.bufferTimeout)
    }
  }

  _stopTimer () {
    if (this.timerId) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }
}

module.exports = Memory
