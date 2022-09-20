export const setCleanup = (callback: NodeJS.BeforeExitListener = () => {}) => {
    process.on('cleanup', callback);

    process.on('exit', () => {
        process.emit('cleanup' as any);
    });

    process.on('SIGINT', () => {
        console.log('Ctrl-C...');
        process.exit(2);
    });

    process.on('uncaughtException', (e) => {
        console.log('Uncaught Exception...');
        console.log(e.stack);
        process.exit(99);
    });

    // Prevents the program from closing instantly
    process.stdin.resume();
};
