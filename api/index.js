'use strict';

const Err = require('./lib/error');
const Schema = require('./lib/schema');
const Cacher = require('./lib/cacher');
const jwt = require('jsonwebtoken');
const Miss = Cacher.Miss;
const { ValidationError } = require('express-json-validator-middleware');
const Busboy = require('busboy');
const morgan = require('morgan');
const util = require('./lib/util');
const express = require('express');
const pkg = require('./package.json');
const minify = require('express-minify');
const bodyparser = require('body-parser');
const args = require('minimist')(process.argv, {
    boolean: ['help', 'populate', 'email', 'no-cache', 'silent'],
    string: ['postgres']
});

const Param = util.Param;
const Config = require('./lib/config');

if (require.main === module) {
    configure(args);
}

function configure(args, cb) {
    Config.env(args).then((config) => {
        return server(args, config, cb);
    }).catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

/**
 * @apiDefine admin Admin
 *   The user must be a server admin to use this endpoint
 */
/**
 * @apiDefine orgadmin Org Admin
 *   The user must be an org admin (or server admin) to use this endpoint
 */
/**
 * @apiDefine user User
 *   A user must be logged in to use this endpoint
 */
/**
 * @apiDefine public Public
 *   This API endpoint does not require authentication
 */

async function server(args, config, cb) {
    // these must be run after lib/config
    // const Map = require('./lib/map');

    const cacher = new Cacher(args['no-cache'], config.silent);

    const email = new (require('./lib/email'))(config);
    const user = new (require('./lib/user'))(config);
    const Token = new require('./lib/token');
    const Org = new require('./lib/org');
    const OrgUser = new require('./lib/org/user');
    const OrgInvite = new require('./lib/org/invite');

    const app = express();
    const schema = new Schema(express.Router());

    app.disable('x-powered-by');
    app.use(minify());

    app.use(express.static('web/dist'));

    // Load dynamic routes directory
    for (const r of fs.readdirSync(path.resolve(__dirname, './routes'))) {
        if (!config.silent) console.error(`ok - loaded routes/${r}`);
        await require('./routes/' + r)(schema, config);
    }

    /**
     * @api {get} /api Get Metadata
     * @apiVersion 1.0.0
     * @apiName Meta
     * @apiGroup Server
     * @apiPermission public
     *
     * @apiDescription
     *     Return basic metadata about server configuration
     *
     * @apiSchema {jsonschema=./schema/res.Meta.json} apiSuccess
     */
    app.get('/api', (req, res) => {
        return res.json({
            version: pkg.version
        });
    });

    /**
     * @api {get} /health Server Healthcheck
     * @apiVersion 1.0.0
     * @apiName Health
     * @apiGroup Server
     * @apiPermission public
     *
     * @apiDescription
     *     AWS ELB Healthcheck for the server
     *
     * @apiSchema {jsonschema=./schema/res.Health.json} apiSuccess
     */
    app.get('/health', (req, res) => {
        return res.json({
            healthy: true,
            message: ':wave:'
        });
    });

    app.use('/api', router);
    app.use('/docs', express.static('./doc'));
    app.use('/*', express.static('web/dist'));

    schema.router.use(bodyparser.urlencoded({ extended: true }));
    schema.router.use(morgan('combined'));
    schema.router.use(bodyparser.json({ limit: '50mb' }));

    schema.router.use(async (req, res, next) => {
        if (req.header('authorization')) {
            const authorization = req.header('authorization').split(' ');
            if (authorization[0].toLowerCase() !== 'bearer') {
                return res.status(401).json({
                    status: 401,
                    message: 'Only "Bearer" authorization header is allowed'
                });
            }

            if (!authorization[1]) {
                return res.status(401).json({
                    status: 401,
                    message: 'No bearer token present'
                });
            }

            if (authorization[1].split('.')[0] === 'bri') {
                try {
                    req.auth = await Token.validate(config.pool, authorization[1]);
                } catch (err) {
                    return Err.respond(err, res);
                }
            } else {
                try {
                    const decoded = jwt.verify(authorization[1], config.signing_secret);
                    req.auth = await user.user(decoded.u);
                } catch (err) {
                    return Err.respond(new Err(401, err, 'Invalid Token'), res);
                }
            }
        } else {
            req.auth = false;
        }

        return next();
    });

    router.use((err, req, res, next) => {
        if (err instanceof ValidationError) {
            let errs = [];

            if (err.validationErrors.body) {
                errs = errs.concat(err.validationErrors.body.map((e) => {
                    return { message: e.message };
                }));
            }

            if (err.validationErrors.query) {
                errs = errs.concat(err.validationErrors.query.map((e) => {
                    return { message: e.message };
                }));
            }

            return Err.respond(
                new Err(400, null, 'validation error'),
                res,
                errs
            );
        } else {
            next(err);
        }
    });

    router.all('*', (req, res) => {
        return res.status(404).json({
            status: 404,
            message: 'API endpoint does not exist!'
        });
    });

    const srv = app.listen(2001, (err) => {
        if (err) return err;

        if (!config.silent) console.log('ok - http://localhost:2001');

        if (cb) return cb(srv, config);
    });
}

module.exports = configure;
