/*
 * A central repository for any variables used in multiple files
 */ 

// Local db URL and Heroku DB url, if local does not exist attempt to use Heroku
exports.database_url = process.env.database_url || process.env.HEROKU_POSTGRESQL_CYAN_URL;