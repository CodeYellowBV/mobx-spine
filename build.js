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
            format: 'cjs',
            file: 'dist/mobx-spine.cjs.js',
        });
    })
    .catch(err => {
        console.log(String(err));
        process.exit(1);
    });
