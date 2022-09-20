import { createCanvas } from 'canvas';
import USBPosAdapter from '../libs/usb.pos-adapter';
import { PosEncoder } from '../libs/pos.encoder';
import { setCleanup } from '../libs/cleanup';

const device = new USBPosAdapter();

let loopPower = true;
async function bootstrap() {
    try {
        await device.openAsync();
        console.log('Opened');
        await loop();
    } catch (err) {
        console.log('Error', err);
    } finally {
        await device.closeAsync();
        console.log('Closed');
    }
}
bootstrap().then();

const canvas = createCanvas(384, 24);
const ctx = canvas.getContext('2d');

const fontSite = 42;
ctx.font = `${fontSite}px "Gabriola"`;

const loop = async () => {
    const encoder = new PosEncoder().init();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(new Date().toLocaleString(), 0, Math.floor(fontSite / 2));
    encoder.image(canvas);
    encoder.newline();

    const buffer = encoder.getBuffer();
    await device.writeAsync(buffer);

    await new Promise((resolve) => setTimeout(resolve, 1e3));
    // loopPower && await loop();
};

setCleanup(async (code) => {
    console.log('App specific cleanup code...');
    loopPower = false;
    await device.closeAsync();
    process.exit(code);
});
