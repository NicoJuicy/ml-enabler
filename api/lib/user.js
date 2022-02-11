'use strict';
const { Err } = require('@openaddresses/batch-schema');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { promisify } = require('util');
const randomBytes = promisify(crypto.randomBytes);
const jwt = require('jsonwebtoken');
const { sql } = require('slonik');
const Generic = require('@openaddresses/batch-generic');

/**
 * @class
 */
class User extends Generic {
    static _table = 'users';
    static _patch = require('../schema/req.body.PatchUser.json');
    static _res = require('../schema/res.User.json');

    /**
     * Return a list of users
     *
     * @param {Object} query - Query Object
     * @param {Number} [query.limit=100] - Max number of results to return
     * @param {Number} [query.page=0] - Page of users to return
     * @param {String} [query.filter=] - Username or Email fragment to filter by
     * @param {String} [query.access=] - User Access to filter by
     * @param {String} [query.sort=created] Field to sort by
     * @param {String} [query.order=asc] Sort Order (asc/desc)
     */
    async list(pool, query) {
        if (!query) query = {};
        if (!query.limit) query.limit = 100;
        if (!query.page) query.page = 0;
        if (!query.filter) query.filter = '';
        if (!query.access) query.access = null;
        if (!query.org) query.org = null;

        if (!query.sort) query.sort = 'created';
        if (!query.order || query.order === 'asc') {
            query.order = sql`asc`;
        } else {
            query.order = sql`desc`;
        }

        let pgres;
        try {
            pgres = await pool.query(sql`
                SELECT
                    count(*) OVER() AS count,
                    users.id,
                    users.username,
                    users.validated,
                    users.access,
                    users.email
                FROM
                    users
                WHERE
                    (users.username ~ ${query.filter} OR users.email ~* ${query.filter})
                    AND (${query.access}::TEXT IS NULL OR users.access = ${query.access})
                GROUP BY
                    users.id
                ORDER BY
                    ${sql.identifier(['users', query.sort])} ${query.order}
                LIMIT
                    ${query.limit}
                OFFSET
                    ${query.limit * query.page}
            `);
        } catch (err) {
            throw new Err(500, err, 'Internal User Error');
        }

        return this.deserialize(pgres.rows);
    }

    static async from_username(pool, username) {
       let pgres;
        try {
            pgres = await pool.query(sql`
                SELECT
                    *
                FROM
                    users
                WHERE
                    username = ${username}
                    OR email = ${username}
            `);
        } catch (err) {
            throw new Err(500, err, 'Internal Login Error');
        }

        if (pgres.rows.length === 0) {
            throw new Err(403, null, 'Invalid Username or Pass');
        }

        return this.deserialize(pgres.rows[0]);
    }


    static async is_auth(req) {
        if (req.user === 'internal') return true;

        if (!req.user || !req.user.access || !req.user.id) {
            throw new Err(401, null, 'Authentication Required');
        }

        if (req.user.access === 'disabled') {
            throw new Err(403, null, 'Account Disabled - Please Contact Us');
        }

        return true;
    }

    static async is_admin(req) {
        if (req.user === 'internal') return true;

        await this.is_auth(req);

        if (req.user.access !== 'admin') {
            throw new Err(401, null, 'Admin token required');
        }

        return true;
    }

    async commit(pool) {
        let pgres;
        try {
            pgres = await this.config.pool.query(sql`
                UPDATE users
                    SET
                        access = ${user.access},
                        validated = ${user.validated}
                    WHERE
                        id = ${uid}
                    RETURNING *
            `);
        } catch (err) {
            throw new Err(500, err, 'Internal User Error');
        }

        return this;
    }

    static async generate(pool, user) {
        if (!user.username) throw new Err(400, null, 'username required');
        if (!user.email) throw new Err(400, null, 'email required');
        if (!user.password) throw new Err(400, null, 'password required');

        try {
            const pgres = await pool.query(sql`
                INSERT INTO users (
                    username,
                    email,
                    password,
                    access
                ) VALUES (
                    ${user.username},
                    ${user.email},
                    ${await bcrypt.hash(user.password, 10)},
                    'user'
                ) RETURNING *
            `);

            return this.deserialize(pgres.rows[0]);
        } catch (err) {
            throw new Err(500, err, 'Failed to register user');
        }
    }
}

module.exports = User;
