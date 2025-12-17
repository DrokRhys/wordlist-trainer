
module.exports = {
    apps: [
        {
            name: 'wordlist-trainer-production',
            script: './server/dist/index.js',
            env: {
                NODE_ENV: 'production',
                PORT: 5010
            },
            watch: false
        }
    ]
};
