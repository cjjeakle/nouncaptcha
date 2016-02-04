nouncaptcha
===========

##About:
An Image-Based CAPTCHA Backed by Information from an ESP Game Implementation

View the live site: www.nouncaptcha.com

Check out my undergraduate honors thesis on this project: http://deepblue.lib.umich.edu/handle/2027.42/107736


##To Get Set Up:
* Clone this repo
* ```sudo apt-get update```
* ```sudo apt-get install nodejs```
* ```npm install```
* Set up a postgres database and store its URL in the environment variable ```DATABASE_URL```
    * ```sudo apt-get install postgresql postgresql-contrib```
    * ```sudo -u postgres createuser nouncaptcha --connection-limit=1 --no-createdb --no-createrole --no-superuser --pwprompt``` remember the provided password for later
    * ```sudo -u postgres createdb nouncaptcha```
    * ```sudo -u postgres psql nouncaptcha < db_stuff/basic_database.dump```
    * ```echo "REVOKE CONNECT ON DATABASE nouncaptcha FROM PUBLIC; GRANT CONNECT ON DATABASE nouncaptcha TO nouncaptcha;" | sudo -u postgres psql nouncaptcha```
    * ```echo 'export NOUNCAPTCHA_DB_URL="postgres://nouncaptcha:<password>@localhost:5432/nouncaptcha"' >> ~/.bashrc``` replace <password> with the one chosen
* ```npm install supervisor -g```

##To Debug:
Run: 
```supervisor server.js```

##Notes:
If installing an old version of this project (such as one of the tagged versions), ```aws-api``` will probably fail to install. 
This is because the command ```node``` has been replaced by ```nodejs``` in apt. 
This can be resolved by either installing ```apt-get install nodejs-legacy``` before running ```npm install``` or by simply removing ```aws-api``` from package.json. 
It appears to be unneeded as of the final version of this site.
