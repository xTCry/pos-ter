import express from 'express';
import { createCanvas, Image } from 'canvas';
import fileUpload from 'express-fileupload';
import USBPosAdapter from '../libs/usb.pos-adapter';
import { PosEncoder } from '../libs/pos.encoder';
import path from 'path';

const device = new USBPosAdapter();

let queue: (
    | { type: 'text'; text: string }
    | { type: 'text-canvas'; text: string }
    | { type: 'image'; image: Image }
)[] = [];

// * Web server

const port = 3002;
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public', '3.index.html'));
});

app.post('/print', async (req, res) => {
    console.log('[body] "/print"', req.body);
    try {
        queue.push({ type: 'text', text: req.body.text });
        res.json({ status: 'success' });
    } catch (error) {
        console.log(error);
        res.json({ error });
    }
});
app.post('/canvas', async (req, res) => {
    console.log('[body] "/canvas"', req.body);
    try {
        queue.push({ type: 'text-canvas', text: req.body.text });
        res.json({ status: 'success' });
    } catch (error) {
        console.log(error);
        res.json({ error });
    }
});
app.post('/image', async (req, res) => {
    const { file } = req.files;
    console.log('[file] "/image"');

    try {
        const image = new Image();
        if (!Array.isArray(file)) {
            image.src = file.data;
        } else {
            image.src = file[0].data;
        }

        queue.push({ type: 'image', image });
        res.json({ status: 'success' });
    } catch (error) {
        console.log(error);
        res.json({ error: error.message });
    }
});
app.post('/image-link', async (req, res) => {
    console.log('[body] "/image-link"', req.body);

    try {
        const image = new Image();
        image.src = req.body['link'] as string;
        await new Promise((resolve) => {
            image.onload = () => resolve(1);
        });
        image.onerror = (err) => {
            throw err;
        };

        queue.push({ type: 'image', image });
        res.json({ status: 'success' });
    } catch (error) {
        console.log(error);
        res.json({ error });
    }
});
app.listen(port, () => {
    console.log(`Printer form on: http://localhost:${port}`);
});

// * Printer

let loopPower = true;
async function bootstrap() {
    // loop
    do {
        const item = queue.shift();
        if (item) {
            try {
                await device.openAsync();
                console.log('Opened');
                switch (item.type) {
                    case 'text': {
                        await print(item.text);
                        break;
                    }
                    case 'text-canvas': {
                        await printCanvas(item.text);
                        break;
                    }
                    case 'image': {
                        await drawImage(item.image);
                        break;
                    }
                    default: {
                        console.log('Unknown queue type');
                        break;
                    }
                }
            } catch (err) {
                console.log('Error', err);
            } finally {
                await device.closeAsync();
                console.log('Closed');
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        // await new Promise((resolve) => setImmediate(resolve));
    } while (loopPower);
}
bootstrap().then();

const print = async (text: string) => {
    const encoder = new PosEncoder().init();

    encoder.line(text);
    encoder.newline();
    encoder.cut();

    const buffer = encoder.getBuffer();
    await device.writeAsync(buffer);
};

const printCanvas = async (text: string) => {
    text = text.split(/\r\n|\r|\n/)[0];

    const encoder = new PosEncoder().init();

    const fontSite = 42;
    const canvas = createCanvas(384, Math.round(fontSite / 2) + 5);
    const ctx = canvas.getContext('2d');

    ctx.font = `${fontSite}px "Gabriola"`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(text, 0, Math.floor(fontSite / 2));
    encoder.image(canvas);
    encoder.newline();
    encoder.cut();

    const buffer = encoder.getBuffer();
    await device.writeAsync(buffer);
};

const drawImage = async (image: Image) => {
    const encoder = new PosEncoder().init();

    encoder.image(image);
    encoder.newline();
    encoder.cut();

    const buffer = encoder.getBuffer();
    await device.writeAsync(buffer);
};

device.on('detach', async () => {
    console.log('Device detached');
    console.log('Wait 5 seconds to reconnect...');
    await new Promise((resolve) => setTimeout(resolve, 5e3));
    device.setDevice();
});

device.on('found', (device) => {
    console.log('Device found');
});
