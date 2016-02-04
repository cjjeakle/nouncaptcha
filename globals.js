/*
 * A central repository for any variables used in multiple files
 */ 

// A convenience method to make changing the desired env var easier
exports.database_url = process.env.DATABASE_URL || 'postgres://localhost:5432/nouncaptcha';