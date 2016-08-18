# sqs-buffer

An AWS.SQS wrapper that let's you build queue-based applications easier. It has a built-in memory buffer to extend the *10* batch limit.
   
## Installation
```
npm install sqs-buffer
```

## Usage
```
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
- Calling `done(err)` with an error will leave the message in the queue and the `processing:error` event will be fired. See (events)[#events] below.
- In order to delete a message form the queue after it has been processed, call `done(messages)` where `messages` can be either one message or an array of messages.

### Credentials

By default it uses the *Environment Variables* credentials as specified (here)[http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html#Credentials_from_Environment_Variables]. In order to specify them manually you can do:
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
- `waitTimeSeconds` - _Number_ - 
- `visibilityTimeout` - _Number_ -
- `attributeNames` - _Array_ -
- `messageAttributeNames` - _Array_ - 
- `authenticationErrorTimeout` - _Number_ - 
- `bufferSize` - _Number_ - 
- `bufferTimeout` - _Number_ -
- `sqs` - _Object_ -
- `buffer` - _Object_ -
 
### `receiver.start()`
Start message polling

### `receiver.stop()`
Stop message polling

### Events

|Event|Params|Description|
|-----|------|-----------|
|`error`|`err`|Fired when a request error occurs|
|`message:received`|`message`|...|
|`processing:error`|`err`|...|
|`message:processed`|`message`|...|
|`stopped`|None|...|