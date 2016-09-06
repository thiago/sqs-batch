# sqs-batch

An AWS.SQS wrapper that let's you build queue-based applications easier. It has a built-in memory buffer to extend the *10* batch limit.
   
## Installation
```
npm install sqs-buffer
```

## Usage
```js
const Receiver = require('sqs-buffer')

const worker = new Receiver({
  queueUrl: '...',
  messageReceiver: (messages, done) => {
    // process message(s)
    done(messages)
  }
})

worker.start()
```

- By default the queue will be polled one message at a time using [sqs long polling](http://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-long-polling.html).
- In order to process multiple messages either specify `batchSize` and/or `bufferSize` options explained [below](#options)
- The `message` parameter in the `messageReceiver` callback contains an array of messages even if there's only one message polled.
- If no `bufferSize` specified then the next polling will be made after the current one is process and acknowledged by calling `done(messages)`.
- Calling `done(err)` with an error will leave the message in the queue and the `processing:error` event will be fired. See [events](#events) below.
- In order to delete a message form the queue after it has been processed, call `done(messages)` where `messages` can be either one message or an array of messages.

### Credentials

By default it uses the *Environment Variables* credentials as specified [here](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html#Credentials_from_Environment_Variables). In order to specify them manually you can do:
```js
const AWS = require('aws-sdk')
const Receiver = require('sqs-buffer')

const SQS = new AWS.SQS({
  region: 'eu-west-1',
  accessKeyId: '...',
  secretAccessKey: '...'
})

const worker = new Receiver({
  queueUrl: '...',
  sqs: SQS,
  messageReceiver: (messages, done) => {
    // ...
    done(messages)
  }
})

worker.start()
```

## API

### `new Receiver(options)`
Creates a new SQS receiver instance
 
#### options
- `queueUrl` - _String_ - *REQUIRED* - SQS queue URL
- `messageReceiver` - _Function_ - *REQUIRED* - A callback function to be called when a message is received or the buffer is flushed. (`messageReceiver(messages, done)`).
- `batchSize` - _Number_ - (default `1`) - The number of messages to poll from SQS. Max. `10`.
- `waitTimeSeconds` - _Number_ - The duration (in seconds) for which the call will wait for a message to arrive in the queue before returning [reference](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#receiveMessage-property).
- `visibilityTimeout` - _Number_ - The duration (in seconds) that the received messages are hidden from subsequent retrieve requests after being retrieved by a ReceiveMessage request [reference](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#receiveMessage-property).
- `attributeNames` - _Array_ - A list of attributes that need to be returned along with each message [reference](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#receiveMessage-property).
- `messageAttributeNames` - _Array_ - A list of message attributes to include in the response [reference](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#receiveMessage-property).
- `authenticationErrorTimeout` - _Number_ - (default `10000`) - The duration (in milliseconds) to wait before making another request after an authentication error. 
- `bufferSize` - _Number_ - The number of messages to be placed in buffer before processing. Should be greater than `batchSize`.
- `bufferTimeout` - _Number_ - The duration (in milliseconds) to wait before the buffer is flushed.
- `sqs` - _Object_ - An `AWS.SQS` instance in case you want to configure it's options manually.
- `buffer` - _Object_ - (default `memory`) - A class instance used to store the buffer into. More info [bellow](#buffer) 
 
### `receiver.start()`
Start message polling

### `receiver.stop()`
Stop message polling

### Events

|Event|Params|Description|
|-----|------|-----------|
|`error`|`err`|Fired when a request error occurs|
|`message:received`|`message`|Fired when new message(s) received|
|`processing:error`|`err`|Fired when you call `don(error)`|
|`message:processed`|`message`|Fired when the message(s) is/are processed|
|`stopped`|None|Fired when receiver is stopped|


## Buffer
The buffer is used to temporarily store SQS messages in order to be later processed in batches larger than the Amazon's `10` messages per batch limit. 
The buffer fires a `flush` event wich is then captured by the `Receiver` and then proxied to the `messageReceiver(messages, done)` callback.
The `flush` event is fired either on `bufferTimeout` or `bufferSize` reached.

### API

#### `new Buffer(options)`
Creates a new buffer instance

#### options
- `bufferSize` - _Number_ - Buffer size.
- `bufferTimeout` - _Number_ - The duration (in milliseconds) after which the buffer will flush.

#### `Buffer.add(messages)`
- `messages` - _*|*[]_ - The data type of each item is constrained by Amazon SQS. It can be a single item or an array of items.

#### Events
|Event|Params|Description|
|-----|------|-----------|
|`flush`|`messages`|Fired with either `bufferSize` is full or `bufferTimeout` reached.|

## Custom Buffer
In order to use your own custom buffer (redis, mongo etc.) you would need to implement two things:
1. Have a `Buffer.add(messages)` method that stores messages into the buffer
2. Fire a `flush` event when the buffer is full or timer completed.

*Your custom buffer*
```js
class MyBuffer extends EventEmitter {
    constructor (options) {
        super()
        // constructor
        
        this.buffer = []
    }
    
    add (messages) {
        // add messages into this.buffer
        
        // on bufferSize reached
        this.emit('flush', this.buffer)
        
        // on bufferTimeout
        this.emit('flush', this.buffer)
    }
}
```

```js
const worker = new Receiver({
  queueUrl: '...',
  buffer: new MyBuffer(options),
  messageReceiver: (messages, done) => {
    // will be called once buffer is filled or timed out.
    done(messages)
  }
})

worker.start()
```

## Licence

MIT Licence
© Copyright 2016 C8 MANAGEMENT LIMITED