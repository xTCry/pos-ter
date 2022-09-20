import os from 'os';
import * as USB from 'usb';
import type { Device } from 'usb/dist/usb';
import type { InEndpoint, OutEndpoint } from 'usb/dist/usb/endpoint';
import { PosAdapter } from './pos-adapter';

/**
 * @docs [USB Class Codes](https://www.usb.org/defined-class-codes)
 */
enum IFACE_CLASS {
    AUDIO = 0x01,
    HID = 0x03,
    PRINTER = 0x07,
    HUB = 0x09,
}

export default class USBPosAdapter extends PosAdapter /* <[timeout?: number]> */ {
    public device: Device = null;
    private endpoint?: OutEndpoint;
    private deviceToPcEndpoint?: InEndpoint;

    constructor(device: Device);
    constructor(vid?: number, pid?: number);
    constructor(vidOrDevice?: number | Device, pid?: number) {
        super();

        if (typeof vidOrDevice === 'number') {
            if (pid) {
                this.device = USB.findByIds(vidOrDevice, pid);
            }
        } else if (vidOrDevice) {
            // Set spesific USB device from devices array as coming from USB.findPrinter() function.
            // for example
            // let devices = escpos.USB.findPrinter();
            // => devices [ Device1, Device2 ];
            // And Then
            // const device = new escpos.USB(Device1); OR device = new escpos.USB(Device2);
            this.device = vidOrDevice;
        } else {
            const devices = USBPosAdapter.findPrinter();
            if (devices && devices.length) {
                [this.device] = devices;
            }
        }

        if (!this.device) {
            throw new Error('Can not find printer');
        }

        USB.usb.on('detach', (device) => {
            if (device === this.device) {
                this.emit('detach', device);
                this.emit('disconnect', device);
                this.device = null;
            }
        });
    }

    public static findPrinter() {
        return USB.getDeviceList().filter((device) => {
            try {
                return device.configDescriptor?.interfaces.some((iface) =>
                    iface.some(
                        (e) => e.bInterfaceClass === IFACE_CLASS.PRINTER,
                    ),
                );
            } catch {
                return false;
            }
        });
    }

    public static getDevice(vid: number, pid: number) {
        return new Promise((resolve, reject) => {
            try {
                const device = USB.findByIds(vid, pid);
                device?.open();
                resolve(device);
            } catch (err) {
                reject(err);
            }
        });
    }

    public open(callback?: (error: Error | null) => void): this {
        let counter = 0;

        this.device.open();
        for (const iface of this.device.interfaces) {
            iface.setAltSetting(iface.altSetting, () => {
                try {
                    // * http://libusb.sourceforge.net/api-1.0/group__dev.html#gab14d11ed6eac7519bb94795659d2c971
                    // libusb_kernel_driver_active / libusb_attach_kernel_driver / libusb_detach_kernel_driver :
                    // "This functionality is not available on Windows."
                    if ('win32' !== os.platform()) {
                        if (iface.isKernelDriverActive()) {
                            try {
                                iface.detachKernelDriver();
                            } catch (e) {
                                console.error(
                                    '[ERROR] Could not detatch kernel driver: %s',
                                    e,
                                );
                            }
                        }
                    }

                    // must be called before using any endpoints of this interface.
                    iface.claim();
                    iface.endpoints.filter((endpoint) => {
                        if (endpoint.direction === 'out' && !this.endpoint) {
                            this.endpoint = endpoint as OutEndpoint;
                        } else if (
                            endpoint.direction === 'in' &&
                            !this.deviceToPcEndpoint
                        ) {
                            this.deviceToPcEndpoint = endpoint as InEndpoint;
                        }
                    });

                    if (this.endpoint) {
                        this.emit('connect', this.device);
                        callback && callback(null);
                    } else if (
                        ++counter === this.device.interfaces.length &&
                        !this.endpoint
                    ) {
                        callback &&
                            callback(
                                new Error('Can not find endpoint from printer'),
                            );
                    }
                } catch (err: any) {
                    // Try/Catch block to prevent process from exit due to uncaught exception.
                    // i.e LIBUSB_ERROR_ACCESS might be thrown by claim() if USB device is taken by another process
                    // example: MacOS Parallels
                    callback && callback(err);
                }
            });
        }
        return this;
    }

    public openAsync() {
        return new Promise((resolve, reject) => {
            this.open((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(1);
                }
            });
        });
    }

    public read(callback?: (data: Buffer) => void): void {
        this.deviceToPcEndpoint.transfer(64, (error: any, data: Buffer) => {
            callback && callback(data);
        });
    }

    public readAsync() {
        return new Promise((resolve) => {
            this.read((data) => {
                resolve(data);
            });
        });
    }

    public write(
        data: string | Buffer,
        callback?: (error: Error | null) => void,
    ): this {
        this.emit('data', data);
        this.endpoint.transfer(data as Buffer, callback);
        return this;
    }

    public writeAsync(data: string | Buffer) {
        return new Promise((resolve, reject) => {
            this.write(data, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(1);
                }
            });
        });
    }

    public close(callback: (error: Error | null) => void = () => {}): this {
        if (!this.device) {
            callback(null);
        }
        try {
            this.device.close();
            USB.usb.removeAllListeners('detach');
            callback(null);
            this.emit('close', this.device);
        } catch (err: any) {
            callback(err);
        }
        return this;
    }

    public closeAsync() {
        return new Promise((resolve, reject) => {
            this.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(1);
                }
            });
        });
    }
}
