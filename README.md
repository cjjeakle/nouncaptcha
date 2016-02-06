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
* ```sudo bash deploy```
    * Script Arugments:
        * ```-u``` (uninstall)
        * ```-i``` (install)
            * ```-p <int>``` (port) sets the port the server will run on (default is 4000)
### An example install:
```sudo bash deploy -u -i -p 80```

##Starting the server:
###Debugging/development:
```bash run```
* Script Arguments:
    * ```-p``` (port) overrides the default port
###Prod:
```bash runprod```
* Script Arguments:
    * ```-s``` (silent) routes all logging to /dev/null
    * ```-p``` (port) overrides the default port

##Notes:
If installing an old version of this project (such as one of the tagged versions), ```aws-api``` and ```pg-native``` will probably fail to install. 
This is because the command ```node``` has been replaced by ```nodejs``` in apt. 
This can be resolved by running ```sudo apt-get install nodejs-legacy``` before running ```npm install```.
