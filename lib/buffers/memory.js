'use strict'

const EventEmitter = require('events')
const Debug = require('debug')('sqs-buffer')

const REQUIRED_OPTS = [
  'bufferSize',
  'bufferTimeout'
]

class Memory extends EventEmitter {
  constructor (options) {
    super()
    this.constructor._validate(options)

    this.bufferSize = options.bufferSize
    this.bufferTimeout = options.bufferTimeout

    this.items = []
    this.timerId = null

    this._flushBound = this._flush.bind(this)
  }

  /**
   * Validate Buffer options
   * @param options
   * @private
   */
  static _validate (options) {
    if (!options) throw new Error('Missing required options')

    REQUIRED_OPTS.forEach(option => {
      if (!options[option]) {
        throw new Error(`Missing required option [${option}].`)
      }
    })
  }

  /**
   * Start timer
   * @private
   */
  _startTimer () {
    Debug(`Buffer start timer for [${this.bufferTimeout/1000}] seconds`)
    if (!this.timerId) {
      this.timerId = setTimeout(this._flushBound, this.bufferTimeout)
    }
  }

  /**
   * Stop timer
   * @private
   */
  _stopTimer () {
    if (this.timerId) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  /**
   * Fire flush event and reset buffer
   * @private
   */
  _flush () {
    Debug('Buffer flush ...')
    this._stopTimer()
    this.emit('flush', this.items)
    this.items = []
  }

  /**
   * Add items into the buffer
   * @param {(*[]|*)} item - An item or an array of items
   * @returns {*}
   */
  add (item) {
    Debug(`Buffer add [${item.length}] messages ...`)
    const currentSize = this.items.length

    if (Array.isArray(item)) {
      const possibleSize = currentSize + item.length

      // exceeded size
      if (possibleSize > this.bufferSize) {
        const available = this.bufferSize - currentSize
        const sliced = item.slice(0, available)
        const remaining = item.slice(available)

        Array.prototype.push.apply(this.items, sliced)
        this._flush()
        return this.add(remaining)
      }

      // completed size
      else if (possibleSize === this.bufferSize) {
        Array.prototype.push.apply(this.items, item)
        this._flush()
      }

      // incomplete size
      else {
        this._startTimer()
        Array.prototype.push.apply(this.items, item)
      }
    } else {
      this.items.push(item)

      // completed size
      if (this.items.length === this.bufferSize) {
        this._flush()
      }

      // incomplete size
      else {
        this._startTimer()
      }
    }
  }
}

module.exports = Memory
