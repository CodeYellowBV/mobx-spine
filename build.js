const rollup = require('rollup');
const babel = require('rollup-plugin-babel');

rollup
    .rollup({
        input: './src/index.js',
        external: ['lodash', 'mobx', 'axios', 'moment'],
        plugins: [
            babel({
                exclude: 'node_modules/**',
            }),
        ],
    })
    .then(bundle => {
        bundle.write({
            format: 'es',
            file: 'dist/mobx-spine.es.js',
        });
        bundle.write({
            format: 'umd',
            moduleId: 'mobx-spine',
            name: 'mobxSpine',
            file: 'dist/mobx-spine.umd.js',
            globals: {
                lodash: '_',
                mobx: 'mobx',
                axios: 'axios',
                moment: 'moment',
            },
        });
    })
    .catch(err => {
        console.log(String(err));
        process.exit(1);
    });
