#!/bin/bash

#This line allows exporting to stdout, save to a file and redirect it into psql
#COPY (SELECT * FROM images ORDER BY img_id) TO STDOUT with CSV HEADER;

heroku pg:psql HEROKU_POSTGRESQL_CYAN_URL < drop_tables.sql
heroku pg:psql HEROKU_POSTGRESQL_CYAN_URL < create_tables.sql

(
  echo 'copy images from stdin (format csv);'
  cat images_table.csv || exit 1
  echo '\.'
) | heroku pg:psql HEROKU_POSTGRESQL_CYAN_URL
