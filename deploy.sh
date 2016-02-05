#!/bin/bash
#Fail should any operation fail
set -e
set -o pipefail

#Global App Configuration
declare APPNAME="nouncaptcha";
declare APPUUID="2de8adf9-878f-47d5-9a15-e95890a25a76";
declare RUNFILE="run.sh";
declare STARTUP_FILES_LOCATION="";
declare STARTUP_RUNFILE="${APPNAME}_${APPUUID}_start.sh";

function install {
	#File names
	declare APPEXE="server.js"; #The point of entry for the app
	#Port config
	declare PORT_VARNAME="NOUNCAPTCHA_PORT";
	declare -i PORT=4000;
	#DB config
	declare DB_PASS="$(cat /dev/urandom | tr -dc '[:alnum:]' | head -c 32)"; #Generate a strong alphanumeric password from random input
	declare DB_URL_VARNAME="NOUNCAPTCHA_DB_URL";
	declare DB_URL="postgres://nouncaptcha:${DB_PASS}@localhost:5432/nouncaptcha";
	declare DB_FILE="db_stuff/basic_database.dump";

	echo "Install apt dependencies"
	apt-get install nodejs
	apt-get install postgresql postgresql-contrib

	echo "Install node libraries"
	npm install
	npm install -g forever

	echo "Configure Postgres"
	sudo -u postgres createuser ${APPNAME} --connection-limit=1 --no-createdb --no-createrole --no-superuser
	sudo -u postgres createdb ${APPNAME}
	echo "ALTER USER ${APPNAME} WITH PASSWORD '${DB_PASS}'" | sudo -u postgres psql $APPNAME
	echo "REVOKE CONNECT ON DATABASE ${APPNAME} FROM PUBLIC; GRANT CONNECT ON DATABASE ${APPNAME} TO ${APPNAME};" | sudo -u postgres psql ${APPNAME}
	sudo -u postgres psql ${APPNAME} < $DB_FILE
	
	echo "Create the app's runfile"
	echo "#!/bin/sh" > ${RUNFILE} #Overwrite anything in ${RUNFILE}, or create it
	echo "set -e" >> ${RUNFILE}
	echo "export ${PORT_VARNAME}=${PORT}" >> ${RUNFILE}
	echo "export ${DB_URL_VARNAME}=\"${DB_URL}\"" >> ${RUNFILE}
	echo "forever -w ${APPEXE}" >> ${RUNFILE}
	chmod +x ${RUNFILE}
}

function autostart_config {
	echo "#!/bin/sh" > ${STARTUP_FILES_LOCATION}${STARTUP_RUNFILE} #Overwrite anything in ${STARTUP_RUNFILE}, or create it
	echo "set -e" >> ${STARTUP_FILES_LOCATION}${STARTUP_RUNFILE}
	chmod +x ${STARTUP_FILES_LOCATION}${STARTUP_RUNFILE}
}

function uninstall {
	echo "Dropping any ${APPNAME} postgres data"
	echo "DROP DATABASE ${APPNAME}; DROP USER ${APPNAME};" | sudo -u postgres psql

	echo "Removing any installed node libraries"
	if [ -d node_modules ];
	then
		rm -rf node_modules
	else
		echo "No node modules installed, nothing removed"
	fi

	echo "Removing runfile (${RUNFILE})"
	if [ -f ${RUNFILE} ];
	then
		rm -f ${RUNFILE}
	else
		echo "No runfile found, nothing removed"
	fi

	echo "Removing startup runfile (${STARTUP_FILES_LOCATION}${STARTUP_RUNFILE})"
	if [ -f ${STARTUP_FILES_LOCATION}${STARTUP_RUNFILE} ];
	then
		rm -f ${STARTUP_FILES_LOCATION}${STARTUP_RUNFILE}
	else
		echo "No startup runfile exists, nothing removed"
	fi
}

uninstall
install
