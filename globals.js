/*
 * A central repository for any variables used in multiple files
 */ 

// Dev db URL and prod DB url, if DEV does not exist use prod
exports.database_url = process.env.dev_database_url || process.env.HEROKU_POSTGRESQL_CYAN_URL;