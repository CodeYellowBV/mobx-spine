const rollup = require('rollup');
const babel = require('rollup-plugin-babel');

rollup.rollup({
    entry: './src/index.js',
    external: [
        'lodash',
        'mobx',
        'axios',
    ],
    plugins: [
        babel({
            exclude: 'node_modules/**',
        }),
    ],
}).then((bundle) => {
    bundle.write({
        format: 'es',
        dest: 'dist/mobx-spine.es.js',
    });
    bundle.write({
        format: 'umd',
        moduleId: 'mobx-spine',
        moduleName: 'mobxSpine',
        dest: 'dist/mobx-spine.umd.js',
        globals: {
            lodash: '_',
            mobx: 'mobx',
            axios: 'axios',
        },
    });
}).catch((err) => {
    console.log(String(err));
    process.exit(1);
});
