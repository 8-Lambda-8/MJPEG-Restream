const http = require('http');
const { EventEmitter } = require('events');
var request = require("request");
var MjpegConsumer = require("mjpeg-consumer");

let globalBuffer;
const emitter = new EventEmitter();
let lastFrameTimestamp = 0;

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Cache-Control': 'no-store, no-cache, must-revalidate, pre-check=0, post-check=0, max-age=0',
        Pragma: 'no-cache',
        Connection: 'close',
        'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary'
    });

    const writeFrame = () => {
        res.write(`--myboundary\nContent-Type: image/jpg\nContent-length: ${globalBuffer.length}\n\n`);
        res.write(globalBuffer);
    };

    writeFrame();
    emitter.addListener('frame', writeFrame);
    res.addListener('close', () => {
        emitter.removeListener('frame', writeFrame);
    });
});
server.listen(8083);

function newFrame(buffer) {
    globalBuffer = buffer;
    emitter.emit('frame');
    lastFrameTimestamp = Date.now();
}

let consumer = new MjpegConsumer();

let req = request("http://10.0.1.18:81/stream");
req.pipe(consumer).on('data', (frame) => newFrame(frame));

setInterval(() => {
    console.log(lastFrameTimestamp);
    if (lastFrameTimestamp+1000 < Date.now()) {
        console.log("last Frame older 2 sec");
        console.log("try Reconnect");
        req.abort();
        this.connection = null;
        req = request("http://10.0.1.18:81/stream");

        req.on('error', err=> console.log(err));
        
        consumer = new MjpegConsumer();
        req.pipe(consumer).on('data', (frame) => newFrame(frame));
        
    }
}, 2000);