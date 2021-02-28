const http = require('http');
const { EventEmitter } = require('events');
const request = require("request");
const MjpegConsumer = require("mjpeg-consumer");
const { Image, createCanvas } = require("canvas");
const sizeOf = require('buffer-image-size');
const fs = require("fs");
const dateFormat = require("dateformat");
dateFormat.masks.default = "dd.mm.yy HH:MM:ss"

let globalBuffer;
const emitter = new EventEmitter();
let lastFrameTimestamp = 0;

fs.readFile('init.jpeg', (err, buf) => {
    if (err) throw err
    globalBuffer = buf;
});

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

function connectionLostFrame(buffer) {
    console.log("sending connectionLostFrame")
    var dimensions = sizeOf(buffer);
    const canvas = createCanvas(dimensions.width, dimensions.height);
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.onerror = err => { throw err };
    img.src = globalBuffer;

    ctx.fillStyle = "#222222";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height / 8);
    ctx.fillStyle = "#f2f2f2";
    ctx.font = "16px Arial";
    ctx.fillText("Connection to Camera lost", 13, 20);
    ctx.fillText("Last Frame: " + dateFormat(lastFrameTimestamp), 13, 45);

    buffer = canvas.toBuffer("image/jpeg");
    emitter.emit('frame');

    globalBuffer = buffer;
}

let consumer = new MjpegConsumer();

let req = request("http://10.0.1.18:81/stream");
req.pipe(consumer).on('data', (frame) => newFrame(frame));

setInterval(() => {
    console.log(lastFrameTimestamp);

    if (lastFrameTimestamp + 2000 < Date.now()) {
        console.log("last Frame older 2 sec");
        console.log("try Reconnect");
        req.abort();
        this.connection = null;
        req = request("http://10.0.1.18:81/stream");

        req.on('error', err => console.log(err));

        consumer = new MjpegConsumer();
        req.pipe(consumer).on('data', (frame) => newFrame(frame));
    }

    if (lastFrameTimestamp + 5000 < Date.now()) {
        connectionLostFrame(globalBuffer)
    }
}, 2000);