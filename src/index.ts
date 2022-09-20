import { loadImage } from 'canvas';
import USBPosAdapter from './libs/usb.pos-adapter';
import { PosEncoder } from './libs/pos.encoder';

const device = new USBPosAdapter();
// const device = new USBPosAdapter(0x0493, 0x8760);

const encoder = new PosEncoder({
    // imageMode: 'column',
    // codepage: 'auto',
    // embedded: true,
    // width: 30,
});

const print = (image = null) => {
    let result = encoder.initialize();

    const withImage = !!0;
    if (withImage && image) {
        let width = image.width;
        width += width % 8 === 0 ? 0 : 8 - (width % 8);
        let height = image.height;
        height += height % 8 === 0 ? 0 : 8 - (height % 8);

        encoder.bold(true);
        encoder.align('center');
        encoder.line('Image drawer\n');
        encoder.bold(false);
        encoder.align('left');

        for (const algorithm of [
            'threshold',
            'bayer',
            'floydsteinberg',
            'atkinson',
        ] as const) {
            encoder.line(`╪╪ Algorithm: "${algorithm}" ╪╪`);
            result.image(image, width, height, algorithm);
        }
        encoder.size('normal');
        encoder.line('End');
        encoder.newline();
    } else {
        encoder.line('Hello World! И ещё кириллица');
        encoder.line('░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀');
        encoder.line('αßΓπΣσµτΦΘΩδ');
        encoder.line('∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■');
    }

    const buff = result.encode();
    console.log('buff', buff);

    device.open((err) => {
        console.log('Opened');
        if (err) {
            console.error(err);
            return;
        }
        device.write(Buffer.from(buff), (err) => {
            if (err) {
                console.error(err);
            }
            device.close();
            console.log('Closed');
        });
    });
};

loadImage('https://random.imagecdn.app/384/448').then((image) => {
    // print(image);
});
print();
