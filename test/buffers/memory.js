/* eslint-env mocha */
'use strict'

const expect = require('code').expect

const MB = require('../../lib/buffers/memory')

describe('Memory Buffer', () => {
  // -== CONSTRUCTOR OPTIONS START ==- //
  describe('Constructor', () => {
    it('- missing options', () => {
      try {
        new MB()
      } catch (e) {
        expect(e).to.be.an.error(Error, 'Missing required options')
      }
    })

    it('- missing [bufferSize]', () => {
      try {
        new MB({ bufferTimeout: 1 })
      } catch (e) {
        expect(e).to.be.an.error(Error, /bufferSize/)
      }
    })

    it('- missing [bufferTimeout]', () => {
      try {
        new MB({ bufferSize: 100 })
      } catch (e) {
        expect(e).to.be.an.error(Error, /bufferTimeout/)
      }
    })
  })
  // -== CONSTRUCTOR OPTIONS END ==- //

  // -== ARRAY ITEMS START ==- //
  describe('Array Items', () => {
    it('- [bufferSize] reached', (done) => {
      let [ bufferSize, bufferTimeout ] = [ 100, 1000 ]
      const MemoryBuffer = new MB({ bufferSize, bufferTimeout })

      MemoryBuffer.on('flush', (array) => {
        expect(array).to.have.length(bufferSize)
        done()
      })

      MemoryBuffer.add(new Array(bufferSize).fill(1))
    })

    it('- [bufferTimeout] expired', (done) => {
      let [ bufferSize, bufferTimeout ] = [ 100, 1000 ]
      const MemoryBuffer = new MB({ bufferSize, bufferTimeout })

      MemoryBuffer.on('flush', (array) => {
        expect(array).to.have.length(1)
        done()
      })

      MemoryBuffer.add(new Array(1).fill(1))
    })

    it('- [bufferSize] exceeded: multiple add()\'s', (done) => {
      let [ bufferSize, bufferTimeout ] = [ 100, 500 ]
      const [ firstChunk, secondChunk ] = [ 70, 40 ]
      const MemoryBuffer = new MB({ bufferSize, bufferTimeout })

      let firings = 0
      MemoryBuffer.on('flush', (array) => {
        firings++
        if (firings === 1) {
          expect(array).to.have.length(bufferSize)
        } else if (firings === 2) {
          expect(array).to.have.length((firstChunk + secondChunk) - bufferSize)
          done()
        }
      })

      MemoryBuffer.add(new Array(firstChunk).fill(1))
      MemoryBuffer.add(new Array(secondChunk).fill(1))
    })
  })
  // -== ARRAY ITEMS END ==- //

  // -== SINGLE ITEMS START ==- //
  describe('Single Items', () => {
    it('- [bufferSize] reached', (done) => {
      let [ bufferSize, bufferTimeout ] = [ 10, 1000 ]
      const MemoryBuffer = new MB({ bufferSize, bufferTimeout })

      MemoryBuffer.on('flush', (array) => {
        expect(array).to.have.length(bufferSize)
        done()
      })

      for (let item of new Array(bufferSize)) {
        MemoryBuffer.add(item)
      }
    })

    it('- [bufferTimeout] expired', (done) => {
      let [ bufferSize, bufferTimeout ] = [ 10, 1000 ]
      const MemoryBuffer = new MB({ bufferSize, bufferTimeout })

      MemoryBuffer.on('flush', (array) => {
        expect(array).to.have.length(1)
        done()
      })

      for (let item of new Array(1)) {
        MemoryBuffer.add(item)
      }
    })
  })
  // -== SINGLE ITEMS END ==- //

})

