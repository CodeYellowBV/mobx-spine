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
        moduleId: 'mobx-binder',
        moduleName: 'mobxBinder',
        dest: 'dist/mobx-binder.es.js',
    });
}).catch((err) => {
    console.log(String(err));
    process.exit(1);
});
