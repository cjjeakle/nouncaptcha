/*
 * A central repository for any variables used in multiple files
 */ 

// A convenience method to make changing the desired env var easier
exports.database_url = (process.env.NOUNCAPTCHA_DB_URL || process.env.DATABASE_URL) + '?ssl=true';