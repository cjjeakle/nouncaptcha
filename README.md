nouncaptcha
===========

## About:
An Image-Based CAPTCHA Backed by Information from an ESP Game Implementation

View the live site: www.nouncaptcha.com

Check out my undergraduate honors thesis on this project: http://deepblue.lib.umich.edu/handle/2027.42/107736

## To Get Set Up:
### Scripted Deployment:
* Clone this repo
    * If hosting: it is a good idea to clone this repo under `/srv`, since this will run as a web service
* `sudo apt update`
* `sudo apt --yes install nodejs npm postgresql`
* Ensure NPM is up-to-date
    * `npm install -g npm`
* Configure Postgres to auto start via:
    * `sudo systemctl enable postgresql` (more modern, suggested)
    * or
    * `sudo update-rc.d postgresql enable` (legacy)
* `sudo bash deploy <-u> <-i <-p #>>`
    * Script Arugments:
        * `-u` (_U_ninstall)
        * `-i` (_I_nstall)
            * `-p <int>` (_P_ort) sets the port the server will run on (default 4000)
        * `-z` (_Z_oom) skip any warnings about deleting users, dropping database data, and/or modifying database data
            * These warnings are safe to ignore within the app's own context, but the deploy script is cautious to warn of potential data modification should you be using any conflicting names

### An Example Install:
(This is an end-to-end scenario, complete with cloning this repo into a new folder named nouncaptcha)
```bash
sudo apt update && \
sudo apt --yes install git nodejs npm postgresql && \
sudo npm install -g npm && \
git clone https://github.com/cjjeakle/nouncaptcha.git && \
cd nouncaptcha && \
sudo bash deploy -uip 8001
```

### Debugging Deployment Issues:
* `psql` could not connect to server
    1. Start the Postgres server via:
        * `sudo systemctl start postgresql` (more modern, suggested)
        * or
        * `sudo /etc/init.d/postgresql restart` (legacy)
    1. Attempt the deploy script again

## Starting the server:
### Debugging/Development:
`bash run <-p #>`

* Script Arguments:
    * `-p <int>` (_P_ort) overrides the default port

### Autostart nouncaptcha with the system:
* Make runprod executable
    * `chmod u+x runprod`
* Create a file: `/etc/systemd/system/nouncaptcha.service`
    ```
    [Unit]
    Description=nouncaptcha web server
    After=postgresql.service

    [Service]
    Type=simple
    Restart=always
    User=nouncaptcha
    Group=nouncaptcha
    WorkingDirectory=/srv/nouncaptcha/
    ExecStart=/bin/bash -c "export NODE_ENV=production; /bin/bash /srv/nouncaptcha/run" 

    [Install]
    WantedBy=multi-user.target
    ```
* Start the nouncaptcha service:
    ```
    sudo systemctl enable nouncaptcha &&
    sudo systemctl start nouncaptcha
    ```

### Using an NGINX reverse proxy (with HTTPS)
* Install NGINX:
    ```
    sudo apt install nginx
    ```
* Create a file `/etc/nginx/conf.d/nouncaptcha.conf`:
    ```
    server {
        server_name nouncaptcha.com www.nouncaptcha.com;
        location / {
            # Socket.io compatibility stuff
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Host $host;

            proxy_pass http://localhost:8001;
        }
    }
    ```
    * Note that the above file assumes prod will run on port `8001`
* Start NGINX with the new config:
    ```
    sudo systemctl enable nginx
    sudo systemctl start nginx
    ```
* Set up [letsencrypt certbot](https://www.nginx.com/blog/using-free-ssltls-certificates-from-lets-encrypt-with-nginx/) (for TLS)

## Notes:
If installing an old version of this project (such as one of the tagged versions), `aws-api` and `pg-native` will probably fail to install. 
This is because the command `node` has been replaced by `nodejs` in apt. 
This can be resolved by running `sudo apt install nodejs-legacy` before running `npm install`.

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

Copyright (c) 2014 Chris Jeakle

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
