nouncaptcha
===========

##About:
An Image-Based CAPTCHA Backed by Information from an ESP Game Implementation

View the live site: www.nouncaptcha.com

Check out my undergraduate honors thesis on this project: http://deepblue.lib.umich.edu/handle/2027.42/107736

##To Get Set Up:
###Scripted Deployment:
* Clone this repo
* ```sudo apt-get update```
* ```sudo bash deploy <-u> <-i <-p #>>```
    * Script Arugments:
        * ```-u``` (uninstall)
        * ```-i``` (install)
            * ```-p <int>``` (port) sets the port the server will run on (default is 4000)
        * ```-z``` (zoom) skip any warnings about deleting users, dropping database data, and/or modifying database data
        	* These warnings are safe to ignore within the app's own context, but the deploy script is cautious to warn of potential data modification should you be using any conflicting names

### An example install:
```sudo bash deploy -uip 8080```

##Starting the server:
###Debugging/development:
```bash run <-s> <-p #>```

* Script Arguments:
    * ```-s``` (silent) routes all logging to /dev/null
    * ```-p <int>``` (port) overrides the default port

###Prod:
```bash runprod```

* Script behavior:
    * Starts a screen named 'nouncaptcha'
    * Assumes the role of a non-root user named 'nouncaptcha'
    * Sets NODE_ENV=production
    * Runs the server under the port configured at install
    * The -s parameter is passed in to the run script, so there is no logging

* Accessing the screen session:
    * ```screen -r nouncaptcha```

##Notes:
If installing an old version of this project (such as one of the tagged versions), ```aws-api``` and ```pg-native``` will probably fail to install. 
This is because the command ```node``` has been replaced by ```nodejs``` in apt. 
This can be resolved by running ```sudo apt-get install nodejs-legacy``` before running ```npm install```.
