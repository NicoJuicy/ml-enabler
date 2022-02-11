'use strict';
const { Err } = require('@openaddresses/batch-schema');
const User = require('../lib/user');
const Login = require('../lib/login');

async function router(schema, config) {
    const email = new (require('../lib/email'))(config);

    /**
     * @api {get} /api/login Session Info
     * @apiVersion 1.0.0
     * @apiName GetLogin
     * @apiGroup Login
     * @apiPermission user
     *
     * @apiDescription
     *     Return information about the currently logged in user
     *
     * @apiSchema {jsonschema=../schema/res.Login.json} apiSuccess
     */
    await schema.get('/login', {
        res: 'res.Login.json'
    }, async (req, res) => {
        try {
            await User.is_auth(req);
            res.json(req.user.serialize());
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    /**
     * @api {post} /api/login Create Session
     * @apiVersion 1.0.0
     * @apiName CreateLogin
     * @apiGroup Login
     * @apiPermission user
     *
     * @apiDescription
     *     Log a user into the service and create an authenticated cookie
     *
     * @apiSchema (Body) {jsonschema=../schema/req.body.CreateLogin.json} apiParam
     * @apiSchema {jsonschema=../schema/res.Login.json} apiSuccess
     */
    await schema.post('/login', {
        body: 'req.body.CreateLogin.json',
        res: 'res.Login.json'
    }, async (req, res) => {
        try {
            req.user = await Login.attempt({
                username: req.body.username,
                password: req.body.password
            });

            return res.json({
                uid: req.user.id,
                username: req.user.username,
                email: req.user.email,
                access: req.user.access,
                token: req.user.token
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    /**
     * @api {get} /api/login/verify Verify User
     * @apiVersion 1.0.0
     * @apiName VerifyLogin
     * @apiGroup Login
     * @apiPermission public
     *
     * @apiDescription
     *     Email Verification of new user
     *
     * @apiSchema (Query) {jsonschema=../schema/req.query.VerifyLogin.json} apiParam
     * @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
     */
    await schema.get('/login/verify', {
        query: 'req.query.VerifyLogin.json',
        res: 'res.Standard.json'
    }, async (req, res) => {
        try {
            res.json(await Login.verify(req.query.token));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    /**
     * @api {post} /api/login/forgot Forgot Login
     * @apiVersion 1.0.0
     * @apiName ForgotLogin
     * @apiGroup Login
     * @apiPermission public
     *
     * @apiDescription
     *     If a user has forgotten their password, send them a password reset link to their email
     *
     * @apiSchema (Body) {jsonschema=../schema/req.body.ForgotLogin.json} apiParam
     * @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
     */
    await schema.post('/login/forgot', {
        body: 'req.body.ForgotLogin.json',
        res: 'res.Standard.json'
    }, async (req, res) => {
        try {
            const reset = await Login.forgot(config.pool, req.body.username); // Username or email

            if (config.args.email) {
                await email.forgot(reset);
            }

            // To avoid email scraping - this will always return true, regardless of success
            return res.json({
                status: 200,
                message: 'Password Email Sent'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    /**
     * @api {post} /api/login/reset Reset Login
     * @apiVersion 1.0.0
     * @apiName ResetLogin
     * @apiGroup Login
     * @apiPermission public
     *
     * @apiDescription
     *     Once a user has obtained a password reset by email via the Forgot Login API,
     *     use the token to reset the password
     *
     * @apiSchema (Body) {jsonschema=../schema/req.body.ResetLogin.json} apiParam
     * @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
     */
    await schema.post('/login/reset', {
        body: 'req.body.ResetLogin.json',
        res: 'res.Standard.json'
    }, async (req, res) => {
        try {
            return res.json(await Login.reset({
                token: req.body.token,
                password: req.body.password
            }));

        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

module.exports = router;
