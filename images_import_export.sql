COPY (SELECT * FROM images ORDER BY img_id) TO STDOUT with CSV HEADER;
--COPY images FROM stdin (format csv);