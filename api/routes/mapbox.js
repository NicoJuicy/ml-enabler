'use strict';
const { Err } = require('@openaddresses/batch-schema');
const Auth = require('../lib/auth');

async function router(schema, config) {

    /**
     * @api {get} /api/mapbox Mapbox Settings
     * @apiVersion 1.0.0
     * @apiName GetMapbox
     * @apiGroup Mapbox
     * @apiPermission user
     *
     * @apiDescription
     *     Return necessary information to show Mapbox maps
     *
     * @apiSchema {jsonschema=../schema/res.Mapbox.json} apiSuccess
     */
    await schema.get('/mapbox', {
        res: 'res.Mapbox.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            res.json({
                token: config.Mapbox
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

module.exports = router;
