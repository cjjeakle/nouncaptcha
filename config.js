/*
 * A central repository for the app's configuration
 */ 

// A convenience method to make changing the desired env var easier
exports.database_url = (process.env.NOUNCAPTCHA_DB_URL || process.env.DATABASE_URL) + '?ssl=true';
exports.port = (process.env.NOUNCAPTCHA_PORT || process.env.PORT);
