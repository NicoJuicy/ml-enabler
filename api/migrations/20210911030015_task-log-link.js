exports.up = function(knex) {
    return knex.schema.raw(`
        ALTER TABLE tasks
            ADD COLUMN log_link TEXT;

        ALTER TABLE iterations
            DROP COLUMN log_link;
    `);
}

exports.down = function(knex) {
    return knex.schema.raw(`
        ALTER TABLE tasks
            DROP COLUMN log_link;

        ALTER TABLE iterations
            ADD COLUMN log_link TEXT;
    `);
}
