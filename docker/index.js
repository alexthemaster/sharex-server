// @ts-nocheck
const { ShareXServer } = require("./dist/index.js");

new ShareXServer({
    password: process.env.PASSWORD,
    baseUrl: process.env.BASE_URL,
    port: process.env.PORT,
    fileLength: process.env.LENGTH,
    enableSxcu: process.env.ENABLE_SXCU,
    forceHttps: process.env.FORCE_HTTPS,
    fileListing: process.env.FILELISTING,
    debug: process.env.DEBUG,
});
