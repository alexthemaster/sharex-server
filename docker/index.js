// @ts-nocheck
const { ShareXServer } =
    process.env.DEV && process.env.DEV == "true"
        ? require("./dist/index")
        : require("sharex-server");

new ShareXServer({
    password: process.env.PASSWORD,
    baseUrl: process.env.BASE_URL,
    port: process.env.PORT,
    fileLength: process.env.LENGTH,
    enableSxcu: JSON.parse(process.env.ENABLE_SXCU.toLowerCase()) ?? true,
    forceHttps: process.env.FORCE_HTTPS
        ? JSON.parse(process.env.FORCE_HTTPS.toLowerCase())
        : undefined,
    trustProxy: JSON.parse(process.env.TRUST_PROXY.toLowerCase()) ?? false,
    fileListing:
        process.env.FILE_LISTING.toLowerCase() == "false"
            ? false
            : process.env.FILE_LISTING,
    debug: JSON.parse(process.env.DEBUG.toLowerCase()) ?? false,
});
