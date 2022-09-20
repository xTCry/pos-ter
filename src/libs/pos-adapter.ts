import EventEmitter from 'events';

export class NotImplementedException extends Error {}

export abstract class PosAdapter<
    CloseArgs extends unknown[] = [],
> extends EventEmitter {
    public abstract open(callback?: (error: Error | null) => void): this;
    public abstract write(
        data: Buffer | string,
        callback?: (error: Error | null) => void,
    ): this;
    public abstract close(
        callback?: (error: Error | null) => void,
        ...closeArgs: CloseArgs
    ): this;
    public abstract read(callback?: (data: Buffer) => void): void;
}
