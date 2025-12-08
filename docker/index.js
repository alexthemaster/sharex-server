// @ts-nocheck
const { ShareXServer } = require("./dist/index.js");

new ShareXServer({
    password: process.env.PASSWORD,
    baseUrl: process.env.BASE_URL,
    port: process.env.PORT,
    fileLength: process.env.LENGTH,
    enableSxcu: JSON.parse(process.env.ENABLE_SXCU.toLowerCase()) ?? true,
    forceHttps: JSON.parse(process.env.FORCE_HTTPS.toLowerCase()) ?? false,
    fileListing: process.env.FILE_LISTING.toLowerCase() == "false" ? false : process.env.FILE_LISTING,
    debug: JSON.parse(process.env.DEBUG.toLowerCase()) ?? false,
});
