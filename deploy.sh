
declare APPNAME="nouncaptcha";
declare APPRUNFILE="${APPNAME}_start.sh"

function install {
	declare APPEXE="server.js"
	declare RUNFILE="run.sh";
	declare PORT_VARNAME="NOUNCAPTCHA_PORT";
	declare -i PORT=4000;
	declare DB_PASS="$(cat /dev/urandom | tr -dc '[:alnum:]' | head -c 32)"; #Generate a strong alphanumeric password from random input
	declare DB_URL_VARNAME="NOUNCAPTCHA_DB_URL";
	declare DB_URL="postgres://nouncaptcha:${DB_PASS}@localhost:5432/nouncaptcha";
	declare DB_FILE="db_stuff/basic_database.dump";

	apt-get update
	apt-get install nodejs
	apt-get install postgresql postgresql-contrib

	sudo -u postgres createuser ${APPNAME} --connection-limit=1 --no-createdb --no-createrole --no-superuser
	sudo -u postgres createdb ${APPNAME}
	echo "ALTER USER ${APPNAME} WITH PASSWORD '${DB_PASS}'" | sudo -u postgres psql $APPNAME
	sudo -u postgres psql ${APPNAME} < $DB_FILE
	echo "REVOKE CONNECT ON DATABASE ${APPNAME} FROM PUBLIC; GRANT CONNECT ON DATABASE ${APPNAME} TO ${APPNAME};" | sudo -u postgres psql ${APPNAME}
	echo "declare -i ${PORT_VARNAME}=${PORT}" >> run.sh
	echo "declare ${DB_URL_VARNAME}=\"${DB_URL}\"" >> run.sh
	echo "forever -w ${APPEXE}" >> run.sh

	npm install
	npm install -g forever
}

install