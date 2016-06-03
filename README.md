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
* ```curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -``` (really only necessary if using Debian/Ubuntu)
* ```sudo apt-get --yes install nodejs postgresql screen```
* ```sudo bash deploy <-u> <-i <-p #>>```
    * Script Arugments:
        * ```-u``` (_U_ninstall)
        * ```-i``` (_I_nstall)
            * ```-p <int>``` (_P_ort) sets the port the server will run on (default 4000)
        * ```-z``` (_Z_oom) skip any warnings about deleting users, dropping database data, and/or modifying database data
        	* These warnings are safe to ignore within the app's own context, but the deploy script is cautious to warn of potential data modification should you be using any conflicting names

### An Example Install:
(This is an end-to-end scenario, complete with cloning this repo into a new folder named nouncaptcha)
```
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash - && \
sudo apt-get update && \
sudo apt-get --yes install git nodejs postgresql screen && \
git clone https://github.com/cjjeakle/nouncaptcha.git && \
cd nouncaptcha && \
sudo bash deploy -uip 8080
```

### Debugging Deployment Issues:
* `psql` could not connect to server
    * Run `sudo /etc/init.d/postgresql restart` and attempt the deploy script again.

##Starting the server:
###Debugging/Development:
```bash run <-s> <-p #>```

* Script Arguments:
    * ```-s``` (_S_ilent) all logging is suppressed
    * ```-p <int>``` (_P_ort) overrides the default port

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

## License:
### Third party code:
`/cap_handlers.js`contains an array shuffle snippet from http://dzone.com/, which is attributed back to Jonas Raoni Soares Silva's http://jsfromhell.com. This code is denoted and attributed in comments, and is used under http://jsfromhell.com's use with attribution requirement.

There is no explicit license, but http://jsfromhell.com/ states:
> Copyright<br/>
> We authorize the copy and modification of all the codes on the site, <strong>since the original author credits are kept</strong>.

Details:
* Snippet author: Jonas Raoni Soares Silva
* Attribution link: http://jsfromhell.com/array/shuffle
* Link to exact snippet used: http://dzone.com/snippets/array-shuffle-javascript

### License for all other code:
The MIT License (MIT)

Copyright (c) 2014-2016 Chris Jeakle

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
