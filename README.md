nouncaptcha
===========

##About:
An Image-Based CAPTCHA Backed by Information from an ESP Game Implementation

View the live site: www.nouncaptcha.com

Check out my undergraduate honors thesis on this project: http://deepblue.lib.umich.edu/handle/2027.42/107736


##To Get Set Up:
* Clone this repo
* ```apt-get install nodejs```
* ```apt-get install nodejs-legacy``` (needed for pg-native to install correctly, hopefully this will be unnecessary in the future)
* ```apt-get install libpq-dev```
* Set up a postgres database and store its URL in the environment variable ```HEROKU_POSTGRES_CYAN_URL``` or ```dev_database_url```
   * A starter database is available as a PG dump file under ```db_stuff/basic_database.dump```
* ```npm install```
* ```npm install supervisor -g```

##To Debug:
Run: 
```supervisor server.js```

##Notes:
If installing an old version of this project (such as one of the tagged versions), ```aws-api``` will probably fail to install. 
This is because the command ```node``` has been replaced by ```nodejs``` in apt. 
This can be resolved by either installing ```apt-get install nodejs-legacy``` before running ```npm install``` or by simply removing ```aws-api``` from package.json. 
It appears to be unneeded as of the final version of this site.
