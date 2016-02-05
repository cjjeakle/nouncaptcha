nouncaptcha
===========

##About:
An Image-Based CAPTCHA Backed by Information from an ESP Game Implementation

View the live site: www.nouncaptcha.com

Check out my undergraduate honors thesis on this project: http://deepblue.lib.umich.edu/handle/2027.42/107736

##To Get Set Up:
###Scripted Deployment:
###Legacy/Manual Deployment:
* Clone this repo
* ```sudo apt-get update```
* ```sudo apt-get install nodejs```
* ```npm install```
* Set up a postgres database and store its URL in the environment variable ```NOUNCAPTCHA_DB_URL``` (preferred) or ```DATABASE_URL``` (fallback)
    * ```sudo apt-get install postgresql postgresql-contrib```
    * ```sudo -u postgres createuser nouncaptcha --connection-limit=1 --no-createdb --no-createrole --no-superuser --pwprompt```
        * Remember the provided password to set it in the connection string below
    * ```sudo -u postgres createdb nouncaptcha```
    * ```sudo -u postgres psql nouncaptcha < db_stuff/basic_database.dump```
    * ```echo "REVOKE CONNECT ON DATABASE nouncaptcha FROM PUBLIC; GRANT CONNECT ON DATABASE nouncaptcha TO nouncaptcha;" | sudo -u postgres psql nouncaptcha```
    * ```echo 'export NOUNCAPTCHA_DB_URL="postgres://nouncaptcha:<password>@localhost:5432/nouncaptcha"' >> ~/.bashrc```
        * Replace <password> with the one chosen
* ```npm install -g forever```

##To Debug:
Run: 
```forever -w server.js```

##Notes:
If installing an old version of this project (such as one of the tagged versions), ```aws-api``` and ```pg-native``` will probably fail to install. 
This is because the command ```node``` has been replaced by ```nodejs``` in apt. 
This can be resolved by running ```sudo apt-get install nodejs-legacy``` before running ```npm install```.