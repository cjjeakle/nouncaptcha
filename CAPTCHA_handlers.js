/*
 * The Following functions handle user interaction with the CAPTCHA
 */

var pg = require('pg').native;
// Dev db URL and prod DB url, if DEV does not exist use prod
var PG_URL = process.env.HEROKU_POSTGRESQL_WHITE_URL || process.env.HEROKU_POSTGRESQL_CYAN_URL;

var uuid = require('node-uuid');
var log_data = require('./logger').log_data;

exports.start_CAPTCHA = function(socket) {

}